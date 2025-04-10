import React, { useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Avatar,
  Typography,
  Skeleton,
  Alert,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { collection, query, orderBy, where, doc, getDoc, getDocs, Timestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import CreateStory from './CreateStory';
import StoryViewer from './StoryViewer';
import { Story } from '../types/story';
import { Link } from 'react-router-dom';

interface StoriesProps {
  following: string[];
}

const Stories: React.FC<StoriesProps> = ({ following }) => {
  // State for previews of followed users shown in the list
  const [stories, setStories] = useState<Story[]>([]);
  // State to hold ALL fetched stories (own + followed)
  const [allFetchedStories, setAllFetchedStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  // State to hold the author ID whose stories we want to view
  const [viewingAuthorId, setViewingAuthorId] = useState<string | null>(null);
  const { currentUser, userProfile } = useAuth();

  // Function to handle opening the Story Viewer for a specific author
  const handleStoryClick = (authorId: string) => {
    setViewingAuthorId(authorId);
    setShowStoryViewer(true);
  };

  useEffect(() => {
    if (!currentUser) return;

    const storiesRef = collection(db, 'stories');
    const authorIdsToQuery = Array.from(new Set([...following, currentUser.uid]));

    if (authorIdsToQuery.length === 0) {
      setAllFetchedStories([]);
      setStories([]);
      setLoading(false);
      return;
    }

    const q = query(
      storiesRef,
      where('authorId', 'in', authorIdsToQuery),
      where('expiresAt', '>', Timestamp.now()),
      orderBy('authorId'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const allStoriesTemp: Story[] = [];
      const followedAuthorsAdded = new Set<string>();
      const followedStoriesPreviews: Story[] = [];

      querySnapshot.forEach((storyDoc) => {
        const storyData = storyDoc.data();
        if (!storyData.authorId || !storyData.timestamp || !storyData.expiresAt) return;

        const authorRef = doc(db, 'users', storyData.authorId);
        getDoc(authorRef).then((authorDoc) => {
          const authorData = authorDoc.data();
          if (authorData) {
            const fullStory: Story = {
              id: storyDoc.id,
              mediaUrl: storyData.mediaUrl,
              mediaType: storyData.mediaType,
              author: {
                name: authorData.name || '',
                avatar: authorData.avatar || '',
                username: authorData.username || ''
              },
              authorId: storyData.authorId,
              timestamp: storyData.timestamp.toDate(),
              expiresAt: storyData.expiresAt.toDate(),
              views: storyData.views || [],
              viewDetails: storyData.viewDetails?.map((view: any) => ({
                userId: view.userId,
                timestamp: view.timestamp.toDate()
              })) || []
            };

            allStoriesTemp.push(fullStory);

            if (storyData.authorId !== currentUser.uid && !followedAuthorsAdded.has(storyData.authorId)) {
              followedStoriesPreviews.push(fullStory);
              followedAuthorsAdded.add(storyData.authorId);
            }
          }
        });
      });

      setAllFetchedStories(allStoriesTemp);
      setStories(followedStoriesPreviews);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching stories:', err);
      setError('Failed to fetch stories.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, following]);

  // --- Click Handler for the User's Own Button ---
  const handleOwnButtonClick = () => {
      // Add null check for currentUser before accessing uid
      if (!currentUser) return;
      const currentUserHasStories = allFetchedStories.some(s => s.authorId === currentUser.uid);
      if (currentUserHasStories) {
          // Open viewer for current user's stories
          handleStoryClick(currentUser.uid);
      } else {
          // Open create dialog
          setShowCreateStory(true);
      }
  };

  // Check if the current user has stories to determine border style
  const currentUserHasStories = allFetchedStories.some(s => s.authorId === currentUser?.uid);
  // Check if the current user has viewed their own stories (if they exist)
  const currentUserStories = allFetchedStories.filter(s => s.authorId === currentUser?.uid);
  const hasViewedOwnStory = currentUserStories.some(s => s.views.includes(currentUser?.uid || ''));


  // --- RENDER LOGIC ---
  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2, '&::-webkit-scrollbar': { display: 'none' } }}>
        {currentUser && (
          <Box
            onClick={handleOwnButtonClick}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'pointer',
              minWidth: 80,
              textAlign: 'center'
            }}
          >
            <Box sx={{ position: 'relative', width: 64, height: 64, mb: 1 }}>
              <Avatar
                src={userProfile?.profilePic || currentUser.photoURL || ''}
                sx={{
                  width: '100%',
                  height: '100%',
                  border: '2px solid',
                  borderColor: currentUserHasStories ? (hasViewedOwnStory ? 'grey.400' : 'primary.main') : '#e0e0e0',
                  '&:hover': { opacity: 0.8 }
                }}
              />
              <IconButton
                onClick={() => setShowCreateStory(true)}
                size="small"
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  bgcolor: 'primary.main',
                  color: 'white',
                  border: '2px solid white',
                  '&:hover': { bgcolor: 'primary.dark' },
                  width: 22,
                  height: 22
                }}
              >
                <AddIcon sx={{ fontSize: '1rem' }} />
              </IconButton>
            </Box>
            <Typography variant="caption" sx={{ mt: 0.5 }}>
              {currentUserHasStories ? "Your Story" : "Add Story"}
            </Typography>
          </Box>
        )}

        {/* Loading/Error/Followed Story Previews */}
        {loading ? (
           Array(5).fill(0).map((_, index) => ( /* Skeleton remains the same */
             <Box key={index} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
               <Skeleton variant="circular" width={64} height={64} />
               <Skeleton variant="text" width={60} sx={{mt: 1}}/>
             </Box>
           ))
        ) : error ? (
           <Alert severity="error" sx={{ flexGrow: 1 }}>{error}</Alert>
        ) : stories.length === 0 && !loading && !currentUserHasStories ? ( // Show message only if no followed stories AND user has no stories
           <Typography variant="body2" sx={{ color: 'text.secondary', alignSelf: 'center', mx: 2 }}>No stories to show.</Typography>
        ) : (
          // Map through FOLLOWED user previews ONLY
          <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', p: 2, bgcolor: 'background.paper' }}>
            {stories.map((storyPreview) => (
              <Box
                key={storyPreview.authorId}
                sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80, textAlign: 'center' }}
              >
                <Avatar
                  src={storyPreview.author.avatar}
                  onClick={() => handleStoryClick(storyPreview.authorId)}
                  sx={{
                    width: 64, height: 64, cursor: 'pointer', mb: 1, border: '2px solid',
                    borderColor: storyPreview.views.includes(currentUser?.uid || '') ? 'grey.400' : 'primary.main',
                    '&:hover': { opacity: 0.8 }
                  }}
                />
                <Typography
                  variant="caption" component={Link} to={`/profile/${storyPreview.authorId}`}
                  sx={{ width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    cursor: 'pointer', color: 'inherit', textDecoration: 'none', '&:hover': { textDecoration: 'underline' }
                  }}
                >
                  {storyPreview.author.name}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Create Story Dialog */}
      <CreateStory
        open={showCreateStory}
        onClose={() => {
          setShowCreateStory(false);
        }}
      />

      {/* Story Viewer Dialog - Simplified filtering */}
      {showStoryViewer && viewingAuthorId && (
         <StoryViewer
           // Filter ALL stories based on the viewingAuthorId state
           stories={allFetchedStories.filter(s => s.authorId === viewingAuthorId)}
           initialIndex={0} // Start viewer at the first story for the selected author
           open={showStoryViewer}
           onClose={() => {
               setShowStoryViewer(false);
               setViewingAuthorId(null); // Reset viewing author ID
           }}
         />
      )}
    </Box>
  );
};

export default Stories; 