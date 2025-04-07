import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFirestore } from '../context/FirestoreContext';
import { collection, query, where, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  TextField,
  Button,
  CircularProgress,
  Divider
} from '@mui/material';

const Messages: React.FC = () => {
  const { user } = useAuth();
  const { db } = useFirestore();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !user) return;

    try {
      const q = query(
        collection(db, 'messages'),
        where('participants', 'array-contains', user.uid),
        orderBy('timestamp', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const newMessages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMessages(newMessages);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      setError('Failed to fetch messages');
      console.error('Error fetching messages:', err);
      setLoading(false);
    }
  }, [db, user]);

  const handleSendMessage = async () => {
    if (!db || !user || !selectedUser || !newMessage.trim()) return;

    try {
      await addDoc(collection(db, 'messages'), {
        text: newMessage,
        senderId: user.uid,
        receiverId: selectedUser,
        timestamp: new Date(),
        read: false,
        participants: [user.uid, selectedUser]
      });
      setNewMessage('');
    } catch (err) {
      setError('Failed to send message');
      console.error('Error sending message:', err);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Messages
      </Typography>

      <Box mb={3}>
        <TextField
          fullWidth
          multiline
          rows={3}
          variant="outlined"
          placeholder="Type your message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          sx={{ mb: 2 }}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleSendMessage}
          disabled={!newMessage.trim() || !selectedUser}
        >
          Send
        </Button>
      </Box>

      <List>
        {messages.map((message) => (
          <React.Fragment key={message.id}>
            <ListItem>
              <ListItemAvatar>
                <Avatar src={message.senderId === user?.uid ? user?.photoURL || undefined : undefined} />
              </ListItemAvatar>
              <ListItemText
                primary={message.text}
                secondary={
                  <>
                    <Typography component="span" variant="body2" color="text.primary">
                      {message.senderId === user?.uid ? 'You' : 'Other User'}
                    </Typography>
                    {' — '}
                    {new Date(message.timestamp?.toDate()).toLocaleString()}
                  </>
                }
              />
            </ListItem>
            <Divider />
          </React.Fragment>
        ))}
        {messages.length === 0 && (
          <Typography variant="body1" color="text.secondary">
            No messages yet
          </Typography>
        )}
      </List>
    </Box>
  );
};

export default Messages; 