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
  serverTimestamp
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
        toast.success('Followed user');
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast.error('Failed to update follow status');
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
                    <Card sx={{ 
                      height: 240, 
                      cursor: 'pointer',
                      '&:hover': {
                        transform: 'scale(1.02)',
                        transition: 'transform 0.2s ease-in-out'
                      }
                    }} onClick={() => navigate('/vibits')}>
                      <Box sx={{ position: 'relative', height: '100%' }}>
                        <video
                          src={video.url}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
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