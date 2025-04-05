import React, { useState } from 'react';
import { Container, Typography, Box, TextField, Button, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

const CreateTeaRoom: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !name.trim() || !description.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'tearooms'), {
        name: name.trim(),
        description: description.trim(),
        creatorId: currentUser.uid,
        createdAt: serverTimestamp(),
        members: [currentUser.uid],
        messages: 0
      });
      navigate('/tea-rooms');
    } catch (error) {
      console.error('Error creating tea room:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Create Tea Room
        </Typography>

        <Paper sx={{ p: 3, mt: 2 }}>
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Tea Room Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              margin="normal"
              required
            />
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                type="submit"
                disabled={isSubmitting || !name.trim() || !description.trim()}
              >
                {isSubmitting ? 'Creating...' : 'Create Tea Room'}
              </Button>
            </Box>
          </form>
        </Paper>
      </Box>
    </Container>
  );
};

export default CreateTeaRoom; 