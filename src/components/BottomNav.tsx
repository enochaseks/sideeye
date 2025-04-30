import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BottomNavigation,
  BottomNavigationAction,
  Box,
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
          // Note: To resolve the 'Cannot find name PsychologyIcon' error,
          // you need to import the icon at the top of this file (`side-eye/frontend/src/components/BottomNav.tsx`).
          // Find the line that starts with:
          // import { Home as HomeIcon, ... } from '@mui/icons-material';
          // Add 'Psychology as PsychologyIcon' to the list inside the curly braces {}.
          // For example:
          // import {
          //   Home as HomeIcon,
          //   MeetingRoom as MeetingRoomIcon,
          //   TrendingUp as TrendingUpIcon,
          //   Person as PersonIcon,
          //   Store as StoreIcon,
          //   Chat as ChatIcon,
          //   Psychology as PsychologyIcon, // <-- Add this line
          // } from '@mui/icons-material';
          icon={<PsychologyIcon />}
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