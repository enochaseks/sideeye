import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getDb } from '../../services/firebase';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, Firestore, onSnapshot } from 'firebase/firestore';
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

interface SideRoomProps {
  roomId: string;
}

const SideRoom: React.FC<SideRoomProps> = ({ roomId }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [db, setDb] = useState<Firestore | null>(null);
  const [room, setRoom] = useState<SideRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    const initializeDb = async () => {
      try {
        const firestore = await getDb();
        setDb(firestore);
      } catch (err) {
        console.error('Error initializing Firestore:', err);
        setError('Failed to initialize database');
      }
    };

    initializeDb();
  }, []);

  useEffect(() => {
    if (!db || !currentUser) {
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
            members: data.members || [],
            memberCount: data.memberCount || 0,
            createdAt: data.createdAt || new Date(),
            isPrivate: data.isPrivate || false,
            password: data.password || '',
            tags: data.tags || [],
            lastActive: data.lastActive || new Date(),
            maxMembers: data.maxMembers || 50,
            bannedUsers: data.bannedUsers || [],
            isLive: data.isLive || false,
            liveParticipants: data.liveParticipants || [],
            category: data.category || '',
            scheduledReveals: data.scheduledReveals || [],
            activeUsers: data.activeUsers || 0
          };
          setRoom(roomData);
          setLoading(false);

          // Check if user is already a member
          const isMember = roomData.members?.some(member => member.userId === currentUser.uid);
          if (!isMember && roomData.isPrivate) {
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
  }, [db, roomId, currentUser]);

  const handleJoinRoom = async () => {
    if (!db || !currentUser || !room) return;

    try {
      const roomRef = doc(db as Firestore, 'sideRooms', room.id);
      const newMember: RoomMember = {
        userId: currentUser.uid,
        username: currentUser.displayName || 'Anonymous',
        avatar: currentUser.photoURL || '',
        role: 'member',
        joinedAt: new Date()
      };

      await updateDoc(roomRef, {
        members: arrayUnion(newMember),
        memberCount: (room.memberCount || 0) + 1
      });

      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          members: [...(prev.members || []), newMember],
          memberCount: (prev.memberCount || 0) + 1
        };
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
      const roomRef = doc(db as Firestore, 'sideRooms', room.id);
      const memberToRemove: RoomMember = {
        userId: currentUser.uid,
        username: currentUser.displayName || 'Anonymous',
        avatar: currentUser.photoURL || '',
        role: 'member',
        joinedAt: new Date()
      };

      await updateDoc(roomRef, {
        members: arrayRemove(memberToRemove),
        memberCount: Math.max(0, (room.memberCount || 1) - 1)
      });

      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          members: prev.members.filter((m: RoomMember) => m.userId !== currentUser.uid),
          memberCount: Math.max(0, (prev.memberCount || 1) - 1)
        };
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

export default SideRoom; 