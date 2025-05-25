import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Box,
  Menu,
  MenuItem,
  Divider,
  Avatar,
  ListItemIcon,
  ListItemText,
  Badge,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Notifications as NotificationsIcon,
  Psychology,
  Lightbulb as LightbulbIcon,
  AccountBalanceWallet as WalletIcon,

} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { currentUser, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isLightbulbLit, setIsLightbulbLit] = useState(false);



  useEffect(() => {
    if (!currentUser?.uid) return;

    // Listen for conversations with unread messages
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let totalUnread = 0;
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const unreadCount = data.unreadCount?.[currentUser.uid] || 0;
        totalUnread += unreadCount;
      });
      
      setUnreadMessages(totalUnread);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Effect to listen for suggestion submissions and light up the bulb
  useEffect(() => {
    // Immediate effect handler for instant feedback
    const handleImmediateSuggestionSubmitted = () => {
      setIsLightbulbLit(true);
      
      // Turn off the light after 3 seconds
      setTimeout(() => {
        setIsLightbulbLit(false);
      }, 3000);
    };

    // Check for suggestion submission flag every 500ms (backup method)
    const checkForSuggestionSubmission = () => {
      const suggestionSubmitted = localStorage.getItem('suggestionSubmitted');
      
      if (suggestionSubmitted === 'true') {
        setIsLightbulbLit(true);
        
        // Clear the flag
        localStorage.removeItem('suggestionSubmitted');
        
        // Turn off the light after 3 seconds
        setTimeout(() => {
          setIsLightbulbLit(false);
        }, 3000);
      }
    };

    // Set up immediate event listener for instant feedback
    window.addEventListener('suggestionSubmittedImmediate', handleImmediateSuggestionSubmitted);

    // Set up polling interval as backup
    const interval = setInterval(checkForSuggestionSubmission, 500);

    return () => {
      window.removeEventListener('suggestionSubmittedImmediate', handleImmediateSuggestionSubmitted);
      clearInterval(interval);
    };
  }, []);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = async () => {
    await logout();
    handleMenuClose();
  };

  const handleNavigation = (path: string) => {
    handleMenuClose();
    setTimeout(() => {
      navigate(path, { replace: true });
    }, 50);
  };

  return (
    <>
      <AppBar 
        position="static" 
        elevation={0}
        sx={{
          backgroundColor: 'transparent',
          backgroundImage: 'none',
          boxShadow: 'none',
          borderBottom: 'none',
          padding: '0 24px',
        }}
      >
        <Toolbar 
          sx={{ 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 0',
            minHeight: 'auto',
          }}
          disableGutters
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Avatar
              src="/logo.png"
              alt="Side Eye"
              sx={{ 
                width: 50, 
                height: 50, 
                cursor: 'pointer',
                '&:hover': {
                  opacity: 0.8,
                },
              }}
              onClick={() => navigate('/')}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {currentUser ? (
              <>
                <IconButton
                  color="inherit"
                  onClick={() => navigate('/suggestions')}
                  sx={{
                    color: isLightbulbLit ? '#FFD700' : 'text.primary',
                    backgroundColor: isLightbulbLit ? 'rgba(255, 215, 0, 0.2)' : 'transparent',
                    border: isLightbulbLit ? '2px solid #FFD700' : '2px solid transparent',
                    '&:hover': {
                      backgroundColor: isLightbulbLit ? 'rgba(255, 215, 0, 0.3)' : 'rgba(0, 0, 0, 0.04)',
                    },
                    transition: 'all 0.3s ease-in-out',
                    transform: isLightbulbLit ? 'scale(1.2)' : 'scale(1)',
                    filter: isLightbulbLit ? 'drop-shadow(0 0 10px #FFD700) drop-shadow(0 0 20px #FFD700) brightness(1.5)' : 'none',
                    animation: isLightbulbLit ? 'pulse 0.8s ease-in-out infinite alternate' : 'none',
                    '@keyframes pulse': {
                      '0%': {
                        filter: 'drop-shadow(0 0 10px #FFD700) drop-shadow(0 0 20px #FFD700) brightness(1.5)',
                        transform: 'scale(1.2)',
                      },
                      '100%': {
                        filter: 'drop-shadow(0 0 15px #FFD700) drop-shadow(0 0 30px #FFD700) brightness(1.8)',
                        transform: 'scale(1.25)',
                      },
                    },
                  }}
                  title="Suggestions"
                >
                  <LightbulbIcon />
                </IconButton>
                
                <IconButton
                  color={unreadCount > 0 ? "error" : "inherit"}
                  onClick={() => navigate('/notifications')}
                  sx={{
                    color: 'text.primary',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    },
                  }}
                >
                  <Badge badgeContent={unreadCount} color="error">
                    <NotificationsIcon />
                  </Badge>
                </IconButton>
                <IconButton
                  color="inherit"
                  onClick={handleMenuOpen}
                  sx={{ 
                    color: 'text.primary',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    },
                  }}
                >
                  <MenuIcon />
                </IconButton>
              </>
            ) : (
              <>
                <Button
                  color="inherit"
                  onClick={() => navigate('/login')}
                  sx={{ 
                    color: 'text.primary',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    },
                  }}
                >
                  Login
                </Button>
                <Button
                  color="inherit"
                  onClick={() => navigate('/register')}
                  sx={{ 
                    color: 'text.primary',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    },
                  }}
                >
                  Register
                </Button>
              </>
            )}
          </Box>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            sx={{
              '& .MuiPaper-root': {
                borderRadius: 2,
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                minWidth: 200,
                border: 'none',
              },
            }}
          >
           
            <MenuItem onClick={() => handleNavigation('/settings')}>
              <ListItemIcon>
                <SettingsIcon />
              </ListItemIcon>
              <ListItemText primary="Settings" />
            </MenuItem>
            <MenuItem onClick={() => handleNavigation('/wallet')}>
              <ListItemIcon>
                <WalletIcon />
              </ListItemIcon>
              <ListItemText primary="Wallet" />
            </MenuItem>

            <Divider />
            <MenuItem onClick={handleSignOut}>
              <ListItemIcon>
                <LogoutIcon />
              </ListItemIcon>
              <ListItemText>Logout</ListItemText>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
    </>
  );
};

export default Navbar; 