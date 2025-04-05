import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Paper,
} from '@mui/material';
import { auth } from '../services/firebase';
import { getAuth, multiFactor, PhoneAuthProvider, PhoneMultiFactorGenerator, RecaptchaVerifier } from 'firebase/auth';

// Extend Window interface to include recaptchaVerifier
declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier;
  }
}

const TwoFactorAuth: React.FC = () => {
  const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Initialize reCAPTCHA verifier
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved, allow phone number verification
      },
    });

    return () => {
      // Cleanup reCAPTCHA verifier
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
      }
    };
  }, []);

  const handlePhoneNumberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      setError('No user found. Please log in again.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const multiFactorSession = await multiFactor(auth.currentUser).getSession();
      const phoneInfoOptions = {
        phoneNumber,
        session: multiFactorSession,
      };

      const phoneAuthProvider = new PhoneAuthProvider(auth);
      const verificationId = await phoneAuthProvider.verifyPhoneNumber(
        phoneInfoOptions,
        window.recaptchaVerifier
      );

      setVerificationId(verificationId);
    } catch (error) {
      setError('Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !verificationId) {
      setError('Invalid verification state. Please try again.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(credential);

      await multiFactor(auth.currentUser).enroll(multiFactorAssertion, 'Phone Number');
      setSuccess(true);
      
      setTimeout(() => {
        navigate('/profile');
      }, 3000);
    } catch (error) {
      setError('Invalid verification code. Please try again.');
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
      <Box sx={{ mt: 8 }}>
        <Paper elevation={0} sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom align="center">
            Two-Factor Authentication
          </Typography>
          
          {success ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              2FA has been successfully set up! You will be redirected to your profile.
            </Alert>
          ) : (
            <>
              <Typography variant="body1" color="text.secondary" paragraph align="center">
                Add an extra layer of security to your account by enabling two-factor authentication.
              </Typography>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {!verificationId ? (
                <form onSubmit={handlePhoneNumberSubmit}>
                  <TextField
                    fullWidth
                    label="Phone Number"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    margin="normal"
                    required
                    placeholder="+1234567890"
                  />
                  <div id="recaptcha-container" />
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    sx={{ mt: 2 }}
                    disabled={loading}
                  >
                    Send Verification Code
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerificationCodeSubmit}>
                  <TextField
                    fullWidth
                    label="Verification Code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    margin="normal"
                    required
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    sx={{ mt: 2 }}
                    disabled={loading}
                  >
                    Verify Code
                  </Button>
                </form>
              )}
            </>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default TwoFactorAuth; 