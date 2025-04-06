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

const FollowingList: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFollowing = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId!));
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserProfile;
          const followingList = userData.connections || [];
          
          // Fetch following details
          const followingPromises = followingList.map(async (followingId) => {
            const followingDoc = await getDoc(doc(db, 'users', followingId));
            if (followingDoc.exists()) {
              const followingData = followingDoc.data() as UserProfile;
              return {
                ...followingData,
                uid: followingId // Ensure uid is included
              };
            }
            return null;
          });
          
          const followingData = await Promise.all(followingPromises);
          setFollowing(followingData.filter(Boolean) as UserProfile[]);
        }
      } catch (err) {
        setError('Failed to load following');
        console.error('Error fetching following:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFollowing();
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
          Following
        </Typography>
        <List>
          {following.map((user) => (
            <ListItem
              key={user.uid}
              component={Link}
              to={`/profile/${user.uid}`}
              sx={{
                textDecoration: 'none',
                color: 'inherit',
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <ListItemAvatar>
                <Avatar src={user.profilePic || undefined} />
              </ListItemAvatar>
              <ListItemText
                primary={user.name}
                secondary={user.username}
              />
            </ListItem>
          ))}
          {following.length === 0 && (
            <Typography variant="body1" sx={{ mt: 2, textAlign: 'center' }}>
              Not following anyone yet
            </Typography>
          )}
        </List>
      </Box>
    </Container>
  );
};

export default FollowingList; 