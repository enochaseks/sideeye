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
  MenuItem,
  CardMedia,
  Drawer,
  CardActions
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
  Repeat as RepeatIcon,
  Close as CloseIcon,
  Lock as LockIcon,
  Group,
  Lock
} from '@mui/icons-material';
import { auth, storage } from '../services/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, arrayUnion, arrayRemove, addDoc, onSnapshot, orderBy, serverTimestamp, setDoc, deleteDoc, increment, limit, writeBatch, Timestamp, runTransaction } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { formatTimestamp } from '../utils/dateUtils';
import { User, UserProfile, SideRoom, UserSideRoom } from '../types/index';
import { Link, useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFirestore } from '../context/FirestoreContext';
import { toast } from 'react-hot-toast';
import VibitIcon from '../components/VibitIcon';

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

interface Video {
  id: string;
  url: string;
  userId: string;
  username: string;
  likes: number;
  comments: number;
  timestamp: any;
  duration?: number;
  resolution?: string;
  thumbnailUrl?: string;
  commentsList?: {
    id: string;
    userId: string;
    username: string;
    content: string;
    timestamp: any;
  }[];
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
  const [sideRooms, setSideRooms] = useState<UserSideRoom[]>([]);
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
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [newComment, setNewComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [followRequested, setFollowRequested] = useState(false);
  const [showFollowRequests, setShowFollowRequests] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<string[]>([]);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [following, setFollowing] = useState<string[]>([]);
  const [joinedRooms, setJoinedRooms] = useState<UserSideRoom[]>([]);
  const [createdRooms, setCreatedRooms] = useState<UserSideRoom[]>([]);
  const [pendingFollowRequests, setPendingFollowRequests] = useState<FollowRequestProfile[]>([]);
  const [showFollowRequestsDialog, setShowFollowRequestsDialog] = useState(false);
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  
  const userId = targetUserId || currentUser?.uid || '';

  useEffect(() => {
    if (!urlParam) {
      setTargetUserId(currentUser?.uid || null);
    } else {
      setTargetUserId(urlParam);
    }
  }, [urlParam, currentUser?.uid]);

  const fetchUserData = useCallback(async () => {
    if (!db || !targetUserId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // First check if we can view the profile
      const userRef = doc(db, 'users', targetUserId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        setError('Profile not found');
        setIsLoading(false);
        return;
      }

      const userData = userDoc.data() as UserProfile;
      const isPrivateAccount = userData.isPrivate || false;
      const isOwnProfile = currentUser?.uid === targetUserId;
      
      setIsPrivate(isPrivateAccount);
      setUserData(userData);
      setUsername(userData.username || '');
      setName(userData.name || '');
      setBio(userData.bio || '');
      setProfilePic(userData.profilePic || null);

      // Set view permissions
      if (isOwnProfile || !isPrivateAccount) {
        setCanViewFullProfile(true);
        setError(null);
      } else {
        // For private accounts, check if we're a follower
        if (currentUser?.uid) {
          const followerRef = doc(db, `users/${targetUserId}/followers/${currentUser.uid}`);
          const followerDoc = await getDoc(followerRef);
          const isFollower = followerDoc.exists();
          
          setCanViewFullProfile(isFollower);
          if (!isFollower) {
            setError('This profile is private');
          }
        } else {
          setCanViewFullProfile(false);
          setError('This profile is private');
        }
      }

      // Fetch followers and following
      const [followersSnapshot, followingSnapshot] = await Promise.all([
        getDocs(collection(db, `users/${targetUserId}/followers`)),
        getDocs(collection(db, `users/${targetUserId}/following`))
      ]);

      const followers = followersSnapshot.docs.map(doc => doc.id);
      const following = followingSnapshot.docs.map(doc => doc.id);

      setFollowers(followers);
      setFollowing(following);
      setConnections(following);

      // Only fetch additional data if we can view the profile
      if (canViewFullProfile) {
        // Fetch detailed user data and other content
        const [followersData, followingData] = await Promise.all([
          Promise.all(followers.map(userId => getDoc(doc(db, 'users', userId)))),
          Promise.all(following.map(userId => getDoc(doc(db, 'users', userId))))
        ]);

        setFollowersList(followersData.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as UserProfile)));
        
        setFollowingList(followingData.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as UserProfile)));

        // Fetch posts, videos, and other data
        const [postsSnapshot, likedPostsSnapshot, videosSnapshot] = await Promise.all([
          getDocs(query(
            collection(db, 'posts'),
            where('authorId', '==', targetUserId),
            orderBy('timestamp', 'desc')
          )),
          getDocs(query(
            collection(db, 'posts'),
            where('likedBy', 'array-contains', targetUserId),
            orderBy('timestamp', 'desc')
          )),
          getDocs(query(
            collection(db, 'videos'),
            where('userId', '==', targetUserId),
            orderBy('timestamp', 'desc')
          ))
        ]);

        setPosts(postsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Post)));

        setLikedPosts(likedPostsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Post)));

        setVideos(videosSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Video)));
      }
    } catch (error) {
      console.error('Error in fetchUserData:', error);
      setError('Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  }, [db, targetUserId, currentUser?.uid, canViewFullProfile]);

  // Add real-time listener for privacy settings and profile data
  useEffect(() => {
    if (!db || !targetUserId) return;

    const userRef = doc(db, 'users', targetUserId);
    const unsubscribe = onSnapshot(userRef, async (docSnapshot) => {
      if (docSnapshot.exists()) {
        const userData = docSnapshot.data() as UserProfile;
        const isPrivateAccount = userData.isPrivate || false;
        const isOwnProfile = currentUser?.uid === targetUserId;

        // Update basic profile data
        setUserData(userData);
        setIsPrivate(isPrivateAccount);
        setUsername(userData.username || '');
        setName(userData.name || '');
        setBio(userData.bio || '');
        setProfilePic(userData.profilePic || null);

        // Set view permissions - always allow full view for own profile or public accounts
        if (isOwnProfile || !isPrivateAccount) {
          setCanViewFullProfile(true);
          setError(null);
        } else {
          // For private accounts, check if we're a follower
          if (currentUser?.uid) {
            const followerRef = doc(db, `users/${targetUserId}/followers/${currentUser.uid}`);
            const followerDoc = await getDoc(followerRef);
            const isFollower = followerDoc.exists();
            
            setCanViewFullProfile(isFollower);
            if (!isFollower) {
              setError('This profile is private');
            }
          } else {
            setCanViewFullProfile(false);
            setError('This profile is private');
          }
        }

        // If account becomes public, clear any follow requests
        if (!isPrivateAccount && followRequested) {
          try {
            // Delete the follow request if it exists
            if (currentUser?.uid) {
              const requestRef = doc(db, 'users', targetUserId, 'followRequests', currentUser.uid);
              await deleteDoc(requestRef);
              setFollowRequested(false);
            }
          } catch (error) {
            console.error('Error clearing follow request:', error);
          }
        }
      }
    }, (error) => {
      console.error('Error in privacy settings listener:', error);
      setError('Failed to sync privacy settings');
    });

    return () => unsubscribe();
  }, [db, targetUserId, currentUser?.uid, followRequested]);

  useEffect(() => {
    if (targetUserId) {
      fetchUserData();
    }
  }, [fetchUserData, targetUserId]);

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

  useEffect(() => {
    if (currentUser?.uid && targetUserId && isPrivate) {
      const checkFollowRequest = async () => {
        if (!db) return;
        try {
          const requestRef = doc(db, 'users', targetUserId, 'followRequests', currentUser.uid);
          const requestDoc = await getDoc(requestRef);
          setFollowRequested(requestDoc.exists());
        } catch (error) {
          console.error('Error checking follow request:', error);
        }
      };
      checkFollowRequest();

      // Set up real-time listener for follow request changes
      if (db) {
        const requestRef = doc(db, 'users', targetUserId, 'followRequests', currentUser.uid);
        const unsubscribe = onSnapshot(requestRef, (doc) => {
          setFollowRequested(doc.exists());
        });

        return () => unsubscribe();
      }
    }
  }, [currentUser?.uid, targetUserId, isPrivate, db]);

  useEffect(() => {
    if (currentUser?.uid && targetUserId && currentUser.uid === targetUserId) {
      const fetchPendingRequests = async () => {
        if (!db) return;
        try {
          const requestsRef = collection(db, 'users', targetUserId, 'followRequests');
          const requestsSnapshot = await getDocs(requestsRef);
          const requests = requestsSnapshot.docs.map(doc => doc.id);
          setPendingRequests(requests);
        } catch (error) {
          console.error('Error fetching pending requests:', error);
        }
      };
      fetchPendingRequests();
    }
  }, [currentUser?.uid, targetUserId, db]);

  // Add type for user document data
  interface UserDocData {
    name?: string;
    username?: string;
    profilePic?: string;
    bio?: string;
    isPrivate?: boolean;
    createdAt?: Timestamp;
  }

  // Add a new interface for follow request profiles
  interface FollowRequestProfile {
    id: string;
    name: string;
    username: string;
    profilePic: string;
    bio: string;
    isPrivate: boolean;
    createdAt: Date;
  }

  // Update the follow requests effect
  useEffect(() => {
    if (!db || !userId || userId !== currentUser?.uid) return;

    const requestsRef = collection(db, 'users', userId, 'followRequests');
    const unsubscribe = onSnapshot(requestsRef, async (snapshot) => {
      const requests = await Promise.all(
        snapshot.docs.map(async (requestDoc) => {
          const userDocRef = doc(db, 'users', requestDoc.id);
          const userDocSnap = await getDoc(userDocRef);
          const userData = userDocSnap.data() as UserDocData;
          
          // Create a follow request profile with minimal required fields
          const requestProfile: FollowRequestProfile = {
            id: requestDoc.id,
            name: userData.name || '',
            username: userData.username || '',
            profilePic: userData.profilePic || '',
            bio: userData.bio || '',
            isPrivate: userData.isPrivate || false,
            createdAt: userData.createdAt ? (userData.createdAt as Timestamp).toDate() : new Date()
          };

          return requestProfile;
        })
      );
      setPendingFollowRequests(requests);
    });

    return () => unsubscribe();
  }, [db, userId, currentUser]);

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
      const trimmedName = editedName.trim();
      const trimmedBio = editedBio.trim();
      const trimmedUsername = editedUsername.trim();

      // Update Firestore
      await updateDoc(doc(db, 'users', currentUser.uid), {
        name: trimmedName,
        bio: trimmedBio,
        username: trimmedUsername
      });

      // Update local state
      setName(trimmedName);
      setBio(trimmedBio);
      setUsername(trimmedUsername);
      setIsEditing(false);
      
      if (userProfile) {
        setUserProfile({
          ...userProfile,
          name: trimmedName,
          bio: trimmedBio,
          username: trimmedUsername
        });
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      setError('Failed to save profile');
    }
  };

  const handleFollow = async () => {
    if (!db || !currentUser || !targetUserId) return;

    try {
      if (isPrivate) {
        // Create follow request
        const requestRef = doc(db, 'users', targetUserId, 'followRequests', currentUser.uid);
        await setDoc(requestRef, {
          timestamp: serverTimestamp()
        });

        // Create notification for the account owner
        const notificationRef = doc(collection(db, 'users', targetUserId, 'notifications'));
        await setDoc(notificationRef, {
          type: 'follow_request',
          senderId: currentUser.uid,
          senderName: currentUser.displayName || 'Anonymous',
          senderAvatar: currentUser.photoURL || '',
          timestamp: serverTimestamp(),
          read: false
        });

        setFollowRequested(true);
      } else {
        // Original follow logic for public accounts
        const followingRef = doc(db, 'users', currentUser.uid, 'following', targetUserId);
        const followersRef = doc(db, 'users', targetUserId, 'followers', currentUser.uid);
        
        await setDoc(followingRef, { timestamp: serverTimestamp() });
        await setDoc(followersRef, { timestamp: serverTimestamp() });
        
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Error handling follow:', error);
      setError('Failed to process follow request');
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
      setFollowing(prev => prev.filter(id => id !== userToUnfollow));
      
      // Refresh the data
      await fetchUserData();
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

  useEffect(() => {
    if (currentUser?.uid && targetUserId) {
      const checkCanViewProfile = async () => {
        if (!db) return;
        try {
          const followersRef = doc(db, 'users', targetUserId, 'followers', currentUser.uid);
          const followersDoc = await getDoc(followersRef);
          setCanViewFullProfile(followersDoc.exists() || currentUser.uid === targetUserId);
        } catch (error) {
          console.error('Error checking profile visibility:', error);
        }
      };
      checkCanViewProfile();
    }
  }, [currentUser?.uid, targetUserId, db]);

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
    if (currentUser?.uid === targetUserId || !targetUserId) return null;

    return (
      <Button
        variant={isFollowing ? "outlined" : "contained"}
        color={isFollowing ? "error" : "primary"}
        startIcon={isFollowing ? <PersonRemoveIcon /> : <PersonAddIcon />}
        onClick={isFollowing ? () => handleUnfollow(targetUserId) : handleFollow}
        disabled={isLoading || (isPrivate && followRequested)}
      >
        {isLoading ? 'Loading...' : isFollowing ? 'Unfollow' : isPrivate ? (followRequested ? 'Requested' : 'Follow') : 'Follow'}
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
    console.log(`Profile: handleLike triggered for postId: ${postId}`);
    const postRef = doc(db, 'posts', postId);
    const userId = currentUser.uid;
    const notificationCollectionRef = collection(db, 'notifications');

    try {
      await runTransaction(db, async (transaction) => {
        const postDoc = await transaction.get(postRef);
        if (!postDoc.exists()) {
          throw new Error("Post not found");
        }
        const postData = postDoc.data();
        let likedBy = postData.likedBy || [];

        if (likedBy.includes(userId)) {
          // Unlike
          console.log('[Transaction] Profile: Unliking...');
          likedBy = likedBy.filter((uid: string) => uid !== userId);
          transaction.update(postRef, { likedBy: likedBy, likes: likedBy.length });
        } else {
          // Like
          console.log('[Transaction] Profile: Liking...');
          likedBy = [...likedBy, userId];
          transaction.update(postRef, { likedBy: likedBy, likes: likedBy.length });
        }
      });
      console.log('Profile: Like transaction successful.');

      // Create notification after successful transaction
      const postDocAfter = await getDoc(postRef);
      if (postDocAfter.exists()) {
          const postData = postDocAfter.data();
          const likedBy = postData.likedBy || [];
          if (likedBy.includes(userId) && postData.authorId !== userId) { // Check if liked and not own post
              console.log('Profile: Creating like notification...');
              const notificationPayload = {
                  type: 'like',
                  senderId: userId,
                  senderName: currentUser.displayName || 'Anonymous',
                  senderAvatar: currentUser.photoURL || '',
                  recipientId: postData.authorId,
                  postId: postId,
                  content: `${currentUser.displayName || 'Someone'} liked your post`,
                  createdAt: serverTimestamp(),
                  isRead: false
              };
              await addDoc(notificationCollectionRef, notificationPayload);
              console.log('Profile: Like notification created.');
          }
      }

    } catch (error) {
      console.error('Profile: Error toggling like:', error);
      toast.error('Failed to update like');
    }
  };

  const handleRepost = async (postId: string) => {
    if (!currentUser || !db) return;
    console.log(`Profile: handleRepost triggered for postId: ${postId}`);
    const postRef = doc(db, 'posts', postId);
    const userId = currentUser.uid;
    const notificationCollectionRef = collection(db, 'notifications');

    try {
       await runTransaction(db, async (transaction) => {
        const postDoc = await transaction.get(postRef);
        if (!postDoc.exists()) {
            throw new Error("Post not found");
        }
        const postData = postDoc.data();
        let repostedBy = postData.repostedBy || [];

        if (repostedBy.includes(userId)) {
            // Unrepost
            console.log('[Transaction] Profile: Unreposting...');
            repostedBy = repostedBy.filter((uid: string) => uid !== userId);
            transaction.update(postRef, { repostedBy: repostedBy, reposts: repostedBy.length });
        } else {
            // Repost
            console.log('[Transaction] Profile: Reposting...');
            repostedBy = [...repostedBy, userId];
            transaction.update(postRef, { repostedBy: repostedBy, reposts: repostedBy.length });
        }
       });
       console.log('Profile: Repost transaction successful.');

      // Create notification after successful transaction
      const postDocAfter = await getDoc(postRef);
      if (postDocAfter.exists()) {
          const postData = postDocAfter.data();
          const repostedBy = postData.repostedBy || [];
           if (repostedBy.includes(userId) && postData.authorId !== userId) { // Check if reposted and not own post
              console.log('Profile: Creating repost notification...');
              const notificationPayload = {
                  type: 'repost',
                  senderId: userId,
                  senderName: currentUser.displayName || 'Anonymous',
                  senderAvatar: currentUser.photoURL || '',
                  recipientId: postData.authorId,
                  postId: postId,
                  content: `${currentUser.displayName || 'Someone'} reposted your post`,
                  createdAt: serverTimestamp(),
                  isRead: false
              };
              await addDoc(notificationCollectionRef, notificationPayload);
              console.log('Profile: Repost notification created.');
           }
      }

    } catch (error) {
      console.error('Profile: Error toggling repost:', error);
      toast.error('Failed to update repost');
    }
  };

  const handleAddComment = async (postId: string, comment: string) => {
    if (!currentUser || !comment.trim() || !db) return;
    console.log(`Profile: handleAddComment triggered for postId: ${postId}`);
    
    const postRef = doc(db, 'posts', postId);
    const commentsCollectionRef = collection(db, `posts/${postId}/comments`);
    const userId = currentUser.uid;
    const notificationCollectionRef = collection(db, 'notifications');
    let newCommentRefId: string | null = null; // To store the new comment ID

    try {
      await runTransaction(db, async (transaction) => {
        const postDoc = await transaction.get(postRef);
        if (!postDoc.exists()) {
            throw new Error("Post not found");
        }
        // Note: We can't add a document to a subcollection *inside* a transaction easily.
        // A common pattern is to update a counter in the transaction and add the comment doc outside.
        // Or, generate the comment ID beforehand.
        
        // Let's update the count in the transaction
        console.log('[Transaction] Profile: Incrementing comment count...');
        const currentComments = postDoc.data().comments || 0;
        transaction.update(postRef, { comments: currentComments + 1 });
      });

      // Add the comment document outside the transaction
      console.log('Profile: Adding comment document...');
      const commentData = {
          content: comment.trim(),
          userId: userId,
          username: currentUser.displayName || 'Anonymous',
          userPhotoURL: currentUser.photoURL || '',
          timestamp: serverTimestamp()
      };
      const newCommentRef = await addDoc(commentsCollectionRef, commentData);
      newCommentRefId = newCommentRef.id; // Store the ID
      console.log('Profile: Comment document added.');

      // Fetch post data again to create notification
      const postDocAfter = await getDoc(postRef);
      if (postDocAfter.exists()) {
          const postData = postDocAfter.data();
          if (postData.authorId !== userId) { // Check not own post
              console.log('Profile: Creating comment notification...');
              const notificationPayload = {
                  type: 'comment',
                  senderId: userId,
                  senderName: currentUser.displayName || 'Anonymous',
                  senderAvatar: currentUser.photoURL || '',
                  recipientId: postData.authorId,
                  postId: postId,
                  commentId: newCommentRefId, // Use the generated comment ID
                  content: `${currentUser.displayName || 'Someone'} commented on your post: "${comment.trim()}"`,
                  createdAt: serverTimestamp(),
                  isRead: false
              };
              await addDoc(notificationCollectionRef, notificationPayload);
              console.log('Profile: Comment notification created.');

              // --- Mention Notification Logic (Needs to be outside transaction too) --- 
              console.log('Profile: Checking for mentions...');
              const mentionRegex = /@(\w+)/g;
              const mentions = comment.match(mentionRegex);
              if (mentions) {
                for (const mention of mentions) {
                  const username = mention.substring(1);
                  const userQuery = query(collection(db, 'users'), where('username', '==', username), limit(1));
                  const userSnapshot = await getDocs(userQuery);
                  if (!userSnapshot.empty) {
                    const mentionedUser = userSnapshot.docs[0];
                    if (mentionedUser.id !== userId && mentionedUser.id !== postData.authorId) {
                       console.log(`Profile: Creating mention notification for ${username}...`);
                       const mentionNotificationPayload = {
                          type: 'mention',
                          senderId: userId,
                          senderName: currentUser.displayName || 'Anonymous',
                          senderAvatar: currentUser.photoURL || '',
                          recipientId: mentionedUser.id,
                          postId: postId,
                          commentId: newCommentRefId, // Use the generated comment ID
                          content: `${currentUser.displayName || 'Someone'} mentioned you in a comment: "${comment.trim()}"`,
                          createdAt: serverTimestamp(),
                          isRead: false
                       };
                       await addDoc(notificationCollectionRef, mentionNotificationPayload);
                       console.log(`Profile: Mention notification created for ${username}.`);
                    }
                  }
                }
              } // --- End Mention Logic ---
          }
      }

    } catch (error) {
      console.error('Profile: Error adding comment:', error);
      toast.error('Failed to add comment');
      // Consider decrementing comment count if comment add failed after transaction
    }
  };

  const handleVideoClick = (video: Video) => {
    setSelectedVideo(video);
    setShowComments(true);
  };

  const CommentsDrawer = () => (
    <Drawer
      anchor="bottom"
      open={showComments}
      onClose={() => setShowComments(false)}
      PaperProps={{
        sx: {
          height: '80vh',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          overflow: 'hidden',
          '@media (max-width: 600px)': {
            height: '90vh'
          }
        }
      }}
    >
      <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Comments</Typography>
          <IconButton onClick={() => setShowComments(false)}>
            <CloseIcon />
          </IconButton>
        </Box>
        {selectedVideo && (
          <>
            <Box sx={{ mb: 2 }}>
              <video
                src={selectedVideo.url}
                style={{
                  width: '100%',
                  maxHeight: '200px',
                  objectFit: 'contain',
                  backgroundColor: 'black'
                }}
                controls
                playsInline
                muted
              />
            </Box>
            <List sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
              {selectedVideo.commentsList?.map((comment) => (
                <ListItem key={comment.id} divider>
                  <ListItemAvatar>
                    <Avatar>{comment.username[0]}</Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={comment.username}
                    secondary={
                      <>
                        <Typography variant="body2">{comment.content}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatTimestamp(comment.timestamp)}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
            <Box sx={{ mt: 'auto' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <Button
                      size="small"
                      onClick={() => selectedVideo && handleAddComment(selectedVideo.id, newComment)}
                      disabled={!newComment.trim() || isCommenting}
                    >
                      Post
                    </Button>
                  )
                }}
              />
            </Box>
          </>
        )}
      </Box>
    </Drawer>
  );

  // Update the video card click handler
  const renderVideoCard = (video: Video) => (
    <Card key={video.id} sx={{ position: 'relative' }}>
      <CardMedia
        component="video"
        image={video.thumbnailUrl || video.url}
        sx={{
          height: { xs: 'auto', sm: 200 },
          width: '100%',
          aspectRatio: '16/9',
          objectFit: 'cover',
          backgroundColor: 'black',
          '@media (max-width: 600px)': {
            height: 'auto',
            maxHeight: '60vh',
            objectFit: 'contain'
          }
        }}
        controls
        preload="metadata"
        playsInline
        muted
        loop
        poster={video.thumbnailUrl}
      />
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FavoriteIcon fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary">
            {video.likes}
          </Typography>
          <IconButton 
            size="small" 
            onClick={(e) => {
              e.stopPropagation();
              handleVideoClick(video);
            }}
          >
            <CommentIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
              {video.comments}
            </Typography>
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );

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
                    {formatTimestamp(message.timestamp)}
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
              {formatTimestamp(post.timestamp)}
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

  // Add functions to handle follow request responses
  const handleAcceptFollow = async (requesterId: string) => {
    if (!currentUser || !db) return;
    
    try {
      setIsProcessing(true);
      
      // Add as follower
      const followerRef = doc(db, `users/${currentUser.uid}/followers/${requesterId}`);
      const followingRef = doc(db, `users/${requesterId}/following/${currentUser.uid}`);
      
      // Remove from requests
      const requestRef = doc(db, `users/${currentUser.uid}/followRequests/${requesterId}`);
      
      await Promise.all([
        setDoc(followerRef, {
          timestamp: serverTimestamp()
        }),
        setDoc(followingRef, {
          timestamp: serverTimestamp()
        }),
        deleteDoc(requestRef)
      ]);

      // Create notification for the requester
      const notificationRef = doc(collection(db, 'users', requesterId, 'notifications'));
      await setDoc(notificationRef, {
        type: 'follow_accepted',
        userId: currentUser.uid,
        username: currentUser.displayName || 'Anonymous',
        timestamp: serverTimestamp(),
        read: false
      });

      toast.success('Follow request accepted');
    } catch (error) {
      console.error('Error accepting follow request:', error);
      toast.error('Failed to accept follow request');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectFollow = async (requesterId: string) => {
    if (!currentUser || !db) return;
    
    try {
      setIsProcessing(true);
      
      // Remove from requests
      const requestRef = doc(db, `users/${currentUser.uid}/followRequests/${requesterId}`);
      await deleteDoc(requestRef);

      // Create notification for the requester
      const notificationRef = doc(collection(db, 'users', requesterId, 'notifications'));
      await setDoc(notificationRef, {
        type: 'follow_rejected',
        userId: currentUser.uid,
        username: currentUser.displayName || 'Anonymous',
        timestamp: serverTimestamp(),
        read: false
      });

      toast.success('Follow request rejected');
    } catch (error) {
      console.error('Error rejecting follow request:', error);
      toast.error('Failed to reject follow request');
    } finally {
      setIsProcessing(false);
    }
  };

  // Add follow requests dialog
  const renderFollowRequestsDialog = () => (
    <Dialog
      open={showFollowRequestsDialog}
      onClose={() => setShowFollowRequestsDialog(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Follow Requests</DialogTitle>
      <DialogContent>
        <List>
          {pendingFollowRequests.length === 0 ? (
            <ListItem>
              <ListItemText primary="No pending follow requests" />
            </ListItem>
          ) : (
            pendingFollowRequests.map((request) => (
              <ListItem key={request.id}>
                <ListItemAvatar>
                  <Avatar src={request.profilePic} alt={request.name}>
                    {request.name[0]}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={request.name}
                  secondary={`@${request.username}`}
                />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => handleAcceptFollow(request.id)}
                    disabled={isProcessing}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => handleRejectFollow(request.id)}
                    disabled={isProcessing}
                  >
                    Reject
                  </Button>
                </Box>
              </ListItem>
            ))
          )}
        </List>
      </DialogContent>
    </Dialog>
  );

  // Add button to view follow requests for account owner
  const renderFollowRequestsButton = () => {
    if (currentUser?.uid !== targetUserId || pendingRequests.length === 0) return null;

    return (
      <Button
        variant="outlined"
        color="primary"
        onClick={() => setShowFollowRequests(true)}
        sx={{ ml: 2 }}
      >
        View Requests ({pendingRequests.length})
      </Button>
    );
  };

  // Update the useEffect that fetches user data to include siderooms
  useEffect(() => {
    if (!db || !targetUserId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Set up real-time listener for user's joined rooms
      const userSideRoomsRef = collection(db, 'users', targetUserId, 'sideRooms');
      const joinedRoomsQuery = query(userSideRoomsRef, orderBy('lastActive', 'desc'));
      
      // Set up real-time listener for rooms created by the user
      const sideRoomsRef = collection(db, 'sideRooms');
      const createdRoomsQuery = query(sideRoomsRef, where('ownerId', '==', targetUserId));

      const unsubscribeJoined = onSnapshot(joinedRoomsQuery, (snapshot) => {
        const rooms = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          joinedAt: doc.data().joinedAt?.toDate(),
          lastActive: doc.data().lastActive?.toDate()
        })) as UserSideRoom[];
        setJoinedRooms(rooms);
      }, (error) => {
        console.error('Error fetching joined rooms:', error);
      });

      const unsubscribeCreated = onSnapshot(createdRoomsQuery, (snapshot) => {
        const rooms = snapshot.docs.map(doc => ({
          id: doc.id,
          roomId: doc.id,
          name: doc.data().name,
          description: doc.data().description,
          memberCount: doc.data().memberCount,
          isPrivate: doc.data().isPrivate,
          category: doc.data().category,
          role: 'owner',
          joinedAt: doc.data().createdAt?.toDate(),
          lastActive: doc.data().lastActive?.toDate(),
          isOwner: true,
          thumbnailUrl: doc.data().style?.thumbnailUrl || null
        })) as UserSideRoom[];
        setCreatedRooms(rooms);
      }, (error) => {
        console.error('Error fetching created rooms:', error);
      });

      return () => {
        unsubscribeJoined();
        unsubscribeCreated();
      };
    } catch (error) {
      console.error('Error setting up rooms listeners:', error);
      setError('Failed to set up rooms listeners');
    } finally {
      setIsLoading(false);
    }
  }, [db, targetUserId]);

  // Add function to handle follow request response
  const handleFollowRequest = async (requesterId: string, accept: boolean) => {
    if (!db || !currentUser) return;

    try {
      const batch = writeBatch(db);
      const requestRef = doc(db, 'users', currentUser.uid, 'followRequests', requesterId);

      if (accept) {
        // Add to followers and following collections
        const followerRef = doc(db, 'users', currentUser.uid, 'followers', requesterId);
        const followingRef = doc(db, 'users', requesterId, 'following', currentUser.uid);

        batch.set(followerRef, {
          userId: requesterId,
          followedAt: serverTimestamp()
        });

        batch.set(followingRef, {
          userId: currentUser.uid,
          followedAt: serverTimestamp()
        });

        // Create notification for accepted request
        const notificationRef = doc(collection(db, 'users', requesterId, 'notifications'));
        batch.set(notificationRef, {
          type: 'follow_accepted',
          userId: currentUser.uid,
          username: currentUser.displayName || 'Anonymous',
          timestamp: serverTimestamp(),
          read: false
        });
      }

      // Delete the request
      batch.delete(requestRef);
      await batch.commit();

      toast.success(accept ? 'Follow request accepted' : 'Follow request rejected');
    } catch (error) {
      console.error('Error handling follow request:', error);
      toast.error('Failed to process follow request');
    }
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

  return (
    <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Profile Header - Always visible */}
        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, backgroundColor: 'background.paper' }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: 'center' }}>
            <Box sx={{ position: 'relative' }}>
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={
                  currentUser?.uid === targetUserId && (
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
                  {name || 'No name set'}
                </Typography>
                {isPrivate && (
                  <LockIcon color="action" />
                )}
                {currentUser?.uid === userId && (
                  <IconButton onClick={() => setIsEditing(true)} size="small">
                    <EditIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                @{username || 'No username set'}
              </Typography>
              {isPrivate && !canViewFullProfile && currentUser?.uid !== userId ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    This account is private. Follow to see their posts and other content.
                  </Alert>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    {renderFollowButton()}
                  </Box>
                </Box>
              ) : (
                <>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {bio || 'No bio set'}
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
                </>
              )}
            </Box>
          </Box>
          {currentUser?.uid === userId && pendingFollowRequests.length > 0 && (
            <Button
              startIcon={<PersonAddIcon />}
              onClick={() => setShowFollowRequestsDialog(true)}
              color="primary"
              variant="outlined"
              sx={{ ml: 2 }}
            >
              Follow Requests ({pendingFollowRequests.length})
            </Button>
          )}
        </Paper>

        {/* Stats and Tabs - Only visible if canViewFullProfile is true */}
        {(!isPrivate || canViewFullProfile || currentUser?.uid === userId) ? (
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
                    fetchUserData();
                    setConnectionDialogTab(0);
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
                    fetchUserData();
                    setConnectionDialogTab(1);
                    setShowConnectionsDialog(true);
                  }}
                >
                  <Typography variant="h6">{following.length || 0}</Typography>
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
                  <Tab label="Vibits" />
                  <Tab label="Side Rooms" />
                  <Tab label="Liked Posts" />
                  {currentUser?.uid === userId && <Tab label="Deleted Items" />}
                </Tabs>
              </Paper>
            </Box>
          </Box>
        ) : (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 2, backgroundColor: 'background.paper' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-around', gap: 2 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6">{posts.length || 0}</Typography>
                <Typography variant="body2" color="text.secondary">Posts</Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6">{followers.length || 0}</Typography>
                <Typography variant="body2" color="text.secondary">Followers</Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6">{following.length || 0}</Typography>
                <Typography variant="body2" color="text.secondary">Following</Typography>
              </Box>
            </Box>
          </Paper>
        )}

        {/* Tab Content */}
        <Box sx={{ flex: 1 }}>
          <TabPanel value={activeTab} index={0}>
            {!canViewFullProfile ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <LockIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  This account's posts are private
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Follow this account to see their posts
                </Typography>
              </Box>
            ) : posts.length === 0 ? (
              <Typography>No posts yet</Typography>
            ) : (
              <List>
                {posts.map(renderPost)}
              </List>
            )}
          </TabPanel>
          <TabPanel value={activeTab} index={1}>
            {!canViewFullProfile ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <LockIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  This account's videos are private
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Follow this account to see their videos
                </Typography>
              </Box>
            ) : videos.length === 0 ? (
              <Typography>No videos uploaded yet</Typography>
            ) : (
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: { 
                  xs: '1fr', 
                  sm: '1fr 1fr', 
                  md: '1fr 1fr 1fr' 
                }, 
                gap: 2 
              }}>
                {videos.map(renderVideoCard)}
              </Box>
            )}
          </TabPanel>
          <TabPanel value={activeTab} index={2}>
            {!canViewFullProfile ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <LockIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  This account's side rooms are private
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Follow this account to see their side rooms
                </Typography>
              </Box>
            ) : createdRooms.length === 0 && joinedRooms.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  Not a member of any side rooms yet
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  component={RouterLink}
                  to="/side-rooms"
                  sx={{ mt: 2 }}
                >
                  Browse Side Rooms
                </Button>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {createdRooms.length > 0 && (
                  <Box>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Created Rooms
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                      {createdRooms.map((room) => (
                        <Card 
                          key={room.id}
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            height: '100%',
                            '&:hover': {
                              boxShadow: 6,
                              transform: 'translateY(-2px)',
                              transition: 'all 0.2s ease-in-out'
                            }
                          }}
                        >
                          {room.thumbnailUrl && (
                            <CardMedia
                              component="img"
                              height="140"
                              image={room.thumbnailUrl}
                              alt={room.name}
                              sx={{ objectFit: 'cover' }}
                            />
                          )}
                          <CardContent sx={{ flexGrow: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                              <Typography variant="h6" component="div">
                                {room.name}
                              </Typography>
                              <Chip size="small" label="Owner" color="primary" />
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              {room.description}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              <Chip
                                size="small"
                                label={`${room.memberCount || 0} members`}
                                icon={<Group />}
                              />
                              {room.category && (
                                <Chip
                                  size="small"
                                  label={room.category}
                                  variant="outlined"
                                />
                              )}
                              {room.isPrivate && (
                                <Chip
                                  size="small"
                                  icon={<Lock />}
                                  label="Private"
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          </CardContent>
                          <CardActions>
                            <Button
                              size="small"
                              component={RouterLink}
                              to={`/side-room/${room.id}`}
                              variant="contained"
                              fullWidth
                            >
                              Enter Room
                            </Button>
                          </CardActions>
                        </Card>
                      ))}
                    </Box>
                  </Box>
                )}

                {joinedRooms.length > 0 && (
                  <Box>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Joined Rooms
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                      {joinedRooms.map((room) => (
                        <Card 
                          key={room.id}
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            height: '100%',
                            '&:hover': {
                              boxShadow: 6,
                              transform: 'translateY(-2px)',
                              transition: 'all 0.2s ease-in-out'
                            }
                          }}
                        >
                          {room.thumbnailUrl && (
                            <CardMedia
                              component="img"
                              height="140"
                              image={room.thumbnailUrl}
                              alt={room.name}
                              sx={{ objectFit: 'cover' }}
                            />
                          )}
                          <CardContent sx={{ flexGrow: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                              <Typography variant="h6" component="div">
                                {room.name}
                              </Typography>
                              <Chip size="small" label="Member" />
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              {room.description}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              <Chip
                                size="small"
                                label={`${room.memberCount || 0} members`}
                                icon={<Group />}
                              />
                              {room.category && (
                                <Chip
                                  size="small"
                                  label={room.category}
                                  variant="outlined"
                                />
                              )}
                              {room.isPrivate && (
                                <Chip
                                  size="small"
                                  icon={<Lock />}
                                  label="Private"
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          </CardContent>
                          <CardActions>
                            <Button
                              size="small"
                              component={Link}
                              to={`/side-room/${room.id}`}
                              variant="contained"
                              fullWidth
                            >
                              Enter Room
                            </Button>
                          </CardActions>
                        </Card>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            )}
          </TabPanel>
          <TabPanel value={activeTab} index={3}>
            {!canViewFullProfile ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <LockIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  This account's liked posts are private
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Follow this account to see their liked posts
                </Typography>
              </Box>
            ) : likedPosts.length === 0 ? (
              <Typography>No liked posts yet</Typography>
            ) : (
              <List>
                {likedPosts.map((post) => (
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
                            {formatTimestamp(post.timestamp)}
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
                        secondary={`Deleted ${formatTimestamp(item.deletedAt)} ago`}
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
                {formatTimestamp(selectedPost?.timestamp)}
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

      <CommentsDrawer />

      {renderFollowRequestsButton()}
      {renderFollowRequestsDialog()}
    </Container>
  );
};

export default Profile; 