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
import { sendEmailVerification, applyActionCode } from 'firebase/auth';
import { auth } from '../services/firebase';

const EmailVerification: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  useEffect(() => {
    const handleEmailVerification = async () => {
      const actionCode = new URLSearchParams(location.search).get('oobCode');
      if (actionCode) {
        try {
          setLoading(true);
          await applyActionCode(auth, actionCode);
          setSuccess(true);
          setTimeout(() => {
            navigate('/login');
          }, 3000);
        } catch (error) {
          setError('Invalid or expired verification link');
        } finally {
          setLoading(false);
        }
      }
    };

    handleEmailVerification();
  }, [location, navigate]);

  const handleResendVerification = async () => {
    if (!auth.currentUser) {
      setError('No user found. Please log in again.');
      return;
    }

    try {
      setLoading(true);
      await sendEmailVerification(auth.currentUser);
      setVerificationSent(true);
    } catch (error) {
      setError('Failed to send verification email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, textAlign: 'center' }}>
        {success ? (
          <>
            <Typography variant="h4" gutterBottom>
              Email Verified!
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Your email has been successfully verified. You will be redirected to the login page.
            </Typography>
          </>
        ) : (
          <>
            <Typography variant="h4" gutterBottom>
              Verify Your Email
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Please check your email for a verification link. If you haven't received it, you can request a new one.
            </Typography>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            {verificationSent && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Verification email sent! Please check your inbox.
              </Alert>
            )}
            <Button
              variant="contained"
              onClick={handleResendVerification}
              disabled={loading || verificationSent}
              sx={{ mt: 2 }}
            >
              Resend Verification Email
            </Button>
          </>
        )}
      </Box>
    </Container>
  );
};

export default EmailVerification; 