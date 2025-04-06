import React, { useState, useRef } from 'react';
import {
  Card,
  CardContent,
  TextField,
  Button,
  Box,
  IconButton,
  Avatar,
  Popover,
  CircularProgress,
  Alert,
} from '@mui/material';
import { PhotoCamera, EmojiEmotions, Delete } from '@mui/icons-material';

const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
  '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
];

interface CreatePostProps {
  user: {
    name: string;
    avatar: string;
    username: string;
    isVerified: boolean;
  };
  onSubmit: (content: string, imageFile?: File) => Promise<void>;
}

const CreatePost: React.FC<CreatePostProps> = ({ onSubmit, user }) => {
  const [content, setContent] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Image size should be less than 5MB');
        return;
      }
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim() || image) {
      try {
        await onSubmit(content, image || undefined);
        setContent('');
        setImage(null);
        setImagePreview(null);
      } catch (error) {
        console.error('Error submitting post:', error);
      }
    }
  };

  const handleEmojiClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setEmojiAnchorEl(event.currentTarget);
  };

  const handleEmojiClose = () => {
    setEmojiAnchorEl(null);
  };

  const handleEmojiSelect = (emoji: string) => {
    setContent(prev => prev + emoji);
    setEmojiAnchorEl(null);
  };

  return (
    <Card sx={{ mb: 2, borderRadius: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Avatar 
            src={user?.avatar} 
            alt={user?.name || 'User'}
            sx={{ width: 40, height: 40 }}
          >
            {user?.name?.charAt(0) || 'U'}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <form onSubmit={handleSubmit} style={{ flex: 1 }}>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="What's on your mind?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                variant="outlined"
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
                  disabled={(!content.trim() && !image) || isLoading}
                >
                  {isLoading ? <CircularProgress size={24} /> : 'Post'}
                </Button>
              </Box>
            </form>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <Popover
          open={Boolean(emojiAnchorEl)}
          anchorEl={emojiAnchorEl}
          onClose={handleEmojiClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <Box sx={{ p: 2, maxWidth: 300 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 1 }}>
              {EMOJIS.map((emoji, index) => (
                <IconButton
                  key={index}
                  onClick={() => handleEmojiSelect(emoji)}
                  sx={{ fontSize: '1.5rem' }}
                >
                  {emoji}
                </IconButton>
              ))}
            </Box>
          </Box>
        </Popover>
      </CardContent>
    </Card>
  );
};

export default CreatePost;