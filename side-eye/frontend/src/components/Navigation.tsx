import React from 'react';
import { AppBar, Toolbar, IconButton, Typography, Box, Button } from '@mui/material';
import { Home, Person, Chat, Notifications, Search } from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SearchBar from './SearchBar';

const Navigation: React.FC = () => {
  const { currentUser } = useAuth();
  const location = useLocation();

  return (
    <AppBar position="sticky" color="default" elevation={1}>
      <Toolbar>
        <Typography
          variant="h6"
          component={Link}
          to="/"
          sx={{
            textDecoration: 'none',
            color: 'inherit',
            mr: 2
          }}
        >
          SideEye
        </Typography>

        <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
          <SearchBar />
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            component={Link}
            to="/"
            color={location.pathname === '/' ? 'primary' : 'default'}
          >
            <Home />
          </IconButton>
          
          <IconButton
            component={Link}
            to="/profile"
            color={location.pathname === '/profile' ? 'primary' : 'default'}
          >
            <Person />
          </IconButton>
          
          <IconButton
            component={Link}
            to="/messages"
            color={location.pathname === '/messages' ? 'primary' : 'default'}
          >
            <Chat />
          </IconButton>
          
          <IconButton
            component={Link}
            to="/notifications"
            color={location.pathname === '/notifications' ? 'primary' : 'default'}
          >
            <Notifications />
          </IconButton>

          {currentUser ? (
            <Button
              component={Link}
              to="/profile"
              variant="outlined"
              size="small"
              sx={{ ml: 2 }}
            >
              Profile
            </Button>
          ) : (
            <Button
              component={Link}
              to="/login"
              variant="contained"
              size="small"
              sx={{ ml: 2 }}
            >
              Login
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navigation; 