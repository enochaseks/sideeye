import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  IconButton,
  Box,
  Button,
} from '@mui/material';
import { LocalFireDepartment, Schedule, Group, Add } from '@mui/icons-material';
import { TeaRoom } from '../../types';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useNavigate } from 'react-router-dom';

const TeaRoomList: React.FC = () => {
  const [teaRooms, setTeaRooms] = useState<TeaRoom[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, 'teaRooms'), orderBy('temperature', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rooms: TeaRoom[] = [];
      snapshot.forEach((doc) => {
        rooms.push({ id: doc.id, ...doc.data() } as TeaRoom);
      });
      setTeaRooms(rooms);
    });

    return () => unsubscribe();
  }, []);

  const getTemperatureColor = (temp: number) => {
    if (temp >= 80) return '#ff4444';
    if (temp >= 60) return '#ff8c00';
    if (temp >= 40) return '#ffd700';
    return '#90ee90';
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Tea Time Rooms 🫖
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Add />}
          onClick={() => navigate('/create-tea-room')}
        >
          Create Room
        </Button>
      </Box>

      <Box sx={{ 
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
        gap: 3
      }}>
        {teaRooms.map((room) => (
          <Box key={room.id}>
            <Card 
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6,
                  transition: 'all 0.2s ease-in-out',
                }
              }}
              onClick={() => navigate(`/tea-room/${room.id}`)}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {room.name}
                </Typography>
                
                <Chip 
                  label={room.category}
                  size="small"
                  sx={{ mb: 2 }}
                />

                <Box display="flex" alignItems="center" mb={1}>
                  <LocalFireDepartment 
                    sx={{ 
                      color: getTemperatureColor(room.temperature),
                      mr: 1 
                    }} 
                  />
                  <Typography variant="body2">
                    Tea Temperature: {room.temperature}°
                  </Typography>
                </Box>

                <LinearProgress 
                  variant="determinate" 
                  value={room.temperature}
                  sx={{
                    mb: 2,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#e0e0e0',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: getTemperatureColor(room.temperature),
                    },
                  }}
                />

                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box display="flex" alignItems="center">
                    <Group sx={{ mr: 0.5 }} />
                    <Typography variant="body2">
                      {room.activeUsers} active
                    </Typography>
                  </Box>

                  {room.scheduledReveals.length > 0 && (
                    <Box display="flex" alignItems="center">
                      <Schedule sx={{ mr: 0.5 }} />
                      <Typography variant="body2">
                        {room.scheduledReveals.length} reveals
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>
    </Container>
  );
};

export default TeaRoomList; 