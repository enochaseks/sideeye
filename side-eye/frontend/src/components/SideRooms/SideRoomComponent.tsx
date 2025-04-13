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
  Search,
  Close,
  VolumeUp,
  VolumeDown,
  VolumeMute
} from '@mui/icons-material';
import type { SideRoom, RoomMember } from '../../types/index';
import { createPeerConnection, getMediaStream, getScreenShare, stopMediaStream } from '../../utils/webrtc';
import { getDisplayMedia } from '../../utils/mediaStream';
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

interface AudioState {
  volume: number;
  monitoring: boolean;
  gainNode: GainNode | null;
  audioContext: AudioContext | null;
  monitorNode: MediaStreamAudioDestinationNode | null;
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
    audioEnabled: true,
    videoEnabled: true,
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
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [peerConnectionStatus, setPeerConnectionStatus] = useState<'new' | 'connecting' | 'connected' | 'closed'>('new');
  const [showChat, setShowChat] = useState(false);
  const [audioState, setAudioState] = useState<AudioState>({
    volume: 100,
    monitoring: false,
    gainNode: null,
    audioContext: null,
    monitorNode: null
  });
  const monitorAudioRef = useRef<HTMLAudioElement>(null);
  const [showScreenShare, setShowScreenShare] = useState(true);
  const [screenShareMenuAnchor, setScreenShareMenuAnchor] = useState<null | HTMLElement>(null);
  const [screenShareOwnerId, setScreenShareOwnerId] = useState<string | null>(null);

  // Add this check at the top of the component, right after the state declarations
  const isRoomOwnerOrMember = currentUser && room && (
    room.ownerId === currentUser.uid || 
    room.members?.some(member => member.userId === currentUser.uid)
  );

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
    const setupRoomListener = () => {
      try {
        if (!roomId || !db) return () => {};
        
        // Add authentication check
        if (!currentUser) {
          setError('You must be logged in to access this room');
          setLoading(false);
          return () => {};
        }

        const roomRef = doc(db, 'sideRooms', roomId);
        const unsubscribe = onSnapshot(roomRef, (doc) => {
          if (doc.exists()) {
            const data = doc.data();
            const roomData: SideRoom = {
              id: doc.id,
              name: data.name || '',
              description: data.description || '',
              ownerId: data.ownerId || '',
              members: data.members || [],
              memberCount: data.memberCount || 0,
              createdAt: data.createdAt || new Date(),
              isPrivate: data.isPrivate || false,
              password: data.password || '',
              tags: data.tags || [],
              lastActive: data.lastActive || new Date(),
              maxMembers: data.maxMembers || 50,
              bannedUsers: data.bannedUsers || [],
              isLive: data.isLive || false,
              liveParticipants: data.liveParticipants || [],
              category: data.category || '',
              scheduledReveals: data.scheduledReveals || [],
              activeUsers: data.activeUsers || 0
            };
            setRoom(roomData);
            setLoading(false);

            // Check if user is banned
            if (currentUser && roomData.bannedUsers?.includes(currentUser.uid)) {
              setError('You have been banned from this room');
              setLoading(false);
              return;
            }

            // Check if user is already a member (Add null check for currentUser)
            const isMember = currentUser && roomData.members?.some(member => member.userId === currentUser.uid);
            if (!isMember && roomData.isPrivate) {
              setShowPasswordDialog(true);
            } else if (isMember) {
              // Only set up messages listener if user is a member
              setupMessagesListener();
            }
          } else {
            setError('Room not found');
            setLoading(false);
          }
        }, (error) => {
          console.error('Error accessing room:', error);
          if (error.code === 'permission-denied') {
            setError('You do not have permission to access this room. Please ensure you are logged in and have the proper permissions.');
          } else {
            setError(`Error accessing room: ${error.message}`);
          }
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error setting up room listener:', error);
        setError('Failed to set up room listener');
        setLoading(false);
        return () => {};
      }
    };

    const setupMessagesListener = () => {
      try {
        if (!roomId || !db) return () => {};
        const messagesRef = collection(db, 'sideRooms', roomId, 'messages');
        const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'), limit(50));
        
        const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
          const newMessages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Message[];
          
          setMessages(newMessages);
        });

        return unsubscribe;
      } catch (error) {
        console.error('Error setting up messages listener:', error);
        setError('Failed to listen to messages');
        return () => {};
      }
    };

    const roomUnsubscribe = setupRoomListener();
    return () => {
      if (roomUnsubscribe) roomUnsubscribe();
    };
  }, [db, roomId, currentUser]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleJoinRoom = useCallback(async () => {
    if (!room || !currentUser || !roomId || isProcessing) return;

    try {
      setIsProcessing(true);
      const roomRef = doc(db, 'sideRooms', roomId);

      // Only track active users, don't add as member
      await updateDoc(roomRef, {
        activeUsers: increment(1),
        lastActive: serverTimestamp()
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

  const handleGoLive = async () => {
    if (!room || !currentUser || !roomId || !isRoomOwnerOrMember) {
      toast.error('Only room owners and members can go live');
      return;
    }

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

  // Add WebRTC initialization back
  useEffect(() => {
    if (!room?.isLive || !currentUser || !roomId) return;

    const isMember = room.members?.some(member => member.userId === currentUser.uid);
    if (!isMember) {
      console.log('User is not a member, skipping WebRTC initialization');
      return;
    }

    let pc: ReturnType<typeof createPeerConnection> | null = null;
    let isNegotiating = false;

    const setupPeerConnection = async () => {
      try {
        pc = createPeerConnection(roomId, currentUser.uid);
        setPeerConnection(pc);

        // Set up event handlers
        pc.pc.onnegotiationneeded = async () => {
          if (isNegotiating) return;
          isNegotiating = true;
          try {
            const offer = await pc!.createOffer();
            await pc!.pc.setLocalDescription(offer);
          } catch (err) {
            console.error('Error during negotiation:', err);
          } finally {
            isNegotiating = false;
          }
        };

        // Set up signaling listeners
        const unsubscribeOffer = pc.signaling.listenForOffer(async (data) => {
          if (data.senderId === currentUser.uid) return;
          
          try {
            if (pc!.pc.signalingState === 'stable') {
              await pc!.handleOffer(data.data);
            } else {
              console.log('Ignoring offer, signaling state:', pc!.pc.signalingState);
            }
          } catch (err) {
            console.error('Error handling offer:', err);
          }
        });

        const unsubscribeAnswer = pc.signaling.listenForAnswer(async (data) => {
          if (data.senderId === currentUser.uid) return;
          
          try {
            if (pc!.pc.signalingState === 'have-local-offer') {
              await pc!.handleAnswer(data.data);
            } else {
              console.log('Ignoring answer, signaling state:', pc!.pc.signalingState);
            }
          } catch (err) {
            console.error('Error handling answer:', err);
          }
        });

        const unsubscribeIce = pc.signaling.listenForIceCandidate(async (data) => {
          if (data.senderId === currentUser.uid) return;
          
          try {
            await pc!.handleIceCandidate(data.data);
          } catch (err) {
            console.error('Error handling ICE candidate:', err);
          }
        });

        // Add local stream if available
        if (localStream) {
          localStream.getTracks().forEach(track => {
            pc!.pc.addTrack(track, localStream);
          });
        }

        return () => {
          unsubscribeOffer();
          unsubscribeAnswer();
          unsubscribeIce();
          if (pc) {
            pc.cleanup();
          }
        };
      } catch (err) {
        console.error('Error setting up peer connection:', err);
        return () => {}; // Return empty cleanup function in case of error
      }
    };

    const cleanupPromise = setupPeerConnection();

    return () => {
      cleanupPromise.then(cleanup => {
        if (cleanup) {
          cleanup();
        }
      });
    };
  }, [room?.isLive, currentUser, roomId, localStream]);

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

  // Update the media initialization useEffect
  useEffect(() => {
    // Only initialize media if user is owner or member
    if (!room?.isLive || !currentUser || !isRoomOwnerOrMember) {
      // Clean up any existing streams if user is not owner/member
      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
        });
        setLocalStream(null);
      }
      return;
    }

    const setupMedia = async () => {
      try {
        const stream = await getMediaStream({ 
          audio: true,
          video: true
        });
        
        setLocalStream(stream);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        if (peerConnection) {
          peerConnection.addStream(stream);
        }

        stream.getTracks().forEach(track => {
          track.enabled = true;
        });

        console.log('Media setup complete for owner/member');
      } catch (err) {
        console.error('Error setting up media:', err);
        if (err instanceof Error) {
          toast.error(err.message);
        } else {
          toast.error('Failed to setup media devices');
        }
      }
    };

    setupMedia();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
        });
      }
    };
  }, [room?.isLive, currentUser, isRoomOwnerOrMember]);

  // Add audio setup function
  const setupAudioContext = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const gainNode = audioContext.createGain();
      const monitorNode = audioContext.createMediaStreamDestination();

      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      gainNode.connect(monitorNode);

      setAudioState(prev => ({
        ...prev,
        gainNode,
        audioContext,
        monitorNode
      }));

      // Set initial volume
      gainNode.gain.value = audioState.volume / 100;

      console.log('Audio context setup complete');
    } catch (err) {
      console.error('Error setting up audio context:', err);
    }
  }, [audioState.volume]);

  // Update audio setup in toggleAudio
  const toggleAudio = async () => {
    console.log('Toggling audio...');
    if (!localStream) {
      try {
        console.log('Requesting audio stream...');
        const stream = await getMediaStream({ audio: true, video: mediaState.videoEnabled });
        console.log('Got audio stream:', stream.getTracks().map(t => t.kind));
        setLocalStream(stream);
        setMediaState(prev => ({ ...prev, audioEnabled: true }));
        if (peerConnection) {
          console.log('Adding audio stream to peer connection');
          peerConnection.addStream(stream);
        }
        // Set up audio context for the new stream
        setupAudioContext(stream);
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

  // Add volume control handler
  const handleVolumeChange = (event: Event, newValue: number | number[]) => {
    const volume = newValue as number;
    if (audioState.gainNode) {
      audioState.gainNode.gain.value = volume / 100;
    }
    setAudioState(prev => ({ ...prev, volume }));
  };

  // Add monitoring toggle handler
  const toggleMonitoring = () => {
    if (!audioState.monitorNode || !monitorAudioRef.current) return;

    if (!audioState.monitoring) {
      monitorAudioRef.current.srcObject = audioState.monitorNode.stream;
      monitorAudioRef.current.play().catch(console.error);
    } else {
      monitorAudioRef.current.srcObject = null;
    }
    setAudioState(prev => ({ ...prev, monitoring: !prev.monitoring }));
  };

  // Add cleanup for audio context
  useEffect(() => {
    return () => {
      if (audioState.audioContext) {
        audioState.audioContext.close();
      }
    };
  }, []);

  // Add audio controls component
  const renderAudioControls = () => (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        Audio Controls
      </Typography>
      <Stack spacing={2} direction="row" alignItems="center">
        <IconButton onClick={() => handleVolumeChange({} as Event, 0)}>
          {audioState.volume === 0 ? <VolumeMute /> : <VolumeDown />}
        </IconButton>
        <Slider
          value={audioState.volume}
          onChange={handleVolumeChange}
          aria-label="Volume"
          min={0}
          max={100}
          valueLabelDisplay="auto"
          sx={{ mx: 2 }}
        />
        <IconButton onClick={() => handleVolumeChange({} as Event, 100)}>
          <VolumeUp />
        </IconButton>
        <Tooltip title={audioState.monitoring ? "Stop Monitoring" : "Monitor Audio"}>
          <IconButton 
            onClick={toggleMonitoring}
            color={audioState.monitoring ? "primary" : "default"}
          >
            <Mic />
          </IconButton>
        </Tooltip>
      </Stack>
      {/* Hidden audio element for monitoring */}
      <audio ref={monitorAudioRef} hidden />
    </Paper>
  );

  // Update video elements when streams change
  useEffect(() => {
    if (localStream && localVideoRef.current && mediaState.videoEnabled) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, mediaState.videoEnabled]);

  // Add audio visualization
  useEffect(() => {
    if (!localStream) return;

    const audioContext = new AudioContext();
    const audioSource = audioContext.createMediaStreamSource(localStream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    audioSource.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animationFrame: number;

    const updateAudioLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const level = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
      setAudioLevel(level);
      animationFrame = requestAnimationFrame(updateAudioLevel);
    };

    updateAudioLevel();

    return () => {
      cancelAnimationFrame(animationFrame);
      audioContext.close();
    };
  }, [localStream]);

  // Add audio indicator component
  const AudioIndicator = () => (
    <Box
      sx={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        backgroundColor: audioLevel > 10 ? 'green' : 'red',
        transition: 'background-color 0.2s'
      }}
    />
  );

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
        .filter(user => user.id !== currentUser?.uid); // Exclude current user

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
      for (const user of selectedUsers) {
        // Create invitation
        const invitationRef = doc(collection(db, 'sideRooms', roomId, 'invitations'));
        batch.set(invitationRef, {
          userId: user.id,
          invitedBy: currentUser.uid,
          inviterName: currentUser.displayName || 'Anonymous',
          inviterAvatar: currentUser.photoURL || '',
          roomId,
          roomName: room.name,
          timestamp: serverTimestamp(),
          status: 'pending'
        });

        // Create notification
        const notificationRef = doc(collection(db, 'users', user.id, 'notifications'));
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

  // Monitor peer connection state
  useEffect(() => {
    if (peerConnection) {
      const handleStateChange = () => {
        setPeerConnectionStatus(peerConnection.pc.connectionState as any);
        console.log('Peer connection state:', peerConnection.pc.connectionState);
      };

      peerConnection.pc.onconnectionstatechange = handleStateChange;
      return () => {
        peerConnection.pc.onconnectionstatechange = null;
      };
    }
  }, [peerConnection]);

  const toggleVideo = async () => {
    console.log('Toggling video...');
    if (!localStream) {
      try {
        console.log('Requesting video stream...');
        const stream = await getMediaStream({ video: true, audio: mediaState.audioEnabled });
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

  const ensurePeerConnection = useCallback(() => {
    if (!peerConnection || peerConnection.pc.connectionState === 'closed' || peerConnection.pc.signalingState === 'closed') {
      console.log('Creating new peer connection...');
      if (roomId && currentUser) {
        const newPc = createPeerConnection(roomId, currentUser.uid);
        setPeerConnection(newPc);
        
        // Set up event handlers for the new connection
        newPc.pc.onconnectionstatechange = () => {
          console.log('Connection state changed:', newPc.pc.connectionState);
          setPeerConnectionStatus(newPc.pc.connectionState as any);
        };

        newPc.pc.onsignalingstatechange = () => {
          console.log('Signaling state changed:', newPc.pc.signalingState);
        };

        // If we have existing streams, add them to the new connection
        if (localStream) {
          localStream.getTracks().forEach(track => {
            try {
              console.log('Adding existing track to new connection:', track.kind);
              newPc.pc.addTrack(track, localStream);
            } catch (err) {
              console.error('Error adding track to new connection:', err);
            }
          });
        }

        return newPc;
      }
      return null;
    }
    return peerConnection;
  }, [roomId, currentUser, peerConnection, localStream]);

  const toggleScreenShare = async () => {
    console.log('Toggling screen share...');
    try {
      if (!mediaState.screenSharing) {
        console.log('Starting screen share...');
        
        setShowScreenShare(true);
        
        const screenStream = await getScreenShare();
        console.log('Got screen stream:', screenStream.getTracks().map(t => ({ kind: t.kind, label: t.label })));

        if (screenShareRef.current) {
          console.log('Setting screen share video source');
          screenShareRef.current.srcObject = screenStream;
          await screenShareRef.current.play().catch(console.error);
          // Set screen share owner ID when starting share
          setScreenShareOwnerId(currentUser?.uid || null);
        }

        const pc = ensurePeerConnection();
        if (pc && pc.pc.signalingState !== 'closed') {
          try {
            screenStream.getTracks().forEach(track => {
              console.log('Adding track to peer connection:', track.kind, track.label);
              pc.pc.addTrack(track, screenStream);
            });
          } catch (err) {
            console.warn('Error adding screen tracks to peer connection:', err);
          }
        }

        screenStream.getVideoTracks()[0].onended = () => {
          console.log('Screen sharing ended by user');
          if (pc && pc.pc.signalingState !== 'closed') {
            try {
              const senders = pc.pc.getSenders();
              senders.forEach(sender => {
                if (sender.track && (sender.track.kind === 'video' || sender.track.label.includes('screen'))) {
                  try {
                    pc.pc.removeTrack(sender);
                  } catch (err) {
                    console.warn('Error removing track:', err);
                  }
                }
              });
            } catch (err) {
              console.warn('Error cleaning up senders:', err);
            }
          }
          screenStream.getTracks().forEach(track => {
            track.stop();
          });
          if (screenShareRef.current) {
            screenShareRef.current.srcObject = null;
          }
          setMediaState(prev => ({ ...prev, screenSharing: false }));
          // Clear screen share owner ID when stopping share
          setScreenShareOwnerId(null);
        };

        setMediaState(prev => ({ ...prev, screenSharing: true }));
        setScreenShareError(null);

      } else {
        console.log('Stopping screen share...');
        
        if (screenShareRef.current?.srcObject instanceof MediaStream) {
          const stream = screenShareRef.current.srcObject;
          stream.getTracks().forEach(track => {
            track.stop();
            console.log('Stopped track:', track.label);
          });
          screenShareRef.current.srcObject = null;
        }

        const pc = peerConnection;
        if (pc && pc.pc.signalingState !== 'closed') {
          try {
            const senders = pc.pc.getSenders();
            const screenSenders = senders.filter(sender => 
              sender.track?.kind === 'video' || 
              sender.track?.label?.includes('screen') || 
              sender.track?.label?.includes('Screen')
            );
            
            for (const sender of screenSenders) {
              if (sender.track) {
                sender.track.stop();
                try {
                  pc.pc.removeTrack(sender);
                } catch (err) {
                  console.warn('Error removing screen track:', err);
                }
              }
            }
          } catch (err) {
            console.warn('Error cleaning up peer connection:', err);
          }
        }

        setMediaState(prev => ({ ...prev, screenSharing: false }));
        setScreenShareError(null);
        // Clear screen share owner ID when stopping share
        setScreenShareOwnerId(null);
      }
    } catch (err) {
      console.error('Error with screen share:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to share screen';
      setScreenShareError(errorMessage);
      handleError(err, errorMessage);
      setMediaState(prev => ({ ...prev, screenSharing: false }));
      setScreenShareOwnerId(null);
    }
  };

  // Add presence tracking
  useEffect(() => {
    if (!roomId || !currentUser || !db) return;

    const userPresenceRef = doc(db, 'sideRooms', roomId, 'presence', currentUser.uid);
    const roomRef = doc(db, 'sideRooms', roomId);

    const setupPresence = async () => {
      try {
        // Add user to presence collection
        await setDoc(userPresenceRef, {
          userId: currentUser.uid,
          lastSeen: serverTimestamp(),
          status: 'online'
        });

        // Set up cleanup on window unload
        const handleUnload = () => {
          // Use a synchronous write to ensure it happens before the page closes
          try {
            deleteDoc(userPresenceRef);
          } catch (error) {
            console.error('Error cleaning up presence:', error);
          }
        };

        window.addEventListener('beforeunload', handleUnload);

        // Set up presence listener
        const unsubscribePresence = onSnapshot(
          collection(db, 'sideRooms', roomId, 'presence'),
          (snapshot) => {
            // Count only unique online users
            const activeUsers = new Set(
              snapshot.docs
                .filter(doc => doc.data().status === 'online')
                .map(doc => doc.data().userId)
            ).size;

            // Update room's active users count
            updateDoc(roomRef, {
              activeUsers
            }).catch(console.error);
          }
        );

        // Periodic presence refresh
        const presenceInterval = setInterval(async () => {
          try {
            await updateDoc(userPresenceRef, {
              lastSeen: serverTimestamp()
            });
          } catch (error) {
            console.error('Error updating presence:', error);
          }
        }, 30000); // Update every 30 seconds

        return () => {
          window.removeEventListener('beforeunload', handleUnload);
          clearInterval(presenceInterval);
          unsubscribePresence();
          // Clean up presence on unmount
          deleteDoc(userPresenceRef).catch(console.error);
        };
      } catch (error) {
        console.error('Error setting up presence:', error);
        return () => {};
      }
    };

    const cleanup = setupPresence();
    return () => {
      cleanup.then(cleanupFn => cleanupFn());
    };
  }, [roomId, currentUser, db]);

  const handleScreenShareMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setScreenShareMenuAnchor(event.currentTarget);
  };

  const handleScreenShareMenuClose = () => {
    setScreenShareMenuAnchor(null);
  };

  const toggleScreenShareVisibility = () => {
    setShowScreenShare(!showScreenShare);
    handleScreenShareMenuClose();
  };

  // Add a function to check if user is room owner
  const isRoomOwner = currentUser && room?.ownerId === currentUser.uid;

  // Add a function to check if user is a member
  const isMember = currentUser && room?.members?.some(member => 
    member.userId === currentUser.uid && (member.role === 'owner' || member.role === 'member')
  );

  // Add this function after other similar functions
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
            Created by {owner?.username || 'Anonymous'}
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

  const isOwner = room.members?.some(member => member.userId === currentUser?.uid && member.role === 'owner');
  const owner = room.members?.find(member => member.role === 'owner');

  // Update the live section in the render
  const renderVideoElements = () => {
    return (
      <Box sx={{ 
        display: 'grid',
        gridTemplateColumns: { 
          xs: '1fr', 
          md: (showScreenShare || mediaState.screenSharing) ? '1fr 1fr' : '1fr' 
        },
        gap: 2,
        width: '100%',
        minHeight: { xs: 'auto', md: '400px' }
      }}>
        {/* Only show local video if user is owner or member */}
        {isRoomOwnerOrMember && room?.isLive && (
          <Paper sx={{ 
            p: 2,
            position: 'relative',
            aspectRatio: '16/9',
            bgcolor: 'background.paper',
            overflow: 'hidden'
          }}>
            <Typography variant="h6" sx={{ mb: 1 }}>You</Typography>
            <Box sx={{ 
              position: 'relative',
              width: '100%',
              height: '100%',
              borderRadius: 1,
              overflow: 'hidden',
              bgcolor: 'black'
            }}>
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain'
                }}
              />
            </Box>
          </Paper>
        )}

        {/* Only show screen share if user is owner/member or if owner/member is sharing */}
        {room?.isLive && (showScreenShare || mediaState.screenSharing) && (
          isRoomOwnerOrMember || (screenShareOwnerId && room.members?.some(member => member.userId === screenShareOwnerId))
        ) && (
          <Paper sx={{ 
            p: 2,
            position: 'relative',
            aspectRatio: '16/9',
            bgcolor: 'background.paper',
            overflow: 'hidden'
          }}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              mb: 1
            }}>
              <Typography variant="h6">Screen Share</Typography>
              {isRoomOwnerOrMember && (
                <IconButton
                  size="small"
                  onClick={handleScreenShareMenuClick}
                  aria-label="screen share options"
                >
                  <MoreVert />
                </IconButton>
              )}
            </Box>
            <Box sx={{ 
              position: 'relative',
              width: '100%',
              height: '100%',
              borderRadius: 1,
              overflow: 'hidden',
              bgcolor: 'black'
            }}>
              <video
                ref={screenShareRef}
                autoPlay
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain'
                }}
              />
            </Box>
          </Paper>
        )}

        {/* Show remote videos from room owner and members */}
        {room?.isLive && Object.entries(remoteStreams).map(([userId, stream]) => {
          const member = room.members?.find(m => m.userId === userId);
          // Only show streams from room owner and members
          if (!member) return null;
          
          return (
            <Paper key={userId} sx={{ 
              p: 2,
              position: 'relative',
              aspectRatio: '16/9',
              bgcolor: 'background.paper',
              overflow: 'hidden'
            }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {member.username} {member.role === 'owner' && '(Owner)'}
              </Typography>
              <Box sx={{ 
                position: 'relative',
                width: '100%',
                height: '100%',
                borderRadius: 1,
                overflow: 'hidden',
                bgcolor: 'black'
              }}>
                <video
                  ref={el => videoRefs.current[userId] = el}
                  autoPlay
                  playsInline
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                  }}
                />
              </Box>
            </Paper>
          );
        })}
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
          {/* Media Controls - Only visible to owner and members */}
          {isRoomOwnerOrMember && room?.isLive && (
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Tooltip title={mediaState.audioEnabled ? "Mute" : "Unmute"}>
                <IconButton color={mediaState.audioEnabled ? "primary" : "error"} onClick={toggleAudio}>
                  {mediaState.audioEnabled ? <Mic /> : <MicOff />}
                </IconButton>
              </Tooltip>
              <AudioIndicator />
              <Tooltip title={mediaState.videoEnabled ? "Turn off camera" : "Turn on camera"}>
                <IconButton color={mediaState.videoEnabled ? "primary" : "error"} onClick={toggleVideo}>
                  {mediaState.videoEnabled ? <Videocam /> : <VideocamOff />}
                </IconButton>
              </Tooltip>
              <Tooltip title={mediaState.screenSharing ? "Stop sharing" : "Share screen"}>
                <IconButton color={mediaState.screenSharing ? "primary" : "default"} onClick={toggleScreenShare}>
                  {mediaState.screenSharing ? <StopScreenShare /> : <ScreenShare />}
                </IconButton>
              </Tooltip>
            </Box>
          )}

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

      {/* Screen Share Menu */}
      <Menu
        anchorEl={screenShareMenuAnchor}
        open={Boolean(screenShareMenuAnchor)}
        onClose={handleScreenShareMenuClose}
      >
        <MenuItem onClick={toggleScreenShareVisibility}>
          {showScreenShare ? 'Hide Screen Share' : 'Show Screen Share'}
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default SideRoomComponent; 