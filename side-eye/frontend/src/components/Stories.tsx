import React, { useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Avatar,
  Typography,
  Skeleton,
  CircularProgress,
  Alert,
  Fade,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { collection, query, orderBy, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import CreateStory from './CreateStory';
import StoryViewer from './StoryViewer';

interface Story {
  id: string;
  author: {
    id: string;
    name: string;
    avatar: string;
    username: string;
  };
  mediaUrl: string;
  mediaType: 'image' | 'video';
  timestamp: any;
  views: string[];
  authorId: string;
  expiresAt: any;
}

interface StoriesProps {
  following: string[];
}

const Stories: React.FC<StoriesProps> = ({ following }) => {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);
  const { currentUser, userProfile } = useAuth();

  const handleStoryClick = (story: Story) => {
    const index = stories.findIndex(s => s.id === story.id);
    setSelectedStoryIndex(index);
    setShowStoryViewer(true);
  };

  useEffect(() => {
    if (currentUser) {
      fetchStories();
    }
  }, [currentUser, following]);

  const fetchStories = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const storiesRef = collection(db, 'stories');
      const q = query(
        storiesRef,
        where('authorId', 'in', [...following, currentUser.uid]),
        orderBy('timestamp', 'desc')
      );

      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const storiesData: Story[] = [];
        
        for (const storyDoc of snapshot.docs) {
          const data = storyDoc.data();
          const authorDocRef = doc(db, 'users', data.authorId);
          const authorDoc = await getDoc(authorDocRef);
          const authorData = authorDoc.data() || {};

          storiesData.push({
            id: storyDoc.id,
            mediaUrl: data.mediaUrl,
            mediaType: data.mediaType,
            author: {
              id: data.authorId,
              name: authorData.name || 'Unknown User',
              avatar: authorData.avatar || '',
              username: authorData.username || '',
            },
            timestamp: data.timestamp,
            views: data.views || [],
            authorId: data.authorId,
            expiresAt: data.expiresAt,
          });
        }

        setStories(storiesData);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error fetching stories:', error);
      setError('Failed to load stories');
      setLoading(false);
    }
  };

  const renderStoryPreview = (story: Story) => {
    return (
      <Box
        sx={{
          position: 'relative',
          width: 64,
          height: 64,
          borderRadius: '50%',
          overflow: 'hidden',
          border: '2px solid',
          borderColor: story.views.includes(currentUser?.uid || '') ? 'grey.400' : 'primary.main',
        }}
      >
        {story.mediaType === 'image' ? (
          <Box
            component="img"
            src={story.mediaUrl}
            alt="Story preview"
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'brightness(0.7)',
              transition: 'filter 0.3s ease',
              '&:hover': {
                filter: 'brightness(0.9)',
              },
            }}
          />
        ) : (
          <Box
            component="video"
            src={story.mediaUrl}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'brightness(0.7)',
              transition: 'filter 0.3s ease',
              '&:hover': {
                filter: 'brightness(0.9)',
              },
            }}
          />
        )}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
          }}
        />
      </Box>
    );
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ 
        display: 'flex', 
        gap: 2, 
        overflowX: 'auto',
        pb: 2,
        '&::-webkit-scrollbar': {
          display: 'none'
        }
      }}>
        {currentUser && (
          <Box 
            onClick={() => setShowCreateStory(true)}
            sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              cursor: 'pointer',
              minWidth: 80
            }}
          >
            <Box
              sx={{
                position: 'relative',
                width: 64,
                height: 64,
                mb: 1
              }}
            >
              <Avatar
                src={userProfile?.profilePic || currentUser.photoURL || ''}
                sx={{
                  width: '100%',
                  height: '100%',
                  border: '2px solid #e0e0e0'
                }}
              />
              <IconButton
                sx={{
                  position: 'absolute',
                  bottom: -8,
                  right: -8,
                  bgcolor: 'primary.main',
                  color: 'white',
                  '&:hover': {
                    bgcolor: 'primary.dark'
                  },
                  width: 24,
                  height: 24,
                  fontSize: '1rem'
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Box>
            <Typography variant="caption" sx={{ textAlign: 'center' }}>
              Add Story
            </Typography>
          </Box>
        )}

        {loading ? (
          Array(5).fill(0).map((_, index) => (
            <Box key={index} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
              <Skeleton variant="circular" width={64} height={64} />
              <Skeleton variant="text" width={60} />
            </Box>
          ))
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          stories.map((story, index) => (
            <Box
              key={story.id}
              onClick={() => handleStoryClick(story)}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                minWidth: 80
              }}
            >
              {renderStoryPreview(story)}
              <Typography variant="caption" sx={{ mt: 1, textAlign: 'center' }}>
                {story.author.name}
              </Typography>
            </Box>
          ))
        )}
      </Box>

      <CreateStory
        open={showCreateStory}
        onClose={() => {
          setShowCreateStory(false);
          fetchStories();
        }}
      />

      <StoryViewer
        stories={stories}
        initialIndex={selectedStoryIndex}
        open={showStoryViewer}
        onClose={() => setShowStoryViewer(false)}
      />
    </Box>
  );
};

export default Stories; 