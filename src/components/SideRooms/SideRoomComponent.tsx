import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db, auth } from '../../services/firebase';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  runTransaction,
  onSnapshot,
  FirestoreError,
  collection,
  query,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
  getDocs,
  where,
  writeBatch,
  deleteDoc,
  Firestore,
  increment,
  FieldValue,
  Timestamp,
  setDoc,
  startAfter,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import {
  Box,
  Typography,
  Button,
  Avatar,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  IconButton,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  InputBase,
  Menu,
  MenuItem,
  ListItemIcon,
  FormControlLabel,
  Switch,
  Autocomplete,
  Slider,
  Stack,
  InputAdornment,
  Link as MuiLink,
  Select,
  FormControl,
  InputLabel,
  FormHelperText,
  Grid
} from '@mui/material';
import { 
  ExitToApp, 
  Lock, 
  Group, 
  LocalFireDepartment, 
  Chat,
  MoreVert,
  Send,
  Edit,
  Delete,
  PersonAdd,
  Search,
  Close,
  Videocam,
  VideocamOff,
  QrCode,
  Palette,
  Upload as UploadIcon,
  Image as ImageIcon,
  Delete as DeleteIcon,
  FiberManualRecord,
  Stop,
  ContentCopy,
  Visibility,
  Share as ShareIcon
} from '@mui/icons-material';
import type { SideRoom, RoomMember } from '../../types/index';
import MuxStream from '../Stream/MuxStream';
import RoomForm from './RoomForm';
import _ from 'lodash';
import ViewerPanel from './ViewerPanel';
import { createLiveStream, deleteLiveStream, fetchWithCORS } from '../../api/mux';

interface Message {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  content: string;
  timestamp: Date | { toDate: () => Date };
  photoURL?: string;
  displayName?: string;
}

interface User {
  id: string;
  username: string;
  avatar: string;
  uid?: string;
  displayName?: string;
  photoURL?: string;
}

interface PresenceData {
  userId: string;
  username: string;
  avatar: string;
  lastSeen: number;
  isOnline: boolean;
}

interface RoomStyle {
  headerColor: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  font: string;
  customCss: string;
  headerGradient: boolean;
  backgroundGradient: boolean;
  glitterEffect: boolean;
  headerFontSize: number;
  stickers: string[];
}

interface RecordedStream {
  id: string;
  playbackId: string;
  startedAt: Date;
  endedAt?: Date;
  duration?: number;
  title?: string;
}

// Update font options
const FONT_OPTIONS = [
  { label: 'Default', value: 'inherit' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Roboto', value: 'Roboto, sans-serif' },
  { label: 'Open Sans', value: 'Open Sans, sans-serif' },
  { label: 'Montserrat', value: 'Montserrat, sans-serif' },
  { label: 'Playfair Display', value: 'Playfair Display, serif' },
  { label: 'Comic Sans MS', value: 'Comic Sans MS, cursive' },
  { label: 'Poppins', value: 'Poppins, sans-serif' },
  { label: 'Dancing Script', value: 'Dancing Script, cursive' },
  { label: 'Pacifico', value: 'Pacifico, cursive' },
  { label: 'Quicksand', value: 'Quicksand, sans-serif' },
  { label: 'Lato', value: 'Lato, sans-serif' },
  { label: 'Raleway', value: 'Raleway, sans-serif' },
  { label: 'Nunito', value: 'Nunito, sans-serif' },
  { label: 'Source Sans Pro', value: 'Source Sans Pro, sans-serif' },
  { label: 'Ubuntu', value: 'Ubuntu, sans-serif' },
  { label: 'Oswald', value: 'Oswald, sans-serif' },
  { label: 'Merriweather', value: 'Merriweather, serif' },
  { label: 'Noto Sans', value: 'Noto Sans, sans-serif' }
];

// Add color presets including gradients
const COLOR_PRESETS = [
  { name: 'Default', value: '#ffffff' },
  { name: 'Ocean Blue', value: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)' },
  { name: 'Sunset', value: 'linear-gradient(135deg, #ff6b6b 0%, #556270 100%)' },
  { name: 'Forest', value: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)' },
  { name: 'Purple Rain', value: 'linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%)' },
  { name: 'Glitter Gold', value: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' },
  { name: 'Neon Pink', value: 'linear-gradient(135deg, #ff6b6b 0%, #ff8e8e 100%)' },
  { name: 'Electric Blue', value: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)' },
  { name: 'Mint Fresh', value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { name: 'Glitter Purple', value: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  { name: 'Midnight', value: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
  { name: 'Sunrise', value: 'linear-gradient(135deg, #ff512f 0%, #f09819 100%)' },
  { name: 'Emerald', value: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  { name: 'Rose', value: 'linear-gradient(135deg, #ff758c 0%, #ff7eb3 100%)' },
  { name: 'Sky', value: 'linear-gradient(135deg, #56ccf2 0%, #2f80ed 100%)' },
  { name: 'Autumn', value: 'linear-gradient(135deg, #f2994a 0%, #f2c94c 100%)' },
  { name: 'Crystal', value: 'linear-gradient(135deg, #159957 0%, #155799 100%)' },
  { name: 'Neon', value: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)' },
  { name: 'Royal', value: 'linear-gradient(135deg, #141e30 0%, #243b55 100%)' },
  { name: 'Cotton Candy', value: 'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)' }
];

// Add sticker options
const STICKER_OPTIONS = [
  { name: 'Star', value: '⭐' },
  { name: 'Heart', value: '❤️' },
  { name: 'Fire', value: '🔥' },
  { name: 'Sparkles', value: '✨' },
  { name: 'Rocket', value: '🚀' },
  { name: 'Party', value: '🎉' },
  { name: 'Music', value: '🎵' },
  { name: 'Gaming', value: '🎮' },
  { name: 'Art', value: '🎨' },
  { name: 'Sports', value: '⚽' },
  { name: 'Food', value: '🍕' },
  { name: 'Travel', value: '✈️' },
  { name: 'Tech', value: '💻' },
  { name: 'Nature', value: '🌿' },
  { name: 'Weather', value: '☀️' }
];

// Update the imported SideRoom type to include the new properties
declare module '../../types/index' {
  interface SideRoom {
    style?: RoomStyle;
    isRecording?: boolean;
    recordedStreams?: RecordedStream[];
    currentRecordingId?: string;
    currentStreamId?: string;
    mobileStreamKey?: string;
    mobilePlaybackId?: string;
    mobileStreamerId?: string;
    isMobileStreaming?: boolean;
    viewers?: RoomMember[];
  }
}

const SideRoomComponent: React.FC = () => {
  const { roomId } = useParams();
  const { currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<SideRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  const [presence, setPresence] = useState<PresenceData[]>([]);
  const [isMobileStreaming, setIsMobileStreaming] = useState(false);
  const [mobileStreamUrl, setMobileStreamUrl] = useState('');
  const [showMobileStreamDialog, setShowMobileStreamDialog] = useState(false);
  const [streamKey, setStreamKey] = useState('');
  const [showStyleDialog, setShowStyleDialog] = useState(false);
  const [roomStyle, setRoomStyle] = useState({
    headerColor: room?.style?.headerColor || '#ffffff',
    backgroundColor: room?.style?.backgroundColor || '#ffffff',
    textColor: room?.style?.textColor || '#000000',
    accentColor: room?.style?.accentColor || '#000000',
    font: room?.style?.font || '',
    customCss: room?.style?.customCss || '',
    headerGradient: room?.style?.headerGradient || false,
    backgroundGradient: room?.style?.backgroundGradient || false,
    glitterEffect: room?.style?.glitterEffect || false,
    headerFontSize: room?.style?.headerFontSize || 24,
    stickers: room?.style?.stickers || []
  });
  const [isRecording, setIsRecording] = useState(false);
  const [recordedStreams, setRecordedStreams] = useState<RecordedStream[]>([]);
  const [showRecordingsDialog, setShowRecordingsDialog] = useState(false);
  const [lastMessageDoc, setLastMessageDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const MESSAGES_PER_PAGE = 25;

  // Add new viewer-specific state
  const [showViewerControls, setShowViewerControls] = useState(false);
  const [viewerMode, setViewerMode] = useState<'chat' | 'stream' | 'info'>('stream');

  // Add state for share dialog
  const [showShareDialog, setShowShareDialog] = useState(false);

  const mountedRef = useRef(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const intersectionObserver = useRef<IntersectionObserver | null>(null);

  const isRoomOwner = useMemo(() => room?.ownerId === currentUser?.uid, [room?.ownerId, currentUser?.uid]);
  const isViewer = useMemo(() => room?.viewers?.some(viewer => viewer.userId === currentUser?.uid) || false, [room?.viewers, currentUser?.uid]);

  // Combine owner and viewer checks
  const hasRoomAccess = isRoomOwner || isViewer;

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleError = useCallback((err: unknown, defaultMessage: string) => {
    console.error(defaultMessage, err);
    if (mountedRef.current) {
      if (err instanceof FirestoreError) {
        setError(`Firestore error: ${err.message}`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(defaultMessage);
      }
    }
  }, []);

  const setupMessagesListener = () => {
    if (!currentUser || !roomId || !db) return;

    try {
      const messagesRef = collection(db, 'sideRooms', roomId, 'messages');
      const q = query(
        messagesRef, 
        orderBy('timestamp', 'desc'), 
        limit(MESSAGES_PER_PAGE)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          setLastMessageDoc(snapshot.docs[snapshot.docs.length - 1]);
        }
        const newMessages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date()
        })).reverse();
        
        setMessages(prevMessages => {
          // Deduplicate messages
          const messageMap = new Map();
          [...newMessages, ...prevMessages].forEach(msg => {
            if (!messageMap.has(msg.id)) {
              messageMap.set(msg.id, msg);
            }
          });
          return Array.from(messageMap.values());
        });
      });

      return () => unsubscribe();
    } catch (err) {
      console.error('Error setting up message listener:', err);
      setError('Failed to set up message listener');
    }
  };

  const loadMoreMessages = async () => {
    if (!lastMessageDoc || isLoadingMore || !roomId || !db) return;

    try {
      setIsLoadingMore(true);
      const messagesRef = collection(db, 'sideRooms', roomId, 'messages');
      const q = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        startAfter(lastMessageDoc),
        limit(MESSAGES_PER_PAGE)
      );

      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setLastMessageDoc(snapshot.docs[snapshot.docs.length - 1]);
        const moreMessages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date()
        })).reverse();

        setMessages(prevMessages => {
          const messageMap = new Map();
          [...prevMessages, ...moreMessages].forEach(msg => {
            if (!messageMap.has(msg.id)) {
              messageMap.set(msg.id, msg);
            }
          });
          return Array.from(messageMap.values());
        });
      }
    } catch (err) {
      console.error('Error loading more messages:', err);
      toast.error('Failed to load more messages');
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Add intersection observer for infinite scroll
  useEffect(() => {
    if (!messagesEndRef.current) return;

    intersectionObserver.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreMessages();
        }
      },
      { threshold: 0.5 }
    );

    intersectionObserver.current.observe(messagesEndRef.current);

    return () => {
      if (intersectionObserver.current) {
        intersectionObserver.current.disconnect();
      }
    };
  }, [messagesEndRef.current, lastMessageDoc]);

  // Optimize presence updates with debouncing
  const updatePresence = useCallback(
    _.debounce(async () => {
      if (!currentUser?.uid || !roomId) {
        console.error('Presence update aborted: currentUser.uid or roomId is missing', { currentUser, roomId });
        return;
      }
      try {
        const presenceRef = doc(db, 'sideRooms', roomId, 'presence', currentUser.uid);
        const presenceData = {
          userId: currentUser.uid,
          username: currentUser.displayName || currentUser.email?.split('@')[0] || '',
          avatar: currentUser.photoURL || '',
          lastSeen: serverTimestamp(),
          isOnline: true,
          role: isRoomOwner ? 'owner' : 'viewer'
        };
        console.log('Writing presence (debounced):', { path: presenceRef.path, data: presenceData });
        await setDoc(presenceRef, presenceData, { merge: true });
      } catch (err) {
        console.error('Presence Firestore write failed (debounced):', err, { currentUser, roomId });
      }
    }, 1000),
    [currentUser, roomId, isRoomOwner]
  );

  // Add presence cleanup
  useEffect(() => {
    if (!currentUser || !roomId || !db) return;

    const presenceRef = doc(db, 'sideRooms', roomId, 'presence', currentUser.uid);
    const cleanup = async () => {
      try {
        await setDoc(presenceRef, {
          isOnline: false,
          lastSeen: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.error('Error cleaning up presence:', err);
      }
    };

    window.addEventListener('beforeunload', cleanup);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        cleanup();
      } else {
        updatePresence();
      }
    });

    return () => {
      window.removeEventListener('beforeunload', cleanup);
      cleanup();
    };
  }, [currentUser, roomId]);

  // Add local message cache
  const [localMessageCache, setLocalMessageCache] = useState<Map<string, Message>>(new Map());

  const addToLocalCache = (message: Message) => {
    setLocalMessageCache(prev => {
      const newCache = new Map(prev);
      newCache.set(message.id, message);
      // Keep cache size manageable
      if (newCache.size > 100) {
        const keys = Array.from(newCache.keys());
        if (keys.length > 0) {
          newCache.delete(keys[0]); // Delete oldest message
        }
      }
      return newCache;
    });
  };

  // Optimize message sending with optimistic updates
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId || !currentUser || !newMessage.trim()) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      userId: currentUser.uid,
      username: currentUser.displayName || currentUser.email?.split('@')[0] || '',
      avatar: currentUser.photoURL || '',
      content: messageContent,
      timestamp: new Date(),
      photoURL: currentUser.photoURL || '',
      displayName: currentUser.displayName || currentUser.email?.split('@')[0] || ''
    };

    // Optimistic update
    setMessages(prev => [...prev, tempMessage]);

    try {
      const messagesRef = collection(db, 'sideRooms', roomId, 'messages');
      const messageData = {
        userId: currentUser.uid,
        username: currentUser.displayName || currentUser.email?.split('@')[0] || '',
        avatar: currentUser.photoURL || '',
        content: messageContent,
        timestamp: serverTimestamp(),
        photoURL: currentUser.photoURL || '',
        displayName: currentUser.displayName || currentUser.email?.split('@')[0] || '',
        // Add required fields for security rules
        ownerId: room?.ownerId,
        viewers: room?.viewers?.map(v => v.userId) || []
      };

      const docRef = await addDoc(messagesRef, messageData);
      
      // Update the temporary message with the real ID
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId 
            ? { ...msg, id: docRef.id } 
            : msg
        )
      );

      addToLocalCache({ ...messageData, id: docRef.id, timestamp: new Date() });
    } catch (err) {
      // Revert optimistic update on error
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      handleError(err, 'Failed to send message');
    }
  };

  const setupPresenceListener = () => {
    if (!currentUser || !roomId || !db) return;

    try {
      const presenceRef = collection(db, 'sideRooms', roomId, 'presence');
      const userPresenceRef = doc(presenceRef, currentUser.uid);
      const roomRef = doc(db, 'sideRooms', roomId);

      // Single source of truth for presence updates
      let isUpdating = false;
      let lastUpdateTime = 0;
      const UPDATE_INTERVAL = 5000; // 5 seconds between updates

      const updatePresence = async () => {
        if (!currentUser?.uid || !roomId) {
          console.error('Presence update aborted: currentUser.uid or roomId is missing', { currentUser, roomId });
          return;
        }
        if (isUpdating) return;
        const now = Date.now();
        if (now - lastUpdateTime < UPDATE_INTERVAL) return;
        isUpdating = true;
        lastUpdateTime = now;
        try {
          // Use updateDoc instead of transaction to avoid version conflicts
          const presenceSnapshot = await getDocs(presenceRef);
          const currentActiveUsers = presenceSnapshot.docs.length;
          // Update user's presence
          const presenceData = {
              userId: currentUser.uid,
              username: currentUser.displayName || currentUser.email?.split('@')[0] || '',
              avatar: currentUser.photoURL || '',
              displayName: currentUser.displayName || currentUser.email?.split('@')[0] || '',
              photoURL: currentUser.photoURL || '',
              lastSeen: serverTimestamp(),
            isOnline: true
          };
          // console.log('Writing presence (updateDoc):', { path: userPresenceRef.path, data: presenceData });
          await setDoc(userPresenceRef, presenceData, { merge: true });
            // Update room's active users count
          await updateDoc(roomRef, {
            activeUsers: currentActiveUsers,
              lastActive: serverTimestamp()
          });
        } catch (error) {
          console.error('Presence Firestore write failed (updateDoc):', error, { currentUser, roomId });
        } finally {
          isUpdating = false;
        }
      };

      // Set up cleanup
      const cleanup = async () => {
        try {
          // Remove user's presence
          await deleteDoc(userPresenceRef);
          // Update room's active users count
          const presenceSnapshot = await getDocs(presenceRef);
          const currentActiveUsers = presenceSnapshot.docs.length;
          await updateDoc(roomRef, {
              activeUsers: Math.max(0, currentActiveUsers - 1),
              lastActive: serverTimestamp()
          });
        } catch (error) {
          console.error('Error in cleanup:', error);
        }
      };

      // Set up periodic presence updates
      const updateInterval = setInterval(updatePresence, UPDATE_INTERVAL);

      // Handle page visibility changes
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          cleanup();
        } else {
          updatePresence();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('beforeunload', cleanup);

      // Initial presence setup
      updatePresence();

      // Set up presence listener
      const unsubscribe = onSnapshot(presenceRef, (snapshot) => {
        const presenceData = snapshot.docs.map(doc => ({
          userId: doc.id,
          username: doc.data().displayName || doc.data().username || 'Anonymous',
          avatar: doc.data().photoURL || doc.data().avatar || '',
          lastSeen: doc.data().lastSeen?.toDate() || new Date(),
          isOnline: true
        }));
        setPresence(presenceData);
      });

      return () => {
        clearInterval(updateInterval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('beforeunload', cleanup);
        cleanup();
        unsubscribe();
      };
    } catch (error) {
      console.error('Error setting up presence listener:', error);
      setError('Failed to set up presence listener');
    }
  };

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!currentUser) {
      navigate('/login');
      return;
    }

    let roomUnsubscribe: (() => void) | undefined;
    let messagesUnsubscribe: (() => void) | undefined;
    let presenceUnsubscribe: (() => void) | undefined;

    const setupRoomListener = async () => {
      try {
        if (!roomId || !db) return;
        
        const roomRef = doc(db, 'sideRooms', roomId);
        roomUnsubscribe = onSnapshot(roomRef, 
          async (doc) => {
            if (doc.exists()) {
              const roomData = doc.data() as SideRoom;
              setRoom(roomData);
              setLoading(false);

              // Check if user is a viewer or owner
              const isViewer = roomData.viewers?.some(viewer => viewer.userId === currentUser.uid);
              const isOwner = roomData.ownerId === currentUser.uid;

              if (isViewer || isOwner) {
                // If user has access, set up listeners
                setupMessagesListener();
                setupPresenceListener();
              } else {
                // If not a viewer, unsubscribe from any existing listeners
                if (messagesUnsubscribe) messagesUnsubscribe();
                if (presenceUnsubscribe) presenceUnsubscribe();
                messagesUnsubscribe = undefined;
                presenceUnsubscribe = undefined;
                setError('You need to be a viewer of this room to access its content');
              }
            } else {
              setError('Room not found');
              setLoading(false);
            }
          },
          (error) => {
            console.error('Error listening to room:', error);
            setError('Failed to load room data');
            setLoading(false);
          }
        );
      } catch (error) {
        console.error('Error setting up room listener:', error);
        setError('Failed to load room');
        setLoading(false);
      }
    };

    setupRoomListener();

    return () => {
      if (roomUnsubscribe) roomUnsubscribe();
      if (messagesUnsubscribe) messagesUnsubscribe();
      if (presenceUnsubscribe) presenceUnsubscribe();
    };
  }, [authLoading, currentUser, roomId, db, navigate]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleJoinRoom = useCallback(async () => {
    if (!room || !currentUser || !roomId || isProcessing) return;

    try {
      setIsProcessing(true);
      const roomRef = doc(db, 'sideRooms', roomId);

      await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) {
          throw new Error('Room not found');
        }

        const roomData = roomDoc.data();
        
        // Check if user is already a member or viewer
        const isMember = roomData.members?.some((member: RoomMember) => member.userId === currentUser.uid);
        const isViewer = roomData.viewers?.some((viewer: RoomMember) => viewer.userId === currentUser.uid);
        
        if (isMember || isViewer) {
          throw new Error('You are already a member or viewer of this room');
        }

        // Add as viewer by default
        const newViewer: RoomMember = {
          userId: currentUser.uid,
          username: currentUser.displayName || 'Anonymous',
          avatar: currentUser.photoURL || '',
          role: 'viewer' as const,
          joinedAt: serverTimestamp()
        };

        // Update room with new viewer
        transaction.update(roomRef, {
          viewers: arrayUnion(newViewer),
          viewerCount: increment(1),
          activeUsers: increment(1),
          lastActive: serverTimestamp()
        });

        // Create notification for the user
        const notificationRef = doc(collection(db, 'users', currentUser.uid, 'notifications'));
        await setDoc(notificationRef, {
          type: 'room_join',
          roomId,
          roomName: room.name,
          timestamp: serverTimestamp(),
          status: 'unread',
          message: `You have joined "${room.name}" as a viewer`
        });
      });

      if (mountedRef.current) {
        toast.success('Joined room successfully as a viewer');
        setShowPasswordDialog(false);
      }
    } catch (err) {
      console.error('Error joining room:', err);
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error('Failed to join room');
      }
      if (mountedRef.current) {
        setShowPasswordDialog(false);
      }
    } finally {
      if (mountedRef.current) {
        setIsProcessing(false);
      }
    }
  }, [room, currentUser, roomId, isProcessing, db, setShowPasswordDialog, setIsProcessing]);

  // Add new function for room owners to add members
  const handleAddMember = async (userId: string) => {
    if (!room || !currentUser || !roomId || currentUser.uid !== room.ownerId) return;

    try {
      setIsProcessing(true);
      const roomRef = doc(db, 'sideRooms', roomId);
      
      // Get user's profile data
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      
      // Check if user is already a member or viewer
      const isMember = room.members?.some(member => member.userId === userId);
      const isViewer = room.viewers?.some(viewer => viewer.userId === userId);
      
      if (isMember) {
        throw new Error('User is already a member');
      }

      // Remove from viewers if they are one
      if (isViewer) {
        const viewerToRemove = room.viewers?.find(viewer => viewer.userId === userId);
        if (viewerToRemove) {
          await updateDoc(roomRef, {
            viewers: arrayRemove(viewerToRemove),
            viewerCount: increment(-1)
          });
        }
      }

      // Add as member
      const newMember: RoomMember = {
        userId: userId,
        username: userData.username || 'Anonymous',
        avatar: userData.avatar || '',
        role: 'member' as const,
        joinedAt: serverTimestamp()
      };

      // Update room with new member
      await updateDoc(roomRef, {
        members: arrayUnion(newMember),
        memberCount: increment(1),
        activeUsers: increment(1),
        lastActive: serverTimestamp()
      });

      // Create notification for new member
      const notificationRef = doc(collection(db, 'users', userId, 'notifications'));
      await setDoc(notificationRef, {
        type: 'room_invite',
        roomId,
        roomName: room.name,
        invitedBy: currentUser.uid,
        inviterName: currentUser.displayName || 'Anonymous',
        timestamp: serverTimestamp(),
        status: 'unread',
        message: `You have been added as a member to "${room.name}"`
      });

      toast.success('Member added successfully');
    } catch (err) {
      console.error('Error adding member:', err);
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error('Failed to add member');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePasswordSubmit = useCallback(() => {
    if (!room) {
      toast.error('Room not found');
      return;
    }
    
    if (!password.trim()) {
      toast.error('Please enter a password');
      return;
    }

    if (password === room.password) {
      handleJoinRoom();
    } else {
      toast.error('Incorrect password');
    }
  }, [room, password, handleJoinRoom]);

  const handleLeaveRoom = async () => {
    if (!db || !currentUser || !roomId || !room) return;

    try {
      setIsProcessing(true);
      const roomRef = doc(db, 'sideRooms', roomId);
      
      // Only handle presence cleanup for logged in users
      if (currentUser) {
        // Clean up presence
        const userPresenceRef = doc(db, 'sideRooms', roomId, 'presence', currentUser.uid);
        await deleteDoc(userPresenceRef);

        // Create notification for the user
        const notificationRef = doc(collection(db, 'users', currentUser.uid, 'notifications'));
        await setDoc(notificationRef, {
          type: 'room_leave',
          roomId,
          roomName: room.name,
          timestamp: serverTimestamp(),
          status: 'unread',
          message: `You have left "${room.name}"`
        });
      }

      toast.success('Left room successfully');
      navigate('/side-rooms');
    } catch (error) {
      console.error('Error leaving room:', error);
      toast.error('Failed to leave room');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGoLive = async () => {
    if (!room || !currentUser || !roomId) return;

    try {
      setIsProcessing(true);
      const roomRef = doc(db, 'sideRooms', roomId);
      await updateDoc(roomRef, {
        isLive: !room.isLive,
        lastActivity: serverTimestamp()
      });

      setIsLive(!room.isLive);
      toast.success(room.isLive ? 'Stopped live session' : 'Started live session');
    } catch (err) {
      handleError(err, 'Failed to update live status');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEditRoom = () => {
    handleMenuClose();
    setShowEditDialog(true);
  };

  const handleEditSubmit = async (roomData: Partial<SideRoom>) => {
    if (!room || !roomId || !currentUser || currentUser.uid !== room.ownerId) {
      toast.error('You do not have permission to edit this room');
      return;
    }

    try {
      setIsProcessing(true);
      const roomRef = doc(db, 'sideRooms', roomId);
      const userRoomRef = doc(db, 'users', currentUser.uid, 'sideRooms', roomId);

      // Create a type for the update data
      type UpdateData = Partial<Omit<SideRoom, 'lastActive' | 'updatedAt'>> & {
        lastActive: FieldValue;
        updatedAt: FieldValue;
      };

      // Prepare update data
      const updateData: UpdateData = {
        ...roomData,
        updatedAt: serverTimestamp(),
        lastActive: serverTimestamp()
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof UpdateData] === undefined) {
          delete updateData[key as keyof UpdateData];
        }
      });

      // Update both the room and the user's sideRoom entry
      await runTransaction(db, async (transaction) => {
        // Update the main room
        transaction.update(roomRef, updateData);

        // Update the user's sideRoom entry
        transaction.update(userRoomRef, {
          name: roomData.name || room.name,
          description: roomData.description || room.description,
          category: roomData.category || room.category,
          updatedAt: serverTimestamp(),
          lastActive: serverTimestamp(),
          thumbnailUrl: room.style?.thumbnailUrl || null
        });
      });
      
      toast.success('Room updated successfully');
      setShowEditDialog(false);
    } catch (err) {
      console.error('Error updating room:', err);
      toast.error('Failed to update room');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStyleRoom = () => {
    handleMenuClose();
    setShowStyleDialog(true);
  };

  const handleStyleSubmit = async () => {
    if (!room || !roomId) return;
    try {
      setIsProcessing(true);
      const roomRef = doc(db, 'sideRooms', roomId);
      await updateDoc(roomRef, {
        style: roomStyle,
        updatedAt: new Date()
      });
      toast.success('Room style updated successfully');
      setShowStyleDialog(false);
    } catch (err) {
      console.error('Error updating room style:', err);
      handleError(err, 'Failed to update room style');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteRoom = async () => {
    handleMenuClose();
    if (!room || !currentUser || !roomId || currentUser.uid !== room.ownerId) {
      toast.error('You do not have permission to delete this room');
      return;
    }

    // Show confirmation dialog
    if (!window.confirm('Are you sure you want to delete this room? This action cannot be undone.')) {
      return;
    }

    try {
      setIsDeleting(true);
      const roomRef = doc(db, 'sideRooms', roomId);
      const presenceRef = collection(db, 'sideRooms', roomId, 'presence');
      const messagesRef = collection(db, 'sideRooms', roomId, 'messages');
      
      // Start a batch write
      const batch = writeBatch(db);

      // Add room to user's trash
      const trashRef = doc(db, 'users', currentUser.uid, 'trash', roomId);
      const roomSnapshot = await getDoc(roomRef);
      
      if (roomSnapshot.exists()) {
        batch.set(trashRef, {
          ...roomSnapshot.data(),
          deletedAt: serverTimestamp(),
          originalPath: `sideRooms/${roomId}`
        });
      }

      // Delete the room
      batch.delete(roomRef);

      // Get all presence documents
      const presenceSnapshot = await getDocs(presenceRef);
      presenceSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Get all messages
      const messagesSnapshot = await getDocs(messagesRef);
      messagesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Commit the batch
      await batch.commit();

      toast.success('Room deleted successfully');
      navigate('/side-rooms');
    } catch (err) {
      console.error('Error deleting room:', err);
      toast.error('Failed to delete room');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleInviteMembers = () => {
    setShowInviteDialog(true);
  };

  const handleSearchUsers = async (searchTerm: string) => {
    if (!searchTerm.trim() || !db) return;

    try {
      // Search users by username
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('username', '>=', searchTerm.toLowerCase()),
        where('username', '<=', searchTerm.toLowerCase() + '\uf8ff'),
        limit(10)
      );

      const snapshot = await getDocs(q);
      const users = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          username: doc.data().username || 'Anonymous',
          avatar: doc.data().avatar || ''
        }))
        .filter(user => user.id !== auth.currentUser?.uid); // Exclude current user

      setSearchResults(users);
    } catch (err) {
      console.error('Error searching users:', err);
      toast.error('Failed to search users');
    }
  };

  const handleInviteSubmit = async () => {
    if (!room || !roomId || !currentUser || selectedUsers.length === 0) return;

    try {
      setIsInviting(true);
      const batch = writeBatch(db);

      // Create invitations and notifications for each selected user
      for (const selectedUser of selectedUsers) {
        // Create invitation
        const invitationRef = doc(collection(db, 'sideRooms', roomId, 'invitations'));
        batch.set(invitationRef, {
          userId: selectedUser.id,
          invitedBy: currentUser.uid,
          inviterName: currentUser.displayName || 'Anonymous',
          inviterAvatar: currentUser.photoURL || '',
          roomId,
          roomName: room.name,
          timestamp: serverTimestamp(),
          status: 'pending'
        });

        // Create notification
        const notificationRef = doc(collection(db, 'users', selectedUser.id, 'notifications'));
        batch.set(notificationRef, {
          type: 'room_invitation',
          roomId,
          roomName: room.name,
          invitedBy: currentUser.uid,
          inviterName: currentUser.displayName || 'Anonymous',
          inviterAvatar: currentUser.photoURL || '',
          timestamp: serverTimestamp(),
          status: 'unread',
          message: `${currentUser.displayName || 'Someone'} invited you to join "${room.name}"`
        });
      }

      await batch.commit();
      toast.success('Invitations sent successfully');
      setShowInviteDialog(false);
      setSelectedUsers([]);
      setSearchResults([]);
    } catch (err) {
      console.error('Error sending invitations:', err);
      toast.error('Failed to send invitations');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (memberToRemove: RoomMember) => {
    if (!room || !currentUser || !roomId || currentUser.uid !== room.ownerId) {
      toast.error('Only room owners can remove members');
      return;
    }

    try {
      setIsProcessing(true);
      const roomRef = doc(db, 'sideRooms', roomId);

      await updateDoc(roomRef, {
        members: arrayRemove(memberToRemove),
        memberCount: increment(-1)
      });

      // Create notification for removed member
      const notificationRef = doc(collection(db, 'users', memberToRemove.userId, 'notifications'));
      await setDoc(notificationRef, {
        type: 'room_removal',
        roomId,
        roomName: room.name,
        removedBy: currentUser.uid,
        removerName: currentUser.displayName || 'Anonymous',
        timestamp: serverTimestamp(),
        status: 'unread',
        message: `You have been removed from "${room.name}"`
      });

      toast.success('Member removed successfully');
    } catch (err) {
      console.error('Error removing member:', err);
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error('Failed to remove member');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartMobileStream = async () => {
    if (!db || !currentUser || !roomId) return;

    try {
      setIsProcessing(true);

      // Create a new Mux live stream
      const data = await createLiveStream(roomId, currentUser.uid);
      console.log('Stream created successfully:', data);

      if (!data.stream_key || !data.playback_ids?.[0]?.id) {
        throw new Error('Invalid stream data received from server');
      }

      // Get room reference
      const roomRef = doc(db, 'sideRooms', roomId);

      // Update room with streaming status
      await updateDoc(roomRef, {
        isMobileStreaming: true,
        mobileStreamKey: data.stream_key,
        mobilePlaybackId: data.playback_ids[0].id,
        mobileStreamerId: currentUser.uid,
        lastActive: serverTimestamp()
      });

      // Set local state
      setMobileStreamUrl(`https://stream.mux.com/${data.playback_ids[0].id}`);
      setStreamKey(data.stream_key);
      setIsMobileStreaming(true);
      setShowMobileStreamDialog(true);

      toast.success('Mobile streaming setup complete');
    } catch (error) {
      console.error('Error starting mobile stream:', error);
      toast.error('Failed to start mobile stream. Please check your connection and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStopMobileStream = async () => {
    if (!db || !currentUser || !roomId) return;

    try {
      setIsProcessing(true);

      // Get room reference
      const roomRef = doc(db, 'sideRooms', roomId);

      // Get the current stream ID from the room
      const roomDoc = await getDoc(roomRef);
      const roomData = roomDoc.data() as SideRoom;
      const streamId = roomData?.mobilePlaybackId;

      if (!streamId) {
        throw new Error('No active stream found');
      }

      // Delete the Mux live stream
      await deleteLiveStream(streamId);

      // Update room status
      await updateDoc(roomRef, {
        isMobileStreaming: false,
        mobileStreamKey: null,
        mobilePlaybackId: null,
        mobileStreamerId: null,
        lastActive: serverTimestamp()
      });

      setIsMobileStreaming(false);
      setMobileStreamUrl('');
      setStreamKey('');
      setShowMobileStreamDialog(false);
      toast.success('Mobile streaming stopped');
    } catch (error) {
      console.error('Error stopping mobile stream:', error);
      toast.error('Failed to stop mobile stream');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'thumbnail' | 'banner') => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.');
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size too large. Maximum size is 5MB.');
      }

      // Create a FormData object
      const formData = new FormData();
      formData.append('image', file);
      formData.append('roomId', roomId || '');
      formData.append('type', type);

      // Upload to your server/storage
      const response = await fetch('http://localhost:3001/api/upload-image', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload image');
      }

      const { url } = await response.json();
      
      // Update the room style with the new image URL
      const updatedStyle = {
        ...roomStyle,
        [type === 'thumbnail' ? 'thumbnailUrl' : 'bannerUrl']: url
      };

      // Update local state
      setRoomStyle(updatedStyle);

      // Update Firestore
      const roomRef = doc(db, 'sideRooms', roomId || '');
      await updateDoc(roomRef, {
        style: updatedStyle,
        updatedAt: serverTimestamp()
      });

      toast.success(`${type} uploaded successfully`);
    } catch (error: unknown) {
      console.error('Error uploading image:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast.error(`Failed to upload ${type}: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartRecording = async () => {
    if (!room || !currentUser || !roomId || !room.isLive) {
      toast.error('Room must be live to start recording');
      return;
    }

    // Check for active stream and get the correct stream ID
    const activeStreamId = room.mobilePlaybackId || room.currentStreamId;
    if (!activeStreamId) {
      toast.error('No active stream found. Please start streaming first.');
      return;
    }

    try {
      setIsProcessing(true);
      
      // Start recording through Mux API
      const response = await fetch('http://localhost:3001/api/mux/start-recording', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId,
          userId: currentUser.uid,
          streamId: activeStreamId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start recording');
      }

      const { recordingId } = await response.json();

      // Update room with recording status
      const roomRef = doc(db, 'sideRooms', roomId);
      await updateDoc(roomRef, {
        isRecording: true,
        currentRecordingId: recordingId,
        lastActive: serverTimestamp()
      });

      setIsRecording(true);
      toast.success('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start recording');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStopRecording = async () => {
    if (!room || !currentUser || !roomId) return;

    try {
      setIsProcessing(true);

      // Stop recording through Mux API
      const response = await fetch('http://localhost:3001/api/mux/stop-recording', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId,
          userId: currentUser.uid,
          recordingId: room.currentRecordingId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to stop recording');
      }

      // Update room status
      const roomRef = doc(db, 'sideRooms', roomId);
      await updateDoc(roomRef, {
        isRecording: false,
        currentRecordingId: null,
        lastActive: serverTimestamp()
      });

      setIsRecording(false);
      toast.success('Recording stopped');
    } catch (error) {
      console.error('Error stopping recording:', error);
      toast.error('Failed to stop recording');
    } finally {
      setIsProcessing(false);
    }
  };

  // Move owner and follow state to main component scope
  const owner = room?.members?.find(member => member.role === 'owner');
  const isViewerOnly = isViewer && !isRoomOwner;
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Check if the current user is following the owner
  useEffect(() => {
    const checkFollowing = async () => {
      if (!currentUser?.uid || !owner?.userId || currentUser.uid === owner.userId) return;
      const followerRef = doc(db, 'users', owner.userId, 'followers', currentUser.uid);
      const followerSnap = await getDoc(followerRef);
      setIsFollowing(followerSnap.exists());
    };
    checkFollowing();
  }, [currentUser?.uid, owner?.userId]);

  // Handle follow
  const handleFollow = async () => {
    if (!currentUser?.uid || !owner?.userId) return;
    setFollowLoading(true);
    try {
      const followerRef = doc(db, 'users', owner.userId, 'followers', currentUser.uid);
      await setDoc(followerRef, {
        userId: currentUser.uid,
        username: currentUser.displayName || currentUser.email?.split('@')[0] || '',
        avatar: currentUser.photoURL || '',
        followedAt: serverTimestamp()
      });
      setIsFollowing(true);
      toast.success('You are now following the room owner!');
    } catch (err) {
      toast.error('Failed to follow the owner');
    } finally {
      setFollowLoading(false);
    }
  };

  // Add the handler for the share icon
  const handleShareRoom = () => {
    setShowShareDialog(true);
  };

  // Add the handler for sharing to feed
  const handleShareToFeed = async () => {
    if (!currentUser || !room) return;
    try {
      // Create a new post in the 'posts' collection
      const ownerMember = room.members?.find((m: any) => m.role === 'owner');
      const postData = {
        authorId: currentUser.uid,
        authorUsername: currentUser.displayName || currentUser.email?.split('@')[0] || '',
        authorAvatar: currentUser.photoURL || '',
        createdAt: serverTimestamp(),
        content: `Check out this live room: ${room.name}`,
        roomId: roomId,
        roomName: room.name,
        roomDescription: room.description,
        roomOwner: ownerMember?.username || '',
        roomThumbnail: room.style?.thumbnailUrl || '',
        type: 'room_share',
      };
      await addDoc(collection(db, 'posts'), postData);
      setShowShareDialog(false);
      toast.success('Room shared to your feed!');
    } catch (err) {
      toast.error('Failed to share to feed');
    }
  };

  const renderRoomHeader = () => (
    <Box sx={{ position: 'relative', p: { xs: 1.5, sm: 2 }, borderBottom: 1, borderColor: 'divider', background: room?.style?.headerGradient ? room?.style?.headerColor : room?.style?.headerColor, minHeight: { xs: '56px', sm: 'auto' }, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1, sm: 2 } }}>
      <Box sx={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, width: '100%', gap: { xs: 1, sm: 2 }, color: room?.style?.textColor }}>
        {/* Room info */}
        <Box sx={{ width: { xs: '100%', sm: 'auto' } }}>
          <Typography variant="h4" component="h1" sx={{ fontFamily: room?.style?.font, textShadow: '2px 2px 4px rgba(0,0,0,0.3)', fontSize: { xs: '1.5rem', sm: `${room?.style?.headerFontSize || 24}px` } }}>{room?.name}</Typography>
          <Typography variant="subtitle1" sx={{ fontFamily: room?.style?.font, textShadow: '1px 1px 2px rgba(0,0,0,0.3)', fontSize: { xs: '0.875rem', sm: '1rem' } }}>
            Created by {owner?.username || 'Anonymous'}
          </Typography>
        </Box>
        {/* Controls */}
        <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1 }, flexWrap: 'wrap', justifyContent: { xs: 'flex-start', sm: 'flex-end' }, width: { xs: '100%', sm: 'auto' } }}>
          {/* Leave and Follow buttons for viewers only */}
          {isViewerOnly && (
            <>
              <Button variant="outlined" color="error" onClick={handleLeaveRoom} disabled={isProcessing} sx={{ mr: 1 }}>Leave Room</Button>
              <Button variant="contained" color="primary" onClick={handleFollow} disabled={isFollowing || followLoading || !owner?.userId || owner.userId === currentUser?.uid}>
                {isFollowing ? 'Following' : followLoading ? 'Following...' : 'Follow Owner'}
              </Button>
            </>
          )}
          {/* Share icon for everyone */}
          <Tooltip title="Share Room">
            <IconButton onClick={handleShareRoom} color="primary">
              <ShareIcon />
            </IconButton>
          </Tooltip>
          {/* Chat and viewers panel icons for everyone */}
          <Tooltip title="Toggle Chat">
            <IconButton 
              onClick={() => {
                setShowChat(!showChat);
                setShowMembers(false);
              }}
              color={showChat ? "primary" : "default"}
            >
              <Chat />
            </IconButton>
          </Tooltip>
          <Tooltip title="View Members">
            <IconButton
              onClick={() => {
                setShowMembers(!showMembers);
                setShowChat(false);
              }}
              color={showMembers ? "primary" : "default"}
            >
              <Group />
            </IconButton>
          </Tooltip>
          {/* Room owner controls */}
          {isRoomOwner && (
            <>
              <Tooltip title="Room Settings">
                <IconButton
                  onClick={handleMenuClick}
                  color="primary"
                >
                  <MoreVert />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
              >
                <MenuItem onClick={handleEditRoom}>
                  <ListItemIcon>
                    <Edit fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Edit Room</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleStyleRoom}>
                  <ListItemIcon>
                    <Palette fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Customize Room</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleDeleteRoom}>
                  <ListItemIcon>
                    <Delete fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Delete Room</ListItemText>
                </MenuItem>
              </Menu>
            </>
          )}
          {/* (Optional) Other controls, e.g. mobile stream, for owners/viewers as needed */}
          {isRoomOwner && room?.isLive && (
            <Tooltip title={isRecording ? "Stop Recording" : "Start Recording"}>
              <IconButton
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                color={isRecording ? "error" : "primary"}
                disabled={isProcessing}
              >
                {isRecording ? <Stop /> : <FiberManualRecord />}
              </IconButton>
            </Tooltip>
          )}
          {isViewer && room?.isLive && (
            <Tooltip title="Start Mobile Stream">
              <IconButton 
                onClick={handleStartMobileStream}
                color="primary"
                disabled={isProcessing}
              >
                <Videocam />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
    </Box>
  );

  if (authLoading || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!room) {
    return null;
  }

  const isOwner = room.members?.some(member => member.userId === currentUser?.uid && member.role === 'owner');

  // Update the live section in the render
  const renderVideoElements = () => {
    if (!room) return null;

    return (
      <Box sx={{ mb: 3 }}>
        <MuxStream 
          isOwner={room.ownerId === currentUser?.uid}
          roomId={roomId || ''}
        />
      </Box>
    );
  };

  // Update the member list display
  const renderMemberList = () => (
    <List>
      {room?.members?.map((member) => (
        <ListItem 
          key={member.userId}
          sx={{
            borderRadius: 1,
            mb: 1,
            '&:hover': {
              bgcolor: 'action.hover'
            }
          }}
        >
          <ListItemAvatar>
            <Avatar 
              src={member.avatar} 
              alt={member.username}
              sx={{ 
                width: 40, 
                height: 40,
                border: theme => member.role === 'owner' ? `2px solid ${theme.palette.primary.main}` : 'none'
              }}
            >
              {!member.avatar && member.username?.charAt(0)}
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2">
                  {member.username || 'Anonymous'}
                </Typography>
                {member.role === 'owner' && (
                  <Chip 
                    label="Owner" 
                    size="small" 
                    color="primary" 
                    sx={{ height: 20 }}
                  />
                )}
              </Box>
            }
            secondary={
              <Typography variant="caption" color="text.secondary">
                Joined {member.joinedAt instanceof Timestamp 
                  ? member.joinedAt.toDate().toLocaleDateString()
                  : (member.joinedAt as Date).toLocaleDateString()}
              </Typography>
            }
          />
          {/* Only show remove button to room owner and don't allow removing the owner */}
          {isRoomOwner && member.role !== 'owner' && (
            <IconButton
              edge="end"
              aria-label="remove member"
              onClick={() => {
                if (window.confirm(`Are you sure you want to remove ${member.username || 'this member'}?`)) {
                  handleRemoveMember(member);
                }
              }}
              color="error"
              disabled={isProcessing}
            >
              <Delete />
            </IconButton>
          )}
        </ListItem>
      ))}
    </List>
  );

  // Update the renderChat function to remove its header since we now have a mobile header
  const renderChat = () => (
    <Box sx={{ 
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      bgcolor: 'background.paper',
      borderRadius: 1
    }}>
      {/* Messages Container */}
      <Box sx={{ 
        flex: 1,
        overflow: 'auto',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        '&::-webkit-scrollbar': {
          width: '8px',
        },
        '&::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '&::-webkit-scrollbar-thumb': {
          background: 'rgba(0, 0, 0, 0.1)',
          borderRadius: '4px',
          '&:hover': {
            background: 'rgba(0, 0, 0, 0.2)',
          },
        },
      }}>
        {messages.map((message) => (
          <Box 
            key={message.id} 
            sx={{ 
              display: 'flex',
              gap: 1.5,
              alignItems: 'flex-start',
              maxWidth: '85%',
              alignSelf: message.userId === currentUser?.uid ? 'flex-end' : 'flex-start',
              animation: 'fadeIn 0.3s ease-in-out',
              '@keyframes fadeIn': {
                '0%': { opacity: 0, transform: 'translateY(10px)' },
                '100%': { opacity: 1, transform: 'translateY(0)' }
              }
            }}
          >
            {message.userId !== currentUser?.uid && (
              <RouterLink 
                to={`/profile/${message.userId}`}
                style={{ textDecoration: 'none' }}
              >
                <Avatar 
                  src={message.photoURL || message.avatar} 
                  alt={message.displayName || message.username}
                  sx={{ 
                    width: 36, 
                    height: 36,
                    border: '2px solid',
                    borderColor: 'primary.main',
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    '&:hover': {
                      transform: 'scale(1.1)'
                    }
                  }}
                >
                  {(!message.photoURL && !message.avatar) && (message.displayName || message.username || 'A').charAt(0).toUpperCase()}
                </Avatar>
              </RouterLink>
            )}
            <Box sx={{ 
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5
            }}>
              {message.userId !== currentUser?.uid && (
                <RouterLink 
                  to={`/profile/${message.userId}`}
                  style={{ textDecoration: 'none' }}
                >
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      fontWeight: 600,
                      color: 'primary.main',
                      ml: 1,
                      cursor: 'pointer',
                      '&:hover': {
                        textDecoration: 'underline'
                      }
                    }}
                  >
                    {message.displayName || message.username || 'Anonymous'}
                  </Typography>
                </RouterLink>
              )}
              <Box sx={{
                bgcolor: message.userId === currentUser?.uid ? 'primary.main' : 'background.default',
                color: message.userId === currentUser?.uid ? 'primary.contrastText' : 'text.primary',
                p: 1.5,
                borderRadius: 2,
                boxShadow: 1,
                position: 'relative',
                '&::before': message.userId === currentUser?.uid ? {
                  content: '""',
                  position: 'absolute',
                  right: -8,
                  top: '50%',
                  width: 0,
                  height: 0,
                  border: '8px solid transparent',
                  borderLeftColor: 'primary.main',
                  transform: 'translateY(-50%)'
                } : {
                  content: '""',
                  position: 'absolute',
                  left: -8,
                  top: '50%',
                  width: 0,
                  height: 0,
                  border: '8px solid transparent',
                  borderRightColor: 'background.default',
                  transform: 'translateY(-50%)'
                }
              }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {message.content}
                </Typography>
              </Box>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'text.secondary',
                  ml: 1,
                  fontSize: '0.7rem'
                }}
              >
                {message.timestamp instanceof Date 
                  ? message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : message.timestamp?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || ''}
              </Typography>
            </Box>
            {message.userId === currentUser?.uid && (
              <RouterLink 
                to={`/profile/${message.userId}`}
                style={{ textDecoration: 'none' }}
              >
                <Avatar 
                  src={message.photoURL || message.avatar} 
                  alt={message.displayName || message.username}
                  sx={{ 
                    width: 36, 
                    height: 36,
                    border: '2px solid',
                    borderColor: 'primary.main',
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    '&:hover': {
                      transform: 'scale(1.1)'
                    }
                  }}
                >
                  {(!message.photoURL && !message.avatar) && (message.displayName || message.username || 'A').charAt(0).toUpperCase()}
                </Avatar>
              </RouterLink>
            )}
          </Box>
        ))}
        <div ref={messagesEndRef} />
      </Box>

      {/* Message Input */}
      <Box 
        component="form" 
        onSubmit={handleSendMessage}
        sx={{ 
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          gap: 1,
          alignItems: 'center'
        }}>
          <TextField
            fullWidth
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            size="small"
            sx={{ 
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                bgcolor: 'background.default',
                '&:hover': {
                  bgcolor: 'action.hover'
                },
                '&.Mui-focused': {
                  bgcolor: 'background.paper'
                }
              }
            }}
          />
          <IconButton 
            type="submit" 
            color="primary" 
            disabled={!newMessage.trim()}
            sx={{ 
              bgcolor: 'primary.main',
              color: 'white',
              '&:hover': {
                bgcolor: 'primary.dark'
              },
              '&.Mui-disabled': {
                bgcolor: 'action.disabledBackground',
                color: 'action.disabled'
              }
            }}
          >
            <Send />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );

  // Update the invite dialog
  const renderInviteDialog = () => (
    <Dialog 
      open={showInviteDialog} 
      onClose={() => setShowInviteDialog(false)}
      maxWidth="sm" 
      fullWidth
    >
      <DialogTitle>Invite Members</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            fullWidth
            label="Search users"
            variant="outlined"
            onChange={(e) => {
              const value = e.target.value;
              setSearchQuery(value);
              if (value.trim()) {
                handleSearchUsers(value);
              } else {
                setSearchResults([]);
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              )
            }}
          />

          {/* Selected Users */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {selectedUsers.map((user) => (
              <Chip
                key={user.id}
                avatar={<Avatar src={user.avatar}>{user.username?.[0]}</Avatar>}
                label={user.username}
                onDelete={() => setSelectedUsers(prev => prev.filter(u => u.id !== user.id))}
              />
            ))}
          </Box>

          {/* Search Results */}
          <List>
            {searchResults.map((user) => (
              <ListItem
                key={user.id}
                sx={{
                  borderRadius: 1,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' }
                }}
                onClick={() => {
                  if (!selectedUsers.some(u => u.id === user.id)) {
                    setSelectedUsers(prev => [...prev, user]);
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar src={user.avatar}>{user.username?.[0]}</Avatar>
                </ListItemAvatar>
                <ListItemText primary={user.username} />
              </ListItem>
            ))}
          </List>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowInviteDialog(false)}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleInviteSubmit}
          disabled={isInviting || selectedUsers.length === 0}
        >
          {isInviting ? 'Sending...' : 'Send Invitations'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  // Add Recordings Dialog
  const renderRecordingsDialog = () => (
    <Dialog
      open={showRecordingsDialog}
      onClose={() => setShowRecordingsDialog(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Recorded Streams</DialogTitle>
      <DialogContent>
        <List>
          {recordedStreams.map((stream) => (
            <ListItem
              key={stream.id}
              secondaryAction={
                <IconButton edge="end" onClick={() => window.open(`https://stream.mux.com/${stream.playbackId}`)}>
                  <Videocam />
                </IconButton>
              }
            >
              <ListItemText
                primary={stream.title || `Recording from ${stream.startedAt.toLocaleDateString()}`}
                secondary={`Duration: ${stream.duration ? Math.floor(stream.duration / 60) : '?'} minutes`}
              />
            </ListItem>
          ))}
          {recordedStreams.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
              No recordings available
            </Typography>
          )}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowRecordingsDialog(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );

  // Update the mobile streaming dialog to show different content based on device type
  const renderMobileStreamDialog = () => {
    const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    return (
      <Dialog
        open={showMobileStreamDialog}
        onClose={() => setShowMobileStreamDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Mobile Streaming Setup</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
                <Typography variant="body1" gutterBottom>
              To stream from your mobile device, use the free <b>Larix Broadcaster</b> app:
                </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              1. Download Larix Broadcaster: <br />
              <a href="https://apps.apple.com/us/app/larix-broadcaster/id1042474385" target="_blank" rel="noopener noreferrer">iOS (App Store)</a> | <a href="https://play.google.com/store/apps/details?id=com.wmspanel.larix_broadcaster" target="_blank" rel="noopener noreferrer">Android (Google Play)</a>
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
              2. Open Larix Broadcaster and tap the gear/settings icon.<br />
              3. Go to <b>Connections</b> and tap the <b>+</b> to add a new connection.<br />
              4. <b>URL:</b> <span style={{ fontFamily: 'monospace' }}>rtmps://global-live.mux.com:443/app</span><br />
              5. <b>Stream Name/Key:</b> Use the stream key below.
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <TextField
                    fullWidth
                    label="Stream Key"
                    value={streamKey}
                    InputProps={{
                      readOnly: true,
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => {
                            navigator.clipboard.writeText(streamKey);
                            toast.success('Stream key copied to clipboard');
                          }}>
                            <ContentCopy />
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                    variant="outlined"
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
              6. Save the connection, return to the main screen, and tap the red record button to start streaming.<br />
              7. Allow camera and microphone access if prompted.
                </Typography>
            {mobileStreamUrl && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Stream URL (for viewers):
                </Typography>
                <TextField
                  fullWidth
                  value={mobileStreamUrl}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => {
                          navigator.clipboard.writeText(mobileStreamUrl);
                          toast.success('Stream URL copied to clipboard');
                        }}>
                          <ContentCopy />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                  variant="outlined"
                  size="small"
                />
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMobileStreamDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      height: '100vh',
      overflow: 'hidden',
      flexDirection: { xs: 'column', sm: 'row' },
      ...(room?.style ? {
        bgcolor: room.style.backgroundColor,
        background: room.style.backgroundGradient ? room.style.backgroundColor : undefined,
        color: room.style.textColor || 'text.primary',
        fontFamily: room.style.font || 'inherit',
        ...(room.style.glitterEffect && {
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'%3E%3Cg fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.2\'%3E%3Cpath d=\'M11 0h2v2h-2zM13 2h2v2h-2zM15 4h2v2h-2zM17 6h2v2h-2zM19 8h2v2h-2zM21 10h2v2h-2zM23 12h2v2h-2zM25 14h2v2h-2zM27 16h2v2h-2zM29 18h2v2h-2zM31 20h2v2h-2zM33 22h2v2h-2zM35 24h2v2h-2zM37 26h2v2h-2zM39 28h2v2h-2zM41 30h2v2h-2zM43 32h2v2h-2zM45 34h2v2h-2zM47 36h2v2h-2zM49 38h2v2h-2zM51 40h2v2h-2zM53 42h2v2h-2zM55 44h2v2h-2zM57 46h2v2h-2zM59 48h2v2h-2zM61 50h2v2h-2zM63 52h2v2h-2zM65 54h2v2h-2zM67 56h2v2h-2zM69 58h2v2h-2zM71 60h2v2h-2zM73 62h2v2h-2zM75 64h2v2h-2zM77 66h2v2h-2zM79 68h2v2h-2zM81 70h2v2h-2zM83 72h2v2h-2zM85 74h2v2h-2zM87 76h2v2h-2zM89 78h2v2h-2zM91 80h2v2h-2zM93 82h2v2h-2zM95 84h2v2h-2zM97 86h2v2h-2zM99 88h2v2h-2zM101 90h2v2h-2zM103 92h2v2h-2zM105 94h2v2h-2zM107 96h2v2h-2zM109 98h2v2h-2z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            opacity: 0.5,
            zIndex: 1,
            pointerEvents: 'none'
          }
        }),
        ...(room.style.customCss ? { ...JSON.parse(room.style.customCss) } : {})
      } : {})
    }}>
      {/* Main Room Content */}
      <Box sx={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        height: { xs: 'calc(100vh - 56px)', sm: '100%' },
        overflow: 'hidden'
      }}>
        {renderRoomHeader()}
        {/* Scrollable Content Area */}
        <Box sx={{ 
          flex: 1, 
          overflow: 'auto',
          p: { xs: 1, sm: 2 },
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}>
          {/* Video Elements */}
          {room?.isLive && renderVideoElements()}
        </Box>
      </Box>

      {/* Side Panels */}
      {(showMembers || showChat) && (
        <Box sx={{ 
          width: { xs: '100%', sm: 300 },
          height: { xs: 'calc(100vh - 56px)', sm: '100%' },
          position: { xs: 'fixed', sm: 'relative' },
          right: 0,
          top: { xs: '56px', sm: 0 },
          bgcolor: 'background.paper',
          borderLeft: { xs: 0, sm: 1 },
          borderTop: { xs: 1, sm: 0 },
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1200
        }}>
          {/* Panel Header */}
          <Box sx={{ 
            p: 2, 
            borderBottom: 1, 
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Typography variant="h6">
              {showChat ? 'Chat' : 'Room Info'}
            </Typography>
            <IconButton onClick={() => {
              setShowChat(false);
              setShowMembers(false);
            }}>
              <Close />
            </IconButton>
          </Box>

          {/* Panel Content */}
          <Box sx={{ 
            flex: 1, 
            overflow: 'auto',
            p: 2
          }}>
            {showChat ? (
              <Box>
                {renderChat()}
              </Box>
            ) : (
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>Viewers</Typography>
                <List>
                  {room?.viewers?.map((viewer) => (
                    <ListItem key={viewer.userId}>
                      <ListItemAvatar>
                        <Avatar src={viewer.avatar}>{viewer.username[0]}</Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={viewer.username}
                        secondary={`Joined ${viewer.joinedAt instanceof Timestamp 
                          ? viewer.joinedAt.toDate().toLocaleDateString()
                          : (viewer.joinedAt as Date).toLocaleDateString()}`}
                      />
                    </ListItem>
                  ))}
                  {(!room?.viewers || room.viewers.length === 0) && (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                      No viewers in the room
                    </Typography>
                  )}
                </List>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {renderInviteDialog()}
      {renderMobileStreamDialog()}
      {showEditDialog && (
        <RoomForm
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          onSubmit={handleEditSubmit}
          initialData={room}
          title="Edit Room"
          submitButtonText="Save Changes"
          isProcessing={isProcessing}
        />
      )}
      {showStyleDialog && (
        <Dialog open={showStyleDialog} onClose={() => setShowStyleDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Customize Room</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              {/* Color Presets */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                {COLOR_PRESETS.map((preset) => (
                  <Button
                    key={preset.name}
                    variant="outlined"
                    size="small"
                    style={{ background: preset.value, color: '#000', minWidth: 36, minHeight: 36, border: roomStyle.headerColor === preset.value ? '2px solid #1976d2' : undefined }}
                    onClick={() => setRoomStyle(s => ({ ...s, headerColor: preset.value, backgroundColor: preset.value }))}
                  >
                    {preset.name}
                  </Button>
                ))}
              </Box>
              <TextField
                label="Header Color"
                type="color"
                value={roomStyle.headerColor}
                onChange={e => setRoomStyle(s => ({ ...s, headerColor: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Background Color"
                type="color"
                value={roomStyle.backgroundColor}
                onChange={e => setRoomStyle(s => ({ ...s, backgroundColor: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Text Color"
                type="color"
                value={roomStyle.textColor}
                onChange={e => setRoomStyle(s => ({ ...s, textColor: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Accent Color"
                type="color"
                value={roomStyle.accentColor}
                onChange={e => setRoomStyle(s => ({ ...s, accentColor: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel>Font</InputLabel>
                <Select
                  value={roomStyle.font}
                  label="Font"
                  onChange={e => setRoomStyle(s => ({ ...s, font: e.target.value }))}
                >
                  {FONT_OPTIONS.map(opt => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Switch
                    checked={roomStyle.headerGradient}
                    onChange={e => setRoomStyle(s => ({ ...s, headerGradient: e.target.checked }))}
                  />
                }
                label="Header Gradient"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={roomStyle.backgroundGradient}
                    onChange={e => setRoomStyle(s => ({ ...s, backgroundGradient: e.target.checked }))}
                  />
                }
                label="Background Gradient"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={roomStyle.glitterEffect}
                    onChange={e => setRoomStyle(s => ({ ...s, glitterEffect: e.target.checked }))}
                  />
                }
                label="Glitter Effect"
              />
              <TextField
                label="Header Font Size"
                type="number"
                value={roomStyle.headerFontSize}
                onChange={e => setRoomStyle(s => ({ ...s, headerFontSize: Number(e.target.value) }))}
                InputProps={{ inputProps: { min: 12, max: 64 } }}
                fullWidth
              />
              {/* Sticker Selection */}
              <Box>
                <Typography variant="subtitle2">Stickers</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                  {STICKER_OPTIONS.map(sticker => (
                    <Button
                      key={sticker.value}
                      variant={roomStyle.stickers?.includes(sticker.value) ? 'contained' : 'outlined'}
                      onClick={() => setRoomStyle(s => ({ ...s, stickers: s.stickers?.includes(sticker.value) ? s.stickers.filter(sv => sv !== sticker.value) : [...(s.stickers || []), sticker.value] }))}
                      size="small"
                    >
                      {sticker.value}
                    </Button>
                  ))}
                </Box>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowStyleDialog(false)}>Cancel</Button>
            <Button onClick={handleStyleSubmit} variant="contained" disabled={isProcessing}>
              Save Style
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {showShareDialog && (
        <Dialog open={showShareDialog} onClose={() => setShowShareDialog(false)}>
          <DialogTitle>Share Room</DialogTitle>
          <DialogContent>
            <Typography gutterBottom>Share this live room to your feed or copy the link to share with others.</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleShareToFeed} variant="contained">Share to Feed</Button>
            <Button onClick={() => { navigator.clipboard.writeText(window.location.origin + '/side-room/' + roomId); toast.success('Room link copied!'); }}>Copy Link</Button>
            <Button onClick={() => setShowShareDialog(false)}>Cancel</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

export default SideRoomComponent; 