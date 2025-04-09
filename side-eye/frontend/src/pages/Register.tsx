import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  TextField,
  Button,
  Container,
  Typography,
  Box,
  Grid,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Paper,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { Timestamp } from 'firebase/firestore';

interface FormErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  dateOfBirth?: string;
}

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { register } = useAuth();

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!dateOfBirth) {
      newErrors.dateOfBirth = 'Date of Birth is required';
    } else {
      const today = new Date();
      const sixteenYearsAgo = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate());
      if (dateOfBirth > sixteenYearsAgo) {
        newErrors.dateOfBirth = 'You must be at least 16 years old to register';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const handleDateChange = (newValue: Date | null) => {
    setDateOfBirth(newValue);
    if (errors.dateOfBirth && newValue) {
      setErrors(prev => ({...prev, dateOfBirth: undefined}));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm() || !dateOfBirth) return;

    try {
      setLoading(true);
      const dobTimestamp = Timestamp.fromDate(dateOfBirth);
      await register(formData.email, formData.password, formData.username, dobTimestamp);
      navigate('/verify-email', { replace: true });
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.code === 'auth/email-already-in-use') {
        setError('Email is already in use');
      } else if (error.code === 'auth/weak-password') {
        setError('Password is too weak');
      } else {
        setError('Error creating account. Please try again.');
      }
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
            Create Account
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph align="center">
            Join SideEye and start sharing your thoughts with the community
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              margin="normal"
              required
              error={!!errors.username}
              helperText={errors.username}
            />
            <TextField
              fullWidth
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              margin="normal"
              required
              error={!!errors.email}
              helperText={errors.email}
            />
            <TextField
              fullWidth
              label="Password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              margin="normal"
              required
              error={!!errors.password}
              helperText={errors.password}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Confirm Password"
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={handleChange}
              margin="normal"
              required
              error={!!errors.confirmPassword}
              helperText={errors.confirmPassword}
            />
            <DatePicker
              label="Date of Birth"
              value={dateOfBirth}
              onChange={handleDateChange}
              slotProps={{ textField: { 
                margin: "normal", 
                required: true, 
                fullWidth: true, 
                error: !!errors.dateOfBirth, 
                helperText: errors.dateOfBirth 
              }}}
              disableFuture
              maxDate={new Date()}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              sx={{ mt: 2 }}
              disabled={loading}
            >
              Create Account
            </Button>
          </form>
        </Paper>
      </Box>
    </Container>
  );
};

export default Register; 