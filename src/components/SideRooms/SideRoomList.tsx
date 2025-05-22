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
  CardMedia,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  LocalFireDepartment,
  Schedule,
  Add,
  Lock,
  Search as SearchIcon,
  FilterList as FilterIcon,
  AccessTime as AccessTimeIcon,
  CleaningServices as CleanupIcon,
  Equalizer as EqualizerIcon
} from '@mui/icons-material';
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
  viewerCount: number | null;
  maxViewers: number;
  viewers: SideRoomMember[] | undefined;
  isPrivate: boolean;
  password?: string;
  genre?: string;
  tags?: string[];
  category?: string;
  thumbnailUrl?: string;
  ownerId: string;
  isLive?: boolean;
  totalViews?: number;
  activeUsers?: number;
  isPopular?: boolean;
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
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<SideRoomData | null>(null);
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [isAdminCleanupRunning, setIsAdminCleanupRunning] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Add this inside the SideRoomList component definition
  const [roomOwnerProfiles, setRoomOwnerProfiles] = useState<{[key: string]: { username: string, profilePic: string }}>({});

  // Function to handle the click on Create Room button for desktop
  const handleCreateRoomClick = () => {
    // Use the global create room dialog by accessing the window object
    // @ts-ignore
    if (window.openCreateRoomDialog && typeof window.openCreateRoomDialog === 'function') {
      // @ts-ignore
      window.openCreateRoomDialog();
    }
  };

  // Function to get both blocked users and users who blocked the current user
  const getBlockedAndBlockingUsers = async (): Promise<string[]> => {
    if (!currentUser || !db) return [];
    
    try {
      // Get users who have blocked the current user
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      const blockedByUsers: string[] = [];
      
      usersSnapshot.forEach(userDoc => {
        const userData = userDoc.data();
        if (userData.blockedUsers && 
            Array.isArray(userData.blockedUsers) && 
            userData.blockedUsers.includes(currentUser.uid)) {
          blockedByUsers.push(userDoc.id);
        }
      });
      
      // Get current user's blocked users
      const blockedUsers = currentUser.blockedUsers || [];
      
      // Return combined list
      return [...blockedUsers, ...blockedByUsers];
    } catch (error) {
      console.error('Error fetching blocked users:', error);
      return [];
    }
  };

  // Fetch blocked users when component mounts or current user changes
  useEffect(() => {
    if (currentUser) {
      const fetchBlockedUsers = async () => {
        const blockedList = await getBlockedAndBlockingUsers();
        setBlockedUsers(blockedList);
      };
      
      fetchBlockedUsers();
    }
  }, [currentUser]);

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
        where("deleted", "==", false),
        orderBy('createdAt', 'desc')
      );
      
      const unsubscribe = onSnapshot(q, 
        async (snapshot) => {
          const roomsData = snapshot.docs.map(doc => {
            const data = doc.data();
            // Determine if room is popular based on the same logic as Discover page
            const isPopular = (data.totalViews || 0) > 200 || (data.activeUsers || 0) >= 200;
            
            return {
              id: doc.id,
              name: data.name || '',
              description: data.description,
              createdAt: data.createdAt as Timestamp,
              lastActive: data.lastActive as Timestamp,
              viewerCount: null,
              maxViewers: data.maxViewers || 100,
              viewers: data.viewers as SideRoomMember[] | undefined,
              isPrivate: data.isPrivate,
              password: data.password,
              genre: data.genre,
              tags: data.tags as string[] | undefined,
              category: data.category,
              thumbnailUrl: data.thumbnailUrl,
              ownerId: data.ownerId,
              isLive: data.isLive,
              totalViews: data.totalViews,
              activeUsers: (data.activeUsers === 0) ? null : data.activeUsers,
              isPopular: isPopular
            } as SideRoomData;
          });
          
          // Double-check filtering of deleted rooms since some might not have the deleted field
          const filteredRooms = roomsData.filter(room => 
            !blockedUsers.includes(room.ownerId) && 
            !(room as any).deleted
          );
          
          setRooms(filteredRooms);
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
  }, [db, blockedUsers]);

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

  // Check if the current user is an admin
  useEffect(() => {
    if (!currentUser || !db) return;
    
    const checkAdminStatus = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data();
        setIsAdmin(userData?.role === 'admin');
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      }
    };
    
    checkAdminStatus();
  }, [currentUser, db]);

  // Add this useEffect to fetch owner profile pictures
  useEffect(() => {
    if (!db || rooms.length === 0) return;
    
    const fetchOwnerProfiles = async () => {
      // Fix: Create unique ownerIds array without using Set spread
      const ownerIdsSet = new Set<string>();
      rooms.forEach(room => {
        if (room.ownerId) {
          ownerIdsSet.add(room.ownerId);
        }
      });
      const ownerIds = Array.from(ownerIdsSet);
      
      const profileData: {[key: string]: { username: string, profilePic: string }} = {};
      
      for (const ownerId of ownerIds) {
        try {
          const userDoc = await getDoc(doc(db, 'users', ownerId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            profileData[ownerId] = {
              username: userData.username || 'Unknown',
              profilePic: userData.profilePic || '/default-avatar.jpg'
            };
          }
        } catch (error) {
          console.error(`Error fetching profile for user ${ownerId}:`, error);
        }
      }
      
      setRoomOwnerProfiles(profileData);
    };
    
    fetchOwnerProfiles();
  }, [db, rooms]);

  // Add this helper function for smooth transitions
  const navigateWithTransition = (path: string) => {
    // Add a loading overlay to prevent flickering during transition
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'page-transition-overlay';
    loadingOverlay.style.position = 'fixed';
    loadingOverlay.style.top = '0';
    loadingOverlay.style.left = '0';
    loadingOverlay.style.width = '100%';
    loadingOverlay.style.height = '100%';
    loadingOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    loadingOverlay.style.zIndex = '9999';
    loadingOverlay.style.display = 'flex';
    loadingOverlay.style.justifyContent = 'center';
    loadingOverlay.style.alignItems = 'center';
    loadingOverlay.innerHTML = '<div style="width: 40px; height: 40px; border: 3px solid #f3f3f3; border-top: 3px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>';
    
    // Add the keyframes for the spinner
    const style = document.createElement('style');
    style.innerHTML = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
    document.head.appendChild(style);
    
    document.body.appendChild(loadingOverlay);
    
    // Delay navigation slightly to allow the overlay to render
    setTimeout(() => {
      // Reset any CSS animations/transitions
      document.documentElement.style.setProperty('--global-transition', 'none !important');
      
      // Navigate to the room
      navigate(path);
      
      // Clean up after navigation
      setTimeout(() => {
        const overlay = document.getElementById('page-transition-overlay');
        if (overlay) document.body.removeChild(overlay);
        document.documentElement.style.removeProperty('--global-transition');
        document.head.removeChild(style);
      }, 300);
    }, 100);
  };

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
            activeUsers: increment(1)
          });
        }
      });
      
      // Use the helper function for smooth transition
      navigateWithTransition(`/side-room/${room.id}`);
      
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
            activeUsers: increment(1)
          });
        }
      });

      setShowPasswordDialog(false);
      setPassword('');
      
      // Use the helper function for smooth transition
      navigateWithTransition(`/side-room/${selectedRoom.id}`);
      
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

  // Function to check for orphaned rooms (rooms whose owners don't exist anymore)
  const cleanupOrphanedRooms = async () => {
    if (!currentUser || !isAdmin) {
      toast.error("Only administrators can run this operation");
      return;
    }
    
    setIsAdminCleanupRunning(true);
    try {
      // 1. Get all rooms
      const roomsQuery = query(collection(db, 'sideRooms'), where("deleted", "!=", true));
      const roomsSnapshot = await getDocs(roomsQuery);
      
      // Set of all owner IDs
      const ownerIds = new Set<string>();
      const roomsToCheck: { id: string, ownerId: string }[] = [];
      
      roomsSnapshot.forEach(roomDoc => {
        const roomData = roomDoc.data();
        if (roomData.ownerId) {
          ownerIds.add(roomData.ownerId);
          roomsToCheck.push({ id: roomDoc.id, ownerId: roomData.ownerId });
        }
      });
      
      console.log(`Found ${ownerIds.size} unique room owners to check`);
      
      // Only check each owner once - creates a map of userId -> exists
      const ownerExistsMap = new Map<string, boolean>();
      
      // Check each unique owner
      const ownerIdsArray = Array.from(ownerIds);
      for (const ownerId of ownerIdsArray) {
        const userDoc = await getDoc(doc(db, 'users', ownerId));
        ownerExistsMap.set(ownerId, userDoc.exists());
      }
      
      // Mark rooms as deleted if their owner doesn't exist
      let cleanupCount = 0;
      for (const room of roomsToCheck) {
        const ownerExists = ownerExistsMap.get(room.ownerId) ?? false;
        
        if (!ownerExists) {
          console.log(`Marking room ${room.id} as deleted - owner ${room.ownerId} no longer exists`);
          await updateDoc(doc(db, 'sideRooms', room.id), {
            deleted: true,
            deletedAt: new Date().toISOString(),
            deletedBy: 'admin-cleanup'
          });
          cleanupCount++;
        }
      }
      
      toast.success(`Cleanup complete: ${cleanupCount} orphaned rooms marked as deleted`);
    } catch (error) {
      console.error("Error cleaning up orphaned rooms:", error);
      toast.error("Error during cleanup");
    } finally {
      setIsAdminCleanupRunning(false);
    }
  };

  // Update the sorting logic to prioritize popular rooms
  const sortRooms = (rooms: SideRoomData[]) => {
    const sorted = [...rooms];
    
    // Apply filtering based on user selection
    let filtered = sorted;
    
    if (searchQuery) {
      filtered = filtered.filter(room => 
        room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (room.description && room.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    if (selectedGenre !== 'All') {
      filtered = filtered.filter(room => 
        room.category === selectedGenre ||
        room.genre === selectedGenre ||
        (room.tags && room.tags.includes(selectedGenre))
      );
    }

    // Apply sorting with popular rooms first
    filtered.sort((a, b) => {
      // First sort by popularity
      if (a.isPopular && !b.isPopular) return -1;
      if (!a.isPopular && b.isPopular) return 1;
      
      // Then by the selected sort criteria
      switch (sortBy) {
        case 'newest':
          return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
        case 'oldest':
          return (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0);
        case 'members':
          return (b.viewerCount || 0) - (a.viewerCount || 0);
        case 'activity':
          return (b.lastActive?.toMillis() || 0) - (a.lastActive?.toMillis() || 0);
        default:
          return 0;
      }
    });
    
    return filtered;
  };

  // Now call this function to update filteredRooms whenever relevant state changes
  useEffect(() => {
    setFilteredRooms(sortRooms(rooms));
  }, [rooms, searchQuery, selectedGenre, sortBy]);

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
        <Box sx={{ display: 'flex', gap: 2 }}>
          {isAdmin && (
            <Button
              variant="outlined"
              startIcon={isAdminCleanupRunning ? <CircularProgress size={20} /> : <CleanupIcon />}
              onClick={cleanupOrphanedRooms}
              disabled={isAdminCleanupRunning}
            >
              {isAdminCleanupRunning ? 'Cleaning...' : 'Cleanup Orphaned Rooms'}
            </Button>
          )}
          {/* Hide Create Room button on mobile, it will be in the bottom nav */}
          {!isMobile && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleCreateRoomClick}
              disabled={!currentUser}
            >
              Create Room
            </Button>
          )}
        </Box>
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
                <Box sx={{ position: 'relative' }}>
                  <CardMedia
                    component="img"
                    height="140"
                    image={room.thumbnailUrl || (roomOwnerProfiles[room.ownerId]?.profilePic) || 'https://placehold.co/600x400/333/666?text=Room'}
                    alt={room.name}
                    sx={{ objectFit: 'cover' }}
                  />
                  <Box sx={{ 
                    position: 'absolute', 
                    top: 10, 
                    right: 10, 
                    display: 'flex', 
                    gap: 1
                  }}>
                    {((room.totalViews && room.totalViews > 200) || (room.activeUsers && room.activeUsers >= 200)) && (
                      <Chip 
                        label="POPULAR" 
                        color="warning"
                        size="small"
                        icon={<LocalFireDepartment fontSize="small" />}
                        sx={{ 
                          fontWeight: 'bold',
                          fontSize: '0.75rem'
                        }}
                      />
                    )}
                    {room.isLive && (
                      <Chip 
                        label="LIVE" 
                        color="error"
                        size="small"
                        sx={{ 
                          fontWeight: 'bold',
                          fontSize: '0.75rem'
                        }}
                      />
                    )}
                  </Box>
                </Box>
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
                    <Chip icon={<AccessTimeIcon fontSize='small' />} label={`Active: ${formatTimestamp(room.lastActive)}`} size="small" variant="outlined" />
                    {room.category && <Chip label={room.category} size="small" variant="outlined" color="primary" />}
                    {room.isLive && <Chip icon={<EqualizerIcon fontSize='small' />} label="Stream Live" size="small" color="error" variant="outlined" />}
                    {((room.totalViews && room.totalViews > 200) || (room.activeUsers && room.activeUsers >= 200)) && (
                      <Chip 
                        icon={<LocalFireDepartment fontSize='small' />} 
                        label="POPULAR" 
                        size="small" 
                        color="warning" 
                        variant="outlined" 
                      />
                    )}
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