import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
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
  CircularProgress
} from '@mui/material';
import { LocalFireDepartment, Schedule, Group, Add } from '@mui/icons-material';
import { SideRoom } from '../../types/index';
import CreateSideRoom from '../CreateSideRoom';

const SideRoomList: React.FC = () => {
  const [sideRooms, setSideRooms] = useState<SideRoom[]>([]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const q = query(collection(db, 'sideRooms'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rooms = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SideRoom[];
      setSideRooms(rooms);
    });

    return () => unsubscribe();
  }, []);

  const getStatusColor = (isLive: boolean) => {
    return isLive ? '#ff4444' : '#90ee90';
  };

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

      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          md: 'repeat(3, 1fr)'
        },
        gap: 3 
      }}>
        {sideRooms.map((room) => {
          const owner = room.members.find(member => member.role === 'owner');
          return (
            <Card key={room.id} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar src={owner?.avatar} alt={owner?.username} sx={{ mr: 1 }} />
                  <Box>
                    <Typography variant="h6">{room.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      by {owner?.username || 'Anonymous'}
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {room.description}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Chip
                    icon={<LocalFireDepartment />}
                    label={room.isLive ? 'Live' : 'Offline'}
                    color={room.isLive ? 'error' : 'success'}
                    size="small"
                  />
                  <Chip
                    icon={<Group />}
                    label={`${room.memberCount || 0} members`}
                    size="small"
                  />
                </Box>
              </CardContent>
              <CardActions>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => navigate(`/side-room/${room.id}`)}
                >
                  Join Room
                </Button>
              </CardActions>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
};

export default SideRoomList; 