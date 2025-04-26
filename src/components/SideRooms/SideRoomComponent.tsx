import React, { useState, useEffect, useRef, useMemo, useCallback, ChangeEvent } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase'; // Assuming firebase services are setup
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
    increment,
    FieldValue, // Ensure FieldValue is imported
    Timestamp,
    setDoc,
    startAfter,
    QueryDocumentSnapshot
} from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import {
    Box, Typography, Button, Avatar, Chip, CircularProgress, Dialog,
    DialogTitle, DialogContent, DialogActions, TextField, Alert, IconButton,
    Tooltip, Divider, List, ListItem, ListItemAvatar, ListItemText, Paper,
    Menu, MenuItem, ListItemIcon, InputAdornment, Grid, ListItemSecondaryAction
    // Removed unused MUI imports like InputBase, Switch, Autocomplete, Slider, etc. if not needed
} from '@mui/material';
import {
    ExitToApp, Lock, Group, MoreVert, Send, Edit, Delete, PersonAdd,
    Search, Close, Palette, Upload as UploadIcon, Image as ImageIcon,
    ContentCopy, Share as ShareIcon, Mic, MicOff, VolumeUp, PersonRemove
} from '@mui/icons-material';
import type { SideRoom as BaseSideRoom, RoomMember, RoomStyle } from '../../types/index'; // Import base type and RoomStyle
import RoomForm from './RoomForm';
import _ from 'lodash';
import AgoraRTC, { IAgoraRTCClient, ILocalAudioTrack } from 'agora-rtc-sdk-ng';

// Configuration for STUN servers (Public Google servers)
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // Add TURN servers here if needed for NAT traversal issues
    ],
};

// --- Interfaces ---
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
    lastSeen: number | Timestamp | FieldValue;
    isOnline: boolean;
    isMuted?: boolean;
    isSpeaking?: boolean;
    displayName?: string;
    photoURL?: string;
    role?: 'owner' | 'viewer';
}

// Extend base SideRoom type if needed, ensure it matches type/index
interface SideRoom extends BaseSideRoom {
    style?: RoomStyle;
    viewers?: RoomMember[];
    activeSpeakers?: string[];
    mutedUsers?: Record<string, boolean>;
    // isLive should be defined in BaseSideRoom
}

interface SignalingMessage {
    type: 'offer' | 'answer' | 'candidate';
    senderId: string;
    data: any; // SDP or ICE candidate
    timestamp?: FieldValue; // Optional as we add it on send
}

const APP_ID = 'eb21ad9cb5574991af1e8ba5dc712fb8'; // Your Agora App ID

const SideRoomComponent: React.FC = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const { currentUser, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    // --- State ---
    const [room, setRoom] = useState<SideRoom | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);
    const [password, setPassword] = useState('');
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showInviteDialog, setShowInviteDialog] = useState(false);
    const [showStyleDialog, setShowStyleDialog] = useState(false);
    const [showShareDialog, setShowShareDialog] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [presence, setPresence] = useState<PresenceData[]>([]);
    const [roomStyle, setRoomStyle] = useState<RoomStyle | undefined>(undefined);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
    const [isInviting, setIsInviting] = useState(false);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [isAudioConnected, setIsAudioConnected] = useState(false);
    const [isMicMuted, setIsMicMuted] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isMicAvailable, setIsMicAvailable] = useState(true);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const agoraClient = useRef<IAgoraRTCClient>(AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }));
    const [joined, setJoined] = useState(false);
    const [localAudioTrack, setLocalAudioTrack] = useState<ILocalAudioTrack | null>(null);
    const [remoteUsers, setRemoteUsers] = useState<any[]>([]);

    // --- Refs ---
    const mountedRef = useRef(true);
    const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
    const signalingListeners = useRef<(() => void)[]>([]);
    const remoteAudioRefs = useRef<Record<string, HTMLAudioElement>>({});

    // --- Memos ---
    const isRoomOwner = useMemo(() => room?.ownerId === currentUser?.uid, [room?.ownerId, currentUser?.uid]);
    const isViewer = useMemo(() => !!room?.viewers?.some(viewer => viewer.userId === currentUser?.uid), [room?.viewers, currentUser?.uid]);
    const hasRoomAccess = isRoomOwner || isViewer;
    const onlineParticipants = useMemo(() => presence.filter(p => p.isOnline), [presence]);
    const ownerData = useMemo(() => room?.viewers?.find(v => v.role === 'owner'), [room?.viewers]);

    // --- Utility ---
    const handleError = useCallback((err: unknown, context: string) => {
        console.error(`Error (${context}):`, err);
        const message = err instanceof Error ? err.message : `An unknown error occurred during ${context}.`;
        if (mountedRef.current) {
            setError(message);
            toast.error(`Error: ${message}`); // Provide slightly more context in toast
        }
    }, []);

    // --- Presence Update ---
    const updatePresence = useCallback(_.debounce(async () => {
        if (!currentUser?.uid || !roomId || !mountedRef.current) return;
        try {
            const presenceRef = doc(db, 'sideRooms', roomId, 'presence', currentUser.uid);
            const presenceData: Partial<PresenceData> = {
                userId: currentUser.uid,
                username: currentUser.displayName || currentUser.email?.split('@')[0] || '',
                avatar: currentUser.photoURL || '',
                displayName: currentUser.displayName || currentUser.email?.split('@')[0] || '',
                lastSeen: Date.now(),
                isOnline: true,
                role: isRoomOwner ? 'owner' : 'viewer',
                isMuted: isMicMuted,
                isSpeaking: isSpeaking // Add local speaking state
            };
            await setDoc(presenceRef, { ...presenceData, lastSeen: serverTimestamp() }, { merge: true });
        } catch (err) { console.error('Presence update failed:', err); }
    }, 2000), [currentUser?.uid, currentUser?.displayName, currentUser?.email, currentUser?.photoURL, roomId, isRoomOwner, isMicMuted, isSpeaking]); // More specific dependencies

    // --- Signaling ---
    const sendSignalingMessage = useCallback(async (recipientId: string, messageData: Omit<SignalingMessage, 'timestamp'>) => {
        if (!roomId || !currentUser?.uid) return;
        console.log(`Sending ${messageData.type} from ${currentUser.uid} to ${recipientId}`);
        try {
            // Corrected path: Add messages to a subcollection under the recipient's ID
            const messagesPath = `sideRooms/${roomId}/signaling/${recipientId}/messages`;
            const messagesCollectionRef = collection(db, messagesPath);
            await addDoc(messagesCollectionRef, {
                ...messageData,
                timestamp: serverTimestamp()
            });
        } catch (err) {
            handleError(err, `sending ${messageData.type} to ${recipientId}`);
        }
    }, [roomId, currentUser?.uid, handleError]);

    // --- WebRTC Core ---
    const closePeerConnection = useCallback((peerId: string) => {
        console.log(`Closing peer connection and cleaning up for ${peerId}`);
         const pc = peerConnections.current[peerId];
         if (pc) {
             pc.onicecandidate = null;
             pc.ontrack = null;
             pc.onconnectionstatechange = null;
             pc.close();
             delete peerConnections.current[peerId];
         }
         const audioEl = remoteAudioRefs.current[peerId];
         if (audioEl) {
             audioEl.remove();
             delete remoteAudioRefs.current[peerId];
         }
     }, []);

    const createPeerConnection = useCallback((peerId: string): RTCPeerConnection | null => {
        if (!localStream || !currentUser?.uid || !roomId) return null;
        if (peerConnections.current[peerId]) return peerConnections.current[peerId];
        console.log(`Creating peer connection for ${peerId}`);

        const pc = new RTCPeerConnection(iceServers);

        // Always add local audio track if not already present
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0 && !pc.getSenders().some(s => s.track && s.track.id === audioTracks[0].id)) {
            console.log(`Adding local audio track to peer connection: ${audioTracks[0].id}`);
            pc.addTrack(audioTracks[0], localStream);
        }

        pc.onicecandidate = (event) => {
            if (event.candidate && currentUser?.uid) {
                console.log(`[WebRTC ${peerId}] Generated ICE candidate`);
                sendSignalingMessage(peerId, {
                    type: 'candidate',
                    senderId: currentUser.uid,
                    data: event.candidate.toJSON(),
                });
            }
        };

        pc.ontrack = (event) => {
            console.log(`[WebRTC ${peerId}] Received remote track`);
            if (event.streams && event.streams[0]) {
                const remoteStream = event.streams[0];
                let audioEl = remoteAudioRefs.current[peerId];
                if (!audioEl) {
                    audioEl = document.createElement('audio');
                    audioEl.id = `remote-audio-${peerId}`;
                    audioEl.autoplay = true;
                    audioEl.controls = false;
                    audioEl.style.display = 'none'; // Hide but keep in DOM
                    remoteAudioRefs.current[peerId] = audioEl;
                    document.getElementById('remote-audio-container')?.appendChild(audioEl);
                }
                audioEl.srcObject = remoteStream;
                // Ensure audio can play (handle autoplay policies)
                audioEl.play().catch(err => {
                    console.warn('Remote audio play() failed:', err);
                });
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`[WebRTC ${peerId}] Connection state: ${pc.connectionState}`);
            if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
                closePeerConnection(peerId);
            }
        };

        peerConnections.current[peerId] = pc;
        return pc;
    }, [localStream, currentUser?.uid, roomId, sendSignalingMessage, closePeerConnection]);

    const handleOffer = useCallback(async (offerData: SignalingMessage) => {
        const { senderId, data: offer } = offerData;
        if (!currentUser?.uid || !localStream) {
             console.warn(`[WebRTC ${senderId}] handleOffer called but currentUser or localStream is missing.`);
             return;
        }
        console.log(`[WebRTC ${senderId}] Received offer:`, offer);
        const pc = createPeerConnection(senderId);
        if (!pc) return;
        // Ensure local audio track is added to the peer connection
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0 && !pc.getSenders().some(s => s.track && s.track.id === audioTracks[0].id)) {
            pc.addTrack(audioTracks[0], localStream);
        }
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            console.log(`[WebRTC ${senderId}] Set remote description (offer). Creating answer...`);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            console.log(`[WebRTC ${senderId}] Set local description (answer). Sending answer:`, answer);
            await sendSignalingMessage(senderId, { type: 'answer', senderId: currentUser.uid, data: answer });
        } catch (err) { handleError(err, `handling offer from ${senderId}`); }
    }, [createPeerConnection, sendSignalingMessage, currentUser, handleError, localStream]);

    const handleAnswer = useCallback(async (answerData: SignalingMessage) => {
        const { senderId, data: answer } = answerData;
        console.log(`[WebRTC ${senderId}] Received answer:`, answer);
        const pc = peerConnections.current[senderId];
        if (pc && pc.signalingState === 'have-local-offer') {
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
                console.log(`[WebRTC ${senderId}] Set remote description (answer).`);
            }
            catch (err) { handleError(err, `setting answer from ${senderId}`); }
        } else { console.warn(`[WebRTC ${senderId}] Received answer in unexpected state: ${pc?.signalingState}`); }
    }, [handleError]);

    const handleCandidate = useCallback(async (candidateData: SignalingMessage) => {
        const { senderId, data: candidateJson } = candidateData;
        const pc = peerConnections.current[senderId];
        console.log(`[WebRTC ${senderId}] Received ICE candidate:`, candidateJson);
        if (pc) {
            try {
                const candidate = new RTCIceCandidate(candidateJson);
                if (pc.remoteDescription) {
                    await pc.addIceCandidate(candidate);
                    console.log(`[WebRTC ${senderId}] Added ICE candidate.`);
                }
                 else {
                     console.warn(`[WebRTC ${senderId}] ICE candidate arrived before remote description set. Queueing/Ignoring for now.`);
                      // TODO: Consider implementing a queue for candidates here
                 }
            } catch (err) {
                 // Ignore common harmless errors, log others
                 if (!`${err}`.includes("remote description is not set") && !`${err}`.includes("Error processing ICE candidate")) {
                    handleError(err, `adding ICE candidate from ${senderId}`);
                 }
            }
        } else { console.warn(`[WebRTC ${senderId}] Received candidate, but no PeerConnection found.`); }
    }, [handleError]);

    // --- Signaling Listener ---
    const setupSignalingListener = useCallback(() => {
        if (!roomId || !currentUser?.uid || signalingListeners.current.length > 0) return;
        console.log(`Setting up signaling listener for user ${currentUser.uid}`);
        // Corrected path: Listen to the messages subcollection under the current user's ID
        const messagesPath = `sideRooms/${roomId}/signaling/${currentUser.uid}/messages`;
        const userMessagesCollectionRef = collection(db, messagesPath);
        const q = query(userMessagesCollectionRef, orderBy('timestamp', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    // Ensure data exists before spreading
                    const data = change.doc.data();
                    if (!data) return;

                    const message = { id: change.doc.id, ...data } as SignalingMessage & { id: string };
                    const messageDocPath = `sideRooms/${roomId}/signaling/${currentUser.uid!}/messages/${message.id}`; // Corrected path for deletion

                    try {
                         if (message.type === 'offer') await handleOffer(message);
                         else if (message.type === 'answer') await handleAnswer(message);
                         else if (message.type === 'candidate') await handleCandidate(message);
                         else console.warn("Unknown signaling message type:", message.type);
                         // Delete the processed message from the correct path
                         await deleteDoc(doc(db, messageDocPath));
                    } catch (err) {
                         handleError(err, `processing ${message.type} from ${message.senderId}`);
                         // Attempt to delete even if processing failed, using the correct path
                         await deleteDoc(doc(db, messageDocPath)).catch(delErr => console.error("Failed to delete message after error:", delErr));
                    }
                }
            });
        }, (err) => handleError(err, "listening to signaling"));
        signalingListeners.current.push(unsubscribe);
    }, [roomId, currentUser?.uid, handleError, handleOffer, handleAnswer, handleCandidate]); // Added handlers

    const cleanupSignaling = useCallback(() => {
        console.log("Cleaning up signaling listeners...");
        signalingListeners.current.forEach(unsubscribe => unsubscribe());
        signalingListeners.current = [];
    }, []);

    // Constants for audio analysis
    const SPEAKING_THRESHOLD = 0.03; // Adjust based on testing
    const DEBOUNCE_DELAY_MS = 300; // Prevents rapid toggling

    // Setup audio analysis when stream is available
    useEffect(() => {
      if (!localStream) return;

      const setupAudioAnalysis = () => {
        try {
          // Create audio context if not exists
          if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }

          // Create analyser node
          const analyser = audioContextRef.current.createAnalyser();
          analyser.fftSize = 32;
          analyserRef.current = analyser;

          // Connect stream to analyser
          const source = audioContextRef.current.createMediaStreamSource(localStream);
          source.connect(analyser);

          // Start analysis loop
          analyzeAudio();
        } catch (err) {
          console.error('Audio analysis setup failed:', err);
        }
      };

      setupAudioAnalysis();

      return () => {
        // Cleanup
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (speakingTimeoutRef.current) {
          clearTimeout(speakingTimeoutRef.current);
        }
      };
    }, [localStream]);

    const analyzeAudio = () => {
      if (!analyserRef.current) return;

      const analyser = analyserRef.current;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length / 255; // Normalize to 0-1

      // Detect speaking with debouncing
      const currentlySpeaking = average > SPEAKING_THRESHOLD;
      
      if (currentlySpeaking !== isSpeaking) {
        if (speakingTimeoutRef.current) {
          clearTimeout(speakingTimeoutRef.current);
        }

        speakingTimeoutRef.current = setTimeout(() => {
          setIsSpeaking(currentlySpeaking);
          updatePresence(); // Update presence with new speaking state
        }, DEBOUNCE_DELAY_MS);
      }

      // Continue analysis loop
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    };

    // Microphone connection detection
    useEffect(() => {
        let isMounted = true;
        
        async function checkMic() {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const hasMic = devices.some(device => device.kind === 'audioinput');
                if (isMounted) setIsMicAvailable(hasMic);
            } catch (err) {
                if (isMounted) setIsMicAvailable(false);
            }
        }
        
        checkMic();
        navigator.mediaDevices.addEventListener('devicechange', checkMic);
        
        return () => {
            isMounted = false;
            navigator.mediaDevices.removeEventListener('devicechange', checkMic);
        };
    }, []);

    // --- Add Placeholder Functions ---
    const handleAdminMuteUser = useCallback((userId: string) => {
        console.log("Admin mute/unmute user:", userId);
        // TODO: Implement admin mute logic (e.g., send command via Firestore)
        toast("Admin mute functionality not yet implemented.");
    }, []);

    const handleAdminRemoveUser = useCallback((participant: PresenceData) => {
        console.log("Admin remove user:", participant.userId);
        // TODO: Implement admin remove logic (e.g., update room members in Firestore)
        toast("Admin remove functionality not yet implemented.");
    }, []);

    const handleShareRoom = useCallback(() => {
        console.log("Share room clicked");
        setShowShareDialog(true); // Assuming this state exists for the dialog
    }, []);

    const handleMenuClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    }, []);

    const handleMenuClose = useCallback(() => {
        setAnchorEl(null);
    }, []);

    const handleEditRoom = useCallback(() => {
        console.log("Edit room clicked");
        setShowEditDialog(true);
        handleMenuClose(); // Close menu after action
    }, [handleMenuClose]); // Added handleMenuClose dependency

    const handleStyleRoom = useCallback(() => {
        console.log("Style room clicked");
        setShowStyleDialog(true);
        handleMenuClose(); // Close menu after action
    }, [handleMenuClose]); // Added handleMenuClose dependency

    const handleInviteMembers = useCallback(() => {
        console.log("Invite members clicked");
        setShowInviteDialog(true);
        handleMenuClose(); // Close menu after action
    }, [handleMenuClose]); // Added handleMenuClose dependency

    const handleDeleteRoom = useCallback(async () => {
        console.log("Delete room clicked");
        handleMenuClose(); // Close menu first
        if (!roomId || !isRoomOwner) return;
        if (window.confirm('Are you sure you want to delete this room permanently? This cannot be undone.')) {
            setIsProcessing(true);
            try {
                // TODO: Consider more robust cleanup (e.g., delete subcollections like presence, signaling)
                await deleteDoc(doc(db, 'sideRooms', roomId));
                toast.success('Room deleted successfully');
                navigate('/side-rooms'); // Navigate away after deletion
            } catch (err) {
                handleError(err, 'deleting room');
                setIsProcessing(false);
            }
            // No finally block needed to set isProcessing false if navigating away
        }
    }, [roomId, isRoomOwner, navigate, handleError, handleMenuClose]); // Added handleMenuClose dependency

    const handleSearchUsers = useCallback(_.debounce(async (searchQueryParam: string) => {
        if (!searchQueryParam.trim()) {
            setSearchResults([]);
            return;
        }
        console.log("Searching users:", searchQueryParam);
        try {
            const usersRef = collection(db, 'users');
            const firestoreQuery = query(usersRef, where('username', '>=', searchQueryParam), where('username', '<=', searchQueryParam + '\uf8ff'), limit(10));
            const querySnapshot = await getDocs(firestoreQuery);
            const users = querySnapshot.docs
                .map(doc => {
                    const data = doc.data();
                    return data ? { id: doc.id, ...data } as User : null;
                })
                .filter((user): user is User => user !== null);

            setSearchResults(users.filter(u => u.id !== currentUser?.uid));
        } catch (err) {
            handleError(err, `searching users for query: ${searchQueryParam}`);
            setSearchResults([]);
        }
    }, 300), [currentUser?.uid, handleError]);

    const handleInviteSubmit = useCallback(async () => {
        if (!roomId || !selectedUsers.length || isInviting) return;
        console.log("Submitting invites for users:", selectedUsers.map(u => u.id));
        setIsInviting(true);
        try {
            const roomRef = doc(db, 'sideRooms', roomId);
            const batch = writeBatch(db);
            selectedUsers.forEach(user => {
                const viewerData: RoomMember = {
                    userId: user.id,
                    username: user.username,
                    avatar: user.avatar || '',
                    joinedAt: serverTimestamp(),
                    role: 'viewer'
                };
                batch.update(roomRef, { viewers: arrayUnion(viewerData) });
                // TODO: Optionally send a notification to the invited users
            });
            await batch.commit();
            toast.success(`Invited ${selectedUsers.length} user(s).`);
            setSelectedUsers([]);
            setShowInviteDialog(false);
        } catch (err) {
            handleError(err, 'submitting invites');
        } finally {
            setIsInviting(false);
        }
    }, [roomId, selectedUsers, isInviting, handleError]); // Added dependencies

    const handleEditSubmit = useCallback(async (updatedData: Partial<SideRoom>) => {
        if (!roomId || !isRoomOwner) return;
        console.log("Submitting room edits:", updatedData);
        setIsProcessing(true);
        try {
            const roomRef = doc(db, 'sideRooms', roomId);
            await updateDoc(roomRef, updatedData);
            toast.success('Room updated successfully');
            setShowEditDialog(false);
        } catch (err) {
            handleError(err, 'submitting room edits');
        } finally {
            if (mountedRef.current) { // Check mount status
                 setIsProcessing(false);
            }
        }
    }, [roomId, isRoomOwner, handleError]); // Added dependencies

    // First declare all functions before they're used
    const handleJoinAudio = useCallback(async () => {
        if (isProcessing || !currentUser?.uid) return;
        setIsProcessing(true);
        
        try {
            // Request microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: true,
                video: false 
            });
            
            // Setup audio analysis
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            
            // Update state
            setLocalStream(stream);
            setIsAudioConnected(true);
            setIsMicMuted(false);
            
            // Start analysis loop
            const checkSpeaking = () => {
                const data = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(data);
                const isSpeaking = data.some(level => level > 30); // Volume threshold
                setIsSpeaking(isSpeaking);
                requestAnimationFrame(checkSpeaking);
            };
            checkSpeaking();
            
        } catch (err) {
            console.error('Microphone access failed:', err);
            toast.error('Could not access microphone');
        } finally {
            setIsProcessing(false);
        }
    }, [currentUser?.uid, isProcessing]);
    
    const handleLeaveAudio = useCallback(async () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }
        setIsAudioConnected(false);
        setIsSpeaking(false);
    }, [localStream]);

    const handleToggleMute = useCallback(() => {
        console.log("Toggling mute...");
        setIsMicMuted(!isMicMuted);
        // Implementation goes here
    }, [isMicMuted]);

    const handlePasswordSubmit = useCallback(() => {
        console.log("Password submit clicked");
        // Password validation and room joining logic
    }, []);

    const handleLeaveRoom = useCallback(async () => {
        console.log("Leaving room...");
        // Room leaving logic including audio cleanup
    }, []);

    // --- Data Listeners ---
    useEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
        // Only call handleLeaveAudio if audio is connected
        if (isAudioConnected) {
          handleLeaveAudio();
        }
      };
    }, [handleLeaveAudio, isAudioConnected]);

    // useEffect(() => { /* Room Listener - remains the same */ }, [/* ... */]); // Commented out placeholder

    // --- Initial Room Data Fetching Effect ---
    useEffect(() => {
        if (!roomId || !currentUser || authLoading) {
            // Don't fetch if missing prerequisites or auth is still loading
            if (!authLoading) { // If auth is done but missing roomId/currentUser
                setLoading(false); // Stop loading if we can't proceed
                setError("Cannot load room: Missing room ID or user information.");
            }
            return; // Exit early
        }

        setLoading(true); // Start loading process for this room
        setError(null); // Clear previous errors

        const roomRef = doc(db, 'sideRooms', roomId);

        const unsubscribe = onSnapshot(roomRef, (docSnapshot) => {
            if (!mountedRef.current) return; // Check if component is still mounted

            if (docSnapshot.exists()) {
                const roomData = { id: docSnapshot.id, ...docSnapshot.data() } as SideRoom;
                setRoom(roomData);
                setRoomStyle(roomData.style); // Update style state

                // Determine access rights immediately based on fetched data
                const isOwner = roomData.ownerId === currentUser.uid;
                // Ensure viewers array exists before checking
                const isViewer = roomData.viewers?.some(v => v.userId === currentUser.uid) ?? false;
                const isPrivate = roomData.isPrivate ?? false; // Default to false if undefined

                if (isPrivate && !isOwner && !isViewer) {
                    // Room is private, user doesn't have access yet -> show password dialog
                    setShowPasswordDialog(true);
                    setLoading(false); // Stop loading, wait for password input
                } else {
                    // Room is public or user already has access -> show room content
                    setShowPasswordDialog(false); // Ensure password dialog is hidden
                    setLoading(false); // Stop loading, display room content
                }
            } else {
                // Room not found
                setError(`Room with ID "${roomId}" not found.`);
                setRoom(null);
                setLoading(false); // Stop loading
                 // Optional: Consider navigating back to the list
                 // navigate('/side-rooms');
            }
        }, (err) => {
            // Error fetching room
            if (mountedRef.current) {
                handleError(err, "fetching room data");
                setRoom(null);
                setLoading(false); // Stop loading on error
            }
        });

        // Cleanup function for the listener
        return () => {
            unsubscribe();
        };

    }, [roomId, currentUser, authLoading, navigate, handleError]); // Added dependencies

    useEffect(() => { // Presence Listener - Modified for WebRTC join/leave
        if (!roomId || !hasRoomAccess) return;
        const presenceRef = collection(db, 'sideRooms', roomId, 'presence');
        const q = query(presenceRef, where("isOnline", "==", true));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!mountedRef.current || !currentUser?.uid) return; // Don't process if unmounted or no user

            const currentOnlineUsersMap = new Map<string, PresenceData>();
             snapshot.docs.forEach(doc => { currentOnlineUsersMap.set(doc.id, { userId: doc.id, ...doc.data() } as PresenceData); });
             const currentOnlineUserIds = Array.from(currentOnlineUsersMap.keys());
             const existingPeerIds = Object.keys(peerConnections.current);

             // Only process joins/leaves if WE are connected to audio
             if (isAudioConnected) {
                 // Connect to New Users
                 currentOnlineUserIds.forEach(async userId => { // Made async
                     if (userId !== currentUser.uid && !peerConnections.current[userId]) {
                         console.log(`Presence: New user ${userId}. Initiating connection.`);
                         const pc = createPeerConnection(userId);
                          if (pc) {
                               try {
                                   const offer = await pc.createOffer();
                                   console.log(`[WebRTC ${userId}] Creating offer for new user via presence:`, offer);
                                   await pc.setLocalDescription(offer);
                                   console.log(`[WebRTC ${userId}] Set local description (offer). Sending offer to new user.`);
                                   await sendSignalingMessage(userId, { type: 'offer', senderId: currentUser.uid, data: offer });
                               } catch (err) {
                                   handleError(err, `offer to new user ${userId}`);
                               }
                          }
                     }
                 });
                 // Disconnect Leavers
                  existingPeerIds.forEach(peerId => {
                      if (peerId !== currentUser.uid && !currentOnlineUsersMap.has(peerId)) {
                          console.log(`Presence: User ${peerId} left. Closing connection.`);
                          closePeerConnection(peerId);
                      }
                  });
             }

            setPresence(Array.from(currentOnlineUsersMap.values()));
            updatePresence();

        }, (err) => handleError(err, "listening to presence"));

        if (hasRoomAccess) updatePresence();
        const handleVisibilityChange = () => { /* ... set offline/online ... */ };
        const handleBeforeUnload = () => { /* ... set offline ... */ };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            unsubscribe();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
             // Set self offline and close connections on unmount
            if (currentUser?.uid) setDoc(doc(db, 'sideRooms', roomId!, 'presence', currentUser.uid), { isOnline: false, lastSeen: serverTimestamp() }, { merge: true }).catch();
            Object.keys(peerConnections.current).forEach(peerId => closePeerConnection(peerId));
        };
    }, [
        roomId, hasRoomAccess, currentUser?.uid, isAudioConnected, // Added isAudioConnected
        updatePresence, handleError, createPeerConnection, closePeerConnection, sendSignalingMessage
    ]);

    // --- Other Room Actions ---
    // ... (handleJoinRoom, handlePasswordSubmit, handleLeaveRoom, handleMenu, etc.) ...

    // --- Render Functions ---
    const ParticipantGridItem: React.FC<{ participant: PresenceData }> = ({ participant }) => {
        return (
            <Grid item xs={6} sm={4} md={3} lg={2} key={participant.userId}>
                <Paper 
                    elevation={participant.isSpeaking ? 4 : 1} 
                    sx={{ 
                        p: 1, 
                        textAlign: 'center', 
                        position: 'relative',
                        overflow: 'hidden',
                        bgcolor: participant.isSpeaking ? 'primary.light' : 'background.paper',
                        transition: 'all 0.3s ease-in-out',
                        transform: participant.isSpeaking ? 'scale(1.05)' : 'scale(1)'
                    }}
                >
                    <Avatar 
                        src={participant.avatar} 
                        alt={participant.displayName} 
                        sx={{ 
                            width: 60, 
                            height: 60, 
                            margin: 'auto', 
                            mb: 1,
                            border: participant.isSpeaking ? '3px solid' : 'none',
                            borderColor: 'primary.main',
                            boxShadow: participant.isSpeaking ? '0 0 10px rgba(0,0,0,0.2)' : 'none'
                        }} 
                    />
                    <Typography variant="caption" display="block" noWrap sx={{ fontWeight: 500 }}>
                        {participant.displayName || participant.username}
                    </Typography>
                    {participant.isMuted && (
                        <MicOff 
                            fontSize="small" 
                            sx={{ 
                                position: 'absolute', 
                                top: 4, 
                                right: 4, 
                                color: 'text.secondary',
                                bgcolor: 'rgba(255,255,255,0.7)',
                                borderRadius: '50%',
                                p: 0.2
                            }} 
                        />
                    )}
                    {participant.role === 'owner' && (
                        <Chip 
                            label="Host" 
                            size="small" 
                            color="primary" 
                            sx={{ 
                                position: 'absolute', 
                                top: 4, 
                                left: 4, 
                                height: 18,
                                fontSize: '0.65rem'
                            }}
                        />
                    )}
                    {isRoomOwner && participant.userId !== currentUser?.uid && (
                        <Box sx={{ position: 'absolute', bottom: 2, right: 2, display: 'flex', gap: 0.5 }}>
                            <Tooltip title={participant.isMuted ? "Request Unmute" : "Mute User"}>
                                <IconButton 
                                    size="small" 
                                    onClick={() => handleAdminMuteUser(participant.userId)}
                                >
                                    {participant.isMuted ? <Mic fontSize='inherit'/> : <MicOff fontSize='inherit'/>}
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Remove User">
                                <IconButton 
                                    size="small" 
                                    color="error" 
                                    onClick={() => handleAdminRemoveUser(participant)}
                                >
                                    <PersonRemove fontSize='inherit'/>
                                </IconButton>
                            </Tooltip>
                        </Box>
                    )}
                </Paper>
            </Grid>
        );
    };


    const renderAudioRoomContent = () => (
        <Box sx={{ flexGrow: 1, p: 2, overflowY: 'auto' }}>
          <Typography variant="h6" gutterBottom>Participants ({onlineParticipants.length})</Typography>
          <Grid container spacing={2}>
            {currentUser && isAudioConnected && (
              <ParticipantGridItem participant={{
                userId: currentUser.uid,
                avatar: currentUser.photoURL || '',
                displayName: currentUser.displayName || 'You',
                username: currentUser.displayName || 'You',
                isMuted: isMicMuted,
                isOnline: true,
                role: isRoomOwner ? 'owner' : 'viewer',
                lastSeen: Date.now(),
                isSpeaking: isSpeaking // Add local speaking state
              }} />
            )}
            {onlineParticipants.filter(p => p.userId !== currentUser?.uid).map((participant) => (
                <ParticipantGridItem key={participant.userId} participant={participant} />
            ))}
          </Grid>
          {!isAudioConnected && hasRoomAccess && !loading && room && ( <Alert severity="info" sx={{ mt: 2 }}> Join the audio to start talking or listening. </Alert> )}
        </Box>
    );

    const renderRoomHeader = () => (
        <Box sx={{ p: { xs: 1, sm: 1.5 }, borderBottom: 1, borderColor: 'divider', background: roomStyle?.headerGradient ? roomStyle?.headerColor : roomStyle?.headerColor, color: roomStyle?.textColor || 'text.primary' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Box sx={{ overflow: 'hidden', mr: 1 }}>
                   <Typography noWrap variant="h6" component="h1" sx={{ fontFamily: roomStyle?.font, fontSize: '1.1rem', fontWeight: 'bold' }}>{room?.name}</Typography>
                   {ownerData && <Typography noWrap variant="caption" sx={{ opacity: 0.8 }}>Host: {ownerData.username}</Typography>}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                     <Tooltip title="Share"><IconButton size="small" sx={{ color: 'inherit' }} onClick={handleShareRoom}><ShareIcon fontSize="inherit"/></IconButton></Tooltip>
                     {isRoomOwner && (
                         <>
                             <Tooltip title="Settings"><IconButton size="small" sx={{ color: 'inherit' }} onClick={handleMenuClick}><MoreVert fontSize="inherit"/></IconButton></Tooltip>
                             <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
                                  <MenuItem onClick={handleEditRoom}><ListItemIcon><Edit fontSize="small" /></ListItemIcon>Edit Room</MenuItem>
                                  <MenuItem onClick={handleStyleRoom}><ListItemIcon><Palette fontSize="small" /></ListItemIcon>Customize</MenuItem>
                                  <MenuItem onClick={handleInviteMembers}><ListItemIcon><PersonAdd fontSize="small" /></ListItemIcon>Invite</MenuItem>
                                  <MenuItem onClick={handleDeleteRoom}><ListItemIcon><Delete fontSize="small" /></ListItemIcon>Delete Room</MenuItem>
                             </Menu>
                         </>
                     )}
                     <Tooltip title="Leave"><IconButton size="small" sx={{ color: 'inherit' }} onClick={handleLeaveRoom} disabled={isProcessing}><ExitToApp fontSize="inherit"/></IconButton></Tooltip>
                </Box>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.8 }}>{onlineParticipants.length} Online</Typography>
               <Box sx={{ display: 'flex', gap: 1 }}>
                    {isAudioConnected ? (
                        <>
                            <Button variant="contained" size="small" color={isMicMuted ? "secondary" : "primary"} onClick={handleToggleMute} startIcon={isMicMuted ? <MicOff /> : <Mic />} sx={{ fontSize: '0.75rem', px: 1.5 }} disabled={isProcessing}>{isMicMuted ? 'Unmute' : 'Mute'}</Button>
                            <Button variant="outlined" size="small" color="error" onClick={handleLeaveAudio} sx={{ fontSize: '0.75rem', px: 1.5 }} disabled={isProcessing}>Leave Audio</Button>
                        </>
                    ) : (
                        <Button variant="contained" size="small" color="success" onClick={handleJoinAudio} startIcon={<VolumeUp />} disabled={!hasRoomAccess || isProcessing || !isMicAvailable} sx={{ fontSize: '0.75rem', px: 1.5 }}>Join Audio</Button>
                    )}
                </Box>
            </Box>
        </Box>
    );

     const renderInviteDialog = () => (
         <Dialog open={showInviteDialog} onClose={() => setShowInviteDialog(false)} maxWidth="xs" fullWidth>
             <DialogTitle>Invite Users</DialogTitle>
             <DialogContent>
                 <TextField label="Search Users" variant="outlined" fullWidth size="small" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); handleSearchUsers(e.target.value); }} InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} sx={{ mb: 2 }}/>
                 <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>{selectedUsers.map((user) => (<Chip key={user.id} avatar={<Avatar src={user.avatar} />} label={user.username} onDelete={() => setSelectedUsers(prev => prev.filter(u => u.id !== user.id))} /> ))}</Box>
                 <List sx={{ maxHeight: 200, overflow: 'auto' }}>{searchResults.map((user) => (<ListItem key={user.id} button onClick={() => { if (!selectedUsers.some(u => u.id === user.id)) setSelectedUsers(prev => [...prev, user]); }}><ListItemAvatar><Avatar src={user.avatar} /></ListItemAvatar><ListItemText primary={user.username} /></ListItem>))}</List>
             </DialogContent>
             <DialogActions><Button onClick={() => setShowInviteDialog(false)}>Cancel</Button><Button onClick={handleInviteSubmit} disabled={isInviting || selectedUsers.length === 0} variant="contained">{isInviting ? 'Sending...' : 'Send Invites'}</Button></DialogActions>
         </Dialog>
     );

    // --- Loading & Error States ---
    if (authLoading || loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
    if (!loading && error && !room) return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert><Button onClick={() => navigate('/side-rooms')} sx={{ mt: 1 }}>Back to Rooms</Button></Box>;
    if (!room && !loading) return <Box sx={{ p: 3 }}><Alert severity="warning">Room not found or access denied.</Alert></Box>;

    // --- Main Return ---
    return (
        <>
            {/* Hidden container for remote audio elements */}
            <div id="remote-audio-container" style={{ display: 'none' }} />
            <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', flexDirection: 'column', overflow: 'hidden', bgcolor: roomStyle?.backgroundColor || 'background.default' }}>
                {renderRoomHeader()}
                <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                    {renderAudioRoomContent()}
                </Box>

                {/* Dialogs */}
                {showEditDialog && room && <RoomForm open={showEditDialog} onClose={() => setShowEditDialog(false)} onSubmit={handleEditSubmit} initialData={room ? { ...room } : undefined} title="Edit Room" submitButtonText="Save Changes" />}
                {renderInviteDialog()}
                {/* TODO: Add other Dialogs (Style, Share) back if needed */}
                <Dialog open={showPasswordDialog && !hasRoomAccess} onClose={() => !isProcessing && navigate('/side-rooms')}>
                    <DialogTitle>Enter Password</DialogTitle>
                    <DialogContent><TextField autoFocus type="password" label="Room Password" value={password} onChange={e => setPassword(e.target.value)} fullWidth /></DialogContent>
                    <DialogActions><Button onClick={() => navigate('/side-rooms')}>Cancel</Button><Button onClick={handlePasswordSubmit} variant="contained" disabled={isProcessing}>Join</Button></DialogActions>
                </Dialog>
            </Box>
        </>
    );
};

export default SideRoomComponent;