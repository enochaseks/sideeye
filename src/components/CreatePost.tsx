import React, { useState, useRef } from 'react';
import {
  Card,
  CardContent,
  TextField,
  Button,
  Box,
  IconButton,
  Avatar,
  Typography,
  Popover,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { PhotoCamera, EmojiEmotions, Close, AddPhotoAlternate } from '@mui/icons-material';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Basic emoji list
const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
  '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
  '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
  '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
  '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯',
  '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
  '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈',
  '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾',
  '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿',
  '😾'
];

interface CreatePostProps {
  user: {
    name: string;
    avatar: string;
  };
  onSubmit: (content: string, imageUrl?: string) => void;
}

const CreatePost: React.FC<CreatePostProps> = ({ user, onSubmit }) => {
  const [content, setContent] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [stickerDialogOpen, setStickerDialogOpen] = useState(false);
  const [stickerImage, setStickerImage] = useState<File | null>(null);
  const [stickerPreview, setStickerPreview] = useState<string | null>(null);
  const [stickerName, setStickerName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleStickerImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setStickerImage(file);
      setStickerPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !image) return;

    let imageUrl: string | undefined = undefined;

    if (image) {
      try {
        const storageRef = ref(storage, `posts/${auth.currentUser?.uid}/${Date.now()}_${image.name}`);
        await uploadBytes(storageRef, image);
        imageUrl = await getDownloadURL(storageRef);
      } catch (error) {
        console.error('Error uploading image:', error);
        return;
      }
    }

    onSubmit(content, imageUrl);
    setContent('');
    setImage(null);
    setImagePreview(null);
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

  const handleCreateSticker = async () => {
    if (!stickerImage || !stickerName.trim()) return;

    try {
      const storageRef = ref(storage, `stickers/${Date.now()}_${stickerImage.name}`);
      await uploadBytes(storageRef, stickerImage);
      const stickerUrl = await getDownloadURL(storageRef);

      // Add the sticker to the content
      setContent(prev => prev + `[sticker:${stickerName}]`);
      
      setStickerDialogOpen(false);
      setStickerImage(null);
      setStickerPreview(null);
      setStickerName('');
    } catch (error) {
      console.error('Error creating sticker:', error);
    }
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
                  style={{ maxWidth: '100%', borderRadius: '8px' }}
                />
                <IconButton
                  onClick={() => {
                    setImage(null);
                    setImagePreview(null);
                  }}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    },
                  }}
                >
                  <Close sx={{ color: 'white' }} />
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
                <IconButton onClick={() => setStickerDialogOpen(true)}>
                  <AddPhotoAlternate />
                </IconButton>
              </Box>
              <Button
                variant="contained"
                type="submit"
                disabled={!content.trim() && !image}
              >
                Post
              </Button>
            </Box>
          </form>
        </Box>

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

        <Dialog open={stickerDialogOpen} onClose={() => setStickerDialogOpen(false)}>
          <DialogTitle>Create Sticker</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <input
                type="file"
                accept="image/*"
                onChange={handleStickerImageChange}
                style={{ display: 'none' }}
                ref={stickerInputRef}
              />
              <Button
                variant="outlined"
                onClick={() => stickerInputRef.current?.click()}
                startIcon={<AddPhotoAlternate />}
              >
                Upload Sticker Image
              </Button>
              
              {stickerPreview && (
                <Box sx={{ position: 'relative' }}>
                  <img
                    src={stickerPreview}
                    alt="Sticker Preview"
                    style={{ maxWidth: '100%', borderRadius: '8px' }}
                  />
                  <IconButton
                    onClick={() => {
                      setStickerImage(null);
                      setStickerPreview(null);
                    }}
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                      },
                    }}
                  >
                    <Close sx={{ color: 'white' }} />
                  </IconButton>
                </Box>
              )}

              <TextField
                label="Sticker Name"
                value={stickerName}
                onChange={(e) => setStickerName(e.target.value)}
                fullWidth
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStickerDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreateSticker}
              variant="contained"
              disabled={!stickerImage || !stickerName.trim()}
            >
              Create Sticker
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default CreatePost; 