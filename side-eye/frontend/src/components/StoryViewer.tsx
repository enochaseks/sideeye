import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  IconButton,
  Dialog,
  DialogContent,
  Typography,
  Avatar,
  CircularProgress,
  Menu,
  MenuItem,
} from '@mui/material';
import { Close as CloseIcon, NavigateNext, NavigateBefore, MoreVert } from '@mui/icons-material';
import { collection, doc, updateDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

interface Story {
  id: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  author: {
    name: string;
    avatar: string;
    username: string;
  };
  authorId: string;
  timestamp: Date;
  expiresAt: Date;
  views: string[];
}

interface StoryViewerProps {
  stories: Story[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

const StoryViewer: React.FC<StoryViewerProps> = ({ stories, initialIndex, open, onClose }) => {
  const { currentUser } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const currentStory = stories[currentIndex];

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setProgress(0);
      setIsPaused(false);
    }
  }, [open, initialIndex]);

  useEffect(() => {
    if (!currentStory || !currentUser) return;

    // Mark story as viewed
    const markAsViewed = async () => {
      try {
        const storyRef = doc(db, 'stories', currentStory.id);
        await updateDoc(storyRef, {
          views: arrayUnion(currentUser.uid)
        });
      } catch (error) {
        console.error('Error marking story as viewed:', error);
      }
    };

    markAsViewed();
  }, [currentStory, currentUser]);

  useEffect(() => {
    if (!open || !currentStory || isPaused) return;

    const duration = 5000; // 5 seconds per story
    let startTime: number;
    let animationFrameId: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(newProgress);

      if (newProgress < 100) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        handleNext();
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [open, currentStory, isPaused]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
    }
  };

  const handleDeleteStory = async () => {
    if (!currentStory || !currentUser || currentStory.authorId !== currentUser.uid) return;

    try {
      await deleteDoc(doc(db, 'stories', currentStory.id));
      setMenuAnchor(null);
      handleNext();
    } catch (error) {
      console.error('Error deleting story:', error);
      setError('Failed to delete story');
    }
  };

  if (!currentStory) return null;

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          bgcolor: 'black',
          color: 'white'
        }
      }}
    >
      <Box
        sx={{
          position: 'relative',
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Progress bar */}
        <Box sx={{ 
          display: 'flex', 
          gap: 1, 
          p: 1,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1
        }}>
          {stories.map((_, index) => (
            <Box
              key={index}
              sx={{
                flex: 1,
                height: 2,
                bgcolor: 'rgba(255, 255, 255, 0.3)',
                borderRadius: 1,
                overflow: 'hidden'
              }}
            >
              <Box
                sx={{
                  width: `${index === currentIndex ? progress : index < currentIndex ? 100 : 0}%`,
                  height: '100%',
                  bgcolor: 'white',
                  transition: 'width 0.05s linear'
                }}
              />
            </Box>
          ))}
        </Box>

        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            p: 2,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1
          }}
        >
          <Avatar src={currentStory.author.avatar} />
          <Box sx={{ ml: 2, flex: 1 }}>
            <Typography variant="subtitle1">
              {currentStory.author.name}
            </Typography>
            <Typography variant="caption">
              {new Date(currentStory.timestamp).toLocaleTimeString()}
            </Typography>
          </Box>
          {currentStory.authorId === currentUser?.uid && (
            <>
              <IconButton 
                onClick={(e) => setMenuAnchor(e.currentTarget)} 
                color="inherit"
              >
                <MoreVert />
              </IconButton>
              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
              >
                <MenuItem onClick={handleDeleteStory}>Delete Story</MenuItem>
              </Menu>
            </>
          )}
          <IconButton onClick={onClose} color="inherit">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}
          onClick={() => setIsPaused(!isPaused)}
        >
          {currentStory.mediaType === 'video' ? (
            <video
              ref={videoRef}
              src={currentStory.mediaUrl}
              autoPlay
              loop
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
            />
          ) : (
            <img
              src={currentStory.mediaUrl}
              alt="Story"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
            />
          )}
        </Box>

        {/* Navigation */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 2
          }}
        >
          <IconButton
            onClick={handlePrevious}
            color="inherit"
            sx={{
              visibility: currentIndex > 0 ? 'visible' : 'hidden'
            }}
          >
            <NavigateBefore />
          </IconButton>
          <IconButton
            onClick={handleNext}
            color="inherit"
            sx={{
              visibility: currentIndex < stories.length - 1 ? 'visible' : 'hidden'
            }}
          >
            <NavigateNext />
          </IconButton>
        </Box>
      </Box>
    </Dialog>
  );
};

export default StoryViewer; 