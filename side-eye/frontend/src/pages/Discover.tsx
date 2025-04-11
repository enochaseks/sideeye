import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Container,
  Alert,
  Tabs,
  Tab,
  Paper,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  Divider,
  CircularProgress,
  Chip,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Button
} from '@mui/material';
import { 
  TrendingUp as TrendingIcon,
  Group as GroupIcon,
  Whatshot as WhatshotIcon,
  Search as SearchIcon,
  PersonAdd as PersonAddIcon,
  Message as MessageIcon,
  People as PeopleIcon,
  Favorite as FavoriteIcon,
  Comment as CommentIcon
} from '@mui/icons-material';
import { useNavigate, Link } from 'react-router-dom';
import { 
  collection, 
  query as firestoreQuery, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  DocumentData, 
  Timestamp,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  addDoc,
  updateDoc,
  arrayRemove,
  arrayUnion,
  getDoc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import VibitIcon from '../components/VibitIcon';

interface UserProfile {
  id: string;
  username: string;
  name: string;
  profilePic: string;
  bio: string;
  coverPhoto?: string;
  isPublic: boolean;
  isAuthenticated?: boolean;
  createdAt: Timestamp;
}

interface Room {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  shareCount: number;
  isPrivate: boolean;
  createdAt: Date;
}

interface FirestoreUser extends DocumentData {
  displayName?: string;
  photoURL?: string;
  username?: string;
  bio?: string;
  followers?: number;
  following?: number;
  displayNameSearch?: string;
  usernameSearch?: string;
}

interface FirestoreRoom extends DocumentData {
  name?: string;
  description?: string;
  memberCount?: number;
  shareCount?: number;
  isPrivate?: boolean;
  createdAt?: Timestamp;
  nameSearch?: string;
}

interface Video {
  id: string;
  url: string;
  userId: string;
  username: string;
  likes: number;
  comments: number;
  timestamp: any;
  thumbnailUrl?: string;
}

const Discover: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const fetchDefaultUsers = async () => {
    try {
      const usersRef = collection(db, 'users');
      
      // Simply fetch all users with limit
      const q = firestoreQuery(
        usersRef,
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      
      const querySnapshot = await getDocs(q);
      const usersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserProfile[];
      
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async () => {
    try {
      const roomsRef = collection(db, 'rooms');
      const q = firestoreQuery(
        roomsRef,
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      
      const querySnapshot = await getDocs(q);
      const roomsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Room[];
      
      setRooms(roomsData);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  useEffect(() => {
    fetchDefaultUsers();
    fetchRooms();
    fetchVideos();
    if (currentUser) {
      fetchFollowing();
    }
  }, [currentUser]);

  const fetchVideos = async () => {
    try {
      const videosRef = collection(db, 'videos');
      const q = firestoreQuery(
        videosRef,
        orderBy('timestamp', 'desc'),
        limit(20)
      );
      
      const querySnapshot = await getDocs(q);
      const videosData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Video[];
      
      setVideos(videosData);
    } catch (error) {
      console.error('Error fetching videos:', error);
    }
  };

  const fetchFollowing = async () => {
    if (!currentUser) return;
    try {
      const followingQuery = firestoreQuery(
        collection(db, `users/${currentUser.uid}/following`)
      );
      const snapshot = await getDocs(followingQuery);
      const followingIds = new Set(snapshot.docs.map(doc => doc.id));
      setFollowing(followingIds);
    } catch (error) {
      console.error('Error fetching following:', error);
    }
  };

  const handleFollow = async (userId: string) => {
    if (!currentUser || userId === currentUser.uid) return;
    
    try {
      const followingRef = doc(db, `users/${currentUser.uid}/following`, userId);
      const followerRef = doc(db, `users/${userId}/followers`, currentUser.uid);
      
      if (following.has(userId)) {
        // Unfollow
        await deleteDoc(followingRef);
        await deleteDoc(followerRef);
        setFollowing(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
        toast.success('Unfollowed user');
      } else {
        // Follow
        await setDoc(followingRef, {
          timestamp: serverTimestamp()
        });
        await setDoc(followerRef, {
          timestamp: serverTimestamp()
        });
        setFollowing(prev => new Set(prev).add(userId));

        // Create notification for followed user
        const notificationData = {
          type: 'follow',
          senderId: currentUser.uid,
          senderName: currentUser.displayName || 'Anonymous',
          senderAvatar: currentUser.photoURL || '',
          recipientId: userId,
          content: `${currentUser.displayName || 'Someone'} started following you`,
          createdAt: serverTimestamp(),
          isRead: false
        };
        await addDoc(collection(db, 'users', userId, 'notifications'), notificationData);

        toast.success('Followed user');
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast.error('Failed to update follow status');
    }
  };

  const handleVibitLike = async (videoId: string, authorId: string) => {
    if (!currentUser || !db) return;
    
    try {
      const videoRef = doc(db, 'videos', videoId);
      const videoDoc = await getDoc(videoRef);
      
      if (!videoDoc.exists()) {
        throw new Error('Video not found');
      }
      
      const videoData = videoDoc.data();
      const isLiked = videoData.likedBy?.includes(currentUser.uid);
      
      if (isLiked) {
        // Unlike
        await updateDoc(videoRef, {
          likedBy: arrayRemove(currentUser.uid)
        });
      } else {
        // Like
        await updateDoc(videoRef, {
          likedBy: arrayUnion(currentUser.uid)
        });

        // Create notification for video owner
        if (authorId !== currentUser.uid) {
          const notificationData = {
            type: 'vibit_like',
            senderId: currentUser.uid,
            senderName: currentUser.displayName || 'Anonymous',
            senderAvatar: currentUser.photoURL || '',
            recipientId: authorId,
            videoId: videoId,
            content: `${currentUser.displayName || 'Someone'} liked your vibit`,
            createdAt: serverTimestamp(),
            isRead: false
          };
          await addDoc(collection(db, 'users', authorId, 'notifications'), notificationData);
        }
      }
    } catch (error) {
      console.error('Error toggling vibit like:', error);
      toast.error('Failed to update like status');
    }
  };

  const handleVibitComment = async (videoId: string, content: string, authorId: string) => {
    if (!currentUser || !db) return;

    try {
      const videoRef = doc(db, 'videos', videoId);
      const videoDoc = await getDoc(videoRef);
      const videoData = videoDoc.data();

      const commentData = {
        content,
        authorId: currentUser.uid,
        authorName: currentUser.displayName || 'Anonymous',
        authorAvatar: currentUser.photoURL || '',
        timestamp: serverTimestamp() as Timestamp,
        likes: 0
      };

      await updateDoc(videoRef, {
        comments: arrayUnion(commentData)
      });

      // Create notification for video owner
      if (authorId !== currentUser.uid) {
        const notificationData = {
          type: 'vibit_comment',
          senderId: currentUser.uid,
          senderName: currentUser.displayName || 'Anonymous',
          senderAvatar: currentUser.photoURL || '',
          recipientId: authorId,
          videoId: videoId,
          content: `${currentUser.displayName || 'Someone'} commented on your vibit: "${content}"`,
          createdAt: serverTimestamp(),
          isRead: false
        };
        await addDoc(collection(db, 'users', authorId, 'notifications'), notificationData);
      }

      // Check for mentions in comment
      const mentions = content.match(/@(\w+)/g);
      if (mentions) {
        const uniqueMentions = Array.from(new Set(mentions));
        for (const mention of uniqueMentions) {
          const username = mention.slice(1);
          const userQuery = firestoreQuery(collection(db, 'users'), where('username', '==', username), limit(1));
          const userDocs = await getDocs(userQuery);
          
          if (!userDocs.empty) {
            const mentionedUser = userDocs.docs[0];
            if (mentionedUser.id !== currentUser.uid && mentionedUser.id !== authorId) {
              const notificationData = {
                type: 'vibit_mention',
                senderId: currentUser.uid,
                senderName: currentUser.displayName || 'Anonymous',
                senderAvatar: currentUser.photoURL || '',
                recipientId: mentionedUser.id,
                videoId: videoId,
                content: `${currentUser.displayName || 'Someone'} mentioned you in a vibit comment: "${content}"`,
                createdAt: serverTimestamp(),
                isRead: false
              };
              await addDoc(collection(db, 'users', mentionedUser.id, 'notifications'), notificationData);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error adding vibit comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleUserClick = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  const handleRoomClick = (roomId: string) => {
    navigate(`/room/${roomId}`);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (!currentUser || !db) {
      setUsers([]);
      setRooms([]);
      return;
    }

    if (query.length < 2) {
      // If query is too short, fetch default users and rooms
      fetchDefaultUsers();
      fetchRooms();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Search for users in Firestore
      const usersRef = collection(db, 'users');
      const usernameQuery = query.toLowerCase();
      
      // Basic username search
      const q = firestoreQuery(
        usersRef,
        orderBy('username'),
        limit(20)
      );
      
      const querySnapshot = await getDocs(q);
      const allUsers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserProfile[];
      
      // Filter client-side
      const filteredUsers = allUsers.filter(user => 
        user.username?.toLowerCase().includes(usernameQuery) || 
        user.name?.toLowerCase().includes(usernameQuery)
      );
      
      setUsers(filteredUsers);
      
      // Search for rooms
      const roomsRef = collection(db, 'rooms');
      const roomsQuery = firestoreQuery(
        roomsRef,
        orderBy('name'),
        limit(20)
      );
      
      const roomsSnapshot = await getDocs(roomsQuery);
      const allRooms = roomsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Room[];
      
      // Filter client-side
      const filteredRooms = allRooms.filter(room => 
        room.name?.toLowerCase().includes(usernameQuery) || 
        room.description?.toLowerCase().includes(usernameQuery)
      );
      
      setRooms(filteredRooms);

    } catch (error: any) {
      console.error('Search error:', error);
      setError(`Failed to perform search: ${error.message}`);
      toast.error(`Search failed: ${error.code || error.message}`);
      // Fallback to default users and rooms on error
      fetchDefaultUsers();
      fetchRooms();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <TrendingIcon fontSize="large" color="primary" />
        <Typography variant="h4" component="h1">
          Discover
        </Typography>
      </Box>

      <Paper sx={{ p: 2, mb: 4 }}>
        <TextField
          fullWidth
          placeholder="Search users and rooms..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: loading && (
              <InputAdornment position="end">
                <CircularProgress size={20} />
              </InputAdornment>
            )
          }}
        />
      </Paper>

      <Box sx={{ width: '100%', mb: 4 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab icon={<PeopleIcon />} label="People" />
          <Tab icon={<GroupIcon />} label="Rooms" />
          <Tab icon={<VibitIcon />} label="Vibits" />
        </Tabs>
      </Box>
      
      {activeTab === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Users Section */}
          <Paper>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6" component="h2">
                Users
              </Typography>
            </Box>
            <List>
              {users.length === 0 ? (
                <ListItem>
                  <ListItemText 
                    primary="No users found" 
                    secondary="Try a different search term"
                  />
                </ListItem>
              ) : (
                users.map((user, index) => (
                  <React.Fragment key={user.id}>
                    <ListItem
                      secondaryAction={
                        user.id !== currentUser?.uid && (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton
                              edge="end"
                              onClick={() => navigate(`/messages/${user.id}`)}
                              title="Send message"
                            >
                              <MessageIcon />
                            </IconButton>
                            <IconButton
                              edge="end"
                              onClick={() => handleFollow(user.id)}
                              title={following.has(user.id) ? "Unfollow user" : "Follow user"}
                              color={following.has(user.id) ? "primary" : "default"}
                            >
                              <PersonAddIcon />
                            </IconButton>
                          </Box>
                        )
                      }
                    >
                      <ListItemAvatar>
                        <Avatar src={user.profilePic} alt={user.name}>
                          {user.name[0]}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={user.name}
                        secondary={
                          <React.Fragment>
                            @{user.username}
                            {user.bio && (
                              <Typography
                                component="span"
                                variant="body2"
                                color="text.secondary"
                                sx={{ display: 'block' }}
                              >
                                {user.bio.length > 100 
                                  ? `${user.bio.substring(0, 100)}...` 
                                  : user.bio}
                              </Typography>
                            )}
                          </React.Fragment>
                        }
                        onClick={() => handleUserClick(user.id)}
                        sx={{ cursor: 'pointer' }}
                      />
                    </ListItem>
                    {index < users.length - 1 && <Divider />}
                  </React.Fragment>
                ))
              )}
            </List>
          </Paper>
        </Box>
      )}
      
      {activeTab === 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Rooms Section */}
          <Paper>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6" component="h2">
                Rooms
              </Typography>
            </Box>
            <List>
              {rooms.length === 0 ? (
                <ListItem>
                  <ListItemText 
                    primary="No rooms found" 
                    secondary="Try a different search term"
                  />
                </ListItem>
              ) : (
                rooms.map((room, index) => (
                  <React.Fragment key={room.id}>
                    <ListItem
                      secondaryAction={
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Chip
                            icon={<PeopleIcon />}
                            label={`${room.memberCount} members`}
                            size="small"
                          />
                          {room.isPrivate && (
                            <Chip
                              label="Private"
                              color="secondary"
                              size="small"
                            />
                          )}
                        </Box>
                      }
                    >
                      <ListItemAvatar>
                        <Avatar>
                          <GroupIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={room.name}
                        secondary={
                          <React.Fragment>
                            <Typography
                              component="span"
                              variant="body2"
                              color="text.secondary"
                              sx={{ display: 'block' }}
                            >
                              {room.description.length > 100 
                                ? `${room.description.substring(0, 100)}...` 
                                : room.description}
                            </Typography>
                            <Typography
                              component="span"
                              variant="caption"
                              color="text.secondary"
                            >
                              {room.shareCount} shares
                            </Typography>
                          </React.Fragment>
                        }
                        onClick={() => handleRoomClick(room.id)}
                        sx={{ cursor: 'pointer' }}
                      />
                    </ListItem>
                    {index < rooms.length - 1 && <Divider />}
                  </React.Fragment>
                ))
              )}
            </List>
          </Paper>
        </Box>
      )}
      
      {activeTab === 2 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Vibits Section */}
          <Paper>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <VibitIcon color="primary" /> Vibits
              </Typography>
            </Box>
            
            {videos.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary">
                  No videos found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Check back later or upload your own!
                </Typography>
                <Button 
                  variant="contained" 
                  color="primary" 
                  sx={{ mt: 2 }}
                  onClick={() => navigate('/vibits')}
                  startIcon={<VibitIcon />}
                >
                  Go to Vibits
                </Button>
              </Box>
            ) : (
              <Grid container spacing={2} sx={{ p: 2 }}>
                {videos.map((video) => (
                  <Grid item xs={12} sm={6} md={4} key={video.id}>
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
                      <Box sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        p: 1,
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                        color: 'white'
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="subtitle2">@{video.username}</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <FavoriteIcon fontSize="small" />
                              <Typography variant="caption" sx={{ ml: 0.5 }}>{video.likes}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <CommentIcon fontSize="small" />
                              <Typography variant="caption" sx={{ ml: 0.5 }}>{video.comments}</Typography>
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        </Box>
      )}
    </Container>
  );
};

export default Discover; 