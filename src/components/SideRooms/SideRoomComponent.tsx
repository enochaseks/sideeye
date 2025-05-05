import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import {
    doc,
    getDoc,
    updateDoc,
    onSnapshot,
    collection,
    query,
    where,
    serverTimestamp,
    increment,
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
    Paper,
    Grid,
    Menu,
    MenuItem,
    ListItemIcon
} from '@mui/material';
import {
    ExitToApp,
    Lock,
    Group,
    MoreVert,
    Edit,
    Delete,
    PersonAdd,
    Palette,
    Share as ShareIcon,
    Mic,
    MicOff,
    VolumeUp,
    PersonRemove,
    MusicNote,
    UploadFile,
    MoreVert as MoreVertIcon,
    VolumeOff as VolumeOffIcon,
    VolumeUp as VolumeUpIcon,
    PersonRemove as PersonRemoveIcon,
    Block as BanIcon,
    Chat as ChatIcon,
    Search as SearchIcon
} from '@mui/icons-material';
import type { SideRoom, RoomMember, UserProfile } from '../../types/index';
import RoomForm from './RoomForm';
import { audioService } from '../../services/audioService';
import AudioDeviceSelector from '../AudioDeviceSelector';
import { storage } from '../../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import TypingIndicator from '../TypingIndicator';

// Define type for Sade AI messages
type SadeMessage = { sender: 'user' | 'ai', text: string };

// Handler function type for clearing chat
type ClearChatHandler = () => void;

interface PresenceData {
    userId: string;
    username: string;
    avatar: string;
    lastSeen: number;
    isOnline: boolean;
    isMuted?: boolean;
    isSpeaking?: boolean;
    displayName?: string;
    photoURL?: string;
    role?: 'owner' | 'viewer';
}

const SideRoomComponent: React.FC = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    // Inject navigate into audioService
    useEffect(() => {
        audioService.setNavigate(navigate);
        // No specific cleanup needed for navigate function itself
    }, [navigate]);

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
    const [isMicMuted, setIsMicMuted] = useState(true);
    const [isAudioConnected, setIsAudioConnected] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());
    const [selectedSoundFile, setSelectedSoundFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- State for Sade AI Chat Integration ---
    const [showSadeChat, setShowSadeChat] = useState(false);
    const [sadeMessages, setSadeMessages] = useState<SadeMessage[]>([]);
    const [sadeInput, setSadeInput] = useState('');
    const [sadeLoading, setSadeLoading] = useState(false);
    const sadeMessagesEndRef = useRef<null | HTMLDivElement>(null); // Ref for scrolling

    // --- Memos ---
    // Add console logs to debug isRoomOwner
    console.log('[SideRoomComponent Debug] Checking owner:');
    console.log('  Current User UID:', currentUser?.uid);
    console.log('  Room Owner ID:', room?.ownerId);
    console.log('  Room Data:', room);

    // Refined check: Ensure both IDs are valid strings before comparing
    const isRoomOwner = useMemo(() => {
        const currentUserId = currentUser?.uid;
        const ownerUserId = room?.ownerId;
        return !!currentUserId && !!ownerUserId && currentUserId === ownerUserId;
    }, [room?.ownerId, currentUser?.uid]);
    const isViewer = useMemo(() => !!room?.viewers?.some((viewer: RoomMember) => viewer.userId === currentUser?.uid), [room?.viewers, currentUser?.uid]);
    const hasRoomAccess = isRoomOwner || isViewer;
    const onlineParticipants = useMemo(() => {
        console.log('[onlineParticipants Memo] Raw presence state:', presence);
        const uniqueParticipants = new Map<string, PresenceData>();
        presence.forEach(p => {
            if (p.isOnline && !uniqueParticipants.has(p.userId)) { 
                uniqueParticipants.set(p.userId, p);
            }
        });
        const finalParticipants = Array.from(uniqueParticipants.values());
        console.log('[onlineParticipants Memo] Filtered participants:', finalParticipants);
        return finalParticipants;
    }, [presence]);
    const ownerData = useMemo(() => room?.viewers?.find((v: RoomMember) => v.role === 'owner'), [room?.viewers]);

    // --- Audio Handlers ---
    const handleJoinAudio = useCallback(async () => {
        if (!roomId || !currentUser?.uid || isProcessing) return;
        setIsProcessing(true);

        try {
            const success = await audioService.joinRoom(roomId, currentUser.uid);
            if (success) {
                setIsAudioConnected(true);
                setIsMicMuted(false);
                toast.success('Connected to audio');
            } else {
                throw new Error('Failed to join audio');
            }
        } catch (error) {
            console.error('Error joining audio:', error);
            toast.error('Failed to connect to audio');
        } finally {
            setIsProcessing(false);
        }
    }, [roomId, currentUser?.uid, isProcessing]);

    const handleLeaveAudio = useCallback(() => {
        if (!roomId || !currentUser?.uid) return;
        audioService.leaveRoom(roomId, currentUser.uid);
        setIsAudioConnected(false);
        setIsMicMuted(true);
        setIsSpeaking(false);
        toast.success('Disconnected from audio');
    }, [roomId, currentUser?.uid]);

    const handleToggleMute = useCallback(() => {
        const newMutedState = !isMicMuted;
        setIsMicMuted(newMutedState);
        
        // Call audioService to actually mute the audio
        audioService.setMuted(newMutedState);
        
        // Update presence in Firestore
        if (roomId && currentUser?.uid) {
            const presenceRef = doc(db, 'sideRooms', roomId, 'presence', currentUser.uid);
            updateDoc(presenceRef, { isMuted: newMutedState }).catch(console.error);
        }
    }, [roomId, currentUser?.uid, isMicMuted]);

    // --- New Click Handler ---
    const handlePlayBeepClick = useCallback(() => {
        if (!roomId || !currentUser?.uid) return;
        console.log(`[Room ${roomId}] User ${currentUser.uid} triggering sound effect.`);

        // --- REPLACE WITH YOUR ACTUAL SOUND FILE URL --- 
        const soundUrl = '/assets/sounds/simple-beep.mp3'; // Example path - host this file!

        // Call the new audioService method
        audioService.triggerSoundEffect(roomId, soundUrl);

        // Optional: Keep a brief toast notification or remove it
        // toast('Beep!'); 

    }, [roomId, currentUser?.uid]);

    // --- Cleanup on unmount --- Effect to leave the audio room when the component unmounts
    useEffect(() => {
        // Store roomId and userId in constants for use in cleanup
        const componentRoomId = roomId;
        const componentUserId = currentUser?.uid;

        return () => {
            // This function runs when the component unmounts (e.g., user navigates away)
            console.log(`[SideRoomComponent] Unmounting room ${componentRoomId} for user ${componentUserId}. Attempting audio cleanup.`);
            // Always attempt to leave the room audio on unmount
            if (componentRoomId && componentUserId) {
                // Call the leaveRoom function from the audio service
                // This should handle stopping mic tracks, closing connections, etc.
                audioService.leaveRoom(componentRoomId, componentUserId);
                // It's generally better to let the audioService manage internal state like isAudioConnected
                // rather than relying on component state during unmount.
            }
        };
    // Effect dependencies: only run setup/cleanup when roomId or user changes
    }, [roomId, currentUser?.uid]);

    // --- Room Listener ---
    useEffect(() => {
        if (!roomId || !currentUser) return;

        const roomRef = doc(db, 'sideRooms', roomId);
        const unsubscribe = onSnapshot(roomRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                setRoom({ id: docSnapshot.id, ...docSnapshot.data() } as SideRoom);
                setLoading(false);
            } else {
                setError('Room not found');
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [roomId, currentUser]);

    // --- Presence Listener ---
    useEffect(() => {
        if (!roomId || !hasRoomAccess || !currentUser?.uid) { 
             setPresence([]);
             return;
        }

        console.log(`[Presence Listener] Setting up for room ${roomId}, user ${currentUser.uid}`);
        const componentUserId = currentUser.uid; // Store current user ID for stability in async ops

        const presenceRef = collection(db, 'sideRooms', roomId, 'presence');
        const q = query(presenceRef, where("isOnline", "==", true)); 
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const onlineUsersData = snapshot.docs.map(doc => ({
                userId: doc.id,
                ...doc.data()
            })) as PresenceData[];
            setPresence(onlineUsersData);
        }, (error) => {
             console.error('[Presence Listener] Snapshot error:', error);
             toast.error("Error listening to room presence.");
        });

        // --- Explicitly fetch latest profile data before writing presence ---
        const fetchProfileAndWritePresence = async () => {
            try {
                const userProfileRef = doc(db, 'users', componentUserId);
                const userProfileSnap = await getDoc(userProfileRef);
                
                let userDisplayName = '';
                let userProfilePic = '';
                let userUsername = currentUser.email?.split('@')[0] || `user_${componentUserId.substring(0, 4)}`; // Initial fallback

                if (userProfileSnap.exists()) {
                    const profileData = userProfileSnap.data() as UserProfile;
                    userDisplayName = profileData.name || profileData.username || ''; // Prioritize name, then username from profile
                    userProfilePic = profileData.profilePic || '';
                    userUsername = profileData.username || userUsername; // Use profile username if available
                    console.log(`[Presence Listener Profile Fetch] Fetched profile for ${componentUserId}: Name='${userDisplayName}', Pic='${userProfilePic}', Username='${userUsername}'`);
                } else {
                    // Fallback if Firestore profile doesn't exist (shouldn't ideally happen here)
                    console.warn(`[Presence Listener Profile Fetch] Firestore profile missing for ${componentUserId}. Using fallbacks.`);
                    userDisplayName = currentUser.displayName || ''; // Fallback to auth display name
                    userProfilePic = currentUser.profile?.profilePic || ''; // Fallback to potentially loaded pic
                }

                const myPresenceRef = doc(db, 'sideRooms', roomId, 'presence', componentUserId);
                const presenceData: PresenceData = { 
                    userId: componentUserId,
                    username: userUsername, // Use fetched/fallback username
                    avatar: userProfilePic, // Use fetched pic
                    lastSeen: Date.now(), 
                    isOnline: true,
                    role: isRoomOwner ? 'owner' : 'viewer', 
                    displayName: userDisplayName, // Use fetched display name
                    photoURL: userProfilePic // Keep consistent
                }; 
                console.log(`[Presence Listener Debug] Data being written to presence:`, presenceData);
        
                await setDoc(myPresenceRef, presenceData, { merge: true });
                console.log(`[Presence Listener] Presence updated via fetch for ${componentUserId}`);

            } catch (profileError) {
                 console.error(`[Presence Listener] Error fetching profile or writing presence for ${componentUserId}:`, profileError);
            }
        };

        fetchProfileAndWritePresence(); // Call the async function
        // -----------------------------------------------------------------

        // Define cleanup function using componentUserId
        const cleanup = () => {
            console.log(`[Presence Listener] Cleanup running for user ${componentUserId} in room ${roomId}.`);
            unsubscribe(); // Stop listening to the query
            const userPresenceRef = doc(db, 'sideRooms', roomId, 'presence', componentUserId);
            // Set offline using updateDoc
            updateDoc(userPresenceRef, {
                isOnline: false,
                lastSeen: serverTimestamp() // Use server timestamp for offline status
            }).catch(error => {
                 if (error.code !== 'not-found') { 
                     console.error(`[Presence Listener] Error setting user offline for ${componentUserId}:`, error);
                 }
            });
        };

        // Return the cleanup function
        return cleanup;

    }, [roomId, hasRoomAccess, currentUser?.uid, isRoomOwner, db]); // Depend on currentUser.uid to re-run if user changes

    // Add speaking detection effect
    useEffect(() => {
        const handleAudioLevel = (userId: string, isSpeaking: boolean) => {
            setSpeakingUsers(prev => {
                const newSet = new Set(prev);
                if (isSpeaking && !audioService.isMicrophoneMuted()) {
                    newSet.add(userId);
                } else {
                    newSet.delete(userId);
                }
                return newSet;
            });
        };

        audioService.onAudioLevel(handleAudioLevel);

        return () => {
            audioService.removeAudioLevelCallback(handleAudioLevel);
        };
    }, []);

    // --- Handler for Remote User Leaving --- 
    const handleRemoteUserLeft = useCallback((leftUserId: string) => {
        console.log(`[SideRoomComponent] handleRemoteUserLeft called for: ${leftUserId}`);
        // Update presence state by removing the user who left
        setPresence(prevPresence => {
            const updatedPresence = prevPresence.filter(p => p.userId !== leftUserId);
            console.log(`[SideRoomComponent] Presence updated after user left. Old count: ${prevPresence.length}, New count: ${updatedPresence.length}`);
            return updatedPresence;
        });
    }, []); // Empty dependency array is fine here

    // --- Effect to Register/Unregister User Left Handler --- 
    useEffect(() => {
        console.log('[SideRoomComponent] Registering audioService.onUserLeft handler.');
        const unsubscribe = audioService.onUserLeft(handleRemoteUserLeft);
        
        // Return cleanup function provided by onUserLeft
        return () => {
             console.log('[SideRoomComponent] Cleaning up onUserLeft handler registration.');
             unsubscribe();
        }
    }, [handleRemoteUserLeft]); // Depend on the handler function

    // --- UI Components ---
    const ParticipantGridItem: React.FC<{ participant: PresenceData }> = ({ participant }) => {
        const isCurrentlySpeaking = speakingUsers.has(participant.userId);
        const isMuted = participant.isMuted;
        const isSelf = participant.userId === currentUser?.uid;

        // State for the moderation menu
        const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
        const open = Boolean(anchorEl);

        const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
            setAnchorEl(event.currentTarget);
        };
        const handleMenuClose = () => {
            setAnchorEl(null);
        };

        // --- Handlers passed from parent SideRoomComponent --- 
        const onMuteToggle = () => {
            handleForceMuteToggle(participant.userId, !!isMuted); 
            handleMenuClose();
        };
        const onRemoveUser = () => {
            handleForceRemove(participant.userId, participant.username || participant.displayName);
            handleMenuClose();
        };
        const onBanUser = () => {
            handleForceBan(participant.userId, participant.username || participant.displayName);
            handleMenuClose();
        };

        console.log(`[ParticipantGridItem] Rendering:`, participant);

        return (
            <Grid item xs={6} sm={4} md={3} lg={2}>
                <Box sx={{ position: 'relative'}}>
                    <Link 
                        to={`/profile/${participant.userId}`} 
                        style={{ textDecoration: 'none', color: 'inherit' }} 
                        onClick={(e) => { if (isSelf) e.preventDefault(); }} // Prevent linking to own profile if desired
                    >
                        <Paper 
                            sx={{
                                p: 1,
                                pt: isRoomOwner && !isSelf ? 4 : 1,
                                textAlign: 'center',
                                position: 'relative',
                                bgcolor: isCurrentlySpeaking ? 'primary.light' : 'background.paper',
                                transition: 'all 0.3s ease-in-out',
                                border: isCurrentlySpeaking && !isMuted ? '2px solid' : 'none',
                                borderColor: 'primary.main',
                                '&:hover': {
                                    boxShadow: 3,
                                    cursor: isSelf ? 'default' : 'pointer'
                                }
                            }}
                        >
                            <Box sx={{ position: 'relative' }}>
                                <Avatar 
                                    src={participant.avatar} 
                                    alt={participant.displayName || participant.username}
                                    sx={{ 
                                        width: 60, 
                                        height: 60, 
                                        margin: 'auto', 
                                        mb: 1,
                                        border: isCurrentlySpeaking && !isMuted ? '2px solid' : 'none',
                                        borderColor: 'primary.main'
                                    }}
                                >
                                    {participant.displayName?.[0] || participant.username?.[0]}
                                </Avatar>
                                {isCurrentlySpeaking && !isMuted && (
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            bottom: 8,
                                            right: -4,
                                            width: 16,
                                            height: 16,
                                            borderRadius: '50%',
                                            bgcolor: 'success.main',
                                            border: '2px solid',
                                            borderColor: 'background.paper'
                                        }}
                                    />
                                )}
                            </Box>
                            <Typography variant="caption" display="block" noWrap>
                                {participant.displayName || participant.username}
                            </Typography>
                            {isMuted && ( 
                                <MicOff 
                                    fontSize="small" 
                                    color="error"
                                    sx={{ position: 'absolute', bottom: 4, right: 4 }}
                                />
                            )}
                            {participant.role === 'owner' && (
                                <Chip 
                                    label="Host" 
                                    size="small" 
                                    color="primary"
                                    sx={{ position: 'absolute', top: 4, left: 4 }}
                                />
                            )}
                        </Paper>
                    </Link>

                    {isRoomOwner && !isSelf && (
                        <Tooltip title="Manage User">
                            <IconButton
                                aria-label="manage user"
                                aria-controls={open ? 'manage-user-menu' : undefined}
                                aria-haspopup="true"
                                aria-expanded={open ? 'true' : undefined}
                                onClick={handleMenuClick}
                                size="small"
                                sx={{ 
                                    position: 'absolute', 
                                    top: 2, 
                                    right: 2,
                                    zIndex: 2,
                                    backgroundColor: 'rgba(255, 255, 255, 0.7)',
                                    '&:hover': {
                                        backgroundColor: 'rgba(255, 255, 255, 0.9)'
                                    }
                                }} 
                            >
                                <MoreVertIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                    <Menu
                        id="manage-user-menu"
                        anchorEl={anchorEl}
                        open={open}
                        onClose={handleMenuClose}
                        MenuListProps={{
                        'aria-labelledby': 'manage-user-button',
                        }}
                        anchorOrigin={{
                            vertical: 'top',
                            horizontal: 'right',
                        }}
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'right',
                        }}
                    >
                        <MenuItem onClick={onMuteToggle}>
                            <ListItemIcon>
                                {isMuted ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
                            </ListItemIcon>
                            {isMuted ? 'Unmute User' : 'Mute User'}
                        </MenuItem>
                        <MenuItem onClick={onRemoveUser} sx={{ color: 'warning.dark' }}>
                            <ListItemIcon>
                                <PersonRemoveIcon fontSize="small" color="warning" />
                            </ListItemIcon>
                            Remove User
                        </MenuItem>
                        <MenuItem onClick={onBanUser} sx={{ color: 'error.main' }}>
                            <ListItemIcon>
                                <BanIcon fontSize="small" color="error" />
                            </ListItemIcon>
                            Ban User
                        </MenuItem>
                    </Menu>
                </Box>
            </Grid>
        );
    };

    const renderRoomContent = () => (
        <Box sx={{ flexGrow: 1, p: 2, overflowY: 'auto' }}>
            <Typography variant="h6" gutterBottom>
                Participants ({onlineParticipants.length})
            </Typography>
            <Grid container spacing={2}>
                {onlineParticipants.map((participant) => (
                    <ParticipantGridItem 
                        key={participant.userId}
                        participant={participant}
                    />
                ))}
            </Grid>
            {!isAudioConnected && hasRoomAccess && !loading && room && (
                <Alert severity="info" sx={{ mt: 2 }}>
                    Join the audio to start talking or listening.
                </Alert>
            )}
        </Box>
    );

    // Add these handlers back
    const handleShareRoom = useCallback(() => {
        setShowShareDialog(true);
    }, []);

    const handleMenuClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    }, []);

    const handleMenuClose = useCallback(() => {
        setAnchorEl(null);
    }, []);

    const handleEditRoom = useCallback(() => {
        setShowEditDialog(true);
        handleMenuClose();
    }, [handleMenuClose]);

    const handleStyleRoom = useCallback(() => {
        setShowStyleDialog(true);
        handleMenuClose();
    }, [handleMenuClose]);

    const handleInviteMembers = useCallback(() => {
        setShowInviteDialog(true);
        handleMenuClose();
    }, [handleMenuClose]);

    const handleDeleteRoom = useCallback(async () => {
        if (!roomId || !isRoomOwner) return;
        handleMenuClose();

        if (window.confirm('Are you sure you want to delete this room? This cannot be undone.')) {
            setIsProcessing(true);
            try {
                const roomRef = doc(db, 'sideRooms', roomId);
                await updateDoc(roomRef, {
                    deleted: true,
                    deletedAt: serverTimestamp()
                });
                toast.success('Room deleted successfully');
                navigate('/side-rooms');
            } catch (error) {
                console.error('Error deleting room:', error);
                toast.error('Failed to delete room');
                setIsProcessing(false);
            }
        }
    }, [roomId, isRoomOwner, navigate]);

    // 4. Handler for the "Upload Sound" button click
    const handleUploadSoundClick = () => {
        // Trigger the hidden file input
        fileInputRef.current?.click();
    };

    // 5. Handler for when a file is selected in the input
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            console.log('Selected sound file:', file);
            setSelectedSoundFile(file);
            // --- Next Step: Start upload process here ---
            // e.g., uploadFileToStorage(file);
            toast(`Selected: ${file.name}. Upload coming soon!`); // Use default toast

            // Reset the input value so the user can select the same file again if needed
             if (fileInputRef.current) {
                 fileInputRef.current.value = '';
             }
        } else {
            setSelectedSoundFile(null);
        }
    };

    // Update the renderRoomHeader function
    const renderRoomHeader = () => (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="h6">{room?.name}</Typography>
                    {ownerData && (
                        <Typography variant="caption" color="text.secondary">
                            Host: {ownerData.username}
                        </Typography>
                    )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {isAudioConnected && <AudioDeviceSelector />}
                    <Tooltip title="Share">
                        <IconButton onClick={handleShareRoom}>
                            <ShareIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Chat with Sade AI">
                        <Avatar 
                            src="/images/sade-avatar.jpg" 
                            alt="Sade AI Chat"
                            onClick={() => setShowSadeChat(true)} 
                            sx={{ 
                                width: 32, 
                                height: 32, 
                                cursor: 'pointer', 
                                '&:hover': { 
                                    opacity: 0.8 
                                },
                                border: '1px solid', // Optional: Add a border
                                borderColor: 'primary.light' // Optional: Border color
                            }}
                        />
                    </Tooltip>
                    {isRoomOwner && (
                        <>
                            <Tooltip title="Room Settings">
                                <IconButton onClick={handleMenuClick}>
                                    <MoreVert />
                                </IconButton>
                            </Tooltip>
                            <Menu
                                anchorEl={anchorEl}
                                open={Boolean(anchorEl)}
                                onClose={handleMenuClose}
                            >
                                <MenuItem onClick={handleEditRoom}>
                                    <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
                                    Edit Room
                                </MenuItem>
                                <MenuItem onClick={handleStyleRoom}>
                                    <ListItemIcon><Palette fontSize="small" /></ListItemIcon>
                                    Customize
                                </MenuItem>
                                <MenuItem onClick={handleInviteMembers}>
                                    <ListItemIcon><PersonAdd fontSize="small" /></ListItemIcon>
                                    Invite
                                </MenuItem>
                                <MenuItem onClick={handleDeleteRoom} sx={{ color: 'error.main' }}>
                                    <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
                                    Delete Room
                                </MenuItem>
                            </Menu>
                        </>
                    )}
                    <Tooltip title="Leave Room">
                        <IconButton onClick={() => navigate('/side-rooms')} disabled={isProcessing}>
                            <ExitToApp />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                    {onlineParticipants.length} Online
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {isAudioConnected ? (
                        <>
                            <Button
                                variant="contained"
                                size="small"
                                color={isMicMuted ? "secondary" : "primary"}
                                onClick={handleToggleMute}
                                startIcon={isMicMuted ? <MicOff /> : <Mic />}
                                disabled={isProcessing}
                            >
                                {isMicMuted ? 'Unmute' : 'Mute'}
                            </Button>
                            <Button
                                variant="outlined"
                                size="small"
                                color="error"
                                onClick={handleLeaveAudio}
                                disabled={isProcessing}
                            >
                                Leave Audio
                            </Button>
                            <Tooltip title="Play Sound Effect (WIP)">
                                <span>
                                    <IconButton
                                        onClick={handlePlayBeepClick}
                                        disabled={isProcessing}
                                        size="small"
                                        color="info"
                                    >
                                        <MusicNote />
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <Tooltip title="Upload Sound (WIP)">
                                <IconButton
                                    onClick={handleUploadSoundClick}
                                    disabled={isProcessing}
                                    size="small"
                                    color="secondary"
                                >
                                    <UploadFile />
                                </IconButton>
                            </Tooltip>
                        </>
                    ) : (
                        <Button
                            variant="contained"
                            size="small"
                            color="primary"
                            onClick={handleJoinAudio}
                            startIcon={<VolumeUp />}
                            disabled={!hasRoomAccess || isProcessing}
                        >
                            Join Audio
                        </Button>
                    )}
                </Box>
            </Box>

            {/* --- Add Hidden File Input somewhere (doesn't matter where visually) --- */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="audio/*"
                style={{ display: 'none' }}
                id="sound-upload-input"
            />
        </Box>
    );

    // --- Moderation Handlers (To be defined in SideRoomComponent) --- 
    const handleForceMuteToggle = useCallback(async (targetUserId: string, currentMuteState: boolean) => {
        if (!isRoomOwner || !roomId || targetUserId === currentUser?.uid) return;
        console.log(`Owner toggling mute for ${targetUserId}. Currently muted: ${currentMuteState}`);
        
        const newMuteState = !currentMuteState;
        const targetPresenceRef = doc(db, 'sideRooms', roomId, 'presence', targetUserId);
        
        try {
            // Update Firestore state first for immediate UI feedback
            await updateDoc(targetPresenceRef, { isMuted: newMuteState });
            
            // Send signal via audio service
            if (newMuteState) {
                audioService.sendForceMute(roomId, targetUserId);
            } else {
                audioService.sendForceUnmute(roomId, targetUserId);
            }
            toast.success(`User ${newMuteState ? 'muted' : 'unmuted'}.`);
        } catch (error) {
             console.error(`Error toggling mute for ${targetUserId}:`, error);
             toast.error('Failed to update mute status.');
        }
    }, [isRoomOwner, roomId, currentUser?.uid, db]); // Added db dependency

    const handleForceRemove = useCallback((targetUserId: string, targetUsername?: string) => {
        if (!isRoomOwner || !roomId || targetUserId === currentUser?.uid) return;
        
        const name = targetUsername || 'this user';
        if (window.confirm(`Are you sure you want to remove ${name} from the room?`)) {
             console.log(`Owner removing user ${targetUserId} from room ${roomId}`);
             // Send signal via audio service - server will handle removal and notifications
             audioService.sendForceRemove(roomId, targetUserId);
             toast.success(`Removing ${name}...`);
        }
    }, [isRoomOwner, roomId, currentUser?.uid]);

    // Add Ban Handler
    const handleForceBan = useCallback((targetUserId: string, targetUsername?: string) => {
        if (!isRoomOwner || !roomId || targetUserId === currentUser?.uid) return;
        
        const name = targetUsername || 'this user';
        if (window.confirm(`Are you sure you want to BAN ${name} from the room? They will be removed and unable to rejoin.`)) {
             console.log(`Owner banning user ${targetUserId} from room ${roomId}`);
             // Send signal via audio service - server will handle DB update and removal
             audioService.sendForceBan(roomId, targetUserId);
             toast.success(`Banning ${name}...`);
        }
    }, [isRoomOwner, roomId, currentUser?.uid]);

    // --- Sade AI Chat: Scrolling ---
    const scrollToSadeBottom = () => {
        // Add a slight delay to allow the DOM to update before scrolling
        setTimeout(() => {
            sadeMessagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }, 100);
    };
    useEffect(() => {
        if (showSadeChat) { // Only scroll when chat is open
            scrollToSadeBottom();
        }
    }, [sadeMessages, showSadeChat]); // Depend on showSadeChat as well

    // --- Sade AI Chat: History Persistence ---
    useEffect(() => {
        // Load chat history from localStorage on mount
        const saved = localStorage.getItem('sideroom_sade_chat_history');
        if (saved) {
            try {
                const parsedMessages = JSON.parse(saved);
                // Basic validation
                if (Array.isArray(parsedMessages) && parsedMessages.every(m => typeof m === 'object' && m !== null && 'sender' in m && 'text' in m)) {
                    setSadeMessages(parsedMessages);
                } else {
                     console.warn("[SideRoomComponent - SadeAI History] Invalid data found in localStorage.");
                     localStorage.removeItem('sideroom_sade_chat_history'); // Clear invalid data
                }
            } catch (error) {
                 console.error("[SideRoomComponent - SadeAI History] Error parsing saved history:", error);
                 localStorage.removeItem('sideroom_sade_chat_history'); // Clear corrupted data
            }
        }
    }, []); // Run only once on mount

    useEffect(() => {
        // Save chat history to localStorage whenever messages change
        // Add a check to prevent saving the initial empty array if nothing was loaded
        if (sadeMessages.length > 0 || localStorage.getItem('sideroom_sade_chat_history')) {
            localStorage.setItem('sideroom_sade_chat_history', JSON.stringify(sadeMessages));
        }
    }, [sadeMessages]);

    // --- Sade AI Chat: sendMessage Function ---
    const sendSadeMessage = async (messageToSend: string = sadeInput, forceSearch: boolean = false) => {
        const trimmedMessage = messageToSend.trim();
        if (!trimmedMessage) return;

        const userMessage: SadeMessage = { sender: 'user' as const, text: trimmedMessage }; // Use trimmed message
        setSadeMessages(msgs => [...msgs, userMessage]);
        setSadeInput('');
        setSadeLoading(true);

        try {
            console.log("[SideRoomComponent - SadeAI] Sending message to backend.");

            const backendBaseUrl = process.env.REACT_APP_API_URL;
            if (!backendBaseUrl) {
                console.error("[SideRoomComponent - SadeAI] ERROR: REACT_APP_API_URL is not defined.");
                setSadeMessages(msgs => [...msgs, { sender: 'ai', text: "Configuration error: Backend URL not set." }]);
                setSadeLoading(false);
                return;
            }
            const apiUrl = `${backendBaseUrl}/api/sade-ai`;

            // --- Ensure userId is included, remove client-side history --- 
            if (!currentUser?.uid) {
                console.error("[SideRoomComponent - SadeAI] ERROR: User ID not available.");
                setSadeMessages(msgs => [...msgs, { sender: 'ai', text: "Error: Could not identify user." }]);
                setSadeLoading(false);
                return;
            }

            const requestBody = {
                message: trimmedMessage, // Send trimmed message
                forceSearch: forceSearch, // Include forceSearch flag
                userId: currentUser.uid // ADD USER ID
                // history: sadeMessages.slice(-10) // REMOVE client history - backend uses Firestore
            };
            console.log("[SideRoomComponent - SadeAI] Sending HTTP request body:", requestBody);
            const fetchOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            };
            const res = await fetch(apiUrl, fetchOptions);
            if (!res.ok) {
                let errorMsg = `HTTP error! status: ${res.status}`;
                try {
                    const errorData = await res.json();
                    errorMsg = errorData.error || errorMsg;
                } catch (e) { /* Ignore */ }
                throw new Error(errorMsg);
            }
            const data = await res.json();
            console.log("[SideRoomComponent - SadeAI] HTTP Backend response data:", data);

            if (data.response) {
                setSadeMessages(msgs => [...msgs, { sender: 'ai', text: data.response }]);
            } else if (data.error) {
                 console.error("[SideRoomComponent - SadeAI] Backend returned error:", data.error);
                 setSadeMessages(msgs => [...msgs, { sender: 'ai', text: `Sorry, there was an error: ${data.error}` }]);
            } else {
                console.error("[SideRoomComponent - SadeAI] Received unexpected HTTP response structure:", data);
                setSadeMessages(msgs => [...msgs, { sender: 'ai', text: "Sorry, I got a bit confused there." }]);
            }

        } catch (err: any) {
            console.error("[SideRoomComponent - SadeAI] sendMessage Error:", err);
            setSadeMessages(msgs => [...msgs, { sender: 'ai', text: `Sorry, there was an error: ${err.message || 'Unknown error'}` }]);
        } finally {
            setSadeLoading(false);
            // Ensure scrolling happens after state update and potential re-render
            scrollToSadeBottom(); 
        }
    };

    // --- Sade AI Chat: Clear Chat Handler ---
    const handleClearSadeChat: ClearChatHandler = () => {
        setSadeMessages([]); // Clear state
        localStorage.removeItem('sideroom_sade_chat_history'); // Clear storage
        toast.success("Sade AI chat cleared"); // Optional feedback
    };

    // --- Loading & Error States ---
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
                <Alert severity="error">{error}</Alert>
                <Button onClick={() => navigate('/side-rooms')} sx={{ mt: 1 }}>
                    Back to Rooms
                </Button>
            </Box>
        );
    }

    // --- Main Return ---
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            {renderRoomHeader()}
            {renderRoomContent()}

            {/* Dialogs */}
            {showEditDialog && room && (
                <RoomForm
                    open={showEditDialog}
                    onClose={() => setShowEditDialog(false)}
                    onSubmit={async (data, thumbnailFile) => {
                        setIsProcessing(true);
                        try {
                            if (!roomId) throw new Error("Room ID is missing");
                            const roomRef = doc(db, 'sideRooms', roomId!);
                            let thumbnailUrl = data.thumbnailUrl;

                            if (thumbnailFile) {
                                toast.loading('Uploading thumbnail...', { id: 'thumbnail-edit-upload' });
                                try {
                                    const storageRef = ref(storage, `sideRoomThumbnails/${roomId}/${thumbnailFile.name}`);
                                    const snapshot = await uploadBytes(storageRef, thumbnailFile);
                                    thumbnailUrl = await getDownloadURL(snapshot.ref);
                                    toast.dismiss('thumbnail-edit-upload');
                                    toast.success('Thumbnail updated!');
                                } catch (uploadError) {
                                    console.error("Error uploading thumbnail during edit:", uploadError);
                                    toast.dismiss('thumbnail-edit-upload');
                                    toast.error("Failed to upload new thumbnail.");
                                    thumbnailUrl = room?.thumbnailUrl;
                                }
                            }

                            const updateData: Partial<SideRoom> = { ...data };

                            if (typeof thumbnailUrl === 'string' && thumbnailUrl) {
                                updateData.thumbnailUrl = thumbnailUrl;
                            }

                            await updateDoc(roomRef, updateData);
                            toast.success('Room updated successfully');
                            setShowEditDialog(false);
                        } catch (error) {
                            console.error('Error updating room:', error);
                            toast.error('Failed to update room');
                        }
                    }}
                    initialData={room}
                    title="Edit Room"
                    submitButtonText="Save Changes"
                />
            )}

            {/* Share Dialog */}
            <Dialog open={showShareDialog} onClose={() => setShowShareDialog(false)}>
                <DialogTitle>Share Room</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        value={`${window.location.origin}/side-room/${roomId}`}
                        InputProps={{
                            readOnly: true,
                        }}
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowShareDialog(false)}>Close</Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/side-room/${roomId}`);
                            toast.success('Room link copied to clipboard');
                            setShowShareDialog(false);
                        }}
                    >
                        Copy Link
                    </Button>
                </DialogActions>
            </Dialog>

            {/* --- Sade AI Chat Dialog --- */}
            <Dialog 
                open={showSadeChat} 
                onClose={() => setShowSadeChat(false)} 
                fullWidth 
                maxWidth="sm" 
                aria-labelledby="sade-ai-chat-dialog-title"
            >
                <DialogTitle id="sade-ai-chat-dialog-title">Chat with Sade AI ✨</DialogTitle>
                <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', maxHeight: '70vh' }}>
                    {/* Chat messages will go here */}
                    <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 1, mb: 1 }}>
                        {/* Display Sade AI messages */}
                        {sadeMessages.length === 0 && (
                            <Typography variant="caption" color="text.secondary" align="center" sx={{ display: 'block', mt: 4 }}>
                                Start chatting with Sade AI...
                            </Typography>
                        )}
                        {sadeMessages.map((msg, idx) => (
                            <Box
                                key={idx}
                                sx={{
                                    display: 'flex',
                                    justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                                    mb: 1.5,
                                }}
                            >
                                {msg.sender === 'ai' && (
                                    <Avatar
                                        src="/images/sade-avatar.jpg" // Ensure this path is correct relative to your public folder
                                        alt="Sade AI Avatar"
                                        sx={{ width: 32, height: 32, mr: 1 }}
                                    />
                                )}
                                <Box
                                    sx={{
                                        bgcolor: msg.sender === 'user' ? 'primary.light' : '#f0f0f0',
                                        color: msg.sender === 'user' ? 'primary.contrastText' : 'text.primary',
                                        borderRadius: msg.sender === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                        px: 1.5,
                                        py: 1,
                                        maxWidth: '80%',
                                        fontSize: '0.95rem',
                                        wordBreak: 'break-word',
                                    }}
                                >
                                    {msg.text}
                                </Box>
                            </Box>
                        ))}
                         {sadeLoading && (
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'flex-start',
                                mb: 1.5,
                              }}
                            >
                              <Avatar
                                src="/images/sade-avatar.jpg"
                                alt="Sade AI Avatar"
                                sx={{ width: 32, height: 32, mr: 1 }} // Match style
                              />
                              <Box
                                sx={{
                                  bgcolor: '#f0f0f0', // Match AI bubble style
                                  borderRadius: '16px 16px 16px 4px',
                                  px: 1,
                                  py: 0.5,
                                  display: 'inline-block',
                                }}
                              >
                                <TypingIndicator />
                              </Box>
                            </Box>
                         )}
                         <div ref={sadeMessagesEndRef} /> {/* Target for scrolling */}
                    </Box>
                    {/* Input area */}
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 'auto' }}>
                        <TextField 
                            fullWidth 
                            placeholder="Type message..." 
                            size="small" 
                            value={sadeInput} 
                            onChange={e => setSadeInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && sadeInput.trim()) sendSadeMessage(); }}
                            disabled={sadeLoading}
                        />
                        <Button 
                            variant="contained" 
                            onClick={() => sendSadeMessage()} 
                            disabled={sadeLoading || !sadeInput.trim()}
                        >
                            Send
                        </Button>
                        {/* Add Search Button */}
                        <IconButton
                            color="primary"
                            onClick={() => sendSadeMessage(sadeInput, true)} // Call with forceSearch=true
                            disabled={sadeLoading || !sadeInput.trim()}
                            size="small"
                            sx={{ border: '1px solid', borderColor: 'primary.light', ml: 0.5 }}
                            title="Search the web for this query"
                        >
                            <SearchIcon fontSize="small"/>
                        </IconButton>
                    </Box>
                </DialogContent>
                <DialogActions>
                     <Button onClick={handleClearSadeChat} disabled={sadeMessages.length === 0}>Clear Chat</Button>
                     <Button onClick={() => setShowSadeChat(false)}>Close</Button>
                 </DialogActions>
            </Dialog>
        </Box>
    );
};

export default SideRoomComponent;