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
    setDoc,
    deleteDoc,
    runTransaction,
    orderBy,
    limit
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
    ListItemIcon,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Popper,
    ClickAwayListener,
    Badge,
    FormControl,
    InputLabel,
    Select,
    Switch,
    FormControlLabel,
    SelectChangeEvent
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
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
    Search as SearchIcon,
    ContentCopy as ContentCopyIcon,
    Instagram as InstagramIcon,
    Facebook as FacebookIcon,
    Twitter as TwitterIcon,
    WhatsApp as WhatsAppIcon,
    Link as LinkIcon,
    Clear as ClearIcon,
    Favorite as FavoriteIcon,
    FavoriteBorder as FavoriteBorderIcon
} from '@mui/icons-material';
import type { SideRoom, RoomMember, UserProfile, RoomStyle} from '../../types/index';
import RoomForm from './RoomForm';
import { audioService } from '../../services/audioService';
import AudioDeviceSelector from '../AudioDeviceSelector';
import { storage } from '../../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import TypingIndicator from '../TypingIndicator';
import { Helmet } from 'react-helmet-async';
import { debounce } from 'lodash';

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
    role?: 'owner' | 'viewer' | 'guest';
}

// --- Room Theme Definitions & Constants ---
interface RoomTheme {
  name: string;
  headerColor: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  headerGradient?: boolean; 
  backgroundGradient?: boolean;
}

const PREDEFINED_THEMES: RoomTheme[] = [
  {
    name: "Classic Light",
    headerColor: '#F5F5F5', // Light Grey
    backgroundColor: '#FFFFFF', // White
    textColor: '#212121', // Almost Black
    accentColor: '#1976D2', // MUI Blue
    headerGradient: false,
    backgroundGradient: false,
  },
  {
    name: "Classic Dark",
    headerColor: '#303030', // Dark Grey
    backgroundColor: '#212121', // Very Dark Grey
    textColor: '#E0E0E0', // Light Grey
    accentColor: '#90CAF9', // Light Blue
    headerGradient: false,
    backgroundGradient: false,
  },
  {
    name: "Midnight Bloom",
    headerColor: '#4A00E0', // Deep Indigo/Purple
    backgroundColor: '#1E1E2F', // Very Dark Blue/Almost Black
    textColor: '#EAEAEA', // Light Grey/Off-white
    accentColor: '#8E2DE2', // Lighter Purple/Magenta
    headerGradient: true,
    backgroundGradient: true,
  },
  {
    name: "Sunset Vibes",
    headerColor: '#FF8C00', // DarkOrange
    backgroundColor: '#FFF3E0', // Very Light Orange/Cream
    textColor: '#4E342E', // Dark Brown
    accentColor: '#FF5722', // DeepOrange
    headerGradient: true,
    backgroundGradient: false,
  },
  {
    name: "Oceanic Calm",
    headerColor: '#0077B6', // Cerulean Blue
    backgroundColor: '#E0F7FA', // Very Light Cyan
    textColor: '#01579B', // Darker Blue
    accentColor: '#00B4D8', // Bright Cyan
    headerGradient: false,
    backgroundGradient: false,
  }
];

const AVAILABLE_FONTS = ['Arial', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New', 'Roboto', 'Open Sans', 'Lato', 'Montserrat'];
const AVAILABLE_TEXT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32]; // in pixels
// --- End Room Theme Definitions & Constants ---

const SideRoomComponent: React.FC = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const theme = useTheme(); // <<<< ENSURE theme IS DEFINED HERE

    // Inject navigate into audioService (this useEffect is fine)
    useEffect(() => {
        audioService.setNavigate(navigate);
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

    // --- State for Heart Feature ---
    const [roomHeartCount, setRoomHeartCount] = useState<number>(0);
    const [currentUserHearted, setCurrentUserHearted] = useState<boolean>(false);
    const [latestHeartNotification, setLatestHeartNotification] = useState<string | null>(null);
    const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // --- State for Video Sharing ---
    const [showShareVideoDialog, setShowShareVideoDialog] = useState(false);
    const [videoInputUrl, setVideoInputUrl] = useState('');
    const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);

    // --- State for Inviting Users ---
    const [inviteSearchQuery, setInviteSearchQuery] = useState('');
    const [inviteSearchResults, setInviteSearchResults] = useState<UserProfile[]>([]);
    const [showInviteDropdown, setShowInviteDropdown] = useState(false);
    const [selectedInviteeForInvite, setSelectedInviteeForInvite] = useState<UserProfile | null>(null);
    const [isInvitingUser, setIsInvitingUser] = useState(false);
    const inviteSearchRef = useRef<HTMLDivElement>(null); // Ref for Popper anchor

    // --- State for Sade AI Chat Integration ---
    const [showSadeChat, setShowSadeChat] = useState(false);
    const [sadeMessages, setSadeMessages] = useState<SadeMessage[]>([]);
    const [sadeInput, setSadeInput] = useState('');
    const [sadeLoading, setSadeLoading] = useState(false);
    const sadeMessagesEndRef = useRef<null | HTMLDivElement>(null); // Ref for scrolling

    // --- State for Preventing Double-Click Issues (Heart Feature) ---
    const [isHearting, setIsHearting] = useState(false);

    // --- State for Style Dialog ---
    const [selectedThemeName, setSelectedThemeName] = useState<string>(PREDEFINED_THEMES[0].name);
    const [useHeaderGradient, setUseHeaderGradient] = useState<boolean>(false);
    const [useBackgroundGradient, setUseBackgroundGradient] = useState<boolean>(false);
    const [selectedFont, setSelectedFont] = useState<string>(AVAILABLE_FONTS[0]);
    const [selectedTextSize, setSelectedTextSize] = useState<number>(AVAILABLE_TEXT_SIZES[2]);

    // --- Effect for Style Dialog Initialization ---
    useEffect(() => {
        if (!showStyleDialog) {
            return; // Do nothing if the dialog is not open
        }

        if (room?.style) {
            const currentStyle = room.style as any; // Use 'as any' for now if themeName is not yet strongly typed on room.style
            
            // Set theme
            const themeExists = PREDEFINED_THEMES.find(t => t.name === currentStyle.themeName);
            setSelectedThemeName(themeExists ? currentStyle.themeName : PREDEFINED_THEMES[0].name);

            // Set gradients - check if the theme itself defines these, otherwise use stored value or default
            const activeTheme = themeExists || PREDEFINED_THEMES[0];
            setUseHeaderGradient(currentStyle.headerGradient !== undefined ? currentStyle.headerGradient : activeTheme.headerGradient || false);
            setUseBackgroundGradient(currentStyle.backgroundGradient !== undefined ? currentStyle.backgroundGradient : activeTheme.backgroundGradient || false);

            // Set font
            setSelectedFont(AVAILABLE_FONTS.includes(currentStyle.font) ? currentStyle.font : AVAILABLE_FONTS[0]);
            
            // Set text size (assuming it was stored as headerFontSize)
            setSelectedTextSize(AVAILABLE_TEXT_SIZES.includes(currentStyle.headerFontSize) ? currentStyle.headerFontSize : AVAILABLE_TEXT_SIZES[2]);
        } else {
            // No current style, initialize with defaults from the first predefined theme
            setSelectedThemeName(PREDEFINED_THEMES[0].name);
            setUseHeaderGradient(PREDEFINED_THEMES[0].headerGradient || false);
            setUseBackgroundGradient(PREDEFINED_THEMES[0].backgroundGradient || false);
            setSelectedFont(AVAILABLE_FONTS[0]);
            setSelectedTextSize(AVAILABLE_TEXT_SIZES[2]);
        }
    }, [showStyleDialog, room]); // Dependencies: dialog visibility and the room object itself

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

    const isGuest = useMemo(() => {
        if (!room || !currentUser?.uid) return false;
        return room.viewers?.some(member => member.userId === currentUser.uid && member.role === 'guest') || false;
    }, [room, currentUser?.uid]);

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
    const ownerData = useMemo(() => {
        // Defensive checks
        if (!room || !room.viewers || !Array.isArray(room.viewers)) {
            console.log('[SideRoomComponent Debug] ownerData: room or room.viewers not available or not an array.');
            return undefined;
        }
    
        // Log the entire viewers array to see its structure and content
        console.log('[SideRoomComponent Debug] Inspecting room.viewers:', JSON.stringify(room.viewers, null, 2));
    
        const foundOwner = room.viewers.find((viewer: RoomMember) => {
            // Log each viewer being checked, including the properties we care about
            console.log(`[SideRoomComponent Debug] Checking viewer: userId=${viewer.userId}, role=${viewer.role}, displayName="${(viewer as any).displayName}", username="${viewer.username}"`);
            return viewer.role === 'owner';
        });
    
        if (foundOwner) {
            // Log the specific owner object that was found
            console.log('[SideRoomComponent Debug] Owner found in room.viewers:', JSON.stringify(foundOwner, null, 2));
            
            // Specifically check the values of displayName and username for the found owner
            const ownerDisplayName = (foundOwner as any).displayName;
            if (typeof ownerDisplayName === 'string' && ownerDisplayName.trim() !== '') {
                console.log(`[SideRoomComponent Debug] Owner displayName is valid: "${ownerDisplayName}"`);
            } else {
                console.warn(`[SideRoomComponent Debug] Owner found, but displayName is missing, empty, or not a string. DisplayName value:`, ownerDisplayName);
            }
            
            if (typeof foundOwner.username === 'string' && foundOwner.username.trim() !== '') {
                console.log(`[SideRoomComponent Debug] Owner username is valid: "${foundOwner.username}"`);
            } else {
                console.warn(`[SideRoomComponent Debug] Owner found, but username is missing, empty, or not a string. Username value:`, foundOwner.username);
            }
        } else {
            console.log('[SideRoomComponent Debug] No member with role "owner" found in room.viewers.');
        }
        return foundOwner;
    }, [room]); // Dependency on `room` is correct as `room.viewers` is part of it

    // --- Audio Handlers ---
    const handleJoinAudio = useCallback(async () => {
        if (!roomId || !currentUser?.uid || isProcessing) return;
        setIsProcessing(true);

        try {
            // const success = await audioService.joinRoom(roomId, currentUser.uid);
            // Updated for passive listening:
            const connectedToReceive = await audioService.connectToReceiveAudio(roomId, currentUser.uid);
            if (connectedToReceive) {
                // Now try to activate microphone
                const micActivated = await audioService.activateMicrophone(roomId, currentUser.uid);
                if (micActivated) {
                    setIsAudioConnected(true); // Indicates mic is active
                    setIsMicMuted(audioService.isMicrophoneMuted()); // Reflect actual mute state
                    toast.success('Microphone activated!');
                } else {
                    toast.error('Could not activate microphone, but you can still listen.');
                    setIsAudioConnected(false); // Mic not active
                }
            } else {
                 throw new Error('Failed to connect to room audio for listening.');
            }
        } catch (error) {
            console.error('Error joining audio/activating mic:', error);
            toast.error('Failed to connect audio.');
            setIsAudioConnected(false);
        } finally {
            setIsProcessing(false);
        }
    }, [roomId, currentUser?.uid, isProcessing]);

    const handleLeaveAudio = useCallback(() => { // This now means deactivate microphone
        if (!roomId || !currentUser?.uid) return;
        audioService.deactivateMicrophone(roomId, currentUser.uid);
        setIsAudioConnected(false); // Mic is no longer active for sending
        setIsMicMuted(true); // Assume muted when mic is off for UI
        toast.success('Microphone deactivated.');
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

    // --- Video Sharing Handlers ---
    const handleOpenShareVideoDialog = () => {
        setShowShareVideoDialog(true);
    };

    const handleCloseShareVideoDialog = () => {
        setShowShareVideoDialog(false);
        setVideoInputUrl(''); // Clear input on close
    };

    const handleShareVideoUrl = () => {
        if (!roomId) {
            toast.error("Cannot share video: Room ID is missing.");
            return;
        }
        if (!videoInputUrl.trim()) {
            toast.error("Please enter a video URL.");
            return;
        }
        // Basic URL validation (can be improved)
        if (!videoInputUrl.startsWith('http://') && !videoInputUrl.startsWith('https://')) {
            toast.error("Invalid URL format.");
            return;
        }

        audioService.shareVideo(roomId, videoInputUrl);
        setCurrentVideoUrl(videoInputUrl); // Optimistically update UI
        toast.success("Video shared!");
        handleCloseShareVideoDialog();
    };

    const handleClearSharedVideo = () => {
        if (!roomId) {
            toast.error("Cannot clear video: Room ID is missing.");
            return;
        }
        if (!isRoomOwner) {
            toast.error("Only the room owner can clear the video.");
            return;
        }
        audioService.shareVideo(roomId, ''); // Send empty string to clear
        setCurrentVideoUrl(null); // Optimistically update UI
        toast.success("Shared video cleared.");
    };

    // --- Cleanup on unmount --- Effect to leave the audio room when the component unmounts
    useEffect(() => {
        // Store roomId and userId in constants for use in cleanup
        const componentRoomId = roomId;
        const componentUserId = currentUser?.uid;

        // Connect for listening when component mounts and we have roomId & user
        if (componentRoomId && componentUserId) {
            audioService.connectToReceiveAudio(componentRoomId, componentUserId)
                .then(success => {
                    if (success) console.log(`[SideRoomComponent] Successfully connected to receive audio for room ${componentRoomId}`);
                    else console.error(`[SideRoomComponent] Failed to connect to receive audio for room ${componentRoomId}`);
                });
        }

        return () => {
            console.log(`[SideRoomComponent] Unmounting room ${componentRoomId} for user ${componentUserId}. Attempting audio cleanup.`);
            if (componentRoomId && componentUserId) {
                 audioService.disconnectFromRoom(componentRoomId, componentUserId);
            }
        };
    }, [roomId, currentUser?.uid]); // Re-run if roomId or user changes

    // --- Room Listener ---
    useEffect(() => {
        if (!roomId || !currentUser) return;

        const roomRef = doc(db, 'sideRooms', roomId);
        const unsubscribeRoom = onSnapshot(roomRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                const roomData = { id: docSnapshot.id, ...docSnapshot.data() } as SideRoom;
                setRoom(roomData);
                setRoomHeartCount(roomData.heartCount || 0); // Set heart count
                setLoading(false);
            } else {
                setError('Room not found');
                setLoading(false);
            }
        });

        // Listener for current user's heart status
        let unsubscribeHeartStatus: (() => void) | undefined;
        if (currentUser?.uid) {
            const heartRef = doc(db, 'sideRooms', roomId, 'heartedBy', currentUser.uid);
            unsubscribeHeartStatus = onSnapshot(heartRef, (heartDoc) => {
                setCurrentUserHearted(heartDoc.exists());
            });
        }

        // Listener for new hearts (for pop-up)
        const heartsQuery = query(
            collection(db, 'sideRooms', roomId, 'heartedBy'),
            orderBy('timestamp', 'desc'),
            limit(1)
        );
        const unsubscribeNewHearts = onSnapshot(heartsQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const heartData = change.doc.data();
                    // Don't show notification for own heart
                    if (heartData.userId !== currentUser?.uid && heartData.username) {
                        setLatestHeartNotification(`${heartData.username} hearted the room!`);
                        if (notificationTimeoutRef.current) {
                            clearTimeout(notificationTimeoutRef.current);
                        }
                        notificationTimeoutRef.current = setTimeout(() => {
                            setLatestHeartNotification(null);
                        }, 3000); // Show for 3 seconds
                    }
                }
            });
        });

        return () => {
            unsubscribeRoom();
            if (unsubscribeHeartStatus) unsubscribeHeartStatus();
            unsubscribeNewHearts();
            if (notificationTimeoutRef.current) {
                clearTimeout(notificationTimeoutRef.current);
            }
        };
    }, [roomId, currentUser]);

    // --- Presence Listener ---
    useEffect(() => {
        if (!roomId || !hasRoomAccess || !currentUser?.uid || !room) {
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
                    userProfilePic = currentUser.photoURL || ''; // Fallback to potentially loaded pic
                }

                // Determine the user's role in this room
                let userRole: 'owner' | 'viewer' | 'guest' = 'viewer'; // Default to viewer
                if (isRoomOwner) { // isRoomOwner is already memoized
                    userRole = 'owner';
                } else if (room && room.viewers?.some(member => member.userId === componentUserId && member.role === 'guest')) { // Added explicit room check here
                    userRole = 'guest';
                }
                // If neither owner nor guest found in viewers, they remain a 'viewer'

                const myPresenceRef = doc(db, 'sideRooms', roomId, 'presence', componentUserId);
                const presenceData: PresenceData = { 
                    userId: componentUserId,
                    username: userUsername, // Use fetched/fallback username
                    avatar: userProfilePic, // Use fetched pic
                    lastSeen: Date.now(), 
                    isOnline: true,
                    role: userRole, // Use the determined role
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

    }, [roomId, hasRoomAccess, currentUser?.uid, isRoomOwner, room]); // Depend on currentUser.uid to re-run if user changes

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

    // --- Effect for Video Sharing Listener ---
    useEffect(() => {
        if (!roomId) return;

        const unsubscribeVideoShared = audioService.onVideoShared((url: string) => {
            console.log(`[SideRoomComponent] Received shared video URL: ${url}`);
            setCurrentVideoUrl(url);
        });

        // Listen for video share failures
        const unsubscribeVideoShareFailed = audioService.onVideoShareFailed((reason: string) => {
            toast.error(`Video share failed: ${reason}`);
        });

        return () => {
            unsubscribeVideoShared();
            unsubscribeVideoShareFailed();
        };
    }, [roomId]);

    // --- Effect to set initial video URL from room data ---
    useEffect(() => {
        if (room && room.currentSharedVideoUrl) {
            setCurrentVideoUrl(room.currentSharedVideoUrl);
        } else if (room && !room.currentSharedVideoUrl) {
            // If the room object exists but has no video URL, ensure local state is also null
            setCurrentVideoUrl(null);
        }
    }, [room]);

    // --- Effect for Invite Listeners ---
    useEffect(() => {
        const unsubInviteSuccess = audioService.onInviteSuccess((data) => {
            toast.success(data.message);
            setIsInvitingUser(false);
            setInviteSearchQuery('');
            setShowInviteDialog(false); // Close dialog on success
        });
        const unsubInviteFailed = audioService.onInviteFailed((data) => {
            toast.error(data.reason);
            setIsInvitingUser(false);
        });
        const unsubGuestJoined = audioService.onGuestJoined((data) => {
            // Assuming room listener will update the room state with new guest in viewers array
            // If not, you might need to manually update room state here
            console.log('Guest joined event received in component:', data);
            toast.success(`${data.guest.displayName || data.guest.username} joined as a guest!`);
            // Potentially refresh room data or optimistically add to UI if presence isn't fast enough
        });

        return () => {
            unsubInviteSuccess();
            unsubInviteFailed();
            unsubGuestJoined();
        };
    }, []); // Empty dependency array, listeners set up once

    // --- Effect for User Search Results for Invite ---
    useEffect(() => {
        const unsubscribe = audioService.onUserSearchResultsForInvite((data) => {
            console.log('[SideRoomComponent] Received search results in component:', data); // Log results arrival
            if (data.error) {
                toast.error(data.error);
                setInviteSearchResults([]);
            } else {
                setInviteSearchResults(data.users);
            }
        });
        return () => unsubscribe();
    }, []);

    // --- Debounced search function for inviting users ---
    const debouncedSearchForInvite = useCallback(
        debounce((query: string) => {
            if (query.trim().length >= 2) {
                console.log(`[SideRoomComponent] Debounced search executing for: "${query.trim()}"`);
                audioService.searchUsersForInvite(query.trim());
            }
        }, 300), // 300ms debounce
        [] // audioService should be stable, not needed in deps
    );

    const handleInviteSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newQuery = event.target.value;
        console.log(`[SideRoomComponent] handleInviteSearchChange: "${newQuery}"`); // Log input change
        setInviteSearchQuery(newQuery);
        setSelectedInviteeForInvite(null); // Clear selected user if query changes
        if (newQuery.trim().length >= 2) {
            setShowInviteDropdown(true);
            debouncedSearchForInvite(newQuery);
        } else {
            setShowInviteDropdown(false);
            setInviteSearchResults([]);
        }
    };

    const handleSelectInvitee = (user: UserProfile) => {
        setSelectedInviteeForInvite(user);
        setInviteSearchQuery(user.username); // Update TextField to show selected username
        setShowInviteDropdown(false);
        setInviteSearchResults([]); // Clear results after selection
    };

    const handleClickAwayInviteDropdown = () => {
        setShowInviteDropdown(false);
    };

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
                            {participant.role === 'guest' && (
                                 <Chip 
                                    label="Guest" 
                                    size="small" 
                                    color="secondary" // Or another distinct color
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

            {/* Video Player Section */}
            {currentVideoUrl && (
                <Box sx={{ mt: 3, mb: 2, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, backgroundColor: 'action.hover' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle1" sx={{ textAlign: 'center', flexGrow: 1 }}>Shared Video</Typography>
                        {isRoomOwner && (
                            <Tooltip title="Clear Shared Video">
                                <IconButton onClick={handleClearSharedVideo} size="small">
                                    <ClearIcon />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                    <Box
                        sx={{
                            position: 'relative',
                            paddingBottom: '56.25%', // 16:9 aspect ratio
                            height: 0,
                            overflow: 'hidden',
                            maxWidth: '100%',
                            background: '#000',
                            '& iframe': {
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                border: 0,
                            },
                        }}
                    >
                        {renderVideoPlayer(currentVideoUrl)}
                    </Box>
                </Box>
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

    const handleOpenInviteDialog = useCallback(() => {
        setShowInviteDialog(true);
        setInviteSearchQuery('');
        setSelectedInviteeForInvite(null);
        setInviteSearchResults([]);
        setShowInviteDropdown(false);
        handleMenuClose();
    }, [handleMenuClose]);

    const handleSendInvite = useCallback(async () => {
        if (!currentUser?.uid || !roomId) return;

        if (!selectedInviteeForInvite || !selectedInviteeForInvite.username) {
            toast.error("Please search and select a user to invite.");
            return;
        }

        setIsInvitingUser(true);
        audioService.inviteUserToRoom(roomId!, currentUser.uid, selectedInviteeForInvite.username);
    }, [currentUser?.uid, roomId, selectedInviteeForInvite, setIsInvitingUser]);

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
        <Box sx={{ 
            p: 2, 
            borderBottom: 1, 
            borderColor: 'divider',
            // Corrected logic for headerGradient
            backgroundColor: room?.style?.headerGradient 
                ? `linear-gradient(to right, ${room?.style?.headerColor || theme.palette.primary.main}, ${room?.style?.accentColor || theme.palette.secondary.light})` // Gradient when true (Switch ON)
                : room?.style?.headerColor || theme.palette.background.paper, // Solid color when false (Switch OFF)
            color: room?.style?.textColor || 'inherit',
        }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography
                        variant="h6"
                        sx={{
                            fontFamily: room?.style?.font || AVAILABLE_FONTS[0],
                            fontSize: room?.style?.headerFontSize ? `${room.style.headerFontSize}px` : '1.25rem',
                            fontWeight: 600,
                            // color is inherited from parent Box
                        }}
                    >
                        {room?.name}
                    </Typography>
                    {ownerData && (
                        <Typography
                            variant="caption"
                            sx={{ 
                                opacity: room?.style?.textColor ? 0.85 : 1, // Slightly less opacity if custom text color
                                fontFamily: room?.style?.font || AVAILABLE_FONTS[0],
                                // color is inherited
                            }}
                        >
                            Host: {ownerData.username}
                        </Typography>
                    )}
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {isAudioConnected && <AudioDeviceSelector />}
                    <Tooltip title={currentUserHearted ? "Unheart Room" : "Heart Room"}>
                        <IconButton 
                            onClick={handleHeartRoom} 
                            color={currentUserHearted ? "error" : "inherit"} 
                            sx={{ color: currentUserHearted ? theme.palette.error.main : room?.style?.accentColor || 'inherit' }}
                            disabled={isHearting}
                        >
                            {currentUserHearted ? <FavoriteIcon /> : <FavoriteBorderIcon />}
                        </IconButton>
                    </Tooltip>
                    <Badge 
                        badgeContent={roomHeartCount > 0 ? roomHeartCount : "0"} 
                        sx={{ 
                            mr: 1,
                            '& .MuiBadge-badge': {
                                backgroundColor: room?.style?.accentColor || theme.palette.primary.main,
                                color: room?.style?.textColor && room?.style?.accentColor ? theme.palette.getContrastText(room.style.accentColor) : theme.palette.primary.contrastText 
                            }
                        }} 
                    >
                    </Badge>
                    <Tooltip title="Share">
                        <IconButton onClick={handleShareRoom} sx={{ color: room?.style?.accentColor || 'inherit' }}>
                            <ShareIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Chat with Sade AI">
                        <Avatar 
                            src="/images/sade-avatar.jpg" 
                            alt="Sade AI Chat"
                            onClick={() => setShowSadeChat(true)} 
                            sx={{ 
                                width: 32, height: 32, cursor: 'pointer', '&:hover': { opacity: 0.8 },
                                border: `1px solid ${room?.style?.accentColor || theme.palette.primary.light}`
                            }}
                        />
                    </Tooltip>
                    {isRoomOwner && (
                        <>
                            <Tooltip title="Room Settings">
                                <IconButton onClick={handleMenuClick} sx={{ color: room?.style?.accentColor || 'inherit' }}>
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
                                {/* Restore Invite option within owner menu */}
                                <MenuItem onClick={handleOpenInviteDialog}>
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
                        <IconButton onClick={() => navigate('/side-rooms')} disabled={isProcessing} sx={{ color: room?.style?.accentColor || 'inherit' }}>
                            <ExitToApp />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography 
                    variant="caption" 
                    sx={{ fontFamily: room?.style?.font || AVAILABLE_FONTS[0] }}
                >
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
                                sx={{ backgroundColor: !isMicMuted && room?.style?.accentColor ? room.style.accentColor : undefined, fontFamily: room?.style?.font || AVAILABLE_FONTS[0], 
                                      color: !isMicMuted && room?.style?.accentColor ? theme.palette.getContrastText(room.style.accentColor) : undefined }}
                            >
                                {isMicMuted ? 'Unmute' : 'Mute'}
                            </Button>
                            <Button
                                variant="outlined"
                                size="small"
                                color="error"
                                onClick={handleLeaveAudio}
                                disabled={isProcessing}
                                sx={{ fontFamily: room?.style?.font || AVAILABLE_FONTS[0] }}
                            >
                                Leave Audio
                            </Button>
                            <Tooltip title="Share Video Link">
                        <IconButton 
                                    onClick={handleOpenShareVideoDialog}
                                    disabled={isProcessing || (!isRoomOwner && !isGuest)} // Allow owner or guest
                                    size="small"
                                    color="secondary"
                                >
                                    <LinkIcon />
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
                            sx={{ backgroundColor: room?.style?.accentColor, fontFamily: room?.style?.font || AVAILABLE_FONTS[0],
                                  color: room?.style?.accentColor ? theme.palette.getContrastText(room.style.accentColor) : undefined }}
                        >
                            Join Audio
                        </Button>
                    )}
                </Box>
            </Box>
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

    // Helper function to get embed URL
    const getVideoEmbedUrl = (url: string): string | null => {
        url = url.trim();
        let videoId: string | null = null;

        // YouTube
        if (url.includes('youtube.com/watch?v=')) {
            videoId = new URL(url).searchParams.get('v');
        } else if (url.includes('youtu.be/')) {
            videoId = url.substring(url.lastIndexOf('/') + 1).split('?')[0];
        }
        if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;

        // TikTok (basic placeholder - requires oEmbed or more complex handling)
        // For now, just returning a message, actual embedding is more complex
        if (url.includes('tiktok.com/')) {
            // Simple iframe approach if available, otherwise might need oEmbed
            // Example: return `https://www.tiktok.com/embed/v2/${videoId}`; (this is hypothetical)
            // toast.info("TikTok embedding is more complex and not fully supported yet in this example.");
            return null; // Or a placeholder iframe if a generic embed exists
        }

        // Instagram Reels (similar to TikTok, requires oEmbed)
        if (url.includes('instagram.com/reel/')) {
            // toast.info("Instagram Reels embedding is more complex and not fully supported yet in this example.");
            return null;
        }
        
        // If no specific platform matched, but it's a direct video file (less common for sharing)
        if (url.match(/\.(mp4|webm|ogg)$/i)) {
          return url; // Can be used in a <video> tag directly
        }

        toast.error("Unsupported video URL or format. Try a YouTube link.");
        return null;
    };

    const renderVideoPlayer = (videoUrl: string) => {
        const embedUrl = getVideoEmbedUrl(videoUrl);

        if (!embedUrl) {
            if (videoUrl.match(/\.(mp4|webm|ogg)$/i)) {
                 return (
                    <video
                        src={videoUrl}
                        controls
                        autoPlay
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        onError={() => toast.error("Failed to load video.")}
                    />
                );
            }
            return <Typography sx={{p:2, textAlign: 'center'}}>Unsupported video link or error loading video.</Typography>;
        }

        if (embedUrl.startsWith('https://www.youtube.com/embed/')) {
            return (
                <iframe
                    src={embedUrl}
                    title="Shared Video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            );
        }
        // Add more conditions here for TikTok, Reels if direct iframe embed URLs are found
        // For now, this will fall through to the unsupported message if getVideoEmbedUrl returns null
        // or a non-YouTube URL that isn't a direct video file.
        return <Typography sx={{p:2, textAlign: 'center'}}>Video format not directly embeddable. Try a YouTube link.</Typography>;
    };

    // --- Heart Feature Handler ---
    const handleHeartRoom = async () => {
        if (!currentUser || !currentUser.uid || !roomId || !room) return;

        const heartRef = doc(db, 'sideRooms', roomId, 'heartedBy', currentUser.uid);
        const roomRef = doc(db, 'sideRooms', roomId);

        try {
            await runTransaction(db, async (transaction) => {
                const heartDoc = await transaction.get(heartRef);
                const roomDoc = await transaction.get(roomRef);

                if (!roomDoc.exists()) {
                    throw "Room does not exist!";
                }

                // const currentHeartCount = roomDoc.data().heartCount || 0; // Not needed for optimistic updates with listeners
                const userProfile = await getDoc(doc(db, 'users', currentUser.uid));
                const username = userProfile.exists() ? userProfile.data()?.username || currentUser.displayName : 'Someone';

                if (heartDoc.exists()) {
                    // Unheart the room
                    transaction.delete(heartRef);
                    transaction.update(roomRef, { heartCount: increment(-1) });
                } else {
                    // Heart the room
                    transaction.set(heartRef, {
                        userId: currentUser.uid,
                        username: username,
                        timestamp: serverTimestamp()
                    });
                    transaction.update(roomRef, { heartCount: increment(1) });
                }
            });
        } catch (error) {
            console.error("Error hearting room:", error);
            toast.error("Failed to update heart status.");
        }
    };

    // --- Construct Meta Tag Values ---
    const pageTitle = room ? `${room.name} - SideEye` : (loading ? 'Loading Room...' : 'Room Not Found - SideEye');
    const pageDescription = room ? (room.description || 'Join the conversation on SideEye.') : 'Join the conversation on SideEye.';
    // Ensure you have a real default image URL
    const defaultImageUrl = `${window.location.origin}/default-app-logo.png`; // Replace with your actual default image path
    const imageUrl = room?.thumbnailUrl || defaultImageUrl;
    const pageUrl = `${window.location.origin}/side-room/${roomId || ''}`;

    // --- Loading & Error States ---
    if (loading && !room) { // Adjusted loading condition to show loading until room data is available for Helmet
        return (
            <>
                <Helmet>
                    <title>Loading Room... - SideEye</title>
                </Helmet>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                    <CircularProgress />
                </Box>
            </>
        );
    }

    if (error && !room) { // Show error if room couldn't be loaded
        return (
             <>
                <Helmet>
                    <title>Error Loading Room - SideEye</title>
                </Helmet>
                <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Alert severity="error">{error}</Alert>
                    <Button onClick={() => navigate('/discover')} sx={{ mt: 2 }}> {/* Changed to /discover */}
                        Back to Discover
                    </Button>
                </Box>
            </>
        );
    }
    
    // --- Style Save Handler (ensure this is correctly defined as per last step) ---
    const handleSaveStyle = async () => {
        if (!roomId || !room) {
            toast.error("Cannot save style: Room data is missing.");
            return;
        }
        if (!currentUser) {
            toast.error("You must be logged in to change the style.");
            return;
        }
        if (!isRoomOwner) {
            toast.error("Only the room owner can change the style.");
            return;
        }

        const selectedTheme = PREDEFINED_THEMES.find(t => t.name === selectedThemeName);
        if (!selectedTheme) {
            toast.error("Invalid theme selected. Defaulting to first theme.");
            const defaultTheme = PREDEFINED_THEMES[0];
            const newStyleFromDefault: RoomStyle = {
                themeName: defaultTheme.name,
                headerColor: defaultTheme.headerColor,
                backgroundColor: defaultTheme.backgroundColor,
                textColor: defaultTheme.textColor,
                accentColor: defaultTheme.accentColor,
                font: selectedFont, 
                headerFontSize: selectedTextSize, 
                headerGradient: useHeaderGradient,
                backgroundGradient: useBackgroundGradient,
                customCss: room.style?.customCss || '',
                bannerUrl: room.style?.bannerUrl || '',
                stickers: room.style?.stickers || [],
                glitterEffect: room.style?.glitterEffect || false, 
                thumbnailUrl: room.style?.thumbnailUrl || room.thumbnailUrl || '' 
            };
             try {
                const roomRef = doc(db, 'sideRooms', roomId);
                await updateDoc(roomRef, { 
                    style: newStyleFromDefault,
                    lastActive: serverTimestamp()
                });
                toast.success('Room style updated (defaulted theme)!');
                setShowStyleDialog(false);
            } catch (error) {
                console.error('Error updating room style with default theme:', error);
                toast.error('Failed to update room style.');
            } finally {
                setIsProcessing(false);
            }
            return; 
        }

        const newStyle: RoomStyle = {
            themeName: selectedTheme.name,
            headerColor: selectedTheme.headerColor,
            backgroundColor: selectedTheme.backgroundColor,
            textColor: selectedTheme.textColor,
            accentColor: selectedTheme.accentColor,
            font: selectedFont,
            headerFontSize: selectedTextSize,
            headerGradient: useHeaderGradient,
            backgroundGradient: useBackgroundGradient,
            customCss: room.style?.customCss || '',
            bannerUrl: room.style?.bannerUrl || '',
            stickers: room.style?.stickers || [],
            glitterEffect: room.style?.glitterEffect || false, 
            thumbnailUrl: room.style?.thumbnailUrl || room.thumbnailUrl || '' 
        };

        setIsProcessing(true);
        try {
            const roomRef = doc(db, 'sideRooms', roomId);
            await updateDoc(roomRef, { 
                style: newStyle,
                lastActive: serverTimestamp()
            });
            toast.success('Room style updated successfully!');
            setShowStyleDialog(false);
        } catch (error) {
            console.error('Error updating room style:', error);
            toast.error('Failed to update room style.');
        } finally {
            setIsProcessing(false);
        }
    };

    // --- Main Return ---
    return (
        <>
            <Helmet>
                <title>{pageTitle}</title>
                <meta name="description" content={pageDescription} />
                {/* Open Graph / Facebook */}
                <meta property="og:type" content="website" />
                <meta property="og:url" content={pageUrl} />
                <meta property="og:title" content={pageTitle} />
                <meta property="og:description" content={pageDescription} />
                <meta property="og:image" content={imageUrl} />
                <meta property="og:image:width" content="1200" />
                <meta property="og:image:height" content="630" />
                {/* Twitter */}
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:url" content={pageUrl} />
                <meta name="twitter:title" content={pageTitle} />
                <meta name="twitter:description" content={pageDescription} />
                <meta name="twitter:image" content={imageUrl} />
            </Helmet>

            <Box sx={{ 
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                fontFamily: room?.style?.font || AVAILABLE_FONTS[0],
                // Corrected logic for backgroundGradient
                backgroundColor: room?.style?.backgroundGradient
                    ? `linear-gradient(to bottom right, ${room?.style?.backgroundColor || theme.palette.background.default}, ${room?.style?.accentColor || theme.palette.secondary.main})` // Gradient when true (Switch ON)
                    : room?.style?.backgroundColor || theme.palette.background.default, // Solid color when false (Switch OFF)
                color: room?.style?.textColor || theme.palette.text.primary,
            }}>
                {/* Conditional rendering of header and content */}
                {room && renderRoomHeader()} 
                {room && renderRoomContent()}
                
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
                                        // Keep existing thumbnail if new upload fails
                                        thumbnailUrl = room?.thumbnailUrl; 
                                    }
                                }

                                const updateData: Partial<SideRoom> = { ...data };
                                
                                // Only update thumbnailUrl if it's a new string value
                                // This prevents accidentally setting it to undefined if thumbnailFile was null
                                // and data.thumbnailUrl was also initially undefined.
                                if (typeof thumbnailUrl === 'string' && thumbnailUrl) {
                                    updateData.thumbnailUrl = thumbnailUrl;
                                } else if (thumbnailUrl === null && data.thumbnailUrl === undefined && room?.thumbnailUrl) {
                                    // This case handles if the user *cleared* an existing thumbnail (not implemented in form, but defensive)
                                    // or if thumbnailFile was null and initialData didn't have one.
                                    // For now, if new thumbnail is null, we keep the old one or let it be.
                                    // If you add a "remove thumbnail" feature, this logic would need adjustment.
                                }

                                await updateDoc(roomRef, updateData);
                                toast.success('Room updated successfully');
                                setShowEditDialog(false);
                            } catch (error) {
                                console.error('Error updating room:', error);
                                toast.error('Failed to update room');
                            } finally {
                                setIsProcessing(false);
                            }
                        }}
                        initialData={room}
                        title="Edit Room"
                        submitButtonText="Save Changes"
                    />
                )}

                {/* Share Video Dialog */}
                <Dialog open={showShareVideoDialog} onClose={handleCloseShareVideoDialog} maxWidth="sm" fullWidth>
                    <DialogTitle>Share a Video</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            margin="dense"
                            id="video-url-input"
                            label="Video URL (YouTube, TikTok, Reels)"
                            type="url"
                            fullWidth
                            variant="standard"
                            value={videoInputUrl}
                            onChange={(e) => setVideoInputUrl(e.target.value)}
                            placeholder="e.g., https://www.youtube.com/watch?v=..."
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleShareVideoUrl();
                                }
                            }}
                        />
                        <Typography variant="caption" color="textSecondary" sx={{mt:1, display: 'block'}}>
                            Currently, YouTube links are best supported for direct embedding.
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseShareVideoDialog}>Cancel</Button>
                        <Button onClick={handleShareVideoUrl} variant="contained">Share Video</Button>
                    </DialogActions>
                </Dialog>

                {/* Share Dialog */}
                <Dialog open={showShareDialog} onClose={() => setShowShareDialog(false)} maxWidth="xs" fullWidth>
                    <DialogTitle sx={{ textAlign: 'center' }}>Share Room</DialogTitle>
                    <DialogContent>
                        <TextField
                            fullWidth
                            value={`${window.location.origin}/side-room/${roomId}`}
                            InputProps={{
                                readOnly: true,
                                endAdornment: (
                                    <IconButton
                                        onClick={() => {
                                            const roomLink = `${window.location.origin}/side-room/${roomId}`;
                                            navigator.clipboard.writeText(roomLink);
                                            toast.success('Room link copied to clipboard!');
                                        }}
                                        edge="end"
                                    >
                                        <ContentCopyIcon />
                                    </IconButton>
                                )
                            }}
                            sx={{ mt: 1 }}
                            label="Room Link"
                            variant="filled"
                        />
                    </DialogContent>
                    <DialogActions sx={{ p: 2, justifyContent: 'center' }}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
                            {[
                                { name: 'Instagram', Icon: InstagramIcon, scheme: 'instagram://', inAppLinkInstructions: "Open Instagram and add it to your Story using the 'Link' sticker, or paste it in a DM." },
                                { name: 'Snapchat', Icon: ChatIcon, scheme: 'snapchat://', inAppLinkInstructions: "Open Snapchat and paste it in a Snap or Chat." }, // Using ChatIcon as placeholder
                                { name: 'TikTok', Icon: MusicNote, scheme: null, inAppLinkInstructions: "Open TikTok and paste the link in your video description or a comment." }, // Using MusicNote as placeholder, no reliable scheme
                                { name: 'X (Twitter)', Icon: TwitterIcon, webUrl: (link: string, text: string) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}` },
                                { name: 'Facebook', Icon: FacebookIcon, webUrl: (link: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}` },
                                { name: 'WhatsApp', Icon: WhatsAppIcon, webUrl: (link: string, text: string) => `https://wa.me/?text=${encodeURIComponent(text + ' ' + link)}` },
                            ].map((platform) => (
                                <Tooltip title={`Share to ${platform.name}`} key={platform.name}>
                                    <IconButton
                                        onClick={async () => {
                                            const roomLink = `${window.location.origin}/side-room/${roomId}`;
                                            const shareTitle = room?.name || 'Check out this Side Room!';
                                            const shareText = `Join the conversation in "${shareTitle}"`; // Link will be added by navigator.share or webUrl

                                            if (navigator.share) {
                                                try {
                                                    await navigator.share({
                                                        title: shareTitle,
                                                        text: `${shareText}: ${roomLink}`, // Include link in text for navigator.share
                                                        url: roomLink,
                                                    });
                                                    toast.success(`Shared to ${platform.name} via system dialog!`);
                                                    setShowShareDialog(false);
                                                    return;
                                                } catch (error) {
                                                    console.warn(`Web Share API failed for ${platform.name}:`, error);
                                                    // Fall through to platform-specific logic if Web Share fails or is cancelled
                                                }
                                            }

                                            // Platform-specific fallback
                                            if (platform.webUrl) {
                                                window.open(platform.webUrl(roomLink, `${shareText}: ${roomLink}`), '_blank');
                                                setShowShareDialog(false);
                                            } else {
                                                // For apps like Instagram, Snapchat, TikTok (clipboard + scheme/instructions)
                                                navigator.clipboard.writeText(roomLink)
                                                    .then(() => {
                                                        toast.success(`Link copied! ${platform.inAppLinkInstructions}`, { duration: 7000 });
                                                        if (platform.scheme) {
                                                            window.open(platform.scheme, '_blank');
                                                        }
                                                    })
                                                    .catch(err => {
                                                        console.error(`Failed to copy link for ${platform.name}: `, err);
                                                        toast.error('Failed to copy link.');
                                                    });
                                                setShowShareDialog(false);
                                            }
                                        }}
                                        size="large"
                                        sx={{ '&:hover': { transform: 'scale(1.1)' } }}
                                    >
                                        <platform.Icon fontSize="large" />
                                    </IconButton>
                                </Tooltip>
                            ))}
                        </Box>
                    </DialogActions>
                     <DialogActions sx={{ justifyContent: 'center', pb: 2}}>
                        <Button onClick={() => setShowShareDialog(false)} >Close</Button>
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

                {/* Invite User Dialog */}
                <Dialog open={showInviteDialog} onClose={() => setShowInviteDialog(false)} maxWidth="xs" fullWidth>
                    <DialogTitle>Invite User to Room</DialogTitle>
                    <ClickAwayListener onClickAway={handleClickAwayInviteDropdown}> 
                        <DialogContent>
                            <TextField
                                autoFocus
                                margin="dense"
                                id="invitee-username-input"
                                label="Search Username to Invite"
                                type="text"
                                fullWidth
                                variant="standard"
                                value={inviteSearchQuery}
                                onChange={handleInviteSearchChange}
                                disabled={isInvitingUser}
                                inputRef={inviteSearchRef} // Attach ref here
                                autoComplete="off"
                                onKeyDown={(e) => {
                                    // Basic Enter key handling - now uses selectedInviteeForInvite
                                    if (e.key === 'Enter' && selectedInviteeForInvite && !isInvitingUser) {
                                        handleSendInvite();
                                    }
                                }}
                            />
                            <Popper
                                open={showInviteDropdown && inviteSearchResults.length > 0}
                                anchorEl={inviteSearchRef.current}
                                placement="bottom-start"
                                style={{ width: inviteSearchRef.current?.offsetWidth, zIndex: 1301 }} // Ensure zIndex is above dialog
                            >
                                <Paper elevation={3} sx={{ mt: 0.5, maxHeight: 200, overflowY: 'auto' }}>
                                    <List dense>
                                        {inviteSearchResults.map((user) => (
                                            <ListItem
                                                key={user.id}
                                                button
                                                onClick={() => handleSelectInvitee(user)}
                                            >
                                                <ListItemAvatar>
                                                    <Avatar src={user.profilePic || undefined} sx={{ width: 32, height: 32 }} />
                                                </ListItemAvatar>
                                                <ListItemText primary={user.name} secondary={`@${user.username}`} />
                                            </ListItem>
                                        ))}
                                    </List>
                                </Paper>
                            </Popper>
                        </DialogContent>
                    </ClickAwayListener>
                    <DialogActions>
                        <Button onClick={() => {
                            setShowInviteDialog(false);
                            setInviteSearchQuery(''); // Use the new state setter
                            setSelectedInviteeForInvite(null);
                            setInviteSearchResults([]);
                            setShowInviteDropdown(false);
                        }} disabled={isInvitingUser}>Cancel</Button>
                        <Button 
                            onClick={handleSendInvite} 
                            variant="contained" 
                            disabled={isInvitingUser || !selectedInviteeForInvite} // Disable if no user selected
                        >
                            {isInvitingUser ? 'Sending Invite...' : 'Send Invite'}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Style Dialog */}
                <Dialog open={showStyleDialog} onClose={() => setShowStyleDialog(false)} maxWidth="xs" fullWidth>
                    <DialogTitle>Customize Room Style</DialogTitle>
                    <DialogContent>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                            <FormControl fullWidth margin="dense">
                                <InputLabel id="theme-select-label">Theme</InputLabel>
                                <Select
                                    labelId="theme-select-label"
                                    value={selectedThemeName}
                                    label="Theme"
                                    onChange={(e: SelectChangeEvent<string>) => setSelectedThemeName(e.target.value)}
                                >
                                    {PREDEFINED_THEMES.map((theme) => (
                                        <MenuItem key={theme.name} value={theme.name}>
                                            {theme.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <FormControlLabel
                                control={<Switch checked={useHeaderGradient} onChange={(e) => setUseHeaderGradient(e.target.checked)} />}
                                label="Use Header Gradient"
                            />
                            <FormControlLabel
                                control={<Switch checked={useBackgroundGradient} onChange={(e) => setUseBackgroundGradient(e.target.checked)} />}
                                label="Use Background Gradient"
                            />

                            <FormControl fullWidth margin="dense">
                                <InputLabel id="font-select-label">Font</InputLabel>
                                <Select
                                    labelId="font-select-label"
                                    value={selectedFont}
                                    label="Font"
                                    onChange={(e: SelectChangeEvent<string>) => setSelectedFont(e.target.value)}
                                >
                                    {AVAILABLE_FONTS.map((font) => (
                                        <MenuItem key={font} value={font}>
                                            {font}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <FormControl fullWidth margin="dense">
                                <InputLabel id="textsize-select-label">Text Size (Header/General)</InputLabel>
                                <Select
                                    labelId="textsize-select-label"
                                    value={selectedTextSize.toString()} // Select value must be string
                                    label="Text Size (Header/General)"
                                    onChange={(e: SelectChangeEvent<string>) => setSelectedTextSize(Number(e.target.value))}
                                >
                                    {AVAILABLE_TEXT_SIZES.map((size) => (
                                        <MenuItem key={size} value={size.toString()}>
                                            {size}px
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ p: 3 }}> {/* <<< FOCUS HERE TO CLEAN UP */}
                        <Button onClick={() => setShowStyleDialog(false)}>Cancel</Button>
                        <Button onClick={handleSaveStyle} variant="contained" disabled={isProcessing}>
                            {isProcessing ? 'Saving...' : 'Save Style'}
                        </Button>
                        {/* ENSURE NO OTHER BUTTONS/LOGIC FROM SHARE DIALOG ARE HERE */}
                    </DialogActions>
                </Dialog>
            </Box>
            {/* Heart Notification Pop-up */}
            {latestHeartNotification && (
                <Paper 
                    elevation={4} 
                    sx={{
                        position: 'fixed',
                        bottom: 20,
                        left: 20,
                        p: 1.5,
                        backgroundColor: room?.style?.accentColor || theme.palette.success.light,
                        color: room?.style?.accentColor ? theme.palette.getContrastText(room.style.accentColor) : theme.palette.success.contrastText,
                        borderRadius: '8px',
                        zIndex: 1500, 
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                    }}
                >
                    <FavoriteIcon fontSize="small" />
                    <Typography variant="body2" sx={{ fontFamily: room?.style?.font || AVAILABLE_FONTS[0] }}>{latestHeartNotification}</Typography>
                </Paper>
            )}
        </>
    );
};

export default SideRoomComponent;