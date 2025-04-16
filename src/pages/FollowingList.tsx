import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFirestore } from '../context/FirestoreContext';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
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

const FollowingList: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { db } = useFirestore();
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFollowing = async () => {
      if (!db || !userId) return;
      
      try {
        // Get the following subcollection
        const followingRef = collection(db, 'users', userId, 'following');
        const followingSnapshot = await getDocs(followingRef);
        console.log('Following snapshot size:', followingSnapshot.size);
        
        // Fetch following details
        const followingPromises = followingSnapshot.docs.map(async (followingDoc) => {
          const followingId = followingDoc.id;
          const userDoc = await getDoc(doc(db, 'users', followingId));
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
            return {
              ...userData,
              id: followingId
            };
          }
          return null;
        });

        const followingData = await Promise.all(followingPromises);
        setFollowing(followingData.filter(Boolean) as UserProfile[]);
      } catch (err) {
        setError('Failed to fetch following');
        console.error('Error fetching following:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFollowing();
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
        Following
      </Typography>
      <List>
        {following.map((user) => (
          <ListItem
            key={user.id}
            component={Link}
            to={`/profile/${user.id}`}
            sx={{
              textDecoration: 'none',
              color: 'inherit',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)'
              }
            }}
          >
            <ListItemAvatar>
              <Avatar src={user.profilePic} alt={user.username} />
            </ListItemAvatar>
            <ListItemText
              primary={user.username}
              secondary={user.name}
            />
          </ListItem>
        ))}
        {following.length === 0 && (
          <Typography variant="body1" color="text.secondary">
            Not following anyone yet
          </Typography>
        )}
      </List>
    </Box>
  );
};

export default FollowingList; 