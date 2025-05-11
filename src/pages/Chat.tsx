import React, { useState, useEffect, useRef } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  TextField, 
  Button, 
  Avatar,
  IconButton,
  Paper,
  CircularProgress,
  Divider,
  AppBar,
  Toolbar,
  InputAdornment,
  List,
  ListItem
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon,
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  InsertEmoticon as EmojiIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, addDoc, collection, query, where, orderBy, onSnapshot, updateDoc, serverTimestamp, Timestamp, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { toast } from 'react-hot-toast';
import { useNotifications } from '../contexts/NotificationContext';

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: any;
  read: boolean;
}

interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: {
    text: string;
    sender: string;
    timestamp: any;
  };
}

interface ChatPartner {
  id: string;
  username: string;
  name?: string;
  profilePic?: string;
}

const Chat: React.FC = () => {
  const { conversationId, userId } = useParams<{ conversationId?: string; userId?: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [chatPartner, setChatPartner] = useState<ChatPartner | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { addNotification } = useNotifications();
  
  // Define fetchUserProfile outside of useEffect to avoid redefinition
  const fetchUserProfile = async (uid: string) => {
    try {
      // First try to get the profile from the users collection
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        // Check for profile pic in different possible fields
        const profilePic = userData.profilePic || userData.photoURL || userData.avatarUrl || undefined;
        
        console.log('User profile debug:', {
          uid,
          userData,
          profilePic
        });
        
        return {
          id: uid,
          username: userData.username || 'Unknown User',
          name: userData.name,
          profilePic
        };
      } else {
        // If no user document, try to get from auth
        // This would require an admin SDK in a real environment
        return {
          id: uid,
          username: 'Unknown User'
        };
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return {
        id: uid,
        username: 'Unknown User'
      };
    }
  };
  
  useEffect(() => {
    if (!currentUser?.uid) return;
    
    // Handle both types of routes
    const actualConversationId = conversationId || userId;
    
    if (!actualConversationId) {
      navigate('/messages');
      return;
    }
    
    // For direct user chat (/chat/:userId), we need to check if a conversation exists
    // If not, create one
    const createConversationIfNeeded = async () => {
      // Only handle the userId route here (direct user chat)
      if (!userId || conversationId) {
        return null; // Not a direct user chat or conversation already exists
      }
      
      try {
        // Check if a conversation already exists between these users
        const conversationsRef = collection(db, 'conversations');
        const q = query(
          conversationsRef,
          where('participants', 'array-contains', currentUser.uid)
        );
        
        const snapshot = await getDocs(q);
        let existingConversationId: string | null = null;
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.participants.includes(userId)) {
            existingConversationId = doc.id;
          }
        });
        
        if (existingConversationId) {
          // Navigate to the existing conversation
          navigate(`/chat/conversation/${existingConversationId}`, { replace: true });
          return existingConversationId;
        }
        
        // Create a new conversation
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          toast.error('User not found');
          navigate('/messages');
          return null;
        }
        
        const newConversationRef = doc(collection(db, 'conversations'));
        await setDoc(newConversationRef, {
          participants: [currentUser.uid, userId],
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp(),
          unreadCount: {
            [currentUser.uid]: 0,
            [userId]: 0
          }
        });
        
        // Navigate to the new conversation
        navigate(`/chat/conversation/${newConversationRef.id}`, { replace: true });
        return newConversationRef.id;
      } catch (error) {
        console.error('Error creating conversation:', error);
        toast.error('Failed to start conversation');
        return null;
      }
    };
    
    let messageUnsubscribe: (() => void) | null = null;
    
    const initializeChat = async () => {
      // Try to create a conversation if needed first
      const newConversationId = await createConversationIfNeeded();
      
      // If we created a new conversation, we don't need to fetch it again
      if (newConversationId) {
        return;
      }
      
      const currentConversationId = actualConversationId;
      
      try {
        // Fetch conversation details from Firestore
        const conversationRef = doc(db, 'conversations', currentConversationId);
        const conversationSnap = await getDoc(conversationRef);
        
        if (!conversationSnap.exists()) {
          toast.error('Conversation not found');
          navigate('/messages');
          return;
        }
        
        const conversationData = { ...conversationSnap.data() } as Conversation;
        setConversation({
          ...conversationData,
          id: conversationSnap.id
        });
        
        // Find the other participant
        const otherParticipantId = conversationData.participants.find(id => id !== currentUser.uid);
        
        if (!otherParticipantId) {
          toast.error('Invalid conversation');
          navigate('/messages');
          return;
        }
        
        // Fetch complete profile data with our helper function
        const chatPartnerProfile = await fetchUserProfile(otherParticipantId);
        setChatPartner(chatPartnerProfile);
        
        // Mark messages as read
        await updateDoc(conversationRef, {
          [`unreadCount.${currentUser.uid}`]: 0
        });
        
        // Set up message listener
        const messagesRef = collection(db, 'conversations', currentConversationId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));
        
        messageUnsubscribe = onSnapshot(q, (snapshot) => {
          const messagesData: Message[] = [];
          snapshot.docs.forEach(doc => {
            messagesData.push({
        id: doc.id,
              ...doc.data()
            } as Message);
          });
          
          setMessages(messagesData);
          setLoading(false);
          
          // Mark new messages as read if they weren't sent by current user
          const unreadMessages = messagesData.filter(
            msg => !msg.read && msg.sender !== currentUser.uid
          );
          
          if (unreadMessages.length > 0) {
            unreadMessages.forEach(async (msg) => {
              const messageRef = doc(db, 'conversations', currentConversationId, 'messages', msg.id);
              await updateDoc(messageRef, { read: true });
            });
            
            // Also update unread count in conversation
            const conversationRef = doc(db, 'conversations', currentConversationId);
            updateDoc(conversationRef, {
              [`unreadCount.${currentUser.uid}`]: 0
            });
          }
          
          // Scroll to bottom
          scrollToBottom();
        });
      } catch (error) {
        console.error('Error fetching conversation:', error);
        toast.error('Failed to load conversation');
      }
    };
    
    // Execute the chat initialization
    initializeChat();

    return () => {
      if (messageUnsubscribe) messageUnsubscribe();
    };
  }, [currentUser?.uid, conversationId, userId, navigate]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const sendMessage = async () => {
    if (!messageText.trim() || !currentUser?.uid || !conversation) {
      return;
    }
    
    const actualConversationId = conversationId || userId;
    if (!actualConversationId) {
      return;
    }
    
    try {
      const messagesRef = collection(db, 'conversations', actualConversationId, 'messages');
      const otherParticipantId = conversation.participants.find(id => id !== currentUser.uid);
      
      if (!otherParticipantId) {
        toast.error('Cannot find chat partner');
        return;
      }
      
      // Add the message
      await addDoc(messagesRef, {
        text: messageText,
        sender: currentUser.uid,
        timestamp: serverTimestamp(),
        read: false
      });
      
      // Update conversation with last message and timestamp
      const conversationRef = doc(db, 'conversations', actualConversationId);
      await updateDoc(conversationRef, {
        lastMessage: {
          text: messageText,
          sender: currentUser.uid,
        timestamp: serverTimestamp()
        },
        lastUpdated: serverTimestamp(),
        [`unreadCount.${otherParticipantId}`]: (conversation.lastMessage?.sender === currentUser.uid ? 1 : 0) + 1
      });
      
      // Create a notification for the recipient
      if (chatPartner && currentUser) {
        try {
          // Get current user's profile for better notification data
          const userProfileRef = doc(db, 'users', currentUser.uid);
          const userProfileSnap = await getDoc(userProfileRef);
          const userProfileData = userProfileSnap.exists() ? userProfileSnap.data() : null;
          
          // Use profile data if available, fallback to auth data
          const senderName = userProfileData?.name || userProfileData?.username || currentUser.displayName || 'Someone';
          const senderAvatar = userProfileData?.profilePic || currentUser.photoURL;
          
          // Add notification to the system
          await addNotification({
            type: 'message',
            senderId: currentUser.uid,
            senderName: senderName,
            senderAvatar: senderAvatar,
            recipientId: otherParticipantId,
            content: `New message: ${messageText.slice(0, 50)}${messageText.length > 50 ? '...' : ''}`,
            postId: actualConversationId,
            roomId: actualConversationId  // Use roomId for conversation routing
          });
          
          console.log('Notification sent for new message to:', otherParticipantId);
        } catch (notifError) {
          console.error('Error creating message notification:', notifError);
          // Don't show error to user, just log it - we don't want to disrupt the message sending flow
        }
      }
      
      setMessageText('');
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };
  
  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const formatMessageDate = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  };
  
  const groupMessagesByDate = () => {
    const groups: { [key: string]: Message[] } = {};
    
    messages.forEach(message => {
      if (!message.timestamp) return;
      
      const date = message.timestamp.toDate ? message.timestamp.toDate() : new Date(message.timestamp);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      
      groups[dateStr].push(message);
    });
    
    return groups;
  };
  
  const renderMessage = (message: Message) => {
    const isCurrentUser = message.sender === currentUser?.uid;
    
    return (
      <Box
        key={message.id}
        sx={{
          display: 'flex',
          justifyContent: isCurrentUser ? 'flex-end' : 'flex-start',
          mb: 1,
          px: 2
        }}
      >
        <Box
          sx={{
            maxWidth: '70%',
            backgroundColor: isCurrentUser ? 'primary.main' : 'background.paper',
            color: isCurrentUser ? 'primary.contrastText' : 'text.primary',
            borderRadius: isCurrentUser ? '20px 20px 0 20px' : '20px 20px 20px 0',
            p: 2,
            position: 'relative',
            boxShadow: 1,
            '& .timestamp': {
              position: 'absolute',
              bottom: 2,
              right: isCurrentUser ? 8 : 'auto',
              left: isCurrentUser ? 'auto' : 8,
              fontSize: '0.7rem',
              color: isCurrentUser ? 'rgba(255,255,255,0.7)' : 'text.secondary'
            }
          }}
        >
          <Typography variant="body1">{message.text}</Typography>
          <Typography variant="caption" className="timestamp">
            {formatTime(message.timestamp)}
          </Typography>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar>
          <IconButton edge="start" onClick={() => navigate('/messages')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          {chatPartner ? (
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center',
                cursor: 'pointer',
                '&:hover': {
                  opacity: 0.8,
                },
                transition: 'opacity 0.2s ease'
              }}
              onClick={() => navigate(`/profile/${chatPartner.id}`)}
            >
              <Avatar 
                src={chatPartner.profilePic || undefined} 
                alt={chatPartner.name || chatPartner.username}
                sx={{ 
                  mr: 2, 
                  width: 40, 
                  height: 40,
                  bgcolor: !chatPartner.profilePic ? 'primary.main' : undefined
                }}
              >
                {!chatPartner.profilePic && (chatPartner.name || chatPartner.username)?.charAt(0).toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight="medium">
                  {chatPartner.name || chatPartner.username}
        </Typography>
                {chatPartner.name && (
                  <Typography variant="caption" color="text.secondary">
                    @{chatPartner.username}
              </Typography>
                )}
              </Box>
            </Box>
          ) : (
            <CircularProgress size={24} sx={{ mr: 2 }} />
          )}
        </Toolbar>
      </AppBar>
      
      <Box sx={{ flexGrow: 1, overflowY: 'auto', bgcolor: 'grey.50', p: 2, pb: 80 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : messages.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50%' }}>
            <Typography color="text.secondary">No messages yet. Start the conversation!</Typography>
          </Box>
        ) : (
          <Box>
            {Object.entries(groupMessagesByDate()).map(([dateStr, dateMessages]) => (
              <Box key={dateStr} sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Divider sx={{ flexGrow: 1, mr: 2 }} />
              <Typography variant="caption" color="text.secondary">
                    {formatMessageDate(dateMessages[0].timestamp)}
              </Typography>
                  <Divider sx={{ flexGrow: 1, ml: 2 }} />
                </Box>
                {dateMessages.map(renderMessage)}
              </Box>
          ))}
            <div ref={messagesEndRef} />
          </Box>
        )}
      </Box>
      
      {/* Message Input Box - Fixed at bottom */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          p: 2,
          backgroundColor: 'white',
          borderTop: '1px solid #ddd',
          boxShadow: '0px -2px 10px rgba(0,0,0,0.1)',
          zIndex: 9999
        }}
      >
        <Box sx={{ display: 'flex', width: '100%' }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Type a message..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            sx={{ mr: 1 }}
          />
          <Button 
            variant="contained" 
            color="primary"
            disabled={!messageText.trim()}
            onClick={sendMessage}
          >
            Send
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default Chat; 