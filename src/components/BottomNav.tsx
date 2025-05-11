import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Avatar,
  Badge
} from '@mui/material';
import {
  Home as HomeIcon,
  MeetingRoom as MeetingRoomIcon,
  TrendingUp as TrendingUpIcon,
  Person as PersonIcon,
  Psychology as PsychologyIcon,
  Message as MessageIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);

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
          label="Messages"
          value="/messages"
          icon={
            <Badge color="error" badgeContent={unreadMessages} invisible={unreadMessages === 0}>
              <MessageIcon />
            </Badge>
          }
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