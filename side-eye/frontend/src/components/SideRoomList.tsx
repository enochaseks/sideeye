import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  Divider,
  Button,
} from '@mui/material';
import { Add as AddIcon, People as PeopleIcon } from '@mui/icons-material';
import { db } from '../firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';

interface SideRoom {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  creatorId: string;
  createdAt: Date;
}

const SideRoomList: React.FC = () => {
  const [sideRooms, setSideRooms] = useState<SideRoom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSideRooms = async () => {
      try {
        const sideRoomsRef = collection(db, 'sideRooms');
        const q = query(sideRoomsRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const rooms = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate(),
        })) as SideRoom[];
        
        setSideRooms(rooms);
      } catch (error) {
        console.error('Error fetching side rooms:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSideRooms();
  }, []);

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Side Rooms</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {/* TODO: Implement create side room */}}
        >
          Create Room
        </Button>
      </Box>
      
      <List>
        {sideRooms.map((room) => (
          <React.Fragment key={room.id}>
            <ListItem
              secondaryAction={
                <IconButton edge="end" aria-label="join">
                  <PeopleIcon />
                </IconButton>
              }
            >
              <ListItemAvatar>
                <Avatar>{room.name[0]}</Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={room.name}
                secondary={
                  <>
                    <Typography component="span" variant="body2" color="text.primary">
                      {room.memberCount} members
                    </Typography>
                    {` — ${room.description}`}
                  </>
                }
              />
            </ListItem>
            <Divider variant="inset" component="li" />
          </React.Fragment>
        ))}
      </List>
    </Box>
  );
};

export default SideRoomList; 