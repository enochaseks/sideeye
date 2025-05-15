import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Alert,
  TextField,
  CircularProgress
} from '@mui/material';
import {
  WarningAmber as WarningIcon,
  Pause as PauseIcon,
  DeleteForever as DeleteIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc, deleteDoc, collection, query, getDocs, where, writeBatch, arrayRemove, getDoc } from 'firebase/firestore';
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential, getAuth } from 'firebase/auth';
import { db } from '../services/firebase';
import { toast } from 'react-hot-toast';

const DeletionDeactivatePage: React.FC = () => {
  const { currentUser: contextUser, logout } = useAuth();
  const navigate = useNavigate();
  
  const [openDeactivateDialog, setOpenDeactivateDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [confirmDeleteDialog, setConfirmDeleteDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteProgress, setDeleteProgress] = useState<string | null>(null);

  // Function to handle account deactivation
  const handleDeactivateAccount = async () => {
    if (!contextUser) {
      setError('You must be logged in to deactivate your account');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Update the user document to mark it as deactivated
      const userRef = doc(db, 'users', contextUser.uid);
      await updateDoc(userRef, {
        isActive: false,
        deactivatedAt: new Date().toISOString()
      });

      // Log the user out
      await logout();
      toast.success('Your account has been deactivated. You can reactivate it by logging in again.');
      navigate('/login');
    } catch (err) {
      console.error('Error deactivating account:', err);
      setError('Failed to deactivate account. Please try again.');
    } finally {
      setLoading(false);
      setOpenDeactivateDialog(false);
    }
  };

  // Function to handle account deletion
  const handleDeleteAccount = async () => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      setError('You must be logged in to delete your account');
      toast.error('Authentication error. Please log in again.');
      return;
    }

    if (!password) {
      setError('Please enter your password to confirm deletion');
      return;
    }

    setLoading(true);
    setError(null);
    setDeleteProgress('Authenticating...');

    try {
      if (!user.email) {
        throw new Error("User email is not available for re-authentication.");
      }
      const credential = EmailAuthProvider.credential(
        user.email,
        password
      );
      
      await reauthenticateWithCredential(user, credential);
      console.log("Re-authentication successful");

      // Manually perform cleanup before deleting user
      setDeleteProgress('Cleaning up your data...');
      await cleanupUserData(user.uid);

      // Delete user document after cleanup
      setDeleteProgress('Deleting user profile...');
      const userRef = doc(db, 'users', user.uid);
      await deleteDoc(userRef);
      console.log("Firestore user document deleted");

      // Delete Firebase Auth user
      setDeleteProgress('Finalizing account deletion...');
      await deleteUser(user);
      console.log("Firebase Auth user deleted");
      
      toast.success('Your account has been permanently deleted.');
      navigate('/login');
    } catch (err: any) {
      console.error('Error deleting account:', err);
      if (err.code === 'auth/wrong-password' || err.message.includes('auth/wrong-password')) {
        setError('Incorrect password. Please try again.');
        toast.error('Incorrect password.');
      } else if (err.code === 'auth/requires-recent-login' || err.message.includes('auth/requires-recent-login')) {
          setError('This operation requires a recent login. Please log out and log back in before deleting.');
          toast.error('Please log out and log back in to delete your account.');
      } else {
        setError(`Failed to delete account: ${err.message || err.code || 'Unknown error'}`);
        toast.error('An error occurred during deletion.');
      }
    } finally {
      setLoading(false);
      setDeleteProgress(null);
      setPassword('');
      if (error) {
          setConfirmDeleteDialog(true);
          setOpenDeleteDialog(true);
      } else {
          setConfirmDeleteDialog(false);
          setOpenDeleteDialog(false);
      }
    }
  };

  // Function to clean up user data when account is deleted
  const cleanupUserData = async (userId: string) => {
    try {
      // Use individual operations instead of batches for more reliability
      setDeleteProgress('Processing side rooms created by you...');
      
      // 1. Find all SideRooms created by the user
      const sideRoomsQuery = query(
        collection(db, 'sideRooms'),
        where('ownerId', '==', userId)
      );
      const sideRoomsSnapshot = await getDocs(sideRoomsQuery);
      
      // Mark rooms as deleted with individual operations
      for (const roomDoc of sideRoomsSnapshot.docs) {
        console.log(`Marking room ${roomDoc.id} as deleted`);
        await updateDoc(doc(db, 'sideRooms', roomDoc.id), {
          deleted: true,
          deletedAt: new Date().toISOString(),
          deletedBy: 'account-deletion'
        });
      }
      
      // 2. Remove user from all side rooms where they might be a viewer
      setDeleteProgress('Removing you from all side rooms...');
      const allRoomsQuery = query(collection(db, 'sideRooms'));
      const allRoomsSnapshot = await getDocs(allRoomsQuery);
      
      for (const roomDoc of allRoomsSnapshot.docs) {
        const roomData = roomDoc.data();
        if (roomData.viewers && Array.isArray(roomData.viewers)) {
          // Check if this user is in the viewers array
          const userIsViewer = roomData.viewers.some((viewer: any) => 
            viewer.userId === userId
          );
          
          if (userIsViewer) {
            console.log(`Removing user from room ${roomDoc.id} viewers`);
            // Create a new viewers array without this user
            const newViewers = roomData.viewers.filter((viewer: any) => viewer.userId !== userId);
            await updateDoc(doc(db, 'sideRooms', roomDoc.id), {
              viewers: newViewers,
              viewerCount: Math.max(0, (roomData.viewerCount || 0) - 1)
            });
          }
        }
      }
      
      // 3. Get user's following collection (users they follow)
      setDeleteProgress('Updating follower relationships...');
      const followingCollection = collection(db, 'users', userId, 'following');
      const followingSnapshot = await getDocs(followingCollection);
      
      // Process each user that the current user follows
      for (const followingDoc of followingSnapshot.docs) {
        const followedUserId = followingDoc.id;
        console.log(`Processing followed user: ${followedUserId}`);
        
        try {
          // Remove the current user from their followers collection
          const followerDocRef = doc(db, 'users', followedUserId, 'followers', userId);
          await deleteDoc(followerDocRef);
          console.log(`Deleted follower document: users/${followedUserId}/followers/${userId}`);
          
          // Update their followers array
          const userDocRef = doc(db, 'users', followedUserId);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.followers && Array.isArray(userData.followers)) {
              const newFollowers = userData.followers.filter((id: string) => id !== userId);
              await updateDoc(userDocRef, { followers: newFollowers });
              console.log(`Updated followers array for user ${followedUserId}`);
            }
          }
        } catch (error) {
          console.error(`Error updating followed user ${followedUserId}:`, error);
          // Continue with the next user even if one fails
        }
      }
      
      // 4. Get user's followers collection (users who follow them)
      setDeleteProgress('Updating following relationships...');
      const followersCollection = collection(db, 'users', userId, 'followers');
      const followersSnapshot = await getDocs(followersCollection);
      
      // Process each user who follows the current user
      for (const followerDoc of followersSnapshot.docs) {
        const followerUserId = followerDoc.id;
        console.log(`Processing follower: ${followerUserId}`);
        
        try {
          // Remove the current user from their following collection
          const followingDocRef = doc(db, 'users', followerUserId, 'following', userId);
          await deleteDoc(followingDocRef);
          console.log(`Deleted following document: users/${followerUserId}/following/${userId}`);
          
          // Update their following array
          const userDocRef = doc(db, 'users', followerUserId);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.following && Array.isArray(userData.following)) {
              const newFollowing = userData.following.filter((id: string) => id !== userId);
              await updateDoc(userDocRef, { following: newFollowing });
              console.log(`Updated following array for user ${followerUserId}`);
            }
          }
        } catch (error) {
          console.error(`Error updating follower ${followerUserId}:`, error);
          // Continue with the next user even if one fails
        }
      }
      
      console.log("User data cleanup completed successfully");
    } catch (error) {
      console.error("Error cleaning up user data:", error);
      throw new Error("Failed to clean up user data");
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" /> Account Management
        </Typography>

        <Alert severity="info" sx={{ mt: 2, mb: 4 }}>
          You have the right to control your data. You can deactivate your account temporarily or delete it permanently.
        </Alert>

        {error && (
          <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 5 }}>
          <Typography variant="h5" gutterBottom sx={{ color: 'primary.main', fontWeight: 'medium', display: 'flex', alignItems: 'center', gap: 1 }}>
            <PauseIcon /> Deactivate Account
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <Typography variant="body1" paragraph>
            Deactivating your account will temporarily hide your profile, Side Rooms, and messages from other users. Your account will remain in our systems, and you can reactivate it at any time by simply logging in again.
          </Typography>
          
          <Typography variant="body1" paragraph>
            <strong>What happens when you deactivate:</strong>
          </Typography>
          <ul>
            <li>Your profile becomes hidden from other users</li>
            <li>Your Side Rooms and messages are hidden but not deleted</li>
            <li>You won't receive notifications</li>
            <li>You can reactivate by logging in at any time</li>
          </ul>
          
          <Button
            variant="outlined"
            color="warning"
            startIcon={<PauseIcon />}
            onClick={() => setOpenDeactivateDialog(true)}
            sx={{ mt: 2 }}
            disabled={loading}
          >
            Deactivate Account
          </Button>
        </Box>

        <Box>
          <Typography variant="h5" gutterBottom sx={{ color: 'error.main', fontWeight: 'medium', display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeleteIcon /> Delete Account Permanently
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <Typography variant="body1" paragraph>
            Deleting your account is permanent. All your data will be wiped from our systems and cannot be recovered.
          </Typography>
          
          <Typography variant="body1" paragraph>
            <strong>What happens when you delete your account:</strong>
          </Typography>
          <ul>
            <li>Your profile, Side Rooms, messages, Sade AI chat history, and all other data are permanently deleted</li>
            <li>You will lose access to your account history and connections</li>
            <li>This action cannot be undone</li>
            <li>If you want to use SideEye again, you'll need to create a new account</li>
          </ul>
          
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setOpenDeleteDialog(true)}
            sx={{ mt: 2 }}
            disabled={loading}
          >
            Delete Account Permanently
          </Button>
        </Box>
      </Paper>

      {/* Deactivate Account Dialog */}
      <Dialog
        open={openDeactivateDialog}
        onClose={() => setOpenDeactivateDialog(false)}
      >
        <DialogTitle>Confirm Account Deactivation</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to deactivate your account? Your profile and content will be hidden until you log in again.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeactivateDialog(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeactivateAccount} 
            color="warning" 
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Deactivating...' : 'Deactivate Account'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog
        open={openDeleteDialog}
        onClose={() => setOpenDeleteDialog(false)}
      >
        <DialogTitle>Delete Account</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            To confirm account deletion, please enter your password. This will permanently delete your account and all associated data.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Password"
            type="password"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={() => setConfirmDeleteDialog(true)} 
            color="error" 
            disabled={loading || !password}
          >
            Proceed
          </Button>
        </DialogActions>
      </Dialog>

      {/* Final Confirmation Dialog */}
      <Dialog
        open={confirmDeleteDialog}
        onClose={() => !loading && setConfirmDeleteDialog(false)}
      >
        <DialogTitle><WarningIcon color="error" /> Final Warning</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <strong>This action cannot be undone.</strong> Your account and all your data will be permanently deleted from our servers. Are you absolutely sure you want to proceed?
          </DialogContentText>
          {deleteProgress && loading && (
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <CircularProgress size={24} sx={{ mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                {deleteProgress}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteDialog(false)} disabled={loading}>
            No, Keep My Account
          </Button>
          <Button 
            onClick={handleDeleteAccount} 
            color="error" 
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {loading ? 'Deleting...' : 'Yes, Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default DeletionDeactivatePage; 