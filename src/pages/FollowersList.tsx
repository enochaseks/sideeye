import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFirestore } from '../context/FirestoreContext';
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, arrayUnion, arrayRemove, updateDoc, onSnapshot } from 'firebase/firestore';
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

const FollowersList: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { db } = useFirestore();
  const [followers, setFollowers] = useState<(UserProfile & { isFollowing?: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!db || !userId) {
      console.error('Firestore database or userId is not initialized');
      return;
    }

    // Check if the user can view the followers
    const fetchUserData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
          setError('User not found');
          setLoading(false);
          return false;
        }

        const userData = userDoc.data();
        const isPrivate = userData.isPrivate || false;
        
        // If account is not private or current user is the account owner, they can view
        if (!isPrivate || (currentUser && currentUser.uid === userId)) {
          return true;
        }
        
        // For private accounts, check if current user is a follower
        if (currentUser) {
          // Check if current user is in followers collection of the target user
          const followerDocRef = doc(db, 'users', userId, 'followers', currentUser.uid);
          const followerDoc = await getDoc(followerDocRef);
          
          if (followerDoc.exists()) {
            // Current user is a follower, can view
            return true;
          }
        }
        
        // Current user is not a follower of the private account
        setError('This account is private. Follow to see their followers.');
        setLoading(false);
        return false;
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError('Failed to fetch user data');
        setLoading(false);
        return false;
      }
    };

    const setupRealTimeUpdates = async () => {
      const canProceed = await fetchUserData();
      if (!canProceed) return null;

      // Get the followers subcollection with real-time updates
      const followersRef = collection(db, 'users', userId, 'followers');
      return onSnapshot(followersRef, async (followersSnapshot) => {
        console.log('Real-time update - Followers snapshot size:', followersSnapshot.size);
        
        // If already loaded once, show refreshing indicator instead of full loading
        if (!loading) {
          setRefreshing(true);
        }
        
        try {
          // Get current user's following list to check follow status for each user
          let currentUserFollowing: string[] = [];
          if (currentUser) {
            const followingSnapshot = await getDocs(collection(db, 'users', currentUser.uid, 'following'));
            currentUserFollowing = followingSnapshot.docs.map(doc => doc.id);
          }

          // Fetch follower details
          const followerPromises = followersSnapshot.docs.map(async (followerDoc) => {
            const followerId = followerDoc.id;
            const userDoc = await getDoc(doc(db, 'users', followerId));
            if (userDoc.exists()) {
              const userData = userDoc.data() as UserProfile;
              return {
                ...userData,
                id: followerId,
                isFollowing: currentUserFollowing.includes(followerId)
              };
            }
            return null;
          });

          const followersData = await Promise.all(followerPromises);
          setFollowers(followersData.filter(Boolean) as (UserProfile & { isFollowing?: boolean })[]);
          setLoading(false);
          setRefreshing(false);
        } catch (err) {
          setError('Failed to fetch followers');
          console.error('Error fetching followers:', err);
          setLoading(false);
          setRefreshing(false);
        }
      }, (err) => {
        console.error('Error in followers snapshot listener:', err);
        setError('Failed to listen for followers updates');
        setLoading(false);
        setRefreshing(false);
      });
    };

    let unsubscribe: (() => void) | null = null;
    
    // Initialize the listener
    setupRealTimeUpdates().then(unsub => {
      unsubscribe = unsub;
    }).catch(err => {
      console.error('Error setting up followers updates:', err);
    });
    
    // Return cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [db, userId, currentUser]);

  const handleFollow = async (targetUserId: string) => {
    if (!currentUser || !db) return;
    
    try {
      // Update followers state optimistically
      setFollowers(prev => 
        prev.map(user => 
          user.id === targetUserId 
            ? { ...user, isFollowing: true } 
            : user
        )
      );

      setRefreshing(true);
      
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
      setRefreshing(false);
    } catch (error) {
      console.error('Error following user:', error);
      toast.error('Failed to follow user');
      
      // Revert optimistic update
      setFollowers(prev => 
        prev.map(user => 
          user.id === targetUserId 
            ? { ...user, isFollowing: false } 
            : user
        )
      );
      setRefreshing(false);
    }
  };

  const handleUnfollow = async (targetUserId: string) => {
    if (!currentUser || !db) return;
    
    try {
      // Update followers state optimistically
      setFollowers(prev => 
        prev.map(user => 
          user.id === targetUserId 
            ? { ...user, isFollowing: false } 
            : user
        )
      );

      setRefreshing(true);
      
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
      setRefreshing(false);
    } catch (error) {
      console.error('Error unfollowing user:', error);
      toast.error('Failed to unfollow user');
      
      // Revert optimistic update
      setFollowers(prev => 
        prev.map(user => 
          user.id === targetUserId 
            ? { ...user, isFollowing: true } 
            : user
        )
      );
      setRefreshing(false);
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
            Followers
          </Typography>
          {refreshing && <CircularProgress size={24} sx={{ mr: 2 }} />}
        </Toolbar>
      </AppBar>
      
      <Box p={3}>
        <List>
          {followers.map((user) => (
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
          {followers.length === 0 && (
            <Typography variant="body1" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
              No followers yet
            </Typography>
          )}
        </List>
      </Box>
    </>
  );
};

export default FollowersList; 