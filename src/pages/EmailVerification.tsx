import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Divider,
  Link
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const EmailVerification: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    currentUser, 
    user,
    loading: authLoading, 
    sendEmailVerification: resendVerificationEmail,
    forceCheckEmailVerification
  } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // If user is already verified, redirect to setup source code
  useEffect(() => {
    const checkVerificationStatus = async () => {
      // Only proceed if there's a user to check
      if (!authLoading && (currentUser || user)) {
        // Use the proper user object
        const userToCheck = currentUser || user;
        
        try {
          // Check if already verified
          const isVerified = await forceCheckEmailVerification(userToCheck!);
          console.log("Email verification status on page load:", isVerified);
          
          if (isVerified) {
            console.log("User email is verified, redirecting to setup source code...");
            navigate('/setup-source-code', { replace: true });
          }
        } catch (err) {
          console.error("Error checking verification status:", err);
        }
      }
    };
    
    checkVerificationStatus();
  }, [currentUser, user, authLoading, navigate, forceCheckEmailVerification]);

  const handleResendVerification = async () => {
    const userToUse = currentUser || user;
    
    if (!userToUse) {
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

  const handleCheckVerification = async () => {
    const userToCheck = currentUser || user;
    
    if (!userToCheck) {
      setError("Not logged in. Cannot check verification status.");
      navigate('/login');
      return;
    }
    
    try {
      setCheckingVerification(true);
      setError(null);
      
      // Use our explicit verification check function
      const isVerified = await forceCheckEmailVerification(userToCheck);
      setLastChecked(new Date());
      
      console.log("Manual verification check result:", isVerified);
      
      if (isVerified) {
        // If verified, navigate to setup source code
        navigate('/setup-source-code', { replace: true });
      } else {
        // If not verified, show a message
        setError("Email not verified yet. Please check your email and click the verification link.");
      }
    } catch (error: any) {
      console.error('Error checking verification status:', error);
      setError(error.message || 'Failed to check verification status. Please try again.');
    } finally {
      setCheckingVerification(false);
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

  const userToDisplay = currentUser || user;
  const userEmail = userToDisplay?.email || 'your registered email';

  return (
    <Container maxWidth="sm">
      <Paper elevation={0} sx={{ mt: 8, p: 4 }}>
        <Typography variant="h4" gutterBottom align="center">
          Verify Your Email
        </Typography>
        
        <Typography variant="body1" paragraph align="center">
          A verification email has been sent to:
        </Typography>
        
        <Typography variant="h6" align="center" gutterBottom sx={{ fontWeight: 'bold' }}>
          {userEmail}
        </Typography>
        
        <Typography variant="body1" color="text.secondary" paragraph align="center">
          Please check your inbox (and spam folder) and click the verification link.
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
        
        {lastChecked && !error && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Verification status checked at {lastChecked.toLocaleTimeString()}. Email is not yet verified.
          </Alert>
        )}
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 3 }}>
          <Button
            variant="outlined"
            onClick={handleCheckVerification}
            disabled={loading || checkingVerification}
            color="primary"
            fullWidth
          >
            {checkingVerification ? <CircularProgress size={24} color="inherit" /> : 'I\'ve Verified My Email'}
          </Button>
          
          <Button
            variant="text"
            onClick={handleResendVerification}
            disabled={loading || checkingVerification}
            color="secondary"
            fullWidth
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Resend Verification Email'}
          </Button>
        </Box>
        
        <Divider sx={{ my: 3 }} />
        
        <Typography variant="body2" color="text.secondary" align="center">
          Having trouble? Try <Link component="button" onClick={handleResendVerification}>sending the email again</Link> or <Link component="button" onClick={() => navigate('/login')}>login with a different account</Link>.
        </Typography>
      </Paper>
    </Container>
  );
};

export default EmailVerification;