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
  TextField,
  ListItemButton,
  ListItemAvatar,
  ListItemAvatarProps,
  CircularProgress
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
  Code as CodeIcon,
  HelpOutline as HelpOutlineIcon,
  ReportProblem as ReportProblemIcon,
  Chat as ChatIcon,
  SmartToy as SmartToyIcon,
  Block as BlockIcon,
  AccountBalanceWallet as WalletIcon,
  CardGiftcard as GiftIcon,
  TrendingUp as TrendingUpIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { useThemeContext } from '../contexts/ThemeContext';
import { useAuth, usePrivacy } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { doc, updateDoc, arrayRemove, getDoc, setDoc, deleteDoc, collection, getDocs, orderBy, serverTimestamp, query, onSnapshot, addDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import type { UserProfile } from '../types';
import bcrypt from 'bcryptjs';
import SCCoinIcon from '../components/SCCoinIcon';

interface FollowRequest {
  id: string;
  userId: string;
  username: string;
  timestamp: any;
}

interface UserProfileData {
  id: string;
  userId?: string;
  username?: string;
  name?: string;
  profilePic?: string;
  timestamp: any;
}

const DeviceSelector = () => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch (err) {
        console.warn("Error requesting media permissions for device enumeration:", err);
      }
      try {
        const deviceInfos: MediaDeviceInfo[] = await navigator.mediaDevices.enumerateDevices();
        setDevices(deviceInfos.filter(d => d.deviceId));
        const defaultAudioInput = deviceInfos.find(d => d.kind === 'audioinput');
        if (defaultAudioInput && !selectedAudioDevice) {
          setSelectedAudioDevice(defaultAudioInput.deviceId);
        }
      } catch (error) {
        console.error("Error enumerating devices:", error);
      }
    };

    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    getDevices();

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    };
  }, []);

  const handleAudioChange = (value: string) => {
    setSelectedAudioDevice(value);
    console.log("Selected Audio Input:", value);
  };

  return (
    <Box sx={{ my: 2 }}>
      <Typography variant="subtitle1" gutterBottom>Audio Input Device</Typography>
      <TextField
        select
        SelectProps={{ native: true }}
        value={selectedAudioDevice}
        onChange={(event) => handleAudioChange(event.target.value)}
        label="Microphone"
        fullWidth
        variant="outlined"
        size="small"
        disabled={devices.filter((device) => device.kind === 'audioinput').length === 0}
      >
        {devices.filter((device) => device.kind === 'audioinput').length > 0 ? (
          devices
            .filter((device) => device.kind === 'audioinput')
            .map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${device.deviceId.substring(0, 8)}...`}
              </option>
            ))
        ) : (
          <option value="">No microphones found</option>
        )}
      </TextField>
    </Box>
  );
};

const BlockedUsersList: React.FC = () => {
  const { currentUser, unblockUser } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<UserProfileData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  
  useEffect(() => {
    if (!currentUser?.uid || !db) return;
    
    const fetchBlockedUsers = async () => {
      try {
        setIsLoading(true);
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
          setIsLoading(false);
          return;
        }
        
        const userData = userDoc.data();
        const blockedUserIds = userData.blockedUsers || [];
        
        if (blockedUserIds.length === 0) {
          setBlockedUsers([]);
          setIsLoading(false);
          return;
        }
        
        const fetchedBlockedUsers = await Promise.all(
          blockedUserIds.map(async (userId: string) => {
            try {
              const blockedUserRef = doc(db, 'users', userId);
              const blockedUserDoc = await getDoc(blockedUserRef);
              
              if (blockedUserDoc.exists()) {
                const blockedUserData = blockedUserDoc.data();
                return {
                  id: userId,
                  userId: userId,
                  username: blockedUserData.username || 'Unknown User',
                  name: blockedUserData.name,
                  profilePic: blockedUserData.profilePic,
                  timestamp: new Date()
                };
              } else {
                return {
                  id: userId,
                  userId: userId,
                  username: 'Unknown User',
                  timestamp: new Date()
                };
              }
            } catch (error) {
              console.error(`Error fetching blocked user ${userId}:`, error);
              return {
                id: userId,
                userId: userId,
                username: 'Unknown User',
                timestamp: new Date()
              };
            }
          })
        );
        
        setBlockedUsers(fetchedBlockedUsers);
      } catch (error) {
        console.error('Error fetching blocked users:', error);
        toast.error('Failed to load blocked users');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBlockedUsers();
  }, [currentUser?.uid, db]);
  
  const handleUnblockUser = async (userId: string) => {
    if (!currentUser) return;
    
    try {
      setLoadingUserId(userId);
      await unblockUser(userId);
      setBlockedUsers(prev => prev.filter(user => user.userId !== userId));
      toast.success('User unblocked successfully');
    } catch (error) {
      console.error('Error unblocking user:', error);
      toast.error('Failed to unblock user');
    } finally {
      setLoadingUserId(null);
    }
  };
  
  if (isLoading) {
    return (
      <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={20} />
      </Box>
    );
  }
  
  if (blockedUsers.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 1 }}>
        You haven't blocked any users.
      </Typography>
    );
  }
  
  return (
    <List sx={{ py: 0 }}>
      {blockedUsers.map(user => (
        <ListItem
          key={user.userId || user.id}
          secondaryAction={
            <Button
              variant="outlined"
              size="small"
              color="primary"
              startIcon={loadingUserId === user.userId ? <CircularProgress size={16} /> : <BlockIcon />}
              onClick={() => user.userId && handleUnblockUser(user.userId)}
              disabled={loadingUserId === user.userId || !user.userId}
            >
              Unblock
            </Button>
          }
          sx={{ px: 0, py: 1 }}
        >
          <ListItemAvatar>
            <Avatar src={user.profilePic} sx={{ width: 40, height: 40 }}>
              {user.username ? user.username[0]?.toUpperCase() : '?'}
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={user.name || user.username}
            secondary={user.username ? `@${user.username}` : `User ${(user.userId || user.id || '').substring(0, 5)}`}
          />
        </ListItem>
      ))}
    </List>
  );
};

const Settings: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { isDarkMode, toggleDarkMode } = useThemeContext();
  const { currentUser, userProfile, unblockUser } = useAuth();
  const { canViewProfile, canViewContent } = usePrivacy();
  const [showDeviceDialog, setShowDeviceDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [privacyStats, setPrivacyStats] = useState({
    followers: 0,
    following: 0,
    pendingRequests: 0,
    sideRooms: 0
  });
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [showCreateCodeDialog, setShowCreateCodeDialog] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [newVerificationCode, setNewVerificationCode] = useState('');
  const [registrationSourceCode, setRegistrationSourceCode] = useState('');
  const [showSourceCodeDialog, setShowSourceCodeDialog] = useState(false);
  const [sourceCode, setSourceCode] = useState('');
  const [sourceCodeInput, setSourceCodeInput] = useState('');
  const [emailNotifications, setEmailNotifications] = useState({
    sideRoomNotifications: true,
    messageNotifications: true, 
    followNotifications: true
  });
  const [enhancedFollowRequests, setEnhancedFollowRequests] = useState<UserProfileData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingRequestId, setLoadingRequestId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Handle hash navigation for SideCoins guide
  useEffect(() => {
    const handleHashNavigation = () => {
      if (window.location.hash === '#sidecoins-guide') {
        setTimeout(() => {
          const element = document.querySelector('[data-section="sidecoins-guide"]');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100); // Small delay to ensure page is rendered
      }
    };

    // Check on component mount
    handleHashNavigation();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashNavigation);

    return () => {
      window.removeEventListener('hashchange', handleHashNavigation);
    };
  }, []);

  const handlePrivacyToggle = async () => {
    if (!currentUser?.uid) return;
    const newPrivacyState = !isPrivate;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        isPrivate: newPrivacyState,
        updatedAt: serverTimestamp()
      });

      setIsPrivate(newPrivacyState);
      toast.success(`Account set to ${newPrivacyState ? 'Private' : 'Public'}`);

      if (!newPrivacyState && followRequests.length > 0) {
        toast.loading('Accepting pending requests...', { id: 'accepting-requests' });
        const acceptPromises = followRequests.map(request =>
          handleFollowRequest(request.id, request.userId, true)
        );
        await Promise.all(acceptPromises);
        toast.dismiss('accepting-requests');
        toast.success('All pending requests accepted.');
      }
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      toast.error('Failed to update privacy settings');
      setIsPrivate(!newPrivacyState);
    }
  };

  const handleFollowRequest = async (requestId: string, userId: string, accept: boolean) => {
    if (!currentUser) return;
    const currentUserUid = currentUser.uid;
    
    // Use requestId as fallback if userId is empty
    const actualUserId = userId || requestId;

    // Set loading for this specific request
    setLoadingRequestId(requestId);
    
    try {
      // 1. First delete the request regardless of accept/reject
      const requestRef = doc(db, `users/${currentUserUid}/followRequests`, requestId);
      await deleteDoc(requestRef);

      if (accept) {
        // 2. If accepting, add to followers collection
        const followerRef = doc(db, `users/${currentUserUid}/followers`, actualUserId);
        await setDoc(followerRef, {
          userId: actualUserId,
          timestamp: serverTimestamp()
        });
        
        // 3. Add current user to the follower's following collection
        const followingRef = doc(db, `users/${actualUserId}/following`, currentUserUid);
        await setDoc(followingRef, {
          userId: currentUserUid,
          timestamp: serverTimestamp()
        });
        
        // 4. Update counters in the UI
        setPrivacyStats(prev => ({
          ...prev,
          followers: prev.followers + 1,
          pendingRequests: prev.pendingRequests - 1
        }));
        
        // 5. Create notification for the follower (optional)
        try {
          const currentUserDoc = await getDoc(doc(db, 'users', currentUserUid));
          if (currentUserDoc.exists()) {
            const userData = currentUserDoc.data();
            const notificationRef = collection(db, 'notifications');
            await addDoc(notificationRef, {
              type: 'follow_accepted',
              userId: actualUserId,
              fromUserId: currentUserUid,
              fromUsername: userData.username || '',
              fromProfilePic: userData.profilePic || '',
              message: `${userData.username || 'User'} has accepted your follow request`,
              timestamp: serverTimestamp(),
              read: false
            });
          }
        } catch (notifError) {
          console.error('Error creating notification:', notifError);
          // Continue even if notification fails
        }
        
        toast.success('Follow request accepted');
      } else {
        // Just remove the request if declining
        setPrivacyStats(prev => ({
          ...prev,
          pendingRequests: prev.pendingRequests - 1
        }));
        
        toast.success('Follow request declined');
      }

      // 6. Remove the request from our local state to update UI immediately
      setFollowRequests(prev => prev.filter(req => req.id !== requestId));
      setEnhancedFollowRequests(prev => prev.filter(req => req.id !== requestId));
      
    } catch (error) {
      console.error('Error handling follow request:', error);
      toast.error('Failed to process follow request');
    } finally {
      setLoadingRequestId(null);
    }
  };

  const handleViewSourceCode = async () => {
    if (!currentUser) return;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.sourceCodeHash) {
          // If they have a source code hash, show the dialog to enter their source code
          setShowVerificationDialog(true);
        } else {
          // If they don't have a source code set up yet, show the dialog to create one
          setShowCreateCodeDialog(true);
          toast.error("You need to set up your source code first");
        }
      } else {
        toast.error("User data not found.");
      }
    } catch (error) {
      console.error('Error checking source code:', error);
      toast.error('Failed to check source code status');
    }
  };

  const handleCreateVerificationCode = async () => {
    if (!currentUser || !newVerificationCode || newVerificationCode.length < 4) {
      toast.error("Verification code must be at least 4 digits.");
      return;
    }
    if (!/^\d+$/.test(newVerificationCode)) {
      toast.error("Verification code must contain only digits.");
      return;
    }

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        verificationCode: newVerificationCode,
        updatedAt: serverTimestamp()
      });
      setNewVerificationCode('');
      setShowCreateCodeDialog(false);
      toast.success('Verification code created successfully. You can now view your Registration Code.');
    } catch (error) {
      console.error('Error creating verification code:', error);
      toast.error('Failed to create verification code');
    }
  };

  const handleVerifyCode = async () => {
    if (!currentUser || !verificationCode) return;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const sourceCodeHash = userData.sourceCodeHash;

        // Use bcrypt to compare entered code with the stored hash
        if (sourceCodeHash && bcrypt.compareSync(verificationCode, sourceCodeHash)) {
          // If the source code is correct, show confirmation of their source code
          setSourceCode(verificationCode); // Use the entered code
          setShowSourceCodeDialog(true);
          setShowVerificationDialog(false);
          setVerificationCode('');
          toast.success('Identity verified successfully');
        } else {
          toast.error('Invalid source code');
        }
      } else {
        toast.error("User data not found.");
      }
    } catch (error) {
      console.error('Error verifying code:', error);
      toast.error('Failed to verify code');
    }
  };

  const handleEmailNotificationToggle = async (type: 'sideRoomNotifications' | 'messageNotifications' | 'followNotifications') => {
    if (!currentUser?.uid) return;
    
    try {
      const newValue = !emailNotifications[type];
      setEmailNotifications(prev => ({
        ...prev,
        [type]: newValue
      }));
      
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        [`emailPreferences.${type}`]: newValue,
        updatedAt: serverTimestamp()
      });
      
      toast.success(`${type === 'sideRoomNotifications' ? 'Side Room' : 
                    type === 'messageNotifications' ? 'Message' : 
                    'Follow'} email notifications ${newValue ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error(`Error updating ${type} preference:`, error);
      toast.error(`Failed to update notification preferences`);
      // Revert UI state on error
      setEmailNotifications(prev => ({
        ...prev,
        [type]: !prev[type]
      }));
    }
  };

  const settingsItems = [
    {
      title: 'Theme & Audio Settings',
      icon: <DevicesIcon />,
      description: 'Manage your theme and audio devices and microphone settings',
      onClick: () => setShowDeviceDialog(true),
      isSetting: true
    },
    {
      title: 'SideCoins & Earnings Guide',
      icon: <WalletIcon />,
      description: 'Learn how to earn SideCoins and where to find your earnings',
      onClick: () => {
        // Scroll to the SideCoins guide section
        const element = document.querySelector('[data-section="sidecoins-guide"]');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      },
      isSetting: true
    },
    {
      title: 'Security & Authentication',
      icon: <SecurityIcon />,
      path: '/security',
      description: 'Learn about our authentication flow and security features',
      isSetting: true
    },
    {
      title: 'Account Management',
      icon: <ManageAccountsIcon />,
      path: '/account-management',
      description: 'Manage your account settings, profile, and messaging preferences',
      isSetting: true
    },
    {
      title: 'About The Founder',
      icon: <InfoIcon />,
      path: '/about-founder',
      description: 'Learn about Enoch Asekomhe, the founder and developer of SideEye',
      isSetting: true
    },
    {
      title: 'View Source Code',
      icon: <CodeIcon />,
      description: 'View your unique source code for new devices',
      onClick: handleViewSourceCode,
      isSetting: true
    },
    {
      title: 'Report an Issue',
      icon: <ReportProblemIcon />,
      path: '/report',
      description: 'Report a bug, user, or other problem',
      isHelp: true
    },
    {
      title: 'Get Help via Sade AI',
      icon: <ChatIcon />,
      description: 'Chat with Sade AI for general help or assistance',
      onClick: () => {
        navigate('/sade-ai?intent=help');
      },
      isHelp: true
    },
    {
      title: 'Safety & Community Guidelines',
      icon: <ShieldIcon />,
      path: '/safety',
      description: 'Review our Side Room guidelines and community standards for chat and messaging',
      isHelp: true
    },
    {
      title: 'About SideEye',
      icon: <InfoIcon />,
      path: '/about',
      description: 'Learn more about SideEye and our mission',
      isHelp: true
    },
    {
      title: 'Privacy Policy',
      icon: <PolicyIcon />,
      path: '/privacy-policy',
      description: 'Read our privacy policy and data handling practices',
      isHelp: true
    },
    {
      title: 'Terms of Service',
      icon: <PolicyIcon />,
      path: '/terms',
      description: 'Review our terms of service',
      isHelp: true
    },
    {
      title: 'Cookie Policy',
      icon: <CookieIcon />,
      path: '/cookies',
      description: 'Learn about how we use cookies',
      isHelp: true
    },
    {
      title: 'About Sade AI',
      icon: <InfoIcon />,
      path: '/sade-ai-info',
      description: 'Learn about Sade AI, her features and capabilities',
      isHelp: true
    },
    {
      title: 'Chat with Sade AI',
      icon: <SmartToyIcon />,
      path: '/sade-ai',
      description: 'Have a conversation with our AI assistant',
      isHelp: true
    }
  ];

  useEffect(() => {
    if (currentUser) {
      const userRef = doc(db, 'users', currentUser.uid);
      const unsubscribeUser = onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
          const userData = doc.data();
          setIsPrivate(userData.isPrivate || false);
          
          // Load email notification preferences
          if (userData.emailPreferences) {
            setEmailNotifications({
              sideRoomNotifications: userData.emailPreferences.sideRoomNotifications !== false, // Default to true
              messageNotifications: userData.emailPreferences.messageNotifications !== false, // Default to true
              followNotifications: userData.emailPreferences.followNotifications !== false // Default to true
            });
          }
          
          setPrivacyStats(prev => ({
            ...prev,
            followers: userData.followers?.length || 0,
            following: userData.following?.length || 0,
            sideRooms: userData.sideRooms?.length || 0
          }));
        }
      });

      const requestsQuery = query(
        collection(db, `users/${currentUser.uid}/followRequests`),
        orderBy('timestamp', 'desc')
      );
      const unsubscribeRequests = onSnapshot(requestsQuery, (snapshot) => {
        const requests = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: data.userId || doc.id,
            username: data.username || (data.userId ? `User_${data.userId.substring(0, 5)}` : `User_${doc.id.substring(0, 5)}`),
            timestamp: data.timestamp
          } as FollowRequest;
        });
        setFollowRequests(requests);
        
        setPrivacyStats(prev => ({
           ...prev,
           pendingRequests: requests.length
        }));
      }, (error) => {
        console.error("Error fetching follow requests:", error);
      });

      return () => {
        unsubscribeUser();
        unsubscribeRequests();
      };
    }
  }, [currentUser]);

  useEffect(() => {
    if (!followRequests.length) {
      setEnhancedFollowRequests([]);
      return;
    }

    const fetchUserProfiles = async () => {
      const enhancedRequests = await Promise.all(
        followRequests.map(async (request) => {
          try {
            // Use userId from request, fall back to request.id which could be the userId
            const userId = request.userId || request.id;
            const userRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userRef);
            
            if (userDoc.exists()) {
              const userData = userDoc.data();
              return {
                id: request.id,
                userId: userId,
                username: userData.username || request.username,
                name: userData.name,
                profilePic: userData.profilePic,
                timestamp: request.timestamp
              };
            } else {
              // User document not found, use existing data
              return {
                id: request.id,
                userId: userId,
                username: request.username,
                timestamp: request.timestamp
              };
            }
          } catch (error) {
            console.error(`Error fetching user profile for ${request.userId}:`, error);
            // Return the original request data on error
            return {
              id: request.id,
              userId: request.userId || request.id,
              username: request.username,
              timestamp: request.timestamp
            };
          }
        })
      );
      
      setEnhancedFollowRequests(enhancedRequests);
    };

    fetchUserProfiles();
  }, [followRequests, db]);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 'bold' }}>
          Settings
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Paper elevation={0} sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
          <List disablePadding>
            {settingsItems
              .filter(item => item.isSetting)
              .map((item, index, arr) => (
                <React.Fragment key={item.title}>
                  <ListItemButton
                    component={item.path ? Link : 'div'}
                    to={item.path}
                    onClick={item.onClick}
                    sx={{ py: 1.5, px: 2 }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.title}
                      secondary={item.description}
                      primaryTypographyProps={{ fontWeight: 500 }}
                    />
                  </ListItemButton>
                  {index < arr.length - 1 && <Divider />}
                </React.Fragment>
              ))}
          </List>
        </Paper>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>Privacy</Typography>
        <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {isPrivate ? <LockIcon color="action" /> : <LockOpenIcon color="action" />}
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>Private Account</Typography>
                <Typography variant="caption" color="text.secondary">
                  {isPrivate
                    ? 'Only approved followers can join your Side Rooms.'
                    : 'Anyone can join your Side Rooms.'}
                </Typography>
              </Box>
            </Box>
            <Switch
              checked={isPrivate}
              onChange={handlePrivacyToggle}
              color="primary"
            />
          </Box>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">Followers</Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>{privacyStats.followers}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">Following</Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>{privacyStats.following}</Typography>
            </Box>
            {isPrivate && (
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">Pending Requests</Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>{privacyStats.pendingRequests}</Typography>
              </Box>
            )}
          </Box>
          
          {/* Blocked Users Section */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 500 }}>
              Blocked Users
            </Typography>
            <BlockedUsersList />
          </Box>
          
          {isPrivate && followRequests.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Follow Requests
              </Typography>
              <List>
                {enhancedFollowRequests.map((request) => (
                  <ListItem 
                    key={request.id}
                    secondaryAction={
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton 
                          size="small"
                          color="success"
                          onClick={() => handleFollowRequest(request.id, request.userId || request.id, true)}
                          title="Accept"
                          disabled={loadingRequestId === request.id}
                        >
                          <CheckIcon fontSize="small" />
                        </IconButton>
                        <IconButton 
                          size="small"
                          color="error"
                          onClick={() => handleFollowRequest(request.id, request.userId || request.id, false)}
                          title="Decline"
                          disabled={loadingRequestId === request.id}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    }
                    sx={{ mb: 1 }}
                  >
                    <ListItemAvatar>
                      {loadingRequestId === request.id ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: 40, height: 40 }}>
                          <CircularProgress size={24} />
                        </Box>
                      ) : (
                        <Avatar 
                          src={request.profilePic} 
                          sx={{ width: 40, height: 40 }}
                        >
                          {(request.username || request.name) ? 
                            (request.username || request.name || '')[0]?.toUpperCase() : 
                            (request.id || '')[0]?.toUpperCase() || '?'}
                        </Avatar>
                      )}
                    </ListItemAvatar>
                    <ListItemText 
                      primary={
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          {request.name && (
                            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                              {request.name}
                            </Typography>
                          )}
                          <Typography variant="body2" color={request.name ? "text.secondary" : "text.primary"}>
                            {request.username ? `@${request.username}` : `User ${request.id.substring(0, 5)}`}
                          </Typography>
                        </Box>
                      }
                      secondary={request.timestamp ? `Requested on ${new Date(request.timestamp?.toDate()).toLocaleDateString()}` : 'Recently'}
                    />
                  </ListItem>
                ))}
                {enhancedFollowRequests.length === 0 && followRequests.length > 0 && (
                  <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
                    <CircularProgress size={30} />
                  </Box>
                )}
              </List>
            </Box>
          )}
        </Paper>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>Email Notifications</Typography>
        <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>Side Room Notifications</Typography>
                <Typography variant="caption" color="text.secondary">
                  Receive emails when users you follow create or join Side Rooms
                </Typography>
              </Box>
              <Switch
                checked={emailNotifications.sideRoomNotifications}
                onChange={() => handleEmailNotificationToggle('sideRoomNotifications')}
                color="primary"
              />
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>Message Notifications</Typography>
                <Typography variant="caption" color="text.secondary">
                  Receive emails for new direct messages
                </Typography>
              </Box>
              <Switch
                checked={emailNotifications.messageNotifications}
                onChange={() => handleEmailNotificationToggle('messageNotifications')}
                color="primary"
              />
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>Follow Notifications</Typography>
                <Typography variant="caption" color="text.secondary">
                  Receive emails when someone follows you
                </Typography>
              </Box>
              <Switch
                checked={emailNotifications.followNotifications}
                onChange={() => handleEmailNotificationToggle('followNotifications')}
                color="primary"
              />
            </Box>
          </Box>
        </Paper>
      </Box>

      <Box sx={{ mb: 4 }} data-section="sidecoins-guide">
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>SideCoins & Earnings Guide</Typography>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Header with SideCoin icon */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <SCCoinIcon size="large" />
              <Box>
                <Typography variant="h6" gutterBottom>
                  Understanding SideCoins
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Learn how to earn and track your SideCoins through gifting and live streaming
                </Typography>
              </Box>
            </Box>

            {/* SideCoins Value Section */}
            <Box>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                💰 SideCoins Currency System
              </Typography>
              <Box sx={{ pl: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2">
                  <strong>Two-Tier Currency:</strong> SideCoins work like real money with main units and fractional units
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
                  • <strong>SideCoins (SC)</strong> = Main currency (like £1, $1)<br/>
                  • <strong>LittleCoins (LC)</strong> = Fractional currency (like pence, cents)<br/>
                  • <strong>1 SideCoin = 100 LittleCoins</strong>
                </Typography>
                <Typography variant="body2" sx={{ pl: 2, mt: 1 }}>
                  <strong>Examples:</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ pl: 4 }}>
                  • 11 gifts received = 0.88 SC = 88 LC<br/>
                  • Each gift = 0.08 SC = 8 LC<br/>
                  • 1,000 gifts = 80 SC = 8,000 LC
                </Typography>
                <Typography variant="caption" color="primary.main" sx={{ pl: 2, fontWeight: 500 }}>
                  💡 Think of it like pounds and pence - your earnings have real fractional value!
                </Typography>
              </Box>
            </Box>

            {/* How to Earn Section */}
            <Box>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUpIcon color="primary" />
                How to Earn SideCoins
              </Typography>
              <Box sx={{ pl: 4, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <GiftIcon color="secondary" fontSize="small" />
                  <Typography variant="body2">
                    <strong>Receive Gifts:</strong> Earn 0.08 SideCoins for each gift you receive during live streams
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <VisibilityIcon color="primary" fontSize="small" />
                  <Typography variant="body2">
                    <strong>Host Live Rooms:</strong> Create engaging content to attract viewers who send gifts
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ pl: 3 }}>
                  💡 Tip: 1,000 gifts received = 80 SC (8,000 LC) earned!
                </Typography>
              </Box>
            </Box>

            {/* Where to Find Earnings Section */}
            <Box>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                <WalletIcon color="primary" />
                Where to Find Your Earnings
              </Typography>
              <Box sx={{ pl: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    📊 Your Wallet (Main Menu)
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
                    • View your current SideCoins balance<br/>
                    • See total coins earned and spent<br/>
                    • Track your gift activity statistics
                  </Typography>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    component={Link} 
                    to="/wallet"
                    startIcon={<WalletIcon />}
                    sx={{ alignSelf: 'flex-start', mt: 1 }}
                  >
                    Open Wallet
                  </Button>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    🎁 Your Profile → Gifts Sent Tab
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
                    • View detailed history of all gifts you've sent<br/>
                    • See how much you've spent on premium gifts<br/>
                    • Track gifts sent across all rooms
                  </Typography>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    component={Link} 
                    to="/profile"
                    startIcon={<GiftIcon />}
                    sx={{ alignSelf: 'flex-start', mt: 1 }}
                  >
                    View Profile
                  </Button>
                </Box>
              </Box>
            </Box>

            {/* Gift Types Section */}
            <Box>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                Gift Types & Costs
              </Typography>
              <Box sx={{ pl: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2">
                  <strong>Free Gifts:</strong> Hearts, Side Eyes, Confetti, Crowns - Cost 0 SideCoins to send
                </Typography>
                <Typography variant="body2">
                  <strong>Premium Gifts:</strong> Coming soon - Require minimum 100.00 SC to unlock
                </Typography>
                <Typography variant="body2" color="primary.main" sx={{ pl: 2, fontWeight: 500 }}>
                  💎 <strong>Premium Threshold:</strong> Need 100.00 SC (10,000 LC) to send premium gifts
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ pl: 2 }}>
                  • Earn 100.00 SC by receiving ~1,250 gifts as a host<br/>
                  • Premium access shows you're an established creator<br/>
                  • Makes premium gifts truly special and valuable
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Note: You earn SideCoins from receiving any type of gift, regardless of whether it was free or premium
                </Typography>
              </Box>
            </Box>

            {/* Quick Access Buttons */}
            <Box sx={{ 
              display: 'flex', 
              gap: 2, 
              flexWrap: 'wrap',
              pt: 2,
              borderTop: `1px solid ${theme.palette.divider}`
            }}>
              <Button 
                variant="contained" 
                component={Link} 
                to="/discover"
                startIcon={<VisibilityIcon />}
              >
                Find Live Rooms
              </Button>
              <Button 
                variant="outlined" 
                component={Link} 
                to="/wallet"
                startIcon={<WalletIcon />}
              >
                Check Balance
              </Button>
            </Box>
          </Box>
        </Paper>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>Frequently Asked Questions</Typography>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: 2 }}>
            <HelpOutlineIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Need help with Source Codes or Security?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 500 }}>
              Visit our FAQ page to learn about source codes, security features, and get answers to commonly asked questions.
            </Typography>
            <Button 
              variant="contained" 
              component={Link} 
              to="/faq" 
              startIcon={<InfoIcon />}
              sx={{ minWidth: 200 }}
            >
              Visit FAQ Page
            </Button>
          </Box>
        </Paper>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>Sade AI Assistant</Typography>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3, alignItems: 'center' }}>
            <Avatar 
              src="/images/sade-avatar.jpg" 
              alt="Sade AI"
              sx={{ width: 80, height: 80 }}
            />
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" gutterBottom>
                Systematic AI for Detection and Engagement
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Sade (pronounced "SHA-DEY") is your AI companion with a British-Nigerian personality. 
                She can answer questions, search the web, play games, and help you navigate the SideEye app.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                <Button 
                  variant="contained" 
                  size="small" 
                  component={Link} 
                  to="/sade-ai"
                  startIcon={<SmartToyIcon />}
                >
                  Chat with Sade
                </Button>
                <Button 
                  variant="outlined" 
                  size="small" 
                  component={Link} 
                  to="/sade-ai-info"
                  startIcon={<InfoIcon />}
                >
                  Learn More
                </Button>
              </Box>
            </Box>
          </Box>
        </Paper>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>Help & Support</Typography>
        <Paper elevation={0} sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
          <List disablePadding>
            {settingsItems
              .filter(item => item.isHelp)
              .map((item, index, arr) => (
                <React.Fragment key={item.title}>
                  <ListItemButton
                    component={item.path ? Link : 'div'}
                    to={item.path}
                    onClick={item.onClick}
                    sx={{ py: 1.5, px: 2 }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.title}
                      secondary={item.description}
                      primaryTypographyProps={{ fontWeight: 500 }}
                    />
                  </ListItemButton>
                  {index < arr.length - 1 && <Divider />}
                </React.Fragment>
              ))}
          </List>
        </Paper>
      </Box>

      <Dialog
        open={showDeviceDialog}
        onClose={() => setShowDeviceDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Theme & Audio Settings</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Choose your preferred theme and audio settings.
          </Typography>
          <ListItem disablePadding>
             <ListItemIcon sx={{ minWidth: 40 }}>
                 <DarkModeIcon />
             </ListItemIcon>
             <ListItemText
                 primary="Dark Mode"
             />
             <Switch
                 checked={isDarkMode}
                 onChange={toggleDarkMode}
                 color="primary"
                 edge="end"
             />
          </ListItem>
          <Divider sx={{ my: 2 }}/>
          <DeviceSelector />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeviceDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showCreateCodeDialog} onClose={() => setShowCreateCodeDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create Verification Code</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Create a numeric code (4-8 digits) to verify your identity when viewing sensitive information like your registration code.
          </Typography>
          <TextField
            label="New Verification Code"
            value={newVerificationCode}
            onChange={(e) => setNewVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
            fullWidth
            margin="normal"
            type="password"
            inputProps={{
              maxLength: 8,
              inputMode: 'numeric',
              pattern: '[0-9]*',
              minLength: 4
            }}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateCodeDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateVerificationCode} variant="contained" disabled={newVerificationCode.length < 4}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showVerificationDialog} onClose={() => setShowVerificationDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Enter Your Source Code</DialogTitle>
        <DialogContent>
           <Typography variant="body2" color="text.secondary" gutterBottom>
            To view your registration code, please enter your source code for verification.
          </Typography>
          <TextField
            label="Source Code"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
            fullWidth
            margin="normal"
            type="password"
            inputProps={{
              maxLength: 8,
              inputMode: 'numeric',
              pattern: '[0-9]*'
            }}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyCode(); }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowVerificationDialog(false)}>Cancel</Button>
          <Button onClick={handleVerifyCode} variant="contained" disabled={!verificationCode}>Verify</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showSourceCodeDialog} onClose={() => setShowSourceCodeDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Your Source Code</DialogTitle>
        <DialogContent>
          <Alert severity="warning" icon={<InfoIcon />} sx={{ mb: 2 }}>
             Keep this code safe and private. You'll need it to log in on new devices. Do not share it.
          </Alert>
          <Typography variant="body2" gutterBottom>Source Code:</Typography>
          <Paper elevation={0} sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
             <Typography sx={{
               fontFamily: 'monospace',
               wordBreak: 'break-all',
               fontSize: '1.1rem',
               textAlign: 'center'
             }}>
               {sourceCode || "No source code found."}
             </Typography>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSourceCodeDialog(false)}>Close</Button>
           <Button
               onClick={() => {
                   navigator.clipboard.writeText(sourceCode);
                   toast.success("Source code copied!");
               }}
               disabled={!sourceCode}
           >
               Copy Code
           </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Settings; 