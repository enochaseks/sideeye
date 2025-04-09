import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFirestore } from '../context/FirestoreContext';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  CircularProgress,
  Divider
} from '@mui/material';

const FollowersList: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { db } = useFirestore();
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFollowers = async () => {
      if (!db || !userId) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
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
                id: followerId
              };
            }
            return null;
          });

          const followersData = await Promise.all(followerPromises);
          setFollowers(followersData.filter(Boolean) as UserProfile[]);
        }
      } catch (err) {
        setError('Failed to fetch followers');
        console.error('Error fetching followers:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFollowers();
  }, [db, userId]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>
        Followers
      </Typography>
      <List>
        {followers.map((follower) => (
          <ListItem
            key={follower.id}
            component={Link}
            to={`/profile/${follower.id}`}
            sx={{
              textDecoration: 'none',
              color: 'inherit',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)'
              }
            }}
          >
            <ListItemAvatar>
              <Avatar src={follower.profilePic} alt={follower.username} />
            </ListItemAvatar>
            <ListItemText
              primary={follower.username}
              secondary={follower.name}
            />
          </ListItem>
        ))}
        {followers.length === 0 && (
          <Typography variant="body1" color="text.secondary">
            No followers yet
          </Typography>
        )}
      </List>
    </Box>
  );
};

export default FollowersList; 