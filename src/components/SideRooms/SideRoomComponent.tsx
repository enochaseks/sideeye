import React, { useState, useEffect, useRef, useMemo, useCallback, ChangeEvent } from 'react';
import HeadsetIcon from '@mui/icons-material/Headset';
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
    Menu, MenuItem, ListItemIcon, InputAdornment, Grid, ListItemSecondaryAction,
    Select, // Added Select import
} from '@mui/material';
import {
    ExitToApp, Lock, Group, MoreVert, Send, Edit, Delete, PersonAdd,
    Search, Close, Palette, Upload as UploadIcon, Image as ImageIcon,
    ContentCopy, Share as ShareIcon, Mic, MicOff, VolumeUp, PersonRemove
} from '@mui/icons-material';
import type { SideRoom as BaseSideRoom, RoomMember, RoomStyle } from '../../types/index'; // Import base type and RoomStyle
import RoomForm from './RoomForm';
import _ from 'lodash';
import AgoraRTC, { IAgoraRTCClient, ILocalAudioTrack, IRemoteAudioTrack, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';

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

const APP_ID = 'b67cbd2d25d146c283500b20fa6b24d6'; // Your Agora App ID
const TEMP_TOKEN = '007eJxTYJiqkhTCzh1YZ3Rm+nRTC5aVh0M/bs5uecOiV6Mfu+aTbb4CQ5KZeXJSilGKkWmKoYlZspGFsamBQZKRQVqiWZKRSYpZmjJvRkMgI8Oe1q0MjFAI4nMxBGempCq4VqYqGDEwAAA9qx5e';

// Add App ID validation function
const validateAppId = (appId: string): boolean => {
    // Check if App ID is in the correct format (32 characters)
    if (appId.length !== 32) {
        console.error('Invalid App ID length. App ID should be 32 characters long.');
        return false;
    }
    
    // Check if App ID contains only hexadecimal characters
    if (!/^[0-9a-fA-F]+$/.test(appId)) {
        console.error('Invalid App ID format. App ID should contain only hexadecimal characters.');
        return false;
    }
    
    return true;
};

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
    const [isAudioConnected, setIsAudioConnected] = useState(false);
    const [isMicMuted, setIsMicMuted] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isMicAvailable, setIsMicAvailable] = useState(true);
    const [isHeadphonesConnected, setIsHeadphonesConnected] = useState(false);
    const [joined, setJoined] = useState(false);
    const [localAudioTrack, setLocalAudioTrack] = useState<ILocalAudioTrack | null>(null);
    const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
    const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
    const [showDeviceSelect, setShowDeviceSelect] = useState(false);
    const [selectedDeviceId, setSelectedDeviceId] = useState('');

    // --- Refs ---
    const agoraClient = useRef<IAgoraRTCClient | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // --- Memos ---
    const isRoomOwner = useMemo(() => room?.ownerId === currentUser?.uid, [room?.ownerId, currentUser?.uid]);
    const isViewer = useMemo(() => !!room?.viewers?.some(viewer => viewer.userId === currentUser?.uid), [room?.viewers, currentUser?.uid]);
    const hasRoomAccess = isRoomOwner || isViewer;
    const onlineParticipants = useMemo(() => presence.filter(p => p.isOnline), [presence]);
    const ownerData = useMemo(() => room?.viewers?.find(v => v.role === 'owner'), [room?.viewers]);

    // Automatically show microphone selection when headphones are detected
    useEffect(() => {
        const getAndSetDevices = async () => {
            try {
                // Request microphone access
                await navigator.mediaDevices.getUserMedia({ audio: true });
                // Fetch devices
                const devices = await navigator.mediaDevices.enumerateDevices();
                setAvailableDevices(devices.filter(device => device.kind === 'audioinput'));
            } catch (err) {
                setAvailableDevices([]);
            }
        };
        if (isHeadphonesConnected) {
            setShowDeviceSelect(true);
            getAndSetDevices();
        }
    }, [isHeadphonesConnected]);

    // Also fetch devices when dialog is manually opened
    useEffect(() => {
        const getAndSetDevices = async () => {
            try {
                await navigator.mediaDevices.getUserMedia({ audio: true });
                const devices = await navigator.mediaDevices.enumerateDevices();
                setAvailableDevices(devices.filter(device => device.kind === 'audioinput'));
            } catch (err) {
                setAvailableDevices([]);
            }
        };
        if (showDeviceSelect) {
            getAndSetDevices();
        }
    }, [showDeviceSelect]);

    // --- Utility ---
    const handleError = useCallback((err: unknown, context: string) => {
        console.error(`Error (${context}):`, err);
        const message = err instanceof Error ? err.message : `An unknown error occurred during ${context}.`;
        setError(message);
        toast.error(`Error: ${message}`);
    }, []);

    // --- Presence Update ---
    const updatePresence = useCallback(_.debounce(async () => {
        if (!currentUser?.uid || !roomId) return;
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
                isSpeaking: isSpeaking
            };
            await setDoc(presenceRef, { ...presenceData, lastSeen: serverTimestamp() }, { merge: true });
        } catch (err) {
            console.error('Presence update failed:', err);
        }
    }, 2000), [currentUser?.uid, currentUser?.displayName, currentUser?.email, currentUser?.photoURL, roomId, isRoomOwner, isMicMuted, isSpeaking]);

    // --- Agora Audio Functions ---
    const handleLeaveAudio = useCallback(async () => {
        try {
            if (localAudioTrack) {
                localAudioTrack.close();
                setLocalAudioTrack(null);
            }
            if (agoraClient.current) {
                await agoraClient.current.leave();
            }
            setRemoteUsers([]);
            setIsAudioConnected(false);
            setIsSpeaking(false);
            setJoined(false);
            console.log('Successfully left audio channel');
        } catch (error) {
            console.error('Error leaving audio:', error);
            toast.error('Failed to leave audio channel');
        }
    }, [localAudioTrack]);

    const joinVoiceChannel = useCallback(async (channelName: string, uid: string) => {
        try {
            console.log('Starting to join channel:', channelName, 'with uid:', uid);
            console.log('Using App ID:', APP_ID);
            
            // Check network connectivity
            if (!navigator.onLine) {
                throw new Error('No internet connection. Please check your network and try again.');
            }

            // Only create client if it doesn't exist
            if (!agoraClient.current) {
                console.log('Creating new Agora client');
                try {
                    // Create client with specific configuration
                    agoraClient.current = AgoraRTC.createClient({ 
                        mode: 'rtc', 
                        codec: 'vp8'
                    });

                    // Set up event listeners before joining
                    agoraClient.current.on('connection-state-change', (curState: string, prevState: string) => {
                        console.log('Connection state changed:', prevState, '->', curState);
                    });

                    agoraClient.current.on('error', (error: Error) => {
                        console.error('Agora client error:', error);
                        if (error.message.includes('CAN_NOT_GET_GATEWAY_SERVER')) {
                            console.error('Gateway server error details:', {
                                error,
                                timestamp: new Date().toISOString(),
                                userAgent: navigator.userAgent,
                                online: navigator.onLine
                            });
                        }
                    });

                    // Try to join with a simple channel name first
                    console.log('Attempting to join channel with simple configuration');
                    try {
                        await agoraClient.current.join(
                            APP_ID,
                            'test-channel', // Use a simple channel name for testing
                            TEMP_TOKEN, // Use the token here
                            uid
                        );
                        console.log('Successfully joined test channel');
                        await agoraClient.current.leave();
                        console.log('Left test channel');
                    } catch (testError) {
                        console.error('Test channel join failed:', testError);
                        if (testError instanceof Error && testError.message.includes('CAN_NOT_GET_GATEWAY_SERVER')) {
                            throw new Error('Unable to connect to Agora servers. This might be due to: 1) Project status not being active, 2) App ID not being properly configured, or 3) Network restrictions. Please check your Agora Console settings and try again.');
                        }
                        throw testError;
                    }

                    // Now try to join the actual channel
                    console.log('Attempting to join actual channel:', channelName);
                    await agoraClient.current.join(
                        APP_ID,
                        channelName,
                        TEMP_TOKEN, // Use the token here
                        uid
                    );

                    console.log('Successfully joined actual channel');
                } catch (error) {
                    console.error('Failed to create or join channel:', error);
                    if (error instanceof Error) {
                        if (error.message.includes('CAN_NOT_GET_GATEWAY_SERVER')) {
                            console.error('Gateway server error details:', {
                                error,
                                timestamp: new Date().toISOString(),
                                userAgent: navigator.userAgent,
                                online: navigator.onLine
                            });
                            throw new Error('Unable to connect to Agora servers. Please check: 1) Your Agora project status is "Active", 2) The App ID is correctly configured, 3) Your network allows connections to Agora servers.');
                        }
                    }
                    throw error;
                }
            }

            // Create and publish local audio track
            console.log('Creating local audio track');
            try {
                const localTrack = await AgoraRTC.createMicrophoneAudioTrack();
                setLocalAudioTrack(localTrack);
                
                console.log('Publishing local audio track');
                await agoraClient.current?.publish(localTrack);
                
                // Set volume and play
                localTrack.setVolume(100);
                await localTrack.play();
                
                if (isHeadphonesConnected) {
                    await localTrack.setPlaybackDevice('default');
                }
                
                setJoined(true);
                console.log('Successfully joined channel and published audio');
            } catch (error) {
                console.error('Failed to create or publish audio track:', error);
                throw new Error('Failed to setup audio. Please check your microphone permissions and try again.');
            }
        } catch (error) {
            console.error('Failed to join channel:', error);
            
            // Handle specific Agora errors
            if (error instanceof Error) {
                if (error.message.includes('CAN_NOT_GET_GATEWAY_SERVER')) {
                    throw new Error('Unable to connect to Agora servers. Please check: 1) Your Agora project status is "Active", 2) The App ID is correctly configured, 3) Your network allows connections to Agora servers.');
                } else if (error.message.includes('INVALID_APP_ID')) {
                    throw new Error('Invalid Agora App ID. Please verify your App ID in the Agora Console and ensure it is enabled for RTC functionality.');
                } else if (error.message.includes('INVALID_CHANNEL_NAME')) {
                    throw new Error('Invalid channel name. Please try again.');
                } else if (error.message.includes('NotAllowedError')) {
                    throw new Error('Microphone access was denied. Please allow microphone access and try again.');
                } else if (error.message.includes('NotFoundError')) {
                    throw new Error('No microphone found. Please connect a microphone and try again.');
                } else if (error.message.includes('NotReadableError')) {
                    throw new Error('Microphone is busy or not accessible. Please check if another application is using it.');
                }
            }
            
            // Cleanup on error
            if (localAudioTrack) {
                localAudioTrack.close();
                setLocalAudioTrack(null);
            }
            if (agoraClient.current) {
                await agoraClient.current.leave();
            }
            setJoined(false);
            throw error;
        }
    }, [isHeadphonesConnected]);

    const handleJoinAudio = useCallback(async () => {
        if (isProcessing || !currentUser?.uid) return;
        setIsProcessing(true);
        
        try {
            // Check network connectivity first
            if (!navigator.onLine) {
                throw new Error('No internet connection. Please check your network and try again.');
            }

            // First, request microphone permissions
            console.log('Requesting microphone permissions...');
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            // Stop the test stream
            stream.getTracks().forEach(track => track.stop());
            
            // Get available devices
            console.log('Enumerating audio devices...');
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(d => d.kind === 'audioinput');
            setAvailableDevices(audioInputs);
            
            if (audioInputs.length === 0) {
                throw new Error('No microphones found. Please connect a microphone and try again.');
            }
            
            // Auto-select if only one device
            if (audioInputs.length === 1) {
                console.log('Auto-selecting single microphone:', audioInputs[0].label);
                setSelectedDeviceId(audioInputs[0].deviceId);
            } else {
                console.log('Multiple microphones found, showing selection dialog');
                setShowDeviceSelect(true);
                return; // Wait for user selection
            }
            
            setJoined(true);
            setIsAudioConnected(true);
            setIsMicMuted(false);
            
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            console.error('Audio setup failed:', err);
            
            // Handle specific error cases
            if (err.name === 'NotAllowedError') {
                toast.error('Microphone access was denied. Please allow microphone access and try again.');
            } else if (err.name === 'NotFoundError') {
                toast.error('No microphone found. Please connect a microphone and try again.');
            } else if (err.name === 'NotReadableError') {
                toast.error('Microphone is busy or not accessible. Please check if another application is using it.');
            } else if (err.message.includes('No internet connection')) {
                toast.error('No internet connection. Please check your network and try again.');
            } else {
                toast.error(`Failed to setup microphone: ${err.message}`);
            }
        } finally {
            setIsProcessing(false);
        }
    }, [currentUser?.uid, isProcessing, selectedDeviceId, roomId]);

    // --- Presence Listener ---
    useEffect(() => {
        if (!roomId || !hasRoomAccess) return;
        const presenceRef = collection(db, 'sideRooms', roomId, 'presence');
        const q = query(presenceRef, where("isOnline", "==", true));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!currentUser?.uid) return;

            const currentOnlineUsersMap = new Map<string, PresenceData>();
            snapshot.docs.forEach(doc => {
                currentOnlineUsersMap.set(doc.id, { userId: doc.id, ...doc.data() } as PresenceData);
            });

            setPresence(Array.from(currentOnlineUsersMap.values()));
            updatePresence();
        }, (err) => handleError(err, "listening to presence"));

        if (hasRoomAccess) updatePresence();
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                updatePresence();
            }
        };
        const handleBeforeUnload = () => {
            updatePresence();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            unsubscribe();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            if (currentUser?.uid) {
                setDoc(doc(db, 'sideRooms', roomId!, 'presence', currentUser.uid), 
                    { isOnline: false, lastSeen: serverTimestamp() }, 
                    { merge: true }
                ).catch(console.error);
            }
        };
    }, [roomId, hasRoomAccess, currentUser?.uid, updatePresence, handleError]);

    // Constants for audio analysis
    const SPEAKING_THRESHOLD = 0.03; // Adjust based on testing
    const DEBOUNCE_DELAY_MS = 300; // Prevents rapid toggling

    // --- Audio Analysis Setup ---
    useEffect(() => {
        if (!localAudioTrack) return;

        const setupAudioAnalysis = () => {
            try {
                // Create audio context if not exists
                if (!audioContextRef.current) {
                    audioContextRef.current = new ((window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext)();
                }

                // Create analyser node
                const analyser = audioContextRef.current.createAnalyser();
                analyser.fftSize = 32;
                analyserRef.current = analyser;

                // Connect audio track to analyser
                const mediaStream = new MediaStream([localAudioTrack.getMediaStreamTrack()]);
                const source = audioContextRef.current.createMediaStreamSource(mediaStream);
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
    }, [localAudioTrack]);

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
                if (isMounted) setIsMicAvailable(true);
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
    }, [roomId, selectedUsers, isInviting, handleError]);

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
            setIsProcessing(false);
        }
    }, [roomId, isRoomOwner, handleError]);

    const handleToggleMute = useCallback(() => {
        try {
            if (localAudioTrack) {
                if (isMicMuted) {
                    localAudioTrack.setEnabled(true);
                    console.log('Unmuted microphone');
                } else {
                    localAudioTrack.setEnabled(false);
                    console.log('Muted microphone');
                }
            }
            setIsMicMuted(!isMicMuted);
        } catch (error) {
            console.error('Error toggling mute:', error);
            toast.error('Failed to toggle mute');
        }
    }, [isMicMuted, localAudioTrack]);

    const handlePasswordSubmit = useCallback(() => {
        console.log("Password submit clicked");
        // Password validation and room joining logic
    }, []);

    const handleLeaveRoom = useCallback(async () => {
        console.log("Leaving room...");
        // Room leaving logic including audio cleanup
    }, []);

    const handleDeviceConfirm = useCallback(async () => {
        if (!selectedDeviceId) {
            toast.error('Please select a microphone');
            return;
        }
        
        setShowDeviceSelect(false);
        setIsProcessing(true);
        
        try {
            // Test the selected device
            console.log('Testing selected microphone:', selectedDeviceId);
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { 
                    deviceId: selectedDeviceId,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            // Stop the test stream
            stream.getTracks().forEach(track => track.stop());
            
            // Join the voice channel
            console.log('Joining voice channel with selected device...');
            await joinVoiceChannel(roomId!, currentUser!.uid);
            
            // Set up audio analysis
            console.log('Setting up audio analysis...');
            const audioContext = new ((window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext)();
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            
            // Update state
            setIsAudioConnected(true);
            setIsMicMuted(false);
            
            // Start analysis loop
            const checkSpeaking = () => {
                const data = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(data);
                const isSpeaking = data.some(level => level > 30);
                setIsSpeaking(isSpeaking);
                requestAnimationFrame(checkSpeaking);
            };
            checkSpeaking();
            
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            console.error('Microphone setup failed:', err);
            
            // Handle specific error cases
            if (err.name === 'NotAllowedError') {
                toast.error('Microphone access was denied. Please allow microphone access and try again.');
            } else if (err.name === 'NotFoundError') {
                toast.error('Selected microphone not found. Please select another microphone.');
            } else if (err.name === 'NotReadableError') {
                toast.error('Microphone is busy or not accessible. Please check if another application is using it.');
            } else {
                toast.error(`Failed to setup microphone: ${err.message}`);
            }
            
            await handleLeaveAudio();
        } finally {
            setIsProcessing(false);
        }
    }, [selectedDeviceId, roomId, currentUser, joinVoiceChannel, handleLeaveAudio]);

    function renderDeviceSelectionModal() {
        return (
            <Dialog open={showDeviceSelect} onClose={() => setShowDeviceSelect(false)}>
                <DialogTitle>Select Microphone</DialogTitle>
                <DialogContent>
                    <Select
                        fullWidth
                        value={selectedDeviceId}
                        onChange={(e) => setSelectedDeviceId(e.target.value as string)}
                    >
                        {availableDevices.map(device => (
                            <MenuItem key={device.deviceId} value={device.deviceId}>
                                {device.label || `Microphone ${availableDevices.indexOf(device) + 1}`}
                            </MenuItem>
                        ))}
                    </Select>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowDeviceSelect(false)}>Cancel</Button>
                    <Button 
                        onClick={handleDeviceConfirm}
                        variant="contained"
                        disabled={!selectedDeviceId}
                    >
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }

    // --- Data Listeners ---
    useEffect(() => {
        // Only call handleLeaveAudio if audio is connected
        return () => {
            if (isAudioConnected) {
                handleLeaveAudio();
            }
        };
    }, [isAudioConnected, handleLeaveAudio]);

    // --- Room Listener ---
    useEffect(() => {
        if (!roomId || !currentUser || authLoading) {
            if (!authLoading) {
                setLoading(false);
                setError("Cannot load room: Missing room ID or user information.");
            }
            return;
        }

        setLoading(true);
        setError(null);

        const roomRef = doc(db, 'sideRooms', roomId);
        const unsubscribe = onSnapshot(roomRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                const roomData = { id: docSnapshot.id, ...docSnapshot.data() } as SideRoom;
                setRoom(roomData);
                setRoomStyle(roomData.style);

                const isOwner = roomData.ownerId === currentUser.uid;
                const isViewer = roomData.viewers?.some(v => v.userId === currentUser.uid) ?? false;
                const isPrivate = roomData.isPrivate ?? false;

                if (isPrivate && !isOwner && !isViewer) {
                    setShowPasswordDialog(true);
                    setLoading(false);
                } else {
                    setShowPasswordDialog(false);
                    setLoading(false);
                }
            } else {
                setError(`Room with ID "${roomId}" not found.`);
                setRoom(null);
                setLoading(false);
            }
        }, (err) => {
            handleError(err, "fetching room data");
            setRoom(null);
            setLoading(false);
        });

        return () => {
            unsubscribe();
        };
    }, [roomId, currentUser, authLoading, navigate, handleError]);

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
                {renderDeviceSelectionModal()}
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