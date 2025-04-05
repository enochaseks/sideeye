import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Divider,
  Avatar,
  Chip,
  IconButton,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Send,
  LocalFireDepartment,
  Timer,
  Visibility,
  VisibilityOff,
  EmojiEmotions,
} from '@mui/icons-material';
import { useParams } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../../services/firebase';
import { TeaRoom as TeaRoomType, TeaReveal } from '../../types';
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';

interface Message {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: any;
  isAnonymous: boolean;
}

const TeaRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const [user] = useAuthState(auth);
  const [room, setRoom] = useState<TeaRoomType | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [showRevealDialog, setShowRevealDialog] = useState(false);
  const [newReveal, setNewReveal] = useState({
    title: '',
    scheduledTime: '',
    isAnonymous: false,
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const setupListeners = useCallback(() => {
    if (!roomId || !user) return () => {};

    // Subscribe to room updates
    const unsubRoom = onSnapshot(doc(db, 'teaRooms', roomId), (doc) => {
      if (doc.exists()) {
        setRoom({ id: doc.id, ...doc.data() } as TeaRoomType);
      }
    }, (error) => {
      console.error('Error listening to room updates:', error);
    });

    // Subscribe to messages
    const q = query(
      collection(db, 'teaRooms', roomId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsubMessages = onSnapshot(q, (snapshot) => {
      const newMessages: Message[] = [];
      snapshot.forEach((doc) => {
        newMessages.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(newMessages);
      scrollToBottom();
    }, (error) => {
      console.error('Error listening to messages:', error);
    });

    return () => {
      unsubRoom();
      unsubMessages();
    };
  }, [roomId, user]);

  useEffect(() => {
    const cleanup = setupListeners();
    return cleanup;
  }, [setupListeners]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim() || !roomId) return;

    await addDoc(collection(db, 'teaRooms', roomId, 'messages'), {
      userId: user.uid,
      username: isAnonymous ? 'Anonymous' : user.displayName || 'Unknown User',
      content: newMessage,
      timestamp: serverTimestamp(),
      isAnonymous,
    });

    setNewMessage('');
  };

  const handleScheduleReveal = async () => {
    if (!user || !roomId || !newReveal.title || !newReveal.scheduledTime) return;

    await addDoc(collection(db, 'teaRooms', roomId, 'reveals'), {
      title: newReveal.title,
      scheduledTime: new Date(newReveal.scheduledTime).getTime(),
      authorId: user.uid,
      anonymous: newReveal.isAnonymous,
      timestamp: serverTimestamp(),
    });

    setShowRevealDialog(false);
    setNewReveal({ title: '', scheduledTime: '', isAnonymous: false });
  };

  if (!room) return <Typography>Loading...</Typography>;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h4">{room.name}</Typography>
          <Chip
            icon={<LocalFireDepartment />}
            label={`${room.temperature}° Hot`}
            color={room.temperature >= 80 ? 'error' : 'default'}
          />
        </Box>
        
        <Box display="flex" justifyContent="space-between" mb={2}>
          <Chip label={room.category} />
          <Chip icon={<Timer />} label={`${room.scheduledReveals.length} Scheduled Reveals`} />
        </Box>

        <LinearProgress
          variant="determinate"
          value={room.temperature}
          sx={{
            height: 8,
            borderRadius: 4,
            mb: 2,
          }}
        />

        <Button
          variant="contained"
          color="primary"
          onClick={() => setShowRevealDialog(true)}
          sx={{ mb: 2 }}
        >
          Schedule Tea Reveal
        </Button>
      </Paper>

      <Paper sx={{ height: '60vh', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
          {messages.map((message) => (
            <Box
              key={message.id}
              sx={{
                display: 'flex',
                mb: 2,
                flexDirection: message.userId === user?.uid ? 'row-reverse' : 'row',
              }}
            >
              <Avatar sx={{ bgcolor: message.isAnonymous ? 'grey.500' : 'primary.main' }}>
                {message.isAnonymous ? '?' : message.username[0]}
              </Avatar>
              <Paper
                sx={{
                  p: 2,
                  ml: message.userId === user?.uid ? 0 : 1,
                  mr: message.userId === user?.uid ? 1 : 0,
                  maxWidth: '70%',
                  bgcolor: message.userId === user?.uid ? 'primary.light' : 'grey.100',
                }}
              >
                <Typography variant="subtitle2" color="textSecondary">
                  {message.username}
                </Typography>
                <Typography>{message.content}</Typography>
              </Paper>
            </Box>
          ))}
          <div ref={messagesEndRef} />
        </Box>

        <Divider />

        <Box component="form" onSubmit={handleSendMessage} sx={{ p: 2, bgcolor: 'background.paper' }}>
          <Box display="flex" alignItems="center" gap={1}>
            <IconButton onClick={() => setIsAnonymous(!isAnonymous)}>
              {isAnonymous ? <VisibilityOff /> : <Visibility />}
            </IconButton>
            <TextField
              fullWidth
              variant="outlined"
              placeholder={`Spill the tea${isAnonymous ? ' anonymously' : ''}...`}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              size="small"
            />
            <IconButton>
              <EmojiEmotions />
            </IconButton>
            <Button variant="contained" type="submit" endIcon={<Send />}>
              Send
            </Button>
          </Box>
        </Box>
      </Paper>

      <Dialog open={showRevealDialog} onClose={() => setShowRevealDialog(false)}>
        <DialogTitle>Schedule Tea Reveal</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Title"
            value={newReveal.title}
            onChange={(e) => setNewReveal({ ...newReveal, title: e.target.value })}
            sx={{ mt: 2, mb: 2 }}
          />
          <TextField
            fullWidth
            type="datetime-local"
            label="Scheduled Time"
            value={newReveal.scheduledTime}
            onChange={(e) => setNewReveal({ ...newReveal, scheduledTime: e.target.value })}
            sx={{ mb: 2 }}
            InputLabelProps={{ shrink: true }}
          />
          <Box display="flex" alignItems="center">
            <Typography>Post Anonymously</Typography>
            <IconButton
              onClick={() => setNewReveal({ ...newReveal, isAnonymous: !newReveal.isAnonymous })}
            >
              {newReveal.isAnonymous ? <VisibilityOff /> : <Visibility />}
            </IconButton>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRevealDialog(false)}>Cancel</Button>
          <Button onClick={handleScheduleReveal} variant="contained">
            Schedule
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default TeaRoom; 