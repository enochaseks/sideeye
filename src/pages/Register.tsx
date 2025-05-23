import React, { useState, useEffect } from 'react';
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
  Checkbox,
  FormControlLabel,
  FormHelperText,
  Chip,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface FormErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  dateOfBirth?: string;
  name?: string;
  termsAccepted?: string;
}

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    name: '',
  });
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { register } = useAuth();
  
  // New state for username validation and suggestions
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameTaken, setUsernameTaken] = useState(false);
  const [usernameOptions, setUsernameOptions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Function to check if username exists in Firestore
  const checkUsernameExists = async (username: string): Promise<boolean> => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username));
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking username:', error);
      return false;
    }
  };

  // Function to generate username suggestions
  const generateUsernameSuggestions = (username: string): string[] => {
    const suggestions: string[] = [];
    
    // Add a random number
    suggestions.push(`${username}${Math.floor(Math.random() * 100)}`);
    
    // Add the current year
    const currentYear = new Date().getFullYear();
    suggestions.push(`${username}${currentYear}`);
    
    // Add underscore and random number
    suggestions.push(`${username}_${Math.floor(Math.random() * 100)}`);
    
    // Add a prefix
    suggestions.push(`real_${username}`);
    
    // Add a suffix with random number
    suggestions.push(`${username}${Math.floor(Math.random() * 1000)}`);
    
    return suggestions;
  };

  // Effect to validate username when it changes
  useEffect(() => {
    let isActive = true;
    
    const validateUsername = async () => {
      const username = formData.username;
      
      // Only check if username is valid and at least 3 chars
      if (!/^[a-zA-Z0-9_-]+$/.test(username) || username.length < 3) {
        setUsernameTaken(false);
        setUsernameOptions([]);
        setShowSuggestions(false);
        return;
      }
      
      setCheckingUsername(true);
      
      try {
        const exists = await checkUsernameExists(username);
        
        if (isActive) {
          if (exists) {
            setUsernameTaken(true);
            setErrors(prev => ({
              ...prev,
              username: 'Username is already taken'
            }));
            
            // Generate suggestions
            const suggestions = generateUsernameSuggestions(username);
            
            // Verify suggestions are available
            const validatedSuggestions: string[] = [];
            
            // Check each suggestion in parallel
            const checkResults = await Promise.all(
              suggestions.map(async (suggestion) => {
                const exists = await checkUsernameExists(suggestion);
                return { suggestion, exists };
              })
            );
            
            // Filter out taken usernames
            checkResults.forEach(result => {
              if (!result.exists) {
                validatedSuggestions.push(result.suggestion);
              }
            });
            
            setUsernameOptions(validatedSuggestions);
            setShowSuggestions(validatedSuggestions.length > 0);
          } else {
            setUsernameTaken(false);
            setUsernameOptions([]);
            setShowSuggestions(false);
          }
        }
      } catch (error) {
        console.error('Error validating username:', error);
      } finally {
        if (isActive) {
          setCheckingUsername(false);
        }
      }
    };

    // Debounce the username validation
    const debounceTimeout = setTimeout(() => {
      if (formData.username.length >= 3) {
        validateUsername();
      }
    }, 500);

    return () => {
      isActive = false;
      clearTimeout(debounceTimeout);
    };
  }, [formData.username]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else {
      const password = formData.password;
      if (password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters long';
      } else if (!/[A-Z]/.test(password)) {
        newErrors.password = 'Password must contain at least one uppercase letter';
      } else if (!/[a-z]/.test(password)) {
        newErrors.password = 'Password must contain at least one lowercase letter';
      } else if (!/[0-9]/.test(password)) {
        newErrors.password = 'Password must contain at least one number';
      } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        newErrors.password = 'Password must contain at least one special character';
      }
    }

    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Username validation
    if (!formData.username) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters long';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, underscores, and hyphens';
    } else if (usernameTaken) {
      newErrors.username = 'Username is already taken';
    }

    // Name validation
    if (!formData.name) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters long';
    } else if (!/^[a-zA-Z\s-']+$/.test(formData.name)) {
      newErrors.name = 'Name can only contain letters, spaces, hyphens, and apostrophes';
    }

    // Date of birth validation
    if (!dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required';
    } else {
      const today = new Date();
      let age = today.getFullYear() - dateOfBirth.getFullYear();
      const monthDiff = today.getMonth() - dateOfBirth.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
        age--;
      }
      
      if (age < 18) { // 17 is the minimum age to register [DO NOT CHANGE THIS]
        newErrors.dateOfBirth = 'You must be at least 18 years old'; // Minimum age to register
      } else if (age > 120) {
        newErrors.dateOfBirth = 'Please enter a valid date of birth';
      }
    }

    // Terms and policies acceptance validation
    if (!termsAccepted) {
      newErrors.termsAccepted = 'You must accept the Terms of Service, Privacy Policy, and Cookie Policy';
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
    if (newValue && !isNaN(newValue.getTime())) {
      setFormData(prev => ({
        ...prev,
        dateOfBirth: newValue.toISOString()
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        dateOfBirth: ''
      }));
    }
    if (errors.dateOfBirth) {
      setErrors(prev => ({...prev, dateOfBirth: undefined}));
    }
  };

  const handleTermsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTermsAccepted(event.target.checked);
    if (errors.termsAccepted) {
      setErrors(prev => ({
        ...prev,
        termsAccepted: undefined
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) return;

    // Final username check before submission
    const usernameExists = await checkUsernameExists(formData.username);
    if (usernameExists) {
      setErrors(prev => ({
        ...prev,
        username: 'Username is already taken'
      }));
      setUsernameTaken(true);
      return;
    }

    try {
      setLoading(true);
      if (!dateOfBirth || isNaN(dateOfBirth.getTime())) {
        throw new Error('Invalid date of birth');
      }

      // Call register function with all required data
      await register(
        formData.email,
        formData.password,
        formData.username,
        Timestamp.fromDate(dateOfBirth)
      );

      // Only navigate if registration was successful
      navigate('/verify-email', { replace: true });
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.code === 'auth/email-already-in-use') {
        setError('Email is already in use');
      } else if (error.code === 'auth/weak-password') {
        setError('Password is too weak');
      } else if (error.message === 'Invalid date of birth') {
        setError('Please enter a valid date of birth');
      } else if (error.message?.includes('username-exists')) {
        setErrors(prev => ({
          ...prev,
          username: 'Username is already taken'
        }));
        setUsernameTaken(true);
      } else {
        setError(error.message || 'Error creating account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setFormData(prev => ({
      ...prev,
      username: suggestion
    }));
    setUsernameTaken(false);
    setUsernameOptions([]);
    setShowSuggestions(false);
    setErrors(prev => ({
      ...prev,
      username: undefined
    }));
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
              label="Full Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              margin="normal"
              required
              error={!!errors.name}
              helperText={errors.name}
            />
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
              InputProps={{
                endAdornment: checkingUsername ? (
                  <InputAdornment position="end">
                    <CircularProgress size={20} />
                  </InputAdornment>
                ) : null
              }}
            />
            
            {/* Username suggestions */}
            {showSuggestions && (
              <Box sx={{ mt: 1, mb: 2 }}>
                <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
                  Try one of these available usernames:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {usernameOptions.map((option, index) => (
                    <Chip
                      key={index}
                      label={option}
                      onClick={() => handleSuggestionClick(option)}
                      color="primary"
                      variant="outlined"
                      clickable
                      size="small"
                    />
                  ))}
                </Box>
              </Box>
            )}
            
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
              helperText={errors.password || "Password must be at least 8 characters long with at least one uppercase letter, one lowercase letter, one number, and one special character (e.g., !@#$%^&*)"}
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
              slotProps={{ 
                textField: { 
                  margin: "normal", 
                  required: true, 
                  fullWidth: true, 
                  error: !!errors.dateOfBirth, 
                  helperText: errors.dateOfBirth 
                }
              }}
              disableFuture
              maxDate={new Date()}
            />

            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox 
                    checked={termsAccepted} 
                    onChange={handleTermsChange}
                    color="primary"
                  />
                }
                label={
                  <Typography variant="body2">
                    I agree to the{' '}
                    <Link to="/terms" target="_blank" rel="noopener">
                      Terms of Service
                    </Link>
                    ,{' '}
                    <Link to="/privacy-policy" target="_blank" rel="noopener">
                      Privacy Policy
                    </Link>
                    , and{' '}
                    <Link to="/cookies" target="_blank" rel="noopener">
                      Cookie Policy
                    </Link>
                  </Typography>
                }
              />
              {errors.termsAccepted && (
                <FormHelperText error>{errors.termsAccepted}</FormHelperText>
              )}
            </Box>
            
            <Button
              type="submit"
              variant="contained"
              fullWidth
              sx={{ mt: 2 }}
              disabled={loading || usernameTaken || checkingUsername}
            >
              Create Account
            </Button>
            <Typography variant="body2" sx={{ mt: 2 }} align="center">
              Already have an account? <Link to="/login">Log in</Link>
            </Typography>
          </form>
        </Paper>
      </Box>
    </Container>
  );
};

export default Register;