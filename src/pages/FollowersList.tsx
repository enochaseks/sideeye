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

const FollowersList: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { db } = useFirestore();
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    const fetchFollowers = async () => {
      if (!db || !userId) {
        console.error('Firestore database or userId is not initialized');
        return;
      }
      console.log('Firestore database initialized:', db);
      console.log('User ID:', userId);

      try {
        // Check if the user can view the followers
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
          setError('User not found');
          return;
        }

        const userData = userDoc.data();
        const isPrivate = userData.isPrivate || false;
        const canView = !isPrivate || (currentUser && currentUser.uid === userId);

        if (!canView) {
          setError('This account is private. Follow to see their followers.');
          return;
        }

        // Get the followers subcollection
        const followersRef = collection(db, 'users', userId, 'followers');
        const followersSnapshot = await getDocs(followersRef);
        console.log('Followers snapshot size:', followersSnapshot.size);

        // Fetch follower details
        const followerPromises = followersSnapshot.docs.map(async (followerDoc) => {
          const followerId = followerDoc.id;
          const userDoc = await getDoc(doc(db, 'users', followerId));
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
            return {
              ...userData,
              id: followerId
            };
          }
          return null;
        });

        const followersData = await Promise.all(followerPromises);
        setFollowers(followersData.filter(Boolean) as UserProfile[]);
      } catch (err) {
        setError('Failed to fetch followers');
        console.error('Error fetching followers:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFollowers();
  }, [db, userId, currentUser]);

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
        {followers.map((user) => (
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