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
  Fade,
  Paper,
  ClickAwayListener,
} from '@mui/material';
import { PhotoCamera, EmojiEmotions, Delete, Add } from '@mui/icons-material';

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
  const [isExpanded, setIsExpanded] = useState(false);
  const [characterCount, setCharacterCount] = useState(0);
  const MAX_CHARACTERS = 280;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

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
    if (!validateContent(content)) return;

    try {
      setIsLoading(true);
      setError(null);
      await onSubmit(content, image || undefined);
      setContent('');
      setImage(null);
      setImagePreview(null);
      setCharacterCount(0);
      setIsExpanded(false);
    } catch (error) {
      console.error('Error submitting post:', error);
      setError('Failed to create post. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmojiClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setEmojiAnchorEl(event.currentTarget);
  };

  const handleEmojiClose = () => {
    setEmojiAnchorEl(null);
  };

  const handleEmojiSelect = (emoji: string) => {
    if (characterCount + emoji.length > MAX_CHARACTERS) {
      setError(`Adding this emoji would exceed the ${MAX_CHARACTERS} character limit`);
      return;
    }
    setContent(prev => prev + emoji);
    setCharacterCount(prev => prev + emoji.length);
    setEmojiAnchorEl(null);
    setError(null);
  };

  const handleClickAway = () => {
    if (isExpanded && !content.trim() && !image) {
      setIsExpanded(false);
    }
  };

  return (
    <ClickAwayListener onClickAway={handleClickAway}>
      <Box sx={{ position: 'relative', mb: 2 }}>
        {!isExpanded ? (
          <IconButton
            onClick={() => setIsExpanded(true)}
            sx={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              width: 56,
              height: 56,
              backgroundColor: 'primary.main',
              color: 'white',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
              boxShadow: 3,
            }}
          >
            <Add />
          </IconButton>
        ) : (
          <Fade in={isExpanded}>
            <Paper
              ref={formRef}
              elevation={3}
              sx={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                width: 400,
                maxWidth: '90vw',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <Card>
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
                      <form onSubmit={handleSubmit}>
                        <TextField
                          fullWidth
                          multiline
                          rows={3}
                          placeholder="What's on your mind?"
                          value={content}
                          onChange={handleContentChange}
                          variant="outlined"
                          sx={{ mb: 2 }}
                          autoFocus
                          error={!!error}
                          helperText={`${characterCount}/${MAX_CHARACTERS}`}
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
                </CardContent>
              </Card>
            </Paper>
          </Fade>
        )}

        <Popover
          open={Boolean(emojiAnchorEl)}
          anchorEl={emojiAnchorEl}
          onClose={handleEmojiClose}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
        >
          <Box sx={{ p: 1, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 1 }}>
            {EMOJIS.map((emoji) => (
              <IconButton
                key={emoji}
                onClick={() => handleEmojiSelect(emoji)}
                sx={{ fontSize: '1.5rem' }}
              >
                {emoji}
              </IconButton>
            ))}
          </Box>
        </Popover>
      </Box>
    </ClickAwayListener>
  );
};

export default CreatePost;