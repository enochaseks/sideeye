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
  Collapse,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Paper,
} from '@mui/material';
import { 
  Close as CloseIcon, 
  NavigateNext as NextIcon, 
  NavigateBefore as PrevIcon, 
  MoreVert, 
  ExpandMore, 
  ExpandLess,
  PlayArrow,
  Pause
} from '@mui/icons-material';
import { collection, doc, updateDoc, deleteDoc, arrayUnion, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Story } from '../types/story';

interface StoryViewerProps {
  stories: Story[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

interface Viewer {
  userId: string;
  timestamp: Date;
  userAvatar?: string;
  userName?: string;
}

const StoryViewer: React.FC<StoryViewerProps> = ({ stories, initialIndex, open, onClose }) => {
  const { currentUser } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const progressInterval = useRef<NodeJS.Timeout>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const holdTimeoutRef = useRef<NodeJS.Timeout>();
  const navigate = useNavigate();

  const currentStory = stories[currentIndex];

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setProgress(0);
      setIsPaused(false);
      setShowViewers(false);
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
    if (!currentStory) return;

    const fetchViewers = async () => {
      try {
        const storyRef = doc(db, 'stories', currentStory.id);
        const unsubscribe = onSnapshot(storyRef, (doc) => {
          if (doc.exists()) {
            const data = doc.data();
            setViewers(data.viewDetails || []);
          }
        });

        return () => unsubscribe();
      } catch (err) {
        console.error('Error fetching viewers:', err);
      }
    };

    fetchViewers();
  }, [currentStory]);

  useEffect(() => {
    if (!open || !currentStory || isPaused) return;

    const startTime = Date.now();
    const duration = 5000; // 5 seconds per story

    progressInterval.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = (elapsed / duration) * 100;

      if (newProgress >= 100) {
        clearInterval(progressInterval.current);
        handleNext();
      } else {
        setProgress(newProgress);
      }
    }, 50);

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [open, currentStory, isPaused]);

  useEffect(() => {
    if (videoRef.current) {
      if (isPaused) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  }, [isPaused]);

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

  const handlePause = () => {
    setIsPaused(true);
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
  };

  const handleResume = () => {
    setIsPaused(false);
  };

  const handleClose = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
    onClose();
  };

  const handleTouchStart = () => {
    holdTimeoutRef.current = setTimeout(() => {
      setIsHolding(true);
      handlePause();
    }, 300); // 300ms hold time
  };

  const handleTouchEnd = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
    }
    if (isHolding) {
      setIsHolding(false);
      handleResume();
    }
  };

  const handleMouseDown = () => {
    holdTimeoutRef.current = setTimeout(() => {
      setIsHolding(true);
      handlePause();
    }, 300);
  };

  const handleMouseUp = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
    }
    if (isHolding) {
      setIsHolding(false);
      handleResume();
    }
  };

  useEffect(() => {
    return () => {
      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current);
      }
    };
  }, []);

  const handleProfileClick = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    onClose();
    navigate(`/profile/${userId}`);
  };

  if (!currentStory) return null;

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={handleClose}
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
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
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
          <IconButton onClick={handleClose} color="inherit">
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
            <PrevIcon />
          </IconButton>
          <IconButton
            onClick={handleNext}
            color="inherit"
            sx={{
              visibility: currentIndex < stories.length - 1 ? 'visible' : 'hidden'
            }}
          >
            <NextIcon />
          </IconButton>
        </Box>

        {/* Pause/Play button with hold indicator */}
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          {isHolding && (
            <Typography variant="caption" sx={{ color: 'white' }}>
              Holding to pause
            </Typography>
          )}
          <IconButton
            onClick={isPaused ? handleResume : handlePause}
            sx={{
              color: 'white',
              bgcolor: 'rgba(0, 0, 0, 0.3)',
              '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.5)' },
            }}
          >
            {isPaused ? <PlayArrow /> : <Pause />}
          </IconButton>
        </Box>

        {/* Author info with clickable profile */}
        <Box
          onClick={(e) => handleProfileClick(e, currentStory.authorId)}
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: 'rgba(0, 0, 0, 0.3)',
            p: 1,
            borderRadius: 1,
            cursor: 'pointer',
            '&:hover': {
              bgcolor: 'rgba(0, 0, 0, 0.5)',
            },
          }}
        >
          <Avatar 
            src={currentStory.author.avatar} 
            sx={{ 
              width: 32, 
              height: 32,
              border: '2px solid white',
            }} 
          />
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              {currentStory.author.name}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              @{currentStory.author.username}
            </Typography>
          </Box>
        </Box>

        {/* Viewers section */}
        <Paper
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            bgcolor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            borderRadius: 0,
          }}
        >
          <Box
            onClick={() => setShowViewers(!showViewers)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2,
              cursor: 'pointer',
            }}
          >
            <Typography variant="subtitle1">
              {viewers.length} {viewers.length === 1 ? 'view' : 'views'}
            </Typography>
            {showViewers ? <ExpandLess /> : <ExpandMore />}
          </Box>

          <Collapse in={showViewers}>
            <Divider sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }} />
            <List sx={{ maxHeight: 200, overflow: 'auto' }}>
              {viewers.map((viewer, index) => (
                <React.Fragment key={viewer.userId}>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar src={viewer.userAvatar || ''} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={viewer.userName || 'Anonymous User'}
                      secondary={formatDistanceToNow(viewer.timestamp, { addSuffix: true })}
                      secondaryTypographyProps={{ color: 'rgba(255, 255, 255, 0.7)' }}
                    />
                  </ListItem>
                  {index < viewers.length - 1 && (
                    <Divider sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }} />
                  )}
                </React.Fragment>
              ))}
            </List>
          </Collapse>
        </Paper>
      </Box>
    </Dialog>
  );
};

export default StoryViewer; 