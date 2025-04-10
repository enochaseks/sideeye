import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Box, TextField, Button, Typography, Paper, Alert } from '@mui/material';
import { toast } from 'react-hot-toast';

const SetupSourceCode: React.FC = () => {
  const { currentUser, verifySourceCodeAndCompleteLogin, setError } = useAuth();
  const [code, setCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [loading, setLoading] = useState(false);

  const isSafari = () => {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (code !== confirmCode) {
      setError('Source codes do not match');
      setLoading(false);
      return;
    }

    if (code.length < 8) {
      setError('Source code must be at least 8 characters long');
      setLoading(false);
      return;
    }

    try {
      await verifySourceCodeAndCompleteLogin(code);
      toast.success('Source code setup complete!');
    } catch (error) {
      console.error('Error setting up source code:', error);
      setError('Failed to set up source code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        p: 3,
        bgcolor: 'background.default'
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          maxWidth: 500,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 3
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Set Up Your Security Code
        </Typography>

        {isSafari() && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              Safari users: Please ensure you have enabled storage access for this site.
              You can do this by going to Safari Preferences {'>'} Privacy {'>'} Website Data.
            </Typography>
          </Alert>
        )}

        <Typography variant="body1" color="text.secondary" paragraph>
          You will need to enter this security code every time you log in from a new device.
          Choose something memorable but secure.
        </Typography>

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Security Code"
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            margin="normal"
            required
            helperText="At least 8 characters long"
          />
          <TextField
            fullWidth
            label="Confirm Security Code"
            type="password"
            value={confirmCode}
            onChange={(e) => setConfirmCode(e.target.value)}
            margin="normal"
            required
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading}
            sx={{ mt: 2 }}
          >
            {loading ? 'Setting Up...' : 'Set Up Security Code'}
          </Button>
        </form>

        {isSafari() && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Note: In Safari, you may need to re-enter your security code more frequently
              due to browser privacy settings. We recommend using a code that is both
              secure and easy to remember.
            </Typography>
          </Alert>
        )}
      </Paper>
    </Box>
  );
};

export default SetupSourceCode; 