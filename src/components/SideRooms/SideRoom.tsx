import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot, increment, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import {
  Box,
  Typography,
  Button,
  Avatar,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert
} from '@mui/material';
import { ExitToApp, Lock, Group, LiveTv, LocalFireDepartment } from '@mui/icons-material';
import type { RoomMember } from '../../types';

// Define SideRoom type locally to ensure it has all the properties we need
interface SideRoom {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  viewers: RoomMember[];
  memberCount: number;
  createdAt: any; // Timestamp or Date
  isPrivate: boolean;
  password?: string;
  tags?: string[];
  lastActive: any; // Timestamp or Date
  maxMembers: number;
  bannedUsers?: string[];
  isLive?: boolean;
  activeUsers?: number; // Number of users currently viewing
  viewerCount?: number; // Number of users currently viewing (alternative field)
  totalViews?: number; // Total view count over time
}

interface SideRoomProps {
  roomId: string;
}

const SideRoom: React.FC<SideRoomProps> = ({ roomId }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [room, setRoom] = useState<SideRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!currentUser) {
      setError('Not authenticated');
      return;
    }

    try {
      const roomRef = doc(db, 'sideRooms', roomId);
      const unsubscribe = onSnapshot(roomRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          const roomData: SideRoom = {
            id: doc.id,
            name: data.name || '',
            description: data.description || '',
            ownerId: data.ownerId || '',
            viewers: data.viewers || [],
            memberCount: data.memberCount || 0,
            createdAt: data.createdAt || new Date(),
            isPrivate: data.isPrivate || false,
            password: data.password || '',
            tags: data.tags || [],
            lastActive: data.lastActive || new Date(),
            maxMembers: data.maxMembers || 50,
            bannedUsers: data.bannedUsers || [],
            isLive: data.isLive || false,
            activeUsers: data.activeUsers || 0,
            viewerCount: data.viewerCount || 0,
            totalViews: data.totalViews || 0
          };
          setRoom(roomData);
          setLoading(false);

          // Check if user is already a viewer
          const isViewer = roomData.viewers?.some(viewer => viewer.userId === currentUser.uid);
          if (!isViewer && roomData.isPrivate) {
            setShowPasswordDialog(true);
          }
        } else {
          setError('Room not found');
          setLoading(false);
        }
      }, (error) => {
        console.error('Error fetching room:', error);
        setError('Failed to fetch room');
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error setting up room listener:', error);
      setError('Failed to set up room listener');
      setLoading(false);
    }
  }, [roomId, currentUser]);

  // Update active viewers count when component mounts/unmounts
  useEffect(() => {
    if (!db || !currentUser || !room) return;

    const roomRef = doc(db, 'sideRooms', roomId);
    
    // Increment viewer count when entering room
    const updateViewerCount = async () => {
      try {
        await updateDoc(roomRef, {
          activeUsers: increment(1),
          lastActive: serverTimestamp()
        });
      } catch (error) {
        console.error('Error updating viewer count:', error);
      }
    };

    updateViewerCount();

    // Decrement viewer count when leaving room
    return () => {
      const decrementViewers = async () => {
        try {
          await updateDoc(roomRef, {
            activeUsers: increment(-1)
          });
        } catch (error) {
          console.error('Error decreasing viewer count:', error);
        }
      };
      decrementViewers();
    };
  }, [db, currentUser, roomId, room]);

  const handleJoinRoom = async () => {
    if (!db || !currentUser || !room) return;

    try {
      const roomRef = doc(db, 'sideRooms', room.id);

      // 1. Fetch the UserProfile for the currentUser
      const userProfileRef = doc(db, 'users', currentUser.uid);
      const userProfileSnap = await getDoc(userProfileRef);

      let userDisplayName = 'Anonymous';
      let actualUsername = 'anonymous_user';
      let userAvatar = '';

      if (userProfileSnap.exists()) {
        const userProfileData = userProfileSnap.data(); // Consider casting to UserProfile type
        userDisplayName = userProfileData.name || userProfileData.username || currentUser.displayName || 'Anonymous';
        actualUsername = userProfileData.username || 'anonymous_user';
        userAvatar = userProfileData.profilePic || currentUser.photoURL || '';
      } else {
        // Fallback if Firestore profile is missing
        userDisplayName = currentUser.displayName || 'Anonymous';
        actualUsername = currentUser.displayName?.split(' ')[0].toLowerCase() || 'anonymous_user';
        userAvatar = currentUser.photoURL || '';
        console.warn(`UserProfile not found for UID: ${currentUser.uid}. Using Auth display name.`);
      }

      // 2. Now create the RoomMember object with all required fields
      const viewerData: RoomMember = {
        userId: currentUser.uid,
        displayName: userDisplayName, // Use fetched display name
        username: actualUsername,     // Use fetched username
        avatar: userAvatar,           // Use fetched avatar
        role: 'viewer',
        joinedAt: new Date() // Or Timestamp.now() or serverTimestamp() as appropriate
      };

      await updateDoc(roomRef, {
        viewers: arrayUnion(viewerData),
        memberCount: increment(1),
        totalViews: increment(1),
        lastActive: serverTimestamp()
      });

      toast.success('Joined room successfully');
      setShowPasswordDialog(false);
    } catch (error) {
      console.error('Error joining room:', error);
      setError('Failed to join room');
    }
  };

  const handleLeaveRoom = async () => {
    if (!db || !currentUser || !room) return;

    try {
      const roomRef = doc(db, 'sideRooms', room.id);

      // Fetch the current user's profile to construct viewerToRemove accurately
      const userProfileRef = doc(db, 'users', currentUser.uid);
      const userProfileSnap = await getDoc(userProfileRef);

      let userDisplayName = 'Anonymous';
      let actualUsername = 'anonymous_user';
      let userAvatar = '';
      // We need joinedAt from the existing room.viewers array for an exact match if possible
      // However, arrayRemove might still work if other fields match well enough.
      // For simplicity here, we'll reconstruct with current time, but ideally, you'd fetch the exact viewer object.

      if (userProfileSnap.exists()) {
        const userProfileData = userProfileSnap.data();
        userDisplayName = userProfileData.name || userProfileData.username || currentUser.displayName || 'Anonymous';
        actualUsername = userProfileData.username || 'anonymous_user';
        userAvatar = userProfileData.profilePic || currentUser.photoURL || '';
      } else {
        userDisplayName = currentUser.displayName || 'Anonymous';
        actualUsername = currentUser.displayName?.split(' ')[0].toLowerCase() || 'anonymous_user';
        userAvatar = currentUser.photoURL || '';
        console.warn(`UserProfile not found for UID: ${currentUser.uid} during leave. Using Auth display name.`);
      }
      
      // Find the specific viewer object in the room's viewers array to get the correct joinedAt
      const currentViewerInRoom = room.viewers.find(v => v.userId === currentUser.uid);

      const viewerToRemove: RoomMember = {
        userId: currentUser.uid,
        displayName: userDisplayName,
        username: actualUsername,
        avatar: userAvatar,
        role: 'viewer',
        // Use the joinedAt from the existing viewer object if found, otherwise use a recent timestamp.
        // For arrayRemove to work reliably with objects, all fields should match.
        joinedAt: currentViewerInRoom ? currentViewerInRoom.joinedAt : new Date()
      };

      await updateDoc(roomRef, {
        viewers: arrayRemove(viewerToRemove),
        memberCount: increment(-1)
      });

      toast.success('Left room successfully');
      navigate('/side-rooms');
    } catch (error) {
      console.error('Error leaving room:', error);
      setError('Failed to leave room');
    }
  };

  const handlePasswordSubmit = () => {
    if (room && password === room.password) {
      handleJoinRoom();
    } else {
      toast.error('Incorrect password');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button onClick={() => navigate('/side-rooms')} sx={{ mt: 1 }}>
          Back to Rooms
        </Button>
      </Box>
    );
  }

  if (!room) {
    return null;
  }

  const isViewer = room.viewers?.some(viewer => viewer.userId === currentUser?.uid);
  const owner = room.viewers?.find(viewer => viewer.role === 'owner');
  const isPopular = (room.totalViews || 0) > 200;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="h4" component="h1">
              {room.name}
            </Typography>
            {room.isLive && (
              <Box
                sx={{
                  bgcolor: 'error.main',
                  color: 'error.contrastText',
                  fontWeight: 'bold',
                  fontSize: '0.875rem',
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5
                }}
              >
                <LiveTv fontSize="small" />
                LIVE
              </Box>
            )}
            {isPopular && (
              <Box
                sx={{
                  bgcolor: 'warning.main',
                  color: 'warning.contrastText',
                  fontWeight: 'bold',
                  fontSize: '0.875rem',
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5
                }}
              >
                <LocalFireDepartment fontSize="small" />
                POPULAR
              </Box>
            )}
          </Box>
          <Typography variant="subtitle1" color="text.secondary">
            Created by {owner?.username || 'Anonymous'}
          </Typography>
        </Box>
        {isViewer && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<ExitToApp />}
            onClick={handleLeaveRoom}
          >
            Leave Room
          </Button>
        )}
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="body1" sx={{ mb: 2 }}>
          {room.description}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {room.isPrivate && (
            <Chip
              icon={<Lock />}
              label="Private"
              color="default"
            />
          )}
          {room.isLive && (
            <Chip
              icon={<LiveTv />}
              label="LIVE"
              color="error"
            />
          )}
          {isPopular && (
            <Chip
              icon={<LocalFireDepartment />}
              label="POPULAR"
              color="warning"
            />
          )}
          {room.totalViews !== undefined && (
            <Chip
              label={`${room.totalViews} total views`}
              variant="outlined"
            />
          )}
        </Box>
      </Box>

      <Dialog open={showPasswordDialog} onClose={() => setShowPasswordDialog(false)}>
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
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPasswordDialog(false)}>Cancel</Button>
          <Button onClick={handlePasswordSubmit} variant="contained">
            Join
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SideRoom; 