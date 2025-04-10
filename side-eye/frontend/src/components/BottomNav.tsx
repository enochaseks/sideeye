import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Dialog,
} from '@mui/material';
import {
  Home as HomeIcon,
  MeetingRoom as MeetingRoomIcon,
  TrendingUp as TrendingUpIcon,
  Add as AddIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import CreatePostDialog from './CreatePostDialog';
import { useAuth } from '../contexts/AuthContext';

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const { currentUser } = useAuth();

  const handleNavigation = (event: React.SyntheticEvent, newValue: string) => {
    if (newValue === 'create-post') {
      setCreatePostOpen(true);
    } else {
      navigate(newValue);
    }
  };

  const handleCreatePost = async (content: string, imageFile?: File) => {
    if (!currentUser) return;
    
    try {
      const postData = {
        content,
        imageFile,
        authorId: currentUser.uid,
        timestamp: new Date(),
      };
      // Add your post creation logic here
      setCreatePostOpen(false);
    } catch (error) {
      console.error('Error creating post:', error);
    }
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
          label="Home"
          value="/"
          icon={<HomeIcon />}
        />
        <BottomNavigationAction
          label="Side Rooms"
          value="/side-rooms"
          icon={<MeetingRoomIcon />}
        />
        <BottomNavigationAction
          label="Post"
          value="create-post"
          icon={<AddIcon />}
        />
        <BottomNavigationAction
          label="Notifications"
          value="/notifications"
          icon={<NotificationsIcon />}
        />
        <BottomNavigationAction
          label="Discover"
          value="/discover"
          icon={<TrendingUpIcon />}
        />
      </BottomNavigation>

      <Dialog
        open={createPostOpen}
        onClose={() => setCreatePostOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            maxHeight: '80vh',
          },
        }}
      >
        {currentUser && (
          <CreatePostDialog
            open={createPostOpen}
            onClose={() => setCreatePostOpen(false)}
          />
        )}
      </Dialog>
    </>
  );
};

export default BottomNav;