import React, { useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Avatar,
  Typography,
  Skeleton,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { collection, query, orderBy, getDocs, where, or } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import CreateStory from './CreateStory';
import StoryViewer from './StoryViewer';

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

interface StoriesProps {
  following: string[];
}

const Stories: React.FC<StoriesProps> = ({ following }) => {
  const { currentUser } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);

  useEffect(() => {
    if (currentUser) {
      fetchStories();
    }
  }, [currentUser, following]);

  const fetchStories = async () => {
    try {
      setLoading(true);
      const storiesRef = collection(db, 'stories');
      
      // Create a query that gets stories from:
      // 1. Users the current user follows
      // 2. The current user's own stories
      const q = query(
        storiesRef,
        where('authorId', 'in', [...following, currentUser?.uid]),
        orderBy('timestamp', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const storiesData: Story[] = [];
      
      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        const authorDoc = await getDocs(collection(db, 'users'));
        const authorData = authorDoc.docs.find(d => d.id === data.authorId)?.data();
        
        if (authorData) {
          storiesData.push({
            id: doc.id,
            mediaUrl: data.mediaUrl,
            mediaType: data.mediaType,
            author: {
              name: authorData.name || 'Unknown User',
              avatar: authorData.avatar || '',
              username: authorData.username || '',
            },
            authorId: data.authorId,
            timestamp: data.timestamp.toDate(),
            expiresAt: data.expiresAt.toDate(),
            views: data.views || [],
          });
        }
      }
      setStories(storiesData);
    } catch (error) {
      console.error('Error fetching stories:', error);
      setError('Failed to load stories');
    } finally {
      setLoading(false);
    }
  };

  const handleStoryClick = (index: number) => {
    setSelectedStoryIndex(index);
    setShowStoryViewer(true);
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
        {/* Add Story Button */}
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
              src={currentUser?.photoURL || ''}
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

        {/* Stories List */}
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
              onClick={() => handleStoryClick(index)}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                minWidth: 80
              }}
            >
              <Avatar
                src={story.author.avatar}
                sx={{
                  width: 64,
                  height: 64,
                  border: '2px solid',
                  borderColor: story.views.includes(currentUser?.uid || '') ? 'grey.400' : 'primary.main'
                }}
              />
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