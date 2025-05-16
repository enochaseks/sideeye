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
  ListItem,
  Alert,
  Snackbar,
  Chip,
  styled,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tooltip,
  Menu,
  MenuItem,
  Popover,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon,
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  InsertEmoticon as EmojiIcon,
  CheckCircle as AcceptIcon,
  Cancel as DeclineIcon,
  Add as AddIcon,
  Image as ImageIcon,
  Videocam as VideoIcon,
  Delete as DeleteIcon,
  ThumbUp as ThumbUpIcon,
  Favorite as HeartIcon,
  SentimentVerySatisfied as HappyIcon,
  SentimentVeryDissatisfied as SadIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, addDoc, collection, query, where, orderBy, onSnapshot, updateDoc, serverTimestamp, Timestamp, getDocs, setDoc, writeBatch, deleteDoc, limit } from 'firebase/firestore';
import { db, storage } from '../services/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { toast } from 'react-hot-toast';
import { useNotifications } from '../contexts/NotificationContext';

interface Reaction {
  emoji: string;
  userId: string;
  username?: string;
}

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: any;
  read: boolean;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  reactions?: Reaction[];
}

interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: {
    text: string;
    sender: string;
    timestamp: any;
  };
  status?: 'pending' | 'accepted';
}

interface ChatPartner {
  id: string;
  username: string;
  name?: string;
  profilePic?: string;
  followers?: string[];
}

interface UserData {
  username?: string;
  name?: string;
  profilePic?: string;
  photoURL?: string;
  avatarUrl?: string;
  following?: string[];
  followers?: string[];
  [key: string]: any;
}

const HiddenFileInput = styled('input')({
  display: 'none',
});

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
  const [isPending, setIsPending] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    message: Message | null;
  } | null>(null);
  
  // New state variables for reactions
  const [reactionPopover, setReactionPopover] = useState<{
    anchorEl: HTMLElement | null;
    message: Message | null;
  }>({ anchorEl: null, message: null });
  
  // Add state for reaction details popover
  const [reactionDetailsPopover, setReactionDetailsPopover] = useState<{
    anchorEl: HTMLElement | null;
    message: Message | null;
    emoji: string | null;
  }>({ anchorEl: null, message: null, emoji: null });
  
  // Track selected emoji category
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState<string>('recent');
  
  // Available reactions (for backward compatibility)
  const availableReactions = [
    { emoji: '👍', icon: <ThumbUpIcon />, label: 'Like' },
    { emoji: '❤️', icon: <HeartIcon />, label: 'Love' },
    { emoji: '😀', icon: <HappyIcon />, label: 'Happy' },
    { emoji: '😔', icon: <SadIcon />, label: 'Sad' },
    { emoji: '👀', icon: null, label: 'Eyes' },
    { emoji: '🤬', icon: null, label: 'Angry' },
    { emoji: '🤔', icon: null, label: 'Thinking' },
    { emoji: '🤷‍♂️', icon: null, label: 'Shrug' },
    { emoji: '🤷‍♀️', icon: null, label: 'Shrug' },
    { emoji: '🤷', icon: null, label: 'Shrug' },
    { emoji: '🤷‍♂️', icon: null, label: 'Shrug' },
    { emoji: '🤷‍♀️', icon: null, label: 'Shrug' },
    { emoji: '🤷', icon: null, label: 'Shrug' },
    { emoji: '🤢', icon: null, label: 'Disgusted' },
    { emoji: '🤮', icon: null, label: 'Vomit' },
    { emoji: '🤧', icon: null, label: 'Sick' },
    { emoji: '🤒', icon: null, label: 'Sick' },
    { emoji: '🤕', icon: null, label: 'Sick' },
    { emoji: '🤖', icon: null, label: 'Robot' },    
  ];
  
  // Emoji categories for scrolling
  const emojiCategories = [
    {
      id: 'recent',
      name: 'Recent',
      icon: '🕒',
      emojis: availableReactions.map(r => r.emoji).slice(0, 8) // First 8 as "recent"
    },
    {
      id: 'smileys',
      name: 'Smileys',
      icon: '😀',
      emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬']
    },
    {
      id: 'gestures',
      name: 'Gestures',
      icon: '👍',
      emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '👊', '👋', '🙌', '👐', '🤲', '🙏', '✋', '🤚', '👆', '👇', '👈', '👉', '💪', '🦾', '👏', '🙏', '🤝', '🤜', '🤛', '✍️', '👋', '👐', '🤲', '🤝', '🙏', '💅', '🤳']
    },
    {
      id: 'love',
      name: 'Love',
      icon: '❤️',
      emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '💌', '💋', '👨‍❤️‍💋‍👨', '👩‍❤️‍💋‍👩', '👩‍❤️‍💋‍👨']
    },
    {
      id: 'animals',
      name: 'Animals',
      icon: '🐱',
      emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷', '🕸', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿', '🦔']
    },
    {
      id: 'food',
      name: 'Food',
      icon: '🍔',
      emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🌽', '🥕', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🧆', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕️', '🍵', '🧃', '🥤', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊']
    }
  ];
  
  // Add state for emoji picker
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  
  // Common emojis for the scrollbar
  const commonEmojis = [
    '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊', 
    '😋', '😎', '😍', '🥰', '😘', '😗', '😙', '😚', '🙂', '🤗',
    '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮',
    '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '👊', '👋', '🙌',
    '❤️', '💔', '💖', '💙', '😢', '😭', '😤', '😠', '😡', '🤬'
  ];
  
  // Theme and media query for responsive design
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  
  // Message deletion feature:
  // 1. User long-presses on their own message (touchscreen or mouse)
  // 2. Context menu appears with delete option
  // 3. Clicking delete shows confirmation dialog
  // 4. User confirms deletion, message is removed from Firestore
  // 5. If deleted message was the last in conversation, the conversation's lastMessage is updated

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };
  
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
          profilePic,
          followers: userData.followers || []
        };
      } else {
        // If no user document, try to get from auth
        // This would require an admin SDK in a real environment
        return {
          id: uid,
          username: 'Unknown User',
          followers: []
        };
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return {
        id: uid,
        username: 'Unknown User',
        followers: []
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
        
        // Get recipient's user data to check if they follow the current user
        const recipientUserRef = doc(db, 'users', userId);
        const recipientUserDoc = await getDoc(recipientUserRef);
        
        if (!recipientUserDoc.exists()) {
          toast.error('User not found');
          navigate('/messages');
          return null;
        }
        
        const recipientData = recipientUserDoc.data() as UserData;
        
        // CRITICAL CHECK: Does the recipient follow the current user?
        const recipientFollowsCurrentUser = 
          recipientData.following?.includes(currentUser.uid) || false;
        
        console.log(`[Chat] Creating conversation: recipient follows current user? ${recipientFollowsCurrentUser}`);
        
        // Create a new conversation with appropriate status
        const newConversationRef = doc(collection(db, 'conversations'));
        await setDoc(newConversationRef, {
          participants: [currentUser.uid, userId],
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp(),
          unreadCount: {
            [currentUser.uid]: 0,
            [userId]: 0
          },
          // If recipient follows the sender, it's accepted. Otherwise pending
          status: recipientFollowsCurrentUser ? 'accepted' : 'pending'
        });
        
        console.log(`[Chat] Created new conversation with status: ${recipientFollowsCurrentUser ? 'accepted' : 'pending'}`);
        
        // Navigate to the new conversation
        navigate(`/chat/conversation/${newConversationRef.id}`, { replace: true });
        return newConversationRef.id;
      } catch (error) {
        console.error('[Chat] Error creating conversation:', error);
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
        
        // Check if conversation is pending
        const status = conversationData.status || 'accepted';
        setIsPending(status === 'pending');
        
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
        
        // Mark messages as read if conversation is accepted
        if (status === 'accepted') {
          await updateDoc(conversationRef, {
            [`unreadCount.${currentUser.uid}`]: 0
          });
        }
        
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
          
          // Mark new messages as read if conversation is accepted and they weren't sent by current user
          if (status === 'accepted') {
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
          }
          
          // Scroll to bottom with buffer for more reliable scrolling
          scrollToBottomWithBuffer();
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
  
  // More accurate scrolling with buffer
  const scrollToBottomWithBuffer = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };
  
  const sendMessage = async () => {
    if (!messageText.trim() || !currentUser?.uid || !conversation) {
      return;
    }
    
    // Check if the conversation is pending and the current user is the recipient
    if (isPending && conversation.participants[0] !== currentUser.uid) {
      toast.error('You need to accept this message request before you can reply');
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
        read: false,
        reactions: []
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
          
          console.log('[Chat] Notification sent for new message to:', otherParticipantId);
        } catch (notifError) {
          console.error('[Chat] Error creating message notification:', notifError);
          // Don't show error to user, just log it - we don't want to disrupt the message sending flow
        }
      }
      
      setMessageText('');
      scrollToBottomWithBuffer();
    } catch (error) {
      console.error('[Chat] Error sending message:', error);
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser || !conversation) return;
    
    const actualConversationId = conversationId || userId;
    if (!actualConversationId) return;
    
    // Check file size (limit to 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('File too large. Maximum size is 10MB.');
      return;
    }
    
    // Verify file type
    const fileType = file.type.split('/')[0];
    if (fileType !== 'image' && fileType !== 'video') {
      toast.error('Only image and video files are supported.');
      return;
    }
    
    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      console.log(`[Chat] Starting upload for file ${file.name} to conversation ${actualConversationId}`);
      
      // Create a reference to the file in Firebase Storage
      const storageRef = ref(storage, `chat-media/${actualConversationId}/${Date.now()}_${file.name}`);
      
      // Upload the file
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      // Track upload progress
      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
          console.log(`[Chat] Upload progress: ${progress.toFixed(2)}%`);
        },
        (error) => {
          console.error('Error uploading file:', error);
          // More detailed error message
          const errorMessage = error.code === 'storage/unauthorized' 
            ? 'Permission denied. Cannot upload file (storage rules need to be updated).' 
            : `Upload failed: ${error.message}`;
          
          toast.error(errorMessage);
          setIsUploading(false);
          setUploadProgress(null);
        },
        async () => {
          // Upload completed successfully, get download URL
          console.log(`[Chat] Upload completed successfully, getting download URL`);
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log(`[Chat] Download URL obtained: ${downloadURL}`);
            
            // Now we can send the message with the media URL
            await sendMediaMessage(downloadURL, fileType as 'image' | 'video');
            
            setIsUploading(false);
            setUploadProgress(null);
          } catch (urlError: unknown) {
            console.error('Error getting download URL:', urlError);
            const errorMessage = urlError instanceof Error ? urlError.message : 'Unknown error occurred';
            toast.error(`Failed to process uploaded file: ${errorMessage}`);
            setIsUploading(false);
            setUploadProgress(null);
          }
        }
      );
    } catch (error: unknown) {
      console.error('Error handling file upload:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to upload file: ${errorMessage}`);
      setIsUploading(false);
      setUploadProgress(null);
    }
    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendMediaMessage = async (mediaUrl: string, mediaType: 'image' | 'video') => {
    if (!currentUser?.uid || !conversation) return;
    
    // Check if the conversation is pending and the current user is the recipient
    if (isPending && conversation.participants[0] !== currentUser.uid) {
      toast.error('You need to accept this message request before you can reply');
      return;
    }
    
    const actualConversationId = conversationId || userId;
    if (!actualConversationId) return;
    
    try {
      const messagesRef = collection(db, 'conversations', actualConversationId, 'messages');
      const otherParticipantId = conversation.participants.find(id => id !== currentUser.uid);
      
      if (!otherParticipantId) {
        toast.error('Cannot find chat partner');
        return;
      }
      
      // Create a preview text for the message
      const messagePreview = mediaType === 'image' ? 'Sent an image' : 'Sent a video';
      
      // Add the message with media
      await addDoc(messagesRef, {
        text: messagePreview,
        sender: currentUser.uid,
        timestamp: serverTimestamp(),
        read: false,
        mediaUrl,
        mediaType,
        reactions: []
      });
      
      // Update conversation with last message and timestamp
      const conversationRef = doc(db, 'conversations', actualConversationId);
      await updateDoc(conversationRef, {
        lastMessage: {
          text: messagePreview,
          sender: currentUser.uid,
          timestamp: serverTimestamp()
        },
        lastUpdated: serverTimestamp(),
        [`unreadCount.${otherParticipantId}`]: (conversation.lastMessage?.sender === currentUser.uid ? 1 : 0) + 1
      });
      
      // Create a notification for the recipient
      if (chatPartner && currentUser) {
        try {
          const userProfileRef = doc(db, 'users', currentUser.uid);
          const userProfileSnap = await getDoc(userProfileRef);
          const userProfileData = userProfileSnap.exists() ? userProfileSnap.data() : null;
          
          const senderName = userProfileData?.name || userProfileData?.username || currentUser.displayName || 'Someone';
          const senderAvatar = userProfileData?.profilePic || currentUser.photoURL;
          
          await addNotification({
            type: 'message',
            senderId: currentUser.uid,
            senderName: senderName,
            senderAvatar: senderAvatar,
            recipientId: otherParticipantId,
            content: mediaType === 'image' ? 'Sent you an image' : 'Sent you a video',
            postId: actualConversationId,
            roomId: actualConversationId
          });
        } catch (notifError) {
          console.error('[Chat] Error creating media message notification:', notifError);
        }
      }
      
      scrollToBottomWithBuffer();
    } catch (error) {
      console.error('[Chat] Error sending media message:', error);
      toast.error('Failed to send media');
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleAcceptRequest = async () => {
    if (!conversation || !currentUser) return;
    
    try {
      setLoading(true);
      
      // Update conversation status to accepted
      const conversationRef = doc(db, 'conversations', conversation.id);
      await updateDoc(conversationRef, {
        status: 'accepted'
      });
      
      // Update local state
      setIsPending(false);
      setConversation({
        ...conversation,
        status: 'accepted'
      });
      
      setSnackbarMessage('Message request accepted');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error accepting message request:', error);
      toast.error('Failed to accept message request');
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineRequest = async () => {
    if (!conversation || !currentUser) return;
    
    try {
      setLoading(true);
      
      // Create a batch for multiple operations
      const batch = writeBatch(db);
      
      // First, delete all messages in the conversation
      const messagesRef = collection(db, 'conversations', conversation.id, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);
      
      // Add all message deletes to batch
      messagesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Next, delete the conversation document
      const conversationRef = doc(db, 'conversations', conversation.id);
      batch.delete(conversationRef);
      
      // Commit the batch
      await batch.commit();
      
      // Navigate back to messages
      navigate('/messages');
      
      setSnackbarMessage('Message request declined');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error declining message request:', error);
      toast.error('Failed to decline message request');
    } finally {
      setLoading(false);
    }
  };

  const handleMessageDelete = async () => {
    if (!selectedMessage || !currentUser?.uid || !conversation) {
      setConfirmDeleteOpen(false);
      return;
    }
    
    // Only allow users to delete their own messages
    if (selectedMessage.sender !== currentUser?.uid) {
      toast.error("You can only delete your own messages");
      setConfirmDeleteOpen(false);
      return;
    }
    
    const actualConversationId = conversationId || userId;
    if (!actualConversationId) {
      setConfirmDeleteOpen(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // Delete the message from Firestore
      const messageRef = doc(db, 'conversations', actualConversationId, 'messages', selectedMessage.id);
      await deleteDoc(messageRef);
      
      // If it was the last message, update the conversation document
      if (conversation.lastMessage?.timestamp &&
          selectedMessage.timestamp &&
          conversation.lastMessage.timestamp.seconds === selectedMessage.timestamp.seconds) {
        
        // Get the new last message
        const messagesRef = collection(db, 'conversations', actualConversationId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
        const snapshot = await getDocs(q);
        
        const conversationRef = doc(db, 'conversations', actualConversationId);
        
        if (snapshot.empty) {
          // No messages left
          await updateDoc(conversationRef, {
            lastMessage: null
          });
        } else {
          // Update with the new last message
          const newLastMessage = snapshot.docs[0].data();
          await updateDoc(conversationRef, {
            lastMessage: {
              text: newLastMessage.text,
              sender: newLastMessage.sender,
              timestamp: newLastMessage.timestamp
            }
          });
        }
      }
      
      setSnackbarMessage('Message deleted');
      setSnackbarOpen(true);
      
      // Remove from local state to update UI immediately
      setMessages(prev => prev.filter(msg => msg.id !== selectedMessage.id));
      
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    } finally {
      setLoading(false);
      setConfirmDeleteOpen(false);
      setSelectedMessage(null);
      setContextMenu(null);
    }
  };

  // Handle long press start
  const handleMessageMouseDown = (event: React.MouseEvent | React.TouchEvent, message: Message) => {
    // Start a timer for long press
    const timer = setTimeout(() => {
      // For the message owner, show delete option
      if (message.sender === currentUser?.uid) {
        if ('clientX' in event) { // mouse event
          setContextMenu({
            mouseX: event.clientX - 2,
            mouseY: event.clientY - 4,
            message: message
          });
        } else if (event.touches?.length) { // touch event
          const touch = event.touches[0];
          setContextMenu({
            mouseX: touch.clientX - 2,
            mouseY: touch.clientY - 4,
            message: message
          });
        }
        setSelectedMessage(message);
      } 
      // For both sender and recipient, show reaction options on long press
      else {
        if ('currentTarget' in event) {
          handleOpenReactions(event as React.MouseEvent<HTMLElement>, message);
        }
      }
    }, 500); // 500ms long press
    
    setLongPressTimer(timer);
  };
  
  // Handle long press end
  const handleMessageMouseUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };
  
  // Handle context menu close
  const handleContextMenuClose = () => {
    setContextMenu(null);
  };
  
  // Prompt delete confirmation from context menu
  const promptDelete = () => {
    setConfirmDeleteOpen(true);
    setContextMenu(null);
  };

  // Open reaction popover
  const handleOpenReactions = (event: React.MouseEvent<HTMLElement>, message: Message) => {
    // Clear any pending long press timers
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    // Open the reaction popover
    setReactionPopover({
      anchorEl: event.currentTarget,
      message: message
    });
    
    // If there was a context menu open, close it
    if (contextMenu) {
      setContextMenu(null);
    }
  };
  
  // Close reaction popover
  const handleCloseReactions = () => {
    setReactionPopover({
      anchorEl: null,
      message: null
    });
  };
  
  // Open reaction details popover
  const handleOpenReactionDetails = (event: React.MouseEvent<HTMLElement>, message: Message, emoji: string) => {
    // Prevent event propagation to avoid triggering other handlers
    event.stopPropagation();
    
    setReactionDetailsPopover({
      anchorEl: event.currentTarget,
      message,
      emoji
    });
  };
  
  // Close reaction details popover
  const handleCloseReactionDetails = () => {
    setReactionDetailsPopover({
      anchorEl: null,
      message: null,
      emoji: null
    });
  };
  
  // Remove user's reaction
  const removeReaction = async (messageId: string, emoji: string) => {
    if (!currentUser?.uid || !conversation) {
      return;
    }
    
    const actualConversationId = conversationId || userId;
    if (!actualConversationId) return;
    
    try {
      const messageRef = doc(db, 'conversations', actualConversationId, 'messages', messageId);
      
      // Get the message to access its reactions
      const messageDoc = await getDoc(messageRef);
      if (!messageDoc.exists()) {
        toast.error('Message not found');
        return;
      }
      
      const messageData = messageDoc.data();
      const existingReactions = messageData.reactions || [];
      
      // Filter out the user's reaction with this emoji
      const updatedReactions = existingReactions.filter(
        (r: Reaction) => !(r.userId === currentUser.uid && r.emoji === emoji)
      );
      
      // Update Firestore
      await updateDoc(messageRef, {
        reactions: updatedReactions
      });
      
      // Update local state
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, reactions: updatedReactions } : msg
      ));
      
      // Close the details popover
      handleCloseReactionDetails();
      
    } catch (error) {
      console.error('[Chat] Error removing reaction:', error);
      toast.error('Failed to remove reaction');
    }
  };
  
  // Add a reaction to a message
  const addReaction = async (emoji: string) => {
    if (!reactionPopover.message || !currentUser?.uid || !conversation) {
      return;
    }
    
    const actualConversationId = conversationId || userId;
    if (!actualConversationId) return;
    
    try {
      const messageId = reactionPopover.message.id;
      const messageRef = doc(db, 'conversations', actualConversationId, 'messages', messageId);
      
      // Get existing reactions or initialize empty array
      const existingReactions = reactionPopover.message.reactions || [];
      
      // Check if user already reacted with this emoji
      const existingReactionIndex = existingReactions.findIndex(
        r => r.userId === currentUser.uid && r.emoji === emoji
      );
      
      if (existingReactionIndex !== -1) {
        // User already reacted with this emoji, remove the reaction
        const updatedReactions = [...existingReactions];
        updatedReactions.splice(existingReactionIndex, 1);
        
        // Update Firestore
        await updateDoc(messageRef, {
          reactions: updatedReactions
        });
        
        // Update local state
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, reactions: updatedReactions } : msg
        ));
      } else {
        // Add new reaction
        const newReaction: Reaction = {
          emoji,
          userId: currentUser.uid,
          username: currentUser.displayName || ''
        };
        
        const updatedReactions = [...existingReactions, newReaction];
        
        // Update Firestore
        await updateDoc(messageRef, {
          reactions: updatedReactions
        });
        
        // Update local state
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, reactions: updatedReactions } : msg
        ));
      }
      
      // Close the reaction popover
      handleCloseReactions();
      
    } catch (error) {
      console.error('[Chat] Error adding reaction:', error);
      toast.error('Failed to add reaction');
      handleCloseReactions();
    }
  };

  const renderMessage = (message: Message) => {
    const isCurrentUser = message.sender === currentUser?.uid;
    
    return (
      <Box
        key={message.id}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isCurrentUser ? 'flex-end' : 'flex-start',
          mb: 0.5,
          px: 1
        }}
      >
        <Box
          sx={{
            maxWidth: message.mediaUrl ? '80%' : '70%',
            backgroundColor: isCurrentUser 
              ? 'primary.main' 
              : (theme) => theme.palette.mode === 'dark' 
                ? 'rgba(255, 255, 255, 0.15)' 
                : 'background.paper',
            color: isCurrentUser 
              ? 'primary.contrastText' 
              : (theme) => theme.palette.mode === 'dark' 
                ? 'common.white' 
                : 'text.primary',
            borderRadius: isCurrentUser ? '20px 20px 0 20px' : '20px 20px 20px 0',
            p: message.mediaUrl ? 1 : 2,
            position: 'relative',
            boxShadow: 1,
            '& .timestamp': {
              position: 'absolute',
              bottom: 2,
              right: isCurrentUser ? 8 : 'auto',
              left: isCurrentUser ? 'auto' : 8,
              fontSize: '0.7rem',
              color: isCurrentUser ? 'rgba(255,255,255,0.7)' : (theme) => 
                theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'text.secondary'
            },
            transition: 'opacity 0.2s ease',
            '&:hover': {
              opacity: 0.9,
              cursor: 'pointer'
            },
            '&:active': {
              opacity: 0.7
            }
          }}
          onMouseDown={(e) => handleMessageMouseDown(e, message)}
          onMouseUp={handleMessageMouseUp}
          onMouseLeave={handleMessageMouseUp}
          onTouchStart={(e) => handleMessageMouseDown(e, message)}
          onTouchEnd={handleMessageMouseUp}
          onTouchCancel={handleMessageMouseUp}
          onClick={(e) => handleOpenReactions(e, message)}
        >
          {message.mediaUrl && message.mediaType === 'image' && (
            <Box sx={{ mb: 1 }}>
              <img 
                src={message.mediaUrl} 
                alt="Shared image" 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '300px', 
                  borderRadius: '16px',
                  display: 'block'
                }} 
              />
            </Box>
          )}
          
          {message.mediaUrl && message.mediaType === 'video' && (
            <Box sx={{ mb: 1 }}>
              <video 
                src={message.mediaUrl} 
                controls
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '300px', 
                  borderRadius: '16px',
                  display: 'block'
                }} 
              />
            </Box>
          )}
          
          <Typography variant="body1">{message.text}</Typography>
          <Typography variant="caption" className="timestamp">
            {formatTime(message.timestamp)}
          </Typography>
        </Box>
        
        {/* Render reactions if any exist */}
        {message.reactions && message.reactions.length > 0 && (
          <Box 
            sx={{
              display: 'flex',
              flexDirection: isCurrentUser ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              gap: 0.5,
              mt: 0.5,
              maxWidth: '70%',
            }}
          >
            {/* Group reactions by emoji and show count */}
            {Object.entries(
              message.reactions.reduce((acc, reaction) => {
                acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([emoji, count]) => {
              // Check if current user has this reaction
              const userHasThisReaction = message.reactions?.some(
                r => r.emoji === emoji && r.userId === currentUser?.uid
              );
              
              return (
                <Chip
                  key={emoji}
                  label={`${emoji} ${count}`}
                  size="small"
                  variant="outlined"
                  onClick={(e) => handleOpenReactionDetails(e, message, emoji)}
                  sx={{ 
                    borderRadius: '12px',
                    height: '24px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    backgroundColor: (theme) => 
                      userHasThisReaction
                        ? theme.palette.mode === 'dark' 
                          ? 'rgba(25, 118, 210, 0.2)' 
                          : 'rgba(25, 118, 210, 0.1)'
                        : theme.palette.mode === 'dark' 
                          ? 'rgba(255,255,255,0.1)' 
                          : 'rgba(0,0,0,0.05)',
                    border: (theme) => 
                      userHasThisReaction 
                        ? `1px solid ${theme.palette.primary.main}` 
                        : undefined,
                    '&:hover': {
                      backgroundColor: (theme) => 
                        userHasThisReaction
                          ? theme.palette.mode === 'dark' 
                            ? 'rgba(25, 118, 210, 0.3)' 
                            : 'rgba(25, 118, 210, 0.2)'
                          : theme.palette.mode === 'dark' 
                            ? 'rgba(255,255,255,0.15)' 
                            : 'rgba(0,0,0,0.1)',
                    }
                  }}
                />
              );
            })}
          </Box>
        )}
      </Box>
    );
  };

  // Add emoji to message text
  const addEmojiToMessage = (emoji: string) => {
    setMessageText(prev => prev + emoji);
  };
  
  // Toggle emoji picker
  const toggleEmojiPicker = () => {
    setShowEmojiPicker(prev => !prev);
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
          
          {/* Help tooltip for message deletion */}
          <Tooltip title="Tip: Long-press on your messages to delete them" placement="bottom">
            <Typography 
              variant="caption" 
              color="text.secondary"
              sx={{ 
                ml: 'auto', 
                mr: isPending ? 2 : 0,
                display: { xs: 'none', sm: 'block' }
              }}
            >
              <DeleteIcon fontSize="inherit" sx={{ fontSize: '1rem', verticalAlign: 'middle', mr: 0.5 }} />
              Long-press to delete
            </Typography>
          </Tooltip>
          
          {/* Message request actions */}
          {isPending && (
            <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
              <Button 
                variant="contained" 
                color="success"
                startIcon={<AcceptIcon />}
                onClick={handleAcceptRequest}
                size="small"
              >
                Accept
              </Button>
              <Button 
                variant="outlined" 
                color="error"
                startIcon={<DeclineIcon />}
                onClick={handleDeclineRequest}
                size="small"
              >
                Decline
              </Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>
      
      {/* Message request banner */}
      {isPending && (
        <Box sx={{ bgcolor: 'info.light', p: 2 }}>
          <Alert severity="info" icon={false}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2">
                This is a message request from {chatPartner?.name || chatPartner?.username || 'a user'}.
                {conversation?.participants[0] !== currentUser?.uid ? 
                  ' You can read their message, but must accept to respond.' : 
                  ' Waiting for them to accept your request before they can read your message.'}
              </Typography>
              {conversation?.participants[0] !== currentUser?.uid && (
                <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
                  <Button 
                    variant="contained" 
                    color="success"
                    size="small"
                    onClick={handleAcceptRequest}
                  >
                    Accept
                  </Button>
                  <Button 
                    variant="outlined" 
                    color="error"
                    size="small"
                    onClick={handleDeclineRequest}
                  >
                    Decline
                  </Button>
                </Box>
              )}
            </Box>
          </Alert>
        </Box>
      )}
      
      {/* Show upload progress if an upload is in progress */}
      {isUploading && (
        <Box sx={{ width: '100%', px: 2, py: 1, bgcolor: 'background.paper' }}>
          <Typography variant="caption" gutterBottom>
            Uploading media... {uploadProgress ? Math.round(uploadProgress) : 0}%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={uploadProgress || 0}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>
      )}
      
      <Box sx={{ 
        flexGrow: 1, 
        overflowY: 'auto', 
        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50', 
        p: 2,
        pb: 2
      }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : messages.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50%' }}>
            <Typography color="text.secondary">No messages yet. Start the conversation!</Typography>
          </Box>
                  ) : (
          <Box sx={{ mb: "60px" }}> {/* Add bottom margin to account for fixed input area */}
            {Object.entries(groupMessagesByDate()).map(([dateStr, dateMessages]) => (
              <Box key={dateStr} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Divider sx={{ 
                    flexGrow: 1, 
                    mr: 2,
                    borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'inherit'
                  }} />
                  <Typography variant="caption" sx={{ color: (theme) => 
                    theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'text.secondary' }}>
                    {formatMessageDate(dateMessages[0].timestamp)}
                  </Typography>
                  <Divider sx={{ 
                    flexGrow: 1, 
                    ml: 2,
                    borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'inherit'
                  }} />
                </Box>
                {dateMessages.map(renderMessage)}
              </Box>
            ))}
            <div ref={messagesEndRef} style={{ height: "4px" }} />
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
          pt: 1,
          pb: 1.5,
          px: 1.5,
          backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'background.paper' : 'white',
          borderTop: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : '#ddd'}`,
          boxShadow: (theme) => theme.palette.mode === 'dark' 
            ? '0px -2px 10px rgba(0,0,0,0.3)'
            : '0px -2px 10px rgba(0,0,0,0.1)',
          zIndex: 9999
        }}
      >
        {isPending && conversation?.participants[0] !== currentUser?.uid ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 1 }}>
            <Chip
              label="Accept message request to reply"
              color="primary"
              variant="outlined"
              sx={{ fontSize: '0.9rem' }}
            />
          </Box>
        ) : (
          <>
            {/* Emoji Scroll Bar for Desktop - Only show if not uploading */}
            {isDesktop && !isUploading && (
              <Box 
                sx={{
                  display: 'flex',
                  overflowX: 'auto',
                  mb: 1,
                  pb: 1,
                  '&::-webkit-scrollbar': {
                    height: '4px',
                  },
                  '&::-webkit-scrollbar-track': {
                    background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                    borderRadius: '2px',
                  },
                }}
              >
                {commonEmojis.map((emoji) => (
                  <Tooltip key={emoji} title={emoji} placement="top">
                    <Box
                      component="button"
                      onClick={() => addEmojiToMessage(emoji)}
                      sx={{
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontSize: '1.5rem',
                        mx: 0.5,
                        p: 0.5,
                        borderRadius: '4px',
                        minWidth: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                        '&:hover': {
                          transform: 'scale(1.2)',
                          background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                        }
                      }}
                    >
                      {emoji}
                    </Box>
                  </Tooltip>
                ))}
              </Box>
            )}
            
            <Box sx={{ display: 'flex', width: '100%' }}>
              {/* Add file upload input (hidden) */}
              <HiddenFileInput
                ref={fileInputRef}
                accept="image/*,video/*"
                id="file-upload-input"
                type="file"
                onChange={handleFileUpload}
                disabled={isUploading || (isPending && conversation?.participants[0] !== currentUser?.uid)}
              />
              
              {/* Add button for file upload */}
              <IconButton 
                onClick={handleUploadClick}
                disabled={isUploading || (isPending && conversation?.participants[0] !== currentUser?.uid)}
                color="primary"
                sx={{ mr: 1 }}
                aria-label="attach image or video"
              >
                <AddIcon />
              </IconButton>
              
              {/* Add emoji button for mobile */}
              {!isDesktop && (
                <IconButton
                  onClick={toggleEmojiPicker}
                  disabled={isUploading || (isPending && conversation?.participants[0] !== currentUser?.uid)}
                  color="primary"
                  sx={{ mr: 1 }}
                  aria-label="add emoji"
                >
                  <EmojiIcon />
                </IconButton>
              )}
              
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Type a message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                disabled={isUploading || (isPending && conversation?.participants[0] !== currentUser?.uid)}
                sx={{ 
                  mr: 1,
                  "& .MuiInputBase-root": {
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'white'
                  }
                }}
              />
              <Button 
                variant="contained" 
                color="primary"
                disabled={isUploading || (!messageText.trim() && !isUploading) || (isPending && conversation?.participants[0] !== currentUser?.uid)}
                onClick={sendMessage}
              >
                Send
              </Button>
            </Box>
          </>
        )}
      </Box>

      {/* Message Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={promptDelete}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete Message
        </MenuItem>
      </Menu>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">Delete Message?</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete this message? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleMessageDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for feedback messages */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        message={snackbarMessage}
      />

      {/* Reaction Popover with Categories */}
      <Popover
        open={Boolean(reactionPopover.anchorEl)}
        anchorEl={reactionPopover.anchorEl}
        onClose={handleCloseReactions}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        PaperProps={{
          sx: { 
            width: '320px',
            maxWidth: '90vw',
            maxHeight: '350px',
            overflow: 'hidden'
          }
        }}
      >
        <Box sx={{ 
          display: 'flex',
          flexDirection: 'column',
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.800' : 'background.paper',
          borderRadius: 2
        }}>
          {/* Quick Reactions Row */}
          <Box sx={{ 
            display: 'flex',
            p: 1,
            borderBottom: 1,
            borderColor: 'divider',
            justifyContent: 'center'
          }}>
            {availableReactions.slice(0, 7).map((reaction) => (
              <IconButton
                key={reaction.emoji}
                onClick={() => addReaction(reaction.emoji)}
                sx={{ 
                  mx: 0.5,
                  '&:hover': {
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)'
                  }
                }}
                aria-label={reaction.label}
              >
                <Typography variant="body1" sx={{ fontSize: '1.4rem' }}>
                  {reaction.emoji}
                </Typography>
              </IconButton>
            ))}
          </Box>
          
          {/* Category Tabs */}
          <Box sx={{ 
            display: 'flex',
            overflowX: 'auto',
            py: 1,
            borderBottom: 1,
            borderColor: 'divider',
            '&::-webkit-scrollbar': {
              height: '4px',
            },
            '&::-webkit-scrollbar-track': {
              background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
            },
            '&::-webkit-scrollbar-thumb': {
              background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
              borderRadius: '2px',
            },
          }}>
            {emojiCategories.map((category) => (
              <Box
                key={category.id}
                onClick={() => setSelectedEmojiCategory(category.id)}
                sx={{ 
                  minWidth: 'auto',
                  mx: 1.5,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  opacity: selectedEmojiCategory === category.id ? 1 : 0.6,
                  borderBottom: selectedEmojiCategory === category.id ? 2 : 0,
                  borderColor: 'primary.main',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    opacity: 0.8
                  }
                }}
              >
                <Typography sx={{ fontSize: '1.4rem' }}>{category.icon}</Typography>
                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                  {category.name}
                </Typography>
              </Box>
            ))}
          </Box>
          
          {/* Emoji Grid for Selected Category */}
          <Box sx={{ 
            height: '200px',
            overflowY: 'auto',
            p: 1,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'flex-start',
            '&::-webkit-scrollbar': {
              width: '4px',
            },
            '&::-webkit-scrollbar-track': {
              background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
            },
            '&::-webkit-scrollbar-thumb': {
              background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
              borderRadius: '2px',
            },
          }}>
            {emojiCategories.find(c => c.id === selectedEmojiCategory)?.emojis.map((emoji) => (
              <Box
                key={emoji}
                component="button"
                onClick={() => addReaction(emoji)}
                sx={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '1.6rem',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.2s',
                  borderRadius: '4px',
                  '&:hover': {
                    transform: 'scale(1.2)',
                    background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  }
                }}
              >
                {emoji}
              </Box>
            ))}
          </Box>
        </Box>
      </Popover>

      {/* Emoji Picker Popover for Mobile */}
      {!isDesktop && (
        <Popover
          open={showEmojiPicker}
          onClose={() => setShowEmojiPicker(false)}
          anchorReference="anchorPosition"
          anchorPosition={{ top: window.innerHeight - 300, left: window.innerWidth / 2 }}
          transformOrigin={{
            vertical: 'bottom',
            horizontal: 'center',
          }}
        >
          <Box sx={{ 
            p: 1, 
            width: '300px',
            maxWidth: '90vw',
            height: '200px',
            overflow: 'auto',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}>
            {commonEmojis.map((emoji) => (
              <Box
                key={emoji}
                component="button"
                onClick={() => {
                  addEmojiToMessage(emoji);
                  setShowEmojiPicker(false);
                }}
                sx={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '1.8rem',
                  m: 0.5,
                  p: 0.5,
                  borderRadius: '4px',
                  minWidth: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  '&:hover': {
                    background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  }
                }}
              >
                {emoji}
              </Box>
            ))}
          </Box>
        </Popover>
      )}

      {/* Reaction Details Popover */}
      <Popover
        open={Boolean(reactionDetailsPopover.anchorEl)}
        anchorEl={reactionDetailsPopover.anchorEl}
        onClose={handleCloseReactionDetails}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        PaperProps={{
          sx: { 
            width: '250px',
            maxWidth: '90vw',
            maxHeight: '300px'
          }
        }}
      >
        <Box sx={{ 
          p: 2,
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.800' : 'background.paper',
        }}>
          {/* Reaction Header */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            mb: 1.5,
            pb: 1,
            borderBottom: 1,
            borderColor: 'divider'
          }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
              <Box component="span" sx={{ fontSize: '1.6rem', mr: 1 }}>
                {reactionDetailsPopover.emoji}
              </Box>
              Reactions
            </Typography>
            
            {/* If user has this reaction, show Remove button */}
            {reactionDetailsPopover.message && reactionDetailsPopover.emoji && 
             reactionDetailsPopover.message.reactions?.some(
               r => r.emoji === reactionDetailsPopover.emoji && r.userId === currentUser?.uid
             ) && (
              <Button 
                variant="outlined" 
                color="error" 
                size="small"
                onClick={() => removeReaction(
                  reactionDetailsPopover.message?.id || '', 
                  reactionDetailsPopover.emoji || ''
                )}
              >
                Remove
              </Button>
            )}
          </Box>
          
          {/* Users who reacted list */}
          <List sx={{ py: 0 }}>
            {reactionDetailsPopover.message && reactionDetailsPopover.emoji && 
             reactionDetailsPopover.message.reactions
              ?.filter(r => r.emoji === reactionDetailsPopover.emoji)
              .map((reaction, index) => (
                <ListItem 
                  key={`${reaction.userId}-${index}`}
                  sx={{ 
                    py: 0.5, 
                    px: 1,
                    borderRadius: 1,
                    my: 0.3,
                    bgcolor: reaction.userId === currentUser?.uid 
                      ? (theme) => theme.palette.mode === 'dark' ? 'rgba(25, 118, 210, 0.15)' : 'rgba(25, 118, 210, 0.05)'
                      : 'transparent'
                  }}
                >
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    width: '100%',
                    justifyContent: 'space-between'
                  }}>
                    <Typography>
                      {reaction.username || 'User'} 
                      {reaction.userId === currentUser?.uid && (
                        <Typography component="span" color="text.secondary" sx={{ ml: 0.5, fontSize: '0.8rem' }}>
                          (you)
                        </Typography>
                      )}
                    </Typography>
                    <Typography fontSize="1.2rem">
                      {reaction.emoji}
                    </Typography>
                  </Box>
                </ListItem>
            ))}
          </List>
        </Box>
      </Popover>
    </Box>
  );
};

export default Chat; 