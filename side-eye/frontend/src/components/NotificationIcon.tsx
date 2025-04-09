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
import { Link } from 'react-router-dom';
import { useNotifications, Notification } from '../contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';

export const NotificationIcon: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = async (notification: Notification) => {
    await markAsRead(notification.id);
    handleClose();
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
            <ListItem>
              <ListItemText
                primary="No notifications"
                secondary="You're all caught up!"
                sx={{ textAlign: 'center' }}
              />
            </ListItem>
          ) : (
            notifications.slice(0, 5).map((notification) => (
              <ListItem
                key={notification.id}
                component={Link}
                to={notification.link}
                onClick={() => handleNotificationClick(notification)}
                sx={{
                  backgroundColor: notification.read ? 'transparent' : 'action.hover',
                  textDecoration: 'none',
                  color: 'inherit',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <ListItemAvatar>
                  <Avatar src={notification.senderAvatar} alt={notification.senderName} />
                </ListItemAvatar>
                <ListItemText
                  primary={notification.content}
                  secondary={formatDistanceToNow(notification.timestamp.toDate(), { addSuffix: true })}
                  sx={{
                    '& .MuiListItemText-primary': {
                      fontWeight: notification.read ? 'normal' : 'bold',
                    },
                  }}
                />
              </ListItem>
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