import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Grid,
  Alert,
  CircularProgress,
  Skeleton,
} from '@mui/material';
import { Add as AddIcon, Close as CloseIcon } from '@mui/icons-material';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, getDb, storage } from '../services/firebase';
import { collection, addDoc, serverTimestamp, getDoc, doc, query, orderBy, onSnapshot, where, Firestore } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

interface Story {
  id: string;
  imageUrl: string;
  author: {
    name: string;
    avatar: string;
    username: string;
  };
  timestamp: Date;
}

interface Sticker {
  id: string;
  url: string;
  name: string;
  isCustom: boolean;
}

interface StoriesProps {
  following: string[];
}

const Stories: React.FC<StoriesProps> = ({ following }) => {
  const { currentUser } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedStickers, setSelectedStickers] = useState<Sticker[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [db, setDb] = useState<Firestore | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Default stickers
  const defaultStickers: Sticker[] = [
    { id: '1', url: '/stickers/heart.png', name: 'Heart', isCustom: false },
    { id: '2', url: '/stickers/star.png', name: 'Star', isCustom: false },
    { id: '3', url: '/stickers/fire.png', name: 'Fire', isCustom: false },
    { id: '4', url: '/stickers/cool.png', name: 'Cool', isCustom: false },
  ];

  // Initialize Firestore
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

  // Fetch user profile and stories
  useEffect(() => {
    if (!currentUser || !db) return;

    const fetchUserProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        setError('Failed to load user profile');
      }
    };

    const fetchStories = async () => {
      try {
        const storiesQuery = query(
          collection(db, 'stories'),
          where('authorId', 'in', [...following, currentUser.uid]),
          orderBy('timestamp', 'desc')
        );

        const unsubscribe = onSnapshot(storiesQuery, async (snapshot) => {
          try {
            const newStories = await Promise.all(snapshot.docs.map(async (storyDoc) => {
              const data = storyDoc.data();
              const authorDoc = await getDoc(doc(db, 'users', data.authorId));
              const authorData = authorDoc.data();
              
              return {
                id: storyDoc.id,
                imageUrl: data.imageUrl,
                author: {
                  name: authorData?.name || 'Anonymous',
                  avatar: authorData?.profilePic || '',
                  username: authorData?.username || ''
                },
                timestamp: data.timestamp?.toDate() || new Date()
              };
            }));
            
            setStories(newStories);
          } catch (error) {
            console.error('Error processing stories:', error);
            setError('Failed to load stories');
          }
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error setting up stories listener:', error);
        setError('Failed to load stories');
      }
    };

    fetchUserProfile();
    fetchStories();
  }, [currentUser, db, following]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Image size should be less than 5MB');
        return;
      }
      if (!file.type.match(/image\/(jpeg|png|gif)/)) {
        setError('Only JPEG, PNG, and GIF images are allowed');
        return;
      }
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleUploadStory = async () => {
    if (!currentUser || !db || !image) return;

    try {
      setIsLoading(true);
      setError(null);

      // Upload image to storage
      const storageRef = ref(storage, `stories/${currentUser.uid}/${Date.now()}_${image.name}`);
      await uploadBytes(storageRef, image);
      const imageUrl = await getDownloadURL(storageRef);

      // Create story document
      const storyData = {
        authorId: currentUser.uid,
        imageUrl,
        stickers: selectedStickers,
        timestamp: serverTimestamp(),
        views: 0
      };

      await addDoc(collection(db, 'stories'), storyData);
      
      // Reset form
      setImage(null);
      setImagePreview(null);
      setSelectedStickers([]);
      setOpen(false);
    } catch (error) {
      console.error('Error uploading story:', error);
      setError('Failed to upload story');
    } finally {
      setIsLoading(false);
    }
  };

  // Skeleton loader for stories
  if (!stories.length && !error) {
    return (
      <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', py: 2 }}>
        {/* Add Story Button - Always visible during loading */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          minWidth: '80px',
          flexShrink: 0
        }}>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            ref={fileInputRef}
            style={{ display: 'none' }}
          />
          <IconButton
            onClick={() => fileInputRef.current?.click()}
            sx={{
              width: 64,
              height: 64,
              border: '2px solid',
              borderColor: 'primary.main',
              bgcolor: 'background.paper',
              '&:hover': {
                borderColor: 'primary.dark',
                bgcolor: 'action.hover'
              }
            }}
          >
            <AddIcon color="primary" />
          </IconButton>
          <Typography variant="caption" sx={{ mt: 1, color: 'text.primary' }}>
            Add Story
          </Typography>
        </Box>

        {/* Skeleton loaders for other stories */}
        {[...Array(4)].map((_, index) => (
          <Box key={index} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Skeleton variant="circular" width={64} height={64} />
            <Skeleton variant="text" width={80} sx={{ mt: 1 }} />
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 3 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Box sx={{ 
        display: 'flex', 
        gap: 2, 
        overflowX: 'auto', 
        py: 2,
        '&::-webkit-scrollbar': {
          display: 'none'
        }
      }}>
        {/* Add Story Button - Always visible */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          minWidth: '80px',
          flexShrink: 0
        }}>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            ref={fileInputRef}
            style={{ display: 'none' }}
          />
          <IconButton
            onClick={() => fileInputRef.current?.click()}
            sx={{
              width: 64,
              height: 64,
              border: '2px solid',
              borderColor: 'primary.main',
              bgcolor: 'background.paper',
              '&:hover': {
                borderColor: 'primary.dark',
                bgcolor: 'action.hover'
              }
            }}
          >
            <AddIcon color="primary" />
          </IconButton>
          <Typography variant="caption" sx={{ mt: 1, color: 'text.primary' }}>
            Add Story
          </Typography>
        </Box>

        {/* Stories List */}
        {stories.length > 0 ? (
          stories.map((story) => (
            <Box
              key={story.id}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                minWidth: '80px',
                flexShrink: 0
              }}
              onClick={() => {/* Handle story view */}}
            >
              <Avatar
                src={story.author.avatar}
                alt={story.author.name}
                sx={{
                  width: 64,
                  height: 64,
                  border: '2px solid',
                  borderColor: 'primary.main'
                }}
              />
              <Typography variant="caption" sx={{ mt: 1, color: 'text.primary' }}>
                {story.author.username}
              </Typography>
            </Box>
          ))
        ) : (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            minWidth: '80px',
            flexShrink: 0
          }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              No stories yet
            </Typography>
          </Box>
        )}
      </Box>

      {/* Story Upload Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Story</DialogTitle>
        <DialogContent>
          {imagePreview && (
            <Box sx={{ mt: 2, mb: 2 }}>
              <img
                src={imagePreview}
                alt="Preview"
                style={{ width: '100%', height: 'auto', borderRadius: '8px' }}
              />
            </Box>
          )}
          {isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
              <CircularProgress />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={handleUploadStory}
            variant="contained"
            disabled={!image || isLoading}
          >
            Upload Story
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Stories; 