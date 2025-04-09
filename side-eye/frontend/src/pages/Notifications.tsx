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
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const NotificationPage: React.FC = () => {
  const { notifications, markAsRead, deleteNotification, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    navigate(notification.link);
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
          {notifications.some(n => !n.read) && (
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
                    backgroundColor: notification.read ? 'transparent' : 'action.hover',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
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
                          fontWeight: notification.read ? 'normal' : 'bold',
                        }}
                      >
                        {notification.content}
                      </Typography>
                    }
                    secondary={formatDistanceToNow(notification.timestamp.toDate(), { addSuffix: true })}
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