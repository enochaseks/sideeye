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
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
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

      const userRef = doc(db, 'users', user.uid);
      await deleteDoc(userRef);
      console.log("Firestore user document deleted");

      console.log("Cloud Function 'onUserDeleted' will handle further data cleanup.");

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
            Deactivating your account will temporarily hide your profile, posts, and comments from other users. Your account will remain in our systems, and you can reactivate it at any time by simply logging in again.
          </Typography>
          
          <Typography variant="body1" paragraph>
            <strong>What happens when you deactivate:</strong>
          </Typography>
          <ul>
            <li>Your profile becomes hidden from other users</li>
            <li>Your posts and comments are hidden but not deleted</li>
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
            <li>Your profile, posts, comments, and all other data are permanently deleted</li>
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
        onClose={() => setConfirmDeleteDialog(false)}
      >
        <DialogTitle><WarningIcon color="error" /> Final Warning</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <strong>This action cannot be undone.</strong> Your account and all your data will be permanently deleted from our servers. Are you absolutely sure you want to proceed?
          </DialogContentText>
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