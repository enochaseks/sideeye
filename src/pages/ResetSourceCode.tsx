import React, { useState } from 'react';
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

// Placeholder function - replace with Cloud Function call
const sendSourceCodeResetEmail = async (email: string): Promise<void> => {
  console.log(`Placeholder: Sending source code reset email to ${email}`);
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500)); 
  // In a real implementation, this would call a Cloud Function
  // which would then send the email via SendGrid, Mailgun, etc.
  // or use Firebase Extensions for triggered emails.
};

const ResetSourceCode: React.FC = () => {
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
      await sendSourceCodeResetEmail(email);
      setMessage('If an account exists for this email, a reset link has been sent. Please check your inbox.');
    } catch (err: any) {
      console.error('Error sending source code reset email:', err);
      setError('Failed to send reset email. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs">
      <Paper elevation={0} sx={{ mt: 8, p: 4 }}>
        <Typography variant="h5" component="h1" gutterBottom align="center">
          Reset Source Code
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" paragraph>
          Enter your account email address to receive a link to reset your 8-digit source code.
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
        </Box>
      </Paper>
    </Container>
  );
};

export default ResetSourceCode; 