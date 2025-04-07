import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
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
  deleteDoc
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
  Autocomplete
} from '@mui/material';
import { 
  ExitToApp, 
  Lock, 
  Group, 
  LocalFireDepartment, 
  Mic, 
  MicOff,
  Videocam, 
  VideocamOff,
  ScreenShare,
  StopScreenShare,
  Chat,
  MoreVert,
  Send,
  Edit,
  Delete,
  PersonAdd,
  Search
} from '@mui/icons-material';
import type { SideRoom, RoomMember } from '../../types/index';
import { createPeerConnection, getMediaStream, getScreenShare, stopMediaStream } from '../../utils/webrtc';
import RoomForm from './RoomForm';

interface Message {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  content: string;
  timestamp: Date;
}

interface MediaState {
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
}

interface User {
  id: string;
  username: string;
  avatar: string;
}

const SideRoomComponent: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
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
  const [mediaState, setMediaState] = useState<MediaState>({
    audioEnabled: false,
    videoEnabled: false,
    screenSharing: false
  });
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peerConnection, setPeerConnection] = useState<ReturnType<typeof createPeerConnection> | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<{ [key: string]: MediaStream }>({});
  const [screenShareError, setScreenShareError] = useState<string | null>(null);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const mountedRef = useRef(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [isInviting, setIsInviting] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (screenShareRef.current?.srcObject) {
        const tracks = (screenShareRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
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

  useEffect(() => {
    if (!roomId) {
      setError('Room ID is required');
      setLoading(false);
      return;
    }

    let isSubscribed = true;

    // Set up real-time listener for room changes
    const roomRef = doc(db, 'sideRooms', roomId);
    const unsubscribe = onSnapshot(
      roomRef,
      (doc) => {
        if (!isSubscribed) return;

        if (doc.exists()) {
          try {
            const roomData = doc.data();
            const owner = roomData.members?.find((member: RoomMember) => member.role === 'owner');
            const newRoom: SideRoom = {
              id: doc.id,
              name: String(roomData.name || ''),
              description: String(roomData.description || ''),
              ownerId: owner?.userId || '',
              members: Array.isArray(roomData.members) ? roomData.members : [],
              memberCount: Number(roomData.memberCount || 0),
              createdAt: roomData.createdAt?.toDate() || new Date(),
              isPrivate: Boolean(roomData.isPrivate),
              password: roomData.password || undefined,
              tags: Array.isArray(roomData.tags) ? roomData.tags : [],
              imageUrl: roomData.imageUrl || undefined,
              isLive: Boolean(roomData.isLive),
              liveParticipants: Array.isArray(roomData.liveParticipants) ? roomData.liveParticipants : [],
              category: String(roomData.category || ''),
              scheduledReveals: Array.isArray(roomData.scheduledReveals) ? roomData.scheduledReveals : [],
              activeUsers: Number(roomData.activeUsers || 0),
              maxParticipants: Number(roomData.maxParticipants || 50),
              rules: Array.isArray(roomData.rules) ? roomData.rules : [],
              bannedUsers: Array.isArray(roomData.bannedUsers) ? roomData.bannedUsers : []
            };

            if (isSubscribed) {
              setRoom(newRoom);
              setLoading(false);

              // Check if user is already a member
              const isMember = newRoom.members?.some(member => member.userId === currentUser?.uid);
              if (!isMember && newRoom.isPrivate) {
                setShowPasswordDialog(true);
              }
            }
          } catch (err) {
            if (isSubscribed) {
              handleError(err, 'Failed to process room data');
              setLoading(false);
            }
          }
        } else {
          if (isSubscribed) {
            setError('Room not found');
            setLoading(false);
          }
        }
      },
      (err) => {
        if (isSubscribed) {
          handleError(err, 'Failed to fetch room data');
          setLoading(false);
        }
      }
    );

    unsubscribeRef.current = unsubscribe;

    // Cleanup subscription on unmount
    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [roomId, currentUser, handleError]);

  useEffect(() => {
    if (!roomId) return;

    // Set up messages listener
    const messagesRef = collection(db, 'sideRooms', roomId, 'messages');
    const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(50));
    
    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate()
      })) as Message[];
      
      setMessages(newMessages.reverse());
      scrollToBottom();
    });

    return () => {
      unsubscribeMessages();
    };
  }, [roomId]);

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

        const roomData = roomDoc.data() as SideRoom;
        const newMember: RoomMember = {
          userId: currentUser.uid,
          username: currentUser.displayName || 'Anonymous',
          avatar: currentUser.photoURL || '',
          role: 'member',
          joinedAt: new Date()
        };

        // Check if user is already a member
        const isAlreadyMember = roomData.members?.some(member => member.userId === currentUser.uid);
        if (isAlreadyMember) {
          throw new Error('You are already a member of this room');
        }

        // Update both members and memberCount atomically
        transaction.update(roomRef, {
          members: arrayUnion(newMember),
          memberCount: (roomData.memberCount || 0) + 1,
          lastActivity: new Date()
        });
      });

      if (mountedRef.current) {
        toast.success('Joined room successfully');
        setShowPasswordDialog(false);
        // Update local room state
        setRoom(prevRoom => {
          if (!prevRoom) return null;
          return {
            ...prevRoom,
            members: [...(prevRoom.members || []), {
              userId: currentUser.uid,
              username: currentUser.displayName || 'Anonymous',
              avatar: currentUser.photoURL || '',
              role: 'member',
              joinedAt: new Date()
            }],
            memberCount: (prevRoom.memberCount || 0) + 1
          };
        });
      }
    } catch (err) {
      handleError(err, 'Failed to join room');
      if (mountedRef.current) {
        setShowPasswordDialog(false);
      }
    } finally {
      if (mountedRef.current) {
        setIsProcessing(false);
      }
    }
  }, [room, currentUser, roomId, isProcessing, handleError]);

  const handleLeaveRoom = useCallback(async () => {
    if (!room || !currentUser || !roomId || isProcessing) return;

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
          userId: currentUser.uid,
          username: currentUser.displayName || 'Anonymous',
          avatar: currentUser.photoURL || '',
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
  }, [room, currentUser, roomId, isProcessing, navigate, handleError]);

  const handlePasswordSubmit = useCallback(() => {
    if (room && password === room.password) {
      handleJoinRoom();
    } else {
      toast.error('Incorrect password');
    }
  }, [room, password, handleJoinRoom]);

  const handleGoLive = async () => {
    if (!room || !currentUser || !roomId) return;

    try {
      setIsProcessing(true);
      const roomRef = doc(db, 'sideRooms', roomId);
      
      await updateDoc(roomRef, {
        isLive: !room.isLive,
        lastActivity: new Date()
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
    if (!roomId || !currentUser || !newMessage.trim()) return;

    try {
      const messagesRef = collection(db, 'sideRooms', roomId, 'messages');
      await addDoc(messagesRef, {
        userId: currentUser.uid,
        username: currentUser.displayName || 'Anonymous',
        avatar: currentUser.photoURL || '',
        content: newMessage.trim(),
        timestamp: serverTimestamp()
      });

      setNewMessage('');
    } catch (err) {
      handleError(err, 'Failed to send message');
    }
  };

  // Initialize WebRTC when room is live
  useEffect(() => {
    if (room?.isLive && currentUser && roomId) {
      const pc = createPeerConnection(roomId, currentUser.uid);
      setPeerConnection(pc);

      // Set up signaling listeners
      const unsubscribeOffer = pc.signaling.listenForOffer(async (data) => {
        if (data.senderId !== currentUser.uid) {
          console.log('Received offer from:', data.senderId);
          await pc.handleOffer(data.data);
        }
      });

      const unsubscribeAnswer = pc.signaling.listenForAnswer(async (data) => {
        if (data.senderId !== currentUser.uid) {
          console.log('Received answer from:', data.senderId);
          await pc.handleAnswer(data.data);
        }
      });

      const unsubscribeIce = pc.signaling.listenForIceCandidate(async (data) => {
        if (data.senderId !== currentUser.uid) {
          console.log('Received ICE candidate from:', data.senderId);
          await pc.handleIceCandidate(data.data);
        }
      });

      // Handle incoming streams
      pc.pc.ontrack = (event) => {
        console.log('Received track:', event.track.kind);
        const stream = event.streams[0];
        if (stream) {
          console.log('New stream received:', {
            id: event.track.id,
            kind: event.track.kind,
            label: event.track.label
          });
          setRemoteStreams(prev => ({
            ...prev,
            [event.track.id]: stream
          }));
        }
      };

      // Create and send offer to other participants
      const initConnection = async () => {
        try {
          const offer = await pc.createOffer();
          console.log('Created offer:', offer);
        } catch (err) {
          console.error('Error creating offer:', err);
        }
      };

      initConnection();

      return () => {
        unsubscribeOffer();
        unsubscribeAnswer();
        unsubscribeIce();
        pc.cleanup();
      };
    }
  }, [room?.isLive, currentUser, roomId]);

  // Add debugging logs for media streams
  useEffect(() => {
    console.log('Local Stream Status:', {
      hasStream: !!localStream,
      audioTracks: localStream?.getAudioTracks().length || 0,
      videoTracks: localStream?.getVideoTracks().length || 0,
      tracks: localStream?.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        label: t.label
      }))
    });
  }, [localStream]);

  // Add debugging logs for remote streams
  useEffect(() => {
    console.log('Remote Streams Status:', {
      count: Object.keys(remoteStreams).length,
      streams: Object.entries(remoteStreams).map(([id, stream]) => ({
        id,
        audioTracks: stream.getAudioTracks().length,
        videoTracks: stream.getVideoTracks().length,
        tracks: stream.getTracks().map(t => ({
          kind: t.kind,
          enabled: t.enabled,
          label: t.label
        }))
      }))
    });
  }, [remoteStreams]);

  // Add debugging logs for peer connection
  useEffect(() => {
    if (peerConnection) {
      console.log('Peer Connection Status:', {
        connectionState: peerConnection.pc.connectionState,
        iceConnectionState: peerConnection.pc.iceConnectionState,
        signalingState: peerConnection.pc.signalingState
      });

      peerConnection.pc.onconnectionstatechange = () => {
        console.log('Connection state changed:', peerConnection.pc.connectionState);
      };

      peerConnection.pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state changed:', peerConnection.pc.iceConnectionState);
      };

      peerConnection.pc.onsignalingstatechange = () => {
        console.log('Signaling state changed:', peerConnection.pc.signalingState);
      };
    }
  }, [peerConnection]);

  const toggleAudio = async () => {
    console.log('Toggling audio...');
    if (!localStream) {
      try {
        console.log('Requesting audio stream...');
        const stream = await getMediaStream({ audio: true });
        console.log('Got audio stream:', stream.getTracks().map(t => t.kind));
        setLocalStream(stream);
        setMediaState(prev => ({ ...prev, audioEnabled: true }));
        if (peerConnection) {
          console.log('Adding audio stream to peer connection');
          peerConnection.addStream(stream);
        }
      } catch (err) {
        console.error('Error getting audio stream:', err);
        handleError(err, 'Failed to access microphone');
      }
    } else {
      console.log('Toggling existing audio track');
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !mediaState.audioEnabled;
        console.log(`Audio track ${track.label} enabled:`, track.enabled);
      });
      setMediaState(prev => ({ ...prev, audioEnabled: !prev.audioEnabled }));
    }
  };

  const toggleVideo = async () => {
    console.log('Toggling video...');
    if (!localStream) {
      try {
        console.log('Requesting video stream...');
        const stream = await getMediaStream({ video: true });
        console.log('Got video stream:', stream.getTracks().map(t => t.kind));
        setLocalStream(stream);
        setMediaState(prev => ({ ...prev, videoEnabled: true }));
        if (localVideoRef.current) {
          console.log('Setting video element source');
          localVideoRef.current.srcObject = stream;
        }
        if (peerConnection) {
          console.log('Adding video stream to peer connection');
          peerConnection.addStream(stream);
        }
      } catch (err) {
        console.error('Error getting video stream:', err);
        handleError(err, 'Failed to access camera');
      }
    } else {
      console.log('Toggling existing video track');
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !mediaState.videoEnabled;
        console.log(`Video track ${track.label} enabled:`, track.enabled);
      });
      setMediaState(prev => ({ ...prev, videoEnabled: !prev.videoEnabled }));
    }
  };

  const toggleScreenShare = async () => {
    console.log('Toggling screen share...');
    try {
      if (!mediaState.screenSharing) {
        console.log('Requesting screen share...');
        const stream = await getScreenShare();
        console.log('Got screen share stream:', stream.getTracks().map(t => t.kind));
        
        if (screenShareRef.current?.srcObject) {
          console.log('Stopping previous screen share');
          stopMediaStream(screenShareRef.current.srcObject as MediaStream);
        }

        if (screenShareRef.current) {
          console.log('Setting screen share element source');
          screenShareRef.current.srcObject = stream;
        }

        if (peerConnection) {
          console.log('Adding screen share stream to peer connection');
          peerConnection.addStream(stream);
        }

        // Handle when user stops sharing through browser UI
        stream.getVideoTracks()[0].onended = () => {
          console.log('Screen sharing ended by user');
          setMediaState(prev => ({ ...prev, screenSharing: false }));
          if (screenShareRef.current?.srcObject) {
            stopMediaStream(screenShareRef.current.srcObject as MediaStream);
            screenShareRef.current.srcObject = null;
          }
        };

        setMediaState(prev => ({ ...prev, screenSharing: true }));
        setScreenShareError(null);
      } else {
        console.log('Stopping screen share');
        if (screenShareRef.current?.srcObject) {
          stopMediaStream(screenShareRef.current.srcObject as MediaStream);
          screenShareRef.current.srcObject = null;
        }
        setMediaState(prev => ({ ...prev, screenSharing: false }));
        setScreenShareError(null);
      }
    } catch (err) {
      console.error('Error with screen share:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to share screen';
      setScreenShareError(errorMessage);
      handleError(err, errorMessage);
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
    if (!room || !currentUser || !roomId) return;

    try {
      setIsDeleting(true);
      const roomRef = doc(db, 'sideRooms', roomId);
      
      // Move room to user's trash
      const trashRef = doc(db, 'users', currentUser.uid, 'trash', roomId);
      await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) {
          throw new Error('Room not found');
        }

        // Add room to trash
        transaction.set(trashRef, {
          ...roomDoc.data(),
          deletedAt: new Date(),
          originalId: roomId
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
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      // Search users by username
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('username', '>=', searchTerm),
        where('username', '<=', searchTerm + '\uf8ff'),
        limit(5)
      );
      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(doc => {
        const data = doc.data() as { username: string; avatar: string };
        return {
          id: doc.id,
          username: data.username,
          avatar: data.avatar
        };
      });
      setSearchResults(results);
    } catch (err) {
      console.error('Error searching users:', err);
      handleError(err, 'Failed to search users');
    }
  };

  const handleInviteSubmit = async () => {
    if (!room || !roomId || !currentUser || selectedUsers.length === 0) return;

    try {
      setIsInviting(true);
      const batch = writeBatch(db);

      // Create invitations for each selected user
      selectedUsers.forEach(user => {
        const invitationRef = doc(collection(db, 'sideRooms', roomId, 'invitations'));
        batch.set(invitationRef, {
          userId: user.id,
          invitedBy: currentUser.uid,
          status: 'pending',
          createdAt: new Date(),
          roomId,
          roomName: room.name
        });

        // Add notification for the invited user
        const notificationRef = doc(collection(db, 'users', user.id, 'notifications'));
        batch.set(notificationRef, {
          type: 'room_invitation',
          roomId,
          roomName: room.name,
          invitedBy: currentUser.uid,
          invitedByUsername: currentUser.displayName,
          createdAt: new Date(),
          read: false
        });
      });

      await batch.commit();
      toast.success('Invitations sent successfully');
      setShowInviteDialog(false);
      setSelectedUsers([]);
    } catch (err) {
      console.error('Error sending invitations:', err);
      handleError(err, 'Failed to send invitations');
    } finally {
      setIsInviting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button onClick={() => navigate('/side-rooms')}>Back to Rooms</Button>
      </Box>
    );
  }

  if (!room) {
    return null;
  }

  const isMember = room.members?.some(member => member.userId === currentUser?.uid);
  const isOwner = room.members?.some(member => member.userId === currentUser?.uid && member.role === 'owner');
  const owner = room.members?.find(member => member.role === 'owner');

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
      {/* Main Room Content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
        {/* Room Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h4" component="h1">
              {room.name}
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Created by {owner?.username || 'Anonymous'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {isOwner && (
              <Tooltip title={room.isLive ? "Stop Live" : "Go Live"}>
                <IconButton 
                  color={room.isLive ? "error" : "primary"}
                  onClick={handleGoLive}
                  disabled={isProcessing}
                >
                  <LocalFireDepartment />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Members">
              <IconButton onClick={() => setShowMembers(!showMembers)}>
                <Group />
              </IconButton>
            </Tooltip>
            {isMember && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<ExitToApp />}
                onClick={handleLeaveRoom}
                disabled={isProcessing}
              >
                Leave
              </Button>
            )}
            {isOwner && (
              <IconButton onClick={handleMenuClick}>
                <MoreVert />
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Live Controls and Video */}
        {room.isLive && (
          <>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Tooltip title={mediaState.audioEnabled ? "Mute" : "Unmute"}>
                <IconButton 
                  color={mediaState.audioEnabled ? "primary" : "error"}
                  onClick={toggleAudio}
                >
                  {mediaState.audioEnabled ? <Mic /> : <MicOff />}
                </IconButton>
              </Tooltip>
              <Tooltip title={mediaState.videoEnabled ? "Turn off camera" : "Turn on camera"}>
                <IconButton 
                  color={mediaState.videoEnabled ? "primary" : "error"}
                  onClick={toggleVideo}
                >
                  {mediaState.videoEnabled ? <Videocam /> : <VideocamOff />}
                </IconButton>
              </Tooltip>
              <Tooltip title={mediaState.screenSharing ? "Stop sharing" : "Share screen"}>
                <IconButton 
                  color={mediaState.screenSharing ? "primary" : "default"}
                  onClick={toggleScreenShare}
                >
                  {mediaState.screenSharing ? <StopScreenShare /> : <ScreenShare />}
                </IconButton>
              </Tooltip>
            </Box>

            {/* Video Elements */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              {(mediaState.videoEnabled || mediaState.screenSharing) && (
                <Paper sx={{ flex: 1, p: 1 }}>
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '100%', maxHeight: '300px', objectFit: 'cover' }}
                  />
                </Paper>
              )}
              {mediaState.screenSharing && (
                <Paper sx={{ flex: 1, p: 1 }}>
                  <video
                    ref={screenShareRef}
                    autoPlay
                    playsInline
                    style={{ width: '100%', maxHeight: '300px', objectFit: 'contain' }}
                  />
                </Paper>
              )}
              {Object.entries(remoteStreams).map(([trackId, stream]) => (
                <Paper key={trackId} sx={{ flex: 1, p: 1 }}>
                  <video
                    ref={el => {
                      if (el) {
                        videoRefs.current[trackId] = el;
                        el.srcObject = stream;
                      }
                    }}
                    autoPlay
                    playsInline
                    style={{ width: '100%', maxHeight: '300px', objectFit: 'cover' }}
                  />
                </Paper>
              ))}
            </Box>
          </>
        )}

        {/* Chat Section */}
        <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', mb: 2 }}>
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {messages.map((message) => (
              <Box key={message.id} sx={{ display: 'flex', mb: 2 }}>
                <Avatar src={message.avatar} sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="subtitle2">{message.username}</Typography>
                  <Typography variant="body1">{message.content}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {message.timestamp?.toLocaleTimeString()}
                  </Typography>
                </Box>
              </Box>
            ))}
            <div ref={messagesEndRef} />
          </Box>
          <Divider />
          <Box component="form" onSubmit={handleSendMessage} sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <InputBase
                fullWidth
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <IconButton type="submit" color="primary" disabled={!newMessage.trim()}>
                <Send />
              </IconButton>
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* Members Sidebar */}
      {showMembers && (
        <Paper sx={{ width: 300, p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Members ({room?.memberCount || 0})</Typography>
            {isOwner && (
              <Button
                startIcon={<PersonAdd />}
                onClick={handleInviteMembers}
                variant="outlined"
                size="small"
              >
                Add Members
              </Button>
            )}
          </Box>
          <List>
            {room?.members?.map((member) => (
              <ListItem key={member.userId}>
                <ListItemAvatar>
                  <Avatar src={member.avatar} />
                </ListItemAvatar>
                <ListItemText
                  primary={member.username}
                  secondary={member.role}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* Password Dialog */}
      <Dialog 
        open={showPasswordDialog} 
        onClose={() => !isProcessing && setShowPasswordDialog(false)}
        disableEscapeKeyDown={isProcessing}
      >
        <DialogTitle>Enter Room Password</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Password"
            type="password"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isProcessing}
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setShowPasswordDialog(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button 
            onClick={handlePasswordSubmit} 
            variant="contained"
            disabled={isProcessing}
          >
            Join
          </Button>
        </DialogActions>
      </Dialog>

      {/* Screen Share Error Alert */}
      {screenShareError && (
        <div className="error-alert">
          <p>{screenShareError}</p>
          <button onClick={() => setScreenShareError(null)}>Dismiss</button>
        </div>
      )}

      {/* Edit Room Dialog */}
      <RoomForm
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        onSubmit={handleEditSubmit}
        initialData={room}
        title="Edit Room"
        submitButtonText="Save Changes"
        isProcessing={isProcessing}
      />

      {/* Menu */}
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
        <MenuItem onClick={handleDeleteRoom} disabled={isDeleting}>
          <ListItemIcon>
            <Delete fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete Room</ListItemText>
        </MenuItem>
      </Menu>

      {/* Invite Members Dialog */}
      <Dialog open={showInviteDialog} onClose={() => setShowInviteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Invite Members</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <Autocomplete
              multiple
              options={searchResults}
              getOptionLabel={(option) => option.username}
              value={selectedUsers}
              onChange={(_, newValue) => setSelectedUsers(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search users"
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleSearchUsers(e.target.value);
                  }}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: <Search sx={{ mr: 1 }} />
                  }}
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    avatar={<Avatar src={option.avatar} />}
                    label={option.username}
                  />
                ))
              }
              renderOption={(props, option) => (
                <ListItem {...props}>
                  <ListItemAvatar>
                    <Avatar src={option.avatar} />
                  </ListItemAvatar>
                  <ListItemText primary={option.username} />
                </ListItem>
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowInviteDialog(false)} disabled={isInviting}>
            Cancel
          </Button>
          <Button
            onClick={handleInviteSubmit}
            variant="contained"
            disabled={isInviting || selectedUsers.length === 0}
          >
            Send Invitations
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SideRoomComponent; 