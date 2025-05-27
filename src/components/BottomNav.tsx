import React, { useState, useEffect, Dispatch, SetStateAction } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Avatar,
  Badge,
  Paper,
  useTheme,
  useMediaQuery,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Home as HomeIcon,
  MeetingRoom as MeetingRoomIcon,
  TrendingUp as TrendingUpIcon,
  Person as PersonIcon,
  Psychology as PsychologyIcon,
  Message as MessageIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

const DRAWER_WIDTH = 240;
const COLLAPSED_DRAWER_WIDTH = 64;

interface BottomNavProps {
  isDrawerOpen: boolean;
  setIsDrawerOpen: Dispatch<SetStateAction<boolean>>;
  onCreateRoomClick?: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ isDrawerOpen, setIsDrawerOpen, onCreateRoomClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const toggleDrawer = () => {
    // Keep sidebar always collapsed by setting to false
    setIsDrawerOpen(false);
  };

  if (!currentUser || ['/login', '/register'].includes(location.pathname)) {
    return null;
  }

  // Define navigation items - NOTE: Removed Sade AI for mobile
  const navigationItems = [
    {
      label: "Discover",
      path: "/",
      icon: <TrendingUpIcon />,
    },
    {
      label: "Side Rooms",
      path: "/side-rooms",
      icon: <MeetingRoomIcon />,
    },
    {
      label: "Messages",
      path: "/messages",
      icon: (
        <Badge color="error" badgeContent={unreadMessages} invisible={unreadMessages === 0}>
          <MessageIcon />
        </Badge>
      ),
    },
    // Sade AI remains in desktop navigation items only
    ...(isMobile ? [] : [{
      label: "Sade AI",
      path: "/sade-ai",
      icon: (
        <Avatar 
          src="/images/sade-avatar.jpg" 
          sx={{ width: 24, height: 24 }}
        />
      ),
    }]),
    {
      label: "Profile",
      path: `/profile/${currentUser?.uid}`,
      icon: <PersonIcon />,
    },
  ];

  const renderNavigationContent = () => (
    <List>
      {navigationItems.map((item) => (
        <ListItem
          button
          key={item.label}
          selected={location.pathname === item.path}
          onClick={() => handleNavigation(item.path)}
          sx={{
            borderRadius: '8px',
            mx: 1,
            my: 0.5,
            minHeight: 48,
            justifyContent: isDrawerOpen ? 'initial' : 'center',
            '&.Mui-selected': {
              backgroundColor: theme.palette.primary.main,
              color: 'white',
              '&:hover': {
                backgroundColor: theme.palette.primary.dark,
              },
              '& .MuiListItemIcon-root': {
                color: 'white',
              },
            },
          }}
        >
          <Tooltip title={!isDrawerOpen ? item.label : ""} placement="right">
            <ListItemIcon 
              sx={{ 
                minWidth: 40, 
                color: location.pathname === item.path ? 'white' : 'inherit',
                mr: isDrawerOpen ? 2 : 'auto',
                justifyContent: 'center'
              }}
            >
              {item.icon}
            </ListItemIcon>
          </Tooltip>
          {isDrawerOpen && <ListItemText primary={item.label} />}
        </ListItem>
      ))}
    </List>
  );

  // Desktop Sidebar
  if (!isMobile) {
    return (
      <Drawer
        variant="permanent"
        anchor="left"
        sx={{
          width: COLLAPSED_DRAWER_WIDTH, // Always use collapsed width
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: COLLAPSED_DRAWER_WIDTH, // Always use collapsed width
            boxSizing: 'border-box',
            borderRight: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
            boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.1)',
            mt: '64px', // Account for top navbar height
            overflowX: 'hidden',
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
          },
        }}
      >
        <Box sx={{ 
          overflow: 'auto', 
          mt: 2,
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}>
          {renderNavigationContent()}
          <Divider sx={{ my: 1 }} />
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            p: 1,
            position: 'sticky',
            bottom: 0,
            backgroundColor: theme.palette.background.paper,
            borderTop: `1px solid ${theme.palette.divider}`
          }}>
            {/* Remove toggle button to prevent users from expanding the sidebar */}
          </Box>
        </Box>
      </Drawer>
    );
  }

  // Mobile Bottom Navigation
  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
      }}
    >
      <BottomNavigation
        value={location.pathname}
        onChange={(event, newValue) => {
          // Don't handle the create button through onChange
          // This will only handle navigation to actual routes
          if (newValue !== 'create') {
            handleNavigation(newValue);
          }
        }}
        sx={{
          backgroundColor: theme.palette.background.paper,
          borderTop: `1px solid ${theme.palette.divider}`,
        }}
      >
        {/* First two items (Discover, Side Rooms) */}
        {navigationItems.slice(0, 2).map((item) => (
          <BottomNavigationAction
            key={item.label}
            label={item.label}
            value={item.path}
            icon={item.icon}
          />
        ))}
        
        {/* Create button in the middle */}
        <BottomNavigationAction
          key="create"
          label="Create"
          value="create"
          icon={<AddIcon />}
          onClick={(e) => {
            e.preventDefault(); // Prevent default navigation behavior
            console.log('[BottomNav] Create button clicked');
            if (onCreateRoomClick) {
              console.log('[BottomNav] Calling onCreateRoomClick handler');
              onCreateRoomClick();
            } else {
              console.warn('[BottomNav] onCreateRoomClick handler is not defined');
            }
          }}
        />
        
        {/* Last two items (Messages, Profile) */}
        {navigationItems.slice(2).map((item) => (
          <BottomNavigationAction
            key={item.label}
            label={item.label}
            value={item.path}
            icon={item.icon}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
};

export default BottomNav;