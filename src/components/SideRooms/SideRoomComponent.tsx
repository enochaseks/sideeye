import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, FieldValue } from 'firebase/firestore';
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
  TextField
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

  useEffect(() => {
    if (!roomId) {
      setError('Room ID is required');
      setLoading(false);
      return;
    }

    const fetchRoom = async () => {
      try {
        const roomDoc = await getDoc(doc(db, 'sideRooms', roomId));
        if (!roomDoc.exists()) {
          setError('Room not found');
          setLoading(false);
          return;
        }

        const roomData = { ...roomDoc.data(), id: roomDoc.id } as SideRoom;
        setRoom(roomData);

        // Check if user is already a member
        const isMember = roomData.members?.some(member => member.userId === currentUser?.uid);
        if (!isMember && roomData.isPrivate) {
          setShowPasswordDialog(true);
        }
      } catch (err) {
        console.error('Error fetching room:', err);
        setError('Failed to fetch room data');
      } finally {
        setLoading(false);
      }
    };

    fetchRoom();
  }, [roomId, currentUser]);

  const handleJoinRoom = async () => {
    if (!room || !currentUser || !roomId) return;

    try {
      const roomRef = doc(db, 'sideRooms', roomId);
      const newMember: RoomMember = {
        userId: currentUser.uid,
        username: currentUser.displayName || 'Anonymous',
        avatar: currentUser.photoURL || '',
        role: 'member',
        joinedAt: new Date()
      };

      // First, update the members array
      await updateDoc(roomRef, {
        members: arrayUnion(newMember)
      });

      // Then, update the member count
      await updateDoc(roomRef, {
        memberCount: (room.memberCount || 0) + 1
      });

      setRoom(prev => prev ? { 
        ...prev, 
        members: [...(prev.members || []), newMember],
        memberCount: (prev.memberCount || 0) + 1
      } : null);
      toast.success('Joined room successfully');
      setShowPasswordDialog(false);
    } catch (err) {
      console.error('Error joining room:', err);
      toast.error('Failed to join room');
    }
  };

  const handleLeaveRoom = async () => {
    if (!room || !currentUser || !roomId) return;

    try {
      const roomRef = doc(db, 'sideRooms', roomId);
      const memberToRemove: RoomMember = {
        userId: currentUser.uid,
        username: currentUser.displayName || 'Anonymous',
        avatar: currentUser.photoURL || '',
        role: 'member',
        joinedAt: new Date()
      };

      // First, update the members array
      await updateDoc(roomRef, {
        members: arrayRemove(memberToRemove)
      });

      // Then, update the member count
      await updateDoc(roomRef, {
        memberCount: Math.max(0, (room.memberCount || 0) - 1)
      });

      setRoom(prev => prev ? { 
        ...prev, 
        members: prev.members?.filter(m => m.userId !== currentUser.uid) || [],
        memberCount: Math.max(0, (prev.memberCount || 0) - 1)
      } : null);
      toast.success('Left room successfully');
      navigate('/side-rooms');
    } catch (err) {
      console.error('Error leaving room:', err);
      toast.error('Failed to leave room');
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
        <Typography color="error">{error}</Typography>
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

export default SideRoomComponent; 