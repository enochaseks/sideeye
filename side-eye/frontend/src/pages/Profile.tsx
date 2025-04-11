import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  TextField, 
  Button, 
  Avatar,
  Tabs,
  Tab,
  Card,
  CardContent,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemAvatar,
  Paper,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Badge,
  Alert,
  Menu,
  MenuItem
} from '@mui/material';
import { 
  Edit as EditIcon,
  Favorite as FavoriteIcon,
  Comment as CommentIcon,
  Add as AddIcon,
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
  PhotoCamera,
  Message as MessageIcon,
  Delete as DeleteIcon,
  Repeat as RepeatIcon
} from '@mui/icons-material';
import { auth, storage } from '../services/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, arrayUnion, arrayRemove, addDoc, onSnapshot, orderBy, serverTimestamp, setDoc, deleteDoc, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { formatDistanceToNow } from 'date-fns';
import { User, UserProfile, SideRoom } from '../types/index';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFirestore } from '../context/FirestoreContext';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

interface Post {
  id: string;
  content: string;
  authorId: string;
  timestamp: any;
  likes: string[];
  comments: number;
  authorAvatar?: string;
  authorName?: string;
  isEdited?: boolean;
  likedBy?: string[];
  reposts?: number;
  repostedBy?: string[];
}

interface Forum {
  id: string;
  title: string;
  description: string;
  members: string[];
  memberCount: number;
  ownerId: string;
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: any;
  read: boolean;
  senderName: string;
  senderAvatar: string;
}

interface DeletedItem {
  id: string;
  type: 'post' | 'room' | 'forum';
  content: any;
  deletedAt: any;
  scheduledForPermanentDeletion?: any;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

interface ProfileProps {
  userId?: string;
}

interface ConnectionsDialogProps {
  open: boolean;
  onClose: () => void;
  followers: string[];
  followersList: UserProfile[];
  followingList: UserProfile[];
  connections: string[];
  currentUser: import("../contexts/AuthContext").User | null;
  isLoading: boolean;
  handleUnfollow: (userId: string) => void;
  handleFollow: () => void;
  initialTab: number;
}

const ConnectionsDialog: React.FC<ConnectionsDialogProps> = ({
  open,
  onClose,
  followers,
  followersList,
  followingList,
  connections,
  currentUser,
  isLoading,
  handleUnfollow,
  handleFollow,
  initialTab
}) => {
  const [dialogTab, setDialogTab] = useState(initialTab);
  
  useEffect(() => {
    setDialogTab(initialTab);
  }, [initialTab, open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Tabs
          value={dialogTab}
          onChange={(e, newValue) => setDialogTab(newValue)}
          variant="fullWidth"
        >
          <Tab label={`Followers (${followers.length})`} />
          <Tab label={`Following (${connections.length})`} />
        </Tabs>
      </DialogTitle>
      <DialogContent>
        <List>
          {dialogTab === 0 ? (
            followersList.length > 0 ? (
              followersList.map((user) => (
                <ListItem key={user.id} divider>
                  <ListItemAvatar>
                    <Link to={`/profile/${user.username || user.id}`} style={{ textDecoration: 'none' }}>
                      <Avatar src={user.profilePic || undefined} />
                    </Link>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Link to={`/profile/${user.username || user.id}`} style={{ textDecoration: 'none' }}>
                        <Typography 
                          variant="subtitle1"
                          sx={{ 
                            color: 'text.primary',
                            '&:hover': { textDecoration: 'underline' }
                          }}
                        >
                          {user.name || user.username || "User"}
                        </Typography>
                      </Link>
                    }
                    secondary={user.username ? `@${user.username}` : ""}
                  />
                  {currentUser?.uid !== user.id && (
                    <ListItemSecondaryAction>
                      <Button
                        variant={connections.includes(user.id) ? "outlined" : "contained"}
                        color={connections.includes(user.id) ? "error" : "primary"}
                        onClick={(e) => {
                          e.stopPropagation();
                          connections.includes(user.id) 
                            ? handleUnfollow(user.id) 
                            : handleFollow();
                        }}
                        disabled={isLoading}
                        size="small"
                      >
                        {isLoading ? 'Loading...' : connections.includes(user.id) ? 'Unfollow' : 'Follow'}
                      </Button>
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
              ))
            ) : (
              <Typography variant="body1" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                No followers yet
              </Typography>
            )
          ) : (
            followingList.length > 0 ? (
              followingList.map((user) => (
                <ListItem key={user.id} divider>
                  <ListItemAvatar>
                    <Link to={`/profile/${user.username || user.id}`} style={{ textDecoration: 'none' }}>
                      <Avatar src={user.profilePic || undefined} />
                    </Link>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Link to={`/profile/${user.username || user.id}`} style={{ textDecoration: 'none' }}>
                        <Typography 
                          variant="subtitle1"
                          sx={{ 
                            color: 'text.primary',
                            '&:hover': { textDecoration: 'underline' }
                          }}
                        >
                          {user.name || user.username || "User"}
                        </Typography>
                      </Link>
                    }
                    secondary={user.username ? `@${user.username}` : ""}
                  />
                  {currentUser?.uid !== user.id && (
                    <ListItemSecondaryAction>
                      <Button
                        variant="outlined"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnfollow(user.id);
                        }}
                        disabled={isLoading}
                        size="small"
                      >
                        {isLoading ? 'Loading...' : 'Unfollow'}
                      </Button>
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
              ))
            ) : (
              <Typography variant="body1" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                Not following anyone yet
              </Typography>
            )
          )}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

const Profile: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { currentUser, user, userProfile, loading: authLoading, setUserProfile } = useAuth();
  const { db } = useFirestore();
  const { userId: urlParam } = useParams<{ userId: string }>();
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [posts, setPosts] = useState<Post[]>([]);
  const [forums, setForums] = useState<Forum[]>([]);
  const [sideRooms, setSideRooms] = useState<SideRoom[]>([]);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connections, setConnections] = useState<string[]>([]);
  const [followers, setFollowers] = useState<string[]>([]);
  const [showConnectionsDialog, setShowConnectionsDialog] = useState(false);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [showMessagesDialog, setShowMessagesDialog] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [followersList, setFollowersList] = useState<UserProfile[]>([]);
  const [followingList, setFollowingList] = useState<UserProfile[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [editedUsername, setEditedUsername] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [showTrashDialog, setShowTrashDialog] = useState(false);
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [connectionDialogTab, setConnectionDialogTab] = useState(0);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canViewFullProfile, setCanViewFullProfile] = useState(false);
  
  const userId = targetUserId || currentUser?.uid || '';

  const fetchUserData = useCallback(async () => {
    if (!db) {
      console.error('Firestore database is not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let foundUserId = urlParam;
      let userDoc;

      // First try to find user by username
      if (urlParam && !urlParam.includes('@')) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', urlParam));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          userDoc = querySnapshot.docs[0];
          foundUserId = userDoc.id;
        }
      }

      // If not found by username, try by ID
      if (!userDoc && foundUserId) {
        userDoc = await getDoc(doc(db, 'users', foundUserId));
      }

      if (!userDoc?.exists()) {
        setError('User not found');
        setIsLoading(false);
        return;
      }

      const userData = userDoc.data() as UserProfile;
      setUserProfile(userData);
      setTargetUserId(foundUserId || null);

      try {
        // Fetch followers and following
        if (foundUserId) {
          const [followersSnapshot, followingSnapshot] = await Promise.all([
            getDocs(collection(db, 'users', foundUserId, 'followers')),
            getDocs(collection(db, 'users', foundUserId, 'following'))
          ]);

          // Process followers and following data, filtering out the current user if viewing own profile
          const followers = followersSnapshot.docs
            .map(doc => doc.id)
            .filter(id => currentUser?.uid !== foundUserId || id !== currentUser?.uid);
          
          const following = followingSnapshot.docs
            .map(doc => doc.id)
            .filter(id => currentUser?.uid !== foundUserId || id !== currentUser?.uid);

          setFollowers(followers);
          setConnections(following);

          // Fetch detailed user data for followers and following
          const [followersData, followingData] = await Promise.all([
            Promise.all(followers.map(id => getDoc(doc(db, 'users', id)))),
            Promise.all(following.map(id => getDoc(doc(db, 'users', id))))
          ]);

          setFollowersList(followersData.map(doc => doc.data() as UserProfile));
          setFollowingList(followingData.map(doc => doc.data() as UserProfile));
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching followers/following:', error);
        setError('Error loading followers and following data');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setError('Error loading profile data');
      setIsLoading(false);
    }
  }, [db, urlParam, currentUser]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  useEffect(() => {
    if (userProfile) {
      setEditedName(userProfile.name || '');
      setEditedBio(userProfile.bio || '');
      setEditedUsername(userProfile.username || '');
    }
  }, [userProfile]);

  useEffect(() => {
    setIsFollowing(currentUser?.uid ? followers.includes(currentUser.uid) : false);
  }, [currentUser, followers]);

  const handleProfilePicChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentUser || !e.target.files?.[0] || !db) return;

    try {
      const file = e.target.files[0];
      const storageRef = ref(storage, `profilePics/${currentUser.uid}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      // Update Firestore
      await updateDoc(doc(db, 'users', currentUser.uid), {
        profilePic: downloadURL
      });

      // Update local state
      setProfilePic(downloadURL);
      if (userProfile) {
        setUserProfile({
          ...userProfile,
          profilePic: downloadURL
        });
      }
    } catch (error) {
      console.error('Error updating profile picture:', error);
      setError('Failed to update profile picture');
    }
  };

  const handleSaveProfile = async () => {
    if (!currentUser || !db) return;

    try {
      const editedName = name.trim();
      const editedBio = bio.trim();

      // Update Firestore
      await updateDoc(doc(db, 'users', currentUser.uid), {
        name: editedName,
        bio: editedBio
      });

      // Update local state
      setName(editedName);
      setBio(editedBio);
      setIsEditing(false);
      if (userProfile) {
        setUserProfile({
          ...userProfile,
          name: editedName,
          bio: editedBio
        });
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      setError('Failed to save profile');
    }
  };

  const handleFollow = async () => {
    if (!db || !currentUser || !userId) return;

    try {
      setIsLoading(true);
      
      const followingDocRef = doc(db, 'users', currentUser.uid, 'following', userId);
      await setDoc(followingDocRef, {
        timestamp: serverTimestamp()
      });

      const followersRef = doc(db, 'users', userId, 'followers', currentUser.uid);
      await setDoc(followersRef, {
        timestamp: serverTimestamp()
      });

      const notificationData = {
        type: 'follow',
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'Anonymous',
        senderAvatar: currentUser.photoURL || '',
        recipientId: userId,
        read: false,
        timestamp: serverTimestamp(),
        content: `${currentUser.displayName || 'Someone'} started following you`,
        link: `/profile/${currentUser.uid}`
      };

      await addDoc(collection(db, 'notifications'), notificationData);

      setIsFollowing(true);
      setFollowers(prev => [...prev, currentUser.uid]);
      setConnections(prev => [...prev, userId]);
      
      fetchUserData();
    } catch (error) {
      console.error('Error following user:', error);
      setError('Failed to follow user');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnfollow = async (targetUserId?: string) => {
    if (!currentUser || !userId || !db) {
      setError('Database not initialized');
      return;
    }
    const userToUnfollow = targetUserId || userId;

    try {
      setIsLoading(true);
      
      const followingDocRef = doc(db, 'users', currentUser.uid, 'following', userToUnfollow);
      await deleteDoc(followingDocRef);

      const followersRef = doc(db, 'users', userToUnfollow, 'followers', currentUser.uid);
      await deleteDoc(followersRef);

      setIsFollowing(false);
      setFollowers(prev => prev.filter(id => id !== currentUser.uid));
      setConnections(prev => prev.filter(id => id !== userToUnfollow));
      
      fetchUserData();
    } catch (error) {
      console.error('Error unfollowing user:', error);
      setError('Failed to unfollow user');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!db || !userId) return;

    const followersRef = collection(db, 'users', userId, 'followers');
    const unsubscribe = onSnapshot(followersRef, (snapshot) => {
      const newFollowers = snapshot.docs.map(doc => doc.id);
      setFollowers(newFollowers);
    });

    return () => unsubscribe();
  }, [db, userId]);

  useEffect(() => {
    if (!db || !userId) return;

    const followingRef = collection(db, 'users', userId, 'following');
    const unsubscribe = onSnapshot(followingRef, (snapshot) => {
      const newFollowing = snapshot.docs.map(doc => doc.id);
      setConnections(newFollowing);
    });

    return () => unsubscribe();
  }, [db, userId]);

  useEffect(() => {
    if (!db || !currentUser || !userId) return;

    const followingRef = doc(db, 'users', currentUser.uid, 'following', userId);
    const unsubscribe = onSnapshot(followingRef, (doc) => {
      setIsFollowing(doc.exists());
    });

    return () => unsubscribe();
  }, [db, currentUser, userId]);

  const renderMessageButton = () => {
    if (!userId) return null;

    return (
      <IconButton
        color="primary"
        onClick={() => {
          setShowMessagesDialog(true);
          messages.forEach(msg => {
            if (!msg.read) {
              handleMarkAsRead(msg.id);
            }
          });
        }}
        sx={{ 
          border: '1px solid',
          borderColor: 'primary.main',
          '&:hover': {
            backgroundColor: 'primary.light',
            opacity: 0.8
          },
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Badge badgeContent={unreadCount} color="error">
          <MessageIcon />
        </Badge>
      </IconButton>
    );
  };

  const renderFollowButton = () => {
    if (currentUser?.uid === userId || !userId) return null;

    return (
      <Button
        variant={isFollowing ? "outlined" : "contained"}
        color={isFollowing ? "error" : "primary"}
        startIcon={isFollowing ? <PersonRemoveIcon /> : <PersonAddIcon />}
        onClick={isFollowing ? () => handleUnfollow(userId) : handleFollow}
        disabled={isLoading}
      >
        {isLoading ? 'Loading...' : isFollowing ? 'Unfollow' : 'Follow'}
      </Button>
    );
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleSendMessage = async () => {
    if (!currentUser || !userId || !newMessage.trim() || isSending || !db) {
      setError('Database not initialized');
      return;
    }

    try {
      setIsSending(true);
      const messageData = {
        senderId: currentUser.uid,
        receiverId: userId,
        content: newMessage.trim(),
        timestamp: serverTimestamp(),
        read: false,
        senderName: currentUser.displayName || 'Anonymous',
        senderAvatar: userProfile?.profilePic || null
      };

      await addDoc(collection(db, 'messages'), messageData);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleMarkAsRead = async (messageId: string) => {
    if (!currentUser || !db) {
      setError('Database not initialized');
      return;
    }

    try {
      const messageRef = doc(db, 'messages', messageId);
      await updateDoc(messageRef, {
        read: true
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const handleRestoreItem = async (itemId: string, type: 'post' | 'room' | 'forum') => {
    if (!db) {
      setError('Database not initialized');
      return;
    }

    try {
      const deletedItemRef = doc(db, 'deleted_items', itemId);
      const deletedItemDoc = await getDoc(deletedItemRef);
      
      if (!deletedItemDoc.exists()) {
        setError('Item not found in trash');
        return;
      }
  
      const deletedItem = deletedItemDoc.data();
      const targetCollection = type === 'post' ? 'posts' : type === 'room' ? 'sideRooms' : 'forums';
      
      await setDoc(doc(db, targetCollection, itemId), {
        ...deletedItem.content,
        deletedAt: null,
        scheduledForPermanentDeletion: null
      });
  
      await deleteDoc(deletedItemRef);
  
      setDeletedItems(prev => prev.filter(item => item.id !== itemId));
      
      setError('Item restored successfully');
    } catch (error) {
      console.error('Error restoring item:', error);
      setError('Failed to restore item');
    }
  };

  const handlePermanentDelete = async (itemId: string) => {
    if (!db) {
      setError('Database not initialized');
      return;
    }

    try {
      await deleteDoc(doc(db, 'deleted_items', itemId));
      setDeletedItems(prev => prev.filter(item => item.id !== itemId));
      setError('Item permanently deleted');
    } catch (error) {
      console.error('Error permanently deleting item:', error);
      setError('Failed to delete item permanently');
    }
  };

  const fetchMessages = async () => {
    if (!auth.currentUser || !userId || !db) {
      setError('Database not initialized');
      return;
    }

    try {
      const messagesQuery = query(
        collection(db, 'messages'),
        where('receiverId', '==', auth.currentUser.uid),
        orderBy('timestamp', 'desc')
      );

      const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        const messagesList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Message[];
        setMessages(messagesList);
        setUnreadCount(messagesList.filter(msg => !msg.read).length);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  useEffect(() => {
    if (showMessagesDialog) {
      const unsubscribe = fetchMessages();
      return () => {
        if (unsubscribe) {
          unsubscribe.then(unsub => unsub?.());
        }
      };
    }
  }, [showMessagesDialog]);

  const handleDeletePost = async (postId: string) => {
    if (!auth.currentUser || !db) {
      setError('Database not initialized');
      return;
    }

    try {
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
      
      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }

      const postData = postDoc.data();
      if (postData.authorId !== auth.currentUser.uid) {
        throw new Error('You can only delete your own posts');
      }

      // Move to deleted_items collection with 24-hour expiration
      const deletedItemRef = doc(db, 'deleted_items', postId);
      await setDoc(deletedItemRef, {
        type: 'post',
        content: postData,
        deletedAt: serverTimestamp(),
        scheduledForDeletion: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });

      // Delete from main posts collection
      await deleteDoc(postRef);

      // Update user's post count
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        posts: increment(-1)
      });

      // Update local state
      setPosts(prev => prev.filter(post => post.id !== postId));
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  const handleLike = async (postId: string) => {
    if (!currentUser || !db) return;
    
    try {
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
      
      if (!postDoc.exists()) return;
      
      const postData = postDoc.data();
      const isLiked = postData.likedBy?.includes(currentUser.uid);
      
      if (isLiked) {
        // Remove like from subcollection
        const likeRef = doc(db, 'posts', postId, 'likes', currentUser.uid);
        await deleteDoc(likeRef);
        
        // Update post document
        await updateDoc(postRef, {
          likes: increment(-1),
          likedBy: arrayRemove(currentUser.uid)
        });
      } else {
        // Add like to subcollection
        const likeRef = doc(db, 'posts', postId, 'likes', currentUser.uid);
        await setDoc(likeRef, {
          userId: currentUser.uid,
          timestamp: serverTimestamp()
        });
        
        // Update post document
        await updateDoc(postRef, {
          likes: increment(1),
          likedBy: arrayUnion(currentUser.uid)
        });
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleRepost = async (postId: string) => {
    if (!currentUser || !db) return;
    
    try {
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
      
      if (!postDoc.exists()) return;
      
      const postData = postDoc.data();
      const isReposted = postData.repostedBy?.includes(currentUser.uid);
      
      if (isReposted) {
        // Remove repost
        await updateDoc(postRef, {
          reposts: increment(-1),
          repostedBy: arrayRemove(currentUser.uid)
        });
        
        // Delete repost document
        const repostQuery = query(
          collection(db, 'reposts'),
          where('postId', '==', postId),
          where('userId', '==', currentUser.uid)
        );
        const repostSnapshot = await getDocs(repostQuery);
        repostSnapshot.forEach(async (doc) => {
          await deleteDoc(doc.ref);
        });
      } else {
        // Add repost
        await updateDoc(postRef, {
          reposts: increment(1),
          repostedBy: arrayUnion(currentUser.uid)
        });
        
        // Create repost document
        await addDoc(collection(db, 'reposts'), {
          postId,
          userId: currentUser.uid,
          originalAuthorId: postData.authorId,
          timestamp: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error reposting:', error);
    }
  };

  // Update the messages dialog content
  const renderMessagesDialog = () => (
    <Dialog
      open={showMessagesDialog}
      onClose={() => setShowMessagesDialog(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        {currentUser?.uid === userId ? 'Your Messages' : `Message ${username}`}
      </DialogTitle>
      <DialogContent>
        {currentUser?.uid === userId ? (
          <List>
            {messages.map((message) => (
              <ListItem key={message.id} divider>
                <ListItemAvatar>
                  <Avatar src={message.senderAvatar || undefined} />
                </ListItemAvatar>
                <ListItemText
                  primary={message.senderName}
                  secondary={message.content}
                />
                <ListItemSecondaryAction>
                  <Typography variant="caption" color="text.secondary">
                    {message.timestamp?.toDate().toLocaleString()}
                  </Typography>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        ) : (
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Your message"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              variant="outlined"
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || isSending}
                sx={{ 
                  minWidth: '100px',
                  '@media (max-width: 600px)': {
                    width: '100%'
                  }
                }}
              >
                {isSending ? 'Sending...' : 'Send'}
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowMessagesDialog(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );

  // Update the post list item to include repost button and functional like button
  const renderPost = (post: Post) => (
    <ListItem 
      key={post.id} 
      divider
      sx={{ 
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: 'action.hover'
        }
      }}
      onClick={() => {
        setSelectedPost(post);
        setShowPostDialog(true);
      }}
    >
      <ListItemAvatar>
        <Link to={`/profile/${post.authorName}`} style={{ textDecoration: 'none' }}>
          <Avatar src={post.authorAvatar || undefined} />
        </Link>
      </ListItemAvatar>
      <ListItemText
        primary={
          <Box>
            <Link to={`/profile/${post.authorName}`} style={{ textDecoration: 'none' }}>
              <Typography 
                variant="subtitle1" 
                component="span"
                sx={{ 
                  color: 'text.primary',
                  '&:hover': { textDecoration: 'underline' }
                }}
              >
                {post.authorName}
              </Typography>
            </Link>
            <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 1 }}>
              {formatDistanceToNow(post.timestamp?.toDate?.() || new Date())} ago
            </Typography>
          </Box>
        }
        secondary={
          <Box>
            <Typography variant="body1" sx={{ mt: 1 }}>
              {post.content}
            </Typography>
            {post.isEdited && (
              <Typography variant="caption" color="text.secondary">
                (edited)
              </Typography>
            )}
          </Box>
        }
      />
      <ListItemSecondaryAction>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton 
            edge="end" 
            aria-label="likes"
            onClick={(e) => {
              e.stopPropagation();
              handleLike(post.id);
            }}
          >
            <FavoriteIcon color={post.likedBy?.includes(currentUser?.uid || '') ? "error" : "inherit"} />
            <Typography variant="body2" sx={{ ml: 1 }}>
              {post.likes || 0}
            </Typography>
          </IconButton>
          <IconButton
            edge="end"
            aria-label="repost"
            onClick={(e) => {
              e.stopPropagation();
              handleRepost(post.id);
            }}
          >
            <RepeatIcon color={post.repostedBy?.includes(currentUser?.uid || '') ? "primary" : "inherit"} />
            <Typography variant="body2" sx={{ ml: 1 }}>
              {post.reposts || 0}
            </Typography>
          </IconButton>
        </Box>
      </ListItemSecondaryAction>
    </ListItem>
  );

  // Update the connections dialog to properly display users and tab navigation
  const renderConnectionsDialog = () => (
    <ConnectionsDialog 
      open={showConnectionsDialog}
      onClose={() => setShowConnectionsDialog(false)}
      followers={followers}
      followersList={followersList}
      followingList={followingList}
      connections={connections}
      currentUser={currentUser}
      isLoading={isLoading}
      handleUnfollow={handleUnfollow}
      handleFollow={handleFollow}
      initialTab={connectionDialogTab}
    />
  );

  // Handle menu open
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  // Handle menu close
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  if (authLoading || isLoading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Profile Header */}
        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, backgroundColor: 'background.paper' }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: 'center' }}>
            <Box sx={{ position: 'relative' }}>
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={
                  currentUser?.uid === userId && (
                    <IconButton
                      component="label"
                      size="small"
                      onClick={handleMenuOpen}
                      sx={{
                        bgcolor: 'background.paper',
                        '&:hover': { bgcolor: 'background.default' }
                      }}
                    >
                      <PhotoCamera fontSize="small" />
                    </IconButton>
                  )
                }
              >
                <Avatar
                  src={profilePic || undefined}
                  alt={username}
                  sx={{ width: 120, height: 120 }}
                />
              </Badge>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {name}
                </Typography>
                {currentUser?.uid === userId && (
                  <IconButton onClick={() => setIsEditing(true)} size="small">
                    <EditIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                @{username}
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {bio}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {renderFollowButton()}
                {renderMessageButton()}
                {currentUser?.uid === userId && (
                  <IconButton
                    color="error"
                    onClick={() => setShowTrashDialog(true)}
                    sx={{ 
                      border: '1px solid',
                      borderColor: 'error.main',
                      '&:hover': {
                        backgroundColor: 'error.light',
                        opacity: 0.8
                      }
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                )}
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* Stats and Tabs */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
          {/* Stats Card */}
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, backgroundColor: 'background.paper', flex: { md: 1 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-around', gap: 2 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6">{posts.length || 0}</Typography>
                <Typography variant="body2" color="text.secondary">Posts</Typography>
              </Box>
              <Box 
                sx={{ 
                  textAlign: 'center',
                  cursor: 'pointer',
                  '&:hover': {
                    color: 'primary.main'
                  }
                }}
                onClick={() => {
                  // Ensure data is refreshed before showing dialog
                  fetchUserData();
                  setConnectionDialogTab(0); // Show followers tab
                  setShowConnectionsDialog(true);
                }}
              >
                <Typography variant="h6">{followers.length || 0}</Typography>
                <Typography variant="body2" color="text.secondary">Followers</Typography>
              </Box>
              <Box 
                sx={{ 
                  textAlign: 'center',
                  cursor: 'pointer',
                  '&:hover': {
                    color: 'primary.main'
                  }
                }}
                onClick={() => {
                  // Ensure data is refreshed before showing dialog
                  fetchUserData();
                  setConnectionDialogTab(1); // Show following tab
                  setShowConnectionsDialog(true);
                }}
              >
                <Typography variant="h6">{connections.length || 0}</Typography>
                <Typography variant="body2" color="text.secondary">Following</Typography>
              </Box>
            </Box>
          </Paper>

          {/* Connections Dialog */}
          {renderConnectionsDialog()}

          {/* Tabs */}
          <Box sx={{ flex: { md: 2 } }}>
            <Paper elevation={0} sx={{ borderRadius: 2, backgroundColor: 'background.paper' }}>
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                variant="fullWidth"
                sx={{
                  borderBottom: 1,
                  borderColor: 'divider',
                  '& .MuiTab-root': {
                    textTransform: 'none',
                    fontWeight: 'medium'
                  }
                }}
              >
                <Tab label="Posts" />
                <Tab label="Forums" />
                <Tab label="Side Rooms" />
                <Tab label="Liked Posts" />
                {currentUser?.uid === userId && <Tab label="Deleted Items" />}
              </Tabs>
            </Paper>
          </Box>
        </Box>

        {/* Tab Content */}
        <Box sx={{ flex: 1 }}>
          <TabPanel value={activeTab} index={0}>
            {posts.length === 0 ? (
              <Typography>No posts yet</Typography>
            ) : (
              <List>
                {posts.map(renderPost)}
              </List>
            )}
          </TabPanel>
          <TabPanel value={activeTab} index={1}>
            {forums.length === 0 ? (
              <Typography>Not a member of any forums yet</Typography>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                {forums.map((forum) => (
                  <Box key={forum.id}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6">{forum.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {forum.description}
                        </Typography>
                        <Chip
                          size="small"
                          label={`${forum.memberCount} members`}
                          sx={{ mt: 1 }}
                        />
                      </CardContent>
                    </Card>
                  </Box>
                ))}
              </Box>
            )}
          </TabPanel>
          <TabPanel value={activeTab} index={2}>
            {sideRooms.length === 0 ? (
              <Typography>Not a member of any side rooms yet</Typography>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                {sideRooms.map((room) => (
                  <Box key={room.id}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6">{room.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {room.description}
                        </Typography>
                        <Chip
                          size="small"
                          label={`${room.memberCount} members`}
                          sx={{ mt: 1 }}
                        />
                      </CardContent>
                    </Card>
                  </Box>
                ))}
              </Box>
            )}
          </TabPanel>
          <TabPanel value={activeTab} index={3}>
            {likedPosts.length === 0 ? (
              <Typography>No liked posts yet</Typography>
            ) : (
              <List>
                {likedPosts.map((post) => (
                  <ListItem key={post.id} divider>
                    <ListItemText
                      primary={post.content}
                      secondary={`Posted ${formatDistanceToNow(
                        post.timestamp instanceof Date 
                          ? post.timestamp 
                          : post.timestamp?.toDate?.() || new Date()
                      )} ago`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" aria-label="likes">
                        <FavoriteIcon />
                        <Typography variant="body2" sx={{ ml: 1 }}>
                          {post.likes.length}
                        </Typography>
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </TabPanel>
          {currentUser?.uid === userId && (
            <TabPanel value={activeTab} index={4}>
              {deletedItems.length === 0 ? (
                <Typography>No deleted items</Typography>
              ) : (
                <List>
                  {deletedItems.map((item) => (
                    <ListItem key={item.id} divider>
                      <ListItemText
                        primary={
                          <Box>
                            <Typography variant="subtitle1">
                              {item.type === 'post' ? 'Post' : item.type === 'room' ? 'Side Room' : 'Forum'}
                            </Typography>
                            <Typography variant="body1">
                              {item.type === 'post' ? item.content.content : item.content.name}
                            </Typography>
                          </Box>
                        }
                        secondary={`Deleted ${formatDistanceToNow(item.deletedAt.toDate())} ago`}
                      />
                      <ListItemSecondaryAction>
                        <Button 
                          variant="outlined"
                          onClick={() => handleRestoreItem(item.id, item.type)}
                        >
                          Restore
                        </Button>
                        <Button 
                          variant="outlined" 
                          color="error"
                          onClick={() => handlePermanentDelete(item.id)}
                          sx={{ ml: 1 }}
                        >
                          Delete Permanently
                        </Button>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </TabPanel>
          )}
        </Box>
      </Box>

      {/* Edit Profile Dialog */}
      <Dialog 
        open={isEditing} 
        onClose={() => setIsEditing(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Edit Profile
        </DialogTitle>
        <DialogContent>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 3,
            mt: 2
          }}>
          <TextField
              label="Name"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
            fullWidth
              variant="outlined"
            />
            <TextField
            label="Username"
              value={editedUsername}
              onChange={(e) => setEditedUsername(e.target.value)}
              fullWidth
              variant="outlined"
              helperText="This will be your unique identifier on the platform"
          />
          <TextField
              label="Bio"
              value={editedBio}
              onChange={(e) => setEditedBio(e.target.value)}
              multiline
              rows={4}
            fullWidth
              variant="outlined"
              helperText="Tell others about yourself (You can use emojis!)"
              InputProps={{
                endAdornment: (
                  <IconButton
                    onClick={() => {
                      const emoji = window.prompt('Enter an emoji:');
                      if (emoji) {
                        setEditedBio(prev => prev + emoji);
                      }
                    }}
                    sx={{ 
                      color: 'primary.main',
                      '&:hover': {
                        color: 'primary.dark'
                      }
                    }}
                  >
                    <span role="img" aria-label="emoji">😊</span>
                  </IconButton>
                )
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            variant="outlined"
            onClick={() => setIsEditing(false)}
            sx={{ 
              minWidth: '120px',
              borderColor: 'text.secondary',
              color: 'text.secondary',
              '&:hover': {
                borderColor: 'text.primary',
                color: 'text.primary'
              }
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveProfile}
            disabled={isLoading}
            sx={{ 
              minWidth: '120px',
              bgcolor: 'primary.main',
              '&:hover': {
                bgcolor: 'primary.dark'
              }
            }}
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Messages Dialog */}
      {renderMessagesDialog()}

      {/* Post Dialog */}
      <Dialog
        open={showPostDialog}
        onClose={() => setShowPostDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar src={selectedPost?.authorAvatar || undefined} />
            <Box>
              <Typography variant="subtitle1">{selectedPost?.authorName}</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedPost?.timestamp?.toDate?.()?.toLocaleString()}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mt: 2 }}>
            {selectedPost?.content}
          </Typography>
          {selectedPost?.isEdited && (
            <Typography variant="caption" color="text.secondary">
              (edited)
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <IconButton>
            <FavoriteIcon color={selectedPost?.likedBy?.includes(currentUser?.uid || '') ? "error" : "inherit"} />
            <Typography variant="body2" sx={{ ml: 1 }}>
              {selectedPost?.likes || 0}
            </Typography>
          </IconButton>
          <Button onClick={() => setShowPostDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { handleMenuClose(); fileInputRef.current?.click(); }}>
          Change Profile Picture
        </MenuItem>
        <MenuItem onClick={() => { handleMenuClose(); setShowCreateStory(true); }}>
          Add to Story
        </MenuItem>
      </Menu>
    </Container>
  );
};

export default Profile; 