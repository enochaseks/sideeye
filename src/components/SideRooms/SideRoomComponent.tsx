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
    CardContent
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
    VolumeUp as VolumeUpIcon, // Re-added VolumeUpIcon
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
    FavoriteBorder as FavoriteBorderIcon
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
    StreamVideoParticipant
} from '@stream-io/video-react-sdk'; // UPDATED Stream imports, ADD useCall
// import AudioDeviceSelector from '../AudioDeviceSelector'; // REMOVED for now, Stream handles devices
import { storage } from '../../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import TypingIndicator from '../TypingIndicator';
import { Helmet } from 'react-helmet-async';
import { debounce } from 'lodash';
import { io, Socket } from 'socket.io-client'; // Import socket.io-client


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

    // --- Socket.IO Connection useEffect --- (NEW)
    useEffect(() => {
        // Determine backend URL 
        const backendUrl = 'https://sideeye-backend-production.up.railway.app'; // MODIFIED: Hardcoded backend URL
        console.log(`[SideRoomComponent] Connecting Socket.IO to: ${backendUrl}`);

        // Establish connection
        const socketInstance = io(backendUrl, {
            // Add auth or other options if needed, e.g.:
            // auth: { token: authToken }, 
            // withCredentials: true, // If using cookies/sessions
            reconnectionAttempts: 5 // Example: Limit reconnection attempts
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
            console.error('[SideRoomComponent] Socket connection error:', error);
            toast.error("Chat/Invite connection failed. Trying to reconnect...");
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
        updateDoc(roomRef, { currentSharedVideoUrl: null, lastActive: serverTimestamp() })
             .catch(error => console.error("Error clearing video URL in Firestore:", error));
        // socket?.emit('share-video', { roomId, videoUrl: '', userId: currentUser?.uid });

        setCurrentVideoUrl(null); // Optimistically update UI
        toast.success("Shared video cleared.");
    };

    // --- Stream API Token Fetch & Client Initialization ---
    useEffect(() => {
        if (!currentUser?.uid || streamToken) return; // Don't fetch if no user or token already fetched

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
                
                const response = await fetch(apiUrl, { // Use the absolute apiUrl
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                         userId: currentUser.uid,
                         userName: currentUser.displayName || currentUser.email, // Keep this
                         userImage: currentUser.photoURL || undefined // Add userImage
                        }),
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to fetch Stream token');
                }
                const { token } = await response.json();
                if (!token) {
                    throw new Error('Stream token was not provided by backend.');
                }
                setStreamToken(token);
                console.log("[Stream] Token fetched successfully.");
            } catch (error: any) { // FIX: Add : any to error
                console.error('[Stream] Error fetching token:', error);
                toast.error(`Stream Token Error: ${error.message}`);
                setStreamToken(null); // Ensure it's null on error
            }
        };
        fetchStreamToken();
    }, [currentUser, streamToken]);

    useEffect(() => {
        if (!streamToken || !currentUser?.uid || !process.env.REACT_APP_STREAM_API_KEY || streamClientForProvider) return;

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
            console.error("[Stream] Error initializing StreamVideoClient:", error);
            toast.error("Failed to initialize Stream video client.");
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

            if (presenceClearTimeoutRef.current) {
                clearTimeout(presenceClearTimeoutRef.current);
                presenceClearTimeoutRef.current = null;
            }

            if (onlineUsersData.length > 0) {
                console.log('[Presence Listener - Others] Received presence snapshot (updating). Users:', onlineUsersData.length, onlineUsersData);
                setPresence(onlineUsersData);
            } else {
                console.log('[Presence Listener - Others] Received presence snapshot (empty). Users:', onlineUsersData.length);
                if (presence.length > 0) { // Check current state before scheduling clear
                    console.log('[Presence Listener - Others] Current presence not empty, scheduling clear.');
                    presenceClearTimeoutRef.current = setTimeout(() => {
                        console.log('[Presence Listener - Others] Timeout fired. Clearing presence.');
                        setPresence([]);
                    }, 150);
                } else {
                    console.log('[Presence Listener - Others] Current presence already empty, setting to empty.');
                    setPresence([]);
                }
            }
        }, (error) => {
            console.error('[Presence Listener - Others] CRITICAL: Snapshot error:', error);
            toast.error("Error listening to room presence updates. See console.");
            setPresence([]); // Clear presence on error to avoid stale data
        });

        return () => {
            console.log(`[Presence Listener - Others] Cleanup for room ${roomId}.`);
            unsubscribe();
            if (presenceClearTimeoutRef.current) {
                clearTimeout(presenceClearTimeoutRef.current);
            }
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

        socket.on('invite-success', handleInviteSuccess);
        socket.on('invite-failed', handleInviteFailed);
        socket.on('guest-joined', handleGuestJoined);
        socket.on('user-search-results-for-invite', handleUserSearchResults);

        return () => {
            socket.off('invite-success', handleInviteSuccess);
            socket.off('invite-failed', handleInviteFailed);
            socket.off('guest-joined', handleGuestJoined);
            socket.off('user-search-results-for-invite', handleUserSearchResults);
        };
    }, [socket, roomId]); // Depend on socket and roomId

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
                     <Tooltip title="Share Video Link">
                         <IconButton 
                             onClick={handleOpenShareVideoDialog}
                             // Only enable if connected OR if owner/guest wants to share before connecting?
                             // Let's allow owner/guest anytime for simplicity now.
                             disabled={!isRoomOwner && !isGuest}
                             size="small"
                             color="secondary"
                         >
                             <LinkIcon />
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
        if (!isRoomOwner || !roomId || targetUserId === currentUser?.uid) return;
        
        const name = targetUsername || 'this user';
        if (window.confirm(`Are you sure you want to remove ${name} from the room?`)) {
             console.log(`Owner removing user ${targetUserId} from room ${roomId}`);
             // audioService.sendForceRemove(roomId, targetUserId); // REMOVED
             // Use general socket emit:
             // socket?.emit('force-remove', { roomId, targetUserId });
             console.warn("[SideRoomComponent] handleForceRemove needs to be connected to the correct signaling (e.g., general Socket.IO emit)")
             toast.success(`Removing ${name}...`);
        }
    }, [isRoomOwner, roomId, currentUser?.uid]);

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

    // --- RE-ADD renderRoomContent function definition ---
    const renderRoomContent = () => (
        <Box sx={{ flexGrow: 1, p: 2, overflowY: 'auto' }}>
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
                height: '100vh',
                fontFamily: room?.style?.font || AVAILABLE_FONTS[0],
                // Corrected logic for backgroundGradient
                backgroundColor: room?.style?.backgroundGradient
                    ? `linear-gradient(to bottom right, ${room?.style?.backgroundColor || theme.palette.background.default}, ${room?.style?.accentColor || theme.palette.secondary.main})` // Gradient when true (Switch ON)
                    : room?.style?.backgroundColor || theme.palette.background.default, // Solid color when false (Switch OFF)
                color: room?.style?.textColor || theme.palette.text.primary,
            }}>
                 {/* Always render the main Room Header */}
                 {room && renderRoomHeader()}

                 {/* Main Content Area */}
                 <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                     {/* Loading/Error state BEFORE client/room is ready */}
                    {!streamClientForProvider || !room ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', p: 2 }}>
                            {loading && <CircularProgress />} 
                            {!loading && !room && <Alert severity="error">Room not found.</Alert>}
                            {!loading && room && !streamClientForProvider && <Typography>Initializing audio...</Typography>}
                         </Box>
                    ) : activeStreamCallInstance ? (
                         // Client/Room Ready AND Call is Active: Render Stream UI
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
                     ) : (
                         // Client/Room Ready, Call NOT Active: Render Firestore-based content
                         renderRoomContent() // Render the original Firestore view
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
                                <ListItem sx={{ justifyContent: 'center' }}>
                                    <CircularProgress size={20} />
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
    // Ensure prop names match where the component is called
    onForceMuteToggle: Function, 
    onForceRemove: Function, 
    onForceBan: Function, 
    theme: any
}> = ({ room, isRoomOwner, isGuest, handleOpenShareVideoDialog, handleClearSharedVideo, currentVideoUrl, renderVideoPlayer, onForceMuteToggle, onForceRemove, onForceBan, theme }) => {
    const call = useCall(); // Ensure useCall is used here
    // Define hooks ONCE here
    const { useParticipants, useMicrophoneState } = useCallStateHooks(); // Ensure these hooks are called
    const participants = useParticipants(); 
    const { isMute: localUserIsMute } = useMicrophoneState(); // Ensure localUserIsMute is defined here
    const client = useStreamVideoClient(); 
    const navigate = useNavigate(); 
    const { currentUser } = useAuth(); 

    // Define handleLeaveCall within this component's scope
    const handleLeaveCall = () => {
        call?.leave().then(() => navigate('/side-rooms'));
    }; 

    useEffect(() => {
        // Ensure db is in scope. If SideRoomComponent passes db down or imports it globally for the file, this is fine.
        // Otherwise, this useEffect would need to be in a component with db in scope, or db passed as a prop.
        if (call && currentUser?.uid && room?.id && typeof localUserIsMute === 'boolean' && db) { // Added db check
            const userPresenceRef = doc(db, 'sideRooms', room.id, 'presence', currentUser.uid);
            updateDoc(userPresenceRef, { isMuted: localUserIsMute })
                .then(() => {
                    console.log(`[InsideStreamCallContent] Synced local mute state (${localUserIsMute}) to Firestore for ${currentUser.uid}`);
                })
                .catch(error => {
                    console.error(`[InsideStreamCallContent] Error syncing local mute state to Firestore for ${currentUser.uid}:`, error);
                });
        }
    }, [localUserIsMute, call, currentUser?.uid, room?.id, db]); // Added db to dependencies


    if (!call || !client) {
        return (
             <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1, height: '100%' }}>
                <CircularProgress />
                 <Typography sx={{ ml: 1 }}>Loading call infrastructure...</Typography>
            </Box>
        );
    }

    const renderCallStatusHeader = () => ( 
        <Box sx={{ 
            p: 1, 
            borderBottom: 1, 
            borderColor: 'divider', 
            textAlign: 'center', 
            flexShrink: 0, 
            backgroundColor: alpha(theme.palette.background.paper, 0.95) 
        }}>
            <Typography variant="body2" fontWeight="medium">{room.name}</Typography>
            {/* Use localUserIsMute here */}
            <Typography variant="caption" color="text.secondary">(Mic: {localUserIsMute ? 'Muted' : 'On'})</Typography>
            </Box>
        );

    // Simple participant list for the grid
    const gridParticipants = participants;

        return (
        <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%', 
            width: '100%', 
            backgroundColor: theme.palette.background.default 
        }}>
            {renderCallStatusHeader()}
            
            <Box sx={{
                flexGrow: 1, 
                overflowY: 'auto', 
                p: 2, 
            }}>
                 {/* --- Video Player Section (Added) --- */}
                 {currentVideoUrl && (
                     <Box sx={{ mt: 1, mb: 3, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, backgroundColor: 'action.hover' }}>
                         <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                             <Typography variant="subtitle1" sx={{ textAlign: 'center', flexGrow: 1 }}>Shared Video</Typography>
                             {isRoomOwner && (
                                 <Tooltip title="Clear Shared Video">
                                     {/* Use the passed-in handler */}
                                     <IconButton onClick={() => handleClearSharedVideo()} size="small">
                                         <ClearIcon />
                                     </IconButton>
                                 </Tooltip>
                             )}
                         </Box>
                         <Box
                             sx={{
                                 position: 'relative',
                                 paddingBottom: '56.25%', // 16:9
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
                             {/* Use the passed-in render function */}
                             {renderVideoPlayer(currentVideoUrl)}
                         </Box>
                     </Box>
                 )}
                 {/* --- End Video Player Section --- */}

                 <Typography variant="overline" display="block" sx={{ color: 'text.secondary', mb: 1 }}>
                     Participants ({gridParticipants.length})
                </Typography>
                <Grid container spacing={2}>
                    {gridParticipants.map((p) => (
                        <Grid item key={p.sessionId} xs={4} sm={3} md={2}>
                            {/* Use the corrected Participant Card name */}
                            <StreamParticipantCard 
                                participant={p} 
                                isRoomOwner={isRoomOwner}
                                isLocalParticipant={p.userId === currentUser?.uid} 
                                localUserAuthData={currentUser} 
                                // Pass down moderation functions
                                onForceMuteToggle={onForceMuteToggle} 
                                onForceRemove={onForceRemove}
                                onForceBan={onForceBan}
                                call={call} // Pass call object
                                localUserIsMute={localUserIsMute} // Pass local mute state
                            />
                        </Grid>
                    ))}
                </Grid>
                
                {gridParticipants.length === 0 && (
                    <Typography sx={{width: '100%', textAlign: 'center', color: theme.palette.text.secondary, mt: 4}}>
                        Waiting for others to join...
                    </Typography>
                )}
            </Box>

            <Box sx={{ 
                flexShrink: 0, 
                p: 2, 
                borderTop: `1px solid ${theme.palette.divider}`,
                display: 'flex',
                justifyContent: 'center',
                backgroundColor: theme.palette.background.paper
            }}>
                 <Button
                    variant="outlined"
                    color="error" 
                    startIcon={<ExitToApp />}
                    onClick={handleLeaveCall} // Use defined handleLeaveCall
                    sx={{ borderRadius: '20px', textTransform: 'none' }} 
                >
                    Leave quietly
                </Button>

                <Tooltip title={localUserIsMute ? "Unmute Microphone" : "Mute Microphone"}>
                    <IconButton 
                        onClick={() => call?.microphone.toggle()} // Use call object
                        color={localUserIsMute ? "default" : "primary"} 
                        sx={{ ml: 2 }} // Add some margin
                        disabled={!call} // Disable if call object is somehow not available
                    >
                        {/* Use localUserIsMute */} 
                        {localUserIsMute ? <MicOff /> : <Mic />}
                    </IconButton>
                </Tooltip>

                 {/* Add Share Video Button (Added) */}
                 <Tooltip title="Share Video Link">
                     <span> {/* Span needed for Tooltip when button is disabled */} 
                     <IconButton 
                         onClick={() => handleOpenShareVideoDialog()} 
                         color={"secondary"} 
                         sx={{ ml: 2 }} 
                         disabled={!isRoomOwner && !isGuest} // Use passed-in props
                     >
                         <LinkIcon />
                     </IconButton>
                     </span>
                 </Tooltip>
            </Box>
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
    localUserIsMute 
}: {
    participant: StreamVideoParticipant; 
    isRoomOwner: boolean;
    isLocalParticipant: boolean;
    onForceMuteToggle: Function;
    onForceRemove: Function;
    onForceBan: Function;
    call: Call;
    localUserAuthData: AuthContextUser | null; 
    localUserIsMute?: boolean; 
}) => {
    const theme = useTheme(); 
    const isAudioPublished = participant.publishedTracks.includes('audio' as any);
    const participantIsMuted = !isAudioPublished; // Revert to simpler logic
    const { isSpeaking } = participant; 
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const menuOpen = Boolean(anchorEl);

    const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    // Moderation Handlers (ensure these are defined as they are used in JSX)
    const handleRemoteMuteToggle = async () => {
        handleMenuClose();
        if (onForceMuteToggle) {
            onForceMuteToggle(participant.userId, participantIsMuted);
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

    // Determine display name and avatar URL
    let displayName: string;
    let avatarUrl: string | undefined;

    // Define an interface for the expected shape of participant.custom
    interface StreamCustomParticipantData {
        displayName?: string;
        customAvatarUrl?: string;
    }

    // Assert the type of participant.custom
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

    // Console logs immediately before the return statement
    console.log('[StreamParticipantCard] Rendering with props:', { participant, isRoomOwner, isLocalParticipant, localUserAuthData });
    console.log('[StreamParticipantCard] Determined values - displayName:', displayName, 'avatarUrl:', avatarUrl, 'isSpeaking:', isSpeaking, 'participantIsMuted:', participantIsMuted);
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
                onClick={() => {
                    if (isLocalParticipant && call) {
                        call.microphone.toggle();
                        // The useEffect in InsideStreamCallContent will handle Firestore update
                    }
                }}
                sx={{
                    width: 64,
                    height: 64, 
                    mb: 0.5,
                    border: isSpeaking ? `3px solid ${theme.palette.success.main}` : `2px solid ${alpha(theme.palette.divider, 0.5)}`,
                    boxShadow: isSpeaking ? `0 0 8px ${theme.palette.success.light}` : 'none',
                    transition: 'border 0.2s ease-in-out, boxShadow 0.2s ease-in-out',
                    cursor: isLocalParticipant ? 'pointer' : 'default', // Add cursor pointer for local user
                }}
            />
            {/* Mute Icon Display Logic */}
            {(isLocalParticipant ? localUserIsMute : participantIsMuted) && (
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
                 <Mic // Or some other indicator if preferred
                     sx={{
                         fontSize: '1rem',
                         color: theme.palette.success.contrastText, // Example color
                         backgroundColor: alpha(theme.palette.success.main, 0.8), // Example color
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
                            <ListItemIcon sx={{minWidth: '30px'}}>{participantIsMuted ? <VolumeUpIcon fontSize="small"/> : <VolumeOffIcon fontSize="small"/>}</ListItemIcon>
                            {participantIsMuted ? 'Unmute' : 'Mute'}
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
        </Box>
    );
};
