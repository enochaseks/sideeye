import React, { useState, useEffect, useRef, useMemo, useCallback, useContext } from 'react';
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
    deleteField, // Import deleteField
    addDoc, // Import addDoc for chat messages
    getFirestore, // Import getFirestore for component use
    getDocs, // Import getDocs
    arrayRemove, // Import arrayRemove
    arrayUnion // Import arrayUnion for adding to arrays
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
    DialogContentText,
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
    Tab,
    CardMedia,
    useTheme,
    useMediaQuery,
    Divider,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
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
    Block,
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
    Stop as StopIcon, // ADDED for recording
    // VolumeUp as VolumeUpIcon // REMOVE DUPLICATE
    PushPin as PushPinIcon,
    Videocam as VideocamIcon, // ADDED for camera toggle
    VideocamOff as VideocamOffIcon, // ADDED for camera toggle
    Close as CloseIcon, // ADDED for PiP close button and dialogs
    PictureInPicture as PictureInPictureIcon, // ADDED for PiP toggle button
    Send as SendIcon,
    ZoomIn as ZoomInIcon,
    ZoomOut as ZoomOutIcon,
    PictureInPictureAlt as PictureInPictureAltIcon,
    Tune as TuneIcon,
    VolumeDown as VolumeDownIcon,
    PersonAdd as PersonAddIcon,
    Report as ReportIcon, // Added ReportIcon
    VerifiedUser as VerifiedUserIcon, // Added VerifiedUserIcon
    HeartBroken as HeartBrokenIcon,
    HeartBrokenOutlined as HeartBrokenOutlinedIcon,
    SportsEsports as SportsEsportsIcon,
    FiberManualRecord as FiberManualRecordIcon,
    Visibility as VisibilityIcon,
    CardGiftcard as CardGiftcardIcon,
    EmojiEvents as EmojiEventsIcon,
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
import SearchSourceLinks, { SourceLink } from '../SearchSourceLinks';
import ReportContent from '../ReportContent/ReportContent';
import ShareRoomViaMessageDialog from './ShareRoomViaMessageDialog'; // Import the new dialog
import Gifts from './Gifts'; // Add this import
import TopGifters from './TopGifters';
import TimeFrame from './TimeFrame'; // Add TimeFrame import
//  // Add AutoRecording import

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
        // Custom screen sharing properties
        SIDEEYE_SCREENSHARE_PARTICIPANT: any;
        SIDEEYE_SCREENSHARE_STREAM: MediaStream | null;
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
type SadeMessage = { 
    sender: 'user' | 'ai', 
    text: string,
    sourceLinks?: SourceLink[] // Add source links for search results
};

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

// --- Added FloatingHearts Component ---
interface FloatingIconProps {
    icon: React.ReactNode;
    color: string;
}

const FloatingIcon: React.FC<FloatingIconProps> = ({ icon, color }) => {
    const [style, setStyle] = useState({
        left: `${Math.random() * 80 + 10}%`,
        top: `${Math.random() * 20 + 40}%`, // Start in middle area of the page
        animationDuration: `${Math.random() * 3 + 2}s`,
        opacity: 1
    });

    useEffect(() => {
        const timer = setTimeout(() => {
            setStyle(prev => ({ ...prev, opacity: 0 }));
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <Box
            sx={{
                position: 'fixed',
                fontSize: '28px',
                color: color,
                pointerEvents: 'none',
                zIndex: 1000,
                transition: 'opacity 1s ease-out',
                animation: 'float-around 3s ease-out forwards',
                '@keyframes float-around': {
                    '0%': { 
                        transform: 'scale(0.5) rotate(0deg) translate(0, 0)' 
                    },
                    '25%': { 
                        transform: 'scale(1.2) rotate(10deg) translate(20px, -30px)' 
                    },
                    '50%': { 
                        transform: 'scale(1.4) rotate(-5deg) translate(-15px, -60px)' 
                    },
                    '75%': { 
                        transform: 'scale(1.1) rotate(15deg) translate(25px, -90px)' 
                    },
                    '100%': { 
                        transform: 'scale(0.8) rotate(-10deg) translate(0, -120px)' 
                    }
                },
                ...style
            }}
        >
            {icon}
        </Box>
    );
};

// Floating reactions panel component
const FloatingReactionsPanel: React.FC<{
    handleHeartRoom: () => void;
    handleHeartbreakRoom: () => void;
    currentUserHearted: boolean;
    currentUserHeartbroken: boolean;
    roomHeartCount: number;
    roomHeartbreakCount: number;
    isHearting: boolean;
    isHeartbreaking: boolean;
    accentColor?: string;
    textColor?: string;
}> = ({ 
    handleHeartRoom, 
    handleHeartbreakRoom, 
    currentUserHearted, 
    currentUserHeartbroken,
    roomHeartCount,
    roomHeartbreakCount,
    isHearting,
    isHeartbreaking,
    accentColor,
    textColor
}) => {
    const theme = useTheme();
    
    return (
        <Box
            sx={{
                position: 'fixed',
                right: 20,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(5px)',
                borderRadius: 2,
                padding: 1,
                zIndex: 100,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)'
            }}
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Tooltip title={currentUserHearted ? "Unheart Room" : "Heart Room"}>
                    <IconButton 
                        onClick={handleHeartRoom} 
                        color={currentUserHearted ? "error" : "inherit"}
                        sx={{ 
                            color: currentUserHearted ? theme.palette.error.main : accentColor || 'inherit',
                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                            '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                            }
                        }}
                        disabled={isHearting}
                    >
                        {currentUserHearted ? <FavoriteIcon /> : <FavoriteBorderIcon />}
                    </IconButton>
                </Tooltip>
                <Typography 
                    variant="body2" 
                    sx={{ 
                        color: textColor || 'inherit',
                        fontWeight: 'bold'
                    }}
                >
                    {roomHeartCount || 0}
                </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Tooltip title={currentUserHeartbroken ? "Remove Heartbreak" : "Heartbreak Room"}>
                    <IconButton 
                        onClick={handleHeartbreakRoom} 
                        color={currentUserHeartbroken ? "error" : "inherit"}
                        sx={{ 
                            color: currentUserHeartbroken ? theme.palette.error.main : accentColor || 'inherit',
                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                            '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                            }
                        }}
                        disabled={isHeartbreaking}
                    >
                        {currentUserHeartbroken ? <HeartBrokenIcon /> : <HeartBrokenOutlinedIcon />}
                    </IconButton>
                </Tooltip>
                <Typography 
                    variant="body2" 
                    sx={{ 
                        color: textColor || 'inherit',
                        fontWeight: 'bold'
                    }}
                >
                    {roomHeartbreakCount || 0}
                </Typography>
            </Box>
        </Box>
    );
};

const SideRoomComponent: React.FC = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const { currentUser, blockUser } = useAuth();
    const theme = useTheme(); 

    // --- State ---
    const [room, setRoom] = useState<SideRoom | null>(null);
    const [showShareViaMessageDialog, setShowShareViaMessageDialog] = useState(false);
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

    // --- State for Heartbreak Feature ---
    const [roomHeartbreakCount, setRoomHeartbreakCount] = useState<number>(0);
    const [currentUserHeartbroken, setCurrentUserHeartbroken] = useState<boolean>(false);
    const [isHeartbreaking, setIsHeartbreaking] = useState(false);

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

    // --- Sade AI Typing Effect ---
    const [sadeTypingText, setSadeTypingText] = useState<string>('');
    const [isDisplayingText, setIsDisplayingText] = useState(false);
    const [typingSpeed, setTypingSpeed] = useState(30); // ms per character

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
    
    // --- State for Screen Recording --- (NEW)
    const [isRecording, setIsRecording] = useState(false);
    const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<BlobPart[]>([]);
    
    // --- State for Camera --- (NEW)
    const [isCameraEnabled, setIsCameraEnabled] = useState(false);
    
    // --- State for Camera Requests ---
    const [cameraRequests, setCameraRequests] = useState<{
        userId: string;
        username: string;
        avatar?: string;
        timestamp: number;
    }[]>([]);
    const [showCameraRequestsDialog, setShowCameraRequestsDialog] = useState(false);
    const [hasPendingCameraRequest, setHasPendingCameraRequest] = useState(false);
    
    // State to track users with approved camera permissions
    const [approvedCameraUsers, setApprovedCameraUsers] = useState<Set<string>>(new Set());
    
    // --- State for YouTube Player ---
    const [youtubePlayer, setYoutubePlayer] = useState<YT.Player | null>(null);
    const youtubePlayerPlaceholderId = 'youtube-player-placeholder';
    
    // --- State variables and imports ---
    // ... existing code ...
    const [showJoinRoomChatDialog, setShowJoinRoomChatDialog] = useState(false);
    const [serverChatRoom, setServerChatRoom] = useState<{id: string, name: string} | null>(null);
    
    // Add this new state to track if user has declined the dialog
    const [hasDeclinedServerChat, setHasDeclinedServerChat] = useState(false);
    
    // ... existing code ...

    // --- State for Heart and Heartbreak Animations ---
    const [floatingHearts, setFloatingHearts] = useState<number[]>([]);
    const [floatingHeartbreaks, setFloatingHeartbreaks] = useState<number[]>([]);
    
    // --- State for Room Reporting ---
    const [reportRoomDialogOpen, setReportRoomDialogOpen] = useState(false);
    
    // --- State for Banned Users Management ---
    const [showBannedUsersDialog, setShowBannedUsersDialog] = useState(false);
    const [bannedUsersData, setBannedUsersData] = useState<{
        id: string;
        username: string;
        name?: string;
        profilePic?: string;
    }[]>([]);
    
    // --- State for Owner Not Live Dialog ---
    const [showOwnerNotLiveDialog, setShowOwnerNotLiveDialog] = useState(false);
    const [hasCheckedOwnerPresence, setHasCheckedOwnerPresence] = useState(false);
    
    // --- DEBUG: Set to true to disable the owner not live dialog ---
    const DISABLE_OWNER_NOT_LIVE_DIALOG = false;
    
    // ... existing code ...

    // --- State for balance notifications ---
    const [lastKnownBalance, setLastKnownBalance] = useState<number | null>(null);

    // --- Effect to listen for balance changes and show notifications ---
    useEffect(() => {
        if (!currentUser?.uid || !db) return;

        console.log('[SideRoomComponent] Setting up balance listener for user:', currentUser.uid);
        
        const userRef = doc(db, 'users', currentUser.uid);
        const unsubscribe = onSnapshot(userRef, (userDoc) => {
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const currentBalance = userData.sideCoins || 0;
                
                // If this is not the first time we're getting the balance
                if (lastKnownBalance !== null) {
                    // Check if balance increased (user received a gift)
                    if (currentBalance > lastKnownBalance) {
                        const increase = currentBalance - lastKnownBalance;
                        toast.success(`+${increase.toFixed(2)} SideCoins earned from gifts! 🎁`, {
                            duration: 4000,
                            position: 'top-right',
                        });
                    }
                    // Could also check for balance decrease (user spent coins) if needed
                    else if (currentBalance < lastKnownBalance) {
                        const decrease = lastKnownBalance - currentBalance;
                        console.log(`[Balance] User spent ${decrease} SideCoins`);
                        // Don't show notification for spending, as it's already handled in gift dialog
                    }
                }
                
                setLastKnownBalance(currentBalance);
            }
        });

        return () => {
            console.log('[SideRoomComponent] Cleaning up balance listener');
            unsubscribe();
        };
    }, [currentUser?.uid, lastKnownBalance, db]);

    // Camera request function for participants
    const requestCameraPermission = useCallback(async () => {
        if (!currentUser || !roomId || hasPendingCameraRequest) {
            return;
        }
        
        // Get user's profile data for the request
        try {
            const userProfileRef = doc(db, 'users', currentUser.uid);
            const userProfileSnap = await getDoc(userProfileRef);
            
            let username = currentUser.email?.split('@')[0] || 'Unknown User';
            let avatar = currentUser.photoURL || '';
            
            if (userProfileSnap.exists()) {
                const profileData = userProfileSnap.data() as UserProfile;
                username = profileData.username || username;
                avatar = profileData.profilePic || avatar;
            }
            
            const requestData = {
                userId: currentUser.uid,
                username,
                avatar,
                timestamp: Date.now()
            };
            
            // Store camera request directly in Firestore for immediate visibility
            const requestRef = doc(db, 'sideRooms', roomId, 'cameraRequests', currentUser.uid);
            await setDoc(requestRef, requestData);
            
            setHasPendingCameraRequest(true);
            toast.success("Camera request sent to host");
            
            // Also try socket if available as backup
            if (socket) {
            socket.emit('camera-request', {
                roomId,
                userId: currentUser.uid,
                username,
                avatar
            });
            }
        } catch (error) {
            console.error("Error sending camera request:", error);
            toast.error("Failed to send camera request");
        }
    }, [socket, currentUser, roomId, hasPendingCameraRequest, db]);

    // Handle camera request approval/denial (for room owners)
    const handleCameraRequestDecision = useCallback(async (userId: string, username: string, approved: boolean) => {
        if (!roomId) return;
        
        console.log(`📹 [CAMERA DECISION] Processing decision for ${username} (${userId}): ${approved ? 'APPROVED' : 'DENIED'}`);
        
        try {
            // Remove request from Firestore first
            const requestRef = doc(db, 'sideRooms', roomId, 'cameraRequests', userId);
            await deleteDoc(requestRef);
            console.log(`📹 [CAMERA DECISION] Removed request from Firestore`);
            
            if (approved) {
                // Write approval to Firestore with detailed logging
                const approvalRef = doc(db, 'sideRooms', roomId, 'cameraApprovals', userId);
                const approvalData = {
                    approved: true,
                    timestamp: Date.now(),
                    approvedBy: currentUser?.uid,
                    username: username
                };
                
                console.log(`📹 [CAMERA DECISION] Writing approval to Firestore:`, approvalData);
                await setDoc(approvalRef, approvalData);
                console.log(`📹 [CAMERA DECISION] ✅ Successfully wrote approval for ${username} (${userId})`);
                
                // Immediately update local state to ensure UI updates
                setApprovedCameraUsers(prev => {
                    const newSet = new Set(prev);
                    newSet.add(userId);
                    console.log(`📹 [CAMERA DECISION] Updated local approved users:`, Array.from(newSet));
                    return newSet;
                });
                
                toast.success(`✅ Camera approved for ${username}`);
            } else {
                // Remove any existing approval if denied
                const approvalRef = doc(db, 'sideRooms', roomId, 'cameraApprovals', userId);
                await deleteDoc(approvalRef).catch(() => {}); // Ignore errors if doesn't exist
                console.log(`📹 [CAMERA DECISION] ❌ Denied camera for ${username} (${userId})`);
                
                // Update local state to remove user
                setApprovedCameraUsers(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(userId);
                    console.log(`📹 [CAMERA DECISION] Updated local approved users after denial:`, Array.from(newSet));
                    return newSet;
                });
                
                toast.success(`❌ Camera denied for ${username}`);
            }
        } catch (error) {
            console.error('📹 [CAMERA DECISION] Error processing decision:', error);
            toast.error('Failed to process request');
        }
    }, [roomId, db, currentUser?.uid]);

    // Helper function to check if a user should have their video displayed
    const shouldShowUserVideo = useCallback((userId: string) => {
        // Always show the current user's own video if they have camera enabled
        if (userId === currentUser?.uid) {
            return true;
        }
        
        // For room owner: always show their video
        if (userId === room?.ownerId) {
            return true;
        }
        
        // For other participants: show if they have camera permission (keep it stable)
        const hasPermission = approvedCameraUsers.has(userId);
        console.log(`🎥 shouldShowUserVideo for ${userId}: ${hasPermission}`);
        return hasPermission;
    }, [currentUser?.uid, room?.ownerId, approvedCameraUsers]);

    // Camera toggle function for main component (room owners only)
    const toggleCamera = useCallback(() => {
        if (activeStreamCallInstance && isRoomOwner) {
            // Log current state
            console.log("Camera state before toggle:", activeStreamCallInstance.camera.state);
            
            // Force enable/disable camera based on current state
            if (activeStreamCallInstance.camera.state.status !== 'enabled') {
                // More aggressive camera enabling approach
                toast.loading("Enabling camera...");
                
                // Try to get user media first to ensure permissions are granted
                navigator.mediaDevices.getUserMedia({ video: true, audio: false })
                    .then(stream => {
                        console.log("Camera access granted:", stream);
                        // Stop the stream immediately as we just needed to check permissions
                        stream.getTracks().forEach(track => track.stop());
                        
                        // Now enable camera in Stream SDK
                        return activeStreamCallInstance.camera.enable();
                    })
                    .then(() => {
                        setIsCameraEnabled(true);
                        toast.dismiss();
                        toast.success("Camera enabled");
                    })
                    .catch(err => {
                        console.error("Error enabling camera:", err);
                        toast.dismiss();
                        toast.error("Could not enable camera. Please check camera permissions in your browser settings.");
                    });
            } else {
                activeStreamCallInstance.camera.disable()
                    .then(() => {
                        setIsCameraEnabled(false);
                        toast.success("Camera disabled");
                    })
                    .catch(err => {
                        console.error("Error disabling camera:", err);
                    });
            }
        }
    }, [activeStreamCallInstance]);

    // --- Refs for updating active users count ---
    const lastActiveUsersCountRef = useRef<number>(0);
    const activeUsersUpdateTimeRef = useRef<number>(0);
    const lastPresenceUpdateTimeRef = useRef<number>(0);

    // --- Effect for Desktop Check --- (NEW)
    useEffect(() => {
        const handleResize = () => {
            setIsDesktop(window.innerWidth > 1024);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    // Reset the decline preference when room changes
    useEffect(() => {
        setHasDeclinedServerChat(false);
    }, [roomId]);
    
    // Reset camera request state when leaving room
    useEffect(() => {
        return () => {
            setHasPendingCameraRequest(false);
            setCameraRequests([]);
        };
    }, [roomId]);




    
    // --- Effect to sync camera state with Stream SDK
    useEffect(() => {
        if (activeStreamCallInstance) {
            // Check if camera is already enabled in the call
            const isVideoEnabled = activeStreamCallInstance.camera.state.status === 'enabled';
            setIsCameraEnabled(isVideoEnabled);
            
            // Set up an interval to check camera state
            const cameraCheckInterval = setInterval(() => {
                const currentState = activeStreamCallInstance.camera.state.status === 'enabled';
                
                // Only update if camera state actually changed to prevent flickering
                setIsCameraEnabled(prev => {
                    if (prev !== currentState) {
                        console.log(`🎥 Camera state changed: ${prev} → ${currentState}`);
                        return currentState;
                    }
                    return prev;
                });
            }, 1000);
            
            return () => {
                clearInterval(cameraCheckInterval);
            };
        }
    }, [activeStreamCallInstance]);
    
    // --- Effect to request camera permissions on page load
    useEffect(() => {
        if (activeStreamCallInstance) {
            // Request permissions early
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(() => {
                    console.log("Camera permissions granted");
                })
                .catch(err => {
                    console.error("Camera permission denied:", err);
                    toast.error("Camera permissions denied. You won't be able to share video.");
                });
        }
    }, [activeStreamCallInstance]);

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
            
            // If we already have room and user info, join the room immediately
            if (roomId && currentUser?.uid) {
                console.log('[SideRoomComponent] Auto-joining room on socket connect:', roomId);
                socketInstance.emit('join-room', roomId, currentUser.uid);
            }
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

    // Effect to join room when socket, room, and user are all available
    useEffect(() => {
        if (socket && roomId && currentUser?.uid) {
            console.log('[SideRoomComponent] Joining room via socket:', roomId);
            socket.emit('join-room', roomId, currentUser.uid);
        }
    }, [socket, roomId, currentUser?.uid]);

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

    // --- Effect for updating active users count ---
    useEffect(() => {
        // Skip if no room or no presence data
        if (!roomId || !db || presence.length === 0) return;

        // Get the current online users count
        const currentOnlineCount = presence.filter(p => p.isOnline).length;
        
        // Only update Firestore if count changed and not too frequently (max once per 10 seconds)
        const now = Date.now();
        const timeSinceLastUpdate = now - activeUsersUpdateTimeRef.current;
        
        if (
            currentOnlineCount !== lastActiveUsersCountRef.current && 
            timeSinceLastUpdate > 10000 // 10 seconds minimum between updates
        ) {
            console.log(`[Active Users Update] Updating count from ${lastActiveUsersCountRef.current} to ${currentOnlineCount}`);
            
            const roomRef = doc(db, 'sideRooms', roomId);
            updateDoc(roomRef, {
                activeUsers: currentOnlineCount,
                // Remove the redundant viewerCount field, using only activeUsers from now on
                viewerCount: deleteField()
            })
            .then(() => {
                // Update refs after successful operation
                lastActiveUsersCountRef.current = currentOnlineCount;
                activeUsersUpdateTimeRef.current = now;
            })
            .catch(error => {
                console.error('[Active Users Update] Error updating room active users count:', error);
            });
        }
        
        // Update the ref even if we don't update Firestore
        // This prevents unnecessary Firestore updates if count doesn't change
        lastActiveUsersCountRef.current = currentOnlineCount;
    }, [roomId, db, presence.length]); // Only depends on presence.length, not the full presence array

    // --- Memos ---
    // Add more detailed console logs to debug isRoomOwner
    console.log('[SideRoomComponent Debug] Owner check details:');
    console.log('  Current User UID:', currentUser?.uid || 'null/undefined');
    console.log('  Room Owner ID:', room?.ownerId || 'null/undefined');
    console.log('  Room Viewers:', room?.viewers || 'null/undefined');
    
    // Force type safety and strengthen the owner check
    const isRoomOwner = useMemo(() => {
        // Immediately return false if currentUser or room is not yet available
        if (!currentUser?.uid || !room?.ownerId) {
            console.log('[SideRoomComponent] isRoomOwner = false (missing user or room data)');
            return false;
        }
        
        // Direct string comparison with strict equality
        const isOwner = currentUser.uid === room.ownerId;
        console.log(`[SideRoomComponent] isRoomOwner = ${isOwner} (direct comparison)`);
        return isOwner;
    }, [currentUser?.uid, room?.ownerId]);

    // Add similar logging for isGuest check
    const isGuest = useMemo(() => {
        if (!room?.viewers || !currentUser?.uid) {
            console.log('[SideRoomComponent] isGuest = false (missing viewer data or user)');
            return false;
        }
        
        const foundAsGuest = room.viewers.some(member => 
            member.userId === currentUser.uid && member.role === 'guest'
        );
        console.log(`[SideRoomComponent] isGuest = ${foundAsGuest} (found in viewers with role=guest)`);
        return foundAsGuest;
    }, [room?.viewers, currentUser?.uid]);

    const isViewer = true;
    const hasRoomAccess = !!room && (isRoomOwner || isViewer || isGuest);

    // Listen for camera requests from Firestore (for room owners)
    useEffect(() => {
        if (!roomId || !isRoomOwner || !db) return;

        const cameraRequestsRef = collection(db, 'sideRooms', roomId, 'cameraRequests');
        const unsubscribe = onSnapshot(cameraRequestsRef, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({
                userId: doc.id,
                ...doc.data()
            })) as {
                userId: string;
                username: string;
                avatar?: string;
                timestamp: number;
            }[];
            
            setCameraRequests(requests);
        });

        return () => unsubscribe();
    }, [roomId, isRoomOwner, db]);

    // Listen for approved camera users (for hosts to track who has permission)
    useEffect(() => {
        if (!roomId || !db) return;

        console.log('📹 [CAMERA PERMISSIONS] Setting up listener for room:', roomId);
        
        const approvalsRef = collection(db, 'sideRooms', roomId, 'cameraApprovals');
        const unsubscribe = onSnapshot(approvalsRef, (snapshot) => {
            const approvedUserIds = new Set(snapshot.docs.map(doc => doc.id));
            
            console.log('📹 [CAMERA PERMISSIONS] Firestore update received:');
            console.log('📹 [CAMERA PERMISSIONS] - Snapshot size:', snapshot.size);
            console.log('📹 [CAMERA PERMISSIONS] - Document IDs:', snapshot.docs.map(doc => doc.id));
            console.log('📹 [CAMERA PERMISSIONS] - Previous approved users:', Array.from(approvedCameraUsers));
            console.log('📹 [CAMERA PERMISSIONS] - New approved users:', Array.from(approvedUserIds));
            
            setApprovedCameraUsers(approvedUserIds);
            
            // Force a re-render by updating a dummy state if needed
            if (approvedUserIds.size !== approvedCameraUsers.size) {
                console.log('📹 [CAMERA PERMISSIONS] Camera permissions changed, forcing layout update');
            }
        }, (error) => {
            console.error('📹 [CAMERA PERMISSIONS] Error listening to camera approvals:', error);
        });

        return () => {
            console.log('📹 [CAMERA PERMISSIONS] Cleaning up listener for room:', roomId);
            unsubscribe();
        };
    }, [roomId, db]);

    // Listen for camera approvals for participants
    useEffect(() => {
        if (!roomId || !currentUser?.uid || isRoomOwner || !db) return;

        // Listen for approval
        const approvalRef = doc(db, 'sideRooms', roomId, 'cameraApprovals', currentUser.uid);
        const unsubscribeApproval = onSnapshot(approvalRef, async (doc) => {
            if (doc.exists() && doc.data()?.approved && activeStreamCallInstance) {
                console.log('🎥 CAMERA APPROVED! TURNING ON NOW!');
                setHasPendingCameraRequest(false);
                
                try {
                    await activeStreamCallInstance.camera.enable();
                    setIsCameraEnabled(true);
                    toast.success("🎥 CAMERA ON!");
                    
                    // DON'T clean up approval doc - keep it for host to see permission
                    console.log('🎥 Keeping approval document for host visibility');
                } catch (error) {
                    console.error('Camera error:', error);
                    toast.error("Camera failed");
                }
            }
        });

        // Listen for request removal (denied)
        const requestRef = doc(db, 'sideRooms', roomId, 'cameraRequests', currentUser.uid);
        const unsubscribeRequest = onSnapshot(requestRef, (doc) => {
            if (!doc.exists()) {
                setHasPendingCameraRequest(false);
            }
        });

        return () => {
            unsubscribeApproval();
            unsubscribeRequest();
        };
    }, [roomId, currentUser?.uid, isRoomOwner, db, activeStreamCallInstance]);
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

    // --- Effect to check if room owner is LIVE (in Stream call) ---
    useEffect(() => {
        // DEBUG: Skip if feature is disabled
        if (DISABLE_OWNER_NOT_LIVE_DIALOG) {
            console.log('[Owner Live Check] Feature disabled via debug flag');
            return;
        }
        
        // Only check for non-owners who have room access and if there's an active stream call
        if (!room || !currentUser || isRoomOwner || !hasRoomAccess || hasCheckedOwnerPresence || !activeStreamCallInstance) {
            console.log('[Owner Live Check] Skipping check - conditions not met:', {
                hasRoom: !!room,
                hasCurrentUser: !!currentUser,
                isRoomOwner,
                hasRoomAccess,
                hasCheckedOwnerPresence,
                hasActiveStreamCall: !!activeStreamCallInstance
            });
            return;
        }
        
        console.log(`[Owner Live Check] Checking if owner is live in Stream call:`, {
            roomOwnerId: room.ownerId,
            currentUserId: currentUser.uid,
            hasActiveStreamCall: !!activeStreamCallInstance
        });
        
        // The real check: Is the room owner in the Stream call?
        // We need to access Stream call participants - this will be checked in the InsideStreamCallContent component
        // For now, we'll check if there's an active call and wait a bit for the owner to join
        if (activeStreamCallInstance) {
            console.log('[Owner Live Check] Active stream call found, starting grace period for owner to join...');
            // Give a grace period for the owner to join the Stream call
            const timeoutId = setTimeout(() => {
                // This will be handled by the InsideStreamCallContent component
                // which has access to Stream participants
                console.log('[Owner Live Check] Grace period ended, will check Stream participants');
                setHasCheckedOwnerPresence(true);
            }, 10000); // 10 second grace period for owner to join Stream call
            
            return () => clearTimeout(timeoutId);
        }
    }, [room, currentUser, isRoomOwner, hasRoomAccess, hasCheckedOwnerPresence, activeStreamCallInstance]);

    // --- Effect to listen for owner not live events from Stream call ---
    useEffect(() => {
        const handleShowOwnerNotLiveDialog = () => {
            console.log('[Main Component] Received showOwnerNotLiveDialog event from Stream component');
            if (!isRoomOwner && !showOwnerNotLiveDialog) {
                setShowOwnerNotLiveDialog(true);
            }
        };

        window.addEventListener('showOwnerNotLiveDialog', handleShowOwnerNotLiveDialog);

        return () => {
            window.removeEventListener('showOwnerNotLiveDialog', handleShowOwnerNotLiveDialog);
        };
    }, [isRoomOwner, showOwnerNotLiveDialog]);

    // --- Note: Real owner live monitoring is now handled in InsideStreamCallContent component ---
    // This checks if owner is actually in the Stream audio/video call, not just present in room

    // --- Banned Users Management Functions ---
    const loadBannedUsers = useCallback(async () => {
        if (!room?.bannedUsers || room.bannedUsers.length === 0) {
            setBannedUsersData([]);
            return;
        }

        try {
            const bannedUserProfiles = await Promise.all(
                room.bannedUsers.map(async (userId) => {
                    try {
                        const userDoc = await getDoc(doc(db, 'users', userId));
                        if (userDoc.exists()) {
                            const userData = userDoc.data() as UserProfile;
                            return { 
                                id: userId, 
                                username: userData.username || 'Unknown User', 
                                name: userData.name,
                                profilePic: userData.profilePic 
                            };
                        }
                        return { 
                            id: userId, 
                            username: 'Unknown User', 
                            name: 'Unknown',
                            profilePic: '' 
                        };
                    } catch (error) {
                        console.error(`Error fetching user data for ${userId}:`, error);
                        return { 
                            id: userId, 
                            username: 'Unknown User', 
                            name: 'Unknown',
                            profilePic: '' 
                        };
                    }
                })
            );
            setBannedUsersData(bannedUserProfiles);
        } catch (error) {
            console.error('Error loading banned users:', error);
            toast.error('Failed to load banned users');
        }
    }, [room?.bannedUsers, db]);

    const handleUnbanUser = useCallback(async (userId: string, username: string) => {
        if (!isRoomOwner || !roomId) return;

        if (window.confirm(`Are you sure you want to unban ${username}? They will be able to rejoin the room.`)) {
            try {
                const roomRef = doc(db, 'sideRooms', roomId);
                await updateDoc(roomRef, {
                    bannedUsers: arrayRemove(userId),
                    lastActive: serverTimestamp()
                });

                // Update local banned users list
                setBannedUsersData(prev => prev.filter(user => user.id !== userId));
                toast.success(`${username} has been unbanned`);
            } catch (error) {
                console.error('Error unbanning user:', error);
                toast.error('Failed to unban user');
            }
        }
    }, [isRoomOwner, roomId, db]);

    // Load banned users when dialog opens
    useEffect(() => {
        if (showBannedUsersDialog) {
            loadBannedUsers();
        }
    }, [showBannedUsersDialog, loadBannedUsers]);

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
    }, [roomId, currentUser?.uid, db]);

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
        console.log('[Stream Client Init Check] Stream API key configured');
        
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
                
                // AUTO-ENABLE CAMERA FOR HOST WHEN GOING LIVE
                if (isRoomOwner) {
                    console.log('[Stream Call] Host going live - auto-enabling camera');
                    try {
                        await call.camera.enable();
                        setIsCameraEnabled(true);
                        toast.success("🎥 You're now live with camera!");
                    } catch (cameraError) {
                        console.error('[Stream Call] Failed to auto-enable host camera:', cameraError);
                        toast.error("Camera failed to start - check permissions");
                    }
                }
                
                // Update room's isLive status if the current user is the room owner
                if (isRoomOwner && roomId && db) {
                    console.log('[Stream Call] Current user is room owner, updating isLive status to true');
                    const roomRef = doc(db, 'sideRooms', roomId);
                    await updateDoc(roomRef, {
                        isLive: true,
                        lastActive: serverTimestamp()
                    });
                }
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

    }, [attemptToJoinCall, streamClientForProvider, roomId, currentUser?.uid, activeStreamCallInstance, isRoomOwner]);


    // --- Function to notify followers when going live ---
    const notifyFollowersGoingLive = useCallback(async () => {
        if (!currentUser || !room || !db) return;
        
        try {
            console.log('[Live Notifications] Room owner went live, notifying followers...');
            
            // Get followers list
            const followersRef = collection(db, 'users', currentUser.uid, 'followers');
            const followersSnapshot = await getDocs(followersRef);
            
            const notifications = [];
            const emailNotifications = [];
            
            // Create notifications for each follower
            for (const followerDoc of followersSnapshot.docs) {
                const followerId = followerDoc.id;
                
                // Get follower's user data for email
                const followerUserDoc = await getDoc(doc(db, 'users', followerId));
                if (!followerUserDoc.exists()) continue;
                
                const followerData = followerUserDoc.data();
                
                // Create in-app notification
                const notificationData = {
                    type: 'user_went_live',
                    senderId: currentUser.uid,
                    senderName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Someone',
                    senderAvatar: currentUser.photoURL || '',
                    recipientId: followerId,
                    content: `${currentUser.displayName || currentUser.email?.split('@')[0] || 'Someone'} is now live in "${room.name}"`,
                    roomId: room.id,
                    roomName: room.name,
                    createdAt: serverTimestamp(),
                    isRead: false
                };
                
                notifications.push(addDoc(collection(db, 'notifications'), notificationData));
                
                // Prepare email notification if follower has email
                if (followerData.email) {
                    emailNotifications.push({
                        to: followerData.email,
                        recipientName: followerData.name || followerData.username || 'User',
                        senderName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Someone',
                        roomName: room.name,
                        roomId: room.id
                    });
                }
            }
            
            // Create all in-app notifications
            await Promise.all(notifications);
            console.log(`[Live Notifications] Created ${notifications.length} in-app notifications`);
            
            // Send email notifications via backend
            if (emailNotifications.length > 0) {
                try {
                    const backendUrl = 'https://sideeye-backend-production.up.railway.app';
                    const response = await fetch(`${backendUrl}/api/send-live-notifications`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ notifications: emailNotifications })
                    });
                    
                    if (response.ok) {
                        console.log(`[Live Notifications] Sent ${emailNotifications.length} email notifications`);
                    } else {
                        console.error('[Live Notifications] Failed to send email notifications:', await response.text());
                    }
                } catch (emailError) {
                    console.error('[Live Notifications] Error sending email notifications:', emailError);
                }
            }
            
        } catch (error) {
            console.error('[Live Notifications] Error notifying followers:', error);
        }
    }, [currentUser, room, db]);

    // --- State to track if we've already sent live notifications ---
    const [hasNotifiedFollowers, setHasNotifiedFollowers] = useState(false);

    // --- Effect to notify followers when room owner goes live ---
    useEffect(() => {
        // Only notify if current user is room owner and just joined the call
        if (!isRoomOwner || !activeStreamCallInstance || !room || !currentUser || hasNotifiedFollowers) return;
        
        // Add a small delay to ensure the call is fully established
        const timeoutId = setTimeout(() => {
            console.log('[Live Notifications] Room owner joined Stream call, triggering follower notifications');
            notifyFollowersGoingLive();
            setHasNotifiedFollowers(true); // Prevent duplicate notifications
        }, 2000); // 2 second delay to ensure call is stable
        
        return () => clearTimeout(timeoutId);
    }, [isRoomOwner, activeStreamCallInstance, room, currentUser, hasNotifiedFollowers, notifyFollowersGoingLive]);

    // --- Reset notification flag when leaving the call ---
    useEffect(() => {
        if (!activeStreamCallInstance && hasNotifiedFollowers) {
            setHasNotifiedFollowers(false);
        }
    }, [activeStreamCallInstance, hasNotifiedFollowers]);

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
                        
                        // Set isLive to false if the current user is the room owner
                        if (isRoomOwner && roomId && db) {
                            console.log('[Stream Call] Room owner left call, updating isLive status to false');
                            const roomRef = doc(db, 'sideRooms', roomId);
                            updateDoc(roomRef, {
                                isLive: false,
                                lastActive: serverTimestamp()
                            }).catch(err => console.error('[Stream Call] Error updating room isLive status on leave:', err));
                        }
                    });
            }
        };
    }, [activeStreamCallInstance, roomId, isRoomOwner, db]);

    // --- Room Listener ---
    useEffect(() => {
        if (!roomId || !currentUser) return;

        const roomRef = doc(db, 'sideRooms', roomId);
        const unsubscribeRoom = onSnapshot(roomRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                const roomData = { id: docSnapshot.id, ...docSnapshot.data() } as SideRoom;
                
                // Check if user is banned from this room
                const bannedUsers = roomData.bannedUsers || [];
                if (bannedUsers.includes(currentUser.uid)) {
                    // User is banned, show error and navigate away
                    setError('You have been banned from this room');
                    setRoom(null);
                    setLoading(false);
                    toast.error('You have been banned from this room by the owner');
                    navigate('/side-rooms');
                    return;
                }
                
                setRoom(roomData);
                setRoomHeartCount(roomData.heartCount || 0); // Set heart count
                setLoading(false);
                
                // Check if room is password protected and user is not the owner
                if (roomData.isPrivate && roomData.password && roomData.ownerId !== currentUser.uid) {
                    // Check if user is already in viewers list (already authenticated)
                    const isAlreadyViewer = roomData.viewers?.some(viewer => 
                        viewer.userId === currentUser.uid && viewer.role !== 'guest'
                    );
                    
                    if (!isAlreadyViewer) {
                        setShowPasswordDialog(true);
                    }
                }
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

    // Listen for heartbreak changes
    useEffect(() => {
        if (!roomId || !db || !currentUser?.uid) return;

        // Listen for heartbreak count changes
        const roomRef = doc(db, 'sideRooms', roomId);
        const heartbreakByRef = doc(db, 'sideRooms', roomId, 'heartbrokenBy', currentUser.uid);

        const unsubscribeRoom = onSnapshot(roomRef, (docSnap) => {
            if (docSnap.exists()) {
                const roomData = docSnap.data();
                setRoomHeartbreakCount(roomData.heartbreakCount || 0);
            }
        });

        const unsubscribeHeartbreak = onSnapshot(heartbreakByRef, (docSnap) => {
            setCurrentUserHeartbroken(docSnap.exists());
        });

        return () => {
            unsubscribeRoom();
            unsubscribeHeartbreak();
        };
    }, [roomId, db, currentUser?.uid]);
    
    // Clean up floating icons after animation completes
    useEffect(() => {
        if (floatingHearts.length > 0) {
            const timer = setTimeout(() => {
                setFloatingHearts(prev => prev.slice(1));
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [floatingHearts]);

    useEffect(() => {
        if (floatingHeartbreaks.length > 0) {
            const timer = setTimeout(() => {
                setFloatingHeartbreaks(prev => prev.slice(1));
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [floatingHeartbreaks]);

    // Check if room owner has a server chat room
    const checkForServerChatRoom = async (ownerId: string) => {
        if (!db || !ownerId) return null;
        
        try {
            // Query for public rooms created by the owner
            const roomsRef = collection(db, 'rooms');
            const q = query(
                roomsRef,
                where('createdBy', '==', ownerId),
                where('type', '==', 'public')
            );
            
            const roomsSnapshot = await getDocs(q);
            if (!roomsSnapshot.empty) {
                // Owner has at least one server chat room
                const roomDoc = roomsSnapshot.docs[0]; // Take the first one
                return {
                    id: roomDoc.id,
                    name: roomDoc.data().name || 'Chat Room'
                };
            }
            return null;
        } catch (error) {
            console.error('[SideRoomComponent] Error checking for server chat room:', error);
            return null;
        }
    };

    // --- Follow Request Acceptance Listener (for private profiles) ---
    useEffect(() => {
        if (!currentUser?.uid || !room?.ownerId || hasDeclinedServerChat) return; // Add hasDeclinedServerChat check
        
        // Only set up this listener if the room owner is not the current user
        const checkFollowStatus = async () => {
            try {
                // Get the host's data to check if account is private
                const hostRef = doc(db, "users", room.ownerId);
                const hostDoc = await getDoc(hostRef);
                const isHostPrivate = hostDoc.exists() && hostDoc.data().isPrivate === true;
                
                if (!isHostPrivate) return; // Only continue for private profiles
                
                // Check if user is now following the host (follow request accepted)
                const userFollowingRef = doc(db, "users", currentUser.uid, "following", room.ownerId);
                const followRequestRef = doc(db, "users", room.ownerId, "followRequests", currentUser.uid);
                
                const [userFollowingDoc, followRequestDoc] = await Promise.all([
                    getDoc(userFollowingRef),
                    getDoc(followRequestRef)
                ]);
                
                // If user is now following and there was a request (which means it was accepted)
                if (userFollowingDoc.exists() && !followRequestDoc.exists()) {
                    // Check if the room owner has a server chat room
                    const ownerChatRoom = await checkForServerChatRoom(room.ownerId);
                    if (ownerChatRoom && !hasDeclinedServerChat) { // Add hasDeclinedServerChat check
                        setServerChatRoom(ownerChatRoom);
                        setShowJoinRoomChatDialog(true);
                    }
                }
            } catch (error) {
                console.error("Error checking follow status:", error);
            }
        };
        
        // Run the check once
        checkFollowStatus();
        
        // Set up a listener for the user's following collection
        const userFollowingRef = doc(db, "users", currentUser.uid, "following", room.ownerId);
        const unsubscribe = onSnapshot(userFollowingRef, (docSnapshot) => {
            if (docSnapshot.exists() && !hasDeclinedServerChat) { // Add hasDeclinedServerChat check
                // The user is now following the room owner (request was accepted)
                // Check for server chat room
                checkForServerChatRoom(room.ownerId).then(chatRoom => {
                    if (chatRoom && !hasDeclinedServerChat) { // Add hasDeclinedServerChat check
                        setServerChatRoom(chatRoom);
                        setShowJoinRoomChatDialog(true);
                    }
                });
            }
        });
        
        return () => unsubscribe();
    }, [currentUser, room, db, navigate, checkForServerChatRoom, hasDeclinedServerChat]); // Add hasDeclinedServerChat to dependencies

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
        
        // Get ALL presence data, not just active
        const unsubscribe = onSnapshot(presenceRef, (snapshot) => {
            // Get all presence data
            const allUsersData = snapshot.docs.map(doc => ({
                userId: doc.id,
                ...doc.data()
            })) as PresenceData[];
            
            // Filter for active users (marked as online and not stale)
            const currentTime = Date.now();
            const maxStaleTime = 5 * 60 * 1000; // 5 minutes in milliseconds (increased to reduce updates)
            
            // To avoid too many Firestore writes, only mark one user as stale per update cycle
            let markedOneUserAsStale = false;
            
            const onlineUsersData = allUsersData.filter(user => {
                // If user is marked as online but their lastSeen is too old, mark them as stale
                if (user.isOnline && user.lastSeen && (currentTime - user.lastSeen > maxStaleTime)) {
                    // Only log every 5 minutes to reduce console spam
                    if (Date.now() % 300000 < 1000) {
                        console.log(`[Presence Listener] User ${user.userId} has stale presence (${Math.floor((currentTime - user.lastSeen)/1000)} seconds old).`);
                    }
                    
                    // Only mark one user as stale per update cycle to reduce Firestore writes
                    if (!markedOneUserAsStale && db && user.userId !== currentUser?.uid) {
                        const staleUserRef = doc(db, 'sideRooms', roomId, 'presence', user.userId);
                        updateDoc(staleUserRef, {
                            isOnline: false,
                            lastSeen: serverTimestamp()
                        }).catch(error => {
                            console.error(`[Presence Listener] Error marking stale user ${user.userId} as offline:`, error);
                        });
                        markedOneUserAsStale = true;
                    }
                    return false; // Don't include stale users in online list
                }
                return user.isOnline;
            });

            console.log('[Presence Listener - Others] Received presence snapshot. Users:', onlineUsersData.length, onlineUsersData);
            setPresence(onlineUsersData);
            
                        // Skip updating active users count to prevent infinite update cycles
            // This will be handled by a dedicated useEffect instead
            const newOnlineCount = onlineUsersData.length;
            
            // Only log online users count once per 5 minutes to avoid console spam 
            if (Date.now() % 300000 < 1000) {
                console.log(`[Presence Listener] Current active users: ${newOnlineCount}`);
            }

        }, (error) => {
            console.error('[Presence Listener - Others] CRITICAL: Snapshot error:', error);
            toast.error("Error listening to room presence updates. See console.");
            setPresence([]); // Clear presence on error to avoid stale data
        });

        return () => {
            console.log(`[Presence Listener - Others] Cleanup for room ${roomId}.`);
            unsubscribe();
        };
    }, [roomId, hasRoomAccess, currentUser?.uid, db]);

    // --- Viewers Cleanup Effect ---
    useEffect(() => {
        // This effect's only purpose is to ensure the user is marked as offline when they leave
        // Store the current user ID and room ID for the cleanup function
        const effectUserId = currentUser?.uid;
        const effectRoomId = roomId;

        return () => {
            if (effectUserId && effectRoomId && db) {
                console.log(`[Viewers Cleanup] Marking user ${effectUserId} as offline in room ${effectRoomId} on unmount`);
                
                // Update the presence document to mark user as offline
                const presenceRef = doc(db, 'sideRooms', effectRoomId, 'presence', effectUserId);
                
                updateDoc(presenceRef, {
                    isOnline: false,
                    lastSeen: serverTimestamp()
                }).then(() => {
                    console.log(`[Viewers Cleanup] Successfully marked user ${effectUserId} as offline`);
                }).catch(error => {
                    console.error(`[Viewers Cleanup] Error marking user ${effectUserId} as offline:`, error);
                    
                    // If the presence document doesn't exist, that's okay
                    if (error.code === 'not-found') {
                        console.log(`[Viewers Cleanup] No presence document found for user ${effectUserId}, which is fine`);
                    }
                });
            }
        };
    }, [roomId, currentUser?.uid, db]);
    
    // --- Presence Writer (Effect 2: Writing current user's own presence) ---
    // Reference is now defined at the top level of component
    
    useEffect(() => {
        console.log(`[Presence Writer - Self] Initializing. RoomId: ${roomId}, HasAccess: ${hasRoomAccess}, CurrentUserUID: ${currentUser?.uid}, IsRoomOwner: ${isRoomOwner}, RoomExists: ${!!room}`);

        // Skip if missing critical data
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

        // Add heartbeat interval to regularly update presence
        let heartbeatInterval: NodeJS.Timeout | null = null;

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

                // Start the heartbeat interval to regularly update presence
                if (!heartbeatInterval) {
                    heartbeatInterval = setInterval(async () => {
                        try {
                            const now = Date.now();
                            // Only update if enough time has passed (rate limit heartbeats)
                            if (now - lastPresenceUpdateTimeRef.current > 30000) {
                                // Update only the lastSeen timestamp
                                await updateDoc(myPresenceRef, {
                                    lastSeen: now,
                                    isOnline: true
                                });
                                lastPresenceUpdateTimeRef.current = now;
                                console.log(`[Presence Heartbeat] Updated for ${componentUserId}`);
                            }
                        } catch (error) {
                            console.error(`[Presence Heartbeat] Error updating heartbeat:`, error);
                        }
                    }, 60000); // Increase to every 60 seconds to reduce Firestore writes
                }

            } catch (profileError) {
                console.error(`[Presence Writer - Self] Error fetching profile or writing presence for ${componentUserId}:`, profileError);
            }
        };

        fetchProfileAndWritePresence();

        // Cleanup: Set user offline when dependencies change causing effect to re-run or on unmount
        return () => {
            // Clear heartbeat interval
            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
                heartbeatInterval = null;
            }
            
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
        
        // Camera request handlers
        const handleCameraRequest = (data: { userId: string; username: string; avatar?: string; roomId: string }) => {
            console.log('[Camera Request] Received camera request:', data);
            console.log('[Camera Request] Current room ID:', roomId);
            console.log('[Camera Request] Is room owner:', isRoomOwner);
            
            if (data.roomId === roomId && isRoomOwner) {
                console.log('[Camera Request] Processing camera request from:', data.username);
                setCameraRequests(prev => {
                    // Check if request already exists
                    const exists = prev.some(req => req.userId === data.userId);
                    if (exists) {
                        console.log('[Camera Request] Request already exists, ignoring');
                        return prev;
                    }
                    
                    const newRequest = {
                        userId: data.userId,
                        username: data.username,
                        avatar: data.avatar,
                        timestamp: Date.now()
                    };
                    console.log('[Camera Request] Adding new request:', newRequest);
                    return [...prev, newRequest];
                });
                toast.success(`${data.username} requested camera permission`);
            } else {
                console.log('[Camera Request] Ignoring request - not for this room or not room owner');
            }
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
        const handleBeenRemoved = (data: { roomId: string, targetUserId?: string, reason?: string } | string) => {
            // Handle both old string format and new object format for backward compatibility
            const roomIdToCheck = typeof data === 'string' ? data : data.roomId;
            const reason = typeof data === 'object' ? data.reason : 'removed';
            
            if (roomIdToCheck === roomId && currentUser?.uid) { // Ensure it's this room and user is defined
                let message = "The host has removed you from the room.";
                if (reason === 'blocked') {
                    message = "You have been blocked by the room owner and removed from the room.";
                }
                
                toast.error(message);
                activeStreamCallInstance?.leave()
                    .catch(err => console.error("[SideRoomComponent] Error leaving Stream call after being removed:", err))
                    .finally(() => {
                        navigate('/side-rooms'); // Navigate to the main room list
                    });
                // Additional cleanup of local room-specific state might be done here if necessary,
                // but navigation and Stream leave should cover most.
            }
        };

        // Listener for when the current user is banned from the room by the host
        const handleBeenBanned = (data: { roomId: string, reason?: string }) => {
            if (data.roomId === roomId && currentUser?.uid) { // Ensure it's this room and user is defined
                toast.error(`You have been banned from this room. ${data.reason || ''}`);
                activeStreamCallInstance?.leave()
                    .catch(err => console.error("[SideRoomComponent] Error leaving Stream call after being banned:", err))
                    .finally(() => {
                        navigate('/side-rooms'); // Navigate to the main room list
                    });
            }
        };

        // Listener for when the current user is force-muted by the room owner
        const handleBeenForceMuted = (data: { roomId: string, targetUserId: string }) => {
            if (data.roomId === roomId && data.targetUserId === currentUser?.uid && activeStreamCallInstance) {
                console.log('[SideRoomComponent] Received force-mute from room owner');
                activeStreamCallInstance.microphone.disable()
                    .then(async () => {
                        // Update Firestore presence to reflect force-mute state
                        try {
                            const userPresenceRef = doc(db, 'sideRooms', roomId, 'presence', currentUser.uid);
                            await updateDoc(userPresenceRef, { forceMuted: true });
                        } catch (error) {
                            console.error('[SideRoomComponent] Error updating presence after force-mute:', error);
                        }
                        
                        toast.error("You have been muted by the room owner");
                        console.log('[SideRoomComponent] Successfully muted user via force-mute');
                    })
                    .catch(err => {
                        console.error("[SideRoomComponent] Error force-muting user:", err);
                        toast.error("Failed to mute microphone");
                    });
            }
        };

        // Listener for when the current user is force-unmuted by the room owner
        const handleBeenForceUnmuted = (data: { roomId: string, targetUserId: string }) => {
            if (data.roomId === roomId && data.targetUserId === currentUser?.uid && activeStreamCallInstance) {
                console.log('[SideRoomComponent] Received force-unmute from room owner');
                activeStreamCallInstance.microphone.enable()
                    .then(async () => {
                        // Update Firestore presence to reflect force-unmute state
                        try {
                            const userPresenceRef = doc(db, 'sideRooms', roomId, 'presence', currentUser.uid);
                            await updateDoc(userPresenceRef, { forceMuted: false });
                        } catch (error) {
                            console.error('[SideRoomComponent] Error updating presence after force-unmute:', error);
                        }
                        
                        toast.success("You have been unmuted by the room owner");
                        console.log('[SideRoomComponent] Successfully unmuted user via force-unmute');
                    })
                    .catch(err => {
                        console.error("[SideRoomComponent] Error force-unmuting user:", err);
                        toast.error("Failed to unmute microphone");
                    });
            }
        };

        socket.on('invite-success', handleInviteSuccess);
        socket.on('invite-failed', handleInviteFailed);
        socket.on('guest-joined', handleGuestJoined);
        socket.on('user-search-results-for-invite', handleUserSearchResults);
        socket.on('force-remove', handleBeenRemoved); // Listen for the server's force-remove directive
        socket.on('force-ban', handleBeenBanned); // Listen for the server's force-ban directive
        socket.on('force-mute', handleBeenForceMuted); // Listen for force-mute from room owner
        socket.on('force-unmute', handleBeenForceUnmuted); // Listen for force-unmute from room owner
        socket.on('camera-request', handleCameraRequest); // Listen for camera requests

        return () => {
            socket.off('invite-success', handleInviteSuccess);
            socket.off('invite-failed', handleInviteFailed);
            socket.off('guest-joined', handleGuestJoined);
            socket.off('user-search-results-for-invite', handleUserSearchResults);
            socket.off('force-remove', handleBeenRemoved); // Clean up listener
            socket.off('force-ban', handleBeenBanned); // Clean up ban listener
            socket.off('force-mute', handleBeenForceMuted); // Clean up force-mute listener
            socket.off('force-unmute', handleBeenForceUnmuted); // Clean up force-unmute listener
            socket.off('camera-request', handleCameraRequest); // Clean up camera request listener
        };
    }, [socket, roomId, navigate, activeStreamCallInstance, currentUser?.uid, isRoomOwner]); // Added isRoomOwner to dependencies

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
            
            // Force check to see if user is already invited
            try {
                // Check if the user exists in the users collection first
                const userQuery = query(
                    collection(db, 'users'),
                    where('username', '==', selectedInviteeForInvite.username)
                );
                const userSnapshot = await getDocs(userQuery);
                
                if (userSnapshot.empty) {
                    toast.error("User not found.");
                    setIsInvitingUser(false);
                    return;
                }
                
                // Get the first matching user (should be unique by username)
                const userData = userSnapshot.docs[0].data() as UserProfile;
                const userId = userSnapshot.docs[0].id;
                
                // Now check if this user is in the room's viewers list
                const roomRef = doc(db, 'sideRooms', roomId);
                const roomSnapshot = await getDoc(roomRef);
                
                if (!roomSnapshot.exists()) {
                    toast.error("Room not found.");
                    setIsInvitingUser(false);
                    return;
                }
                
                const roomData = roomSnapshot.data() as SideRoom;
                const isUserInRoom = roomData.viewers?.some(viewer => viewer.userId === userId);
                
                if (isUserInRoom) {
                    toast.error(`${selectedInviteeForInvite.username} is already in this room.`);
                    setIsInvitingUser(false);
                    return;
                }
                
                // If we get here, user exists and is not in the room, so proceed with invite
                socket.emit('invite-user-to-room', { 
                    roomId, 
                    inviterId: currentUser.uid, 
                    inviteeUsername: selectedInviteeForInvite.username 
                });
            } catch (error) {
                console.error("Error checking if user is in room:", error);
                // Continue with invite anyway, let server handle validation
                socket.emit('invite-user-to-room', { 
                    roomId, 
                    inviterId: currentUser.uid, 
                    inviteeUsername: selectedInviteeForInvite.username 
                });
            }
            
            // Let the 'invite-success' or 'invite-failed' listeners handle UI updates
        } else {
            console.warn("Could not send invite due to missing socket, user, room, or selected invitee info.", { socket: !!socket, currentUser: !!currentUser?.uid, roomId, selectedInviteeForInvite });
            toast.error("Cannot send invite: connection or user data issue.");
            setIsInvitingUser(false); // Reset processing state immediately on client-side error
        }
    }, [currentUser?.uid, roomId, selectedInviteeForInvite, socket, db]);

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
                    {/* Follow Host button - only shown to participants/viewers, not to the host */}
                    {currentUser?.uid && room?.ownerId && currentUser.uid !== room.ownerId && ownerData && (
                        <Tooltip title={`Follow ${ownerData.username}`}>
                            <IconButton 
                                onClick={async () => {
                                    if (!currentUser?.uid || !room?.ownerId || !db) {
                                        toast.error("Cannot follow host: missing data");
                                        return;
                                    }
                                    
                                    try {
                                        // First check if the user has already sent a request or is following
                                        const userFollowingRef = doc(db, "users", currentUser.uid, "following", room.ownerId);
                                        const userFollowingDoc = await getDoc(userFollowingRef);

                                        // Also check if there's already a pending request
                                        const followRequestRef = doc(db, "users", room.ownerId, "followRequests", currentUser.uid);
                                        const followRequestDoc = await getDoc(followRequestRef);
                                        
                                        // Get the host's data to check if account is private
                                        const hostRef = doc(db, "users", room.ownerId);
                                        const hostDoc = await getDoc(hostRef);
                                        const isHostPrivate = hostDoc.exists() && hostDoc.data().isPrivate === true;
                                        
                                        if (userFollowingDoc.exists()) {
                                            // Already following, unfollow
                                            await deleteDoc(userFollowingRef);
                                            // Also remove from the host's followers
                                            const hostFollowerRef = doc(db, "users", room.ownerId, "followers", currentUser.uid);
                                            await deleteDoc(hostFollowerRef);
                                            toast.success(`Unfollowed ${ownerData.username}`);
                                        } else if (followRequestDoc.exists()) {
                                            // Already requested, cancel request
                                            await deleteDoc(followRequestRef);
                                            toast.success(`Canceled follow request to ${ownerData.username}`);
                                        } else if (isHostPrivate) {
                                            // Host has a private account, send a follow request
                                            await setDoc(followRequestRef, {
                                                userId: currentUser.uid,
                                                username: currentUser.displayName || currentUser.email || "Unknown user",
                                                timestamp: serverTimestamp()
                                            });
                                            toast.success(`Follow request sent to ${ownerData.username}`);
                                        } else {
                                            // Not following and host is public, add follow directly
                                            await setDoc(userFollowingRef, { 
                                                timestamp: serverTimestamp() 
                                            });
                                            // Also add to the host's followers
                                            const hostFollowerRef = doc(db, "users", room.ownerId, "followers", currentUser.uid);
                                            await setDoc(hostFollowerRef, { 
                                                timestamp: serverTimestamp() 
                                            });
                                            toast.success(`Following ${ownerData.username}`);
                                            
                                            // Check if the room owner has a server chat room
                                            const ownerChatRoom = await checkForServerChatRoom(room.ownerId);
                                            if (ownerChatRoom && !hasDeclinedServerChat) { // Add hasDeclinedServerChat check
                                                setServerChatRoom(ownerChatRoom);
                                                setShowJoinRoomChatDialog(true);
                                            }
                                        }
                                    } catch (error) {
                                        console.error("Error toggling follow:", error);
                                        toast.error("Failed to follow/unfollow host");
                                    }
                                }}
                                sx={{ color: room?.style?.accentColor || 'inherit' }}
                            >
                                <PersonAddIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                    {/* Heart and Heartbreak buttons removed from here */}
                    <Tooltip title="Share">
                        <IconButton onClick={handleShareRoom} sx={{ color: room?.style?.accentColor || 'inherit' }}>
                            <ShareIcon />
                        </IconButton>
                    </Tooltip>
                    {/* Report Room button - only visible to viewers/participants, not room owners */}
                    {currentUser?.uid && room?.ownerId && currentUser.uid !== room.ownerId && (
                        <Tooltip title="Report Room">
                            <IconButton 
                                onClick={handleOpenReportRoom} 
                                sx={{ color: room?.style?.accentColor || 'inherit' }}
                            >
                                <ReportIcon />
                            </IconButton>
                        </Tooltip>
                    )}
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
                    {/* Only show recording button on desktop */}
                    {isDesktop && (
                        <Tooltip title={isRecording ? "Stop Recording" : "Record Room (Desktop Only)"}>
                            <IconButton 
                                onClick={isRecording ? stopRecording : startRecording}
                                color={isRecording ? "error" : "inherit"}
                                sx={{ color: isRecording ? theme.palette.error.main : room?.style?.accentColor || 'inherit' }}
                            >
                                {isRecording ? <StopIcon /> : <VideocamIcon />}
                            </IconButton>
                        </Tooltip>
                    )}
                    
                    {/* Camera controls */}
                    {activeStreamCallInstance && (
                        <>
                            {isRoomOwner ? (
                                /* Room owner: Camera toggle + Camera requests management */
                                <>
                                    <Tooltip title={isCameraEnabled ? "Turn Camera Off" : "Turn Camera On"}>
                                        <IconButton 
                                            onClick={toggleCamera}
                                            sx={{ color: isCameraEnabled ? room?.style?.accentColor || theme.palette.primary.main : 'inherit' }}
                                        >
                                            {isCameraEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
                                        </IconButton>
                                    </Tooltip>
                                    
                                    {/* Camera requests button - always visible to room owners */}
                                    <Tooltip title={
                                        cameraRequests.length > 0 
                                            ? `${cameraRequests.length} camera request(s) - Click to manage` 
                                            : "Manage camera requests"
                                    }>
                                            <IconButton 
                                                onClick={() => setShowCameraRequestsDialog(true)}
                                            sx={{ 
                                                color: cameraRequests.length > 0 
                                                    ? theme.palette.warning.main 
                                                    : room?.style?.accentColor || 'inherit',
                                                animation: cameraRequests.length > 0 ? 'pulse 2s infinite' : 'none',
                                                '@keyframes pulse': {
                                                    '0%': { opacity: 1 },
                                                    '50%': { opacity: 0.5 },
                                                    '100%': { opacity: 1 }
                                                }
                                            }}
                                            >
                                            {cameraRequests.length > 0 ? (
                                                <Badge badgeContent={cameraRequests.length} color="error">
                                                    <PersonAddIcon />
                                                </Badge>
                                            ) : (
                                                <PersonAddIcon />
                                            )}
                                            </IconButton>
                                        </Tooltip>
                                </>
                            ) : (
                                /* Participants: Request camera permission or camera toggle if approved */
                                !isCameraEnabled ? (
                                    <Tooltip title={hasPendingCameraRequest ? "Camera request pending..." : "Request camera permission"}>
                                        <span>
                                            <IconButton 
                                                onClick={requestCameraPermission}
                                                disabled={hasPendingCameraRequest}
                                                sx={{ color: hasPendingCameraRequest ? theme.palette.warning.main : room?.style?.accentColor || 'inherit' }}
                                            >
                                                {hasPendingCameraRequest ? (
                                                    <Badge variant="dot" color="warning">
                                                        <VideocamIcon />
                                                    </Badge>
                                                ) : (
                                                    <VideocamOffIcon />
                                                )}
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                ) : (
                                    <Tooltip title="Turn Camera Off">
                                        <IconButton 
                                            onClick={() => {
                                                if (activeStreamCallInstance) {
                                                    activeStreamCallInstance.camera.disable()
                                                        .then(() => {
                                                            setIsCameraEnabled(false);
                                                            toast.success("Camera disabled");
                                                        })
                                                        .catch(err => {
                                                            console.error("Error disabling camera:", err);
                                                        });
                                                }
                                            }}
                                            sx={{ color: room?.style?.accentColor || theme.palette.primary.main }}
                                        >
                                            <VideocamIcon />
                                        </IconButton>
                                    </Tooltip>
                                )
                            )}
                        </>
                    )}
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
                                <MenuItem onClick={() => {
                                    setShowBannedUsersDialog(true);
                                    handleMenuClose();
                                }}> 
                                    <ListItemIcon><Block fontSize="small" /></ListItemIcon>
                                    View Banned Users
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
                   {/* {isRoomOwner && isDesktop && activeStreamCallInstance && (
                        <Tooltip title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen (Desktop Only)"}>
                            <IconButton onClick={handleToggleScreenShare} sx={{ color: room?.style?.accentColor || 'inherit' }}>
                                {isScreenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                            </IconButton>
                        </Tooltip>
                    )} */}
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
    const handleForceMuteToggle = useCallback(async (targetUserId: string, currentForceMuteState: boolean) => {
        if (!isRoomOwner || !roomId || targetUserId === currentUser?.uid || !socket) return;
        console.log(`Owner toggling force-mute for ${targetUserId}. Currently force-muted: ${currentForceMuteState}`);
        
        const newForceMuteState = !currentForceMuteState;
        const targetPresenceRef = doc(db, 'sideRooms', roomId, 'presence', targetUserId);
        
        try {
            // Update Firestore for UI consistency - use forceMuted field
            await updateDoc(targetPresenceRef, { forceMuted: newForceMuteState });
            
            // Send socket event to force mute/unmute the target user
            if (newForceMuteState) {
                socket.emit('force-mute', { roomId, targetUserId });
                console.log(`[SideRoomComponent] Emitted force-mute for user ${targetUserId}`);
            } else {
                socket.emit('force-unmute', { roomId, targetUserId });
                console.log(`[SideRoomComponent] Emitted force-unmute for user ${targetUserId}`);
            }

            toast.success(`User ${newForceMuteState ? 'muted' : 'unmuted'}.`);
        } catch (error) {
            console.error(`Error toggling force-mute for ${targetUserId}:`, error);
            toast.error('Failed to update mute status.');
        }
    }, [isRoomOwner, roomId, currentUser?.uid, db, socket]);

    const handleForceRemove = useCallback((targetUserId: string, targetUsername?: string, reason?: string) => {
        if (!isRoomOwner || !roomId || targetUserId === currentUser?.uid || !socket) return;
        
        const name = targetUsername || 'this user';
        const isBlockAction = reason === 'blocked';
        
        if (!isBlockAction && !window.confirm(`Are you sure you want to remove ${name} from the room?`)) {
            return;
        }
        
        console.log(`[SideRoomComponent] Owner removing user ${targetUserId} from room ${roomId} - reason: ${reason || 'removed'}`);
        socket.emit('force-remove', { roomId, targetUserId, reason: reason || 'removed' }); // Emit to server with reason
        
        if (!isBlockAction) {
            toast.success(`Removing ${name}...`); // Optimistic toast only for manual removal
        }
    }, [isRoomOwner, roomId, currentUser?.uid, socket]);

    // Ban Handler - Permanently bans user from the room
    const handleForceBan = useCallback(async (targetUserId: string, targetUsername?: string) => {
        if (!isRoomOwner || !roomId || targetUserId === currentUser?.uid) return;
        
        const name = targetUsername || 'this user';

        if (window.confirm(`Are you sure you want to ban ${name}? They will be banned from this room and cannot rejoin.`)) {
            try {
                // Add user to banned list in room document
                const roomRef = doc(db, 'sideRooms', roomId);
                const roomDoc = await getDoc(roomRef);
                
                if (roomDoc.exists()) {
                    const roomData = roomDoc.data();
                    const currentBannedUsers = roomData.bannedUsers || [];
                    
                    if (!currentBannedUsers.includes(targetUserId)) {
                        // Add to banned users list
                        await updateDoc(roomRef, {
                            bannedUsers: arrayUnion(targetUserId),
                            lastActive: serverTimestamp()
                        });
                        
                        // Also remove from viewers list if present
                        const currentViewers = roomData.viewers || [];
                        const updatedViewers = currentViewers.filter((viewer: any) => viewer.userId !== targetUserId);
                        
                        await updateDoc(roomRef, {
                            viewers: updatedViewers
                        });
                        
                        console.log(`[SideRoomComponent] User ${targetUserId} banned from room ${roomId}`);
                        
                        // Force remove via socket to kick them out immediately
                        if (socket) {
                            socket.emit('force-ban', { roomId, targetUserId, reason: 'Banned by room owner' });
                        }
                        
                        toast.success(`${name} has been banned from the room`);
                    } else {
                        toast.error(`${name} is already banned from this room`);
                    }
                } else {
                    toast.error('Room not found');
                }
            } catch (error) {
                console.error('Error banning user:', error);
                toast.error('Failed to ban user');
            }
        }
    }, [isRoomOwner, roomId, currentUser?.uid, socket, db]);

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
    }, [sadeMessages, showSadeChat, sadeTypingText]); // Also depend on sadeTypingText

    // --- Sade AI Typing Effect ---
    useEffect(() => {
        if (!isDisplayingText || !sadeTypingText) return;
        
        let index = 0;
        const fullText = sadeTypingText;
        
        // Function to add one character at a time
        const typeNextChar = () => {
            if (index < fullText.length) {
                // Get the current messages array
                setSadeMessages(prev => {
                    // Create a new array and update the last message
                    const newMessages = [...prev];
                    // We know the last message is from AI and needs to be updated
                    if (newMessages.length > 0 && newMessages[newMessages.length - 1].sender === 'ai') {
                        const lastMsg = newMessages[newMessages.length - 1];
                        newMessages[newMessages.length - 1] = {
                            ...lastMsg, // Preserve sourceLinks and other properties
                            text: fullText.substring(0, index + 1)
                        };
                    }
                    return newMessages;
                });
                
                index++;
                setTimeout(typeNextChar, typingSpeed);
            } else {
                // Done typing
                setIsDisplayingText(false);
                setSadeTypingText('');
            }
        };
        
        // Start the typing effect
        typeNextChar();
        
        // Cleanup function
        return () => {
            // This is just in case the component unmounts during typing
            setIsDisplayingText(false);
        };
    }, [isDisplayingText, sadeTypingText, typingSpeed]);
    
    // Function to start the typing effect for a new message
    const displayWithTypingEffect = (text: string) => {
        // Find the last message which should be the empty AI message with potential source links
        setSadeMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            // If the last message is from AI and is empty, use it for typing
            if (lastMsg && lastMsg.sender === 'ai' && (lastMsg.text === '' || lastMsg.text === 'Thinking...')) {
                // Keep the existing array and just update the last message
                return prev.map((msg, idx) => 
                    idx === prev.length - 1 ? { ...msg, text: '' } : msg
                );
            }
            // Otherwise add a new empty AI message
            return [...prev, { sender: 'ai', text: '' }];
        });
        
        // Then start the typing effect
        setSadeTypingText(text);
        setIsDisplayingText(true);
    };

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
                displayWithTypingEffect("Configuration error: Backend URL not set.");
                setSadeLoading(false);
                return;
            }
            const apiUrl = `${backendBaseUrl}/api/sade-ai`;

            // --- Ensure userId is included, remove client-side history --- 
            if (!currentUser?.uid) {
                console.error("[SideRoomComponent - SadeAI] ERROR: User ID not available.");
                displayWithTypingEffect("Error: Could not identify user.");
                setSadeLoading(false);
                return;
            }

            // Add a temporary "Thinking..." message
            setSadeMessages(prev => [...prev, { sender: 'ai', text: 'Thinking...' }]);

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
                    useContextFlags: true // Enable contextFlags feature
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
            
            // Remove the temporary "Thinking..." message
            setSadeMessages(prev => prev.filter((_, i) => i !== prev.length - 1));
            
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
                // Check if we have source links from search results
                if (data.sourceLinks && Array.isArray(data.sourceLinks) && data.sourceLinks.length > 0) {
                    // Add an empty AI message with source links that will be filled by typing effect
                    setSadeMessages(prevMessages => [
                        ...prevMessages, 
                        { 
                            sender: 'ai', 
                            text: '', 
                            sourceLinks: data.sourceLinks 
                        }
                    ]);
                    
                    // Start the typing effect for the text portion
                    displayWithTypingEffect(data.response);
                } else {
                    // Use normal typing effect without source links
                    displayWithTypingEffect(data.response);
                }
            } else if (data.error) {
                 console.error("[SideRoomComponent - SadeAI] Backend returned error:", data.error);
                 displayWithTypingEffect(`Sorry, there was an error: ${data.error}`);
            } else {
                console.error("[SideRoomComponent - SadeAI] Received unexpected HTTP response structure:", data);
                displayWithTypingEffect("Sorry, I got a bit confused there.");
            }

        } catch (err: any) {
            console.error("[SideRoomComponent - SadeAI] sendMessage Error:", err);
            
            // Remove any temporary "Thinking..." message
            setSadeMessages(prev => {
              if (prev.length > 0 && prev[prev.length - 1].sender === 'ai' && prev[prev.length - 1].text === 'Thinking...') {
                return prev.slice(0, -1);
              }
              return prev;
            });
            
            displayWithTypingEffect(`Sorry, there was an error: ${err.message || 'Unknown error'}`);
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

        // Add floating heart animation
        setFloatingHearts(prev => [...prev, Date.now()]);

        setIsHearting(true);
        const heartRef = doc(db, 'sideRooms', roomId, 'heartedBy', currentUser.uid);
        const heartbreakRef = doc(db, 'sideRooms', roomId, 'heartbrokenBy', currentUser.uid);
        const roomRef = doc(db, 'sideRooms', roomId);

        try {
            await runTransaction(db, async (transaction) => {
                const heartDoc = await transaction.get(heartRef);
                const heartbreakDoc = await transaction.get(heartbreakRef);
                const roomDoc = await transaction.get(roomRef);

                if (!roomDoc.exists()) {
                    throw "Room does not exist!";
                }

                const userProfile = await getDoc(doc(db, 'users', currentUser.uid));
                const username = userProfile.exists() ? userProfile.data()?.username || currentUser.displayName : 'Someone';

                // Check if user has heartbroken the room and remove it if so
                if (heartbreakDoc.exists()) {
                    transaction.delete(heartbreakRef);
                    transaction.update(roomRef, { heartbreakCount: increment(-1) });
                    // Update local state to reflect change
                    setCurrentUserHeartbroken(false);
                }

                // Toggle heart status
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
        } finally {
            setIsHearting(false);
        }
    };

    const handleToggleScreenShare = useCallback(async () => {
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
                toast.success("Screen sharing started.");
            } else {
                toast.success("Screen sharing stopped.");
            }
        } catch (error: any) {
            console.error("Error toggling screen share:", error);
            toast.error(`Failed to toggle screen sharing: ${error.message || 'Unknown error'}`);
        }
    }, [activeStreamCallInstance, isDesktop]);

    // --- Heartbreak Feature Handler ---
    const handleHeartbreakRoom = async () => {
        if (!currentUser || !currentUser.uid || !roomId || !room) return;

        // Add floating heartbreak animation
        setFloatingHeartbreaks(prev => [...prev, Date.now()]);

        setIsHeartbreaking(true);
        const heartbreakRef = doc(db, 'sideRooms', roomId, 'heartbrokenBy', currentUser.uid);
        const heartRef = doc(db, 'sideRooms', roomId, 'heartedBy', currentUser.uid);
        const roomRef = doc(db, 'sideRooms', roomId);

        try {
            await runTransaction(db, async (transaction) => {
                const heartbreakDoc = await transaction.get(heartbreakRef);
                const heartDoc = await transaction.get(heartRef);
                const roomDoc = await transaction.get(roomRef);

                if (!roomDoc.exists()) {
                    throw "Room does not exist!";
                }

                const userProfile = await getDoc(doc(db, 'users', currentUser.uid));
                const username = userProfile.exists() ? userProfile.data()?.username || currentUser.displayName : 'Someone';

                // Check if user has hearted the room and remove it if so
                if (heartDoc.exists()) {
                    transaction.delete(heartRef);
                    transaction.update(roomRef, { heartCount: increment(-1) });
                    // Update local state to reflect change
                    setCurrentUserHearted(false);
                }

                // Toggle heartbreak status
                if (heartbreakDoc.exists()) {
                    transaction.delete(heartbreakRef);
                    transaction.update(roomRef, { heartbreakCount: increment(-1) });
                } else {
                    transaction.set(heartbreakRef, {
                        userId: currentUser.uid,
                        username: username,
                        timestamp: serverTimestamp()
                    });
                    transaction.update(roomRef, { heartbreakCount: increment(1) });
                }
            });
        } catch (error) {
            console.error("Error heartbreaking room:", error);
            toast.error("Failed to update heartbreak status.");
        } finally {
            setIsHeartbreaking(false);
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
    
    
    


    // Add/update the handlePasswordSubmit function
    const handlePasswordSubmit = async () => {
        if (!room || !password || !currentUser) {
            toast.error("Missing information. Please try again.");
            return;
        }
        
        setIsProcessing(true);
        
        try {
            // Check if password matches
            if (room.password === password) {
                // Add user to viewers list if not already there
                const roomRef = doc(db, 'sideRooms', roomId as string);
                
                // Get current viewers list
                const roomSnapshot = await getDoc(roomRef);
                const roomData = roomSnapshot.data() as SideRoom;
                const viewers = roomData.viewers || [];
                
                // Check if user is already in viewers list
                const viewerExists = viewers.some(v => v.userId === currentUser.uid);
                
                if (!viewerExists) {
                    // Add user to viewers list
                    await updateDoc(roomRef, {
                        viewers: [...viewers, {
                            userId: currentUser.uid,
                            username: currentUser.displayName || currentUser.email || 'User',
                            role: 'viewer',
                            joinedAt: Date.now() // Fixed: Use Date.now() instead of serverTimestamp()
                        }]
                    });
                }
                
                toast.success("Password correct. Welcome to the room!");
                setShowPasswordDialog(false);
            } else {
                toast.error("Incorrect password. Please try again.");
            }
        } catch (error) {
            console.error("Error verifying password:", error);
            toast.error("An error occurred. Please try again.");
        } finally {
            setIsProcessing(false);
        }
    };

    // --- Screen Recording Functions ---
    const startRecording = async () => {
        // Check if on mobile device
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
            toast.error("Screen recording is not fully supported on mobile devices. Please use a desktop browser for this feature.");
            return;
        }
        
        try {
            // Check if getDisplayMedia is supported
            if (!navigator.mediaDevices?.getDisplayMedia) {
                toast.error("Screen recording is not supported in your browser.");
                return;
            }
            
            // Request both screen and audio
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true // Request audio from the screen content
            });
            
            // Get microphone audio
            const audioStream = await navigator.mediaDevices.getUserMedia({ 
                audio: true 
            });
            
            // Combine the streams for both screen and audio
            const combinedStream = new MediaStream();
            
            // Add all video tracks from the display stream
            displayStream.getVideoTracks().forEach(track => {
                combinedStream.addTrack(track);
            });
            
            // Add all audio tracks from both streams
            displayStream.getAudioTracks().forEach(track => {
                combinedStream.addTrack(track);
            });
            
            audioStream.getAudioTracks().forEach(track => {
                combinedStream.addTrack(track);
            });
            
            // Create media recorder with combined stream
            const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });
            
            // Set up event handlers
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };
            
            recorder.onstop = () => {
                // Create the final recording blob
                const recordingBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                
                // Create download link
                const url = URL.createObjectURL(recordingBlob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `sideeye-room-recording-${new Date().toISOString()}.webm`;
                
                // Add to document, click and cleanup
                document.body.appendChild(a);
                a.click();
                
                // Cleanup
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    recordedChunksRef.current = [];
                }, 100);
                
                // Stop all tracks
                combinedStream.getTracks().forEach(track => track.stop());
                
                // Update states
                setRecordingStream(null);
                setMediaRecorder(null);
                setIsRecording(false);
                
                toast.success("Recording saved to your device");
            };
            
            // Start recording
            recorder.start();
            
            // Update state
            setRecordingStream(combinedStream);
            setMediaRecorder(recorder);
            setIsRecording(true);
            
            toast.success("Screen recording started with audio");
            
            // Set up screen share ended listener
            displayStream.getVideoTracks()[0].onended = () => {
                if (recorder.state !== 'inactive') {
                    recorder.stop();
                }
            };
            
        } catch (error) {
            console.error("Error starting screen recording:", error);
            toast.error("Could not start screen recording. Please make sure you've granted the necessary permissions.");
        }
    };
    
    const stopRecording = () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        
        if (recordingStream) {
            recordingStream.getTracks().forEach(track => track.stop());
        }
    };

    // Function moved to the top level to avoid being used before declaration

    // Handle joining the server chat room
    const handleJoinServerChat = () => {
        if (serverChatRoom) {
            navigate(`/chat/room/${serverChatRoom.id}`);
        }
        setShowJoinRoomChatDialog(false);
    };

    // Handle declining to join the server chat room
    const handleDeclineServerChat = () => {
        setShowJoinRoomChatDialog(false);
        setHasDeclinedServerChat(true); // Add this line to remember the user declined
    };

    const handleOpenReportRoom = () => {
        setReportRoomDialogOpen(true);
    };

    const handleCloseReportRoom = () => {
        setReportRoomDialogOpen(false);
    };

    // --- Handler for Owner Not Live Dialog ---
    const handleOwnerNotLiveDialogClose = () => {
        setShowOwnerNotLiveDialog(false);
        // Leave the call if active
        if (activeStreamCallInstance) {
            activeStreamCallInstance.leave()
                .then(() => {
                    console.log('[Owner Not Live] Successfully left call, navigating away');
                    navigate('/side-rooms');
                })
                .catch(err => {
                    console.error('[Owner Not Live] Error leaving call:', err);
                    // Navigate away even if there's an error leaving the call
                    navigate('/side-rooms');
                });
        } else {
            // No active call, just navigate away
            navigate('/side-rooms');
        }
    };

    

    const handleOpenShareViaMessageDialog = () => {
        setShowShareDialog(false); // Close the main share dialog
        setShowShareViaMessageDialog(true);
    };

    const handleCloseShareViaMessageDialog = () => {
        setShowShareViaMessageDialog(false);
    };

    const handleSendMessage = async (recipientId: string, message: string) => {
        if (!currentUser?.uid || !db) {
            toast.error("Cannot send message: User not authenticated.");
            return;
        }

        try {
            // Check if this is a server chat room message
            const roomRef = doc(db, 'rooms', recipientId);
            const roomDoc = await getDoc(roomRef);
            
            if (roomDoc.exists()) {
                // This is a server chat room message
                const messagesRef = collection(db, 'rooms', recipientId, 'messages');
                await addDoc(messagesRef, {
                    text: message,
                    sender: currentUser.uid,
                    senderName: currentUser.displayName || 'Unknown User',
                    senderPhoto: currentUser.photoURL,
                    timestamp: serverTimestamp(),
                    type: 'chat'
                });
                return;
            }

            // If not a room, proceed with direct message logic
            const conversationsRef = collection(db, 'conversations');
            const q = query(
                conversationsRef,
                where('participants', 'array-contains', currentUser.uid)
            );
            
            const snapshot = await getDocs(q);
            let conversationId: string | null = null;
            
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.participants.includes(recipientId)) {
                    conversationId = doc.id;
                }
            });

            // If no conversation exists, create one
            if (!conversationId) {
                // Get recipient's user data to check if they follow the current user
                const recipientUserRef = doc(db, 'users', recipientId);
                const recipientUserDoc = await getDoc(recipientUserRef);
                
                if (!recipientUserDoc.exists()) {
                    throw new Error('Recipient user not found');
                }
                
                const recipientData = recipientUserDoc.data();
                const recipientFollowsCurrentUser = recipientData.following?.includes(currentUser.uid) || false;
                
                // Create new conversation
                const newConversationRef = doc(collection(db, 'conversations'));
                await setDoc(newConversationRef, {
                    participants: [currentUser.uid, recipientId],
                    createdAt: serverTimestamp(),
                    lastUpdated: serverTimestamp(),
                    unreadCount: {
                        [currentUser.uid]: 0,
                        [recipientId]: 1
                    },
                    status: recipientFollowsCurrentUser ? 'accepted' : 'pending'
                });
                
                conversationId = newConversationRef.id;
            }

            // Add the message to the conversation
            const messagesRef = collection(db, 'conversations', conversationId, 'messages');
            await addDoc(messagesRef, {
                text: message,
                sender: currentUser.uid,
                timestamp: serverTimestamp(),
                read: false,
                reactions: []
            });

            // Update conversation with last message
            const conversationRef = doc(db, 'conversations', conversationId);
            await updateDoc(conversationRef, {
                lastMessage: {
                    text: message,
                    sender: currentUser.uid,
                    timestamp: serverTimestamp()
                },
                lastUpdated: serverTimestamp(),
                [`unreadCount.${recipientId}`]: increment(1)
            });

        } catch (error) {
            console.error("Error sending message:", error);
            throw error;
        }
    };

    // Main return for SideRoomComponent
    return (
        <>
            {/* Floating hearts and heartbreaks */}
            {floatingHearts.map((id) => (
                <FloatingIcon 
                    key={`heart-${id}`} 
                    icon={<FavoriteIcon />} 
                    color={theme.palette.error.main} 
                />
            ))}
            {floatingHeartbreaks.map((id) => (
                <FloatingIcon 
                    key={`heartbreak-${id}`} 
                    icon={<HeartBrokenIcon />} 
                    color={theme.palette.error.main} 
                />
            ))}
            
            {/* Floating reactions panel on the right side of the page */}
            {room && (
                <FloatingReactionsPanel
                    handleHeartRoom={handleHeartRoom}
                    handleHeartbreakRoom={handleHeartbreakRoom}
                    currentUserHearted={currentUserHearted}
                    currentUserHeartbroken={currentUserHeartbroken}
                    roomHeartCount={roomHeartCount}
                    roomHeartbreakCount={roomHeartbreakCount}
                    isHearting={isHearting}
                    isHeartbreaking={isHeartbreaking}
                    accentColor={room?.style?.accentColor}
                    textColor={room?.style?.textColor}
                />
            )}
            
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
                overflow: 'hidden', // Add this to prevent outer scrollbar
                // Add these properties to prevent glitching during transitions
                willChange: 'transform', // Hardware acceleration hint
                position: 'relative',
                zIndex: 1,
                animation: 'none !important', // Disable any animations
                transition: 'none !important', // Disable any transitions on first render
                transform: 'translateZ(0)', // Force hardware acceleration
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
                                     navigate={navigate}
                                     // Camera request props
                                     requestCameraPermission={requestCameraPermission}
                                     hasPendingCameraRequest={hasPendingCameraRequest}
                                     toggleCameraCallback={toggleCamera}
                                     // Camera permission check
                                     shouldShowUserVideo={shouldShowUserVideo}
                                     approvedCameraUsers={approvedCameraUsers}
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
                            value={`${window.location.origin}/side-room/${roomId}`} // pageUrl is already defined
                            InputProps={{
                                readOnly: true,
                            }}
                            sx={{ mb: 2 }}
                        />
                        <Button 
                            variant="contained" 
                            startIcon={<ContentCopyIcon />}
                                        onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/side-room/${roomId}`);
                                toast.success("Room link copied to clipboard!");
                                        }}
                            sx={{ mb: 2 }}
                        >
                            Copy Link
                        </Button>

                        <Divider sx={{ my: 2 }}>
                            <Chip label="OR" />
                        </Divider>

                        <Typography variant="subtitle2" gutterBottom sx={{ mb: 1}}>
                            Share via Direct Message:
                        </Typography>
                        <Button 
                            variant="outlined" 
                            startIcon={<ChatIcon />} // Or another appropriate icon
                            onClick={handleOpenShareViaMessageDialog}
                            sx={{ mb: 2, width: '100%' }} // Make it full width for emphasis
                        >
                            Send to a Friend
                        </Button>

                        <Divider sx={{ my: 2 }}>
                            <Chip label="OR" />
                        </Divider>

                        <Typography variant="subtitle2" gutterBottom sx={{ mb: 1}}>
                            Share on social media:
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-around', mt: 1 }}>
                                    <IconButton
                                color="primary" 
                                onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(`${window.location.origin}/side-room/${roomId}`)}&text=${encodeURIComponent(room?.name || 'Join my SideEye Room!')}`, '_blank')}
                                title="Share on Twitter"
                                    >
                                <TwitterIcon />
                                    </IconButton>
                                    <IconButton
                                color="primary" 
                                onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/side-room/${roomId}`)}`, '_blank')}
                                title="Share on Facebook"
                                  >
                                <FacebookIcon />
                                    </IconButton>
                            <IconButton
                                color="primary"
                                onClick={() => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent((room?.name || 'Join my SideEye Room!') + ' ' + `${window.location.origin}/side-room/${roomId}`)}`, '_blank')}
                                title="Share on WhatsApp"
                            >
                                <WhatsAppIcon />
                            </IconButton>
                            {/* Add Instagram Icon Button */}
                            <IconButton
                                color="primary" 
                                onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/side-room/${roomId}`);
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
                                <ListItem key={`msg-${msg.sender}-${index}`} sx={{ 
                                    display: 'flex', 
                                    flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row',
                                    alignItems: 'flex-start', // Change to flex-start to allow proper alignment with source links
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
                                    <Box sx={{ display: 'flex', flexDirection: 'column', maxWidth: '75%' }}>
                                        <Paper 
                                            elevation={1} 
                                            sx={{
                                                p: '6px 12px',
                                                borderRadius: msg.sender === 'user' ? '15px 15px 0 15px' : '15px 15px 15px 0',
                                                bgcolor: msg.sender === 'user' ? 'primary.main' : 'background.paper',
                                                color: msg.sender === 'user' ? 'primary.contrastText' : 'text.primary',
                                                maxWidth: '100%',
                                                wordBreak: 'break-word'
                                            }}
                                        >
                                            {msg.text}
                                        </Paper>
                                        
                                        {/* Display source links if they exist */}
                                        {msg.sender === 'ai' && msg.sourceLinks && (
                                            <SearchSourceLinks links={msg.sourceLinks} />
                                        )}
                                    </Box>
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
                                        key={`suggestion-${index}`}
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
                        open={showEditDialog} 
                        onClose={() => setShowEditDialog(false)}
                        onSubmit={async (updatedData, newThumbnailFile) => {
                            if (!roomId || !currentUser) {
                                toast.error("Error: Missing room or user data.");
                                return;
                            }
                            setIsProcessing(true);
                            try {
                                // Start with current thumbnail URL
                                let thumbnailUrl = room.thumbnailUrl || '';
                                
                                // Upload new thumbnail if provided
                                if (newThumbnailFile) {
                                    const storageRef = ref(storage, `room-thumbnails/${roomId}_${Date.now()}_${newThumbnailFile.name}`);
                                    await uploadBytes(storageRef, newThumbnailFile);
                                    thumbnailUrl = await getDownloadURL(storageRef);
                                }
                                
                                const roomRef = doc(db, 'sideRooms', roomId);
                                
                                // Define fields to update
                                const dataToUpdate: Record<string, any> = {
                                    name: updatedData.name,
                                    description: updatedData.description,
                                    isPrivate: updatedData.isPrivate,
                                    tags: updatedData.tags || [],
                                    thumbnailUrl: thumbnailUrl,
                                    lastActive: serverTimestamp()
                                };
                                
                                // Handle password field
                                if (updatedData.isPrivate && updatedData.password && updatedData.password.length > 0) {
                                    dataToUpdate.password = updatedData.password;
                                } else if (!updatedData.isPrivate) {
                                    // Remove password if room is public
                                    dataToUpdate.password = deleteField();
                                }
                                
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
                                                    <ListItemText 
                                                        primary={
                                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                {userResult.username}
                                                                <VerifiedUserIcon 
                                                                    sx={{ 
                                                                        ml: 0.5, 
                                                                        color: 'primary.main',
                                                                        fontSize: '0.8rem',
                                                                        verticalAlign: 'middle'
                                                                    }} 
                                                                />
                                                            </Box>
                                                        } 
                                                        secondary={userResult.name} 
                                                    />
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
                        {selectedInviteeForInvite && (
                            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'success.main' }}>
                                Selected: {selectedInviteeForInvite.username}
                                <VerifiedUserIcon 
                                    sx={{ 
                                        ml: 0.3, 
                                        color: 'primary.main',
                                        fontSize: '0.7rem',
                                        verticalAlign: 'middle'
                                    }} 
                                />
                            </Typography>
                        )}
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

                {/* Add or update Password Dialog */}
                <Dialog open={showPasswordDialog} onClose={() => {
                    // If user closes dialog without entering password, navigate away
                    if (!isRoomOwner && !hasRoomAccess) {
                        navigate('/side-rooms');
                    }
                }}>
                    <DialogTitle>Password Required</DialogTitle>
                    <DialogContent>
                        <Typography variant="body1" gutterBottom>
                            This room is password protected. Please enter the password to join.
                        </Typography>
                        <TextField
                            autoFocus
                            margin="dense"
                            id="password"
                            label="Password"
                            type="password"
                            fullWidth
                            variant="outlined"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => navigate('/side-rooms')} disabled={isProcessing}>
                            Cancel
                        </Button>
                        <Button 
                            onClick={handlePasswordSubmit} 
                            disabled={isProcessing || !password} 
                            variant="contained"
                        >
                            {isProcessing ? <CircularProgress size={24} /> : "Submit"}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Join Server Chat Room Dialog */}
                <Dialog
                    open={showJoinRoomChatDialog}
                    onClose={handleDeclineServerChat}
                    aria-labelledby="join-room-chat-dialog-title"
                >
                    <DialogTitle id="join-room-chat-dialog-title">Join Room Chat?</DialogTitle>
                    <DialogContent>
                        <Typography variant="body1">
                            {ownerData?.username || "This creator"} has a server chat room: "{serverChatRoom?.name}". Would you like to join it to receive updates and connect with other followers?
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleDeclineServerChat}>Not Now</Button>
                        <Button onClick={handleJoinServerChat} variant="contained" color="primary">
                            Join Chat Room
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Report Room Dialog */}
                {room && (
                    <ReportContent
                        contentId={room.id}
                        contentType="sideRoom"
                        onClose={handleCloseReportRoom}
                        open={reportRoomDialogOpen}
                        ownerUsername={ownerData?.username}
                    />
                )}

                <ShareRoomViaMessageDialog
                    open={showShareViaMessageDialog}
                    onClose={handleCloseShareViaMessageDialog}
                    roomName={room?.name}
                    roomLink={pageUrl} // Assuming pageUrl holds the current room link
                    onSend={handleSendMessage}
                    currentUserId={currentUser?.uid}
                />

                {/* Banned Users Management Dialog */}
                <Dialog
                    open={showBannedUsersDialog}
                    onClose={() => setShowBannedUsersDialog(false)}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="h6">Banned Users</Typography>
                            <IconButton onClick={() => setShowBannedUsersDialog(false)}>
                                <CloseIcon />
                            </IconButton>
                        </Box>
                    </DialogTitle>
                    <DialogContent>
                        {bannedUsersData.length === 0 ? (
                            <Box sx={{ textAlign: 'center', py: 3 }}>
                                <Typography variant="body1" color="text.secondary">
                                    No users are currently banned from this room
                                </Typography>
                            </Box>
                        ) : (
                            <List>
                                {bannedUsersData.map((user) => (
                                    <ListItem
                                        key={user.id}
                                        sx={{ 
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            borderRadius: 1,
                                            mb: 1
                                        }}
                                        secondaryAction={
                                            <Button
                                                variant="outlined"
                                                color="success"
                                                size="small"
                                                onClick={() => handleUnbanUser(user.id, user.username)}
                                            >
                                                Unban
                                            </Button>
                                        }
                                    >
                                        <ListItemAvatar>
                                            <Avatar src={user.profilePic} alt={user.username}>
                                                {user.username.charAt(0).toUpperCase()}
                                            </Avatar>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={user.name || user.username}
                                            secondary={`@${user.username}`}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Camera Requests Dialog */}
                <Dialog
                    open={showCameraRequestsDialog}
                    onClose={() => setShowCameraRequestsDialog(false)}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="h6">Camera Requests</Typography>
                            <IconButton onClick={() => setShowCameraRequestsDialog(false)}>
                                <CloseIcon />
                            </IconButton>
                        </Box>
                    </DialogTitle>
                    <DialogContent>
                        {cameraRequests.length === 0 ? (
                            <Box sx={{ textAlign: 'center', py: 3 }}>
                                <Typography variant="body1" color="text.secondary">
                                    No pending camera requests
                                </Typography>
                            </Box>
                        ) : (
                            <List>
                                {cameraRequests.map((request) => (
                                    <ListItem
                                        key={request.userId}
                                        sx={{ 
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            borderRadius: 1,
                                            mb: 1
                                        }}
                                    >
                                        <ListItemAvatar>
                                            <Avatar src={request.avatar} alt={request.username}>
                                                {request.username.charAt(0).toUpperCase()}
                                            </Avatar>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={request.username}
                                            secondary={`Requested ${new Date(request.timestamp).toLocaleTimeString()}`}
                                        />
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Button
                                                variant="contained"
                                                color="success"
                                                size="small"
                                                onClick={() => handleCameraRequestDecision(request.userId, request.username, true)}
                                                startIcon={<VideocamIcon />}
                                            >
                                                Approve
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                color="error"
                                                size="small"
                                                onClick={() => handleCameraRequestDecision(request.userId, request.username, false)}
                                                startIcon={<VideocamOffIcon />}
                                            >
                                                Deny
                                            </Button>
                                        </Box>
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Owner Not Live Dialog */}
                <Dialog
                    open={showOwnerNotLiveDialog}
                    onClose={handleOwnerNotLiveDialogClose}
                    aria-labelledby="owner-not-live-dialog-title"
                    maxWidth="sm"
                    fullWidth
                    disableEscapeKeyDown
                    sx={{
                        '& .MuiDialog-paper': {
                            borderRadius: 2,
                            boxShadow: theme.shadows[10]
                        }
                    }}
                >
                    <DialogTitle id="owner-not-live-dialog-title" sx={{ textAlign: 'center', pb: 1 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ 
                                fontSize: '3rem',
                                color: theme.palette.warning.main
                            }}>
                                🔴
                            </Box>
                            <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
                                Owner Not Live
                            </Typography>
                        </Box>
                    </DialogTitle>
                    <DialogContent sx={{ textAlign: 'center', py: 3 }}>
                        <Typography variant="body1" sx={{ mb: 2, fontSize: '1.1rem' }}>
                            The room owner <strong>{ownerData?.username || 'Unknown'}</strong> is currently not in the room.
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Please come back when they are live to enjoy the full room experience!
                        </Typography>
                        <Box sx={{ 
                            backgroundColor: alpha(theme.palette.info.main, 0.1),
                            border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
                            borderRadius: 1,
                            p: 2,
                            mt: 2
                        }}>
                            <Typography variant="body2" color="info.main">
                                💡 Tip: You can check the "Discover" page to find rooms with active hosts!
                            </Typography>
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
                        <Button 
                            onClick={handleOwnerNotLiveDialogClose}
                            variant="contained"
                            size="large"
                            sx={{ 
                                minWidth: 120,
                                borderRadius: 2,
                                textTransform: 'none',
                                fontSize: '1rem'
                            }}
                        >
                            Okay
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
    onForceRemove: (targetUserId: string, targetUsername?: string, reason?: string) => void, 
    onForceBan: Function, 
    theme: any,
    navigate: Function,
    requestCameraPermission: () => void,
    hasPendingCameraRequest: boolean,
    toggleCameraCallback: () => void,
    shouldShowUserVideo: (userId: string) => boolean,
    approvedCameraUsers: Set<string>
}> = ({ room, isRoomOwner, isGuest, handleOpenShareVideoDialog, handleClearSharedVideo, currentVideoUrl, renderVideoPlayer, onForceMuteToggle, onForceRemove, onForceBan, theme, navigate, requestCameraPermission, hasPendingCameraRequest, toggleCameraCallback, shouldShowUserVideo, approvedCameraUsers }) => {
    // Create a ref for the screen share video element
    const screenShareVideoRef = useRef<HTMLVideoElement>(null);
    const call = useCall(); 
    const { useParticipants, useCallState, useMicrophoneState, useCameraState } = useCallStateHooks(); 
    const participants = useParticipants(); 
    const { localParticipant } = useCallState(); 
    const { isMute: localUserIsMute } = useMicrophoneState(); 
    const { isEnabled: isCameraEnabled, isTogglePending } = useCameraState(); 
    
    // State to force screen share updates
   

    // Initialize camera as disabled
    useEffect(() => {
        if (call) {
            call.camera.disable().catch(err => {
                console.error("Error disabling camera:", err);
            });
        }
    }, [call]);

    const { currentUser } = useAuth();

    // Add state for desktop detection
    const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);
    
    // State to prevent triggering dialog multiple times
    const [hasTriggeredOwnerNotLiveDialog, setHasTriggeredOwnerNotLiveDialog] = useState(false);

    // --- Effect to check if room owner is actually LIVE in the Stream call ---
    useEffect(() => {
        // DEBUG: Skip if feature is disabled - get from parent component via props
        // For now, we'll assume it's enabled. This could be passed as a prop if needed.
        
        // Only check if we're not the room owner and have participants data
        if (!room || !currentUser || currentUser.uid === room.ownerId) {
            return;
        }

        // Wait for participants to load (but not long)
        if (!participants) {
            return;
        }

        console.log('[Stream Owner Live Check] Checking if room owner is in Stream call:', {
            roomOwnerId: room.ownerId,
            currentUserId: currentUser.uid,
            streamParticipants: participants.map(p => ({ userId: p.userId, name: p.name })),
            participantCount: participants.length,
            hasTriggeredBefore: hasTriggeredOwnerNotLiveDialog
        });

        // Check if room owner is among Stream call participants
        const ownerInStreamCall = participants.some(participant => participant.userId === room.ownerId);

        console.log('[Stream Owner Live Check] Immediate check result:', {
            ownerInStreamCall,
            roomOwnerId: room.ownerId,
            hasParticipants: participants.length > 0
        });

        // If owner joins the call, reset the flag
        if (ownerInStreamCall && hasTriggeredOwnerNotLiveDialog) {
            console.log('[Stream Owner Live Check] Owner joined the call! Resetting trigger flag.');
            setHasTriggeredOwnerNotLiveDialog(false);
            return;
        }

        // Only trigger dialog if we haven't already triggered it
        if (!ownerInStreamCall && participants.length > 0 && !hasTriggeredOwnerNotLiveDialog) {
            // Check immediately if we have multiple participants (meaning data is stable)
            if (participants.length > 1) {
                console.log('[Stream Owner Live Check] Multiple participants found, showing dialog IMMEDIATELY');
                setHasTriggeredOwnerNotLiveDialog(true);
                window.dispatchEvent(new CustomEvent('showOwnerNotLiveDialog'));
                return;
            }
            
            // Very short grace period only for data to settle when we only have 1 participant
            console.log('[Stream Owner Live Check] Only 1 participant, starting minimal grace period...');
            const timeoutId = setTimeout(() => {
                // Quick re-check after minimal delay
                const currentParticipants = participants || [];
                const ownerStillNotInCall = !currentParticipants.some(p => p.userId === room.ownerId);
                
                console.log('[Stream Owner Live Check] Final check after minimal delay:', {
                    ownerStillNotInCall,
                    currentParticipantsCount: currentParticipants.length,
                    participantIds: currentParticipants.map(p => p.userId)
                });

                if (ownerStillNotInCall && !hasTriggeredOwnerNotLiveDialog) {
                    console.log('[Stream Owner Live Check] Owner confirmed not in Stream call, showing dialog NOW');
                    setHasTriggeredOwnerNotLiveDialog(true);
                    window.dispatchEvent(new CustomEvent('showOwnerNotLiveDialog'));
                }
            }, 500); // Further reduced to just 0.5 second grace period

            return () => clearTimeout(timeoutId);
        } else if (ownerInStreamCall) {
            console.log('[Stream Owner Live Check] Owner IS in Stream call - they are live! No dialog needed.');
        } else if (hasTriggeredOwnerNotLiveDialog) {
            console.log('[Stream Owner Live Check] Dialog already triggered, not checking again.');
        } else {
            console.log('[Stream Owner Live Check] No participants yet, waiting for data...');
        }
    }, [room, currentUser, participants, hasTriggeredOwnerNotLiveDialog]);
    

    // Add state to track PiP visibility separately from camera state
    const [isPipVisible, setIsPipVisible] = useState(true);
    const [isPipEnlarged, setIsPipEnlarged] = useState(false);
    const [hiddenParticipantIds, setHiddenParticipantIds] = useState<string[]>([]);

    const [pinnedUserIds, setPinnedUserIds] = useState<string[]>([]);
    
    // Add state for chat tab
    const [activeTab, setActiveTab] = useState<'participants' | 'chat' | 'gifts' | 'topGifters'>('participants');
    const [chatMessages, setChatMessages] = useState<{id: string, userId: string, userName: string, message: string, timestamp: number}[]>([]);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef<null | HTMLDivElement>(null);

    // Screen sharing detection - ensure ALL participants can see it
   

    // State to cache usernames from Firestore
    const [firestoreUserData, setFirestoreUserData] = useState<{[key: string]: {username: string, avatar?: string}}>({});

    // Determine if chat tab should be shown
    const shouldShowChatTab = true; // Always show chat tab

    // Screen sharing detection using Stream's built-in functionality
    const screenSharingParticipant = participants.find(p => p.screenShareStream);

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
        if (!chatInput.trim() || !currentUser?.uid || !room?.id || !db) return;
        
        // Get the current user's Firestore username
        const userData = await fetchUserFirestoreData(currentUser.uid);
        
        const newMessage = {
            id: `${Date.now()}-${currentUser.uid}`,
            userId: currentUser.uid,
            userName: userData.username,
            message: chatInput.trim(),
            timestamp: Date.now()
        };
        
        // Add message to Firestore so other users can see it
        try {
            const chatRef = collection(db, 'sideRooms', room.id, 'chatMessages');
            await addDoc(chatRef, newMessage);
            console.log('[Chat] Message sent to Firestore');
        } catch (error) {
            console.error('[Chat] Error sending message to Firestore:', error);
            // Still add message locally in case of network issues
            setChatMessages(prev => [...prev, newMessage]);
        }
        
        setChatInput('');
    }, [chatInput, currentUser?.uid, room?.id, db, fetchUserFirestoreData]);

    // Add useEffect to listen for chat messages from Firestore
    useEffect(() => {
        if (!room?.id || !db) return;
        
        console.log(`[Chat] Setting up chat listener for room ${room.id}`);
        
        // Create a query for chat messages, ordered by timestamp
        const chatQuery = query(
            collection(db, 'sideRooms', room.id, 'chatMessages'),
            orderBy('timestamp', 'asc')
        );
        
        // Set up real-time listener
        const unsubscribe = onSnapshot(chatQuery, (snapshot) => {
            const messages: {
                id: string;
                userId: string;
                userName: string;
                message: string;
                timestamp: number;
            }[] = [];
            
            snapshot.forEach((doc) => {
                const data = doc.data();
                messages.push({
                    id: doc.id,
                    userId: data.userId,
                    userName: data.userName,
                    message: data.message,
                    timestamp: data.timestamp
                });
            });
            
            console.log(`[Chat] Received ${messages.length} messages from Firestore`);
            setChatMessages(messages);
            
            // Scroll to bottom when new messages arrive
            if (chatEndRef.current) {
                chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
            }
        }, (error) => {
            console.error('[Chat] Error listening to chat messages:', error);
        });
        
        return () => {
            console.log('[Chat] Cleaning up chat listener');
            unsubscribe();
        };
    }, [room?.id, db]);

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
            console.log('Current screen share state:', call.screenShare.enabled);
            
            if (!call.screenShare.enabled) {
                // Starting screen share
                toast.loading("Starting screen share...");
                await call.screenShare.enable();
                console.log('Screen share enabled successfully');
                toast.dismiss();
                toast.success("Screen sharing started! Everyone should see your screen now.");
            } else {
                // Stopping screen share
                await call.screenShare.disable();
                console.log('Screen share disabled successfully');
                toast.success("Screen sharing stopped.");
            }
        } catch (error: any) {
            toast.dismiss();
            console.error("Screen share error:", error);
            
            if (error.name === 'NotAllowedError' || error.message?.includes('Permission denied')) {
                toast.error("Screen share permission denied. Please allow access when prompted by your browser.");
            } else if (error.message?.includes('getDisplayMedia is not supported')) {
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

    // Fetch Firestore data for all participants when they change
    useEffect(() => {
        if (!participants || participants.length === 0) return;
        
        console.log('[InsideStreamCallContent] Fetching Firestore data for participants:', participants.map(p => p.userId));
        
        // Fetch Firestore data for all participants
        participants.forEach(participant => {
            if (participant.userId && !firestoreUserData[participant.userId]) {
                fetchUserFirestoreData(participant.userId);
            }
        });
    }, [participants, fetchUserFirestoreData, firestoreUserData]);


    // Reset PiP visibility when camera is enabled
    useEffect(() => {
        if (isCameraEnabled) {
            setIsPipVisible(true);
        }
    }, [isCameraEnabled]);

    const gridParticipants = sortedParticipants;

    // Add these functions here:
const renderCallStatusHeader = () => null; // Simple placeholder - can be enhanced later

const handleLeaveCall = () => {
    if (call) {
        call.leave()
            .then(() => {
                console.log('Successfully left call');
                navigate('/side-rooms');
            })
            .catch(err => {
                console.error('Error leaving call:', err);
                navigate('/side-rooms'); // Navigate anyway
            });
    } else {
        navigate('/side-rooms');
    }
};

    

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
            color: room?.style?.textColor || theme.palette.text.primary,
            willChange: 'transform',
            position: 'relative',
            zIndex: 1,
            animation: 'none !important',
            transition: 'none !important',
            transform: 'translateZ(0)'
        }}>
            {renderCallStatusHeader()}
            
            <Box sx={{
                flexGrow: 1, 
                p: 2, 
                // Removing overflowY to fix double scrollbar issue
                // overflowY: 'auto', 
            }}>
                {/* TimeFrame - Show host live session duration */}
                <TimeFrame 
                    isHostLive={participants.some(p => p.userId === room.ownerId)}
                    roomStyle={room?.style}
                    hostName={participants.find(p => p.userId === room.ownerId)?.name || 'Host'}
                    isCurrentUserHost={isRoomOwner}
                    onStopLive={() => {
                        if (call) {
                            console.log('[TimeFrame] Host stopping live session...');
                            call.leave()
                                .then(() => {
                                    console.log('[TimeFrame] Successfully ended live session');
                                    navigate('/side-rooms');
                                })
                                .catch(err => {
                                    console.error('[TimeFrame] Error ending live session:', err);
                                    navigate('/side-rooms'); // Navigate anyway
                                });
                        } else {
                            navigate('/side-rooms');
                        }
                    }}
                />

              

                {/* Screen Share Display - Shows when someone is sharing */}
                {screenSharingParticipant && (
                    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                        <Typography variant="h6" align="center" sx={{ 
                            mt: 2, 
                            mb: 2, 
                            fontWeight: 700,
                            color: room?.style?.accentColor || theme.palette.primary.main,
                        }}>
                            🖥️ {screenSharingParticipant.name || 'Someone'} is sharing their screen
                        </Typography>
                        
                        <Box sx={{ 
                            width: '100%',
                            maxWidth: '1200px',
                            position: 'relative',
                            paddingTop: '56.25%', // 16:9 aspect ratio
                            backgroundColor: '#000',
                            borderRadius: 2,
                            overflow: 'hidden',
                            border: `2px solid ${room?.style?.accentColor || theme.palette.primary.main}`,
                            '& .str-video__participant-view': {
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                '& video': {
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain'
                                }
                            }
                        }}>
                            <ParticipantView 
                                participant={screenSharingParticipant} 
                                trackType="screenShareTrack" 
                            />
                        </Box>
                    </Box>
                )}

                {/* Dynamic video layout based on participant count */}
                {!screenSharingParticipant && (
                    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Typography variant="h6" align="center" sx={{ 
                            mt: 2, 
                            mb: 1, 
                            fontWeight: 500,
                            color: room?.style?.accentColor || theme.palette.primary.main
                        }}>
                            Live Video
                        </Typography>
                        
                        {(() => {
                            const otherParticipants = participants.filter(p => p.userId !== currentUser?.uid);
                            // Don't filter by camera permission here - we'll do that later based on context
                            const hasOtherParticipants = otherParticipants.length > 0;
                            
                            // HOST SOLO MODE: Large 1080x720 camera
                            if (isRoomOwner && isCameraEnabled && !hasOtherParticipants) {
                                return (
                            <Box sx={{ 
                                border: '3px solid',
                                borderColor: theme.palette.primary.main,
                                borderRadius: '16px',
                                backgroundColor: '#000',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                        width: { xs: '95%', sm: '80%', md: '70%' },
                                        maxWidth: '1080px',
                                        aspectRatio: '16/9', // 1080x720 ratio
                                overflow: 'hidden',
                                        boxShadow: '0 15px 30px rgba(0,0,0,0.5)',
                                        mb: 2,
                                '& .str-video__participant-view': {
                                    width: '100%',
                                    height: '100%',
                                    '& video': {
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        background: '#000'
                                    }
                                }
                            }}>
                                        {localParticipant && (
                                            <ParticipantView participant={localParticipant} trackType="videoTrack" />
                                        )}
                                        
                                        {/* Host overlay */}
                                        <Box sx={{
                                            position: 'absolute',
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            padding: '60px 24px 24px 24px',
                                            background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                                            color: 'white',
                                            zIndex: 2
                                        }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <Avatar sx={{ width: 50, height: 50, mr: 2 }}>
                                                        {currentUser?.displayName?.[0] || 'H'}
                                                    </Avatar>
                                                    <Box>
                                                        <Typography variant="h6" fontWeight="bold">
                                                            {currentUser?.displayName || 'Host'} (Host)
                                                        </Typography>
                                                        <Typography variant="body2">
                                                            {room?.name || 'Live Room'}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                                
                                                {/* Large control buttons */}
                                                <Box sx={{ display: 'flex', gap: 2 }}>
                                                    <Tooltip title={localUserIsMute ? "Unmute" : "Mute"}>
                                                        <IconButton 
                                                            onClick={() => call?.microphone.toggle()}
                                                            sx={{
                                                                backgroundColor: 'rgba(0,0,0,0.6)',
                                                                color: 'white',
                                                                width: 56,
                                                                height: 56,
                                                                '&:hover': {
                                                                    backgroundColor: 'rgba(0,0,0,0.8)'
                                                                }
                                                            }}
                                                        >
                                                            {localUserIsMute ? <MicOff fontSize="large" /> : <Mic fontSize="large" />}
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Turn Camera Off">
                                <IconButton
                                    onClick={toggleCameraCallback}
                                    sx={{
                                        backgroundColor: 'rgba(0,0,0,0.6)',
                                        color: 'white',
                                                                width: 56,
                                                                height: 56,
                                        '&:hover': {
                                            backgroundColor: 'rgba(255,0,0,0.8)'
                                        }
                                    }}
                                >
                                                            <VideocamOffIcon fontSize="large" />
                                </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            </Box>
                                        </Box>
                                    </Box>
                                );
                            }
                            
                            // Check if we have participants with camera enabled
                            const participantsWithCamera = otherParticipants.filter(p => shouldShowUserVideo(p.userId));
                            const currentUserHasCamera = isCameraEnabled;
                            
                            // IMPROVED: Check for camera permissions using Firestore data directly
                            const otherUsersWithCameraPermission = otherParticipants.filter(p => {
                                // Check if user has camera permission via shouldShowUserVideo OR approvedCameraUsers
                                const hasPermissionViaFunction = shouldShowUserVideo(p.userId);
                                const hasPermissionViaFirestore = approvedCameraUsers.has(p.userId);
                                const isRoomOwner = p.userId === room.ownerId;
                                
                                console.log(`[Video Layout] User ${p.userId}: hasPermissionViaFunction=${hasPermissionViaFunction}, hasPermissionViaFirestore=${hasPermissionViaFirestore}, isRoomOwner=${isRoomOwner}`);
                                
                                return hasPermissionViaFunction || hasPermissionViaFirestore || isRoomOwner;
                            });
                            
                            console.log(`[Video Layout] Current user has camera: ${currentUserHasCamera}, Other users with permission: ${otherUsersWithCameraPermission.length}, Approved camera users: ${Array.from(approvedCameraUsers)}`);
                            
                            // SIDE-BY-SIDE MODE: When current user has camera AND there are other users with camera permission
                            // SIMPLE FIX: Also check if there are any approved camera users at all
                            const hasApprovedUsers = approvedCameraUsers.size > 0;
                            if (currentUserHasCamera && (otherUsersWithCameraPermission.length > 0 || hasApprovedUsers)) {
                                return (
                                    <Box sx={{ 
                                        width: '100%',
                                        display: 'flex',
                                        flexDirection: 'row',
                                        justifyContent: 'center',
                                        alignItems: 'flex-start',
                                        gap: 2,
                                        flexWrap: { xs: 'wrap', sm: 'nowrap' },
                                        mb: 2
                                    }}>
                                        {/* Current user's video */}
                                        {currentUserHasCamera && (
                                            <Box sx={{ 
                                                border: '3px solid',
                                                borderColor: isRoomOwner ? theme.palette.primary.main : 'divider',
                                                borderRadius: '16px',
                                                backgroundColor: '#000',
                                                position: 'relative',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                width: { xs: '95%', sm: '45%' },
                                                aspectRatio: '16/9',
                                                overflow: 'hidden',
                                                boxShadow: '0 15px 30px rgba(0,0,0,0.5)',
                                                '& .str-video__participant-view': {
                                                    width: '100%',
                                                    height: '100%',
                                                    '& video': {
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'cover',
                                                        background: '#000'
                                                    }
                                                }
                                            }}>
                                {localParticipant && (
                                    <ParticipantView participant={localParticipant} trackType="videoTrack" />
                                )}
                                
                                <Box sx={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    padding: '40px 16px 16px 16px',
                                    background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                                    color: 'white',
                                    zIndex: 2
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                        <Avatar sx={{ width: 32, height: 32, mr: 1 }}>
                                            {currentUser?.displayName?.[0] || 'U'}
                                        </Avatar>
                                        <Box>
                                            <Typography variant="subtitle2" fontWeight="bold">
                                                                {currentUser?.displayName || 'You'} {isRoomOwner && '(Host)'}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                                            </Box>
                                        )}

                                        {/* Other participant's video */}
                                        {(otherUsersWithCameraPermission.length > 0 || hasApprovedUsers) && (() => {
                                            // SIMPLE FIX: Show any participant with camera permission or approval
                                            const participantToShow = participantsWithCamera[0] || 
                                                                    otherUsersWithCameraPermission[0] || 
                                                                    otherParticipants.find(p => approvedCameraUsers.has(p.userId));
                                            
                                            if (!participantToShow) return null;
                                            
                                            const hasActiveVideo = participantsWithCamera.some(p => p.userId === participantToShow.userId);
                                            
                                            return (
                                <Box sx={{
                                                    border: '3px solid',
                                                    borderColor: participantToShow.userId === room.ownerId ? theme.palette.primary.main : 'divider',
                                                    borderRadius: '16px',
                                                    backgroundColor: '#000',
                                                    position: 'relative',
                                    display: 'flex',
                                    flexDirection: 'column',
                                                    width: { xs: '95%', sm: '45%' },
                                                    aspectRatio: '16/9',
                                                    overflow: 'hidden',
                                                    boxShadow: '0 15px 30px rgba(0,0,0,0.5)',
                                                    '& .str-video__participant-view': {
                                                        width: '100%',
                                                        height: '100%',
                                                        '& video': {
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'cover',
                                                            background: '#000'
                                                        }
                                                    }
                                                }}>
                                                    {hasActiveVideo ? (
                                                        <ParticipantView 
                                                            participant={participantToShow} 
                                                            trackType="videoTrack" 
                                                        />
                                                    ) : (
                                                        // Show placeholder when camera permission granted but not yet enabled
                                <Box sx={{
                                                            width: '100%',
                                                            height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                                            justifyContent: 'center',
                                                            backgroundColor: '#1a1a1a'
                                                        }}>
                                                            <Box sx={{ textAlign: 'center', color: 'white' }}>
                                                                <Avatar 
                                                                    src={firestoreUserData[participantToShow.userId]?.avatar} 
                                                                    sx={{ width: 80, height: 80, mx: 'auto', mb: 2 }}
                                                                >
                                                                    {participantToShow?.name?.[0] || 'U'}
                                                                </Avatar>
                                                                <Typography variant="body2">
                                                                    Camera permission granted
                                                                </Typography>
                                                                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                                                                    Waiting for camera to turn on...
                                                </Typography>
                                            </Box>
                                </Box>
                            )}

                                                    <Box sx={{
                                                        position: 'absolute',
                                                        bottom: 0,
                                                        left: 0,
                                                        right: 0,
                                                        padding: '40px 16px 16px 16px',
                                                        background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                                                        color: 'white',
                                                        zIndex: 2
                                                    }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                            <Avatar src={firestoreUserData[participantToShow.userId]?.avatar} sx={{ width: 32, height: 32, mr: 1 }} />
                                                            <Box>
                                                                <Typography variant="subtitle2" fontWeight="bold">
                                                                    {participantToShow?.name || 'User'}
                                                                    {participantToShow.userId === room.ownerId && " (Host)"}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    </Box>
                                                </Box>
                                            );
                                        })()}
                                    </Box>
                                );
                            }
                            
                            // HOST SOLO MODE: Large 1080x720 camera for host only
                            // SIMPLE FIX: Only show solo mode if NO approved users exist
                            if (isRoomOwner && currentUserHasCamera && otherUsersWithCameraPermission.length === 0 && !hasApprovedUsers) {
                                return (
                                    <Box sx={{ 
                                        border: '3px solid',
                                        borderColor: theme.palette.primary.main,
                                        borderRadius: '16px',
                                        backgroundColor: '#000',
                                        position: 'relative',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        width: { xs: '95%', sm: '80%', md: '70%' },
                                        maxWidth: '1080px',
                                        aspectRatio: '16/9',
                                        overflow: 'hidden',
                                        boxShadow: '0 15px 30px rgba(0,0,0,0.5)',
                                        mb: 2,
                                        '& .str-video__participant-view': {
                                            width: '100%',
                                            height: '100%',
                                            '& video': {
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                                background: '#000'
                                            }
                                        }
                                    }}>
                                        {localParticipant && (
                                            <ParticipantView participant={localParticipant} trackType="videoTrack" />
                                        )}
                                        
                                        <Box sx={{
                                            position: 'absolute',
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            padding: '60px 24px 24px 24px',
                                            background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                                            color: 'white',
                                            zIndex: 2
                                        }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <Avatar sx={{ width: 50, height: 50, mr: 2 }}>
                                                        {currentUser?.displayName?.[0] || 'H'}
                                                    </Avatar>
                                                    <Box>
                                                        <Typography variant="h6" fontWeight="bold">
                                                            {currentUser?.displayName || 'Host'} (Host)
                                                        </Typography>
                                                        <Typography variant="body2">
                                                            {room?.name || 'Live Room'}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                                
                                                <Box sx={{ display: 'flex', gap: 2 }}>
                                                    <Tooltip title={localUserIsMute ? "Unmute" : "Mute"}>
                                        <IconButton
                                                            onClick={() => call?.microphone.toggle()}
                                                            sx={{
                                                                backgroundColor: 'rgba(0,0,0,0.6)',
                                                                color: 'white',
                                                                width: 56,
                                                                height: 56,
                                                                '&:hover': {
                                                                    backgroundColor: 'rgba(0,0,0,0.8)'
                                                                }
                                                            }}
                                                        >
                                                            {localUserIsMute ? <MicOff fontSize="large" /> : <Mic fontSize="large" />}
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Turn Camera Off">
                                                        <IconButton 
                                                            onClick={toggleCameraCallback}
                                            sx={{
                                                backgroundColor: 'rgba(0,0,0,0.6)',
                                                color: 'white',
                                                                width: 56,
                                                                height: 56,
                                                '&:hover': {
                                                    backgroundColor: 'rgba(255,0,0,0.8)'
                                                }
                                            }}
                                        >
                                                            <VideocamOffIcon fontSize="large" />
                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            </Box>
                                        </Box>
                                    </Box>
                                );
                            }
                            
                            // PARTICIPANT SOLO MODE: Show host video if available
                            if (!isRoomOwner && otherUsersWithCameraPermission.length > 0 && !currentUserHasCamera) {
                                const hostParticipant = participantsWithCamera.find(p => p.userId === room.ownerId) || 
                                                       otherUsersWithCameraPermission.find(p => p.userId === room.ownerId);
                                const participantToShow = hostParticipant || participantsWithCamera[0] || otherUsersWithCameraPermission[0];
                                const hasActiveVideo = participantsWithCamera.some(p => p.userId === participantToShow.userId);
                                
                                return (
                                    <Box sx={{ 
                                        border: '3px solid',
                                        borderColor: participantToShow.userId === room.ownerId ? theme.palette.primary.main : 'divider',
                                        borderRadius: '16px',
                                        backgroundColor: '#000',
                                        position: 'relative',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        width: { xs: '95%', sm: '80%', md: '70%' },
                                        maxWidth: '1080px',
                                        aspectRatio: '16/9',
                                        overflow: 'hidden',
                                        boxShadow: '0 15px 30px rgba(0,0,0,0.5)',
                                        mb: 2,
                                        '& .str-video__participant-view': {
                                            width: '100%',
                                            height: '100%',
                                            '& video': {
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                                background: '#000'
                                            }
                                        }
                                    }}>
                                        {hasActiveVideo ? (
                                            <ParticipantView 
                                                participant={participantToShow} 
                                                trackType="videoTrack" 
                                            />
                                        ) : (
                                            // Show placeholder when camera permission granted but not yet enabled
                                            <Box sx={{
                                                width: '100%',
                                                height: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: '#1a1a1a'
                                            }}>
                                                <Box sx={{ textAlign: 'center', color: 'white' }}>
                                                    <Avatar 
                                                        src={firestoreUserData[participantToShow.userId]?.avatar} 
                                                        sx={{ width: 120, height: 120, mx: 'auto', mb: 3 }}
                                                    >
                                                        {participantToShow?.name?.[0] || 'U'}
                                                    </Avatar>
                                                    <Typography variant="h6" sx={{ mb: 1 }}>
                                                        Camera permission granted
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                                        Waiting for camera to turn on...
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        )}

                                        <Box sx={{
                                            position: 'absolute',
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            padding: '60px 24px 24px 24px',
                                            background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                                            color: 'white',
                                            zIndex: 2
                                        }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                <Avatar src={firestoreUserData[participantToShow.userId]?.avatar} sx={{ width: 50, height: 50, mr: 2 }} />
                                                    <Box>
                                                    <Typography variant="h6" fontWeight="bold">
                                                            {participantToShow?.name || 'User'}
                                                            {participantToShow.userId === room.ownerId && " (Host)"}
                                                        </Typography>
                                                    <Typography variant="body2">
                                                        {room?.name || 'Live Room'}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                        </Box>
                                    </Box>
                                );
                            }
                            
                            // NO VIDEO: Just show message
                            return (
                                    <Box sx={{
                                    width: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                    mb: 2
                                }}>
                                    <Typography variant="h6" align="center" sx={{ 
                                        color: room?.style?.textColor || theme.palette.text.primary,
                                        mb: 2
                                    }}>
                                        {isRoomOwner ? "Turn on your camera to go live!" : "Waiting for host to enable camera..."}
                                    </Typography>
                                    </Box>
                            );
                        })()}

                        {/* COLLAGE: Additional participants in a grid */}
                        {participants && participants.filter(p => p.userId !== currentUser?.uid && shouldShowUserVideo(p.userId)).length > 1 && (
                            <Box sx={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                                gap: 1.5,
                                mt: 2,
                                width: '100%',
                                maxWidth: '800px',
                                px: 2
                            }}>
                                {participants
                                   .filter(p => p.userId !== currentUser?.uid)
                                   .filter(p => shouldShowUserVideo(p.userId)) // Only show participants with camera permission
                                   .slice(1) // Skip the first participant (shown in main view)
                                   .filter(p => !hiddenParticipantIds.includes(p.userId))
                                   .map((participant) => (
                                    <Box 
                                        key={participant.userId}
                                        sx={{
                                            aspectRatio: '3/4',
                                            borderRadius: '12px',
                                            overflow: 'hidden',
                                            position: 'relative',
                                            border: '2px solid',
                                            borderColor: participant.userId === room.ownerId ? theme.palette.primary.main : 'divider',
                                            backgroundColor: '#000',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
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
                                        <ParticipantView participant={participant} trackType="videoTrack" />
                                        
                                        <IconButton
                                            onClick={() => {
                                                const hiddenIds = [...(hiddenParticipantIds || [])];
                                                    hiddenIds.push(participant.userId);
                                                setHiddenParticipantIds(hiddenIds);
                                                toast.success("Video hidden");
                                            }}
                                            sx={{
                                                position: 'absolute',
                                                top: 4,
                                                right: 4,
                                                backgroundColor: 'rgba(0,0,0,0.6)',
                                                color: 'white',
                                                width: 24,
                                                height: 24,
                                                zIndex: 10,
                                                '& .MuiSvgIcon-root': {
                                                    fontSize: '16px'
                                                },
                                                '&:hover': {
                                                    backgroundColor: 'rgba(255,0,0,0.8)'
                                                }
                                            }}
                                        >
                                            <CloseIcon />
                                        </IconButton>
                                        
                                        <Box sx={{
                                            position: 'absolute',
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            padding: '8px 6px 4px 6px',
                                            background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                                            color: 'white'
                                        }}>
                                            <Typography variant="caption" sx={{
                                                fontSize: '11px',
                                                fontWeight: 'bold',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                display: 'block'
                                        }}>
                                            {participant.name || `User ${participant.userId.substring(0, 5)}`}
                                                {participant.userId === room.ownerId && ' (Host)'}
                                            </Typography>
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        )}
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
                 <Box sx={{ 
                     mb: 2, 
                     borderBottom: 1, 
                     borderColor: 'divider',
                     overflow: 'hidden' // Hide overflow for scrollable tabs container
                 }}>
                     <Box sx={{ 
                         maxWidth: '100%', 
                         display: 'flex',
                         overflowX: 'auto',
                         scrollbarWidth: 'none', // Hide scrollbar for Firefox
                         '&::-webkit-scrollbar': {
                             display: 'none' // Hide scrollbar for Chrome/Safari
                         },
                         WebkitOverflowScrolling: 'touch', // Smooth scrolling for iOS
                     }}>
                         <Tabs 
                             value={activeTab} 
                             onChange={(_, newValue) => setActiveTab(newValue)}
                             aria-label="room content tabs"
                             variant="scrollable" // Enable scrolling
                             scrollButtons="auto" // Show scroll buttons when needed
                             allowScrollButtonsMobile // Enable scroll buttons on mobile
                             sx={{ 
                                 '& .MuiTab-root': {
                                     fontFamily: room?.style?.font || 'inherit',
                                     color: room?.style?.textColor || 'inherit',
                                     opacity: 0.7,
                                     minWidth: 'auto', // Allow tabs to be smaller on mobile
                                     padding: { xs: '6px 8px', sm: '12px 16px' }, // Smaller padding on mobile
                                     fontSize: { xs: '0.75rem', sm: '0.875rem' } // Smaller font on mobile
                                 },
                                 '& .Mui-selected': {
                                     color: `${room?.style?.accentColor || theme.palette.primary.main} !important`,
                                     opacity: 1
                                 },
                                 '& .MuiTabs-indicator': {
                                     backgroundColor: room?.style?.accentColor || theme.palette.primary.main
                                 },
                                 '& .MuiTabs-scrollButtons': {
                                     '&.Mui-disabled': { opacity: 0.3 },
                                     '&': {
                                         color: room?.style?.textColor || 'inherit',
                                     }
                                 }
                             }}
                         >
                             <Tab 
                                 label={`Participants (${gridParticipants.length})`} 
                                 value="participants" 
                                 sx={{ flexShrink: 0 }} // Prevent tab from shrinking
                             />
                             {shouldShowChatTab && (
                                 <Tab 
                                     label="Chat" 
                                     value="chat"
                                     sx={{ flexShrink: 0 }} // Prevent tab from shrinking
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
                             <Tab 
                                 label="Gifts" 
                                 value="gifts" 
                                 sx={{ flexShrink: 0 }} // Prevent tab from shrinking
                                 icon={<CardGiftcardIcon fontSize="small" />}
                                 iconPosition="end"
                             />
                             <Tab 
                                 label="Top Gifters" 
                                 value="topGifters"
                                 sx={{ flexShrink: 0 }} // Prevent tab from shrinking
                                 icon={<EmojiEventsIcon fontSize="small" />}
                                 iconPosition="end"
                             />
                         </Tabs>
                     </Box>
                 </Box>

                 {/* Participants Tab Content */}
                 {activeTab === 'participants' && (
                     <>
                {gridParticipants.length > 0 && <ParticipantsAudio participants={gridParticipants} />}

                <Grid container spacing={2} sx={{ willChange: 'contents', transform: 'translateZ(0)' }}>
                             {gridParticipants.map((p: StreamVideoParticipant) => {
                        const isCardParticipantTheHost = p.userId === room.ownerId; 
                        return (
                            <Grid item key={p.userId} xs={4} sm={3} md={2} sx={{ transition: 'none !important' }}>
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
                                    navigate={navigate}
                                    firestoreUserData={firestoreUserData}
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
                                             key={p.userId}
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
                
                {/* Gifts Tab Content */}
                {activeTab === 'gifts' && (
                    <Gifts 
                        roomId={room.id} 
                        roomOwnerId={room.ownerId} 
                        theme={theme} 
                        roomStyle={room?.style} 
                    />
                )}

                {/* Top Gifters Tab Content */}
                {activeTab === 'topGifters' && room && (
                    <TopGifters
                        roomId={room.id}
                        roomOwnerId={room.ownerId}
                        theme={theme}
                        roomStyle={room?.style}
                    />
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
                backgroundColor: room?.style?.headerColor || theme.palette.background.paper,
                gap: 2,
                flexWrap: 'wrap'
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
                                color: !localUserIsMute ? (room?.style?.accentColor || 'primary.main') : 'default'
                            }} 
                            disabled={!call} 
                        >
                            {localUserIsMute ? <MicOff /> : <Mic />}
                        </IconButton>
                    </Tooltip>
                )}

                {/* Camera controls for different user types */}
                {isRoomOwner ? (
                    <Tooltip title={isCameraEnabled ? "Turn Camera Off" : "Turn Camera On"}>
                        <IconButton
                            onClick={toggleCameraCallback}
                            color={isCameraEnabled ? "primary" : "default"}
                            sx={{
                                color: isCameraEnabled ? (room?.style?.accentColor || 'primary.main') : 'default'
                            }}
                            disabled={!call}
                        >
                            {isCameraEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
                        </IconButton>
                    </Tooltip>
                ) : (
                    /* Participants: Request camera permission button */
                    !isCameraEnabled ? (
                        <Button
                            variant={hasPendingCameraRequest ? "outlined" : "contained"}
                            color={hasPendingCameraRequest ? "warning" : "primary"}
                                    onClick={requestCameraPermission}
                                    disabled={hasPendingCameraRequest}
                            startIcon={<VideocamIcon />}
                                    sx={{
                                borderRadius: '20px',
                                textTransform: 'none',
                                fontFamily: room?.style?.font || 'inherit',
                                backgroundColor: hasPendingCameraRequest ? 'transparent' : (room?.style?.accentColor || 'primary.main'),
                                '&:hover': {
                                    backgroundColor: hasPendingCameraRequest ? 'rgba(255, 152, 0, 0.04)' : undefined
                                }
                            }}
                        >
                            {hasPendingCameraRequest ? "Request Pending..." : "Request Camera Permission"}
                        </Button>
                    ) : (
                        <Button
                            variant="outlined"
                            color="error"
                                onClick={() => {
                                    if (call) {
                                        call.camera.disable()
                                            .then(() => {
                                                toast.success("Camera disabled");
                                            })
                                            .catch(err => {
                                                console.error("Error disabling camera:", err);
                                            });
                                    }
                                }}
                            startIcon={<VideocamOffIcon />}
                                sx={{
                                borderRadius: '20px',
                                textTransform: 'none',
                                fontFamily: room?.style?.font || 'inherit'
                                }}
                                disabled={!call}
                            >
                            Turn Camera Off
                        </Button>
                    )
                )}

                {/* Share Video Link - Only visible to room owners */}
                {isRoomOwner && (
                    <Tooltip title="Share Video Link">
                        <IconButton 
                            onClick={() => handleOpenShareVideoDialog()} 
                            color="secondary" 
                            sx={{ 
                                color: room?.style?.accentColor || theme.palette.secondary.main
                            }} 
                        >
                            <LinkIcon />
                        </IconButton>
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
    onForceRemove: (targetUserId: string, targetUsername?: string, reason?: string) => void;
    onForceBan: Function;
    call: Call;
    localUserAuthData: AuthContextUser | null;
    localUserIsMute?: boolean;
    isDesignatedHost?: boolean; 
    onPinToggle: (userId: string) => void; 
    isPinned?: boolean; 
    roomStyle?: RoomStyle;
    navigate: Function; // Add this line
    firestoreUserData: {[key: string]: {username: string, avatar?: string}}; // Add this line
}

const StreamParticipantCard: React.FC<StreamParticipantCardProps> = React.memo(({ 
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
    roomStyle,
    navigate,
    firestoreUserData
}) => {
    const theme = useTheme();
    const { isSpeaking, publishedTracks } = participant;
    const { blockUser, currentUser } = useAuth();



    const isAudioTrackPublished = publishedTracks.includes('audio' as any);
    const showRemoteMuteIcon = isLocalParticipant 
        ? (localUserIsMute ?? true) 
        : (!isAudioTrackPublished && !isSpeaking); 

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
            
            // If the participant is the room owner, update the room's isLive status based on microphone state
            if (isRoomOwner && localUserAuthData?.uid) {
                // Fix the room ID parsing - remove any namespace prefixes
                const rawRoomId = call.cid;
                const roomId = rawRoomId.includes(':') ? rawRoomId.split(':').pop() : rawRoomId;
                
                if (!roomId) {
                    console.error('[StreamParticipantCard] Invalid room ID format:', rawRoomId);
                    return;
                }
                
                const db = getFirestore();
                const roomRef = doc(db, 'sideRooms', roomId);
                
                // Check if document exists first
                try {
                    const roomDoc = await getDoc(roomRef);
                    if (!roomDoc.exists()) {
                        console.error('[StreamParticipantCard] Room document does not exist:', roomId);
                        return;
                    }
                    
                    const newMuteState = !call.microphone.enabled;
                    
                    console.log(`[StreamParticipantCard] Room owner mic toggled, updating isLive to: ${!newMuteState}`);
                    await updateDoc(roomRef, {
                        isLive: !newMuteState, // If not muted (enabled), then it's live
                        lastActive: serverTimestamp()
                    });
                } catch (docError) {
                    console.error('[StreamParticipantCard] Error accessing room document:', docError);
                }
            }
        } catch (error) {
            console.error('[StreamParticipantCard] Error toggling local microphone:', error);
            toast.error("Failed to toggle microphone. See console.");
        }
    };





    const handlePinToggle = () => {
        handleMenuClose();
        onPinToggle(participant.userId);
    };

    let displayName: string;
    let avatarUrl: string | undefined;

    // PRIORITY 1: Use Firestore data if available
    const firestoreData = firestoreUserData[participant.userId];
    if (firestoreData) {
        displayName = firestoreData.username;
        avatarUrl = firestoreData.avatar || undefined;
        console.log(`[StreamParticipantCard] Using Firestore data for ${participant.userId}:`, { displayName, avatarUrl });
    } else if (isLocalParticipant && localUserAuthData) { 
        // PRIORITY 2: Use local user auth data for current user
        displayName = localUserAuthData.displayName || localUserAuthData.email || participant.userId; 
        avatarUrl = localUserAuthData.photoURL || participant.image || undefined; 
        console.log(`[StreamParticipantCard] Using local auth data for current user:`, { displayName, avatarUrl });
    } else {
        // PRIORITY 3: Fall back to Stream SDK data
        displayName = participant.name || participant.userId;
        avatarUrl = participant.image || undefined;
        console.log(`[StreamParticipantCard] Using Stream SDK fallback for ${participant.userId}:`, { displayName, avatarUrl });
    }

    console.log('[StreamParticipantCard] Rendering with props:', { participant, isRoomOwner, isLocalParticipant, localUserAuthData });
    console.log('[StreamParticipantCard] Determined values - displayName:', displayName, 'avatarUrl:', avatarUrl, 'isSpeaking:', isSpeaking, 'participantIsMuted:', showRemoteMuteIcon);
    if (isLocalParticipant) {
        console.log('[StreamParticipantCard - LOCAL Focus] localUserAuthData:', localUserAuthData, 'Stream participant.userId:', participant.userId);
    }

    // Add these state variables within the StreamParticipantCard component
    const [showReportDialog, setShowReportDialog] = useState(false);
    const [isLocallyBlocked, setIsLocallyBlocked] = useState(false);

    
    
    // Check if this user is already blocked on component mount
    useEffect(() => {
        if (currentUser?.blockedUsers && participant.userId && !isLocalParticipant && !isDesignatedHost) {
            const isBlocked = currentUser.blockedUsers.includes(participant.userId);
            setIsLocallyBlocked(isBlocked);
        }
    }, [currentUser?.blockedUsers, participant.userId, isLocalParticipant, isDesignatedHost]);
    
    // Apply local audio filtering for blocked users (non-room-owners only)
    useEffect(() => {
        if (!call || isLocalParticipant || isDesignatedHost) return;
        
        // Get the participant's audio track
        const audioTrack = participant.audioStream?.getAudioTracks()[0];
        if (audioTrack && isLocallyBlocked) {
            // Mute the audio track locally for blocked users
            audioTrack.enabled = false;
            console.log(`[StreamParticipantCard] Audio disabled for blocked user: ${participant.userId}`);
        } else if (audioTrack && !isLocallyBlocked) {
            // Ensure audio is enabled for non-blocked users
            audioTrack.enabled = true;
        }
    }, [isLocallyBlocked, participant.audioStream, call, isLocalParticipant, isDesignatedHost, participant.userId]);

    // Add this function to handle report submission
    const submitReport = async (reason: string) => {
        try {
            const reportData = {
                reportedUserId: participant.userId,
                reportedBy: currentUser?.uid,
                reason: reason,
                timestamp: serverTimestamp()
            };
            
            await addDoc(collection(getFirestore(), "reports"), reportData);
            toast.success(`Report submitted for ${participant.name || participant.userId}`);
            setShowReportDialog(false);
        } catch (error) {
            console.error("Error submitting report:", error);
            toast.error("Failed to submit report. Please try again.");
        }
    };

    // Add a function to handle avatar click
    const handleAvatarClick = () => {
        if (isLocalParticipant) {
            // If it's the local user, toggle microphone as before
            handleLocalMicToggle();
        } else {
            // If it's another user, navigate to their profile
            navigate(`/profile/${participant.userId}`);
        }
    };

    // Render either a clickable avatar or a link to profile based on if it's local user
    const renderAvatar = () => {
        // Show default avatar for blocked users (except room owner)
        const displayAvatarUrl = (isLocallyBlocked && !isDesignatedHost) ? null : avatarUrl;
        const displayAvatarText = (isLocallyBlocked && !isDesignatedHost) ? '?' : displayName;
        
        // Don't show speaking indicator for blocked users
        const shouldShowSpeaking = isSpeaking && !(isLocallyBlocked && !isDesignatedHost);
        
        const avatarContent = (
            <Avatar 
                src={displayAvatarUrl || undefined}
                alt={displayAvatarText}
                sx={{
                    width: 64,
                    height: 64, 
                    mb: 0.5,
                    border: shouldShowSpeaking ? `3px solid ${theme.palette.success.main}` : `2px solid ${alpha(theme.palette.divider, 0.5)}`,
                    boxShadow: shouldShowSpeaking ? `0 0 8px ${theme.palette.success.light}` : 'none',
                    transition: 'border 0.2s ease-in-out, boxShadow 0.2s ease-in-out',
                    cursor: 'pointer',
                    backgroundColor: (isLocallyBlocked && !isDesignatedHost) ? theme.palette.grey[400] : 'inherit',
                    opacity: (isLocallyBlocked && !isDesignatedHost) ? 0.6 : 1,
                }}
            >
                {(isLocallyBlocked && !isDesignatedHost) ? '?' : displayName?.[0]?.toUpperCase()}
            </Avatar>
        );

        return isLocalParticipant ? (
            <Box onClick={handleLocalMicToggle} sx={{ cursor: 'pointer' }}>
                {avatarContent}
            </Box>
        ) : (
            <Link to={`/profile/${participant.userId}`} style={{ textDecoration: 'none' }}>
                {avatarContent}
            </Link>
        );
    };

    return (
        <Box sx={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            textAlign: 'center',
        }}>
            {renderAvatar()}
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
                {(isLocallyBlocked && !isDesignatedHost) ? 'Blocked User' : displayName}
            </Typography>
            
            {/* Menu for room owners - gives control options */}
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
                        <MenuItem onClick={handlePinToggle} sx={{ fontSize: '0.8rem' }}>
                            <ListItemIcon sx={{minWidth: '30px'}}>
                                <PushPinIcon fontSize="small" color={isPinned ? "primary" : "inherit"} />
                            </ListItemIcon>
                            {isPinned ? 'Unpin from top' : 'Pin to top'}
                        </MenuItem>
                        <MenuItem 
                            onClick={() => {
                                handleMenuClose();
                                setShowReportDialog(true);
                            }} 
                            sx={{ color: 'warning.main', fontSize: '0.8rem' }}
                        >
                            <ListItemIcon sx={{minWidth: '30px'}}><ReportIcon fontSize="small" color="warning"/></ListItemIcon>
                            Report User
                        </MenuItem>
                        <MenuItem 
                            onClick={() => {
                                handleMenuClose();
                                if (blockUser && participant.userId) {
                                    blockUser(participant.userId);
                                    
                                    // Room owner blocking also kicks user from room
                                    if (onForceRemove) {
                                        onForceRemove(participant.userId, participant.name || participant.userId, 'blocked');
                                    }
                                    toast.success(`${participant.name || participant.userId} has been blocked and removed from the room`);
                                }
                            }} 
                            sx={{ color: 'error.main', fontSize: '0.8rem' }}
                        >
                            <ListItemIcon sx={{minWidth: '30px'}}><PersonRemoveIcon fontSize="small" color="error"/></ListItemIcon>
                            Block & Remove
                        </MenuItem>
                        <MenuItem onClick={() => {
                            handleMenuClose();
                            if (onForceBan) {
                                onForceBan(participant.userId, participant.name || participant.userId);
                            }
                        }} sx={{ color: 'error.main', fontSize: '0.8rem' }}>
                            <ListItemIcon sx={{minWidth: '30px'}}><Block fontSize="small" color="error"/></ListItemIcon>
                            Ban
                        </MenuItem>
                    </Menu>
                </Box>
            )}
            
            {/* Menu for participants/viewers - only shows report option */}
            {!isRoomOwner && !isLocalParticipant && (
                <Box sx={{ position: 'absolute', top: -5, right: -5, zIndex: 1 }}>
                    <Tooltip title="Options">
                        <IconButton 
                            onClick={handleMenuClick} 
                            size="small" 
                            sx={{ backgroundColor: alpha(theme.palette.background.default, 0.7), p: 0.2, borderRadius: '50%' }}
                        >
                            <MoreVertIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Menu
                        anchorEl={anchorEl}
                        open={menuOpen}
                        onClose={handleMenuClose}
                        MenuListProps={{ dense: true }}
                    >
                        <MenuItem 
                            onClick={() => {
                                handleMenuClose();
                                setShowReportDialog(true);
                            }} 
                            sx={{ color: 'warning.main', fontSize: '0.8rem' }}
                        >
                            <ListItemIcon sx={{minWidth: '30px'}}><ReportIcon fontSize="small" color="warning"/></ListItemIcon>
                            Report User
                        </MenuItem>
                        <MenuItem 
                            onClick={() => {
                                handleMenuClose();
                                if (blockUser && participant.userId) {
                                    if (isLocallyBlocked) {
                                        // Unblock user - this would need to be implemented in the blockUser function
                                        // For now, just toggle the local state
                                        setIsLocallyBlocked(false);
                                        toast.success(`${participant.name || participant.userId} has been unblocked.`);
                                    } else {
                                        // Check if trying to block the room owner
                                        if (isDesignatedHost) {
                                            // Blocking room owner kicks participant out
                                            blockUser(participant.userId);
                                            toast.error("You cannot block the room owner. You will be removed from the room.");
                                            
                                            // Leave the room after a short delay
                                            setTimeout(() => {
                                                if (call) {
                                                    call.leave()
                                                        .then(() => navigate('/side-rooms'))
                                                        .catch(err => {
                                                            console.error('Error leaving call:', err);
                                                            navigate('/side-rooms'); // Navigate anyway
                                                        });
                                                } else {
                                                    navigate('/side-rooms');
                                                }
                                            }, 2000);
                                        } else {
                                            blockUser(participant.userId);
                                            
                                            // For regular participants, apply local blocking effects
                                            setIsLocallyBlocked(true);
                                            toast.success(`${participant.name || participant.userId} has been blocked. You won't hear them or see their profile picture.`);
                                        }
                                    }
                                }
                            }} 
                            sx={{ color: 'error.main', fontSize: '0.8rem' }}
                        >
                            <ListItemIcon sx={{minWidth: '30px'}}><PersonRemoveIcon fontSize="small" color="error"/></ListItemIcon>
                            {isLocallyBlocked ? 'Unblock User' : (isDesignatedHost ? 'Block Owner (Leave Room)' : 'Block User')}
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

            {/* Report User Dialog */}
            <Dialog open={showReportDialog} onClose={() => setShowReportDialog(false)}>
                <DialogTitle>Report User</DialogTitle>
                <DialogContent>
                    <Typography variant="body1" gutterBottom>
                        Why are you reporting {participant.name || participant.userId}?
                    </Typography>
                    <List>
                        {[
                            'Spam or misleading content',
                            'Harassment or bullying',
                            'Hate speech or symbols',
                            'Violent or dangerous content',
                            'Inappropriate behavior',
                            'Impersonation',
                            'Other'
                        ].map((reason) => (
                            <ListItem 
                                key={reason} 
                                onClick={() => submitReport(reason)}
                                sx={{ borderRadius: 1, cursor: 'pointer', '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.1) } }}
                            >
                                <ListItemText primary={reason} />
                            </ListItem>
                        ))}
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowReportDialog(false)}>Cancel</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
});

// Add this useEffect right after the existing useEffects in InsideStreamCallContent, before the handlers
    
    // Screen sharing detection using Stream's built-in functionality

