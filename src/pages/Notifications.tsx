import React from 'react';
import {
  Container,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Box,
  Paper,
  Divider,
  Button
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { useNotifications, Notification } from '../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { formatTimestamp } from '../utils/dateUtils';

const NotificationPage: React.FC = () => {
  const { notifications, markAsRead, deleteNotification, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

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
    navigate(navigateTo);
  };

  const handleDelete = async (event: React.MouseEvent, notificationId: string) => {
    event.stopPropagation();
    await deleteNotification(notificationId);
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'follow':
        return '👥';
      case 'like':
        return '❤️';
      case 'comment':
        return '💬';
      case 'tag':
        return '#️⃣';
      case 'mention':
        return '@️';
      case 'room_invite':
        return '🚪';
      default:
        return '📢';
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={0} sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Notifications
          </Typography>
          {notifications.some(n => !n.isRead) && (
            <Button onClick={() => markAllAsRead()}>
              Mark all as read
            </Button>
          )}
        </Box>

        <List>
          {notifications.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No notifications yet
              </Typography>
            </Box>
          ) : (
            notifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                {index > 0 && <Divider />}
                <ListItem
                  button
                  onClick={() => handleNotificationClick(notification)}
                  sx={{
                    backgroundColor: notification.isRead ? 'transparent' : 'action.hover',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                    mb: 1,
                    borderRadius: 1,
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      {getNotificationIcon(notification.type)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography
                        variant="body1"
                        sx={{
                          fontWeight: notification.isRead ? 'normal' : 'bold',
                        }}
                      >
                        {notification.content}
                      </Typography>
                    }
                    secondary={formatTimestamp(notification.createdAt)}
                  />
                  <IconButton
                    edge="end"
                    onClick={(e) => handleDelete(e, notification.id)}
                    sx={{ ml: 2 }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItem>
              </React.Fragment>
            ))
          )}
        </List>
      </Paper>
    </Container>
  );
};

export default NotificationPage; 