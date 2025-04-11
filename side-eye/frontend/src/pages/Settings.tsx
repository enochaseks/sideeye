import React, { useState } from 'react';
import { 
  Container, 
  Box, 
  Typography, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  Divider,
  Paper,
  useTheme,
  useMediaQuery,
  Switch,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert
} from '@mui/material';
import {
  Security as SecurityIcon,
  Info as InfoIcon,
  Policy as PolicyIcon,
  Cookie as CookieIcon,
  Settings as SettingsIcon,
  Devices as DevicesIcon,
  DarkMode as DarkModeIcon,
  Delete as DeleteIcon,
  ManageAccounts as ManageAccountsIcon
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useThemeContext } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { doc, updateDoc, arrayRemove } from 'firebase/firestore';

const Settings: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { isDarkMode, toggleDarkMode } = useThemeContext();
  const { currentUser } = useAuth();
  const [devices, setDevices] = useState<Array<{ id: string; name: string; lastActive: string }>>([]);
  const [showDeviceDialog, setShowDeviceDialog] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const settingsItems = [
    {
      title: 'Device Management',
      icon: <DevicesIcon />,
      path: '#',
      description: 'Manage your connected devices and appearance settings',
      onClick: () => setShowDeviceDialog(true)
    },
    {
      title: 'Security & Authentication',
      icon: <SecurityIcon />,
      path: '/security',
      description: 'Learn about our authentication flow and security features'
    },
    {
      title: 'Account Management',
      icon: <ManageAccountsIcon />,
      path: '/account-management',
      description: 'Deactivate or delete your account'
    },
    {
      title: 'About',
      icon: <InfoIcon />,
      path: '/about',
      description: 'Learn more about SideEye and our mission'
    },
    {
      title: 'Privacy Policy',
      icon: <PolicyIcon />,
      path: '/privacy-policy',
      description: 'Read our privacy policy and data handling practices'
    },
    {
      title: 'Terms of Service',
      icon: <PolicyIcon />,
      path: '/terms',
      description: 'Review our terms of service and community guidelines'
    },
    {
      title: 'Cookie Policy',
      icon: <CookieIcon />,
      path: '/cookies',
      description: 'Learn about how we use cookies and similar technologies'
    }
  ];

  const handleRemoveDevice = async (deviceId: string) => {
    if (!currentUser) return;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        devices: arrayRemove(deviceId)
      });
      setDevices(devices.filter(device => device.id !== deviceId));
      setShowDeviceDialog(false);
      setSelectedDevice(null);
    } catch (err) {
      setError('Failed to remove device');
      console.error('Error removing device:', err);
    }
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
          Settings
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Paper elevation={0} sx={{ borderRadius: 2 }}>
          <List>
            {settingsItems.map((item, index) => (
              <React.Fragment key={item.title}>
                <ListItem 
                  component={item.path ? Link : 'div'}
                  to={item.path}
                  onClick={item.onClick}
                  sx={{
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                    textDecoration: 'none',
                    color: 'inherit',
                    cursor: 'pointer'
                  }}
                >
                  <ListItemIcon>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.title}
                    secondary={item.description}
                  />
                </ListItem>
                {index < settingsItems.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Paper>

        <Dialog
          open={showDeviceDialog}
          onClose={() => setShowDeviceDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Device Management</DialogTitle>
          <DialogContent>
            <List>
              <ListItem>
                <ListItemIcon>
                  <DarkModeIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Dark Mode"
                  secondary="Toggle between light and dark mode"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={isDarkMode}
                    onChange={toggleDarkMode}
                    color="primary"
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
              <Typography variant="subtitle1" sx={{ px: 2, py: 1, fontWeight: 'bold' }}>
                Connected Devices
              </Typography>
              {devices.map((device) => (
                <ListItem key={device.id}>
                  <ListItemText
                    primary={device.name}
                    secondary={`Last active: ${device.lastActive}`}
                  />
                  <IconButton
                    edge="end"
                    onClick={() => {
                      setSelectedDevice(device.id);
                      handleRemoveDevice(device.id);
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItem>
              ))}
              {devices.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
                  No devices connected
                </Typography>
              )}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowDeviceDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default Settings; 