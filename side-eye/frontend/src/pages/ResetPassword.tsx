import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Link as MuiLink,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const ResetPassword: React.FC = (): JSX.Element => {
  const { resetPassword } = useAuth(); // Get resetPassword function from context
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (!email) {
      setError('Email is required.');
      setLoading(false);
      return;
    }

    try {
      await resetPassword(email);
      setMessage('Password reset email sent. Please check your inbox.');
    } catch (err: any) {
      console.error('Error sending password reset email:', err);
      // Use generic message for security (don't reveal if email exists)
      setError('Failed to send reset email. Please check the address and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs">
      <Paper elevation={0} sx={{ mt: 8, p: 4 }}>
        <Typography variant="h5" component="h1" gutterBottom align="center">
          Reset Password
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" paragraph>
          Enter your email address and we'll send you a link to reset your password.
        </Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          {message && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {message}
            </Alert>
          )}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Send Reset Link'}
          </Button>
          <Box textAlign="center">
            <MuiLink component={RouterLink} to="/login" variant="body2">
              Back to Login
            </MuiLink>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default ResetPassword; 