import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, where, getDocs, addDoc, serverTimestamp, Firestore, Timestamp, runTransaction, getDoc, FieldValue, increment } from 'firebase/firestore';
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
  Paper,
  CardMedia
} from '@mui/material';
import {
  LocalFireDepartment,
  Schedule,
  Group,
  Add,
  Lock,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Visibility as VisibilityIcon,
  AccessTime as AccessTimeIcon
} from '@mui/icons-material';
import CreateSideRoom from '../CreateSideRoom';
import { useFirestore } from '../../context/FirestoreContext';
import { db } from '../../services/firebase';

interface SideRoomMember {
  userId: string;
  username: string;
  avatar: string;
  role: 'owner' | 'member' | 'viewer';
  joinedAt: Date | FieldValue;
}

interface SideRoomData {
  id: string;
  name: string;
  description: string;
  createdAt: Timestamp;
  lastActive: Timestamp;
  viewerCount: number;
  maxViewers: number;
  viewers: SideRoomMember[] | undefined;
  isPrivate: boolean;
  password?: string;
  genre?: string;
  tags?: string[];
  category?: string;
  thumbnailUrl?: string;
}

const GENRES = [
  'All',
  'ASMR',
  'Just Chatting',
  'Music',
  'Gossip',
  'Podcasts',
  'Shows',
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
    if (!db) {
      setError("Firestore not initialized");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const sideRoomsRef = collection(db, 'sideRooms');
      const q = query(
        sideRoomsRef,
        where("deleted", "!=", true),
        orderBy('createdAt', 'desc')
      );
      
      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          const roomsData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name || '',
              description: data.description,
              createdAt: data.createdAt as Timestamp,
              lastActive: data.lastActive as Timestamp,
              viewerCount: data.viewerCount || 0,
              maxViewers: data.maxViewers || 100,
              viewers: data.viewers as SideRoomMember[] | undefined,
              isPrivate: data.isPrivate,
              password: data.password,
              genre: data.genre,
              tags: data.tags as string[] | undefined,
              category: data.category,
              thumbnailUrl: data.thumbnailUrl
            } as SideRoomData;
          });
          
          setRooms(roomsData);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error("Error fetching side rooms:", err);
          setError('Error fetching rooms. Please check permissions or network.');
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err: any) {
      console.error("Error setting up side rooms query:", err);
      setError(`Error setting up query: ${err.message}`);
      setLoading(false);
    }
  }, [db]);

  // Separate useEffect for filtering/sorting based on user interaction
  useEffect(() => {
    let filtered = [...rooms];

    // Apply search query filter
    if (searchQuery) {
      filtered = filtered.filter(room => 
        room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (room.description && room.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply genre/category/tags filter
    if (selectedGenre !== 'All') {
      filtered = filtered.filter(room => 
        room.category === selectedGenre ||
        room.genre === selectedGenre ||
        (room.tags && room.tags.includes(selectedGenre))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const timeA = a.createdAt?.toMillis() || 0;
      const timeB = b.createdAt?.toMillis() || 0;
      const lastActiveA = a.lastActive?.toMillis() || 0;
      const lastActiveB = b.lastActive?.toMillis() || 0;

      switch (sortBy) {
        case 'newest':
          return timeB - timeA;
        case 'oldest':
          return timeA - timeB;
        case 'members':
          return (b.viewerCount || 0) - (a.viewerCount || 0);
        case 'activity':
          return lastActiveB - lastActiveA;
        default:
          return 0;
      }
    });

    setFilteredRooms(filtered);

  }, [rooms, searchQuery, selectedGenre, sortBy]); // Re-run filtering when data or filters change

  const handleJoinRoom = async (room: SideRoomData) => {
    if (!currentUser || !db) {
      toast.error("You must be logged in to join a room.");
      return;
    }

    if (room.isPrivate) {
      setSelectedRoom(room);
      setShowPasswordDialog(true);
      return;
    }

    setIsProcessing(true);
    try {
      const roomRef = doc(db, 'sideRooms', room.id);
      await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) {
          throw new Error("Room does not exist!");
        }
        const currentViewers = roomDoc.data()?.viewers || [];
        const isAlreadyViewer = currentUser && currentViewers.some((v: SideRoomMember) => v.userId === currentUser.uid);
        if (currentUser && !isAlreadyViewer) {
          const newViewer: SideRoomMember = {
            userId: currentUser.uid,
            username: currentUser.displayName || currentUser.email?.split('@')[0] || '',
            avatar: currentUser.photoURL || '',
            role: 'viewer',
            joinedAt: Timestamp.now()
          };
          transaction.update(roomRef, {
            viewers: arrayUnion(newViewer),
            viewerCount: increment(1)
          });
        }
      });
      navigate(`/side-room/${room.id}`);
    } catch (error: any) {
      console.error("Error joining room:", error);
      toast.error(`Failed to join room: ${error?.message || error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!currentUser || !selectedRoom || !password || !db) return;

    setIsProcessing(true);
    try {
      const roomRef = doc(db, 'sideRooms', selectedRoom.id);
      const roomSnapshot = await getDoc(roomRef);

      if (!roomSnapshot.exists() || roomSnapshot.data()?.password !== password) {
        toast.error("Incorrect password");
        setIsProcessing(false);
        return;
      }

      await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) {
          throw new Error("Room does not exist!");
        }
        const currentViewers = roomDoc.data()?.viewers || [];
        const isAlreadyViewer = currentUser && currentViewers.some((v: SideRoomMember) => v.userId === currentUser.uid);
        if (currentUser && !isAlreadyViewer) {
          const newViewer: SideRoomMember = {
            userId: currentUser.uid,
            username: currentUser.displayName || currentUser.email?.split('@')[0] || '',
            avatar: currentUser.photoURL || '',
            role: 'viewer',
            joinedAt: Timestamp.now()
          };
          transaction.update(roomRef, {
            viewers: arrayUnion(newViewer),
            viewerCount: increment(1)
          });
        }
      });

      setShowPasswordDialog(false);
      setPassword('');
      navigate(`/side-room/${selectedRoom.id}`);
    } catch (error: any) {
      console.error("Error joining private room:", error);
      toast.error(`Failed to join room: ${error?.message || error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTimestamp = (timestamp: Timestamp | null | undefined): string => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Typography color="error">Error: {error}</Typography>;
  }

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Side Rooms</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setShowCreateRoom(true)}
          disabled={!currentUser}
        >
          Create Room
        </Button>
      </Box>

      <Paper elevation={1} sx={{ p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search rooms..."
          variant="outlined"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ flexGrow: 1, minWidth: '200px' }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={selectedGenre}
            label="Category"
            onChange={(e) => setSelectedGenre(e.target.value)}
          >
            {GENRES.map((genre) => (
              <MenuItem key={genre} value={genre}>{genre}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Sort By</InputLabel>
          <Select
            value={sortBy}
            label="Sort By"
            onChange={(e) => setSortBy(e.target.value)}
          >
            <MenuItem value="newest">Newest</MenuItem>
            <MenuItem value="oldest">Oldest</MenuItem>
            <MenuItem value="members">Most Viewers</MenuItem>
            <MenuItem value="activity">Last Active</MenuItem>
          </Select>
        </FormControl>
      </Paper>

      <Grid container spacing={3}>
        {filteredRooms.length > 0 ? (
          filteredRooms.map((room) => (
            <Grid item xs={12} md={6} lg={4} key={room.id}>
              <Card sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                height: '100%', // Ensure cards in the same row have the same height
                borderRadius: 2, 
                transition: 'box-shadow 0.3s', 
                '&:hover': {
                  boxShadow: 3,
                }
              }}>
                <CardMedia
                  component="img"
                  height="140"
                  image={room.thumbnailUrl || '/default-room.jpg'}
                  alt={room.name}
                  sx={{ objectFit: 'cover' }}
                />
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="h6" component="div">
                      {room.name}
                    </Typography>
                    {room.isPrivate && (
                      <Tooltip title="Private Room" arrow>
                        <Lock fontSize="small" color="action" />
                      </Tooltip>
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {room.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                    <Chip icon={<VisibilityIcon fontSize='small' />} label={`${room.viewerCount || 0} Viewing`} size="small" variant="outlined" />
                    <Chip icon={<AccessTimeIcon fontSize='small' />} label={`Active: ${formatTimestamp(room.lastActive)}`} size="small" variant="outlined" />
                    {room.category && <Chip label={room.category} size="small" variant="outlined" color="primary" />}
                  </Box>
                </CardContent>
                <CardActions sx={{ justifyContent: 'flex-end', p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => handleJoinRoom(room)}
                    disabled={isProcessing}
                  >
                    Join Room
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))
        ) : (
          <Typography sx={{ width: '100%', textAlign: 'center', mt: 4 }}>
            No rooms found. Why not create one?
          </Typography>
        )}
      </Grid>

      <CreateSideRoom
        open={showCreateRoom}
        onClose={() => setShowCreateRoom(false)}
      />

      <Dialog open={showPasswordDialog} onClose={() => setShowPasswordDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Enter Room Password</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Password"
            type="password"
            fullWidth
            variant="standard"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPasswordDialog(false)} disabled={isProcessing}>Cancel</Button>
          <Button onClick={handlePasswordSubmit} disabled={isProcessing || !password}>
            {isProcessing ? <CircularProgress size={24} /> : 'Join'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SideRoomList; 