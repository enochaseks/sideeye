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
  CardMedia
} from '@mui/material';
import { 
  TrendingUp as TrendingIcon,
  Group as GroupIcon,
  Whatshot as WhatshotIcon,
  Search as SearchIcon,
  PersonAdd as PersonAddIcon,
  Message as MessageIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit, DocumentData, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';

interface UserProfile {
  id: string;
  username: string;
  name: string;
  profilePic: string;
  bio: string;
  coverPhoto?: string;
  isPublic: boolean;
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

const Discover: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(
          usersRef,
          where('isPublic', '==', true),
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

    fetchUsers();
  }, []);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (!currentUser || !db) {
      setUsers([]);
      setRooms([]);
      return;
    }

    if (query.length < 2) {
      setUsers([]);
      setRooms([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const filteredUsers = users.filter(user => 
        user.username?.toLowerCase().includes(query.toLowerCase()) ||
        user.name?.toLowerCase().includes(query.toLowerCase())
      );

      const filteredRooms = rooms.filter(room => 
        room.name?.toLowerCase().includes(query.toLowerCase()) ||
        room.description?.toLowerCase().includes(query.toLowerCase())
      );

      setUsers(filteredUsers);
      setRooms(filteredRooms);

    } catch (error: any) {
      console.error('Search error:', error);
      setError(`Failed to perform search: ${error.message}`);
      toast.error(`Search failed: ${error.code || error.message}`);
    } finally {
      setLoading(false);
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

      {searchQuery.length > 0 ? (
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
                              onClick={() => toast.success('Follow feature coming soon!')}
                              title="Follow user"
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
      ) : (
        <>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 4 }}>
            <Tabs value={activeTab} onChange={handleTabChange} aria-label="discover tabs">
              <Tab 
                icon={<WhatshotIcon />} 
                label="Trending Posts" 
                id="trending-posts-tab"
                aria-controls="trending-posts-panel"
              />
              <Tab 
                icon={<GroupIcon />} 
                label="Popular Rooms" 
                id="popular-rooms-tab"
                aria-controls="popular-rooms-panel"
              />
            </Tabs>
          </Box>

          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Alert severity="info" sx={{ maxWidth: 500, mx: 'auto' }}>
              {activeTab === 0 
                ? "Stay tuned! We'll show trending posts with high engagement here."
                : "Stay tuned! Popular and active rooms will appear here."}
            </Alert>
          </Paper>
        </>
      )}
    </Container>
  );
};

export default Discover; 