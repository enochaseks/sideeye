import React, { useState } from 'react';
import { Container, Typography, Box, TextField, Button, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

const CreatePost: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !content.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'posts'), {
        content: content.trim(),
        authorId: currentUser.uid,
        timestamp: serverTimestamp(),
        likes: [],
        comments: 0
      });
      navigate('/');
    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Create Post
        </Typography>

        <Paper sx={{ p: 3, mt: 2 }}>
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="What's on your mind?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              margin="normal"
              required
            />
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                type="submit"
                disabled={isSubmitting || !content.trim()}
              >
                {isSubmitting ? 'Posting...' : 'Post'}
              </Button>
            </Box>
          </form>
        </Paper>
      </Box>
    </Container>
  );
};

export default CreatePost; 