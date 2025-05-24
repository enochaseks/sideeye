import React, { useState } from 'react';
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Typography,
  Box,
  Divider,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Link as MuiLink,
  useTheme,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import { Notifications as NotificationsIcon } from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { useNotifications, Notification } from '../contexts/NotificationContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';

export const NotificationIcon: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications();
  const { currentUser } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const theme = useTheme();
  const { isDarkMode } = useThemeContext();
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<{id: string, name: string} | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    handleClose(); // Close the menu first

    // Handle room_created notifications differently
    if (notification.type === 'room_created' && notification.roomId) {
      setSelectedRoom({
        id: notification.roomId,
        name: notification.roomName || 'Room'
      });
      setShowJoinDialog(true);
      return;
    }

    let navigateTo = '/notifications'; // Default fallback

    switch (notification.type) {
      case 'like':
      case 'comment':
      case 'mention':
      case 'repost':
        if (notification.postId) {
          // Assuming /post/:id for now 
          navigateTo = `/post/${notification.postId}`;
        }
        break;
      case 'vibit_like':
      case 'vibit_comment':
      case 'vibit_mention':
        if (notification.postId) { // postId seems to store the video/vibit ID here
          navigateTo = `/vibit/${notification.postId}`;
        }
        break;
      case 'follow':
        if (notification.senderId) {
          navigateTo = `/profile/${notification.senderId}`;
        }
        break;
      case 'room_invite':
      case 'room_invitation':
      case 'room_removal':
        if (notification.roomId) {
          navigateTo = `/side-room/${notification.roomId}`;
        }
        break;
      case 'room_announcement':
      case 'room_poll':
        // Navigate to the specific room chat for announcements and polls
        if (notification.roomId) {
          navigateTo = `/chat/room/${notification.roomId}`;
        }
        break;
      default:
        console.warn(`Unhandled notification type for navigation: ${notification.type}`);
        // Keep default navigateTo = '/notifications'
    }

    console.log(`Navigating to: ${navigateTo} from icon for type: ${notification.type}`);
    navigate(navigateTo);
  };

  const handleJoinRoom = () => {
    if (selectedRoom) {
      navigate(`/chat/room/${selectedRoom.id}`);
    }
    setShowJoinDialog(false);
  };

  const handleDeclineJoin = () => {
    setShowJoinDialog(false);
  };

  const handleMarkAllRead = async () => {
    if (currentUser?.uid) {
      await markAllAsRead(currentUser.uid);
    }
    handleClose();
  };

  return (
    <>
      <IconButton
        color={unreadCount > 0 ? "error" : "inherit"}
        onClick={handleClick}
        sx={{
          position: 'relative',
          color: isDarkMode ? 'white' : 'black',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
          },
        }}
      >
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            mt: 1,
            width: 360,
            maxHeight: 480,
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Notifications</Typography>
          {unreadCount > 0 && (
            <Typography
              variant="caption"
              onClick={handleMarkAllRead}
              sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
            >
              Mark all as read
            </Typography>
          )}
        </Box>
        <Divider />
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : notifications.length === 0 ? (
          <MenuItem onClick={handleClose}>
            <Typography>No new notifications</Typography>
          </MenuItem>
        ) : (
          <List sx={{ padding: 0 }}>
            {notifications.slice(0, 10).map((notification) => (
              <MenuItem
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                sx={{
                  backgroundColor: notification.isRead ? 'transparent' : 'action.hover',
                  whiteSpace: 'normal',
                  py: 1.5
                }}
              >
                <Box>
                  <Typography variant="body2">{notification.content}</Typography>
                  <Typography variant="caption" color="textSecondary">
                    {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </List>
        )}
        <Divider />
        <MenuItem component={Link} to="/notifications" onClick={handleClose}>
          <Typography sx={{ textAlign: 'center', width: '100%' }}>View All Notifications</Typography>
        </MenuItem>
      </Menu>

      {/* Join Room Dialog */}
      <Dialog
        open={showJoinDialog}
        onClose={handleDeclineJoin}
        aria-labelledby="join-room-dialog-title"
      >
        <DialogTitle id="join-room-dialog-title">Join Room?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Would you like to join the room "{selectedRoom?.name}"?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeclineJoin}>Not Now</Button>
          <Button onClick={handleJoinRoom} variant="contained" color="primary">
            Join Room
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}; 