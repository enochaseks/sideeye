import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const EmailVerification: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, loading: authLoading, sendEmailVerification: resendVerificationEmail } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  useEffect(() => {
    if (currentUser && currentUser.emailVerified) {
      console.log("User email is verified, redirecting to setup source code...");
      navigate('/setup-source-code', { replace: true });
      return;
    }
  }, [currentUser, authLoading, navigate]);

  const handleResendVerification = async () => {
    if (!currentUser) {
      setError("Not logged in. Cannot resend verification email.");
      navigate('/login');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setVerificationSent(false);

      await resendVerificationEmail();
      setVerificationSent(true);
      setError(null);
    } catch (error: any) {
      console.error('Error sending verification email:', error);
      setError(error.message || 'Failed to send verification email. Please try again.');
      setVerificationSent(false);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Verify Your Email
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Please check your email ({currentUser?.email || 'your registered email'}) for a verification link. If you haven't received it or it has expired, you can request a new one.
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {verificationSent && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Verification email sent! Please check your inbox (and spam folder).
          </Alert>
        )}
        <Button
          variant="contained"
          onClick={handleResendVerification}
          disabled={loading}
          sx={{ mt: 2 }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Resend Verification Email'}
        </Button>
      </Box>
    </Container>
  );
};

export default EmailVerification;