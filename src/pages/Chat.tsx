import React, { useState, useEffect } from 'react';
import { Container, TextField, Button, List, ListItem, Typography, Box } from '@mui/material';
import { auth, db } from '../services/firebase';
import { collection, addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';

interface Message {
  id: string;
  text: string;
  userId: string;
  username: string;
  timestamp: Date;
}

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'messages'), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate()
      })) as Message[];
      setMessages(newMessages);
    });

    return () => unsubscribe();
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '') return;

    try {
      await addDoc(collection(db, 'messages'), {
        text: newMessage,
        userId: auth.currentUser?.uid,
        username: username || 'Anonymous',
        timestamp: new Date()
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Chat Room
        </Typography>
        <List sx={{ maxHeight: '60vh', overflow: 'auto', bgcolor: 'background.paper', borderRadius: 1 }}>
          {messages.map((message) => (
            <ListItem key={message.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <Typography variant="subtitle2" color="primary">
                {message.username}
              </Typography>
              <Typography variant="body1">{message.text}</Typography>
              <Typography variant="caption" color="text.secondary">
                {message.timestamp?.toLocaleTimeString()}
              </Typography>
            </ListItem>
          ))}
        </List>
        <Box component="form" onSubmit={handleSendMessage} sx={{ mt: 2 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Button type="submit" variant="contained" color="primary">
            Send
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default Chat; 