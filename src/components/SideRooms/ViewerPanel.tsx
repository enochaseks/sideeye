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
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Divider
} from '@mui/material';
import { PersonAdd, PersonRemove, Visibility } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { doc, collection, query, where, getDocs, addDoc, deleteDoc, onSnapshot, serverTimestamp, getDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';

interface Viewer {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  role: string;
  joinedAt: any;
}

interface ViewerPanelProps {
  roomId: string;
  isOwner: boolean;
}

const ViewerPanel: React.FC<ViewerPanelProps> = ({ roomId, isOwner }) => {
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddViewer, setShowAddViewer] = useState(false);
  const [newViewerId, setNewViewerId] = useState('');
  const { currentUser } = useAuth();

  useEffect(() => {
    const viewersRef = collection(db, 'sideRooms', roomId, 'viewers');
    const q = query(viewersRef);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const viewersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Viewer[];
      setViewers(viewersList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomId]);

  const handleAddViewer = async () => {
    if (!newViewerId.trim()) {
      toast.error('Please enter a user ID');
      return;
    }

    try {
      // Check if user exists
      const userRef = doc(db, 'users', newViewerId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        toast.error('User not found');
        return;
      }

      const userData = userDoc.data();
      const viewerData = {
        userId: newViewerId,
        username: userData.username || 'Anonymous',
        avatar: userData.avatar || '',
        role: 'viewer',
        joinedAt: serverTimestamp()
      };

      // Add to viewers subcollection
      await addDoc(collection(db, 'sideRooms', roomId, 'viewers'), viewerData);

      toast.success('Viewer added successfully');
      setShowAddViewer(false);
      setNewViewerId('');
    } catch (error) {
      console.error('Error adding viewer:', error);
      toast.error('Failed to add viewer');
    }
  };

  const handleRemoveViewer = async (viewerId: string) => {
    try {
      await deleteDoc(doc(db, 'sideRooms', roomId, 'viewers', viewerId));
      toast.success('Viewer removed successfully');
    } catch (error) {
      console.error('Error removing viewer:', error);
      toast.error('Failed to remove viewer');
    }
  };

  if (loading) {
    return <Typography>Loading viewers...</Typography>;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Viewers ({viewers.length})</Typography>
        {isOwner && (
          <Button
            variant="contained"
            startIcon={<PersonAdd />}
            onClick={() => setShowAddViewer(true)}
          >
            Add Viewer
          </Button>
        )}
      </Box>

      <List>
        {viewers.map((viewer) => (
          <ListItem
            key={viewer.id}
            secondaryAction={
              isOwner && (
                <Tooltip title="Remove Viewer">
                  <IconButton
                    edge="end"
                    onClick={() => handleRemoveViewer(viewer.id)}
                  >
                    <PersonRemove />
                  </IconButton>
                </Tooltip>
              )
            }
          >
            <ListItemAvatar>
              <Avatar src={viewer.avatar}>{viewer.username[0]}</Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={viewer.username}
              secondary={
                <Box display="flex" alignItems="center" gap={1}>
                  <Chip
                    icon={<Visibility />}
                    label="Viewer"
                    size="small"
                    color="default"
                  />
                </Box>
              }
            />
          </ListItem>
        ))}
        {viewers.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
            No viewers in this room
          </Typography>
        )}
      </List>

      <Dialog
        open={showAddViewer}
        onClose={() => setShowAddViewer(false)}
      >
        <DialogTitle>Add Viewer</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="User ID"
            fullWidth
            value={newViewerId}
            onChange={(e) => setNewViewerId(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddViewer(false)}>Cancel</Button>
          <Button onClick={handleAddViewer} variant="contained">
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ViewerPanel; 