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
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc, getDoc, Firestore } from 'firebase/firestore';
import bcrypt from 'bcryptjs';
import { db } from '../services/firebase';

const SetupSourceCode: React.FC = (): JSX.Element | null => {
  const { currentUser, loading: authLoading, userProfile } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirect if user is not logged in, not verified, or already set up
  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate('/login');
    } else if (!authLoading && currentUser && !currentUser.emailVerified) {
      navigate('/verify-email');
    } else if (!authLoading && userProfile && userProfile.sourceCodeSetupComplete) {
       // Or redirect to home if setup is already done
      navigate('/'); 
    }
  }, [currentUser, authLoading, navigate, userProfile]);

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
    if (!validateCode() || !currentUser || !db) return;

    setLoading(true);
    setError(null);

    try {
      // Hash the code
      const salt = bcrypt.genSaltSync(10);
      const hashedCode = bcrypt.hashSync(code, salt);

      // Update Firestore
      const userDocRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userDocRef, {
        sourceCodeHash: hashedCode,
        sourceCodeSetupComplete: true,
      });

      console.log('Source code setup complete.');
      navigate('/'); // Redirect to home page after setup

    } catch (err: any) {
      console.error('Error setting up source code:', err);
      setError('Failed to set up source code. Please try again.');
      setLoading(false);
    }
    // No finally block needed as navigate happens on success
  };

  if (authLoading || loading) {
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
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
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
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Set Source Code'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default SetupSourceCode; 