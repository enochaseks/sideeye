import React, { useState } from 'react';
import { Container, Typography, Box, TextField, Button, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, Firestore } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

const CreateForum: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'forums'), {
        title: title.trim(),
        description: description.trim(),
        creatorId: currentUser.uid,
        createdAt: serverTimestamp(),
        members: [currentUser.uid],
        posts: 0
      });
      navigate('/forums');
    } catch (error) {
      console.error('Error creating forum:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Create Forum
        </Typography>

        <Paper sx={{ p: 3, mt: 2 }}>
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Forum Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
                disabled={isSubmitting || !title.trim() || !description.trim()}
              >
                {isSubmitting ? 'Creating...' : 'Create Forum'}
              </Button>
            </Box>
          </form>
        </Paper>
      </Box>
    </Container>
  );
};

export default CreateForum; 