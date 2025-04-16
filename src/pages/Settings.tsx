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
  Avatar,
  TextField
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
  Close as CloseIcon,
  Code as CodeIcon
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useThemeContext } from '../contexts/ThemeContext';
import { useAuth, usePrivacy } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { doc, updateDoc, arrayRemove, getDoc, setDoc, deleteDoc, collection, getDocs, orderBy, serverTimestamp, query, onSnapshot } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import type { UserProfile } from '../types';
import bcrypt from 'bcryptjs';

interface FollowRequest {
  id: string;
  userId: string;
  username: string;
  timestamp: any;
}

const DeviceSelector = () => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState('');

  useEffect(() => {
    const getDevices = async () => {
      const deviceInfos: MediaDeviceInfo[] = await navigator.mediaDevices.enumerateDevices();
      setDevices(deviceInfos);
    };

    getDevices();
  }, []);

  const handleAudioChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedAudioDevice(event.target.value);
  };

  const handleVideoChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedVideoDevice(event.target.value);
  };

  const startStream = async () => {
    const constraints = {
      audio: { deviceId: selectedAudioDevice ? { exact: selectedAudioDevice } : undefined },
      video: { deviceId: selectedVideoDevice ? { exact: selectedVideoDevice } : undefined },
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      // Attach the stream to a video element or handle it as needed
    } catch (error) {
      console.error('Error accessing media devices.', error);
    }
  };

  return (
    <div>
      <h3>Select Audio and Video Devices</h3>
      <div>
        <label>Audio Input:</label>
        <select onChange={handleAudioChange} value={selectedAudioDevice}>
          {devices
            .filter((device) => device.kind === 'audioinput')
            .map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${device.deviceId}`}
              </option>
            ))}
        </select>
      </div>
      <div>
        <label>Video Input:</label>
        <select onChange={handleVideoChange} value={selectedVideoDevice}>
          {devices
            .filter((device) => device.kind === 'videoinput')
            .map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${device.deviceId}`}
              </option>
            ))}
        </select>
      </div>
      <button onClick={startStream}>Start Stream</button>
    </div>
  );
};

const Settings: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { isDarkMode, toggleDarkMode } = useThemeContext();
  const { currentUser, userProfile } = useAuth();
  const { canViewProfile, canViewContent } = usePrivacy();
  const [devices, setDevices] = useState<Array<{ id: string; name: string; lastActive: string }>>([]);
  const [showDeviceDialog, setShowDeviceDialog] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [privacyStats, setPrivacyStats] = useState({
    followers: 0,
    following: 0,
    pendingRequests: 0
  });
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [showCreateCodeDialog, setShowCreateCodeDialog] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [newVerificationCode, setNewVerificationCode] = useState('');
  const [registrationSourceCode, setRegistrationSourceCode] = useState('');
  const [showSourceCodeDialog, setShowSourceCodeDialog] = useState(false);
  const [sourceCode, setSourceCode] = useState('');

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
      // Add real-time listener for privacy settings and stats
      const userRef = doc(db, 'users', currentUser.uid);
      const unsubscribe = onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
          const userData = doc.data();
          setIsPrivate(userData.isPrivate || false);
          
          // Update privacy stats
          setPrivacyStats({
            followers: userData.followers?.length || 0,
            following: userData.following?.length || 0,
            pendingRequests: followRequests.length
          });
        }
      });

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

      fetchFollowRequests();
      return () => unsubscribe();
    }
  }, [currentUser, followRequests.length]);

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
    if (!currentUser?.uid) return;
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        isPrivate: !isPrivate,
        updatedAt: serverTimestamp()
      });
      
      // If switching to public, auto-accept all pending follow requests
      if (!isPrivate) {
        for (const request of followRequests) {
          await handleFollowRequest(request.id, request.userId, true);
        }
      }
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

  const handleViewSourceCode = async () => {
    if (!currentUser) return;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.verificationCode) {
          // User has a verification code, show verification dialog
          setShowVerificationDialog(true);
        } else {
          // User needs to create a verification code
          setShowCreateCodeDialog(true);
        }
      }
    } catch (error) {
      console.error('Error checking verification code:', error);
      toast.error('Failed to check verification status');
    }
  };

  const handleCreateVerificationCode = async () => {
    if (!currentUser || !newVerificationCode) return;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        verificationCode: newVerificationCode
      });
      setShowCreateCodeDialog(false);
      setShowVerificationDialog(true);
      toast.success('Verification code created successfully');
    } catch (error) {
      console.error('Error creating verification code:', error);
      toast.error('Failed to create verification code');
    }
  };

  const handleVerifyCode = async () => {
    if (!currentUser) return;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.verificationCode === verificationCode) {
          // Show the source code
          setSourceCode(userData.sourceCodeHash ? verificationCode : '');
          setShowSourceCodeDialog(true);
          setShowVerificationDialog(false);
          toast.success('Code verified successfully');
        } else {
          toast.error('Invalid verification code');
        }
      }
    } catch (error) {
      console.error('Error verifying code:', error);
      toast.error('Failed to verify code');
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
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
              {/* Add DeviceSelector component */}
              <DeviceSelector />
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowDeviceDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Enhanced Privacy Settings Section */}
        <Box sx={{ mb: 4, mt: 4 }}>
          <Typography variant="h6" gutterBottom>Privacy Settings</Typography>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              mb: 2
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

            {/* Privacy Stats */}
            <Box sx={{ 
              display: 'flex', 
              gap: 3, 
              mt: 2,
              p: 2,
              bgcolor: 'background.default',
              borderRadius: 1
            }}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Followers</Typography>
                <Typography variant="h6">{privacyStats.followers}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Following</Typography>
                <Typography variant="h6">{privacyStats.following}</Typography>
              </Box>
              {isPrivate && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Pending Requests</Typography>
                  <Typography variant="h6">{privacyStats.pendingRequests}</Typography>
                </Box>
              )}
            </Box>

            {/* Privacy Tips */}
            <Alert severity="info" sx={{ mt: 2 }}>
              {isPrivate 
                ? 'When your account is private, only approved followers can see your content. New followers must send a follow request.'
                : 'When your account is public, anyone can see your content and follow you without approval.'}
            </Alert>

            <Divider />
            <ListItem button onClick={handleViewSourceCode}>
              <ListItemIcon>
                <CodeIcon />
              </ListItemIcon>
              <ListItemText 
                primary="View Registration Source Code" 
                secondary="Verify your code to view your registration source code"
              />
            </ListItem>
          </Paper>
        </Box>

        {/* Create Verification Code Dialog */}
        <Dialog
          open={showCreateCodeDialog}
          onClose={() => setShowCreateCodeDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Create Verification Code</DialogTitle>
          <DialogContent>
            <TextField
              label="Create a verification code"
              value={newVerificationCode}
              onChange={(e) => setNewVerificationCode(e.target.value)}
              fullWidth
              margin="normal"
              type="password"
              inputProps={{
                maxLength: 8,
                inputMode: 'numeric',
                pattern: '[0-9]*'
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowCreateCodeDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateVerificationCode} variant="contained">Create</Button>
          </DialogActions>
        </Dialog>

        {/* Verify Code Dialog */}
        <Dialog
          open={showVerificationDialog}
          onClose={() => setShowVerificationDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Verify Code</DialogTitle>
          <DialogContent>
            <TextField
              label="Enter your verification code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              fullWidth
              margin="normal"
              type="password"
              inputProps={{
                maxLength: 8,
                inputMode: 'numeric',
                pattern: '[0-9]*'
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowVerificationDialog(false)}>Cancel</Button>
            <Button onClick={handleVerifyCode} variant="contained">Verify</Button>
          </DialogActions>
        </Dialog>

        {/* View Source Code Dialog */}
        <Dialog
          open={showSourceCodeDialog}
          onClose={() => setShowSourceCodeDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Your Registration Source Code</DialogTitle>
          <DialogContent>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1, 
              mb: 3,
              color: 'info.main'
            }}>
              <InfoIcon color="info" />
              <Typography sx={{ 
                color: 'info.main',
                fontSize: '1rem'
              }}>
                When your account is used on another device, you will need this Source Code to register your account.
              </Typography>
            </Box>
            <Box sx={{ 
              p: 2, 
              bgcolor: 'background.paper', 
              borderRadius: 1,
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              overflow: 'auto',
              maxHeight: '60vh',
              fontSize: '24px',
              textAlign: 'center'
            }}>
              {sourceCode}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowSourceCodeDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>

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
    </Container>
  );
};

export default Settings; 