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
  InputAdornment
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
  Close
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
  timestamp: Date;
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
      const newMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(newMessages);
    }, (error) => {
      console.error('Error listening to messages:', error);
      if (error.code === 'permission-denied') {
        setError('You do not have permission to view messages in this room');
      }
    });
  };

  const setupPresenceListener = () => {
    if (!user || !roomId) return;

    const presenceRef = collection(db, 'sideRooms', roomId, 'presence');
    const q = query(presenceRef);

    presenceUnsubscribe.current = onSnapshot(q, (snapshot) => {
      const newPresence = snapshot.docs.map(doc => ({
        userId: doc.id,
        username: doc.data().username || '',
        avatar: doc.data().avatar || '',
        lastSeen: doc.data().lastSeen?.toDate() || new Date(),
        isOnline: doc.data().isOnline || false
      })) as PresenceData[];
      setPresence(newPresence);
    }, (error) => {
      console.error('Error listening to presence:', error);
      if (error.code === 'permission-denied') {
        setError('You do not have permission to view presence in this room');
      }
    });
  };

  useEffect(() => {
    if (!user || !roomId) return;

    const setupRoomListener = async () => {
      try {
        // First check if the room exists and get its data
        const roomRef = doc(db, 'sideRooms', roomId);
        const roomDoc = await getDoc(roomRef);

        if (!roomDoc.exists()) {
          setError('Room not found');
          return;
        }

        const roomData = roomDoc.data();
        
        // Check if user is already a member
        const memberRef = doc(db, 'sideRooms', roomId, 'members', user.uid);
        const memberDoc = await getDoc(memberRef);

        if (!memberDoc.exists()) {
          // Check if room is private
          if (roomData.isPrivate) {
            setError('This is a private room. You need an invitation to join.');
            return;
          }

          // If not a member and room is public, add them
          try {
            await setDoc(memberRef, {
              joinedAt: new Date(),
              role: 'member'
            });
          } catch (error) {
            console.error('Error adding member:', error);
            setError('Failed to join room. Please try again.');
            return;
          }
        }

        // Verify membership again before setting up listeners
        const updatedMemberDoc = await getDoc(memberRef);
        if (!updatedMemberDoc.exists()) {
          setError('Failed to verify membership. Please try again.');
          return;
        }

        // Now set up the listeners
        setupMessagesListener();
        setupPresenceListener();
      } catch (error: any) {
        console.error('Error setting up room:', error);
        if (error.code === 'permission-denied') {
          setError('You do not have permission to join this room');
        } else {
          setError('Failed to join room. Please try again.');
        }
      }
    };

    setupRoomListener();

    return () => {
      if (messagesUnsubscribe.current) messagesUnsubscribe.current();
      if (presenceUnsubscribe.current) presenceUnsubscribe.current();
    };
  }, [user, roomId]);

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
  }, [user, authLoading, roomId, navigate]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleJoinRoom = useCallback(async () => {
    if (!room || !user || !roomId || isProcessing) return;

    try {
      setIsProcessing(true);
      const roomRef = doc(db, 'sideRooms', roomId);

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

        // Update both members and memberCount atomically
        transaction.update(roomRef, {
          members: arrayRemove(memberToRemove),
          memberCount: Math.max(0, (roomData.memberCount || 0) - 1)
        });
      });

      if (mountedRef.current) {
        toast.success('Left room successfully');
        // Delay navigation to ensure the state is updated
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
  }, [room, user, roomId, isProcessing, navigate, handleError]);

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
      await addDoc(messagesRef, {
        userId: user.uid,
        username: user.displayName || 'Anonymous',
        avatar: user.photoURL || '',
        content: newMessage.trim(),
        timestamp: serverTimestamp()
      });

      setNewMessage('');
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
    if (!room || !roomId) return;
    try {
      setIsProcessing(true);
      const roomRef = doc(db, 'sideRooms', roomId);
      await updateDoc(roomRef, {
        ...roomData,
        updatedAt: new Date()
      });
      toast.success('Room updated successfully');
      setShowEditDialog(false);
    } catch (err) {
      console.error('Error updating room:', err);
      handleError(err, 'Failed to update room');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteRoom = async () => {
    handleMenuClose();
    if (!room || !user || !roomId) return;

    try {
      setIsDeleting(true);
      const roomRef = doc(db, 'sideRooms', roomId);
      
      // Move room to user's trash
      const trashRef = doc(db, 'users', user.uid, 'trash', roomId);
      await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) {
          throw new Error('Room not found');
        }

        // Add room to trash
        transaction.set(trashRef, {
          ...roomDoc.data(),
          deletedAt: new Date(),
          originalPath: `sideRooms/${roomId}`
        });

        // Delete the room
        transaction.delete(roomRef);
      });

      toast.success('Room moved to trash');
      navigate('/side-rooms');
    } catch (err) {
      console.error('Error deleting room:', err);
      handleError(err, 'Failed to delete room');
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

  const renderRoomHeader = () => (
    <Box sx={{ 
      p: 2, 
      borderBottom: 1, 
      borderColor: 'divider',
      bgcolor: 'background.paper'
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1">
            {room?.name}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Created by {room?.ownerId === user?.uid ? 'You' : 'Anonymous'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <Group fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              {room?.activeUsers || 0} {room?.activeUsers === 1 ? 'person' : 'people'} viewing
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
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
          <Tooltip title="Members">
            <IconButton onClick={() => setShowMembers(!showMembers)} color={showMembers ? "primary" : "default"}>
              <Group />
            </IconButton>
          </Tooltip>
          {(isRoomOwner || isMember) && (
            <Button variant="outlined" color="error" startIcon={<ExitToApp />} onClick={handleLeaveRoom}>
              Leave
            </Button>
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
              alignItems: 'flex-start'
            }}
          >
            <Avatar 
              src={message.avatar} 
              sx={{ width: 32, height: 32 }}
            >
              {!message.avatar && message.username?.charAt(0)}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2">
                  {message.username || 'Anonymous'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {message.timestamp?.toLocaleTimeString()}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
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
              px: 1.5,
              py: 0.75,
              bgcolor: 'action.hover',
              borderRadius: 1
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

  return (
    <Box sx={{ 
      display: 'flex', 
      height: '100vh',
      overflow: 'hidden'
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
    </Box>
  );
};

export default SideRoomComponent; 