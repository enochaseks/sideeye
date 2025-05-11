import React, { useEffect } from 'react';
import {
  Container,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  Typography,
  IconButton,
  Box,
  CircularProgress,
  Divider,
} from '@mui/material';
import { Close as CloseIcon, Favorite as FavoriteIcon, Comment as CommentIcon, PersonAdd as PersonAddIcon, Notifications as NotificationsIcon, Message as MessageIcon, Videocam as VideocamIcon } from '@mui/icons-material';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate, Link } from 'react-router-dom';
import { Notification } from '../contexts/NotificationContext';

const formatTimestamp = (date: Date): string => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return 'Invalid date';
  }
  return formatDistanceToNow(date, { addSuffix: true });
};

const NotificationsPage: React.FC = () => {
  const { notifications, unreadCount, markAllAsRead, markAsRead, deleteNotification, loading } = useNotifications();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
  }, [unreadCount]);

  const handleMarkAllReadClick = () => {
    if (currentUser?.uid) {
      markAllAsRead(currentUser.uid);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    let navigateTo = '/notifications'; // Default fallback

    switch (notification.type) {
      case 'like':
      case 'comment':
      case 'mention':
      case 'repost': // Assuming reposts link to the post
        if (notification.postId) {
          // TODO: Check if this should be /post/:id or /vibit/:id based on context
          // Assuming /post/:id for now based on Feed/Profile context
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
      case 'message':
        // Handle message notifications - navigate to the chat conversation
        if (notification.roomId) {
          navigateTo = `/chat/conversation/${notification.roomId}`;
        } else if (notification.postId) {
          // Fallback to postId if roomId is not available
          navigateTo = `/chat/conversation/${notification.postId}`;
        } else if (notification.senderId) {
          // Direct chat with sender if no conversation ID is available
          navigateTo = `/chat/${notification.senderId}`;
        }
        break;
      case 'live_stream':
        // Handle live stream notifications - navigate to the side room
        if (notification.roomId) {
          navigateTo = `/side-room/${notification.roomId}`;
        }
        break;
      case 'room_invite':
      case 'room_invitation':
      case 'room_removal':
        if (notification.roomId) {
          navigateTo = `/side-room/${notification.roomId}`;
        }
        break;
      // Add other notification types if necessary
      default:
        console.warn(`Unhandled notification type for navigation: ${notification.type}`);
        // Keep default navigateTo = '/notifications'
    }
    
    console.log(`Navigating to: ${navigateTo} for notification type: ${notification.type}`);
    navigate(navigateTo);
  };

  const handleDelete = (event: React.MouseEvent, notificationId: string) => {
    event.stopPropagation(); // Prevent ListItem click
    deleteNotification(notificationId);
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" component="h1">
          Notifications
        </Typography>
        {notifications.length > 0 && unreadCount > 0 && (
           <Typography variant="caption" color="textSecondary" onClick={handleMarkAllReadClick} sx={{cursor: 'pointer', '&:hover': {textDecoration: 'underline'}}}>
             Mark all as read
           </Typography>
        )}
      </Box>
      {notifications.length === 0 ? (
        <Typography textAlign="center" color="textSecondary">
          No notifications yet.
        </Typography>
      ) : (
        <List sx={{ bgcolor: 'background.paper', borderRadius: 2 }}>
          {notifications.map((notification, index) => (
            <React.Fragment key={notification.id}>
              <ListItem
                alignItems="flex-start"
                onClick={() => handleNotificationClick(notification)}
                sx={{
                  cursor: 'pointer',
                  backgroundColor: notification.isRead ? 'transparent' : 'action.hover',
                  '&:hover': {
                    backgroundColor: 'action.selected',
                  },
                }}
                secondaryAction={
                  <IconButton edge="end" aria-label="delete" onClick={(e) => handleDelete(e, notification.id)}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemAvatar sx={{ mr: 1 }}>
                  <Link 
                    to={`/profile/${notification.senderId}`} 
                    onClick={(e) => e.stopPropagation()}
                    style={{ textDecoration: 'none' }} 
                  >
                    <Avatar
                      alt={notification.senderName || 'User'}
                      src={notification.senderAvatar || undefined}
                      sx={{ bgcolor: !notification.senderAvatar ? 'primary.main' : undefined, width: 40, height: 40 }}
                    >
                      {!notification.senderAvatar && notification.senderName ? notification.senderName.charAt(0).toUpperCase() : null}
                    </Avatar>
                  </Link>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {notification.type === 'like' && <FavoriteIcon fontSize="small" color="error" />}
                      {notification.type === 'comment' && <CommentIcon fontSize="small" color="primary" />}
                      {notification.type === 'follow' && <PersonAddIcon fontSize="small" color="primary" />}
                      {notification.type === 'message' && <MessageIcon fontSize="small" color="primary" />}
                      {notification.type === 'live_stream' && <VideocamIcon fontSize="small" color="error" />}
                      <Typography component="span" variant="body2" color="text.primary">
                        {notification.content || 'Notification content missing.'}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Typography component="span" variant="caption" color="text.secondary">
                      {formatTimestamp(notification.createdAt)}
                    </Typography>
                  }
                />
              </ListItem>
              {index < notifications.length - 1 && <Divider variant="inset" component="li" />}
            </React.Fragment>
          ))}
        </List>
      )}
    </Container>
  );
};

export default NotificationsPage; 