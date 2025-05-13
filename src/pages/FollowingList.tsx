import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFirestore } from '../context/FirestoreContext';
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, arrayUnion, arrayRemove, updateDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  CircularProgress,
  Divider,
  Button,
  IconButton,
  AppBar,
  Toolbar
} from '@mui/material';
import { ArrowBack, PersonAdd, PersonRemove } from '@mui/icons-material';
import { toast } from 'react-hot-toast';

const FollowingList: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { db } = useFirestore();
  const [following, setFollowing] = useState<(UserProfile & { isFollowing?: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFollowing = async () => {
      if (!db || !userId) return;
      
      try {
        // Get the following subcollection
        const followingRef = collection(db, 'users', userId, 'following');
        const followingSnapshot = await getDocs(followingRef);
        console.log('Following snapshot size:', followingSnapshot.size);
        
        // Get current user's following list to check follow status for each user
        let currentUserFollowing: string[] = [];
        if (currentUser) {
          const followingSnapshot = await getDocs(collection(db, 'users', currentUser.uid, 'following'));
          currentUserFollowing = followingSnapshot.docs.map(doc => doc.id);
        }
        
        // Fetch following details
        const followingPromises = followingSnapshot.docs.map(async (followingDoc) => {
          const followingId = followingDoc.id;
          const userDoc = await getDoc(doc(db, 'users', followingId));
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
            return {
              ...userData,
              id: followingId,
              isFollowing: currentUserFollowing.includes(followingId)
            };
          }
          return null;
        });

        const followingData = await Promise.all(followingPromises);
        setFollowing(followingData.filter(Boolean) as (UserProfile & { isFollowing?: boolean })[]);
      } catch (err) {
        setError('Failed to fetch following');
        console.error('Error fetching following:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFollowing();
  }, [db, userId, currentUser]);

  const handleFollow = async (targetUserId: string) => {
    if (!currentUser || !db) return;
    
    try {
      // Update following state optimistically
      setFollowing(prev => 
        prev.map(user => 
          user.id === targetUserId 
            ? { ...user, isFollowing: true } 
            : user
        )
      );

      // Add to current user's following collection
      await setDoc(doc(db, 'users', currentUser.uid, 'following', targetUserId), {
        createdAt: new Date()
      });
      
      // Add to target user's followers collection
      await setDoc(doc(db, 'users', targetUserId, 'followers', currentUser.uid), {
        createdAt: new Date()
      });
      
      // Update following array in user document
      await updateDoc(doc(db, 'users', currentUser.uid), {
        following: arrayUnion(targetUserId)
      });
      
      // Update followers array in target user document
      await updateDoc(doc(db, 'users', targetUserId), {
        followers: arrayUnion(currentUser.uid)
      });
      
      toast.success('Followed successfully');
    } catch (error) {
      console.error('Error following user:', error);
      toast.error('Failed to follow user');
      
      // Revert optimistic update
      setFollowing(prev => 
        prev.map(user => 
          user.id === targetUserId 
            ? { ...user, isFollowing: false } 
            : user
        )
      );
    }
  };

  const handleUnfollow = async (targetUserId: string) => {
    if (!currentUser || !db) return;
    
    try {
      // Update following state optimistically
      setFollowing(prev => 
        prev.map(user => 
          user.id === targetUserId 
            ? { ...user, isFollowing: false } 
            : user
        )
      );

      // Remove from current user's following collection
      await deleteDoc(doc(db, 'users', currentUser.uid, 'following', targetUserId));
      
      // Remove from target user's followers collection
      await deleteDoc(doc(db, 'users', targetUserId, 'followers', currentUser.uid));
      
      // Update following array in user document
      await updateDoc(doc(db, 'users', currentUser.uid), {
        following: arrayRemove(targetUserId)
      });
      
      // Update followers array in target user document
      await updateDoc(doc(db, 'users', targetUserId), {
        followers: arrayRemove(currentUser.uid)
      });
      
      toast.success('Unfollowed successfully');
    } catch (error) {
      console.error('Error unfollowing user:', error);
      toast.error('Failed to unfollow user');
      
      // Revert optimistic update
      setFollowing(prev => 
        prev.map(user => 
          user.id === targetUserId 
            ? { ...user, isFollowing: true } 
            : user
        )
      );
    }
  };

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
    <>
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          <IconButton edge="start" onClick={() => navigate(-1)} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Following
          </Typography>
        </Toolbar>
      </AppBar>
      
      <Box p={3}>
        <List>
          {following.map((user) => (
            <React.Fragment key={user.id}>
              <ListItem
                sx={{
                  py: 1.5,
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar 
                    src={user.profilePic} 
                    alt={user.username}
                    component={Link}
                    to={`/profile/${user.id}`}
                    sx={{ cursor: 'pointer' }}
                  />
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography 
                      component={Link} 
                      to={`/profile/${user.id}`}
                      sx={{ textDecoration: 'none', color: 'inherit', fontWeight: 'medium' }}
                    >
                      {user.username}
                    </Typography>
                  }
                  secondary={user.name}
                />
                {currentUser && user.id !== currentUser.uid && (
                  <ListItemSecondaryAction>
                    {user.isFollowing ? (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<PersonRemove />}
                        onClick={() => handleUnfollow(user.id)}
                        sx={{ borderRadius: 8 }}
                      >
                        Unfollow
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<PersonAdd />}
                        onClick={() => handleFollow(user.id)}
                        sx={{ borderRadius: 8 }}
                      >
                        Follow
                      </Button>
                    )}
                  </ListItemSecondaryAction>
                )}
              </ListItem>
              <Divider component="li" />
            </React.Fragment>
          ))}
          {following.length === 0 && (
            <Typography variant="body1" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
              Not following anyone yet
            </Typography>
          )}
        </List>
      </Box>
    </>
  );
};

export default FollowingList; 