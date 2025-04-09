import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Link
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc, getDoc, Firestore } from 'firebase/firestore';
import bcrypt from 'bcryptjs';
import { db } from '../services/firebase';

const SetupSourceCode: React.FC = (): JSX.Element | null => {
  const { currentUser, user, loading: authLoading, userProfile, forceCheckEmailVerification } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);

  // Improved useEffect to prevent redirect loops
  useEffect(() => {
    // Don't do anything while auth is still loading
    if (authLoading) return;

    const checkAuth = async () => {
      setCheckingVerification(true);
      try {
        // If no user at all, redirect to login
        if (!currentUser && !user) {
          console.log("No user found, redirecting to login");
          navigate('/login');
          return;
        }

        // Get the active user (either currentUser or user)
        const activeUser = currentUser || user;
        
        // If there's a user profile and they've already set up the source code, redirect to home
        if (userProfile?.sourceCodeSetupComplete) {
          console.log("Source code already set up, redirecting to home");
          navigate('/');
          return;
        }

        // Only check email verification if specifically needed
        // This prevents unnecessary bouncing between pages
        if (activeUser) {
          const isVerified = await forceCheckEmailVerification(activeUser);
          if (!isVerified) {
            console.log("Email not verified, redirecting to verification page");
            navigate('/verify-email');
            return;
          }
        }
        
        // If we get here, stay on this page - it's the right place
        console.log("User is in the correct state for source code setup");
      } catch (err) {
        console.error("Error checking auth state:", err);
        setError("Failed to verify authentication state");
      } finally {
        setCheckingVerification(false);
      }
    };

    checkAuth();
  }, [currentUser, user, authLoading, navigate, userProfile, forceCheckEmailVerification]);

  const validateCode = (): boolean => {
    if (!/^[0-9]{8}$/.test(code)) {
      setError('Source code must be exactly 8 digits.');
      return false;
    }
    if (code !== confirmCode) {
      setError('Codes do not match.');
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Determine which user object to use
    const activeUser = currentUser || user;
    
    if (!validateCode() || !activeUser || !db) {
      setError('Unable to complete setup. Please try again or log in again.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Hash the code
      const salt = bcrypt.genSaltSync(10);
      const hashedCode = bcrypt.hashSync(code, salt);

      // Update Firestore
      const userDocRef = doc(db, 'users', activeUser.uid);
      await updateDoc(userDocRef, {
        sourceCodeHash: hashedCode,
        sourceCodeSetupComplete: true,
      });

      setSuccess('Source code setup complete! Redirecting to home page...');
      console.log('Source code setup complete.');
      
      // Short delay before redirecting to show success message
      setTimeout(() => {
        navigate('/'); // Redirect to home page after setup
      }, 1500);
    } catch (err: any) {
      console.error('Error setting up source code:', err);
      setError('Failed to set up source code: ' + (err.message || 'Please try again.'));
      setLoading(false);
    }
  };

  if (authLoading || checkingVerification) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xs">
      <Paper elevation={0} sx={{ mt: 8, p: 4 }}>
        <Typography variant="h5" component="h1" gutterBottom align="center">
          Set Up Your 8-Digit Source Code
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" paragraph>
          This code will be used for account security instead of traditional 2FA. Keep it safe!
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mt: 2, mb: 2 }}>
            {success}
          </Alert>
        )}
        
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 2 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="source-code"
            label="8-Digit Source Code"
            name="source-code"
            type="password" // Use password type to obscure input
            inputProps={{ maxLength: 8, pattern: '[0-9]*', inputMode: 'numeric' }}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))} // Allow only digits
            autoFocus
            error={!!error && error.includes('digits')}
            disabled={loading}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="confirm-source-code"
            label="Confirm Source Code"
            type="password"
            id="confirm-source-code"
            inputProps={{ maxLength: 8, pattern: '[0-9]*', inputMode: 'numeric' }}
            value={confirmCode}
            onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
            error={!!error && error.includes('match')}
            disabled={loading}
          />
          
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Set Source Code'}
          </Button>
          
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
            Remember to store this code securely. You'll need it every time you log in.
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default SetupSourceCode; 