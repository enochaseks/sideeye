import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  runTransaction,
  onSnapshot,
  FirestoreError
} from 'firebase/firestore';
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
import { ExitToApp, Lock, Group, LocalFireDepartment } from '@mui/icons-material';
import type { SideRoom, RoomMember } from '../../types/index';

const SideRoomComponent: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [room, setRoom] = useState<SideRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const mountedRef = useRef(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  const handleError = useCallback((err: unknown, defaultMessage: string) => {
    console.error(defaultMessage, err);
    if (mountedRef.current) {
      if (err instanceof FirestoreError) {
        setError(`Firestore error: ${err.message}`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(defaultMessage);
      }
    }
  }, []);

  useEffect(() => {
    if (!roomId) {
      setError('Room ID is required');
      setLoading(false);
      return;
    }

    // Set up real-time listener for room changes
    const roomRef = doc(db, 'sideRooms', roomId);
    const unsubscribe = onSnapshot(
      roomRef,
      (doc) => {
        if (!mountedRef.current) return;

        if (doc.exists()) {
          const roomData = { ...doc.data(), id: doc.id } as SideRoom;
          setRoom(roomData);

          // Check if user is already a member
          const isMember = roomData.members?.some(member => member.userId === currentUser?.uid);
          if (!isMember && roomData.isPrivate) {
            setShowPasswordDialog(true);
          }
        } else {
          setError('Room not found');
        }
        setLoading(false);
      },
      (err) => {
        handleError(err, 'Failed to fetch room data');
        setLoading(false);
      }
    );

    unsubscribeRef.current = unsubscribe;

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, [roomId, currentUser, handleError]);

  const handleJoinRoom = useCallback(async () => {
    if (!room || !currentUser || !roomId || isProcessing) return;

    try {
      setIsProcessing(true);
      const roomRef = doc(db, 'sideRooms', roomId);

      await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) {
          throw new Error('Room not found');
        }

        const roomData = roomDoc.data() as SideRoom;
        const newMember: RoomMember = {
          userId: currentUser.uid,
          username: currentUser.displayName || 'Anonymous',
          avatar: currentUser.photoURL || '',
          role: 'member',
          joinedAt: new Date()
        };

        // Update both members and memberCount atomically
        transaction.update(roomRef, {
          members: arrayUnion(newMember),
          memberCount: (roomData.memberCount || 0) + 1
        });
      });

      if (mountedRef.current) {
        toast.success('Joined room successfully');
        setShowPasswordDialog(false);
      }
    } catch (err) {
      handleError(err, 'Failed to join room');
    } finally {
      if (mountedRef.current) {
        setIsProcessing(false);
      }
    }
  }, [room, currentUser, roomId, isProcessing, handleError]);

  const handleLeaveRoom = useCallback(async () => {
    if (!room || !currentUser || !roomId || isProcessing) return;

    try {
      setIsProcessing(true);
      const roomRef = doc(db, 'sideRooms', roomId);

      await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) {
          throw new Error('Room not found');
        }

        const roomData = roomDoc.data() as SideRoom;
        const memberToRemove: RoomMember = {
          userId: currentUser.uid,
          username: currentUser.displayName || 'Anonymous',
          avatar: currentUser.photoURL || '',
          role: 'member',
          joinedAt: new Date()
        };

        // Update both members and memberCount atomically
        transaction.update(roomRef, {
          members: arrayRemove(memberToRemove),
          memberCount: Math.max(0, (roomData.memberCount || 0) - 1)
        });
      });

      if (mountedRef.current) {
        toast.success('Left room successfully');
        // Delay navigation to ensure the state is updated
        setTimeout(() => {
          if (mountedRef.current) {
            navigate('/side-rooms');
          }
        }, 100);
      }
    } catch (err) {
      handleError(err, 'Failed to leave room');
    } finally {
      if (mountedRef.current) {
        setIsProcessing(false);
      }
    }
  }, [room, currentUser, roomId, isProcessing, navigate, handleError]);

  const handlePasswordSubmit = useCallback(() => {
    if (room && password === room.password) {
      handleJoinRoom();
    } else {
      toast.error('Incorrect password');
    }
  }, [room, password, handleJoinRoom]);

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
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button onClick={() => navigate('/side-rooms')}>Back to Rooms</Button>
      </Box>
    );
  }

  if (!room) {
    return null;
  }

  const isMember = room.members?.some(member => member.userId === currentUser?.uid);
  const owner = room.members?.find(member => member.role === 'owner');

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1">
            {room.name}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Created by {owner?.username || 'Anonymous'}
          </Typography>
        </Box>
        {isMember && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<ExitToApp />}
            onClick={handleLeaveRoom}
            disabled={isProcessing}
          >
            {isProcessing ? 'Leaving...' : 'Leave Room'}
          </Button>
        )}
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="body1" sx={{ mb: 2 }}>
          {room.description}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            icon={<LocalFireDepartment />}
            label={room.isLive ? 'Live' : 'Offline'}
            color={room.isLive ? 'error' : 'success'}
          />
          <Chip
            icon={<Group />}
            label={`${room.memberCount || 0} members`}
          />
          {room.isPrivate && (
            <Chip
              icon={<Lock />}
              label="Private"
              color="default"
            />
          )}
        </Box>
      </Box>

      <Dialog 
        open={showPasswordDialog} 
        onClose={() => !isProcessing && setShowPasswordDialog(false)}
        disableEscapeKeyDown={isProcessing}
      >
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
            {isProcessing ? 'Joining...' : 'Join'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SideRoomComponent; 