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
} from '@mui/material';
import { Add as AddIcon, Close as CloseIcon } from '@mui/icons-material';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../services/firebase';
import { collection, addDoc, serverTimestamp, getDoc, doc, query, orderBy, onSnapshot } from 'firebase/firestore';
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

const Stories: React.FC = () => {
  const { currentUser } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedStickers, setSelectedStickers] = useState<Sticker[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Default stickers
  const defaultStickers: Sticker[] = [
    { id: '1', url: '/stickers/heart.png', name: 'Heart', isCustom: false },
    { id: '2', url: '/stickers/star.png', name: 'Star', isCustom: false },
    { id: '3', url: '/stickers/fire.png', name: 'Fire', isCustom: false },
    { id: '4', url: '/stickers/cool.png', name: 'Cool', isCustom: false },
  ];

  // Fetch user profile
  useEffect(() => {
    if (!currentUser) return;

    const fetchUserProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
  }, [currentUser]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
      setOpen(true);
    }
  };

  const handleStickerSelect = (sticker: Sticker) => {
    setSelectedStickers(prev => [...prev, sticker]);
  };

  const handleCreateStory = async () => {
    if (!image || !currentUser) return;

    try {
      // Upload the image
      const storageRef = ref(storage, `stories/${Date.now()}_${image.name}`);
      await uploadBytes(storageRef, image);
      const imageUrl = await getDownloadURL(storageRef);

      // Create the story document
      const storyData = {
        imageUrl,
        author: {
          name: currentUser.displayName || 'Anonymous',
          avatar: userProfile?.profilePic || currentUser.photoURL || '',
          username: currentUser.email?.split('@')[0] || 'anonymous',
        },
        timestamp: serverTimestamp(),
        stickers: selectedStickers,
      };

      await addDoc(collection(db, 'stories'), storyData);
      
      setOpen(false);
      setImage(null);
      setImagePreview(null);
      setSelectedStickers([]);
    } catch (error) {
      console.error('Error creating story:', error);
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', py: 2, px: 1 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <IconButton
          onClick={() => fileInputRef.current?.click()}
          sx={{
            width: 64,
            height: 64,
            border: '2px dashed #ccc',
            '&:hover': { borderColor: 'primary.main' },
          }}
        >
          <AddIcon />
        </IconButton>
        <Typography variant="caption" sx={{ mt: 1 }}>
          Create Story
        </Typography>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          style={{ display: 'none' }}
          ref={fileInputRef}
        />
      </Box>

      {stories.map((story) => (
        <Box key={story.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Avatar
            src={story.author.avatar}
            sx={{
              width: 64,
              height: 64,
              border: '2px solid #1976d2',
            }}
          />
          <Typography variant="caption" sx={{ mt: 1 }}>
            {story.author.name}
          </Typography>
        </Box>
      ))}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Story</DialogTitle>
        <DialogContent>
          {imagePreview && (
            <Box sx={{ position: 'relative', mb: 2 }}>
              <img
                src={imagePreview}
                alt="Preview"
                style={{ width: '100%', borderRadius: '8px' }}
              />
              {selectedStickers.map((sticker, index) => (
                <img
                  key={index}
                  src={sticker.url}
                  alt={sticker.name}
                  style={{
                    position: 'absolute',
                    width: '50px',
                    height: '50px',
                    top: `${Math.random() * 50}%`,
                    left: `${Math.random() * 50}%`,
                  }}
                />
              ))}
            </Box>
          )}
          
          <Typography variant="h6" sx={{ mb: 2 }}>
            Add Stickers
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
            {defaultStickers.map((sticker) => (
              <Box
                key={sticker.id}
                onClick={() => handleStickerSelect(sticker)}
                sx={{
                  cursor: 'pointer',
                  p: 1,
                  border: '1px solid #ccc',
                  borderRadius: 1,
                  '&:hover': { borderColor: 'primary.main' },
                }}
              >
                <img
                  src={sticker.url}
                  alt={sticker.name}
                  style={{ width: '100%', height: 'auto' }}
                />
                <Typography variant="caption" display="block" textAlign="center">
                  {sticker.name}
                </Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateStory} variant="contained">
            Create Story
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Stories; 