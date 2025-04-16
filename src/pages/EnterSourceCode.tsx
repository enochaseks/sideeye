import React, { useState, useEffect } from 'react';
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

const EnterSourceCode: React.FC = () => {
  const { 
    verifySourceCodeAndCompleteLogin, 
    loading, 
    error, 
    setError, 
    tempUserForSourceCode, 
    currentUser
  } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!currentUser && !tempUserForSourceCode && !loading) { 
        console.log('No temporary or current user found, redirecting to login.');
        navigate('/login', { replace: true });
        return;
    }
    
    setError(null);
  }, [currentUser, tempUserForSourceCode, navigate, loading, setError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[0-9]{8}$/.test(code)) {
        setError('Source code must be exactly 8 digits.');
        return;
    }
    await verifySourceCodeAndCompleteLogin(code);
  };

  return (
    <Container maxWidth="xs">
      <Paper elevation={0} sx={{ mt: 8, p: 4 }}>
        <Typography variant="h5" component="h1" gutterBottom align="center">
          Enter Source Code
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" paragraph>
          Enter your 8-digit source code to complete login.
        </Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="source-code"
            label="8-Digit Source Code"
            name="source-code"
            type="password"
            inputProps={{ maxLength: 8, pattern: '[0-9]*', inputMode: 'numeric' }}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\\D/g, '').slice(0, 8))}
            autoFocus
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
            {loading ? <CircularProgress size={24} /> : 'Verify Code'}
          </Button>
          <Box textAlign="center">
            <MuiLink component={RouterLink} to="/reset-source-code" variant="body2" sx={{ mt: 1 }}>
              Forgot Source Code?
            </MuiLink>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default EnterSourceCode;
