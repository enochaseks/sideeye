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
  Alert
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
  Delete as DeleteIcon
} from '@mui/icons-material';
import { auth, db, storage } from '../services/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, arrayUnion, arrayRemove, addDoc, onSnapshot, orderBy, serverTimestamp, setDoc, deleteDoc, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { formatDistanceToNow } from 'date-fns';
import { User, UserProfile, SideRoom } from '../types/index';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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

const Profile: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { userId: urlUserId } = useParams<{ userId: string }>();
  const { currentUser, userProfile, loading: authLoading } = useAuth();
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
  
  // Get the user ID from URL params or current user
  const userId = urlUserId || currentUser?.uid;

  const fetchUserData = useCallback(async () => {
    if (!userId) {
      setError('No user ID provided');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // If viewing own profile, use data from auth context
      if (userId === currentUser?.uid && userProfile) {
        setUsername(userProfile.username || '');
        setName(userProfile.name || '');
        setEmail(userProfile.email || '');
        setBio(userProfile.bio || '');
        setProfilePic(userProfile.profilePic || null);
        setConnections(userProfile.connections || []);
        setFollowers(userProfile.followers || []);
      } else {
        // Fetch user profile for other users
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserProfile;
          setUsername(userData.username || '');
          setName(userData.name || '');
          setEmail(userData.email || '');
          setBio(userData.bio || '');
          setProfilePic(userData.profilePic || null);
          setConnections(userData.connections || []);
          setFollowers(userData.followers || []);
        } else {
          setError('User not found');
        }
      }

      // Set up real-time listeners for all collections
      const postsUnsubscribe = onSnapshot(
        query(collection(db, 'posts'), where('authorId', '==', userId)),
        (snapshot) => {
          setPosts(snapshot.docs.map(doc => ({
            id: doc.id,
            content: doc.data().content || '',
            authorId: doc.data().authorId || '',
            timestamp: doc.data().timestamp || new Date(),
            likes: doc.data().likes || [],
            comments: doc.data().comments || 0
          })) as Post[]);
        }
      );

      const forumsUnsubscribe = onSnapshot(
        query(collection(db, 'forums'), where('members', 'array-contains', userId)),
        (snapshot) => {
          setForums(snapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().title || '',
            description: doc.data().description || '',
            members: doc.data().members || [],
            memberCount: doc.data().memberCount || 0,
            ownerId: doc.data().ownerId || ''
          })) as Forum[]);
        }
      );

      const sideRoomsUnsubscribe = onSnapshot(
        query(collection(db, 'sideRooms'), where('members', 'array-contains', userId)),
        (snapshot) => {
          setSideRooms(snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name || '',
            description: doc.data().description || '',
            ownerId: doc.data().ownerId || '',
            members: doc.data().members || [],
            memberCount: doc.data().memberCount || 0,
            createdAt: doc.data().createdAt || new Date(),
            isPrivate: doc.data().isPrivate || false,
            isLive: doc.data().isLive || false,
            liveParticipants: doc.data().liveParticipants || [],
            category: doc.data().category || '',
            scheduledReveals: doc.data().scheduledReveals || [],
            activeUsers: doc.data().activeUsers || 0
          })) as SideRoom[]);
        }
      );

      const likedPostsUnsubscribe = onSnapshot(
        query(collection(db, 'posts'), where('likes', 'array-contains', userId)),
        (snapshot) => {
          setLikedPosts(snapshot.docs.map(doc => ({
            id: doc.id,
            content: doc.data().content || '',
            authorId: doc.data().authorId || '',
            timestamp: doc.data().timestamp || new Date(),
            likes: doc.data().likes || [],
            comments: doc.data().comments || 0
          })) as Post[]);
        }
      );

      const deletedItemsUnsubscribe = onSnapshot(
        query(collection(db, 'deleted_items'), where('userId', '==', userId)),
        (snapshot) => {
          setDeletedItems(snapshot.docs.map(doc => ({
            id: doc.id,
            type: doc.data().type || '',
            content: doc.data().content || {},
            deletedAt: doc.data().deletedAt || new Date()
          })) as DeletedItem[]);
        }
      );

      setIsSubscribed(true);

      return () => {
        postsUnsubscribe();
        forumsUnsubscribe();
        sideRoomsUnsubscribe();
        likedPostsUnsubscribe();
        deletedItemsUnsubscribe();
        setIsSubscribed(false);
      };
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError('Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  }, [userId, currentUser, userProfile]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleProfilePicChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentUser || !e.target.files || !e.target.files[0]) return;

    try {
      setIsLoading(true);
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }

      // Upload image to Firebase Storage
      const storageRef = ref(storage, `profile_pictures/${currentUser.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // Update user profile in Firestore
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        profilePic: downloadURL
      });

      // Update local state
      setProfilePic(downloadURL);
      
      // Update auth context
      if (userProfile) {
        userProfile.profilePic = downloadURL;
      }
    } catch (error) {
      console.error('Error updating profile picture:', error);
      setError('Failed to update profile picture');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;

    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        username,
        name,
        bio,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const handleFollow = async (userId: string) => {
    if (!auth.currentUser) return;

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const targetUserRef = doc(db, 'users', userId);

      await updateDoc(userRef, {
        connections: arrayUnion(userId)
      });

      await updateDoc(targetUserRef, {
        followers: arrayUnion(auth.currentUser.uid)
      });

      setConnections(prev => [...prev, userId]);
    } catch (error) {
      console.error('Error following user:', error);
    }
  };

  const handleUnfollow = async (userId: string) => {
    if (!auth.currentUser) return;

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const targetUserRef = doc(db, 'users', userId);

      await updateDoc(userRef, {
        connections: arrayRemove(userId)
      });

      await updateDoc(targetUserRef, {
        followers: arrayRemove(auth.currentUser.uid)
      });

      setConnections(prev => prev.filter(id => id !== userId));
    } catch (error) {
      console.error('Error unfollowing user:', error);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleSendMessage = async () => {
    if (!auth.currentUser || !newMessage.trim() || !userId) return;

    try {
      // Get the sender's profile from Firestore
      const senderProfileDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const senderProfile = senderProfileDoc.data() as UserProfile;

      const messageData = {
        senderId: auth.currentUser.uid,
        receiverId: userId,
        content: newMessage.trim(),
        timestamp: serverTimestamp(),
        read: false,
        senderName: auth.currentUser.displayName || 'Anonymous',
        senderAvatar: senderProfile?.profilePic || '',
      };

      await addDoc(collection(db, 'messages'), messageData);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleRestoreItem = async (itemId: string, type: 'post' | 'room' | 'forum') => {
    try {
      const deletedItemRef = doc(db, 'deleted_items', itemId);
      const deletedItemDoc = await getDoc(deletedItemRef);
      
      if (!deletedItemDoc.exists()) {
        setError('Item not found in trash');
        return;
      }
  
      const deletedItem = deletedItemDoc.data();
      const targetCollection = type === 'post' ? 'posts' : type === 'room' ? 'sideRooms' : 'forums';
      
      // Restore to main collection
      await setDoc(doc(db, targetCollection, itemId), {
        ...deletedItem.content,
        deletedAt: null,
        scheduledForPermanentDeletion: null
      });
  
      // Remove from deleted collection
      await deleteDoc(deletedItemRef);
  
      // Update local state
      setDeletedItems(prev => prev.filter(item => item.id !== itemId));
      
      setError('Item restored successfully');
    } catch (error) {
      console.error('Error restoring item:', error);
      setError('Failed to restore item');
    }
  };

  const handlePermanentDelete = async (itemId: string) => {
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
    if (!auth.currentUser || !userId) return;

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
    if (!auth.currentUser) return;

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
    <Container maxWidth="lg">
      <Box sx={{ mt: 4 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 4 }}>
          {/* Profile Header */}
          <Box>
            <Paper elevation={0} sx={{ p: 3, textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Box sx={{ position: 'relative' }}>
                  <Badge
                    overlap="circular"
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    badgeContent={
                      currentUser?.uid === userId && (
                        <IconButton
                          size="small"
                          onClick={() => fileInputRef.current?.click()}
                          sx={{
                            bgcolor: 'background.paper',
                            '&:hover': { bgcolor: 'background.paper' }
                          }}
                        >
                          <PhotoCamera fontSize="small" />
                        </IconButton>
                      )
                    }
                  >
                    <Avatar
                      src={profilePic || undefined}
                      sx={{ width: 100, height: 100 }}
                    />
                  </Badge>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleProfilePicChange}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h4" component="h1">
                    {name}
                  </Typography>
                  <Typography variant="subtitle1" color="text.secondary">
                    @{username}
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 1 }}>
                    {bio}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                    <Button
                      variant="outlined"
                      onClick={() => setShowConnectionsDialog(true)}
                    >
                      {followers.length} Followers
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => setShowConnectionsDialog(true)}
                    >
                      {connections.length} Following
                    </Button>
                    {auth.currentUser?.uid !== userId && userId && (
                      <>
                        {connections.includes(userId) ? (
                          <Button
                            variant="outlined"
                            color="error"
                            startIcon={<PersonRemoveIcon />}
                            onClick={() => handleUnfollow(userId)}
                          >
                            Unfollow
                          </Button>
                        ) : (
                          <Button
                            variant="contained"
                            startIcon={<PersonAddIcon />}
                            onClick={() => handleFollow(userId)}
                          >
                            Follow
                          </Button>
                        )}
                      </>
                    )}
                  </Box>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<MessageIcon />}
                  onClick={() => setShowMessagesDialog(true)}
                >
                  {auth.currentUser?.uid === userId ? (
                    <Badge badgeContent={unreadCount} color="error">
                      Messages
                    </Badge>
                  ) : (
                    'Message'
                  )}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => setIsEditing(true)}
                >
                  Edit Profile
                </Button>
                {auth.currentUser?.uid === userId && (
                  <IconButton 
                    component={Link} 
                    to="/trash"
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                )}
              </Box>
            </Paper>
          </Box>

          {/* Main Content */}
          <Box>
            <Paper elevation={0}>
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                variant={isMobile ? "fullWidth" : "standard"}
                sx={{ borderBottom: 1, borderColor: 'divider' }}
              >
                <Tab label="Posts" />
                <Tab label="Forums" />
                <Tab label="Side Rooms" />
                <Tab label="Liked Posts" />
                {auth.currentUser?.uid === userId && <Tab label="Deleted Items" />}
              </Tabs>

              {/* Posts Tab */}
              <TabPanel value={activeTab} index={0}>
                {posts.length === 0 ? (
                  <Typography>No posts yet</Typography>
                ) : (
                  <List>
                    {posts.map((post) => (
                      <ListItem key={post.id} divider>
                        <ListItemText
                          primary={post.content}
                          secondary={`Posted ${formatDistanceToNow(post.timestamp.toDate())} ago`}
                        />
                        <ListItemSecondaryAction>
                          <IconButton edge="end" aria-label="likes">
                            <FavoriteIcon />
                            <Typography variant="body2" sx={{ ml: 1 }}>
                              {post.likes.length}
                            </Typography>
                          </IconButton>
                          <IconButton edge="end" aria-label="comments">
                            <CommentIcon />
                            <Typography variant="body2" sx={{ ml: 1 }}>
                              {post.comments}
                            </Typography>
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                )}
              </TabPanel>

              {/* Forums Tab */}
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

              {/* Side Rooms Tab */}
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

              {/* Liked Posts Tab */}
              <TabPanel value={activeTab} index={3}>
                {likedPosts.length === 0 ? (
                  <Typography>No liked posts yet</Typography>
                ) : (
                  <List>
                    {likedPosts.map((post) => (
                      <ListItem key={post.id} divider>
                        <ListItemText
                          primary={post.content}
                          secondary={`Posted ${formatDistanceToNow(post.timestamp.toDate())} ago`}
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

              {/* Deleted Items Tab */}
              {auth.currentUser?.uid === userId && (
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
            </Paper>
          </Box>
        </Box>
      </Box>

      {/* Edit Profile Dialog */}
      {isEditing && (
        <Dialog open={isEditing} onClose={() => setIsEditing(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogContent>
              <TextField
                fullWidth
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                margin="normal"
              />
            <TextField
              fullWidth
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              margin="normal"
              multiline
              rows={4}
              />
              <TextField
                fullWidth
                label="Email"
                value={email}
                disabled
                margin="normal"
              />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button variant="contained" onClick={handleSave}>
                  Save
                </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Connections Dialog */}
      <Dialog open={showConnectionsDialog} onClose={() => setShowConnectionsDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Connections</DialogTitle>
        <DialogContent>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab label="Following" />
            <Tab label="Followers" />
          </Tabs>
          <Box sx={{ mt: 2 }}>
            {activeTab === 0 && (
              <List>
                {connections.map((userId) => (
                  <ListItem key={userId}>
                    <ListItemAvatar>
                      <Avatar />
                    </ListItemAvatar>
                    <ListItemText primary={userId} />
                    <ListItemSecondaryAction>
                      <IconButton onClick={() => handleUnfollow(userId)}>
                        <PersonRemoveIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
            {activeTab === 1 && (
              <List>
                {followers.map((userId) => (
                  <ListItem key={userId}>
                    <ListItemAvatar>
                      <Avatar />
                    </ListItemAvatar>
                    <ListItemText primary={userId} />
                    {!connections.includes(userId) && (
                      <ListItemSecondaryAction>
                        <IconButton onClick={() => handleFollow(userId)}>
                          <PersonAddIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    )}
                  </ListItem>
                ))}
              </List>
            )}
              </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConnectionsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Messages Dialog */}
      <Dialog
        open={showMessagesDialog}
        onClose={() => setShowMessagesDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {auth.currentUser?.uid === userId ? 'Your Messages' : `Message ${username}`}
        </DialogTitle>
        <DialogContent>
          {auth.currentUser?.uid === userId ? (
            <List>
              {messages.map((message) => (
                <ListItem key={message.id}>
                  <ListItemAvatar>
                    <Avatar src={message.senderAvatar} />
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
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMessagesDialog(false)}>Close</Button>
          {auth.currentUser?.uid !== userId && (
              <Button
                variant="contained"
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              >
              Send
              </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Profile; 