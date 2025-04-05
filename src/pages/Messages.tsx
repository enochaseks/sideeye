import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Box, 
  List, 
  ListItem, 
  ListItemAvatar, 
  ListItemText, 
  Avatar, 
  Typography,
  TextField,
  Button,
  Paper
} from '@mui/material';
import { auth, db } from '../services/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

interface Message {
  id: string;
  text: string;
  senderId: string;
  receiverId: string;
  timestamp: any;
  senderName: string;
}

const Messages: React.FC = () => {
  const [user] = useAuthState(auth);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'messages'),
      where('participants', 'array-contains', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(newMessages);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSendMessage = async () => {
    if (!user || !selectedUser || !newMessage.trim()) return;

    try {
      await addDoc(collection(db, 'messages'), {
        text: newMessage,
        senderId: user.uid,
        receiverId: selectedUser,
        timestamp: serverTimestamp(),
        senderName: user.displayName || 'Anonymous',
        participants: [user.uid, selectedUser]
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, display: 'flex', height: '80vh' }}>
        <Paper sx={{ width: '30%', mr: 2, overflow: 'auto' }}>
          <List>
            {messages.map((message) => (
              <ListItem
                key={message.id}
                sx={{
                  cursor: 'pointer',
                  backgroundColor: selectedUser === (message.senderId === user?.uid ? message.receiverId : message.senderId) 
                    ? 'action.selected' 
                    : 'background.paper'
                }}
                onClick={() => setSelectedUser(message.senderId === user?.uid ? message.receiverId : message.senderId)}
              >
                <ListItemAvatar>
                  <Avatar>{message.senderName[0]}</Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={message.senderName}
                  secondary={message.text}
                />
              </ListItem>
            ))}
          </List>
        </Paper>

        <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
            {selectedUser && messages
              .filter(m => 
                (m.senderId === user?.uid && m.receiverId === selectedUser) ||
                (m.receiverId === user?.uid && m.senderId === selectedUser)
              )
              .map((message) => (
                <Box
                  key={message.id}
                  sx={{
                    display: 'flex',
                    justifyContent: message.senderId === user?.uid ? 'flex-end' : 'flex-start',
                    mb: 2
                  }}
                >
                  <Box
                    sx={{
                      maxWidth: '70%',
                      p: 2,
                      borderRadius: 2,
                      bgcolor: message.senderId === user?.uid ? 'primary.main' : 'grey.100',
                      color: message.senderId === user?.uid ? 'white' : 'text.primary'
                    }}
                  >
                    <Typography>{message.text}</Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                      {new Date(message.timestamp?.toDate()).toLocaleTimeString()}
                    </Typography>
                  </Box>
                </Box>
              ))}
          </Box>

          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={!selectedUser}
              />
              <Button 
                variant="contained" 
                onClick={handleSendMessage}
                disabled={!selectedUser || !newMessage.trim()}
              >
                Send
              </Button>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Messages; 