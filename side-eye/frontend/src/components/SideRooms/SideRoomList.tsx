import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, where, getDocs, addDoc, serverTimestamp, Firestore, Timestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Avatar,
  IconButton,
  Tooltip,
  Chip,
  TextField,
  InputAdornment,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Paper
} from '@mui/material';
import {
  LocalFireDepartment,
  Schedule,
  Group,
  Add,
  Lock,
  Search as SearchIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import CreateSideRoom from '../CreateSideRoom';
import { useFirestore } from '../../context/FirestoreContext';
import { db } from '../../services/firebase';

interface SideRoomMember {
  userId: string;
  username: string;
  avatar: string;
  role: string;
  joinedAt: Date;
}

interface SideRoomData {
  id: string;
  name: string;
  description?: string;
  createdAt: {
    toMillis: () => number;
  };
  lastActive: {
    toMillis: () => number;
  };
  memberCount: number;
  maxMembers: number;
  members?: SideRoomMember[];
  isPrivate?: boolean;
  password?: string;
  genre?: string;
}

const GENRES = [
  'All',
  'Gaming',
  'Music',
  'Art',
  'Technology',
  'Sports',
  'Education',
  'Entertainment',
  'Social',
  'Other'
];

const SideRoomList: React.FC = () => {
  const [rooms, setRooms] = useState<SideRoomData[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<SideRoomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<SideRoomData | null>(null);
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  useEffect(() => {
    try {
      const q = query(collection(db, 'sideRooms'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const rooms = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          memberCount: doc.data().memberCount || 0,
          maxMembers: doc.data().maxMembers || 50
        })) as SideRoomData[];
        setRooms(rooms);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      setError('Error fetching rooms');
      setLoading(false);
    }
  }, []);

  // Filter and search effect
  useEffect(() => {
    let result = [...rooms];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(room => 
        room.name.toLowerCase().includes(query) ||
        (room.genre && room.genre.toLowerCase().includes(query))
      );
    }
    
    // Apply genre filter
    if (selectedGenre !== 'All') {
      result = result.filter(room => room.genre === selectedGenre);
    }
    
    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return b.createdAt.toMillis() - a.createdAt.toMillis();
        case 'popular':
          return b.memberCount - a.memberCount;
        case 'active':
          return b.lastActive.toMillis() - a.lastActive.toMillis();
        default:
          return 0;
      }
    });
    
    setFilteredRooms(result);
  }, [rooms, searchQuery, selectedGenre, sortBy]);

  const handleJoinRoom = async (room: SideRoomData) => {
    if (!db || !currentUser) {
      toast.error('Not authenticated');
      return;
    }

    if (room.isPrivate) {
      setSelectedRoom(room);
      setShowPasswordDialog(true);
    } else {
      try {
        setIsProcessing(true);
        const roomRef = doc(db, 'sideRooms', room.id);
        
        // First check if user is already a member
        const isMember = room.members?.some(member => member.userId === currentUser.uid);
        
        if (isMember) {
          navigate(`/side-room/${room.id}`);
          return;
        }

        // Check if room is full
        if (room.memberCount >= room.maxMembers) {
          toast.error('Room is full');
          return;
        }

        // Try to join the room
        const newMember: SideRoomMember = {
          userId: currentUser.uid,
          username: currentUser.displayName || 'Anonymous',
          avatar: currentUser.photoURL || '',
          role: 'member',
          joinedAt: new Date()
        };

        await updateDoc(roomRef, {
          members: arrayUnion(newMember),
          memberCount: room.memberCount + 1,
          lastActive: new Date()
        });

        toast.success('Joined room successfully');
        navigate(`/side-room/${room.id}`);
      } catch (error) {
        console.error('Error joining room:', error);
        toast.error('Failed to join room');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handlePasswordSubmit = async () => {
    if (!selectedRoom || !db || !currentUser) return;

    if (password === selectedRoom.password) {
      try {
        setIsProcessing(true);
        const roomRef = doc(db, 'sideRooms', selectedRoom.id);
        const newMember = {
          userId: currentUser.uid,
          username: currentUser.displayName || 'Anonymous',
          avatar: currentUser.photoURL || '',
          role: 'member',
          joinedAt: new Date()
        };

        // First check if user is already a member
        const isMember = selectedRoom.members?.some(member => {
          console.log('Comparing member ID:', member.userId, 'with current user ID:', currentUser.uid);
          return member.userId === currentUser.uid;
        });
        
        if (isMember) {
          console.log('User is already a member, navigating to room');
          navigate(`/side-room/${selectedRoom.id}`);
          return;
        }

        // Check if room is full
        if (selectedRoom.memberCount >= (selectedRoom.maxMembers || 50)) {
          toast.error('Room is full');
          return;
        }

        await updateDoc(roomRef, {
          members: arrayUnion(newMember),
          memberCount: (selectedRoom.memberCount || 0) + 1,
          lastActive: new Date()
        });

        toast.success('Joined room successfully');
        setShowPasswordDialog(false);
        setPassword('');
        setSelectedRoom(null);
        navigate(`/side-room/${selectedRoom.id}`);
      } catch (error) {
        console.error('Error joining room:', error);
        toast.error('Failed to join room');
      } finally {
        setIsProcessing(false);
      }
    } else {
      toast.error('Incorrect password');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Side Rooms 🎭
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Add />}
          onClick={() => setShowCreateRoom(true)}
        >
          Create Room
        </Button>
      </Box>

      {showCreateRoom && (
        <CreateSideRoom open={showCreateRoom} onClose={() => setShowCreateRoom(false)} />
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search rooms by name or genre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Genre</InputLabel>
              <Select
                value={selectedGenre}
                label="Genre"
                onChange={(e) => setSelectedGenre(e.target.value)}
              >
                {GENRES.map((genre) => (
                  <MenuItem key={genre} value={genre}>
                    {genre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Sort by</InputLabel>
              <Select
                value={sortBy}
                label="Sort by"
                onChange={(e) => setSortBy(e.target.value)}
              >
                <MenuItem value="newest">Newest First</MenuItem>
                <MenuItem value="popular">Most Popular</MenuItem>
                <MenuItem value="active">Most Active</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {filteredRooms.length === 0 ? (
          <Typography variant="body1" sx={{ width: '100%', textAlign: 'center', mt: 4 }}>
            No rooms found matching your criteria
          </Typography>
        ) : (
          filteredRooms.map((room) => (
            <Card key={room.id} sx={{ width: 300, display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                    {room.name}
                  </Typography>
                  {room.isPrivate && (
                    <Tooltip title="Private Room">
                      <Lock fontSize="small" />
                    </Tooltip>
                  )}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {room.description}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {room.genre && (
                    <Chip
                      size="small"
                      label={room.genre}
                      color="primary"
                      variant="outlined"
                    />
                  )}
                  <Chip
                    size="small"
                    icon={<Group />}
                    label={`${room.memberCount || 0} members`}
                    variant="outlined"
                  />
                </Box>
              </CardContent>
              <CardActions>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => handleJoinRoom(room)}
                  disabled={isProcessing}
                >
                  {isProcessing ? <CircularProgress size={24} /> : 'Join Room'}
                </Button>
              </CardActions>
            </Card>
          ))
        )}
      </Box>

      <Dialog open={showPasswordDialog} onClose={() => !isProcessing && setShowPasswordDialog(false)}>
        <DialogTitle>Enter Room Password</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Password"
            type="password"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isProcessing}
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setShowPasswordDialog(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button 
            onClick={handlePasswordSubmit} 
            variant="contained"
            disabled={isProcessing}
          >
            Join
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SideRoomList; 