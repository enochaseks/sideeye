import React, { useState } from 'react';
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
  Chip
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
import { useNavigate } from 'react-router-dom';
import { getDb } from '../services/firebase';
import { 
  collection, 
  query as firestoreQuery, 
  where, 
  getDocs,
  DocumentData,
  QueryDocumentSnapshot,
  Timestamp
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';

interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  username: string;
  bio?: string;
  followers?: number;
  following?: number;
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
  displayName: string;
  photoURL: string;
  username: string;
  bio?: string;
  followers?: number;
  following?: number;
  displayNameSearch: string;
  usernameSearch: string;
}

interface FirestoreRoom extends DocumentData {
  name: string;
  description: string;
  memberCount: number;
  shareCount: number;
  isPrivate: boolean;
  createdAt: Timestamp;
  nameSearch: string;
}

const Discover: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    users: UserProfile[];
    rooms: Room[];
  }>({ users: [], rooms: [] });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (query.length < 2) {
      setSearchResults({ users: [], rooms: [] });
      return;
    }

    setLoading(true);
    try {
      const db = await getDb();
      const queryLower = query.toLowerCase();

      // Search users
      const usersRef = collection(db, 'users');
      const nameQuery = firestoreQuery(
        usersRef,
        where('displayNameSearch', '>=', queryLower),
        where('displayNameSearch', '<=', queryLower + '\uf8ff')
      );

      const usernameQuery = firestoreQuery(
        usersRef,
        where('usernameSearch', '>=', queryLower),
        where('usernameSearch', '<=', queryLower + '\uf8ff')
      );

      // Search rooms
      const roomsRef = collection(db, 'rooms');
      const roomQuery = firestoreQuery(
        roomsRef,
        where('nameSearch', '>=', queryLower),
        where('nameSearch', '<=', queryLower + '\uf8ff')
      );

      const [nameResults, usernameResults, roomResults] = await Promise.all([
        getDocs(nameQuery),
        getDocs(usernameQuery),
        getDocs(roomQuery)
      ]);

      // Combine and deduplicate user results
      const combinedUserResults = new Map<string, UserProfile>();
      
      nameResults.docs.forEach((doc) => {
        const data = doc.data() as FirestoreUser;
        combinedUserResults.set(doc.id, {
          uid: doc.id,
          displayName: data.displayName || 'Anonymous',
          photoURL: data.photoURL || '',
          username: data.username || '',
          bio: data.bio || '',
          followers: data.followers || 0,
          following: data.following || 0
        });
      });

      usernameResults.docs.forEach((doc) => {
        if (!combinedUserResults.has(doc.id)) {
          const data = doc.data() as FirestoreUser;
          combinedUserResults.set(doc.id, {
            uid: doc.id,
            displayName: data.displayName || 'Anonymous',
            photoURL: data.photoURL || '',
            username: data.username || '',
            bio: data.bio || '',
            followers: data.followers || 0,
            following: data.following || 0
          });
        }
      });

      // Process room results
      const roomResultsList = roomResults.docs.map(doc => {
        const data = doc.data() as FirestoreRoom;
        return {
          id: doc.id,
          name: data.name,
          description: data.description,
          memberCount: data.memberCount || 0,
          shareCount: data.shareCount || 0,
          isPrivate: data.isPrivate || false,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date()
        };
      });

      setSearchResults({
        users: Array.from(combinedUserResults.values()),
        rooms: roomResultsList
      });
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search');
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
              {searchResults.users.length === 0 ? (
                <ListItem>
                  <ListItemText 
                    primary="No users found" 
                    secondary="Try a different search term"
                  />
                </ListItem>
              ) : (
                searchResults.users.map((user, index) => (
                  <React.Fragment key={user.uid}>
                    <ListItem
                      secondaryAction={
                        user.uid !== currentUser?.uid && (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton
                              edge="end"
                              onClick={() => navigate(`/messages/${user.uid}`)}
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
                        <Avatar src={user.photoURL} alt={user.displayName}>
                          {user.displayName[0]}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={user.displayName}
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
                        onClick={() => handleUserClick(user.uid)}
                        sx={{ cursor: 'pointer' }}
                      />
                    </ListItem>
                    {index < searchResults.users.length - 1 && <Divider />}
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
              {searchResults.rooms.length === 0 ? (
                <ListItem>
                  <ListItemText 
                    primary="No rooms found" 
                    secondary="Try a different search term"
                  />
                </ListItem>
              ) : (
                searchResults.rooms.map((room, index) => (
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
                    {index < searchResults.rooms.length - 1 && <Divider />}
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