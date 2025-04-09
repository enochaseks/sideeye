import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  FormControlLabel,
  Checkbox,
  Box,
  Link,
  Divider,
  IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';

interface CookiePreferences {
  necessary: boolean;
  functionality: boolean;
  analytics: boolean;
}

const CookieConsent: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true, // Always true as it's required for the app to function
    functionality: false,
    analytics: false
  });

  useEffect(() => {
    // Check if user has already set preferences
    const savedPreferences = localStorage.getItem('cookiePreferences');
    if (!savedPreferences) {
      setOpen(true);
    }
  }, []);

  const handleAcceptAll = () => {
    const allAccepted: CookiePreferences = {
      necessary: true,
      functionality: true,
      analytics: true
    };
    setPreferences(allAccepted);
    localStorage.setItem('cookiePreferences', JSON.stringify(allAccepted));
    setOpen(false);
  };

  const handleSavePreferences = () => {
    localStorage.setItem('cookiePreferences', JSON.stringify(preferences));
    setOpen(false);
  };

  const handleChange = (type: keyof CookiePreferences) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setPreferences({
      ...preferences,
      [type]: event.target.checked
    });
  };

  const handleLearnMore = () => {
    navigate('/cookies');
    setOpen(false);
  };

  return (
    <Dialog 
      open={open} 
      onClose={() => {}} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        style: {
          position: 'fixed',
          bottom: 20,
          right: 20,
          margin: 0,
          maxWidth: '500px',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1
      }}>
        <Typography variant="h6" component="div">
          Cookie Preferences
        </Typography>
        <IconButton 
          onClick={() => setOpen(false)} 
          size="small"
          sx={{ color: 'text.secondary' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <Divider />
      
      <DialogContent>
        <Typography variant="body1" paragraph>
          We use cookies to enhance your experience. Please select your preferences:
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={preferences.necessary}
                disabled
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight="bold">
                  Necessary Cookies
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Required for the app to function properly. Cannot be disabled.
                </Typography>
              </Box>
            }
          />
          
          <FormControlLabel
            control={
              <Checkbox
                checked={preferences.functionality}
                onChange={handleChange('functionality')}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight="bold">
                  Functionality Cookies
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Remember your preferences and settings.
                </Typography>
              </Box>
            }
          />
          
          <FormControlLabel
            control={
              <Checkbox
                checked={preferences.analytics}
                onChange={handleChange('analytics')}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight="bold">
                  Analytics Cookies
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Help us understand how you use our app.
                </Typography>
              </Box>
            }
          />
        </Box>

        <Box sx={{ mt: 2 }}>
          <Link 
            component="button" 
            variant="body2" 
            onClick={handleLearnMore}
            sx={{ color: 'primary.main' }}
          >
            Learn more about how we use cookies
          </Link>
        </Box>
      </DialogContent>
      
      <Divider />
      
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button 
          onClick={handleSavePreferences} 
          variant="outlined" 
          color="primary"
          sx={{ minWidth: '120px' }}
        >
          Save Preferences
        </Button>
        <Button 
          onClick={handleAcceptAll} 
          variant="contained" 
          color="primary"
          sx={{ minWidth: '120px' }}
        >
          Accept All
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CookieConsent; 