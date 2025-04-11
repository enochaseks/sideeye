import React, { useState, useEffect } from 'react';
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
  Alert,
  Avatar
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
  ManageAccounts as ManageAccountsIcon,
  Shield as ShieldIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  PersonAdd as PersonAddIcon,
  Check as CheckIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useThemeContext } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { doc, updateDoc, arrayRemove, getDoc, setDoc, deleteDoc, collection, getDocs, orderBy, serverTimestamp, query } from 'firebase/firestore';
import { toast } from 'react-hot-toast';

interface FollowRequest {
  id: string;
  userId: string;
  username: string;
  timestamp: any;
}

const Settings: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { isDarkMode, toggleDarkMode } = useThemeContext();
  const { currentUser } = useAuth();
  const [devices, setDevices] = useState<Array<{ id: string; name: string; lastActive: string }>>([]);
  const [showDeviceDialog, setShowDeviceDialog] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);

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
      title: 'Safety & Community Guidelines',
      icon: <ShieldIcon />,
      path: '/safety',
      description: 'Review our safety policies and community guidelines'
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

  useEffect(() => {
    if (currentUser) {
      // Fetch privacy settings
      const fetchPrivacySettings = async () => {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setIsPrivate(userDoc.data().isPrivate || false);
        }
      };

      // Fetch follow requests
      const fetchFollowRequests = async () => {
        const requestsQuery = query(
          collection(db, `users/${currentUser.uid}/followRequests`),
          orderBy('timestamp', 'desc')
        );
        const snapshot = await getDocs(requestsQuery);
        const requests = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: data.userId,
            username: data.username,
            timestamp: data.timestamp
          } as FollowRequest;
        });
        setFollowRequests(requests);
      };

      fetchPrivacySettings();
      fetchFollowRequests();
    }
  }, [currentUser]);

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

  const handlePrivacyToggle = async () => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        isPrivate: !isPrivate
      });
      setIsPrivate(!isPrivate);
      toast.success(`Account is now ${!isPrivate ? 'private' : 'public'}`);
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      toast.error('Failed to update privacy settings');
    }
  };

  const handleFollowRequest = async (requestId: string, userId: string, accept: boolean) => {
    if (!currentUser) return;
    try {
      // Delete the request
      await deleteDoc(doc(db, `users/${currentUser.uid}/followRequests`, requestId));

      if (accept) {
        // Add to followers
        await setDoc(doc(db, `users/${currentUser.uid}/followers`, userId), {
          timestamp: serverTimestamp()
        });
        // Add to following for the requester
        await setDoc(doc(db, `users/${userId}/following`, currentUser.uid), {
          timestamp: serverTimestamp()
        });
        toast.success('Follow request accepted');
      } else {
        toast.success('Follow request declined');
      }

      // Update local state
      setFollowRequests(prev => prev.filter(req => req.id !== requestId));
    } catch (error) {
      console.error('Error handling follow request:', error);
      toast.error('Failed to process follow request');
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

        {/* Privacy Settings */}
        <Box sx={{ mb: 4, mt: 4 }}>
          <Typography variant="h6" gutterBottom>Privacy Settings</Typography>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            p: 2,
            bgcolor: 'background.paper',
            borderRadius: 1,
            boxShadow: 1
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {isPrivate ? <LockIcon color="primary" /> : <LockOpenIcon color="primary" />}
              <Box>
                <Typography variant="subtitle1">Private Account</Typography>
                <Typography variant="body2" color="text.secondary">
                  {isPrivate 
                    ? 'Only approved followers can see your content' 
                    : 'Anyone can see your content'}
                </Typography>
              </Box>
            </Box>
            <Switch
              checked={isPrivate}
              onChange={handlePrivacyToggle}
              color="primary"
            />
          </Box>

          {/* Follow Requests */}
          {isPrivate && followRequests.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" gutterBottom>Follow Requests</Typography>
              <List>
                {followRequests.map(request => (
                  <ListItem
                    key={request.id}
                    sx={{
                      bgcolor: 'background.paper',
                      borderRadius: 1,
                      mb: 1,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar>{request.username[0]}</Avatar>
                      <Box>
                        <Typography variant="subtitle1">@{request.username}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {new Date(request.timestamp?.toDate()).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton
                        color="success"
                        onClick={() => handleFollowRequest(request.id, request.userId, true)}
                      >
                        <CheckIcon />
                      </IconButton>
                      <IconButton
                        color="error"
                        onClick={() => handleFollowRequest(request.id, request.userId, false)}
                      >
                        <CloseIcon />
                      </IconButton>
                    </Box>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </Box>
      </Box>
    </Container>
  );
};

export default Settings; 