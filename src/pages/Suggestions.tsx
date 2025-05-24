import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Snackbar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import {
  Send as SendIcon,
  Lightbulb as LightbulbIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  doc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
  getDoc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { formatDistanceToNow } from 'date-fns';

interface Suggestion {
  id: string;
  title: string;
  description: string;
  category: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  upvotes: string[];
  downvotes: string[];
  status: 'pending' | 'under_review' | 'in_progress' | 'completed' | 'rejected';
  createdAt: any;
}

const Suggestions: React.FC = () => {
  const { currentUser } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserData, setCurrentUserData] = useState<{username?: string; name?: string; profilePic?: string}>({});
  
  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  
  // UI states
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info'>('success');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [suggestionToDelete, setSuggestionToDelete] = useState<string | null>(null);

  const categories = [
    'New Features',
    'UI/UX Improvements',
    'Performance',
    'Bug Reports',
    'Content & Media',
    'Social Features',
    'Security & Privacy',
    'Other'
  ];

  const statusColors = {
    pending: 'default',
    under_review: 'warning',
    in_progress: 'info',
    completed: 'success',
    rejected: 'error'
  } as const;

  useEffect(() => {
    // Fetch suggestions from Firestore
    const suggestionsRef = collection(db, 'suggestions');
    const q = query(suggestionsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const suggestionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Suggestion[];
      
      setSuggestions(suggestionsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch current user's profile data from Firestore
  useEffect(() => {
    if (!currentUser) return;
    
    const fetchUserData = async () => {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setCurrentUserData({
            username: userData.username,
            name: userData.name,
            profilePic: userData.profilePic || userData.photoURL
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };
    
    fetchUserData();
  }, [currentUser]);

  const handleSubmitSuggestion = async () => {
    if (!currentUser || !title.trim() || !description.trim() || !category) {
      setSnackbarMessage('Please fill in all fields');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'suggestions'), {
        title: title.trim(),
        description: description.trim(),
        category,
        authorId: currentUser.uid,
        authorName: currentUserData.name || currentUserData.username || currentUser.displayName || 'Anonymous User',
        authorAvatar: currentUserData.profilePic || currentUser.photoURL || '',
        upvotes: [],
        downvotes: [],
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // Reset form
      setTitle('');
      setDescription('');
      setCategory('');
      
      setSnackbarMessage('Suggestion submitted successfully!');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      
      // Trigger lightbulb glow effect immediately and via localStorage backup
      localStorage.setItem('suggestionSubmitted', 'true');
      window.dispatchEvent(new CustomEvent('suggestionSubmittedImmediate'));
      
    } catch (error) {
      console.error('Error submitting suggestion:', error);
      setSnackbarMessage('Failed to submit suggestion');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (suggestionId: string, voteType: 'upvote' | 'downvote') => {
    if (!currentUser) return;

    try {
      const suggestionRef = doc(db, 'suggestions', suggestionId);
      const suggestion = suggestions.find(s => s.id === suggestionId);
      
      if (!suggestion) return;

      const hasUpvoted = suggestion.upvotes.includes(currentUser.uid);
      const hasDownvoted = suggestion.downvotes.includes(currentUser.uid);

      if (voteType === 'upvote') {
        if (hasUpvoted) {
          // Remove upvote
          await updateDoc(suggestionRef, {
            upvotes: arrayRemove(currentUser.uid)
          });
        } else {
          // Add upvote and remove downvote if exists
          const updates: any = {
            upvotes: arrayUnion(currentUser.uid)
          };
          if (hasDownvoted) {
            updates.downvotes = arrayRemove(currentUser.uid);
          }
          await updateDoc(suggestionRef, updates);
        }
      } else {
        if (hasDownvoted) {
          // Remove downvote
          await updateDoc(suggestionRef, {
            downvotes: arrayRemove(currentUser.uid)
          });
        } else {
          // Add downvote and remove upvote if exists
          const updates: any = {
            downvotes: arrayUnion(currentUser.uid)
          };
          if (hasUpvoted) {
            updates.upvotes = arrayRemove(currentUser.uid);
          }
          await updateDoc(suggestionRef, updates);
        }
      }
    } catch (error) {
      console.error('Error voting:', error);
      setSnackbarMessage('Failed to register vote');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleDeleteSuggestion = async () => {
    if (!suggestionToDelete || !currentUser) return;

    try {
      await deleteDoc(doc(db, 'suggestions', suggestionToDelete));
      setSnackbarMessage('Suggestion deleted successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error deleting suggestion:', error);
      setSnackbarMessage('Failed to delete suggestion');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setDeleteDialogOpen(false);
      setSuggestionToDelete(null);
    }
  };

  const openDeleteDialog = (suggestionId: string) => {
    setSuggestionToDelete(suggestionId);
    setDeleteDialogOpen(true);
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LightbulbIcon fontSize="large" color="primary" />
          Suggestions
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
          Help us improve SideEye by sharing your ideas and suggestions!
        </Typography>

        {/* Submit Suggestion Form */}
        <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Submit a New Suggestion
          </Typography>
          
          <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Suggestion Title"
              variant="outlined"
              fullWidth
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief title for your suggestion..."
              disabled={submitting}
            />

            <FormControl fullWidth disabled={submitting}>
              <InputLabel>Category</InputLabel>
              <Select
                value={category}
                label="Category"
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Description"
              variant="outlined"
              fullWidth
              multiline
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your suggestion in detail..."
              disabled={submitting}
            />

            <Button
              variant="contained"
              startIcon={submitting ? <CircularProgress size={20} /> : <SendIcon />}
              onClick={handleSubmitSuggestion}
              disabled={submitting || !title.trim() || !description.trim() || !category}
              sx={{ alignSelf: 'flex-start' }}
            >
              {submitting ? 'Submitting...' : 'Submit Suggestion'}
            </Button>
          </Box>
        </Paper>

        {/* Suggestions List */}
        <Typography variant="h6" gutterBottom>
          Community Suggestions
        </Typography>
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : suggestions.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              No suggestions yet. Be the first to share your ideas!
            </Typography>
          </Paper>
        ) : (
          <List sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
            {suggestions.map((suggestion, index) => (
              <React.Fragment key={suggestion.id}>
                <ListItem alignItems="flex-start" sx={{ py: 2 }}>
                  <ListItemAvatar>
                    <Avatar src={suggestion.authorAvatar} alt={suggestion.authorName}>
                      {suggestion.authorName.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="h6" component="span">
                          {suggestion.title}
                        </Typography>
                        <Chip
                          label={suggestion.category}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          label={suggestion.status.replace('_', ' ')}
                          size="small"
                          color={statusColors[suggestion.status]}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.primary" sx={{ mb: 1 }}>
                          {suggestion.description}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              By {suggestion.authorName} • {suggestion.createdAt && formatDistanceToNow(suggestion.createdAt.toDate(), { addSuffix: true })}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <IconButton
                                size="small"
                                onClick={() => handleVote(suggestion.id, 'upvote')}
                                color={suggestion.upvotes.includes(currentUser?.uid || '') ? 'primary' : 'default'}
                                disabled={!currentUser}
                              >
                                <ThumbUpIcon fontSize="small" />
                              </IconButton>
                              <Typography variant="caption">
                                {suggestion.upvotes.length}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <IconButton
                                size="small"
                                onClick={() => handleVote(suggestion.id, 'downvote')}
                                color={suggestion.downvotes.includes(currentUser?.uid || '') ? 'error' : 'default'}
                                disabled={!currentUser}
                              >
                                <ThumbDownIcon fontSize="small" />
                              </IconButton>
                              <Typography variant="caption">
                                {suggestion.downvotes.length}
                              </Typography>
                            </Box>
                            {currentUser?.uid === suggestion.authorId && (
                              <IconButton
                                size="small"
                                onClick={() => openDeleteDialog(suggestion.id)}
                                color="error"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
                {index < suggestions.length - 1 && <Box sx={{ borderBottom: 1, borderColor: 'divider', mx: 2 }} />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">
          Delete Suggestion?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this suggestion? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteSuggestion} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={snackbarSeverity} 
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Suggestions; 