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
  Link as MuiLink
} from '@mui/material';
import { Notifications as NotificationsIcon } from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { useNotifications, Notification } from '../contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';

export const NotificationIcon: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();

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
    let navigateTo = '/';
    if (notification.type === 'follow') {
      navigateTo = `/profile/${notification.senderId}`;
    } else if (notification.type === 'like' || notification.type === 'comment') {
      navigateTo = `/post/${notification.postId}`;
    } else if (notification.type === 'room_invite') {
      navigateTo = `/side-room/${notification.roomId}`;
    }
    handleClose();
    navigate(navigateTo);
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleClick}
        sx={{
          position: 'relative',
          color: 'black',
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
            <Button size="small" onClick={handleMarkAllRead}>
              Mark all as read
            </Button>
          )}
        </Box>
        <Divider />
        <List>
          {notifications.length === 0 ? (
            <MenuItem onClick={handleClose}>No new notifications</MenuItem>
          ) : (
            notifications.slice(0, 5).map((notification) => (
              <MenuItem
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                sx={{
                  backgroundColor: notification.isRead ? 'transparent' : 'action.hover',
                  textDecoration: 'none',
                  color: 'inherit',
                  '&:hover': {
                    backgroundColor: 'action.selected',
                  },
                  mb: 1,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <ListItemAvatar>
                  <Avatar src={notification.senderAvatar} alt={notification.senderName} />
                </ListItemAvatar>
                <ListItemText
                  primary={notification.content}
                  secondary={formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                  sx={{
                    '& .MuiListItemText-primary': {
                      fontWeight: notification.isRead ? 'normal' : 'bold',
                    },
                  }}
                />
              </MenuItem>
            ))
          )}
        </List>
        <Divider />
        <Box sx={{ p: 1 }}>
          <Button
            fullWidth
            component={Link}
            to="/notifications"
            onClick={handleClose}
            sx={{ textDecoration: 'none' }}
          >
            View All Notifications
          </Button>
        </Box>
      </Menu>
    </>
  );
}; 