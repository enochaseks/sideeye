import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
    PersonRemove
} from '@mui/icons-material';
import type { SideRoom, RoomMember } from '../../types/index';
import RoomForm from './RoomForm';
import { audioService } from '../../services/audioService';
import AudioDeviceSelector from '../AudioDeviceSelector';

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

    // --- Memos ---
    const isRoomOwner = useMemo(() => room?.ownerId === currentUser?.uid, [room?.ownerId, currentUser?.uid]);
    const isViewer = useMemo(() => !!room?.viewers?.some((viewer: RoomMember) => viewer.userId === currentUser?.uid), [room?.viewers, currentUser?.uid]);
    const hasRoomAccess = isRoomOwner || isViewer;
    const onlineParticipants = useMemo(() => presence.filter(p => p.isOnline), [presence]);
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
        if (!roomId || !hasRoomAccess) return;

        const presenceRef = collection(db, 'sideRooms', roomId, 'presence');
        const q = query(presenceRef, where("isOnline", "==", true));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const presenceData = snapshot.docs.map(doc => ({
                userId: doc.id,
                ...doc.data()
            })) as PresenceData[];
            setPresence(presenceData);
        });

        // Update own presence
        if (currentUser?.uid) {
            const myPresenceRef = doc(db, 'sideRooms', roomId, 'presence', currentUser.uid);
            
            // First check if document exists
            getDoc(myPresenceRef).then((docSnapshot) => {
                if (!docSnapshot.exists()) {
                    // Create the document if it doesn't exist
                    setDoc(myPresenceRef, {
                        userId: currentUser.uid,
                        username: currentUser.displayName || currentUser.email?.split('@')[0] || '',
                        avatar: currentUser.photoURL || '',
                        lastSeen: Date.now(),
                        isOnline: true,
                        role: isRoomOwner ? 'owner' : 'viewer'
                    }).catch(console.error);
                } else {
                    // Update existing document - Ensure username/avatar are updated too
                    updateDoc(myPresenceRef, {
                        lastSeen: Date.now(),
                        isOnline: true,
                        role: isRoomOwner ? 'owner' : 'viewer',
                        username: currentUser.displayName || currentUser.email?.split('@')[0] || '',
                        avatar: currentUser.photoURL || ''
                    }).catch(console.error);
                }
            }).catch(console.error);
        }

        return () => {
            unsubscribe();
            if (currentUser?.uid) {
                const myPresenceRef = doc(db, 'sideRooms', roomId, 'presence', currentUser.uid);
                updateDoc(myPresenceRef, {
                    isOnline: false,
                    lastSeen: serverTimestamp()
                }).catch(console.error);
            }
        };
    }, [roomId, hasRoomAccess, currentUser, isRoomOwner]);

    // Add speaking detection effect
    useEffect(() => {
        const handleAudioLevel = (userId: string, isSpeaking: boolean) => {
            setSpeakingUsers(prev => {
                const newSet = new Set(prev);
                if (isSpeaking && !isMicMuted) {
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
    }, [isMicMuted]);

    // --- UI Components ---
    const ParticipantGridItem: React.FC<{ participant: PresenceData }> = ({ participant }) => (
        <Grid item xs={6} sm={4} md={3} lg={2}>
            <Paper 
                elevation={speakingUsers.has(participant.userId) ? 4 : 1} 
                sx={{ 
                    p: 1, 
                    textAlign: 'center',
                    position: 'relative',
                    bgcolor: speakingUsers.has(participant.userId) ? 'primary.light' : 'background.paper',
                    transition: 'all 0.3s ease-in-out',
                    border: speakingUsers.has(participant.userId) && !participant.isMuted ? '2px solid' : 'none',
                    borderColor: 'primary.main'
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
                            border: speakingUsers.has(participant.userId) && !participant.isMuted ? '2px solid' : 'none',
                            borderColor: 'primary.main'
                        }}
                    >
                        {participant.displayName?.[0] || participant.username?.[0]}
                    </Avatar>
                    {speakingUsers.has(participant.userId) && !participant.isMuted && (
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
                <Typography variant="caption" display="block">
                    {participant.displayName || participant.username}
                </Typography>
                {/* Only show mute icon if participant is muted AND (it's not the current user OR the current user is connected) */}
                {participant.isMuted && (participant.userId !== currentUser?.uid || isAudioConnected) && (
                    <MicOff 
                        fontSize="small" 
                        color="error"
                        sx={{ position: 'absolute', top: 4, right: 4 }}
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
        </Grid>
    );

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
                <Box sx={{ display: 'flex', gap: 1 }}>
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
        </Box>
    );

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
                    onSubmit={async (data) => {
                        try {
                            const roomRef = doc(db, 'sideRooms', roomId!);
                            await updateDoc(roomRef, data);
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
        </Box>
    );
};

export default SideRoomComponent;