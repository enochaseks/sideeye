import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  List, 
  ListItem, 
  ListItemAvatar, 
  ListItemText, 
  Avatar,
  Button,
  CircularProgress
} from '@mui/material';
import { Link, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { UserProfile } from '../types';

const FollowersList: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFollowers = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId!));
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserProfile;
          const followersList = userData.followers || [];
          
          // Fetch follower details
          const followerPromises = followersList.map(async (followerId) => {
            const followerDoc = await getDoc(doc(db, 'users', followerId));
            if (followerDoc.exists()) {
              const followerData = followerDoc.data() as UserProfile;
              return {
                ...followerData,
                uid: followerId // Ensure uid is included
              };
            }
            return null;
          });
          
          const followersData = await Promise.all(followerPromises);
          setFollowers(followersData.filter(Boolean) as UserProfile[]);
        }
      } catch (err) {
        setError('Failed to load followers');
        console.error('Error fetching followers:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFollowers();
  }, [userId]);

  if (loading) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography color="error">{error}</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          Followers
        </Typography>
        <List>
          {followers.map((follower) => (
            <ListItem
              key={follower.uid}
              component={Link}
              to={`/profile/${follower.uid}`}
              sx={{
                textDecoration: 'none',
                color: 'inherit',
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <ListItemAvatar>
                <Avatar src={follower.profilePic || undefined} />
              </ListItemAvatar>
              <ListItemText
                primary={follower.name}
                secondary={follower.username}
              />
            </ListItem>
          ))}
          {followers.length === 0 && (
            <Typography variant="body1" sx={{ mt: 2, textAlign: 'center' }}>
              No followers yet
            </Typography>
          )}
        </List>
      </Box>
    </Container>
  );
};

export default FollowersList; 