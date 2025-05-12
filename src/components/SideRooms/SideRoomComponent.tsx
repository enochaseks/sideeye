import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth, User as AuthContextUser } from '../../contexts/AuthContext'; // Import and alias AuthContext.User
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
    limit,
    Timestamp, // Ensure Timestamp is imported if used
    deleteField // Import deleteField
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
    SelectChangeEvent,
    Card,
    CardContent,
    Tabs,
    Tab
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
    Mic, // Re-added Mic
    MicOff, // Re-added MicOff
    VolumeUp, // Re-added VolumeUp
    VolumeUp as VolumeUpIcon, // Re-added VolumeUpIcon (KEEP FIRST ONE)
    VolumeOff as VolumeOffIcon, // Re-added VolumeOffIcon
    PersonRemove,
    MusicNote, // Re-added MusicNote
    UploadFile,
    MoreVert as MoreVertIcon,
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
    FavoriteBorder as FavoriteBorderIcon,
    ScreenShare as ScreenShareIcon, // ADDED
    StopScreenShare as StopScreenShareIcon, // ADDED
    // VolumeUp as VolumeUpIcon // REMOVE DUPLICATE
    PushPin as PushPinIcon,
    Videocam as VideocamIcon, // ADDED for camera toggle
    VideocamOff as VideocamOffIcon, // ADDED for camera toggle
    Close as CloseIcon, // ADDED for PiP close button
    PictureInPicture as PictureInPictureIcon, // ADDED for PiP toggle button
    Send as SendIcon,
    ZoomIn as ZoomInIcon,
    ZoomOut as ZoomOutIcon,
    PictureInPictureAlt as PictureInPictureAltIcon,
    Tune as TuneIcon,
    VolumeDown as VolumeDownIcon
} from '@mui/icons-material';
import type { SideRoom, RoomMember, UserProfile, RoomStyle} from '../../types/index';
import RoomForm from './RoomForm';
// import { audioService } from '../../services/audioService'; // REMOVED
import { streamService } from '../../services/streamService'; // ADDED
import { 
    Call, 
    StreamVideo, 
    StreamCall, 
    useStreamVideoClient, 
    CallControls, 
    useCallStateHooks, 
    StreamVideoClient, 
    User, 
    useCall, 
    ParticipantView, 
    StreamVideoParticipant,
    ParticipantsAudio, // ADD THIS IMPORT
    // Audio, // REMOVE THIS IMPORT
    // Track // REMOVE Track import
} from '@stream-io/video-react-sdk'; // UPDATED Stream imports, ADD useCall
// import AudioDeviceSelector from '../AudioDeviceSelector'; // REMOVED for now, Stream handles devices
import { storage } from '../../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import TypingIndicator from '../TypingIndicator';
import { Helmet } from 'react-helmet-async';
import { debounce } from 'lodash';
import { io, Socket } from 'socket.io-client'; // Import socket.io-client

// --- YouTube Iframe Player API Types (Basic) ---
declare global {
    interface Window {
        onYouTubeIframeAPIReady?: () => void;
        YT?: {
            Player: new (id: string, options: YT.PlayerOptions) => YT.Player;
            PlayerState: {
                ENDED: number;
                PLAYING: number;
                PAUSED: number;
                BUFFERING: number;
                CUED: number;
            };
        };
    }
}

namespace YT {
    export interface Player {
        playVideo: () => void;
        pauseVideo: () => void;
        stopVideo: () => void;
        loadVideoById: (videoId: string) => void;
        destroy: () => void;
        getPlayerState: () => number;
        // Add other methods as needed
    }
    export interface PlayerOptions {
        height?: string;
        width?: string;
        videoId?: string;
        playerVars?: PlayerVars;
        events?: PlayerEvents;
    }
    export interface PlayerVars {
        autoplay?: 0 | 1;
        controls?: 0 | 1;
        rel?: 0 | 1;
        // Add other vars as needed
    }
    export interface PlayerEvents {
        onReady?: (event: { target: Player }) => void;
        onStateChange?: (event: { data: number; target: Player }) => void;
        // Add other events as needed
    }
}
// --- End YouTube Iframe Player API Types ---


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
  },
  // Anime-inspired themes
  {
    name: "Sakura Dream",
    headerColor: '#F8BBD0', // Soft Pink
    backgroundColor: '#FCE4EC', // Very Light Pink
    textColor: '#880E4F', // Dark Pink
    accentColor: '#EC407A', // Medium Pink
    headerGradient: true,
    backgroundGradient: true,
  },
  {
    name: "Cyber Neon",
    headerColor: '#000000', // Black
    backgroundColor: '#0D0221', // Very Dark Purple
    textColor: '#00FF9F', // Bright Neon Green
    accentColor: '#FF00E4', // Bright Neon Pink
    headerGradient: true,
    backgroundGradient: true,
  },
  {
    name: "Shonen Hero",
    headerColor: '#FF9800', // Orange
    backgroundColor: '#FFF9C4', // Very Light Yellow
    textColor: '#BF360C', // Deep Red-Orange
    accentColor: '#F57F17', // Dark Amber
    headerGradient: true,
    backgroundGradient: false,
  },
  {
    name: "Magic Academy",
    headerColor: '#4527A0', // Deep Purple
    backgroundColor: '#E8EAF6', // Very Light Indigo
    textColor: '#283593', // Dark Indigo
    accentColor: '#7C4DFF', // Deep Purple Accent
    headerGradient: true,
    backgroundGradient: false,
  },
  {
    name: "Tokyo Night",
    headerColor: '#1A237E', // Dark Indigo
    backgroundColor: '#0D1117', // Very Dark Blue-Black
    textColor: '#E1F5FE', // Very Light Blue
    accentColor: '#2979FF', // Bright Blue
    headerGradient: true,
    backgroundGradient: true,
  },
  {
    name: "Spirit Forest",
    headerColor: '#2E7D32', // Dark Green
    backgroundColor: '#E8F5E9', // Very Light Green
    textColor: '#1B5E20', // Dark Green
    accentColor: '#00C853', // Light Green A700
    headerGradient: true,
    backgroundGradient: false,
  },
  // Cutesy Girly Themes
  {
    name: "Cotton Candy",
    headerColor: '#F48FB1', // Pink
    backgroundColor: '#F8BBD0', // Light Pink
    textColor: '#AD1457', // Dark Pink
    accentColor: '#CE93D8', // Light Purple
    headerGradient: true,
    backgroundGradient: true,
  },
  {
    name: "Fairy Tale",
    headerColor: '#E1BEE7', // Light Purple
    backgroundColor: '#F3E5F5', // Very Light Purple
    textColor: '#6A1B9A', // Dark Purple
    accentColor: '#BA68C8', // Medium Purple
    headerGradient: true,
    backgroundGradient: true,
  },
  {
    name: "Pastel Princess",
    headerColor: '#FFCDD2', // Light Red
    backgroundColor: '#FAFAFA', // Almost White
    textColor: '#C2185B', // Pink
    accentColor: '#FFB74D', // Light Orange
    headerGradient: true,
    backgroundGradient: false,
  },
  {
    name: "Unicorn Dream",
    headerColor: '#B39DDB', // Light Purple
    backgroundColor: '#EDE7F6', // Very Light Purple
    textColor: '#512DA8', // Deep Purple
    accentColor: '#81D4FA', // Light Blue
    headerGradient: true,
    backgroundGradient: true,
  },
  {
    name: "Kawaii Kitty",
    headerColor: '#FFCCBC', // Light Orange
    backgroundColor: '#FFF3E0', // Lighter Orange
    textColor: '#D84315', // Deep Orange
    accentColor: '#FF8A65', // Medium Orange
    headerGradient: true,
    backgroundGradient: false,
  },
  {
    name: "Bubblegum Pop",
    headerColor: '#F06292', // Medium Pink
    backgroundColor: '#FCE4EC', // Very Light Pink
    textColor: '#880E4F', // Dark Pink
    accentColor: '#64B5F6', // Light Blue
    headerGradient: true,
    backgroundGradient: true,
  }
];

const AVAILABLE_FONTS = [
  // Standard System Fonts
  'Arial', 
  'Verdana', 
  'Georgia', 
  'Times New Roman', 
  'Courier New', 
  'Roboto', 
  'Open Sans', 
  'Lato', 
  'Montserrat',
  
  // Anime-Style Fonts
  'Comic Sans MS', 
  'Comic Neue',
  'Bangers',
  'Kalam',
  'Indie Flower',
  'Permanent Marker',
  'Architects Daughter',
  'Fredoka One',
  
  // Girly/Fancy Fonts
  'Pacifico',
  'Dancing Script',
  'Satisfy',
  'Great Vibes',
  'Playball',
  'Sacramento',
  'Tangerine',
  'Petit Formal Script'
];

const AVAILABLE_TEXT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32]; // in pixels
// --- End Room Theme Definitions & Constants ---

const SideRoomComponent: React.FC = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const theme = useTheme(); 

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
    const [selectedSoundFile, setSelectedSoundFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- State for Stream ---
    const [streamToken, setStreamToken] = useState<string | null>(null);
    const [streamClientForProvider, setStreamClientForProvider] = useState<StreamVideoClient | null>(null);
    const [activeStreamCallInstance, setActiveStreamCallInstance] = useState<Call | null>(null);
    const [isStreamJoiningCall, setIsStreamJoiningCall] = useState<boolean>(false);
    const [attemptToJoinCall, setAttemptToJoinCall] = useState<boolean>(false); 

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
    
    // --- Socket State for Invite Feature --- (Initialized to null)
    const [socket, setSocket] = useState<Socket | null>(null); 

    // --- State for Sade AI Chat Integration ---
    const [showSadeChat, setShowSadeChat] = useState(false);
    const [sadeMessages, setSadeMessages] = useState<SadeMessage[]>([]);
    const [sadeInput, setSadeInput] = useState('');
    const [sadeLoading, setSadeLoading] = useState(false);
    const sadeMessagesEndRef = useRef<null | HTMLDivElement>(null);

    // --- Suggestions for Sade AI ---
    const sadeSuggestions = [
        "Tell me a fun fact",
        "What does 'innit' mean?",
        "Play 'Would You Rather?'",
        "Help me relax with a breathing exercise",
        "How's the weather?",
        "What can you do?"
    ];

    // --- State for Preventing Double-Click Issues (Heart Feature) ---
    const [isHearting, setIsHearting] = useState(false);

    // --- State for Style Dialog ---
    const [selectedThemeName, setSelectedThemeName] = useState<string>(PREDEFINED_THEMES[0].name);
    const [useHeaderGradient, setUseHeaderGradient] = useState<boolean>(false);
    const [useBackgroundGradient, setUseBackgroundGradient] = useState<boolean>(false);
    const [selectedFont, setSelectedFont] = useState<string>(AVAILABLE_FONTS[0]);
    const [selectedTextSize, setSelectedTextSize] = useState<number>(AVAILABLE_TEXT_SIZES[2]);

    const presenceClearTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // --- State for Owner Leave Confirmation --- (NEW)
    const [showEndRoomConfirmDialog, setShowEndRoomConfirmDialog] = useState(false);

    // --- State for Screen Sharing --- (NEW)
    const [isScreenSharing, setIsScreenSharing] = useState(false); // Local state to manage button appearance
    const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024); // Example breakpoint for desktop
    const [activeScreenSharerId, setActiveScreenSharerId] = useState<string | null>(null);

    // --- State for YouTube Player ---
    const [youtubePlayer, setYoutubePlayer] = useState<YT.Player | null>(null);
    const youtubePlayerPlaceholderId = 'youtube-player-placeholder';

    // --- Effect for Desktop Check --- (NEW)
    useEffect(() => {
        const handleResize = () => {
            setIsDesktop(window.innerWidth > 1024);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- Socket.IO Connection useEffect --- (NEW)
    useEffect(() => {
        // Determine backend URL 
        const backendUrl = 'https://sideeye-backend-production.up.railway.app'; // MODIFIED: Hardcoded backend URL
        console.log(`[SideRoomComponent] Connecting Socket.IO to: ${backendUrl}`);

        // Establish connection
        const socketInstance = io(backendUrl, {
            // Add auth or other options if needed, e.g.:
            // auth: { token: authToken }, 
            // withCredentials: true, // If using cookies/sessions -- ENSURE THIS IS NOT ACTIVE FOR BASIC SOCKET CONNECTION
            reconnectionAttempts: 5, // Example: Limit reconnection attempts
            transports: ['websocket', 'polling'] // Explicitly define transports
        });

        socketInstance.on('connect', () => {
            console.log('[SideRoomComponent] Socket connected:', socketInstance.id);
            setSocket(socketInstance); // Set the socket state upon successful connection
        });

        socketInstance.on('disconnect', (reason) => {
            console.log('[SideRoomComponent] Socket disconnected:', reason);
            setSocket(null); // Clear socket state on disconnect
            // Optional: Handle potential reconnection UI or logic here
        });

        socketInstance.on('connect_error', (error) => {
            console.error('[SideRoomComponent] Socket connection error (raw error object):', error);
            if (error && error.message) {
              console.error('[SideRoomComponent] Socket connection error message:', error.message);
              toast.error(`Chat/Invite connection failed: ${error.message}. Trying to reconnect...`);
            } else {
              toast.error("Chat/Invite connection failed. Trying to reconnect...");
            }
            setSocket(null); // Ensure socket state is null on connection error
        });

        // Cleanup: Disconnect socket when component unmounts
        return () => {
            console.log('[SideRoomComponent] Disconnecting socket...');
            socketInstance.disconnect();
            setSocket(null); // Clear state on unmount
        };
        // Run only once on component mount
    }, []); // Empty dependency array ensures this runs only once

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

    const isViewer = true;
    const hasRoomAccess = !!room && (isRoomOwner || isViewer || isGuest);
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

    // --- Helper function to write user's presence (sets online: true) ---
    const writeUserPresence = useCallback(async (
        currentRoomId: string,
        user: AuthContextUser, // Changed from currentUser to user for clarity as param
        database: typeof db, // Pass db instance
        roomOwner: boolean, // Pass isRoomOwner
        currentRoomData: SideRoom | null // Pass room object
    ) => {
        if (!currentRoomId || !user?.uid || !currentRoomData) {
            console.warn('[Presence Helper] Missing critical data to write presence.');
            return;
        }
        const componentUserId = user.uid;

        try {
            const userProfileRef = doc(database, 'users', componentUserId);
            const userProfileSnap = await getDoc(userProfileRef);
            
            let userDisplayName = '';
            let userProfilePic = '';
            // Use user.email (passed in) instead of currentUser.email
            let userUsername = user.email?.split('@')[0] || `user_${componentUserId.substring(0, 4)}`;

            if (userProfileSnap.exists()) {
                const profileData = userProfileSnap.data() as UserProfile;
                userDisplayName = profileData.name || profileData.username || '';
                userProfilePic = profileData.profilePic || '';
                userUsername = profileData.username || userUsername;
            } else {
                console.warn(`[Presence Helper] Firestore profile missing for ${componentUserId}. Using fallbacks from auth user.`);
                userDisplayName = user.displayName || ''; // Fallback to auth user
                userProfilePic = user.photoURL || '';     // Fallback to auth user
            }

            let userRole: 'owner' | 'viewer' | 'guest' = 'viewer'; // Default to viewer
            if (roomOwner) {
                userRole = 'owner';
            // Use currentRoomData.viewers (passed in) instead of room.viewers
            } else if (currentRoomData.viewers?.some(member => member.userId === componentUserId && member.role === 'guest')) {
                userRole = 'guest';
            }

            const myPresenceRef = doc(database, 'sideRooms', currentRoomId, 'presence', componentUserId);
            const presenceData: PresenceData = { 
                userId: componentUserId,
                username: userUsername,
                avatar: userProfilePic,
                lastSeen: Date.now(), // Use client time for 'online' heartbeats
                isOnline: true, // Always true when this function is called
                role: userRole,
                displayName: userDisplayName,
                photoURL: userProfilePic
            };
            
            console.log(`[Presence Helper] Writing presence for ${componentUserId} in room ${currentRoomId}:`, JSON.stringify(presenceData, null, 2));
            await setDoc(myPresenceRef, presenceData, { merge: true });
            console.log(`[Presence Helper] Presence updated for ${componentUserId}`);

        } catch (profileError) {
            console.error(`[Presence Helper] Error fetching profile or writing presence for ${componentUserId}:`, profileError);
        }
    }, []); // useCallback with empty deps as it's a self-contained utility now, params provide all context

    // --- Effect A: Maintain Online Status & Details ---
    useEffect(() => {
        console.log(`[Presence Effect A] Initializing. RoomId: ${roomId}, HasAccess: ${hasRoomAccess}, CurrentUserUID: ${currentUser?.uid}, IsRoomOwner: ${isRoomOwner}, RoomExists: ${!!room}`);

        if (hasRoomAccess && roomId && currentUser && room) {
            console.log(`[Presence Effect A] Conditions met. Writing/updating presence for user ${currentUser.uid} in room ${roomId}.`);
            writeUserPresence(roomId, currentUser, db, isRoomOwner, room);
        } else {
            console.log(`[Presence Effect A] Conditions NOT met. Skipping presence write. HasAccess: ${hasRoomAccess}, RoomId: ${!!roomId}, CurrentUser: ${!!currentUser}, Room: ${!!room}`);
        }
        // No cleanup here that sets offline. Cleanup for going offline is in Effect B.
    }, [roomId, currentUser, db, isRoomOwner, room, hasRoomAccess, writeUserPresence]); // Dependencies for updating presence details

    // --- Effect B: Handle Going Offline ---
    useEffect(() => {
        // This effect's primary purpose is its cleanup function.
        // It establishes which user and room we are talking about for the cleanup.
        const effectUserId = currentUser?.uid;
        const effectRoomId = roomId;

        console.log(`[Presence Effect B] Monitoring user ${effectUserId} in room ${effectRoomId} for cleanup.`);

        return () => {
            if (effectUserId && effectRoomId) {
                console.log(`[Presence Effect B - Cleanup] Running for user ${effectUserId} in room ${effectRoomId}. Setting offline.`);
                const userPresenceRef = doc(db, 'sideRooms', effectRoomId, 'presence', effectUserId);
                updateDoc(userPresenceRef, {
                    isOnline: false,
                    lastSeen: serverTimestamp()
                }).catch(error => {
                    if (error.code !== 'not-found') { // Ignore if doc doesn't exist, as it might have been deleted
                        console.error(`[Presence Effect B - Cleanup] Error setting user ${effectUserId} offline:`, error);
                    }
                });
            } else {
                console.log(`[Presence Effect B - Cleanup] Cleanup called but effectUserId or effectRoomId is missing. Skipping Firestore update. UID: ${effectUserId}, RoomID: ${effectRoomId}`);
            }
        };
    }, [roomId, currentUser?.uid, db]); // Dependencies: cleanup runs if room or user changes, or on unmount.

    // --- Audio Handlers ---
    // const handleJoinAudio = useCallback(async () => { // REMOVED ENTIRE FUNCTION
    //     // ... old audioService logic ...
    // }, [roomId, currentUser?.uid, isProcessing]);

    // OLD handlers for audioService are removed.

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

        // audioService.shareVideo(roomId, videoInputUrl); // REMOVED - This was for the old service, video sharing is separate from audio now
        // For now, we assume video sharing is done via Firestore updates as before, independent of Stream audio
        // If Stream is also to handle video, streamService.shareVideo would be needed.
        // For now, let's assume the existing Firestore-based video sharing is still desired
        // and the server's socket.on('share-video', ...) will handle this.
        // To keep the existing video sharing:
        const roomRef = doc(db, 'sideRooms', roomId);
        updateDoc(roomRef, { currentSharedVideoUrl: videoInputUrl, lastActive: serverTimestamp() })
            .then(() => {
                 // Broadcast via a custom mechanism if needed, or rely on Firestore listener.
                 // For simplicity, we assume Firestore listener updates other clients.
                 // If using sockets for this: socket.emit('share-video', { roomId, videoUrl, userId: currentUser.uid });
                 // This part needs to align with how share-video is handled on the backend.
                 // The backend currently has a socket.io 'share-video' listener.
                 // Let's assume for now we need to emit this from the client if Stream isn't handling it.
                 // This requires socket to be passed or accessible. For now, commenting out direct emit.
                 // socket?.emit('share-video', { roomId, videoUrl: videoInputUrl, userId: currentUser?.uid });
                 console.warn("[SideRoomComponent] Video sharing part needs review for signaling if not using Firestore listeners for immediate effect")
            })
            .catch(error => console.error("Error directly updating video URL in Firestore:", error));

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
        // audioService.shareVideo(roomId, ''); // REMOVED
        // Similar to above, update Firestore and rely on listeners or custom signaling.
        const roomRef = doc(db, 'sideRooms', roomId);
        updateDoc(roomRef, { currentSharedVideoUrl: null })
             .catch(error => console.error("Error clearing video URL in Firestore:", error));
        // socket?.emit('share-video', { roomId, videoUrl: '', userId: currentUser?.uid });

        setCurrentVideoUrl(null); // Optimistically update UI
        toast.success("Shared video cleared.");
    };

    // --- Stream API Token Fetch & Client Initialization ---
    // Add hasRoomAccess to dependency array
    useEffect(() => {
        // Check conditions INSIDE the effect
        // Ensure we have a user, a room ID, access permission, AND haven't fetched the token yet.
        if (!currentUser?.uid || !roomId || !hasRoomAccess || streamToken) {
            // If conditions aren't met, explicitly log why we're not fetching
            // console.log(`[Stream Token Fetch Effect] Skipping fetch. User: ${!!currentUser?.uid}, RoomId: ${!!roomId}, HasAccess: ${hasRoomAccess}, TokenExists: ${!!streamToken}`);
            return; 
        }

        // Define the async function inside the effect
        const fetchStreamToken = async () => {
            try {
                console.log("[Stream] Fetching token for user:", currentUser.uid);
                // --- ADD LOGS --- 
                console.log("[Stream] Data being sent - User ID:", currentUser.uid);
                console.log("[Stream] Data being sent - Display Name:", currentUser.displayName);
                console.log("[Stream] Data being sent - Photo URL:", currentUser.photoURL);
                // -------------
                
                // --- Use Absolute URL from Environment Variable ---
                const backendUrl = 'https://sideeye-backend-production.up.railway.app'; // MODIFIED: Hardcoded backend URL
                // if (!backendUrl) { // REMOVED: No longer needed as URL is hardcoded
                //   console.error('REACT_APP_API_URL is not defined in the environment!');
                //   throw new Error('API URL configuration is missing.');
                // }
                const apiUrl = `${backendUrl}/api/stream-token`;
                console.log(`[Stream] Fetching token from: ${apiUrl}`); // Log the full URL
                
                const response = await fetch(apiUrl, { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                         userId: currentUser.uid, // UID should always exist if currentUser is present
                         userName: currentUser.displayName || currentUser.email || 'UnknownUser', // Ensure a fallback
                         userImage: currentUser.photoURL || undefined // Explicitly undefined if not present
                        }),
                });

                // Log status and headers REGARDLESS of response.ok
                console.log(`[Stream] Response status: ${response.status}`);
                const headersObject: Record<string, string> = {}; // FIX: Define type for dynamic keys
                response.headers.forEach((value, key) => { headersObject[key] = value; });
                console.log('[Stream] Response headers:', JSON.stringify(headersObject, null, 2));

                if (!response.ok) {
                    // Attempt to read body even if !ok, might fail
                    let errorData = { error: `HTTP error! Status: ${response.status}` };
                    try {
                        const text = await response.text(); // Try reading as text first
                        console.log('[Stream] Non-OK response body (text):', text);
                        errorData = JSON.parse(text); // Try parsing as JSON
                    } catch (e) {
                        console.warn('[Stream] Could not parse non-OK response body as JSON.', e);
                        // Use the status text as the error message if body parsing fails
                        errorData.error = response.statusText || errorData.error;
                    }
                    // Use the parsed error OR the HTTP status error
                    throw new Error(errorData?.error || `HTTP status ${response.status}`);
                }

                // If response IS ok, proceed to parse JSON
                const { token } = await response.json();
                if (!token) {
                    throw new Error('Stream token was not provided by backend.');
                }
                setStreamToken(token);
                console.log("[Stream] Token fetched successfully.");
            } catch (error: any) { // FIX: Add : any to error
                console.error('[Stream] Error fetching token:', error);
                // Ensure the error message includes the actual error from the catch
                toast.error(`Stream Token Error: ${error.message || 'Load failed'}`); // Modified toast
                setStreamToken(null); // Ensure it's null on error
            }
        };
        
        // Call the function
        fetchStreamToken();

    // Refined dependency array:
    }, [currentUser, roomId, hasRoomAccess, streamToken]); // Added roomId, hasRoomAccess

    useEffect(() => {
        // Log the API Key value (REMOVE THIS LOG IN PRODUCTION LATER)
        console.log(`[Stream Client Init Check] REACT_APP_STREAM_API_KEY value: ${process.env.REACT_APP_STREAM_API_KEY}`);
        
        if (!streamToken || !currentUser?.uid || !process.env.REACT_APP_STREAM_API_KEY || streamClientForProvider) {
             // Add log to show why it might be skipping
             console.log(`[Stream Client Init Effect] Skipping client initialization. Conditions: streamToken=${!!streamToken}, currentUser=${!!currentUser?.uid}, apiKey=${!!process.env.REACT_APP_STREAM_API_KEY}, clientExists=${!!streamClientForProvider}`);
             return;
        }

        console.log("[Stream] Initializing StreamVideoClient with token.");
        // Ensure we use the most reliable source for displayName and photoURL from AuthContext
        const displayName = currentUser.profile?.name || currentUser.displayName || currentUser.email || currentUser.uid; 
        const photoURL = currentUser.profile?.profilePic || currentUser.photoURL || undefined;

        console.log(`[Stream] Client Init - Using displayName: ${displayName}, photoURL: ${photoURL}`);

        const userToConnect: User = { // This is Stream SDK User type
            id: currentUser.uid,
            name: displayName, 
            image: photoURL,
            // custom data can be added here if needed later
        };
        try {
            const client = new StreamVideoClient({
                apiKey: process.env.REACT_APP_STREAM_API_KEY,
                user: userToConnect,
                token: streamToken,
            });
            setStreamClientForProvider(client);
            console.log("[Stream] StreamVideoClient initialized for Provider.");
        } catch (error) {
            console.error("[Stream] Error initializing StreamVideoClient:", error); // Log the full error
            // Ensure toast shows the specific error
            toast.error(`Failed to initialize Stream video client: ${error instanceof Error ? error.message : String(error)}`); 
        }
        // No direct cleanup for client here, StreamVideo provider handles it.
        // To force disconnect on user change/logout:
        return () => {
            if (streamClientForProvider) {
                // streamClientForProvider.disconnectUser().catch(e => console.error("Error disconnecting stream user on cleanup:", e));
                console.log("[Stream] Client will be disconnected by StreamVideo provider or next init.")
                setStreamClientForProvider(null); // Clear the client
            }
        }
    }, [streamToken, currentUser, streamClientForProvider]);

    // --- Effect to Join/Create Stream Call ---
    useEffect(() => {
        if (!attemptToJoinCall || !streamClientForProvider || !roomId || !currentUser?.uid) {
            if (attemptToJoinCall) { 
                setAttemptToJoinCall(false);
            }
            return;
        }

        if (activeStreamCallInstance) {
            console.log("[Stream Call] Call instance already active. Skipping join attempt.");
            setAttemptToJoinCall(false); 
            return;
        }

        const joinCall = async () => {
            console.log(`[Stream Call] Attempting to join/create call with ID: ${roomId}`);
            setIsStreamJoiningCall(true);
            try {
                const call = streamClientForProvider.call('default', roomId);
                await call.join({ create: true }); 
                console.log(`[Stream Call] Successfully joined/created call: ${call.cid}`);
                setActiveStreamCallInstance(call);
            } catch (error: any) {
                console.error('[Stream Call] Error joining or creating call:', error);
                toast.error(`Failed to connect to audio: ${error.message || 'Unknown error'}`);
                setActiveStreamCallInstance(null); 
            } finally {
                setIsStreamJoiningCall(false);
                setAttemptToJoinCall(false); 
            }
        };

        joinCall();

        return () => {
            setAttemptToJoinCall(false); 
        };

    }, [attemptToJoinCall, streamClientForProvider, roomId, currentUser?.uid, activeStreamCallInstance]);


    // --- Effect to Leave Stream Call on Unmount or Room Change ---
    useEffect(() => {
        return () => {
            if (activeStreamCallInstance) {
                console.log(`[Stream Call] Leaving active call ${activeStreamCallInstance.cid} on component unmount or room change.`);
                activeStreamCallInstance.leave()
                    .then(() => console.log(`[Stream Call] Successfully left call ${activeStreamCallInstance.cid}`))
                    .catch(err => console.error(`[Stream Call] Error leaving call ${activeStreamCallInstance.cid}:`, err))
                    .finally(() => {
                        setActiveStreamCallInstance(null); 
                    });
            }
        };
    }, [activeStreamCallInstance, roomId]); 

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
                // ADD THIS LOG:
                console.warn(`[SideRoomComponent - Room Listener] Room document for roomId '${roomId}' reported as non-existent. Current error: '${error}'. Setting room state to null.`);
                
                setError('Room not found');
                setRoom(null);
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

    // --- Presence Listener (Effect 1: Reading other users' presence) ---
    useEffect(() => {
        console.log(`[Presence Listener - Others] Initializing. RoomId: ${roomId}, HasAccess: ${hasRoomAccess}, CurrentUserUID: ${currentUser?.uid}`);

        if (!roomId || !hasRoomAccess || !currentUser?.uid) {
            console.warn(`[Presence Listener - Others] Conditions not met. Clearing presence. RoomId: ${roomId}, HasAccess: ${hasRoomAccess}, UserUID: ${currentUser?.uid}`);
             setPresence([]);
             return;
        }

        console.log(`[Presence Listener - Others] Setting up listener for room ${roomId}`);
        const presenceRef = collection(db, 'sideRooms', roomId, 'presence');
        const q = query(presenceRef, where("isOnline", "==", true)); 
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const onlineUsersData = snapshot.docs.map(doc => ({
                userId: doc.id,
                ...doc.data()
            })) as PresenceData[];

            // Directly set presence from the snapshot data
            // The query `where("isOnline", "==", true)` should ensure we only get online users.
            // If the snapshot is empty, onlineUsersData will be an empty array.
            console.log('[Presence Listener - Others] Received presence snapshot. Users:', onlineUsersData.length, onlineUsersData);
            setPresence(onlineUsersData);

        }, (error) => {
            console.error('[Presence Listener - Others] CRITICAL: Snapshot error:', error);
            toast.error("Error listening to room presence updates. See console.");
            setPresence([]); // Clear presence on error to avoid stale data
        });

        return () => {
            console.log(`[Presence Listener - Others] Cleanup for room ${roomId}.`);
            unsubscribe();
            // Remove timeout clearing as ref is removed
            // if (presenceClearTimeoutRef.current) {
            //     clearTimeout(presenceClearTimeoutRef.current);
            // }
        };
    }, [roomId, hasRoomAccess, currentUser?.uid, db]); // Minimal dependencies: db added as it's used directly

    // --- Presence Writer (Effect 2: Writing current user's own presence) ---
    useEffect(() => {
        console.log(`[Presence Writer - Self] Initializing. RoomId: ${roomId}, HasAccess: ${hasRoomAccess}, CurrentUserUID: ${currentUser?.uid}, IsRoomOwner: ${isRoomOwner}, RoomExists: ${!!room}`);

        if (!roomId || !currentUser?.uid || !room || !hasRoomAccess) {
            // If conditions aren't met to be 'online' in this room, try to set offline if we were previously online.
            // This handles cases like losing access or room becoming null.
            console.warn(`[Presence Writer - Self] Conditions not met. Attempting to set self offline. RoomId: ${roomId}, UserUID: ${currentUser?.uid}, HasAccess: ${hasRoomAccess}, RoomExists: ${!!room}`);
            if (currentUser?.uid && roomId) { // Ensure these are available for cleanup
                const myPresenceRef = doc(db, 'sideRooms', roomId, 'presence', currentUser.uid);
                updateDoc(myPresenceRef, { isOnline: false, lastSeen: serverTimestamp() })
                    .then(() => console.log(`[Presence Writer - Self] Successfully set self offline due to unmet conditions for user ${currentUser.uid} in room ${roomId}`))
                    .catch(err => {
                        if (err.code !== 'not-found') { // Ignore if doc doesn't exist
                            console.error(`[Presence Writer - Self] Error setting self offline (unmet conditions) for ${currentUser.uid}:`, err);
                        }
                    });
            }
            return; // Stop further execution if not fully ready
        }

        const componentUserId = currentUser.uid; // Stable user ID for async operations
        console.log(`[Presence Writer - Self] Proceeding to write presence for user ${componentUserId} in room ${roomId}.`);

        const fetchProfileAndWritePresence = async () => {
            try {
                const userProfileRef = doc(db, 'users', componentUserId);
                const userProfileSnap = await getDoc(userProfileRef);
                
                let userDisplayName = '';
                let userProfilePic = '';
                let userUsername = currentUser.email?.split('@')[0] || `user_${componentUserId.substring(0, 4)}`;

                if (userProfileSnap.exists()) {
                    const profileData = userProfileSnap.data() as UserProfile;
                    userDisplayName = profileData.name || profileData.username || '';
                    userProfilePic = profileData.profilePic || '';
                    userUsername = profileData.username || userUsername;
                    console.log(`[Presence Writer - Self Profile Fetch] Fetched profile for ${componentUserId}: Name='${userDisplayName}', Pic='${userProfilePic}', Username='${userUsername}'`);
                } else {
                    console.warn(`[Presence Writer - Self Profile Fetch] Firestore profile missing for ${componentUserId}. Using fallbacks.`);
                    userDisplayName = currentUser.displayName || '';
                    userProfilePic = currentUser.photoURL || '';
                }

                let userRole: 'owner' | 'viewer' | 'guest' = 'viewer';
                if (isRoomOwner) {
                    userRole = 'owner';
                } else if (room.viewers?.some(member => member.userId === componentUserId && member.role === 'guest')) {
                    userRole = 'guest';
                }

                const myPresenceRef = doc(db, 'sideRooms', roomId, 'presence', componentUserId);
                const presenceData: PresenceData = { 
                    userId: componentUserId,
                    username: userUsername,
                    avatar: userProfilePic,
                    lastSeen: Date.now(), // Use client time for 'online' heartbeats, serverTimestamp for 'offline'
                    isOnline: true,
                    role: userRole,
                    displayName: userDisplayName,
                    photoURL: userProfilePic
                };
                // --- ADDED DEBUG LOG ---
                const myPresenceRefPath = `sideRooms/${roomId}/presence/${componentUserId}`;
                console.log('[DEBUG Presence Writer] Attempting setDoc to path:', myPresenceRefPath, 'with data:', JSON.stringify(presenceData, null, 2));
                // --- END DEBUG LOG ---
                console.log(`[Presence Writer - Self Debug] Data being written to presence:`, presenceData);
        
                await setDoc(myPresenceRef, presenceData, { merge: true });
                console.log(`[Presence Writer - Self] Presence updated for ${componentUserId}`);

            } catch (profileError) {
                console.error(`[Presence Writer - Self] Error fetching profile or writing presence for ${componentUserId}:`, profileError);
            }
        };

        fetchProfileAndWritePresence();

        // Cleanup: Set user offline when dependencies change causing effect to re-run or on unmount
        return () => {
            console.log(`[Presence Writer - Self] Cleanup running for user ${componentUserId} in room ${roomId}. Setting offline.`);
            const userPresenceRef = doc(db, 'sideRooms', roomId, 'presence', componentUserId);
            updateDoc(userPresenceRef, {
                isOnline: false,
                lastSeen: serverTimestamp()
            }).catch(error => {
                 if (error.code !== 'not-found') { 
                    console.error(`[Presence Writer - Self] Error setting user ${componentUserId} offline during cleanup:`, error);
                 }
            });
        };
    }, [roomId, currentUser, db, isRoomOwner, room, hasRoomAccess]); // Dependencies for writing own presence

    // --- Effect for Video Sharing Listener ---
    useEffect(() => {
        if (!roomId) return;

        // const unsubscribeVideoShared = audioService.onVideoShared((url: string) => { // REMOVED
        //     console.log(`[SideRoomComponent] Received shared video URL: ${url}`);
        //     setCurrentVideoUrl(url);
        // });

        // // Listen for video share failures
        // const unsubscribeVideoShareFailed = audioService.onVideoShareFailed((reason: string) => { // REMOVED
        //     toast.error(`Video share failed: ${reason}`);
        // });

        // For video sharing, we're now relying on Firestore updates.
        // The onSnapshot listener for the room document should pick up changes to currentSharedVideoUrl.
        // If faster updates are needed, a dedicated socket event could be used from backend to client.

        return () => {
            // unsubscribeVideoShared(); // REMOVED
            // unsubscribeVideoShareFailed(); // REMOVED
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

    // --- Effect for Invite Listeners --- (Ensure this uses the socket state)
    useEffect(() => {
        if (!socket) {
            // console.warn("[SideRoomComponent] Socket for invites is not initialized. Invite listeners inactive.");
            return; 
        }
        // ... (Keep listener setup: handleInviteSuccess, handleInviteFailed, etc.) ...
        const handleInviteSuccess = (data: { username: string; message: string }) => {
            toast.success(data.message);
            setIsInvitingUser(false);
            setInviteSearchQuery('');
            setSelectedInviteeForInvite(null);
            setInviteSearchResults([]);
            setShowInviteDialog(false); // Close dialog on success
        };
        const handleInviteFailed = (data: { reason: string; username?: string }) => {
            toast.error(data.username ? `${data.username}: ${data.reason}` : data.reason);
            setIsInvitingUser(false);
        };
        const handleGuestJoined = (data: { roomId: string; guest: RoomMember }) => {
            // Ensure the event is for the current room before showing toast
            if (data.roomId === roomId) { 
                toast.success(`${data.guest.displayName || data.guest.username} joined as a guest!`);
                // Optionally update local state if presence isn't fast enough
            }
        };
        const handleUserSearchResults = (data: { users: UserProfile[]; error?: string }) => {
            if (data.error) {
                toast.error(data.error);
                setInviteSearchResults([]);
            } else {
                setInviteSearchResults(data.users);
            }
        };

        // Listener for when the current user is removed from the room by the host
        const handleBeenRemoved = (removedInRoomId: string) => {
            if (removedInRoomId === roomId && currentUser?.uid) { // Ensure it's this room and user is defined
                toast("The host has removed you from the room."); // Changed from toast.info
                activeStreamCallInstance?.leave()
                    .catch(err => console.error("[SideRoomComponent] Error leaving Stream call after being removed:", err))
                    .finally(() => {
                        navigate('/side-rooms'); // Navigate to the main room list
                    });
                // Additional cleanup of local room-specific state might be done here if necessary,
                // but navigation and Stream leave should cover most.
            }
        };

        socket.on('invite-success', handleInviteSuccess);
        socket.on('invite-failed', handleInviteFailed);
        socket.on('guest-joined', handleGuestJoined);
        socket.on('user-search-results-for-invite', handleUserSearchResults);
        socket.on('force-remove', handleBeenRemoved); // Listen for the server's force-remove directive

        return () => {
            socket.off('invite-success', handleInviteSuccess);
            socket.off('invite-failed', handleInviteFailed);
            socket.off('guest-joined', handleGuestJoined);
            socket.off('user-search-results-for-invite', handleUserSearchResults);
            socket.off('force-remove', handleBeenRemoved); // Clean up listener
        };
    }, [socket, roomId, navigate, activeStreamCallInstance, currentUser?.uid]); // Depend on socket, roomId, navigate, call instance, and currentUser

    // --- Debounced search function for inviting users --- (Ensure this uses the socket state)
    const debouncedSearchForInvite = useCallback(
        debounce((query: string) => {
            if (query.trim().length >= 2) {
                if (socket) {
                    console.log(`Emitting search-users-for-invite: "${query.trim()}"`);
                    socket.emit('search-users-for-invite', { searchTerm: query.trim() });
                } else {
                    console.warn("[SideRoomComponent] Socket not available for search-users-for-invite.");
                    toast.error("Cannot search users: connection issue.");
                }
            }
        }, 300), 
        [socket] // Depend on socket state
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
    // REMOVE ParticipantGridItem component definition
    /*
    const ParticipantGridItem: React.FC<{ participant: PresenceData }> = ({ participant }) => {
        // ... removed component logic ...
    };
    */

    // REMOVE renderRoomContent function definition
    /* 
    const renderRoomContent = () => (
        // ... removed function logic ...
    );
    */

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
        setShowEditDialog(true); // Ensure this sets the state
        handleMenuClose();
    }, [handleMenuClose]);

    const handleStyleRoom = useCallback(() => {
        setShowStyleDialog(true); // Ensure this sets the state
        handleMenuClose();
    }, [handleMenuClose]);

    const handleOpenInviteDialog = useCallback(() => {
        setShowInviteDialog(true); // Ensure this sets the state
        setInviteSearchQuery('');
        setSelectedInviteeForInvite(null);
        setInviteSearchResults([]);
        setShowInviteDropdown(false);
        handleMenuClose();
    }, [handleMenuClose]);

    const handleSendInvite = useCallback(async () => {
        setIsInvitingUser(true);
        if (socket && currentUser?.uid && roomId && selectedInviteeForInvite?.username) {
            console.log(`Emitting invite-user-to-room: ${selectedInviteeForInvite.username}`);
            socket.emit('invite-user-to-room', { 
                roomId, 
                inviterId: currentUser.uid, 
                inviteeUsername: selectedInviteeForInvite.username 
            });
            // Let the 'invite-success' or 'invite-failed' listeners handle UI updates
        } else {
            console.warn("Could not send invite due to missing socket, user, room, or selected invitee info.", { socket: !!socket, currentUser: !!currentUser?.uid, roomId, selectedInviteeForInvite });
            toast.error("Cannot send invite: connection or user data issue.");
            setIsInvitingUser(false); // Reset processing state immediately on client-side error
        }
    }, [currentUser?.uid, roomId, selectedInviteeForInvite, socket]); // Depend on socket state

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
                navigate('/side-rooms'); // Navigate away after deletion
            } catch (error) {
                console.error('Error deleting room:', error);
                toast.error('Failed to delete room');
            } finally {
                 // Ensure processing state is reset even if navigation happens
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
                    {/* {isAudioConnected && <AudioDeviceSelector />} // REMOVED AudioDeviceSelector for now */}
                    {/* Placeholder for Stream device controls if needed - Could go inside InsideStreamCallContent */}
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
                    {isRoomOwner && (
                     <Tooltip title="Share Video Link">
                         <IconButton 
                             onClick={handleOpenShareVideoDialog}
                             size="small"
                             color="secondary"
                         >
                             <LinkIcon />
                        </IconButton>
                    </Tooltip>
                    )}
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
                                <MenuItem onClick={handleEditRoom}> {/* Verify onClick assignment */}
                                    <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
                                    Edit Room
                                </MenuItem>
                                <MenuItem onClick={handleStyleRoom}> {/* Verify onClick assignment */}
                                    <ListItemIcon><Palette fontSize="small" /></ListItemIcon>
                                    Customize
                                </MenuItem>
                                {/* Restore Invite option within owner menu */}
                                <MenuItem onClick={handleOpenInviteDialog}> {/* Verify onClick assignment */}
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
                        <IconButton 
                            onClick={() => {
                                if (isRoomOwner) {
                                    // Owner: Show confirmation dialog
                                    setShowEndRoomConfirmDialog(true);
                                } else {
                                    // Non-owner: Navigate away directly
                                    navigate('/side-rooms');
                                }
                            }} 
                            disabled={isProcessing} 
                            sx={{ color: room?.style?.accentColor || 'inherit' }}
                        >
                            <ExitToApp />
                        </IconButton>
                    </Tooltip>
                    {isRoomOwner && isDesktop && activeStreamCallInstance && ( // ADDED screen share button condition
                        <Tooltip title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen (Desktop Only)"}>
                            <IconButton onClick={handleToggleScreenShare} sx={{ color: room?.style?.accentColor || 'inherit' }}>
                                {isScreenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography 
                    variant="caption" 
                    sx={{ fontFamily: room?.style?.font || AVAILABLE_FONTS[0] }}
                >
                    {onlineParticipants.length} Online
                    {/* TODO: Update participant count based on connection state? */}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                   
                    {/* --- Stream Audio Controls --- */}
                    {/* Show Connect button if client is ready but call is not active */}
                    {!activeStreamCallInstance && streamClientForProvider && hasRoomAccess && (
                         <Button
                            variant="contained"
                            size="small"
                            color="primary"
                            onClick={() => {
                                console.log("User clicked 'Connect Audio (Stream)' button.");
                                if (activeStreamCallInstance) {
                                    toast("Already connected to audio.", { icon: 'ℹ️' }); 
                                    return;
                                }
                                setAttemptToJoinCall(true); // Trigger the useEffect to join
                            }}
                            startIcon={isStreamJoiningCall ? <CircularProgress size={20} color="inherit"/> : <VolumeUpIcon />}
                            disabled={isStreamJoiningCall || !streamClientForProvider}
                            sx={{ backgroundColor: room?.style?.accentColor, fontFamily: room?.style?.font || AVAILABLE_FONTS[0],
                                  color: room?.style?.accentColor ? theme.palette.getContrastText(room.style.accentColor) : undefined }}
                        >
                            {isStreamJoiningCall ? "Connecting..." : "Connect Audio (Stream)"}
                        </Button>
                    )}
                    
                    {/* Show Leave button and status if call is active */}
                    {activeStreamCallInstance && (
                        <>
                            {/* Add Toggle Microphone Button */}
                            <Tooltip title="Toggle Microphone">
                                <IconButton 
                                    onClick={async () => { // Make async
                                        if (!activeStreamCallInstance?.microphone || !currentUser?.uid || !roomId) return;

                                        // 1. Find current user's presence data to get current mute state
                                        const currentUserPresence = presence.find(p => p.userId === currentUser.uid);
                                        const currentMuteState = currentUserPresence?.isMuted ?? true; // Default to muted if not found
                                        const newMuteState = !currentMuteState;

                                        // 2. Toggle microphone via Stream SDK
                                        try {
                                            await activeStreamCallInstance.microphone.toggle();
                                            console.log(`[Mic Toggle] Stream toggle executed. Intended new state: ${newMuteState}`);

                                            // 3. Update isMuted in Firestore presence for the current user
                                            const userPresenceRef = doc(db, 'sideRooms', roomId, 'presence', currentUser.uid);
                                            await updateDoc(userPresenceRef, { isMuted: newMuteState });
                                            console.log(`[Mic Toggle] Updated Firestore isMuted for ${currentUser.uid} to ${newMuteState}`);

                                            // Optional: Optimistically update local state if needed for faster UI feedback,
                                            // but Firestore listener should handle it.
                                            // setPresence(prev => prev.map(p => p.userId === currentUser.uid ? {...p, isMuted: newMuteState} : p));

                                        } catch (error) {
                                            console.error("[Mic Toggle] Error toggling mic or updating Firestore:", error);
                                            toast.error("Failed to toggle microphone status.");
                                            // Optionally try to revert Firestore state if Stream toggle failed?
                                        }
                                    }} 
                                    color={"primary"} // Keep color consistent or base on theme
                                    disabled={!activeStreamCallInstance?.microphone || !currentUser?.uid || !roomId} // Disable if mic object/user/room isn't ready
                                >
                                    <Mic /> {/* Use a fixed icon - state reflection happens on the card */}
                                </IconButton>
                            </Tooltip>

                            <Typography variant="caption" sx={{ color: 'lightgreen', mr:1 }}>Stream Audio Connected</Typography>
                            <Button
                                variant="outlined"
                                size="small"
                                color="error"
                                onClick={() => {
                                    activeStreamCallInstance?.leave()
                                        .then(() => {
                                            console.log('[Header Leave] Successfully left call, navigating...');
                                            navigate('/side-rooms');
                                        })
                                        .catch(err => {
                                            console.error('[Header Leave] Error leaving call:', err);
                                            // Optionally still navigate or show error
                                            toast.error("Error leaving audio call.");
                                            // navigate('/side-rooms'); // Navigate even on error?
                                        });
                                }}
                                disabled={isStreamJoiningCall} // Disable while connecting? Maybe not necessary
                                sx={{ fontFamily: room?.style?.font || AVAILABLE_FONTS[0] }}
                            >
                                Leave Audio
                            </Button>
                            {/* Add Mute/Unmute button from Stream *inside* InsideStreamCallContent perhaps? */}
                        </>
                    )}

                     {/* Show a spinner if client isn't ready yet */}
                     {!streamClientForProvider && loading && <CircularProgress size={24} />}

                </Box>
            </Box>
        </Box>
    );

    // --- Moderation Handlers (To be defined in SideRoomComponent) --- 
    const handleForceMuteToggle = useCallback(async (targetUserId: string, currentMuteState: boolean) => {
        if (!isRoomOwner || !roomId || targetUserId === currentUser?.uid) return;
        console.log(`Owner toggling mute for ${targetUserId}. Currently muted: ${currentMuteState}`);
        
        const newMuteState = !currentMuteState;
        // This part needs to be adapted. If Stream API provides remote mute, use that.
        // Otherwise, this relies on the target client listening to a 'force-mute' socket event
        // and then muting its own Stream microphone.
        // The current backend emits 'force-mute' to the target client's socket.
        // This presumes the client still has a general socket connection.

        const targetPresenceRef = doc(db, 'sideRooms', roomId, 'presence', targetUserId);
        
        try {
            await updateDoc(targetPresenceRef, { isMuted: newMuteState }); // Update Firestore for UI consistency
            
            // Send signal via existing general socket.io channel if still in use for moderation
            // This assumes the backend `handleMuteToggle` relays this to the target.
            // socket?.emit(newMuteState ? 'force-mute' : 'force-unmute', { roomId, targetUserId });
             console.warn("[SideRoomComponent] handleForceMuteToggle needs to be connected to the correct signaling (e.g., general Socket.IO emit)")


            toast.success(`User ${newMuteState ? 'muted' : 'unmuted'}.`);
        } catch (error) {
             console.error(`Error toggling mute for ${targetUserId}:`, error);
             toast.error('Failed to update mute status.');
        }
    }, [isRoomOwner, roomId, currentUser?.uid, db]); // Added db dependency

    const handleForceRemove = useCallback((targetUserId: string, targetUsername?: string) => {
        if (!isRoomOwner || !roomId || targetUserId === currentUser?.uid || !socket) return;
        
        const name = targetUsername || 'this user';
        if (window.confirm(`Are you sure you want to remove ${name} from the room?`)) {
             console.log(`[SideRoomComponent] Owner removing user ${targetUserId} from room ${roomId}`);
             socket.emit('force-remove', { roomId, targetUserId }); // Emit to server
             toast.success(`Removing ${name}...`); // Optimistic toast
        }
    }, [isRoomOwner, roomId, currentUser?.uid, socket]); // Added socket dependency

    // Add Ban Handler
    const handleForceBan = useCallback((targetUserId: string, targetUsername?: string) => {
        if (!isRoomOwner || !roomId || targetUserId === currentUser?.uid) return;
        
        const name = targetUsername || 'this user';
        if (window.confirm(`Are you sure you want to BAN ${name} from the room? They will be removed and unable to rejoin.`)) {
             console.log(`Owner banning user ${targetUserId} from room ${roomId}`);
             // audioService.sendForceBan(roomId, targetUserId); // REMOVED
             // Use general socket emit:
             // socket?.emit('force-ban', { roomId, targetUserId });
            console.warn("[SideRoomComponent] handleForceBan needs to be connected to the correct signaling (e.g., general Socket.IO emit)")
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

            // Detect if this is a simple greeting or casual message to avoid instructions
            const isSimpleGreeting = /^(hi|hello|hey|sup|yo|wagwan|how are you|how's it going|what's up|good morning|good afternoon|good evening)[\s\W]*$/i.test(trimmedMessage);
            const isInstructionQuery = /how (do|to|can) (I|you)|help me|guide|tutorial|instructions|steps|feature|profile|settings|add|create|change|modify|update|set up/i.test(trimmedMessage);

            const requestBody = {
                message: trimmedMessage, // Send trimmed message
                forceSearch: forceSearch, // Include forceSearch flag
                userId: currentUser.uid, // ADD USER ID
                contextFlags: {
                    avoidAppInstructions: isSimpleGreeting && !isInstructionQuery,
                    isGreeting: isSimpleGreeting,
                    isInstructionQuery: isInstructionQuery,
                    useContextFlags: false // Set to true to enable this feature once server.js is fixed
                }
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
    const getVideoEmbedUrl = (url: string): string | null => { // This will now just return videoId or null
        url = url.trim();
        let videoId: string | null = null;

        // YouTube
        if (url.includes('youtube.com/watch?v=')) {
            videoId = new URL(url).searchParams.get('v');
        } else if (url.includes('youtu.be/')) {
            videoId = url.substring(url.lastIndexOf('/') + 1).split('?')[0];
        }
        if (videoId) return videoId; // Return only videoId

        // TikTok, Instagram, direct files will return null for now
        // as they are not handled by the YouTube API player
        if (url.includes('tiktok.com/') || url.includes('instagram.com/reel/')) {
            toast("TikTok/Instagram Reels will be shown as links soon."); // Ensure this is a standard toast call
            return null;
        }
        if (url.match(/\.(mp4|webm|ogg)$/i)) {
            toast("Direct video files will be shown as links soon."); // Ensure this is a standard toast call
            return null; 
        }

        toast.error("Unsupported video URL. Only YouTube links are currently embeddable.");
            return null;
    };

    // --- Effect for YouTube Player Initialization ---
    useEffect(() => {
        const videoId = currentVideoUrl ? getVideoEmbedUrl(currentVideoUrl) : null;

        const initializePlayer = () => {
            if (youtubePlayer) {
                youtubePlayer.destroy();
                setYoutubePlayer(null);
            }
            if (videoId && document.getElementById(youtubePlayerPlaceholderId)) {
                console.log(`[YouTube API] Initializing player for videoId: ${videoId}`);
                const player = new window.YT!.Player(youtubePlayerPlaceholderId, {
                    videoId: videoId,
                    width: '100%',
                    height: '100%', // Will be controlled by placeholder's parent div size
                    playerVars: {
                        autoplay: 0, // Start with autoplay 0, especially for mobile
                        rel: 0,      // Do not show related videos at the end
                        controls: 1  // Show YouTube player controls
                    },
                    events: {
                        'onReady': (event) => {
                            console.log('[YouTube API] Player ready.');
                            // Optionally, try to play here if on desktop?
                            // event.target.playVideo(); // Be cautious with autoplay
                        },
                        'onStateChange': (event) => {
                            console.log('[YouTube API] Player state changed:', event.data);
                            // Handle state changes if needed (e.g., video ended)
                        }
                    }
                });
                setYoutubePlayer(player);
            } else if (!videoId && youtubePlayer) {
                youtubePlayer.destroy();
                setYoutubePlayer(null);
            }
        };

        if (!window.YT || !window.YT.Player) {
            console.log('[YouTube API] API not ready yet. Setting up onYouTubeIframeAPIReady.');
            // Store a reference to the function to avoid re-defining it if the effect runs multiple times
            // before the API loads. Or, ensure the API script is only loaded once.
            window.onYouTubeIframeAPIReady = () => {
                console.log('[YouTube API] onYouTubeIframeAPIReady called.');
                initializePlayer();
            };
        } else {
            console.log('[YouTube API] API already loaded. Initializing player directly.');
            initializePlayer();
        }

        // Cleanup: Destroy player when component unmounts or video URL changes to null
        return () => {
            if (youtubePlayer) {
                console.log('[YouTube API] Cleaning up player on unmount/URL change.');
                youtubePlayer.destroy();
                setYoutubePlayer(null);
            }
        };
    // Ensure videoId is a dependency if it's derived outside and can change
    // }, [currentVideoUrl, youtubePlayer]); // Removed youtubePlayer from deps to avoid loop on setYoutubePlayer
    }, [currentVideoUrl]); // Re-run when currentVideoUrl changes


    const renderVideoPlayer = (videoUrl: string) => { // videoUrl is still passed for consistency, but videoId is derived in useEffect
        // const videoId = getVideoEmbedUrl(videoUrl); // videoId logic moved to useEffect

        // Always render the placeholder. The useEffect will manage the player instance.
        return <div id={youtubePlayerPlaceholderId} style={{ width: '100%', height: '100%' }} />; 

        // Old iframe logic (REMOVE/COMMENT OUT):
        /*
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
        return <Typography sx={{p:2, textAlign: 'center'}}>Video format not directly embeddable. Try a YouTube link.</Typography>;
        */
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

                const userProfile = await getDoc(doc(db, 'users', currentUser.uid));
                const username = userProfile.exists() ? userProfile.data()?.username || currentUser.displayName : 'Someone';

                if (heartDoc.exists()) {
                    transaction.delete(heartRef);
                    transaction.update(roomRef, { heartCount: increment(-1) });
                } else {
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

    // --- RE-ADD renderRoomContent function definition ---
    const renderRoomContent = () => (
        <Box sx={{ 
            flexGrow: 1, 
            p: 2, 
            // Removing these properties to fix double scrollbar
            // height: '100vh',
            // overflowY: 'auto'
        }}>
            {/* Video Player Section - Render if video exists */}
            {currentVideoUrl && (
                <Box sx={{ mt: 1, mb: 3, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, backgroundColor: 'action.hover' }}>
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

            {/* Participants Grid - Use Firestore data */}
            <Typography variant="h6" gutterBottom>
                Participants ({onlineParticipants.length})
            </Typography>
            <Grid container spacing={2}>
                {onlineParticipants.map((participant) => (
                    // We need ParticipantGridItem back if using this view
                    // For now, just showing basic info
                    <Grid item key={participant.userId} xs={4} sm={3} md={2} lg={2}>
                         <Paper sx={{ p: 1, textAlign: 'center' }}>
                             <Avatar 
                                 src={participant.avatar} 
                                 alt={participant.displayName || participant.username}
                                 sx={{ width: 60, height: 60, margin: 'auto', mb: 1 }}
                             />
                             <Typography variant="caption" display="block" noWrap>
                                 {participant.displayName || participant.username}
                             </Typography>
                             {participant.isMuted && (
                                 <MicOff fontSize="small" color="error" sx={{mt: 0.5}}/>
                             )}
                         </Paper>
                     </Grid>
                ))}
            </Grid>

            {/* Audio Status Alert */}
            {!activeStreamCallInstance && !isStreamJoiningCall && hasRoomAccess && (
                 <Alert severity="warning" sx={{ mt: 2 }}>Audio not connected. Use the button in the header.</Alert>
            )}
            {isStreamJoiningCall && (
                 <Alert severity="info" sx={{ mt: 2 }}>Connecting to room audio...</Alert>
            )}
        </Box>
    );

    // --- Handler for Screen Sharing --- (NEW)
    const handleToggleScreenShare = async () => {
        if (!activeStreamCallInstance) {
            toast.error("Audio/video call not active to share screen.");
            return;
        }
        if (!isDesktop) {
            toast.error("Screen sharing is only available on desktop devices.");
            return;
        }
        try {
            await activeStreamCallInstance.screenShare.toggle();
            const currentlySharing = activeStreamCallInstance.screenShare.enabled;
            setIsScreenSharing(currentlySharing);
            if (currentlySharing) {
                toast.success("Screen sharing started. All participants will see your screen automatically.");
                if (socket && room?.id && currentUser?.uid) {
                    socket.emit('start-screen-share', { roomId: room.id, userId: currentUser.uid });
                }
            } else {
                toast.success("Screen sharing stopped.");
                if (socket && room?.id && currentUser?.uid) {
                    socket.emit('stop-screen-share', { roomId: room.id, userId: currentUser.uid });
                }
            }
        } catch (error: any) {
            console.error("Error toggling screen share:", error);
            if (error.name === 'NotAllowedError' || error.message?.includes('Permission denied')) {
                toast.error("Screen share permission denied. Please allow access in your browser.");
            } else if (error.message?.includes('InvalidStateError')) {
                toast.error("Cannot toggle screen share: an operation is already in progress or call state is invalid.");
            } else if (error.message?.includes("getDisplayMedia is not supported") || error.message?.includes("getDisplayMedia API is not available")){
                toast.error("Screen sharing is not supported by your browser.");
            } else {
                toast.error(`Failed to toggle screen sharing: ${error.message || 'Unknown error'}`);
            }
            if (activeStreamCallInstance.screenShare) {
                 setIsScreenSharing(activeStreamCallInstance.screenShare.enabled);
            }
        }
    };

    // Main return for SideRoomComponent
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
                fontFamily: room?.style?.font || AVAILABLE_FONTS[0],
                // Corrected logic for backgroundGradient
                backgroundColor: room?.style?.backgroundGradient
                    ? `linear-gradient(to bottom right, ${room?.style?.backgroundColor || theme.palette.background.default}, ${room?.style?.accentColor || theme.palette.secondary.main})` // Gradient when true (Switch ON)
                    : room?.style?.backgroundColor || theme.palette.background.default, // Solid color when false (Switch OFF)
                color: room?.style?.textColor || theme.palette.text.primary,
                overflow: 'hidden' // Add this to prevent outer scrollbar
            }}>
                 {/* Always render the main Room Header */}
                 {room && renderRoomHeader()}

                 {/* Main Content Area */}
                 <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                     {/* Loading/Error state BEFORE client/room is ready */}
                    {!room ? ( // Case 1: Room data itself isn't loaded or doesn't exist
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2 }}>
                            {loading && <CircularProgress />} 
                            {/* Ensure error message for room not found also has a way back */}
                            {!loading && <Alert severity="error">Room not found. <Button onClick={() => navigate('/discover')} sx={{ml:1}}>Back to Discover</Button></Alert>}
                         </Box>
                    ) : !streamClientForProvider ? ( // Case 2: Room data IS loaded, but Stream client is NOT ready
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', p: 2, textAlign: 'center' }}>
                            {!process.env.REACT_APP_STREAM_API_KEY && hasRoomAccess ? (
                                <Alert severity="error" sx={{mb: 2}}>
                                    Audio client configuration error. The service cannot be initialized.
                                    <Typography variant="caption" display="block" sx={{mt: 1}}> (Site admin: REACT_APP_STREAM_API_KEY is missing)</Typography>
                                </Alert>
                            ) : (streamToken === null && hasRoomAccess && currentUser?.uid && roomId) || (streamToken !== null && !streamClientForProvider && process.env.REACT_APP_STREAM_API_KEY) ? (
                                // This covers:
                                // 1. Token fetch pending/failed (streamToken is null, but conditions to fetch are met)
                                // 2. Client init pending/failed (streamToken is present, API key is present, but client is not)
                                <>
                                    <CircularProgress sx={{mb: 2}}/>
                                    <Typography>Initializing audio components...</Typography>
                                    <Typography variant="caption">(If this persists, please check your connection or try refreshing.)</Typography>
                                </>
                            ) : !hasRoomAccess && currentUser?.uid ? ( // User is logged in but doesn't have access to this room's audio yet
                                <Alert severity="info" sx={{mb: 2}}>
                                    You currently don't have audio access to this room. If this is a private room, ensure you've joined correctly.
                                </Alert>
                            ) : (
                                // Fallback: stream client not ready, but conditions for active initialization aren't fully met.
                                // This could be due to !currentUser, etc.
                                <Alert severity="info" sx={{mb: 2}}>
                                    Audio service is waiting for user authentication or room access.
                                </Alert>
                            )}
                            <Button onClick={() => window.location.reload()} sx={{mt: 2}} variant="outlined">Refresh Page</Button>
                        </Box>
                    ) : activeStreamCallInstance ? ( // Case 3: Room loaded, Stream client ready, Call active
                         <StreamVideo client={streamClientForProvider}>
                             <StreamCall call={activeStreamCallInstance}>
                                 <InsideStreamCallContent 
                                     // Props required by InsideStreamCallContent
                                     room={room} 
                                     isRoomOwner={isRoomOwner}
                                     isGuest={isGuest}
                                     handleOpenShareVideoDialog={handleOpenShareVideoDialog}
                                     handleClearSharedVideo={handleClearSharedVideo}
                                     currentVideoUrl={currentVideoUrl}
                                     renderVideoPlayer={renderVideoPlayer}
                                     // Ensure moderation handlers are passed correctly
                                     onForceMuteToggle={handleForceMuteToggle}
                                     onForceRemove={handleForceRemove}
                                     onForceBan={handleForceBan}
                                     theme={theme}
                                 />
                             </StreamCall>
                         </StreamVideo>
                     ) : ( // Case 4: Room loaded, Stream client ready, Call NOT active
                         renderRoomContent() // Shows participants and "Audio not connected. Use button in header."
                    )}
                 </Box>
                 
                {/* --- Share Video Dialog --- */}
                <Dialog open={showShareVideoDialog} onClose={handleCloseShareVideoDialog} fullWidth maxWidth="sm">
                    <DialogTitle>Share a Video</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            margin="dense"
                            id="videoUrl"
                            label="Video URL (e.g., YouTube)"
                            type="url"
                            fullWidth
                            variant="standard"
                            value={videoInputUrl}
                            onChange={(e) => setVideoInputUrl(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseShareVideoDialog}>Cancel</Button>
                        <Button onClick={handleShareVideoUrl} variant="contained">Share Video</Button>
                    </DialogActions>
                </Dialog>

                {/* --- Share Room Dialog --- */}
                <Dialog open={showShareDialog} onClose={() => setShowShareDialog(false)} fullWidth maxWidth="xs">
                    <DialogTitle>Share this Room</DialogTitle>
                    <DialogContent sx={{ textAlign: 'center' }}>
                        <Typography variant="subtitle1" gutterBottom>
                            Share this room link:
                        </Typography>
                        <TextField
                            fullWidth
                            variant="outlined"
                            value={pageUrl} // pageUrl is already defined
                            InputProps={{
                                readOnly: true,
                            }}
                            sx={{ mb: 2 }}
                        />
                        <Button 
                            variant="contained" 
                            startIcon={<ContentCopyIcon />}
                                        onClick={() => {
                                navigator.clipboard.writeText(pageUrl);
                                toast.success("Room link copied to clipboard!");
                                        }}
                            sx={{ mb: 2 }}
                        >
                            Copy Link
                        </Button>
                        <Typography variant="subtitle2" gutterBottom>
                            Or share on:
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-around', mt: 1 }}>
                                    <IconButton
                                color="primary" 
                                onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(room?.name || 'Join my SideEye Room!')}`, '_blank')}
                                title="Share on Twitter"
                                    >
                                <TwitterIcon />
                                    </IconButton>
                                    <IconButton
                                color="primary" 
                                onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`, '_blank')}
                                title="Share on Facebook"
                                  >
                                <FacebookIcon />
                                    </IconButton>
                            <IconButton
                                color="primary"
                                onClick={() => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent((room?.name || 'Join my SideEye Room!') + ' ' + pageUrl)}`, '_blank')}
                                title="Share on WhatsApp"
                            >
                                <WhatsAppIcon />
                            </IconButton>
                            {/* Add Instagram Icon Button */}
                            <IconButton
                                color="primary" 
                                onClick={() => {
                                    navigator.clipboard.writeText(pageUrl);
                                    toast.success("Room link copied! Paste it on Instagram.");
                                    window.open('https://www.instagram.com', '_blank'); // Open Instagram in new tab
                                }}
                                title="Copy link & Open Instagram"
                            >
                                <InstagramIcon />
                            </IconButton>
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setShowShareDialog(false)}>Close</Button>
                    </DialogActions>
                </Dialog>

                {/* --- Sade AI Chat Dialog --- */}
                <Dialog 
                    open={showSadeChat} 
                    onClose={() => setShowSadeChat(false)} 
                    fullWidth 
                    maxWidth="sm" 
                    PaperProps={{
                        sx: {
                            height: '80vh', // Adjust height as needed
                                        display: 'flex',
                            flexDirection: 'column'
                        }
                    }}
                >
                    <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        Chat with Sade AI
                        <Tooltip title="Clear Chat History">
                            <IconButton onClick={handleClearSadeChat} size="small">
                                <Delete />
                            </IconButton>
                        </Tooltip>
                    </DialogTitle>
                    <DialogContent sx={{ flexGrow: 1, overflowY: 'auto', p:1 /* Reduce padding */, backgroundColor: theme.palette.background.default }}>
                        <List sx={{p:0}}>
                            {sadeMessages.map((msg, index) => (
                                <ListItem key={index} sx={{ 
                                    display: 'flex', 
                                    flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row',
                                    alignItems: 'flex-end', // Align avatar and bubble nicely
                                    mb: 1,
                                    p:0 // Remove padding from list item itself
                                }}>
                                    {msg.sender === 'ai' && (
                                        <Avatar 
                                            src="/images/sade-avatar.jpg" 
                                            alt="Sade AI"
                                            sx={{ width: 32, height: 32, mr: 1, mb: 0.5 }} // Adjusted margin
                                        />
                                    )}
                                    <Paper 
                                        elevation={1} 
                                        sx={{
                                            p: '6px 12px',
                                            borderRadius: msg.sender === 'user' ? '15px 15px 0 15px' : '15px 15px 15px 0',
                                            bgcolor: msg.sender === 'user' ? 'primary.main' : 'background.paper',
                                            color: msg.sender === 'user' ? 'primary.contrastText' : 'text.primary',
                                            maxWidth: '75%',
                                            wordBreak: 'break-word'
                                        }}
                                    >
                                        {msg.text}
                                    </Paper>
                                </ListItem>
                            ))}
                             {sadeLoading && (
                                <ListItem sx={{ 
                                    display: 'flex',
                                    flexDirection: 'row',
                                    alignItems: 'flex-end',
                                    mb: 1,
                                    p: 0
                                }}>
                                    <Avatar 
                                        src="/images/sade-avatar.jpg" 
                                        alt="Sade AI"
                                        sx={{ width: 32, height: 32, mr: 1, mb: 0.5 }}
                                    />
                                    <Paper 
                                        elevation={1} 
                                        sx={{
                                            p: '6px 12px',
                                            borderRadius: '15px 15px 15px 0',
                                            bgcolor: 'background.paper',
                                            color: 'text.secondary',
                                            maxWidth: '75%',
                                            wordBreak: 'break-word',
                                            animation: 'pulseFade 1.5s infinite',
                                            '@keyframes pulseFade': {
                                                '0%': { opacity: 0.7 },
                                                '50%': { opacity: 1 },
                                                '100%': { opacity: 0.7 }
                                            }
                                        }}
                                    >
                                        Thinking...
                                    </Paper>
                                </ListItem>
                            )}
                            <div ref={sadeMessagesEndRef} />
                        </List>
                    </DialogContent>
                    <DialogActions sx={{ p: 1, borderTop: `1px solid ${theme.palette.divider}`, flexDirection: 'column' }}>
                        {/* Suggestion Chips Area */}
                        {sadeMessages.length <= 1 && !sadeLoading && (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1, justifyContent: 'center', px:1 }}>
                                {sadeSuggestions.map((suggestion, index) => (
                                    <Chip
                                        key={index}
                                        label={suggestion}
                                        onClick={() => sendSadeMessage(suggestion)}
                                        size="small"
                                        variant="outlined"
                                    />
                                ))}
                            </Box>
                        )}
                        <Box sx={{ display: 'flex', width: '100%'}}>
                            <TextField 
                                fullWidth 
                            variant="outlined"
                                size="small" 
                            placeholder="Talk to Sade..."
                                value={sadeInput} 
                            onChange={(e) => setSadeInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && !sadeLoading && sendSadeMessage()}
                            sx={{mr:1}}
                                disabled={sadeLoading}
                            />
                            <IconButton onClick={() => !sadeLoading && sendSadeMessage(sadeInput, false)} disabled={sadeLoading || !sadeInput.trim()} color="primary">
                                <ShareIcon sx={{ transform: 'rotate(-90deg)' }}/> {/* Send Icon */}
                            </IconButton>
                            <IconButton onClick={() => !sadeLoading && sendSadeMessage(sadeInput, true)} disabled={sadeLoading || !sadeInput.trim()} color="secondary" title="Search the web">
                                <SearchIcon /> {/* Search Icon */}
                            </IconButton>
                        </Box>
                     </DialogActions>
                </Dialog>

                {/* --- Edit Room Dialog (using RoomForm) --- */}
                {showEditDialog && room && (
                    <RoomForm
                        open={showEditDialog} // Use state variable for open prop
                        onClose={() => setShowEditDialog(false)}
                        onSubmit={async (updatedData, newThumbnailFile) => {
                            // ... (Submit logic as implemented before)
                            if (!roomId || !currentUser || !room) {
                                toast.error("Error: Missing room or user data.");
                                return;
                            }
                            setIsProcessing(true);
                            try {
                                let thumbnailUrl = room.thumbnailUrl;
                                if (newThumbnailFile) {
                                    const storageRef = ref(storage, `room-thumbnails/${roomId}_${Date.now()}_${newThumbnailFile.name}`);
                                    await uploadBytes(storageRef, newThumbnailFile);
                                    thumbnailUrl = await getDownloadURL(storageRef);
                                }
                                const roomRef = doc(db, 'sideRooms', roomId);
                                const dataToUpdate: Partial<SideRoom> = {
                                    name: updatedData.name,
                                    description: updatedData.description,
                                    isPrivate: updatedData.isPrivate,
                                    tags: updatedData.tags || [],
                                    thumbnailUrl: thumbnailUrl, // Updated or existing URL
                                    lastActive: serverTimestamp() as any, // Cast to any
                                };

                                // Only include password if room is private AND a new password was entered
                                if (updatedData.isPrivate && updatedData.password && updatedData.password.length > 0) {
                                    dataToUpdate.password = updatedData.password;
                                }
                                // If room is being made public, ensure password field is removed/nullified
                                else if (!updatedData.isPrivate) {
                                    // Use deleteField() cast to any to satisfy TS here, updateDoc handles the sentinel
                                    dataToUpdate.password = deleteField() as any; 
                                }
                                // If room remains private but password field was empty, keep existing password (don't set to null)
                                // No explicit action needed here for this case.

                                await updateDoc(roomRef, dataToUpdate);
                                toast.success('Room details updated successfully!');
                                setShowEditDialog(false);
                            } catch (err) {
                                console.error('Error updating room:', err);
                                toast.error('Failed to update room details.');
                            } finally {
                                setIsProcessing(false);
                            }
                        }}
                        initialData={room}
                        title="Edit Room"
                        submitButtonText="Save Changes"
                    />
                )}

                {/* --- Style Dialog --- */}
                <Dialog open={showStyleDialog} onClose={() => setShowStyleDialog(false)} fullWidth maxWidth="sm">
                    <DialogTitle>Customize Room Appearance</DialogTitle>
                    <DialogContent>
                        {/* Form Controls for Style (Theme, Font, Size, Gradients) */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                            <FormControl fullWidth>
                                <InputLabel id="theme-select-label">Theme</InputLabel>
                                <Select labelId="theme-select-label" value={selectedThemeName} label="Theme" onChange={(e: SelectChangeEvent<string>) => setSelectedThemeName(e.target.value)}>
                                    {PREDEFINED_THEMES.map(themeOption => (<MenuItem key={themeOption.name} value={themeOption.name}>{themeOption.name}</MenuItem>))}
                                </Select>
                            </FormControl>
                            <FormControl fullWidth>
                                <InputLabel id="font-select-label">Font</InputLabel>
                                <Select labelId="font-select-label" value={selectedFont} label="Font" onChange={(e: SelectChangeEvent<string>) => setSelectedFont(e.target.value)}>
                                    {AVAILABLE_FONTS.map(fontOption => (<MenuItem key={fontOption} value={fontOption}>{fontOption}</MenuItem>))}
                                </Select>
                            </FormControl>
                            <FormControl fullWidth>
                                <InputLabel id="text-size-select-label">Header Text Size (px)</InputLabel>
                                <Select labelId="text-size-select-label" value={selectedTextSize.toString()} label="Header Text Size (px)" onChange={(e: SelectChangeEvent<string>) => setSelectedTextSize(Number(e.target.value))}>
                                    {AVAILABLE_TEXT_SIZES.map(sizeOption => (<MenuItem key={sizeOption} value={sizeOption.toString()}>{sizeOption}</MenuItem>))}
                                </Select>
                            </FormControl>
                            <FormControlLabel control={<Switch checked={useHeaderGradient} onChange={(e) => setUseHeaderGradient(e.target.checked)} />} label="Use Header Gradient" />
                            <FormControlLabel control={<Switch checked={useBackgroundGradient} onChange={(e) => setUseBackgroundGradient(e.target.checked)} />} label="Use Background Gradient" />
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setShowStyleDialog(false)}>Cancel</Button>
                        <Button onClick={handleSaveStyle} variant="contained" disabled={isProcessing}>
                            {isProcessing ? <CircularProgress size={24} /> : "Save Style"}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* --- Invite Users Dialog --- */}
                <Dialog open={showInviteDialog} onClose={() => { /* Reset states */ setShowInviteDialog(false); setInviteSearchQuery(''); setSelectedInviteeForInvite(null); setInviteSearchResults([]); setShowInviteDropdown(false);}} fullWidth maxWidth="xs">
                    <DialogTitle>Invite User to Room</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" sx={{ mb: 2 }}>Search for a user by their username to invite them as a guest.</Typography>
                        <Box ref={inviteSearchRef} sx={{ position: 'relative' }}>
                            <TextField fullWidth label="Search Username" variant="outlined" value={inviteSearchQuery} onChange={handleInviteSearchChange} sx={{ mb: 1 }}/>
                            {showInviteDropdown && inviteSearchResults.length > 0 && (
                                <Paper elevation={3} sx={{ position: 'absolute', width: '100%', maxHeight: 200, overflowY: 'auto', zIndex: theme.zIndex.modal + 1, mt: 0.5 }}>
                                    <ClickAwayListener onClickAway={handleClickAwayInviteDropdown}>
                                        <List dense>
                                            {inviteSearchResults.map(userResult => (
                                                <ListItem key={userResult.id} button onClick={() => handleSelectInvitee(userResult)}>
                                                    <ListItemAvatar><Avatar src={userResult.profilePic} alt={userResult.username} /></ListItemAvatar>
                                                    <ListItemText primary={userResult.username} secondary={userResult.name} />
                                                </ListItem>
                                            ))}
                                        </List>
                                    </ClickAwayListener>
                                </Paper>
                            )}
                            {showInviteDropdown && inviteSearchResults.length === 0 && inviteSearchQuery.length >= 2 && (
                                <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>No users found matching "{inviteSearchQuery}".</Typography>
                            )}
                        </Box>
                        {selectedInviteeForInvite && (<Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'success.main' }}>Selected: {selectedInviteeForInvite.username}</Typography>)}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => { setShowInviteDialog(false); setInviteSearchQuery(''); setSelectedInviteeForInvite(null); setInviteSearchResults([]); setShowInviteDropdown(false); }}>Cancel</Button>
                        <Button onClick={handleSendInvite} variant="contained" disabled={isInvitingUser || !selectedInviteeForInvite || !socket}>
                            {isInvitingUser ? <CircularProgress size={24} /> : "Send Invite"}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* --- Owner Leave Confirmation Dialog --- (NEW) */}
                <Dialog
                    open={showEndRoomConfirmDialog}
                    onClose={() => setShowEndRoomConfirmDialog(false)}
                    aria-labelledby="end-room-dialog-title"
                    aria-describedby="end-room-dialog-description"
                >
                    <DialogTitle id="end-room-dialog-title">
                        End Room?
                    </DialogTitle>
                    <DialogContent>
                        <Typography variant="body1" id="end-room-dialog-description">
                            Are you sure you want to end this room?
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{mt: 1}}>
                            This will remove everyone and permanently delete the room. This action cannot be undone.
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setShowEndRoomConfirmDialog(false)} disabled={isProcessing}>Cancel</Button>
                        <Button 
                            onClick={() => {
                                setShowEndRoomConfirmDialog(false); // Close dialog
                                handleDeleteRoom(); // Proceed with deletion (confirmation removed from handleDeleteRoom)
                            }} 
                            color="error" 
                            variant="contained" 
                            disabled={isProcessing}
                            autoFocus
                        >
                            {isProcessing ? <CircularProgress size={24} /> : "End and Delete"}
                        </Button>
                    </DialogActions>
                </Dialog>

                        </Box>
        </>
    );
};

export default SideRoomComponent;

// Define Clubhouse-style UI component
const InsideStreamCallContent: React.FC<{ 
    room: SideRoom, 
    isRoomOwner: boolean, 
    isGuest: boolean, 
    handleOpenShareVideoDialog: Function, 
    handleClearSharedVideo: Function, 
    currentVideoUrl: string | null, 
    renderVideoPlayer: (videoUrl: string) => React.ReactNode, 
    onForceMuteToggle: Function, 
    onForceRemove: Function, 
    onForceBan: Function, 
    theme: any
}> = ({ room, isRoomOwner, isGuest, handleOpenShareVideoDialog, handleClearSharedVideo, currentVideoUrl, renderVideoPlayer, onForceMuteToggle, onForceRemove, onForceBan, theme }) => {
    const call = useCall(); 
    const { useParticipants, useCallState, useMicrophoneState, useCameraState } = useCallStateHooks(); 
    const participants = useParticipants(); 
    const { localParticipant } = useCallState(); 
    const { isMute: localUserIsMute } = useMicrophoneState(); 
    const { isEnabled: isCameraEnabled, isTogglePending } = useCameraState(); 
    const navigate = useNavigate(); 

    const { currentUser } = useAuth();

    // Add state for desktop detection
    const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);

    // Add state to track PiP visibility separately from camera state
    const [isPipVisible, setIsPipVisible] = useState(true);
    const [isPipEnlarged, setIsPipEnlarged] = useState(false);

    const [pinnedUserIds, setPinnedUserIds] = useState<string[]>([]);
    
    // Add state for chat tab
    const [activeTab, setActiveTab] = useState<'participants' | 'chat'>('participants');
    const [chatMessages, setChatMessages] = useState<{id: string, userId: string, userName: string, message: string, timestamp: number}[]>([]);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef<null | HTMLDivElement>(null);

    // Screen sharing detection - ensure ALL participants can see it
    const screenSharingParticipant = participants.find(p => p.screenShareStream);
    const isRoomOwnerSharing = screenSharingParticipant?.userId === room.ownerId;

    // This effect ensures screen sharing is properly detected and displayed for ALL participants
    useEffect(() => {
        if (screenSharingParticipant) {
            console.log(`Screen sharing detected from participant ${screenSharingParticipant.name || screenSharingParticipant.userId}`);
            
            // Force stream to attach to the DOM - this ensures it's visible to everyone
            const screenShareStream = screenSharingParticipant.screenShareStream;
            if (screenShareStream) {
                console.log('Screen share stream is available and will be displayed to all participants');
                
                // Create a video element to ensure all participants receive the stream
                const videoEl = document.createElement('video');
                videoEl.autoplay = true;
                videoEl.muted = true;
                videoEl.style.display = 'none';
                videoEl.style.position = 'absolute';
                
                // Attach the stream to the video element
                if (videoEl.srcObject !== screenShareStream) {
                    videoEl.srcObject = screenShareStream;
                    videoEl.play().catch(err => console.error("Failed to play screen share:", err));
                    
                    // Append to body to ensure it stays active
                    document.body.appendChild(videoEl);
                }
                
                // Clean up function
                return () => {
                    if (document.body.contains(videoEl)) {
                        document.body.removeChild(videoEl);
                    }
                };
            }
            
            // Log if it's the room owner to help with debugging
            if (isRoomOwnerSharing) {
                console.log('Room owner is sharing their screen - should be visible to ALL participants');
            }
        }
    }, [screenSharingParticipant, isRoomOwnerSharing]);
    
    // Determine if chat tab should be shown
    const shouldShowChatTab = true; // Always show chat tab
    
    // Screen sharing detection effect
    useEffect(() => {
        // If the room owner is sharing their screen, make sure it's visible to all participants
        if (isRoomOwnerSharing && screenSharingParticipant) {
            // Log for debugging
            console.log("Room owner is sharing screen - should be visible to all participants");
        }
    }, [isRoomOwnerSharing, screenSharingParticipant]);
    
    // Screen sharing effect for all participants
    useEffect(() => {
        if (screenSharingParticipant) {
            console.log(`Screen sharing available from participant: ${screenSharingParticipant.name || screenSharingParticipant.userId}`);
        }
    }, [screenSharingParticipant]);

    // State to cache usernames from Firestore
    const [firestoreUserData, setFirestoreUserData] = useState<{[key: string]: {username: string, avatar?: string}}>({});

    // Fetch Firestore username for a user
    const fetchUserFirestoreData = useCallback(async (userId: string) => {
        if (firestoreUserData[userId]) return firestoreUserData[userId];
        
        try {
            const userProfileRef = doc(db, 'users', userId);
            const userProfileSnap = await getDoc(userProfileRef);
            
            if (userProfileSnap.exists()) {
                const profileData = userProfileSnap.data() as UserProfile;
                const userData = {
                    username: profileData.username || `user_${userId.substring(0, 4)}`,
                    avatar: profileData.profilePic
                };
                
                // Cache the result
                setFirestoreUserData(prev => ({
                    ...prev,
                    [userId]: userData
                }));
                
                return userData;
            } else {
                console.warn(`[Chat] No Firestore profile found for user ${userId}`);
                // Fallback if no profile exists
                const fallbackData = {
                    username: `user_${userId.substring(0, 4)}`,
                    avatar: undefined
                };
                
                setFirestoreUserData(prev => ({
                    ...prev,
                    [userId]: fallbackData
                }));
                
                return fallbackData;
            }
        } catch (error) {
            console.error(`[Chat] Error fetching user data for ${userId}:`, error);
            // Return a fallback on error
            return {
                username: `user_${userId.substring(0, 4)}`,
                avatar: undefined
            };
        }
    }, [firestoreUserData, db]);

    // Remove prefetch effect from here

    // Handler for sending chat messages
    const handleSendChatMessage = useCallback(async () => {
        if (!chatInput.trim() || !currentUser?.uid) return;
        
        // Get the current user's Firestore username
        const userData = await fetchUserFirestoreData(currentUser.uid);
        
        const newMessage = {
            id: `${Date.now()}-${currentUser.uid}`,
            userId: currentUser.uid,
            userName: userData.username,
            message: chatInput.trim(),
            timestamp: Date.now()
        };
        
        setChatMessages(prev => [...prev, newMessage]);
        setChatInput('');
    }, [chatInput, currentUser?.uid, fetchUserFirestoreData]);

    // Screen sharing toggle handler
    const handleToggleScreenShare = useCallback(async () => {
        if (!call) {
            toast.error("Audio/video call not active to share screen.");
            return;
        }
        if (!isDesktop) {
            toast.error("Screen sharing is only available on desktop devices.");
            return;
        }
        try {
            await call.screenShare.toggle();
            // No local state needed as we're using the button directly in the screen share section
            if (call.screenShare.enabled) {
                toast.success("Screen sharing started.");
            } else {
                toast.success("Screen sharing stopped.");
            }
        } catch (error: any) {
            console.error("Error toggling screen share:", error);
            if (error.name === 'NotAllowedError' || error.message?.includes('Permission denied')) {
                toast.error("Screen share permission denied. Please allow access in your browser.");
            } else if (error.message?.includes('InvalidStateError')) {
                toast.error("Cannot toggle screen share: an operation is already in progress or call state is invalid.");
            } else if (error.message?.includes("getDisplayMedia is not supported") || error.message?.includes("getDisplayMedia API is not available")){
                toast.error("Screen sharing is not supported by your browser.");
            } else {
                toast.error(`Failed to toggle screen sharing: ${error.message || 'Unknown error'}`);
            }
        }
    }, [call, isDesktop]);

    // Effect for Desktop Check
    useEffect(() => {
        const handleResize = () => {
            setIsDesktop(window.innerWidth > 1024);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleTogglePinParticipant = (userId: string) => {
        setPinnedUserIds(prevPinnedIds => {
            if (prevPinnedIds.includes(userId)) {
                return prevPinnedIds.filter(id => id !== userId);
            } else {
                return [...prevPinnedIds, userId];
            }
        });
    };

    // Function to show the PiP
    const handleShowPip = () => {
        setIsPipVisible(true);
    };

    // Toggle camera function that can be reused
    const toggleCamera = () => {
        if (call) {
            call.camera.toggle();
        }
    };

    // Auto scroll to bottom when new messages arrive
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const sortedParticipants = useMemo(() => {
        if (!participants || !room?.ownerId) return [];
        
        const ownerParticipant = participants.find(p => p.userId === room.ownerId);
        const pinnedParticipantsList = participants.filter(p => pinnedUserIds.includes(p.userId) && p.userId !== room.ownerId);
        const otherParticipants = participants.filter(p => p.userId !== room.ownerId && !pinnedUserIds.includes(p.userId));

        return [
            ...(ownerParticipant ? [ownerParticipant] : []), 
            ...pinnedParticipantsList, 
            ...otherParticipants 
        ].filter(Boolean); 
    }, [participants, room?.ownerId, pinnedUserIds]);

    // Reset PiP visibility when camera is enabled
    useEffect(() => {
        if (isCameraEnabled) {
            setIsPipVisible(true);
        }
    }, [isCameraEnabled]);

    const gridParticipants = sortedParticipants;

    // Add prefetch effect after gridParticipants is declared
    useEffect(() => {
        if (!participants?.length) return;
        
        const fetchAllUserData = async () => {
            const promises = participants
                .filter(p => !firestoreUserData[p.userId])
                .map(p => fetchUserFirestoreData(p.userId));
            
            await Promise.all(promises);
        };
        
        fetchAllUserData();
    }, [participants, fetchUserFirestoreData, firestoreUserData]);

    const handleLeaveCall = () => {
        call?.leave().then(() => navigate('/side-rooms')); 
    }; 

    const renderCallStatusHeader = () => ( 
        <Box sx={{ 
            p: 1, 
            borderBottom: 1, 
            borderColor: 'divider', 
            textAlign: 'center', 
            flexShrink: 0, 
            backgroundColor: room?.style?.headerGradient 
                ? `linear-gradient(to right, ${room?.style?.headerColor || theme.palette.primary.main}, ${room?.style?.accentColor || theme.palette.secondary.light})` 
                : room?.style?.headerColor || alpha(theme.palette.background.paper, 0.95),
            color: room?.style?.textColor || 'inherit'
        }}>
            <Typography 
                variant="body2" 
                fontWeight="medium"
                sx={{ 
                    fontFamily: room?.style?.font || 'inherit'
                }}
            >
                {room.name}
            </Typography>
            <Typography 
                variant="caption" 
                color={room?.style?.textColor ? alpha(room?.style?.textColor, 0.8) : "text.secondary"}
                sx={{
                    fontFamily: room?.style?.font || 'inherit'
                }}
            >
                (Mic: {localUserIsMute ? 'Muted' : 'On'})
            </Typography>
            </Box>
        );

    useEffect(() => {
        if (call && currentUser?.uid && room?.id && typeof localUserIsMute === 'boolean' && db) { 
            const userPresenceRef = doc(db, 'sideRooms', room.id, 'presence', currentUser.uid);
            const userPresencePath = `sideRooms/${room.id}/presence/${currentUser.uid}`;
            console.log('[DEBUG Mute Sync] Attempting updateDoc to path:', userPresencePath, 'with data:', JSON.stringify({ isMuted: localUserIsMute }, null, 2));
            updateDoc(userPresenceRef, { isMuted: localUserIsMute })
                .then(() => {
                    console.log(`[InsideStreamCallContent] Synced local mute state (${localUserIsMute}) to Firestore for ${currentUser.uid}`);
                })
                .catch(error => {
                    console.error(`[InsideStreamCallContent] Error syncing local mute state to Firestore for ${currentUser.uid}:`, error);
                });
        }
    }, [localUserIsMute, call, currentUser?.uid, room?.id, db]); 

    // This effect creates a direct connection to screen sharing for all participants
    useEffect(() => {
        if (!call || !participants || participants.length === 0) return;
        
        // Find any participant who is sharing their screen
        const screensharer = participants.find(p => p.screenShareStream);
        if (screensharer) {
            console.log(`Screen sharing detected from: ${screensharer.name || screensharer.userId}`);
            
            // Create a video element to ensure all participants receive the stream
            const videoEl = document.createElement('video');
            videoEl.autoplay = true;
            videoEl.muted = true;
            videoEl.style.display = 'none';
            videoEl.style.position = 'absolute';
            
            // Attach the stream to the video element
            if (screensharer.screenShareStream && videoEl.srcObject !== screensharer.screenShareStream) {
                videoEl.srcObject = screensharer.screenShareStream;
                videoEl.play().catch(err => console.error("Failed to play screen share:", err));
                
                // Append to body to ensure it stays active
                document.body.appendChild(videoEl);
                
                // Log for debugging
                console.log("Screen share stream attached and should be visible to ALL participants");
            }
            
            // Clean up function
            return () => {
                if (videoEl && document.body.contains(videoEl)) {
                    document.body.removeChild(videoEl);
                }
            };
        }
    }, [call, participants]);

    if (!call) {
        return (
             <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1, height: '100%' }}>
                <CircularProgress />
                 <Typography sx={{ ml: 1 }}>Loading call infrastructure...</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%', 
            width: '100%', 
            fontFamily: room?.style?.font || 'inherit',
            backgroundColor: room?.style?.backgroundGradient
                ? `linear-gradient(to bottom right, ${room?.style?.backgroundColor || theme.palette.background.default}, ${room?.style?.accentColor || theme.palette.secondary.main})` 
                : room?.style?.backgroundColor || theme.palette.background.default,
            color: room?.style?.textColor || theme.palette.text.primary
        }}>
            {renderCallStatusHeader()}
            
            <Box sx={{
                flexGrow: 1, 
                p: 2, 
                // Removing overflowY to fix double scrollbar issue
                // overflowY: 'auto', 
            }}>
                 {screenSharingParticipant && (
                    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Typography variant="h6" align="center" sx={{ 
                            mt: 2, 
                            mb: 1, 
                            fontWeight: 500,
                            color: room?.style?.accentColor || theme.palette.primary.main
                        }}>
                            {screenSharingParticipant.userId === currentUser?.uid ? 
                                "You are sharing your screen" : 
                                `${screenSharingParticipant.name || 'Someone'} is sharing their screen`}
                            {isRoomOwnerSharing && screenSharingParticipant.userId !== currentUser?.uid && " (Room Owner)"}
                        </Typography>
                        <Box sx={{ 
                            m: 0,
                            p: 0,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: '8px',
                            backgroundColor: '#000',
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            height: 'auto',
                            width: '90%',
                            maxWidth: '1200px',
                            margin: '0 auto',
                            marginTop: 2,
                            marginBottom: 2,
                            overflow: 'hidden',
                            boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                        }}>
                            {/* Show screen share when PiP is not enlarged, ensuring all participants can see it */}
                            {!isPipEnlarged && (
                            <Box sx={{
                                width: '100%', 
                                paddingTop: '56.25%', // 16:9 aspect ratio (9/16 = 0.5625)
                                overflow: 'hidden', 
                                position: 'relative', 
                                border: 'none',
                                '& .str-video__screen-share-info': {
                                    display: 'none !important',
                                    visibility: 'hidden !important',
                                    opacity: 0,
                                    height: 0,
                                    overflow: 'hidden',
                                    pointerEvents: 'none',
                                    position: 'absolute',
                                    zIndex: -9999
                                },
                                '& .str-video__participant-details, & .str-video__participant-bar, & .str-video__loading-indicator, & .str-video__screen-share-text, & .str-video__screen-share-status, & .str-video__participant__name, & .str-video__participant__info, & .str-video__participant-flag, & div[class*="screen-share"], & span[class*="presentation"]': {
                                    display: 'none !important',
                                    visibility: 'hidden !important',
                                    opacity: 0,
                                    height: 0,
                                    width: 0,
                                    overflow: 'hidden',
                                    pointerEvents: 'none'
                                },
                                '& .str-video__participant-view': { 
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100% !important',
                                    height: '100% !important',
                                    border: 'none',
                                    display: 'flex', 
                                    justifyContent: 'center', 
                                    alignItems: 'center', 
                                    '& video': { 
                                        width: '100%', 
                                        height: '100%', 
                                        objectFit: 'contain',
                                        background: '#000'
                                    },
                                    '& .str-video__participant-details': {
                                        display: 'none !important'
                                    },
                                    '& .str-video__participant-status': {
                                        display: 'none !important'
                                    },
                                    '& .str-video__participant-flag-container': {
                                        display: 'none !important'
                                    }
                                },
                            }}>
                                <ParticipantView 
                                    participant={screenSharingParticipant} 
                                    trackType="screenShareTrack" 
                                />
                            </Box>
                            )}
                            
                            {/* Make sure everyone can see the screen share regardless of who is sharing */}
                            {screenSharingParticipant && !isPipEnlarged && (
                                <Box sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    zIndex: -1, // Hidden but keeps the stream active for all participants
                                    opacity: 0,
                                    pointerEvents: 'none'
                                }}>
                                    {/* This ensures the screen share stream is active for all participants */}
                                    <video 
                                        autoPlay 
                                        playsInline
                                        ref={(el) => {
                                            if (el && screenSharingParticipant?.screenShareStream) {
                                                if (el.srcObject !== screenSharingParticipant.screenShareStream) {
                                                    el.srcObject = screenSharingParticipant.screenShareStream;
                                                    el.play().catch(err => console.error("Error playing screen share:", err));
                                                }
                                            }
                                        }}
                                    />
                                </Box>
                            )}
                            
                            {/* Show enlarged camera when PiP is enlarged */}
                            {isPipEnlarged && isPipVisible && localParticipant && (
                                <Box sx={{
                                    width: '100%', 
                                    paddingTop: '56.25%', // Maintain 16:9 aspect ratio
                                    overflow: 'hidden', 
                                    position: 'relative', 
                                    border: 'none',
                                    backgroundColor: '#000',
                                    '& .str-video__participant-view': { 
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100% !important',
                                        height: '100% !important',
                                        border: 'none',
                                        display: 'flex', 
                                        justifyContent: 'center', 
                                        alignItems: 'center', 
                                        '& video': { 
                                            width: '100%', 
                                            height: '100%', 
                                            objectFit: 'cover',
                                            background: '#000'
                                        }
                                    }
                                }}>
                                    {isCameraEnabled ? (
                                        <ParticipantView participant={localParticipant} trackType="videoTrack" />
                                    ) : (
                                        <Box sx={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            color: 'white',
                                            backgroundColor: 'rgba(0,0,0,0.8)'
                                        }}>
                                            <VideocamOffIcon sx={{ fontSize: '5rem' }} />
                                        </Box>
                                    )}
                                    
                                    <IconButton
                                        size="medium"
                                        onClick={toggleCamera}
                                        sx={{
                                            position: 'absolute',
                                            top: 16,
                                            right: 80,
                                            padding: '8px',
                                            color: 'white',
                                            backgroundColor: 'rgba(0,0,0,0.5)',
                                            '&:hover': {
                                                backgroundColor: 'rgba(0,0,0,0.7)',
                                            }
                                        }}
                                    >
                                        {isCameraEnabled ? 
                                            <VideocamIcon /> : 
                                            <VideocamOffIcon />
                                        }
                                    </IconButton>
                                    
                                    <IconButton
                                        size="medium"
                                        onClick={() => setIsPipEnlarged(false)}
                                        sx={{
                                            position: 'absolute',
                                            top: 16,
                                            right: 16,
                                            padding: '8px',
                                            color: 'white',
                                            backgroundColor: 'rgba(0,0,0,0.5)',
                                            '&:hover': {
                                                backgroundColor: 'rgba(0,0,0,0.7)',
                                            }
                                        }}
                                    >
                                        <CloseIcon />
                                    </IconButton>
                                </Box>
                            )}
                            
                            <Box sx={{ 
                                position: 'absolute',
                                top: 10,
                                right: 10,
                                zIndex: 10
                            }}>
                                {isRoomOwner && (
                                    <Button
                                        variant="contained"
                                        color="error"
                                        size="small"
                                        startIcon={<StopScreenShareIcon />}
                                        onClick={handleToggleScreenShare}
                                        sx={{ 
                                            borderRadius: '20px',
                                            textTransform: 'none',
                                            py: 0.5,
                                            px: 1.5,
                                            bgcolor: 'error.main',
                                            fontWeight: 'bold',
                                            minWidth: 0,
                                            boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                                            fontFamily: room?.style?.font || 'inherit'
                                        }}
                                    >
                                        Stop
                                    </Button>
                                )}
                            </Box>

                            {/* Only show small PiP when not enlarged */}
                            {!isPipEnlarged && isPipVisible && localParticipant && (
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        bottom: 16,
                                        right: 16,
                                        width: '160px', // Reduced from original size
                                        height: '90px', // Reduced from original size
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        border: '2px solid',
                                        borderColor: 'primary.main',
                                        backgroundColor: '#000',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                        zIndex: 10,
                                        '& .str-video__participant-view': {
                                            width: '100%',
                                            height: '100%',
                                            '& video': {
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover'
                                            }
                                        }
                                    }}
                                >
                                    {isCameraEnabled ? (
                                        <ParticipantView participant={localParticipant} trackType="videoTrack" />
                                    ) : (
                                        <Box sx={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            color: 'white',
                                            backgroundColor: 'rgba(0,0,0,0.8)'
                                        }}>
                                            <VideocamOffIcon sx={{ fontSize: '1.5rem' }} />
                                        </Box>
                                    )}
                                    
                                    <IconButton
                                        size="small"
                                        onClick={toggleCamera}
                                        sx={{
                                            position: 'absolute',
                                            top: 2,
                                            right: 26,
                                            padding: '2px',
                                            color: 'white',
                                            backgroundColor: 'rgba(0,0,0,0.5)',
                                            '&:hover': {
                                                backgroundColor: 'rgba(0,0,0,0.7)',
                                            }
                                        }}
                                    >
                                        {isCameraEnabled ? 
                                            <VideocamIcon sx={{ fontSize: '0.9rem' }} /> : 
                                            <VideocamOffIcon sx={{ fontSize: '0.9rem' }} />
                                        }
                                    </IconButton>
                                    
                                    <IconButton
                                        size="small"
                                        onClick={() => setIsPipEnlarged(true)}
                                        sx={{
                                            position: 'absolute',
                                            top: 2,
                                            right: 2,
                                            padding: '2px',
                                            color: 'white',
                                            backgroundColor: 'rgba(0,0,0,0.5)',
                                            '&:hover': {
                                                backgroundColor: 'rgba(0,0,0,0.7)',
                                            }
                                        }}
                                    >
                                        <ZoomInIcon sx={{ fontSize: '0.9rem' }} />
                                    </IconButton>
                                </Box>
                            )}
                        </Box>
                    </Box>
                 )}
                 {/* End Screen Share Display Section */}

                 {currentVideoUrl && (
                     <Box sx={{ mt: 1, mb: 3, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, backgroundColor: 'action.hover' }}>
                         <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                             <Typography 
                                 variant="subtitle1" 
                                 sx={{ 
                                     textAlign: 'center', 
                                     flexGrow: 1,
                                     fontFamily: room?.style?.font || 'inherit',
                                     color: room?.style?.textColor || 'inherit'
                                 }}
                             >
                                 Shared Video
                             </Typography>
                             {isRoomOwner && (
                                 <Tooltip title="Clear Shared Video">
                                     <IconButton 
                                         onClick={() => handleClearSharedVideo()} 
                                         size="small"
                                         sx={{
                                             color: room?.style?.accentColor || 'inherit'
                                         }}
                                     >
                                         <ClearIcon />
                                     </IconButton>
                                 </Tooltip>
                             )}
                         </Box>
                         <Box
                             sx={{
                                 position: 'relative',
                                 paddingBottom: '56.25%', 
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

                 {/* Tabs UI */}
                 <Box sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
                     <Tabs 
                         value={activeTab} 
                         onChange={(_, newValue) => setActiveTab(newValue)}
                         aria-label="room content tabs"
                         sx={{ 
                             '& .MuiTab-root': {
                                 fontFamily: room?.style?.font || 'inherit',
                                 color: room?.style?.textColor || 'inherit',
                                 opacity: 0.7
                             },
                             '& .Mui-selected': {
                                 color: `${room?.style?.accentColor || theme.palette.primary.main} !important`,
                                 opacity: 1
                             },
                             '& .MuiTabs-indicator': {
                                 backgroundColor: room?.style?.accentColor || theme.palette.primary.main
                             }
                         }}
                     >
                         <Tab 
                             label={`Participants (${gridParticipants.length})`} 
                             value="participants" 
                         />
                         {shouldShowChatTab && (
                             <Tab 
                                 label="Chat" 
                                 value="chat" 
                                 icon={<Badge 
                                     color="primary" 
                                     variant="dot" 
                                     invisible={activeTab === 'chat' || chatMessages.length === 0}
                                     sx={{
                                         '& .MuiBadge-badge': {
                                             backgroundColor: room?.style?.accentColor || theme.palette.primary.main
                                         }
                                     }}
                                 />}
                                 iconPosition="end"
                             />
                         )}
                     </Tabs>
                 </Box>

                 {/* Participants Tab Content */}
                 {activeTab === 'participants' && (
                     <>
                {gridParticipants.length > 0 && <ParticipantsAudio participants={gridParticipants} />}

                <Grid container spacing={2}>
                             {gridParticipants.map((p: StreamVideoParticipant) => {
                        const isCardParticipantTheHost = p.userId === room.ownerId; 
                        return (
                            <Grid item key={p.sessionId} xs={4} sm={3} md={2}>
                                <StreamParticipantCard 
                                    participant={p} 
                                    isRoomOwner={isRoomOwner}
                                    isLocalParticipant={p.userId === currentUser?.uid} 
                                    localUserAuthData={currentUser} 
                                    onForceMuteToggle={onForceMuteToggle} 
                                    onForceRemove={onForceRemove}
                                    onForceBan={onForceBan}
                                    call={call} 
                                    localUserIsMute={localUserIsMute} 
                                    isDesignatedHost={isCardParticipantTheHost} 
                                    onPinToggle={handleTogglePinParticipant} 
                                    isPinned={pinnedUserIds.includes(p.userId)} 
                                             roomStyle={room?.style}
                                />
                            </Grid>
                        ); 
                    })}
                </Grid>
                
                {gridParticipants.length === 0 && (
                             <Typography sx={{
                                 width: '100%', 
                                 textAlign: 'center', 
                                 color: room?.style?.textColor ? alpha(room?.style?.textColor, 0.7) : theme.palette.text.secondary, 
                                 mt: 4,
                                 fontFamily: room?.style?.font || 'inherit'
                             }}>
                        Waiting for others to join...
                    </Typography>
                         )}
                     </>
                 )}

                 {/* Chat Tab Content */}
                 {activeTab === 'chat' && shouldShowChatTab && (
                     <Box sx={{ 
                         display: 'flex', 
                         flexDirection: 'column', 
                         height: 400, 
                         maxHeight: '50vh',
                         border: `1px solid ${room?.style?.accentColor ? alpha(room?.style?.accentColor, 0.3) : theme.palette.divider}`, 
                         borderRadius: 1, 
                         overflow: 'hidden' 
                     }}>
                         {/* Users in Room */}
                         <Box sx={{
                             p: 1.5,
                             borderBottom: `1px solid ${room?.style?.accentColor ? alpha(room?.style?.accentColor, 0.3) : theme.palette.divider}`,
                             bgcolor: room?.style?.headerColor ? alpha(room?.style?.headerColor, 0.1) : alpha(theme.palette.background.paper, 0.7),
                             display: 'flex',
                             flexDirection: 'column',
                             gap: 0.5
                         }}>
                             <Typography variant="subtitle2" fontWeight="medium" sx={{ fontFamily: room?.style?.font || 'inherit', color: room?.style?.textColor || 'inherit' }}>
                                 Users in Room ({gridParticipants.length})
                             </Typography>
                             <Box sx={{
                                 display: 'flex',
                                 flexWrap: 'wrap',
                                 gap: 0.5
                             }}>
                                 {gridParticipants.map((p: StreamVideoParticipant) => {
                                     // Use cached Firestore username if available
                                     const userData = firestoreUserData[p.userId];
                                     const displayName = userData?.username || p.name || p.userId.substring(0, 8);
                                     const avatarUrl = userData?.avatar || p.image;
                                     
                                     return (
                                         <Chip
                                             key={p.sessionId}
                                             size="small"
                                             label={displayName}
                                             avatar={<Avatar 
                                                 src={avatarUrl} 
                                                 alt={displayName}
                                                 sx={{ 
                                                     width: 24, 
                                                     height: 24
                                                 }}
                                             />}
                                             sx={{
                                                 backgroundColor: p.userId === room.ownerId 
                                                     ? alpha(room?.style?.accentColor || theme.palette.secondary.main, 0.1) 
                                                     : alpha(room?.style?.headerColor || theme.palette.primary.main, 0.05),
                                                 borderColor: p.userId === room.ownerId 
                                                     ? room?.style?.accentColor || theme.palette.secondary.main 
                                                     : room?.style?.headerColor || theme.palette.primary.main,
                                                 border: '1px solid',
                                                 color: room?.style?.textColor || 'inherit',
                                                 fontFamily: room?.style?.font || 'inherit',
                                                 '& .MuiChip-label': {
                                                     px: 1,
                                                     fontSize: '0.7rem'
                                                 }
                                             }}
                                         />
                                     );
                                 })}
                             </Box>
                         </Box>

                         {/* Chat Messages */}
                         <Box sx={{ 
                             flexGrow: 1, 
                             overflowY: 'auto', 
                             p: 2, 
                             bgcolor: room?.style?.backgroundGradient ? alpha(room?.style?.backgroundColor || theme.palette.background.default, 0.3) : alpha(theme.palette.background.paper, 0.5) 
                         }}>
                             {chatMessages.length === 0 ? (
                                 <Typography 
                                     variant="body2" 
                                     color={room?.style?.textColor ? alpha(room?.style?.textColor, 0.7) : "text.secondary"}
                                     sx={{ 
                                         textAlign: 'center', 
                                         fontStyle: 'italic', 
                                         mt: 4,
                                         fontFamily: room?.style?.font || 'inherit'
                                     }}
                                 >
                                     Chat messages will appear here. Be the first to send a message!
                                 </Typography>
                             ) : (
                                 <>
                                     {chatMessages.map(msg => (
                                         <Box 
                                             key={msg.id} 
                                             sx={{ 
                                                 display: 'flex', 
                                                 flexDirection: msg.userId === currentUser?.uid ? 'row-reverse' : 'row',
                                                 mb: 1.5 
                                             }}
                                         >
                                             {msg.userId !== currentUser?.uid && (
                                                 <Avatar 
                                                     sx={{ 
                                                         width: 28, 
                                                         height: 28, 
                                                         mr: 1,
                                                         fontSize: '0.8rem'
                                                     }}
                                                     src={firestoreUserData[msg.userId]?.avatar}
                                                 >
                                                     {msg.userName.charAt(0).toUpperCase()}
                                                 </Avatar>
                                             )}
                                             <Box>
                                                 <Typography 
                                                     variant="caption" 
                                                     color={room?.style?.textColor ? alpha(room?.style?.textColor, 0.8) : "text.secondary"}
                                                     sx={{ 
                                                         display: 'block', 
                                                         mb: 0.2,
                                                         textAlign: msg.userId === currentUser?.uid ? 'right' : 'left',
                                                         fontFamily: room?.style?.font || 'inherit'
                                                     }}
                                                 >
                                                     {msg.userName}
                                                 </Typography>
                                                 <Paper 
                                                     sx={{ 
                                                         p: 1, 
                                                         bgcolor: msg.userId === currentUser?.uid ? room?.style?.accentColor || 'primary.main' : 'background.paper',
                                                         color: msg.userId === currentUser?.uid 
                                                            ? (room?.style?.accentColor ? theme.palette.getContrastText(room.style.accentColor) : 'primary.contrastText') 
                                                            : room?.style?.textColor || 'text.primary',
                                                         borderRadius: msg.userId === currentUser?.uid ? '16px 16px 0 16px' : '16px 16px 16px 0',
                                                         maxWidth: '85%',
                                                         fontFamily: room?.style?.font || 'inherit'
                                                     }}
                                                 >
                                                     <Typography variant="body2" sx={{ fontFamily: 'inherit' }}>{msg.message}</Typography>
                                                 </Paper>
                                                 <Typography 
                                                     variant="caption" 
                                                     color={room?.style?.textColor ? alpha(room?.style?.textColor, 0.6) : "text.secondary"}
                                                     sx={{ 
                                                         display: 'block', 
                                                         mt: 0.2, 
                                                         textAlign: msg.userId === currentUser?.uid ? 'right' : 'left',
                                                         fontSize: '0.65rem',
                                                         fontFamily: room?.style?.font || 'inherit'
                                                     }}
                                                 >
                                                     {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                 </Typography>
                                             </Box>
                                         </Box>
                                     ))}
                                     <div ref={chatEndRef} />
                                 </>
                             )}
                         </Box>
                         
                         {/* Chat Input */}
                         <Box sx={{ 
                             p: 1, 
                             borderTop: `1px solid ${room?.style?.accentColor ? alpha(room?.style?.accentColor, 0.3) : theme.palette.divider}`, 
                             bgcolor: room?.style?.headerColor || theme.palette.background.paper,
                             display: 'flex'
                         }}>
                             <TextField
                                 fullWidth
                                 placeholder="Type your message..."
                                 variant="outlined"
                                 size="small"
                                 value={chatInput}
                                 onChange={(e) => setChatInput(e.target.value)}
                                 onKeyPress={(e) => {
                                     if (e.key === 'Enter') {
                                         e.preventDefault();
                                         handleSendChatMessage();
                                     }
                                 }}
                                 InputProps={{
                                     sx: {
                                         fontFamily: room?.style?.font || 'inherit',
                                         color: room?.style?.textColor || 'inherit',
                                         '& .MuiOutlinedInput-notchedOutline': {
                                             borderColor: room?.style?.accentColor ? alpha(room?.style?.accentColor, 0.3) : 'inherit'
                                         },
                                         '&:hover .MuiOutlinedInput-notchedOutline': {
                                             borderColor: room?.style?.accentColor ? alpha(room?.style?.accentColor, 0.5) : 'inherit'
                                         },
                                         '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                             borderColor: room?.style?.accentColor || theme.palette.primary.main
                                         }
                                     },
                                     endAdornment: (
                                         <IconButton 
                                             size="small" 
                                             onClick={handleSendChatMessage}
                                             disabled={!chatInput.trim()}
                                             color="primary"
                                             sx={{
                                                 color: room?.style?.accentColor || 'primary'
                                             }}
                                         >
                                             <SendIcon fontSize="small" />
                                         </IconButton>
                                     )
                                 }}
                             />
                         </Box>
                     </Box>
                )}
            </Box>

            {/* Bottom Control Bar - Ensuring all buttons, including Camera Toggle, are here */}
            <Box sx={{ 
                flexShrink: 0, 
                p: 2, 
                borderTop: `1px solid ${theme.palette.divider}`,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center', 
                backgroundColor: room?.style?.headerColor || theme.palette.background.paper
            }}>
                 <Button
                    variant="outlined"
                    color="error" 
                    startIcon={<ExitToApp />} 
                    onClick={handleLeaveCall} 
                    sx={{ 
                        borderRadius: '20px', 
                        textTransform: 'none',
                        fontFamily: room?.style?.font || 'inherit'
                    }} 
                >
                    Leave quietly
                </Button>

                {isRoomOwner && (
                    <Tooltip title={localUserIsMute ? "Unmute Microphone" : "Mute Microphone"}>
                        <IconButton 
                            onClick={() => call?.microphone.toggle()} 
                            color={localUserIsMute ? "default" : "primary"} 
                            sx={{ 
                                ml: 2,
                                color: !localUserIsMute ? (room?.style?.accentColor || 'primary.main') : 'default'
                            }} 
                            disabled={!call} 
                        >
                            {localUserIsMute ? <MicOff /> : <Mic />}
                        </IconButton>
                    </Tooltip>
                )}

                {/* THIS IS THE MAIN CAMERA TOGGLE BUTTON */}
                {isRoomOwner && (
                    <Tooltip title={isCameraEnabled ? "Turn Camera Off" : "Turn Camera On"}>
                        <IconButton
                            onClick={toggleCamera}
                            color={isCameraEnabled ? "primary" : "default"}
                            sx={{
                                ml: 1,
                                color: isCameraEnabled ? (room?.style?.accentColor || 'primary.main') : 'default'
                            }}
                            disabled={!call}
                        >
                            {isCameraEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
                        </IconButton>
                    </Tooltip>
                )}

                {/* Separate button to toggle PiP visibility */}
                {isRoomOwner && (
                    <Tooltip title={isPipVisible ? "Hide Camera Window" : "Show Camera Window"}>
                        <IconButton
                            onClick={() => setIsPipVisible(!isPipVisible)}
                            color={isPipVisible ? "primary" : "default"}
                            sx={{ 
                                ml: 1,
                                color: isPipVisible ? (room?.style?.accentColor || 'primary.main') : 'default'
                            }}
                            disabled={!call || !isCameraEnabled} 
                        >
                            <PictureInPictureAltIcon />
                        </IconButton>
                    </Tooltip>
                )}

                {/* Share Video Link - Only visible to room owners */}
                {isRoomOwner && (
                    <Tooltip title="Share Video Link">
                        <span> 
                        <IconButton 
                            onClick={() => handleOpenShareVideoDialog()} 
                            color="secondary" 
                            sx={{ 
                                ml: 2,
                                color: room?.style?.accentColor || theme.palette.secondary.main
                            }} 
                        >
                            <LinkIcon />
                        </IconButton>
                        </span>
                    </Tooltip>
                )}
            </Box>
            {/* End Bottom Control Bar */}
        </Box>
    );
}

// Participant Card for Clubhouse Style (Final Version)
// Define the props interface for StreamParticipantCard
interface StreamParticipantCardProps {
    participant: StreamVideoParticipant; 
    isRoomOwner: boolean;
    isLocalParticipant: boolean;
    onForceMuteToggle: Function;
    onForceRemove: Function;
    onForceBan: Function;
    call: Call;
    localUserAuthData: AuthContextUser | null;
    localUserIsMute?: boolean;
    isDesignatedHost?: boolean; 
    onPinToggle: (userId: string) => void; 
    isPinned?: boolean; 
    roomStyle?: RoomStyle;
}

const StreamParticipantCard: React.FC<StreamParticipantCardProps> = ({ 
    participant, 
    isRoomOwner, 
    isLocalParticipant, 
    onForceMuteToggle, 
    onForceRemove, 
    onForceBan, 
    call, 
    localUserAuthData, 
    localUserIsMute, 
    isDesignatedHost, 
    onPinToggle,      
    isPinned,
    roomStyle
}) => {
    const theme = useTheme(); 
    const { isSpeaking, publishedTracks } = participant;

    const isAudioTrackPublished = publishedTracks.includes('audio' as any);
    const showRemoteMuteIcon = !isAudioTrackPublished && !isSpeaking; 

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const menuOpen = Boolean(anchorEl);

    const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    const handleLocalMicToggle = async () => {
        if (!isLocalParticipant || !call) return;
        try {
            console.log('[StreamParticipantCard] Attempting to toggle local microphone. Current SDK mute state (from prop localUserIsMute):', localUserIsMute);
            await call.microphone.toggle();
            console.log('[StreamParticipantCard] Local microphone toggle command completed. SDK state should update.');
        } catch (error) {
            console.error('[StreamParticipantCard] Error toggling local microphone:', error);
            toast.error("Failed to toggle microphone. See console.");
        }
    };

    const handleRemoteMuteToggle = async () => {
        handleMenuClose();
        if (onForceMuteToggle) {
            onForceMuteToggle(participant.userId, !participant.publishedTracks.includes('audio' as any));
        }
    };
    const handleKickUser = () => {
        handleMenuClose();
        if (onForceRemove) {
            onForceRemove(participant.userId, participant.name || participant.userId);
        }
    };
    const handleBanUserFromCall = () => {
        handleMenuClose();
        if (onForceBan) {
            onForceBan(participant.userId, participant.name || participant.userId);
        }
    };

    const handlePinToggle = () => {
        handleMenuClose();
        onPinToggle(participant.userId);
    };

    let displayName: string;
    let avatarUrl: string | undefined;

    interface StreamCustomParticipantData {
        displayName?: string;
        customAvatarUrl?: string;
    }

    const customData = participant.custom as StreamCustomParticipantData | undefined;

    if (isLocalParticipant && localUserAuthData) { 
        displayName = localUserAuthData.displayName || localUserAuthData.email || participant.userId; 
        avatarUrl = localUserAuthData.photoURL || participant.image || undefined; 
    } else if (customData && typeof customData.displayName === 'string' && customData.displayName.trim() !== '') {
        displayName = customData.displayName;
        if (customData.customAvatarUrl && typeof customData.customAvatarUrl === 'string' && customData.customAvatarUrl.trim() !== '') {
            avatarUrl = customData.customAvatarUrl;
        } else {
            avatarUrl = participant.image || undefined;
        }
    } else {
        displayName = participant.name || participant.userId;
        avatarUrl = participant.image || undefined;
    }

    console.log('[StreamParticipantCard] Rendering with props:', { participant, isRoomOwner, isLocalParticipant, localUserAuthData });
    console.log('[StreamParticipantCard] Determined values - displayName:', displayName, 'avatarUrl:', avatarUrl, 'isSpeaking:', isSpeaking, 'participantIsMuted:', showRemoteMuteIcon);
    if (isLocalParticipant) {
        console.log('[StreamParticipantCard - LOCAL Focus] localUserAuthData:', localUserAuthData, 'Stream participant.userId:', participant.userId);
    }

    return (
        <Box sx={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            textAlign: 'center',
        }}>
            <Avatar 
                src={avatarUrl}
                alt={displayName}
                onClick={handleLocalMicToggle} 
                sx={{
                    width: 64,
                    height: 64, 
                    mb: 0.5,
                    border: isSpeaking ? `3px solid ${theme.palette.success.main}` : `2px solid ${alpha(theme.palette.divider, 0.5)}`,
                    boxShadow: isSpeaking ? `0 0 8px ${theme.palette.success.light}` : 'none',
                    transition: 'border 0.2s ease-in-out, boxShadow 0.2s ease-in-out',
                    cursor: isLocalParticipant ? 'pointer' : 'default', 
                }}
            />
            {isDesignatedHost && (
                <Chip 
                    label="Host"
                    size="small"
                    color="secondary" 
                    sx={{ 
                        position: 'absolute',
                        bottom: 12.5, 
                        zIndex: 2, 
                        fontWeight: 'bold',
                        height: '18px',
                        fontSize: '0.65rem'
                    }}
                />
            )}
            {(isLocalParticipant ? (localUserIsMute ?? true) : showRemoteMuteIcon) && (
                <MicOff 
                    sx={{ 
                        fontSize: '1rem', 
                        color: theme.palette.error.contrastText,
                        backgroundColor: alpha(theme.palette.error.main, 0.8),
                        borderRadius: '50%',
                        padding: '3px',
                        position: 'absolute',
                        bottom: 20, 
                        right: 5, 
                    }}
                />
            )}
            {isLocalParticipant && !localUserIsMute && (
                 <Mic 
                     sx={{
                         fontSize: '1rem',
                         color: theme.palette.success.contrastText, 
                         backgroundColor: alpha(theme.palette.success.main, 0.8), 
                        borderRadius: '50%',
                        padding: '3px',
                        position: 'absolute',
                        bottom: 20, 
                        right: 5, 
                    }}
                />
            )}
            <Typography variant="caption" noWrap sx={{ width: '100%', lineHeight: 1.2, fontSize: '0.75rem', fontWeight: 'medium', color: theme.palette.text.primary }}>
                {displayName}
            </Typography>
            
            {isRoomOwner && !isLocalParticipant && (
                <Box sx={{ position: 'absolute', top: -5, right: -5, zIndex: 1 }}>
                    <Tooltip title="Manage User">
                        <IconButton onClick={handleMenuClick} size="small" sx={{ backgroundColor: alpha(theme.palette.background.default, 0.7), p: 0.2, borderRadius: '50%' }}>
                            <MoreVertIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Menu
                        anchorEl={anchorEl}
                        open={menuOpen}
                        onClose={handleMenuClose}
                        MenuListProps={{ dense: true }}
                    >
                        <MenuItem onClick={handleRemoteMuteToggle} sx={{ fontSize: '0.8rem' }}>
                            <ListItemIcon sx={{minWidth: '30px'}}>{showRemoteMuteIcon ? <VolumeUpIcon fontSize="small"/> : <VolumeOffIcon fontSize="small"/>}</ListItemIcon>
                            {showRemoteMuteIcon ? 'Unmute' : 'Mute'}
                        </MenuItem>
                        <MenuItem onClick={handlePinToggle} sx={{ fontSize: '0.8rem' }}>
                            <ListItemIcon sx={{minWidth: '30px'}}>
                                <PushPinIcon fontSize="small" color={isPinned ? "primary" : "inherit"} />
                            </ListItemIcon>
                            {isPinned ? 'Unpin from top' : 'Pin to top'}
                        </MenuItem>
                        <MenuItem onClick={handleKickUser} sx={{ color: 'warning.dark', fontSize: '0.8rem' }}>
                            <ListItemIcon sx={{minWidth: '30px'}}><PersonRemoveIcon fontSize="small" color="warning"/></ListItemIcon>
                            Remove
                        </MenuItem>
                        <MenuItem onClick={handleBanUserFromCall} sx={{ color: 'error.main', fontSize: '0.8rem' }}>
                            <ListItemIcon sx={{minWidth: '30px'}}><BanIcon fontSize="small" color="error"/></ListItemIcon>
                            Ban
                        </MenuItem>
                    </Menu>
                </Box>
            )}
            {isPinned && !isDesignatedHost && ( 
                <Tooltip title="Pinned">
                    <PushPinIcon 
                        sx={{
                            fontSize: '1rem',
                            color: theme.palette.primary.contrastText,
                            backgroundColor: alpha(theme.palette.primary.main, 0.8),
                            borderRadius: '50%',
                            padding: '3px',
                            position: 'absolute',
                            top: 0,
                            left: 5,
                            zIndex: 2, 
                        }}
                    />
                </Tooltip>
            )}
        </Box>
    );
};
