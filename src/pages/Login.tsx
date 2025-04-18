import React, { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { TextField, Button, Container, Typography, Box, Link as MuiLink, Paper, Alert, Grid } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { CircularProgress } from '@mui/material';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'info' | 'warning' | 'error', message: string} | null>(null);
  const { login, loading: authLoading, error: authError, setError, currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  // Clear status messages when email/password changes
  useEffect(() => {
    setStatusMessage(null);
  }, [email, password]);

  // Redirect logged in users
  useEffect(() => {
    if (currentUser) {
      // User is already logged in and fully authenticated - redirect to home
      if (userProfile && userProfile.sourceCodeSetupComplete) {
        navigate('/');
      }
      // Don't redirect otherwise - let onAuthStateChanged handle navigation
    }
  }, [currentUser, userProfile, navigate]);
  
  useEffect(() => {
    // Display auth errors from context
    if (authError) {
      setStatusMessage({type: 'error', message: authError});
    }
  }, [authError]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setError) setError(null);
    setStatusMessage(null);
    
    // Basic validation
    if (!email.trim()) {
      setStatusMessage({type: 'error', message: 'Email is required'});
      return;
    }
    
    // Email format validation
    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    if (!emailRegex.test(email.trim())) {
      setStatusMessage({type: 'error', message: 'Please enter a valid email address'});
      return;
    }
    
    if (!password) {
      setStatusMessage({type: 'error', message: 'Password is required'});
      return;
    }

    try {
      setLocalLoading(true);
      setStatusMessage({type: 'info', message: 'Logging in...'});
      
      await login(email.trim(), password);
      
      // Login success message - though this might not show if redirected quickly
      setStatusMessage({type: 'success', message: 'Login successful! Redirecting...'});
      
    } catch (err: any) {
      console.error('Login component caught error:', err);
      // Display user-friendly error message
      if (err.code === 'auth/too-many-requests' || err.message === 'auth/too-many-requests') {
        setStatusMessage({
          type: 'error', 
          message: 'Too many failed login attempts. Please try again later or reset your password.'
        });
      } else if (err.code === 'auth/invalid-credential' || err.message === 'auth/invalid-credential') {
        setStatusMessage({
          type: 'error', 
          message: 'Invalid email or password. Please try again.'
        });
      } else if (err.code === 'auth/invalid-email' || err.message === 'auth/invalid-email') {
        setStatusMessage({
          type: 'error',
          message: 'Invalid email address. Please check the format.'
        });
      } else {
        setStatusMessage({
          type: 'error',
          message: err.message || 'Login failed. Please try again.'
        });
      }
    } finally {
      setLocalLoading(false);
    }
  };

  const isLoading = authLoading || localLoading;

  return (
    <Container maxWidth="xs">
      <Paper elevation={0} sx={{ mt: 8, p: 4 }}>
        <Typography 
          component="h1" 
          variant="h5" 
          align="center" 
          sx={{ mb: 2 }}
        >
          Login to Side Eye
        </Typography>
        <Box component="form" onSubmit={handleLogin} noValidate sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />
          {statusMessage && (
            <Alert severity={statusMessage.type} sx={{ mt: 2 }}>
              {statusMessage.message}
            </Alert>
          )}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={24} /> : 'Sign In'}
          </Button>
          <Grid container justifyContent="space-between">
            <Grid item>
              <MuiLink component={RouterLink} to="/reset-password" variant="body2">
                Forgot password?
              </MuiLink>
            </Grid>
            <Grid item>
              <MuiLink component={RouterLink} to="/register" variant="body2">
                {"Don\'t have an account? Sign Up"}
              </MuiLink>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Container>
  );
};

export default Login; 