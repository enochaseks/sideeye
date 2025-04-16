import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  IconButton,
  Typography,
  CircularProgress,
  Alert,
  Fade,
  Paper,
  ClickAwayListener,
  Avatar,
} from '@mui/material';
import {
  Close as CloseIcon,
  Image as ImageIcon,
  Send as SendIcon,
  PhotoCamera,
  EmojiEmotions,
  Delete,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';

const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
  '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
];

interface CreatePostDialogProps {
  open: boolean;
  onClose: () => void;
}

const CreatePostDialog: React.FC<CreatePostDialogProps> = ({ open, onClose }) => {
  const [content, setContent] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [characterCount, setCharacterCount] = useState(0);
  const MAX_CHARACTERS = 280;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentUser, userProfile } = useAuth();

  const validateContent = (text: string) => {
    if (text.length > MAX_CHARACTERS) {
      setError(`Post cannot exceed ${MAX_CHARACTERS} characters`);
      return false;
    }
    if (!text.trim() && !image) {
      setError('Post cannot be empty');
      return false;
    }
    return true;
  };

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

  const handleRemoveImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setError(null);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setContent(text);
    setCharacterCount(text.length);
    if (text.length > MAX_CHARACTERS) {
      setError(`Post cannot exceed ${MAX_CHARACTERS} characters`);
    } else {
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !db || !userProfile) {
      setError('Please sign in and ensure profile is loaded to create a post');
      return;
    }

    if (!content.trim()) {
      setError('Please enter some content');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let imageUrl = null;
      if (image) {
        const storageRef = ref(storage, `posts/${currentUser.uid}/${Date.now()}_${image.name}`);
        await uploadBytes(storageRef, image);
        imageUrl = await getDownloadURL(storageRef);
      }

      const postData = {
        content: content.trim(),
        authorId: currentUser.uid,
        userId: currentUser.uid,
        timestamp: serverTimestamp(),
        likes: 0,
        likedBy: [],
        authorName: userProfile.name || currentUser.displayName || 'Anonymous',
        authorAvatar: userProfile.profilePic || currentUser.photoURL || '',
        authorUsername: userProfile.username || currentUser.email?.split('@')[0] || 'user',
        ...(imageUrl && { imageUrl }),
        comments: [],
        tags: content.match(/#[a-zA-Z0-9_]+/g) || [],
        isPrivate: false,
        reposts: 0,
        repostedBy: [],
        views: 0,
        isPinned: false,
        isEdited: false,
        isArchived: false,
        deleted: false
      };

      await addDoc(collection(db, 'posts'), postData);
      toast.success('Post created successfully');
      setContent('');
      setImage(null);
      setImagePreview(null);
      setCharacterCount(0);
      onClose();
    } catch (error) {
      console.error('Error creating post:', error);
      setError('Failed to create post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmojiClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setShowEmojiPicker(true);
  };

  const handleEmojiClose = () => {
    setShowEmojiPicker(false);
  };

  const handleEmojiSelect = (emoji: string) => {
    if (characterCount + emoji.length > MAX_CHARACTERS) {
      setError(`Adding this emoji would exceed the ${MAX_CHARACTERS} character limit`);
      return;
    }
    setContent(prev => prev + emoji);
    setCharacterCount(prev => prev + emoji.length);
    setShowEmojiPicker(false);
    setError(null);
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '80vh',
        },
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            src={userProfile?.profilePic || currentUser?.photoURL || ''}
            alt={userProfile?.name || currentUser?.displayName || 'User'}
            sx={{ width: 40, height: 40 }}
          />
          <Box>
            <Typography variant="subtitle1" fontWeight="bold">
              {userProfile?.name || currentUser?.displayName || 'Anonymous'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              @{userProfile?.username || currentUser?.email?.split('@')[0] || 'user'}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            placeholder="What's on your mind?"
            value={content}
            onChange={handleContentChange}
            sx={{ mb: 2 }}
          />
          {imagePreview && (
            <Box sx={{ position: 'relative', mb: 2 }}>
              <img
                src={imagePreview}
                alt="Preview"
                style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '8px', objectFit: 'contain' }}
              />
              <IconButton
                onClick={handleRemoveImage}
                sx={{ 
                  position: 'absolute', 
                  top: 8, 
                  right: 8, 
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  '&:hover': {
                    backgroundColor: 'rgba(0,0,0,0.7)'
                  }
                }}
              >
                <Delete sx={{ color: 'white' }} />
              </IconButton>
            </Box>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }}
                ref={fileInputRef}
              />
              <IconButton onClick={() => fileInputRef.current?.click()}>
                <PhotoCamera />
              </IconButton>
              <IconButton onClick={handleEmojiClick}>
                <EmojiEmotions />
              </IconButton>
            </Box>
            <Button
              variant="contained"
              type="submit"
              disabled={(!content.trim() && !image) || loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Post'}
            </Button>
          </Box>
        </form>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreatePostDialog; 