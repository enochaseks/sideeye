import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Avatar,
} from '@mui/material';
import {
  Home as HomeIcon,
  MeetingRoom as MeetingRoomIcon,
  TrendingUp as TrendingUpIcon,
  Person as PersonIcon,
  Psychology as PsychologyIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();

  const handleNavigation = (event: React.SyntheticEvent, newValue: string) => {
    navigate(newValue);
  };

  return (
    <>
      <BottomNavigation
        value={location.pathname}
        onChange={handleNavigation}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          zIndex: 1000,
        }}
      >
        <BottomNavigationAction
          label="Discover"
          value="/"
          icon={<TrendingUpIcon />}
        />
        <BottomNavigationAction
          label="Side Rooms"
          value="/side-rooms"
          icon={<MeetingRoomIcon />}
        />
        <BottomNavigationAction
          label="Sade AI"
          value="/sade-ai"
          icon={
            <Avatar 
              src="/images/sade-avatar.jpg" 
              sx={{ width: 24, height: 24 }}
            />
          }
        />
        <BottomNavigationAction
          label="Profile"
          value={`/profile/${currentUser?.uid}`}
          icon={<PersonIcon />}
        />
      </BottomNavigation>
    </>
  );
};

export default BottomNav;