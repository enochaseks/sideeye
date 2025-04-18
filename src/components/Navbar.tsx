import React, { useState } from 'react';
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
  Palette,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { currentUser, logout } = useAuth();

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
                width: 40, 
                height: 40, 
                cursor: 'pointer',
                '&:hover': {
                  opacity: 0.8,
                },
              }}
              onClick={() => navigate('/')}
            />
            <Typography
              variant="h5"
              component="div"
              sx={{ 
                fontWeight: 'bold',
                cursor: 'pointer',
                color: 'primary.main',
                '&:hover': {
                  opacity: 0.8,
                },
              }}
              onClick={() => navigate('/')}
            >
              SideEye
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {currentUser ? (
              <>
                <IconButton
                  color="inherit"
                  onClick={() => navigate('/notifications')}
                  sx={{ 
                    color: 'text.primary',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    },
                  }}
                >
                  <Badge badgeContent={0} color="error">
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
            <MenuItem onClick={() => handleNavigation('/creators-hub')}>
              <ListItemIcon>
                <Palette />
              </ListItemIcon>
              <ListItemText primary="Creators Hub" />
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => handleNavigation('/settings')}>
              <ListItemIcon>
                <SettingsIcon />
              </ListItemIcon>
              <ListItemText primary="Settings" />
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