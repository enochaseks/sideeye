import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Paper
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc, serverTimestamp, arrayUnion, getDoc } from 'firebase/firestore';
import bcrypt from 'bcryptjs';
import { db } from '../services/firebase';
import { v4 as uuidv4 } from 'uuid';

const SetupSourceCode: React.FC = () => {
  const { currentUser, user, loading: authLoading, userProfile } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState<string>('');

  // Initialize device ID
  useEffect(() => {
    const initializeDevice = async () => {
      try {
        // Generate or retrieve device ID
        let storedDeviceId = '';
        try {
          storedDeviceId = localStorage.getItem('deviceId') || '';
        } catch (e) {
          console.log('localStorage access blocked, generating new device ID');
        }
        
        if (!storedDeviceId) {
          storedDeviceId = uuidv4();
          try {
            localStorage.setItem('deviceId', storedDeviceId);
          } catch (e) {
            console.log('Failed to store device ID in localStorage');
          }
        }
        setDeviceId(storedDeviceId);

        // Check auth state
        if (authLoading) return;
        
        const activeUser = currentUser || user;
        if (!activeUser) {
          navigate('/login');
          return;
        }

        if (userProfile?.sourceCodeSetupComplete) {
          navigate('/');
        }
      } catch (err) {
        console.error('Device initialization error:', err);
        setError('Failed to initialize device');
      }
    };

    initializeDevice();
  }, [currentUser, user, authLoading, navigate, userProfile]);

  const validateCode = (): boolean => {
    if (!/^\d{8}$/.test(code)) {
      setError('Source code must be exactly 8 digits');
      return false;
    }
    if (code !== confirmCode) {
      setError('Codes do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCode()) return;

    if (!deviceId) {
      setError('Device identification failed. Please refresh the page.');
      return;
    }

    const activeUser = currentUser || user;
    if (!activeUser || !db) {
      setError('Authentication error');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const salt = bcrypt.genSaltSync(10);
      const hashedCode = bcrypt.hashSync(code, salt);

      // First verify the device ID exists
      if (!deviceId || typeof deviceId !== 'string') {
        throw new Error('Invalid device ID');
      }

      // Update the user document with source code and device info
      const userRef = doc(db, 'users', activeUser.uid);
      await updateDoc(userRef, {
        sourceCodeHash: hashedCode,
        sourceCodeSetupComplete: true,
        registeredDevices: arrayUnion(deviceId),
        lastUpdated: serverTimestamp()
      });

      // Verify the update was successful
      const updatedDoc = await getDoc(userRef);
      if (!updatedDoc.exists() || !updatedDoc.data().sourceCodeSetupComplete) {
        throw new Error('Failed to update source code settings');
      }

      // Also store in local storage to confirm it persisted
      localStorage.setItem('deviceId', deviceId);

      setSuccess('Device registration successful! Redirecting...');
      setTimeout(() => navigate('/'), 1500);
    } catch (err: any) {
      console.error('Setup error:', err);
      setError(err.code === 'permission-denied' 
        ? 'Permission denied. Please contact support.' 
        : err.message.includes('device') 
          ? 'Device registration failed. Please try again.'
          : 'Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <Container maxWidth="sm">
        <Box display="flex" justifyContent="center" mt={8}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xs">
      <Paper elevation={3} sx={{ mt: 8, p: 4 }}>
        <Typography variant="h5" align="center" gutterBottom>
          Device Registration
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" paragraph>
          {deviceId ? `Device ID: ${deviceId.slice(0, 8)}...` : 'Generating device ID...'}
        </Typography>
        
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
          <TextField
            fullWidth
            margin="normal"
            label="8-Digit Security Code"
            value={code}
            type="password"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
            inputProps={{ 
              maxLength: 8,
              inputMode: 'numeric',
              pattern: '[0-9]*'
            }}
            required
          />
          <TextField
            fullWidth
            margin="normal"
            label="Confirm Security Code"
            value={confirmCode}
            type="password"
            onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
            inputProps={{ 
              maxLength: 8,
              inputMode: 'numeric',
              pattern: '[0-9]*'
            }}
            required
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 2 }}>
            Please set up a 8 digit source code, that is not your birth date. Your source code is a permanent security feature that cannot be reset. It protects your account by verifying your identity when logging in from new devices. Please remember this code as you will need it anytime you log in from a new device.
          </Typography>
          <Link 
            to="/faq#source-code-faq" 
            style={{ 
              display: 'block', 
              textAlign: 'center', 
              marginBottom: '16px', 
              fontSize: '0.9rem',
              color: 'primary'
            }}
          >
            Why do I need to set up a source code?
          </Link>
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 1 }}
            disabled={loading || !deviceId}
          >
            {loading ? <CircularProgress size={24} /> : 'Register This Device'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default SetupSourceCode;