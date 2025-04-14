import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  setDoc
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
  Link,
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
  ContentCopy
} from '@mui/icons-material';
import type { SideRoom, RoomMember } from '../../types/index';
import MuxStream from '../Stream/MuxStream';
import RoomForm from './RoomForm';

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
  }
}

const SideRoomComponent: React.FC = () => {
  const { roomId } = useParams();
  const { user, loading: authLoading } = useAuth();
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
  const messagesUnsubscribe = useRef<(() => void) | null>(null);
  const presenceUnsubscribe = useRef<(() => void) | null>(null);
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

  const mountedRef = useRef(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isRoomOwner = useMemo(() => {
    return room?.ownerId === user?.uid;
  }, [room?.ownerId, user?.uid]);

  // Add a function to check if user is a member
  const isMember = user && room?.members?.some(member => member.userId === user.uid);

  // Combine owner and member check
  const isRoomOwnerOrMember = isRoomOwner || isMember;

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
    if (!user || !roomId) return;

    const messagesRef = collection(db, 'sideRooms', roomId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    messagesUnsubscribe.current = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          username: data.username,
          avatar: data.avatar,
          content: data.content,
          timestamp: data.timestamp,
          profilePicture: data.profilePicture || data.avatar || '',
          displayName: data.displayName || data.username || ''
        };
      });
      setMessages(newMessages);
      // Scroll to bottom when new messages arrive
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

      // Get room reference for updating active users
      const roomRef = doc(db, 'sideRooms', roomId);
      
      // Update room's active users count based on actual online users
      const onlineUsers = presence.filter(user => user.isOnline).length;
      updateDoc(roomRef, {
        activeUsers: onlineUsers,
        lastActive: serverTimestamp()
      });
    });
  };

  const setupPresenceListener = () => {
    if (!user || !roomId) return;

    const presenceRef = collection(db, 'sideRooms', roomId, 'presence');
    const userPresenceRef = doc(presenceRef, user.uid);
    const roomRef = doc(db, 'sideRooms', roomId);

    // Set user's presence
    setDoc(userPresenceRef, {
      userId: user.uid,
      username: user.displayName || 'Anonymous',
      avatar: user.photoURL || '',
      lastSeen: serverTimestamp(),
      isOnline: true
    }, { merge: true });

    // Update room's active users count
    updateDoc(roomRef, {
      activeUsers: increment(1),
      lastActive: serverTimestamp()
    });

    // Set up cleanup on unmount or disconnect
    const cleanup = async () => {
      try {
        // Update user's presence status
        await updateDoc(userPresenceRef, {
          isOnline: false,
          lastSeen: serverTimestamp()
        });

        // Decrement active users count
        await updateDoc(roomRef, {
          activeUsers: increment(-1),
          lastActive: serverTimestamp()
        });
      } catch (error) {
        console.error('Error in presence cleanup:', error);
      }
    };

    // Handle page unload
    window.addEventListener('beforeunload', cleanup);

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        cleanup();
      } else {
        setDoc(userPresenceRef, {
          isOnline: true,
          lastSeen: serverTimestamp()
        }, { merge: true });
        updateDoc(roomRef, {
          activeUsers: increment(1),
          lastActive: serverTimestamp()
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    presenceUnsubscribe.current = onSnapshot(presenceRef, (snapshot) => {
      const presenceData = snapshot.docs.map(doc => ({
        userId: doc.id,
        username: doc.data().username || '',
        avatar: doc.data().avatar || '',
        lastSeen: doc.data().lastSeen?.toDate() || new Date(),
        isOnline: doc.data().isOnline || false
      })) as PresenceData[];
      setPresence(presenceData);

      // Get room reference for updating active users
      const roomRef = doc(db, 'sideRooms', roomId);
      
      // Update room's active users count based on actual online users
      const onlineUsers = presenceData.filter(user => user.isOnline).length;
      updateDoc(roomRef, {
        activeUsers: onlineUsers,
        lastActive: serverTimestamp()
      });
    }, (error) => {
      console.error('Error listening to presence:', error);
      if (error.code === 'permission-denied') {
        setError('You need to be a member of this room to view presence');
      }
    });

    // Return cleanup function
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cleanup();
      if (presenceUnsubscribe.current) {
        presenceUnsubscribe.current();
      }
    };
  };

  useEffect(() => {
    if (!user || !roomId) return;

    const setupRoomListener = async () => {
      try {
        if (!roomId || !db) return;
        
        // Verify we have user information
        console.log('Current user:', user);
        console.log('Display name:', user.displayName);
        console.log('Photo URL:', user.photoURL);

        const roomRef = doc(db, 'sideRooms', roomId);
        const messagesRef = collection(db, 'sideRooms', roomId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const newMessages = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              userId: data.userId,
              username: data.username,
              avatar: data.avatar,
              content: data.content,
              timestamp: data.timestamp,
              photoURL: data.photoURL || data.avatar || '',
              displayName: data.displayName || data.username || 'Anonymous'
            };
          });
          console.log('Messages:', newMessages); // Debug messages
          setMessages(newMessages);
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

          // Get room reference for updating active users
          const roomRef = doc(db, 'sideRooms', roomId);
          
          // Update room's active users count based on actual online users
          const onlineUsers = presence.filter(user => user.isOnline).length;
          updateDoc(roomRef, {
            activeUsers: onlineUsers,
            lastActive: serverTimestamp()
          });
        });

        return () => unsubscribe();
      } catch (err) {
        console.error('Error setting up room listener:', err);
        setError('Failed to setup room listener');
      }
    };

    setupRoomListener();
  }, [user, roomId, presence]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
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

              // Check if user is a member
              const isMember = roomData.members?.some(member => member.userId === user.uid);
              const isOwner = roomData.ownerId === user.uid;

              if (isMember || isOwner) {
                // If user is a member or owner, set up listeners
                setupMessagesListener();
                setupPresenceListener();
              } else {
                // If not a member, unsubscribe from any existing listeners
                if (messagesUnsubscribe) messagesUnsubscribe();
                if (presenceUnsubscribe) presenceUnsubscribe();
                messagesUnsubscribe = undefined;
                presenceUnsubscribe = undefined;
                setError('You need to be a member of this room to view messages and presence');
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
      } catch (err) {
        console.error('Error setting up room listener:', err);
        setError('Failed to setup room listener');
        setLoading(false);
      }
    };

    const setupMessagesListener = () => {
      try {
        if (!roomId || !db) return;
        
        const messagesRef = collection(db, 'sideRooms', roomId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(50));
        
        messagesUnsubscribe = onSnapshot(q,
          (snapshot) => {
            const messages = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              timestamp: doc.data().timestamp?.toDate() || new Date()
            })) as Message[];
            setMessages(messages.reverse());
          },
          (error) => {
            console.error('Error listening to messages:', error);
            if (error instanceof FirestoreError && error.code === 'permission-denied') {
              setError('You need to be a member of this room to view messages');
            }
          }
        );
      } catch (err) {
        console.error('Error setting up messages listener:', err);
      }
    };

    const setupPresenceListener = () => {
      try {
        if (!roomId || !db) return;
        
        const presenceRef = collection(db, 'sideRooms', roomId, 'presence');
        presenceUnsubscribe = onSnapshot(presenceRef,
          (snapshot) => {
            const presenceData = snapshot.docs.map(doc => ({
              ...doc.data(),
              lastSeen: doc.data().lastSeen?.toDate() || new Date()
            })) as PresenceData[];
            setPresence(presenceData);

            // Get room reference for updating active users
            const roomRef = doc(db, 'sideRooms', roomId);
            
            // Update room's active users count based on actual online users
            const onlineUsers = presenceData.filter(user => user.isOnline).length;
            updateDoc(roomRef, {
              activeUsers: onlineUsers,
              lastActive: serverTimestamp()
            });
          },
          (error) => {
            console.error('Error listening to presence:', error);
            if (error instanceof FirestoreError && error.code === 'permission-denied') {
              setError('You need to be a member of this room to view presence');
            }
          }
        );
      } catch (err) {
        console.error('Error setting up presence listener:', err);
      }
    };

    setupRoomListener();

    return () => {
      if (roomUnsubscribe) roomUnsubscribe();
      if (messagesUnsubscribe) messagesUnsubscribe();
      if (presenceUnsubscribe) presenceUnsubscribe();
    };
  }, [user, authLoading, roomId, navigate, presence]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleJoinRoom = useCallback(async () => {
    if (!room || !user || !roomId || isProcessing) return;

    try {
      setIsProcessing(true);
      const roomRef = doc(db, 'sideRooms', roomId);
      const userRoomsRef = collection(db, 'users', user.uid, 'sideRooms');

      // Add user as a member and track active users
      await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) {
          throw new Error('Room not found');
        }

        const roomData = roomDoc.data();
        const members = roomData.members || [];
        
        // Check if user is already a member
        const isMember = members.some((member: any) => member.userId === user.uid);
        
        if (!isMember) {
          // Add user as a member
          transaction.update(roomRef, {
            members: arrayUnion({
              userId: user.uid,
              username: user.displayName || 'Anonymous',
              avatar: user.photoURL || '',
              role: 'member',
              joinedAt: serverTimestamp()
            }),
            memberCount: increment(1),
            activeUsers: increment(1),
            lastActive: serverTimestamp()
          });

          // Add room to user's sideRooms collection
          const userRoomRef = doc(userRoomsRef, roomId);
          transaction.set(userRoomRef, {
            roomId: roomId,
            name: roomData.name,
            description: roomData.description,
            role: 'member',
            joinedAt: serverTimestamp(),
            lastActive: serverTimestamp(),
            memberCount: roomData.memberCount,
            isPrivate: roomData.isPrivate,
            isOwner: false,
            thumbnailUrl: roomData.style?.thumbnailUrl || null,
            category: roomData.category || 'General'
          });
        } else {
          // Just update active users count
          transaction.update(roomRef, {
            activeUsers: increment(1),
            lastActive: serverTimestamp()
          });
        }
      });

      if (mountedRef.current) {
        toast.success('Joined room successfully');
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
  }, [room, user, roomId, isProcessing, db, setShowPasswordDialog, setIsProcessing]);

  // Add new function for room owners to add members
  const handleAddMember = async (userId: string) => {
    if (!room || !user || !roomId || user.uid !== room.ownerId) return;

    try {
      setIsProcessing(true);
      const roomRef = doc(db, 'sideRooms', roomId);
      
      // Get user's profile data
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const newMember: RoomMember = {
        userId: userId,
        username: userData.username || 'Anonymous',
        avatar: userData.avatar || '',
        role: 'member',
        joinedAt: serverTimestamp()
      };

      // Update room with new member
      await updateDoc(roomRef, {
        members: arrayUnion(newMember),
        memberCount: increment(1)
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

  const handleLeaveRoom = useCallback(async () => {
    if (!room || !user || !roomId || isProcessing) return;

    try {
      setIsProcessing(true);
      const roomRef = doc(db, 'sideRooms', roomId);
      const userRoomRef = doc(db, 'users', user.uid, 'sideRooms', roomId);

      await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) {
          throw new Error('Room not found');
        }

        const roomData = roomDoc.data() as SideRoom;
        const memberToRemove: RoomMember = {
          userId: user.uid,
          username: user.displayName || 'Anonymous',
          avatar: user.photoURL || '',
          role: 'member',
          joinedAt: new Date()
        };

        // Update both members and memberCount atomically while preserving styles
        transaction.update(roomRef, {
          members: arrayRemove(memberToRemove),
          memberCount: Math.max(0, (roomData.memberCount || 0) - 1),
          style: roomData.style || roomStyle, // Preserve existing styles
          lastActive: serverTimestamp()
        });

        // Remove room from user's sideRooms collection
        transaction.delete(userRoomRef);
      });

      if (mountedRef.current) {
        toast.success('Left room successfully');
        setTimeout(() => {
          if (mountedRef.current) {
            navigate('/side-rooms');
          }
        }, 100);
      }
    } catch (err) {
      handleError(err, 'Failed to leave room');
    } finally {
      if (mountedRef.current) {
        setIsProcessing(false);
      }
    }
  }, [room, user, roomId, isProcessing, navigate, handleError, roomStyle]);

  const handleGoLive = async () => {
    if (!room || !user || !roomId) return;

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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId || !user || !newMessage.trim()) return;

    try {
      const messagesRef = collection(db, 'sideRooms', roomId, 'messages');
      const messageData = {
        userId: user.uid,
        username: user.displayName || 'Anonymous',
        avatar: user.photoURL || '',
        content: newMessage.trim(),
        timestamp: serverTimestamp(),
        photoURL: user.photoURL || '',
        displayName: user.displayName || 'Anonymous'
      };

      await addDoc(messagesRef, messageData);
      setNewMessage('');
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      handleError(err, 'Failed to send message');
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
    if (!room || !roomId || !user || user.uid !== room.ownerId) {
      toast.error('You do not have permission to edit this room');
      return;
    }

    try {
      setIsProcessing(true);
      const roomRef = doc(db, 'sideRooms', roomId);
      const userRoomRef = doc(db, 'users', user.uid, 'sideRooms', roomId);

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
    if (!room || !user || !roomId || user.uid !== room.ownerId) {
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
      const trashRef = doc(db, 'users', user.uid, 'trash', roomId);
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
    if (!room || !roomId || !user || selectedUsers.length === 0) return;

    try {
      setIsInviting(true);
      const batch = writeBatch(db);

      // Create invitations and notifications for each selected user
      for (const selectedUser of selectedUsers) {
        // Create invitation
        const invitationRef = doc(collection(db, 'sideRooms', roomId, 'invitations'));
        batch.set(invitationRef, {
          userId: selectedUser.id,
          invitedBy: user.uid,
          inviterName: user.displayName || 'Anonymous',
          inviterAvatar: user.photoURL || '',
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
          invitedBy: user.uid,
          inviterName: user.displayName || 'Anonymous',
          inviterAvatar: user.photoURL || '',
          timestamp: serverTimestamp(),
          status: 'unread',
          message: `${user.displayName || 'Someone'} invited you to join "${room.name}"`
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
    if (!room || !user || !roomId || user.uid !== room.ownerId) {
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
        removedBy: user.uid,
        removerName: user.displayName || 'Anonymous',
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
    if (!db || !user || !roomId) return;

    try {
      setIsProcessing(true);
      
      // Create a new Mux live stream through your backend
      const response = await fetch('http://localhost:3001/api/mux/create-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId,
          userId: user.uid
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create stream');
      }

      const { streamKey, playbackId, streamId } = await response.json();

      // Update room with mobile streaming status
      const roomRef = doc(db, 'sideRooms', roomId);
      await updateDoc(roomRef, {
        isMobileStreaming: true,
        mobileStreamKey: streamKey,
        mobilePlaybackId: playbackId,
        mobileStreamerId: user.uid,
        lastActive: serverTimestamp()
      });

      // Show QR code/instructions dialog
      setMobileStreamUrl(`https://stream.mux.com/${playbackId}`);
      setStreamKey(streamKey);
      setIsMobileStreaming(true);
      setShowMobileStreamDialog(true);
      toast.success('Mobile streaming ready');
    } catch (error) {
      console.error('Error starting mobile stream:', error);
      toast.error('Failed to start mobile stream');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStopMobileStream = async () => {
    if (!db || !user || !roomId) return;

    try {
      setIsProcessing(true);

      // Delete the Mux live stream through your backend
      const response = await fetch('http://localhost:3001/api/mux/delete-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId,
          userId: user.uid
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to stop stream');
      }

      // Update room status
      const roomRef = doc(db, 'sideRooms', roomId);
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
    if (!room || !user || !roomId || !room.isLive) {
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
          userId: user.uid,
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
    if (!room || !user || !roomId) return;

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
          userId: user.uid,
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

  const renderRoomHeader = () => (
    <Box sx={{ 
      position: 'relative',
      p: 2, 
      borderBottom: 1, 
      borderColor: 'divider',
      background: roomStyle.headerGradient ? roomStyle.headerColor : roomStyle.headerColor,
      minHeight: 'auto',
      display: 'flex',
      flexDirection: 'column',
      ...(roomStyle.glitterEffect && {
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
      })
    }}>
      <Box sx={{ 
        position: 'relative',
        zIndex: 2,
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        color: roomStyle.textColor
      }}>
        <Box>
          <Typography 
            variant="h4" 
            component="h1" 
            sx={{ 
              fontFamily: roomStyle.font,
              textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
              fontSize: `${roomStyle.headerFontSize}px`
            }}
          >
            {room?.name}
          </Typography>
          <Typography 
            variant="subtitle1" 
            sx={{ 
              fontFamily: roomStyle.font,
              textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
            }}
          >
            Created by {room?.ownerId === user?.uid ? 'You' : 'Anonymous'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <Group fontSize="small" sx={{ color: roomStyle.accentColor }} />
            <Typography 
              variant="body2" 
              sx={{ 
                fontFamily: roomStyle.font,
                textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
              }}
            >
              {room?.activeUsers || 0} {room?.activeUsers === 1 ? 'person' : 'people'} viewing
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {isRoomOwner && (
            <IconButton 
              onClick={handleMenuClick}
              sx={{ color: roomStyle.accentColor }}
            >
              <MoreVert />
            </IconButton>
          )}
          {/* Add Member button - only visible to room owner */}
          {isRoomOwner && (
            <Button
              variant="outlined"
              startIcon={<PersonAdd />}
              onClick={() => setShowInviteDialog(true)}
            >
              Add Member
            </Button>
          )}
          {/* Mobile Streaming button - visible to all members */}
          {(isRoomOwner || isMember) && (
            <Button
              variant="contained"
              color={isMobileStreaming ? "error" : "primary"}
              startIcon={isMobileStreaming ? <VideocamOff /> : <Videocam />}
              onClick={isMobileStreaming ? handleStopMobileStream : handleStartMobileStream}
              disabled={isProcessing}
              sx={{ mr: 1 }}
            >
              {isMobileStreaming ? "Stop Mobile Stream" : "Start Mobile Stream"}
            </Button>
          )}
          <Tooltip title="Chat">
            <IconButton onClick={() => setShowChat(!showChat)} color={showChat ? "primary" : "default"}>
              <Chat />
            </IconButton>
          </Tooltip>
          {/* Only show Go Live button to room owner */}
          {isRoomOwner && (
            <Tooltip title={room?.isLive ? "Stop Live" : "Go Live"}>
              <IconButton 
                color={room?.isLive ? "error" : "primary"} 
                onClick={handleGoLive}
                disabled={isProcessing}
              >
                <LocalFireDepartment />
              </IconButton>
            </Tooltip>
          )}
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
          <Tooltip title="Members">
            <IconButton onClick={() => setShowMembers(!showMembers)} color={showMembers ? "primary" : "default"}>
              <Group />
            </IconButton>
          </Tooltip>
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

  const isOwner = room.members?.some(member => member.userId === user?.uid && member.role === 'owner');
  const owner = room.members?.find(member => member.role === 'owner');

  // Update the live section in the render
  const renderVideoElements = () => {
    if (!room) return null;

    return (
      <Box sx={{ mb: 3 }}>
        <MuxStream 
          isOwner={room.ownerId === user?.uid}
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

  const renderChat = () => (
    <Box sx={{ 
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden'
    }}>
      <Box sx={{ 
        p: 2,
        borderBottom: 1,
        borderColor: 'divider'
      }}>
        <Typography variant="h6">Chat</Typography>
      </Box>
      
      <Box sx={{ 
        flex: 1,
        overflow: 'auto',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}>
        {messages.map((message) => (
          <Box 
            key={message.id} 
            sx={{ 
              display: 'flex',
              gap: 1,
              alignItems: 'flex-start',
              bgcolor: message.userId === user?.uid ? 'primary.light' : 'background.paper',
              p: 2,
              borderRadius: 2,
              boxShadow: 1
            }}
          >
            <Avatar 
              src={message.avatar || message.photoURL} 
              alt={message.username || message.displayName}
              sx={{ 
                width: 40, 
                height: 40,
                border: theme => message.userId === user?.uid ? `2px solid ${theme.palette.primary.main}` : 'none'
              }}
            >
              {(!message.avatar && !message.photoURL) && (message.username || message.displayName || 'A').charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    fontWeight: 'bold',
                    color: message.userId === user?.uid ? 'primary.dark' : 'text.primary'
                  }}
                >
                  {message.displayName || message.username || 'Anonymous'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {message.timestamp instanceof Date 
                    ? message.timestamp.toLocaleTimeString()
                    : message.timestamp?.toDate?.()?.toLocaleTimeString() || ''}
                </Typography>
              </Box>
              <Typography 
                variant="body1" 
                sx={{ 
                  wordBreak: 'break-word',
                  color: message.userId === user?.uid ? 'primary.contrastText' : 'text.primary',
                  mt: 0.5
                }}
              >
                {message.content}
              </Typography>
            </Box>
          </Box>
        ))}
        <div ref={messagesEndRef} />
      </Box>

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
        <Box sx={{ display: 'flex', gap: 1 }}>
          <InputBase
            fullWidth
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            sx={{ 
              px: 2,
              py: 1,
              bgcolor: 'action.hover',
              borderRadius: 2
            }}
          />
          <IconButton 
            type="submit" 
            color="primary" 
            disabled={!newMessage.trim()}
            sx={{ flexShrink: 0 }}
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

  return (
    <Box sx={{ 
      display: 'flex', 
      height: '100vh',
      overflow: 'hidden',
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
        height: '100%',
        overflow: 'hidden'
      }}>
        {renderRoomHeader()}
        {/* Scrollable Content Area */}
        <Box sx={{ 
          flex: 1, 
          overflow: 'auto',
          p: 2,
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
          height: '100%',
          position: { xs: 'fixed', sm: 'relative' },
          right: 0,
          top: 0,
          bgcolor: 'background.paper',
          borderLeft: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1200
        }}>
          {showMembers && renderMemberList()}
          {showChat && renderChat()}
        </Box>
      )}

      {renderInviteDialog()}

      {/* Mobile Streaming Dialog */}
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
              To stream from your mobile device:
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              1. Open your mobile browser and go to: <Link href="https://broadcast.mux.com" target="_blank" rel="noopener noreferrer">broadcast.mux.com</Link>
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
              2. Enter the stream key shown above
            </Typography>
            <Typography variant="body2" color="text.secondary">
              3. Allow camera and microphone access when prompted
            </Typography>
            <Typography variant="body2" color="text.secondary">
              4. Click "Start Broadcasting"
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
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Note: Make sure your mobile device has a stable internet connection for the best streaming experience.
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMobileStreamDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Add Style Dialog */}
      <Dialog 
        open={showStyleDialog} 
        onClose={() => !isProcessing && setShowStyleDialog(false)}
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>Customize Room Style</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
            {/* Colors Section */}
            <Box>
              <Typography variant="h6" gutterBottom>Colors</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Header Color</InputLabel>
                    <Select
                      value={roomStyle.headerColor}
                      onChange={(e) => setRoomStyle(prev => ({ ...prev, headerColor: e.target.value }))}
                    >
                      {COLOR_PRESETS.map((color) => (
                        <MenuItem key={color.name} value={color.value}>
                          {color.name}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>Choose a color or gradient for the header</FormHelperText>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Background Color</InputLabel>
                    <Select
                      value={roomStyle.backgroundColor}
                      onChange={(e) => setRoomStyle(prev => ({ ...prev, backgroundColor: e.target.value }))}
                    >
                      {COLOR_PRESETS.map((color) => (
                        <MenuItem key={color.name} value={color.value}>
                          {color.name}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>Choose a color or gradient for the background</FormHelperText>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Text Color</InputLabel>
                    <TextField
                      type="color"
                      value={roomStyle.textColor}
                      onChange={(e) => setRoomStyle(prev => ({ ...prev, textColor: e.target.value }))}
                      fullWidth
                      sx={{ '& input': { height: '50px', cursor: 'pointer' } }}
                    />
                    <FormHelperText>Color for all text</FormHelperText>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Accent Color</InputLabel>
                    <TextField
                      type="color"
                      value={roomStyle.accentColor}
                      onChange={(e) => setRoomStyle(prev => ({ ...prev, accentColor: e.target.value }))}
                      fullWidth
                      sx={{ '& input': { height: '50px', cursor: 'pointer' } }}
                    />
                    <FormHelperText>Color for buttons and icons</FormHelperText>
                  </FormControl>
                </Grid>
              </Grid>
              <Box sx={{ mt: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={roomStyle.headerGradient}
                      onChange={(e) => setRoomStyle(prev => ({ ...prev, headerGradient: e.target.checked }))}
                    />
                  }
                  label="Enable Header Gradient Effect"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={roomStyle.backgroundGradient}
                      onChange={(e) => setRoomStyle(prev => ({ ...prev, backgroundGradient: e.target.checked }))}
                    />
                  }
                  label="Enable Background Gradient Effect"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={roomStyle.glitterEffect}
                      onChange={(e) => setRoomStyle(prev => ({ ...prev, glitterEffect: e.target.checked }))}
                    />
                  }
                  label="Enable Glitter Effect"
                />
              </Box>
            </Box>

            <Divider />

            {/* Font Section */}
            <Box>
              <Typography variant="h6" gutterBottom>Font</Typography>
              <FormControl fullWidth>
                <InputLabel>Font Style</InputLabel>
                <Select
                  value={roomStyle.font}
                  onChange={(e) => setRoomStyle(prev => ({ ...prev, font: e.target.value }))}
                  sx={{ fontFamily: roomStyle.font }}
                >
                  {FONT_OPTIONS.map((font) => (
                    <MenuItem 
                      key={font.value} 
                      value={font.value}
                      sx={{ fontFamily: font.value }}
                    >
                      {font.label}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>Choose a font for your room</FormHelperText>
              </FormControl>
            </Box>

            <Divider />

            <Box>
              <Typography variant="h6" gutterBottom>Header Size</Typography>
              <Box sx={{ px: 2 }}>
                <Slider
                  value={roomStyle.headerFontSize}
                  onChange={(_, value) => setRoomStyle(prev => ({ ...prev, headerFontSize: value as number }))}
                  min={16}
                  max={48}
                  step={1}
                  marks={[
                    { value: 16, label: 'Small' },
                    { value: 24, label: 'Medium' },
                    { value: 36, label: 'Large' },
                    { value: 48, label: 'X-Large' }
                  ]}
                  valueLabelDisplay="auto"
                />
              </Box>
            </Box>

            <Divider />

            <Box>
              <Typography variant="h6" gutterBottom>Stickers</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, p: 2 }}>
                {STICKER_OPTIONS.map((sticker) => (
                  <Chip
                    key={sticker.name}
                    label={sticker.value}
                    onClick={() => {
                      setRoomStyle(prev => ({
                        ...prev,
                        stickers: prev.stickers.includes(sticker.value)
                          ? prev.stickers.filter((s: string) => s !== sticker.value)
                          : [...prev.stickers, sticker.value]
                      }));
                    }}
                    color={roomStyle.stickers.includes(sticker.value) ? 'primary' : 'default'}
                    sx={{ fontSize: '1.5rem', cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setShowStyleDialog(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleStyleSubmit}
            variant="contained"
            disabled={isProcessing}
          >
            {isProcessing ? <CircularProgress size={24} /> : 'Save Style'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add the Menu component */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {isRoomOwner && (
          <>
            <MenuItem onClick={handleEditRoom} disabled={isProcessing}>
              <ListItemIcon>
                <Edit fontSize="small" />
              </ListItemIcon>
              Edit Room
            </MenuItem>
            <MenuItem onClick={handleStyleRoom} disabled={isProcessing}>
              <ListItemIcon>
                <Palette fontSize="small" />
              </ListItemIcon>
              Customize Style
            </MenuItem>
            <MenuItem onClick={() => setShowRecordingsDialog(true)}>
              <ListItemIcon>
                <Videocam fontSize="small" />
              </ListItemIcon>
              View Recordings
            </MenuItem>
            <Divider />
            <MenuItem 
              onClick={handleDeleteRoom} 
              disabled={isDeleting || isProcessing}
              sx={{ color: 'error.main' }}
            >
              <ListItemIcon>
                <Delete fontSize="small" color="error" />
              </ListItemIcon>
              Delete Room
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Edit Room Dialog */}
      <Dialog 
        open={showEditDialog} 
        onClose={() => !isProcessing && setShowEditDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Room</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              fullWidth
              label="Room Name"
              defaultValue={room?.name}
              onChange={(e) => {
                const updatedRoom = { ...room, name: e.target.value };
                setRoom(updatedRoom);
              }}
            />
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={4}
              defaultValue={room?.description}
              onChange={(e) => {
                const updatedRoom = { ...room, description: e.target.value };
                setRoom(updatedRoom);
              }}
            />
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={room?.category || ''}
                label="Category"
                onChange={(e) => {
                  const updatedRoom = { ...room, category: e.target.value };
                  setRoom(updatedRoom);
                }}
              >
                <MenuItem value="Gaming">Gaming</MenuItem>
                <MenuItem value="Music">Music</MenuItem>
                <MenuItem value="Art">Art</MenuItem>
                <MenuItem value="Technology">Technology</MenuItem>
                <MenuItem value="Sports">Sports</MenuItem>
                <MenuItem value="Education">Education</MenuItem>
                <MenuItem value="Entertainment">Entertainment</MenuItem>
                <MenuItem value="Social">Social</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Maximum Members"
              type="number"
              defaultValue={room?.maxMembers}
              onChange={(e) => {
                const updatedRoom = { ...room, maxMembers: parseInt(e.target.value) };
                setRoom(updatedRoom);
              }}
              InputProps={{
                inputProps: { min: 1 }
              }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={room?.isPrivate || false}
                  onChange={(e) => {
                    const updatedRoom = { ...room, isPrivate: e.target.checked };
                    setRoom(updatedRoom);
                  }}
                />
              }
              label="Private Room"
            />
            {room?.isPrivate && (
              <TextField
                fullWidth
                label="Room Password"
                type="password"
                defaultValue={room?.password}
                onChange={(e) => {
                  const updatedRoom = { ...room, password: e.target.value };
                  setRoom(updatedRoom);
                }}
              />
            )}
            <Autocomplete
              multiple
              freeSolo
              options={[]}
              defaultValue={room?.tags || []}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Tags"
                  placeholder="Add tags"
                />
              )}
              onChange={(_, newValue) => {
                const updatedRoom = { ...room, tags: newValue };
                setRoom(updatedRoom);
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setShowEditDialog(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              const updatedData = {
                name: room?.name,
                description: room?.description,
                category: room?.category,
                maxMembers: room?.maxMembers,
                isPrivate: room?.isPrivate,
                password: room?.password,
                tags: room?.tags
              };
              handleEditSubmit(updatedData);
            }}
            disabled={isProcessing}
          >
            {isProcessing ? <CircularProgress size={24} /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {renderRecordingsDialog()}
    </Box>
  );
};

export default SideRoomComponent; 