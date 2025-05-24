import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
  Divider,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
  Alert,
  Badge,
  LinearProgress,
  Popover,
  Chip,
  Tooltip
} from '@mui/material';
import OnlineIndicator from '../components/OnlineIndicator';
import { usePresence } from '../hooks/usePresence';
import {
  MoreVert as MoreVertIcon,
  Send as SendIcon,
  PersonAdd as InviteIcon,
  Delete as DeleteIcon,
  Report as ReportIcon,
  ExitToApp as LeaveIcon,
  ArrowBack as BackIcon,
  PersonAddAlt as AddMemberIcon,
  Poll as PollIcon,
  Announcement as AnnouncementIcon,
  Chat as ChatIcon,
  DeleteOutline as DeleteOutlineIcon,
  InsertEmoticon as EmojiIcon,
  AttachFile as AttachFileIcon,
  Edit as EditIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  PersonAdd as PersonAddIcon,
  Block as BlockIcon,
  Add as AddIcon,
  Check as CheckIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { 
  doc, 
  getDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  serverTimestamp,
  updateDoc,
  deleteDoc,
  getDocs,
  Timestamp,
  setDoc,
  startAt,
  endAt
} from 'firebase/firestore';
import { db, storage } from '../services/firebase';
import { toast } from 'react-hot-toast';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useTheme, useMediaQuery } from '@mui/material';
import styled from '@emotion/styled';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`room-tabpanel-${index}`}
      aria-labelledby={`room-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

interface Message {
  id: string;
  text: string;
  sender: string;
  senderName: string;
  senderPhoto?: string;
  timestamp: Timestamp;
  type: 'chat' | 'announcement' | 'poll';
  pollOptions?: string[];
  pollVotes?: Record<string, string[]>;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  reactions?: Reaction[];
}

interface Reaction {
  emoji: string;
  userId: string;
  username?: string;
}

interface Room {
  id: string;
  name: string;
  description: string;
  rules?: string[];
  createdBy: string;
  createdAt: Timestamp;
  members: string[];
  type: 'public' | 'private';
  locked?: boolean;
  pendingRequests?: string[];
}

interface PollOption {
  text: string;
}

// Add styled component for hidden file input
const HiddenFileInput = styled('input')({
  display: 'none',
});

const RoomChat: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { currentUser } = useAuth();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const { isUserOnline } = usePresence();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [message, setMessage] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [announcements, setAnnouncements] = useState<Message[]>([]);
  const [polls, setPolls] = useState<Message[]>([]);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPollDialog, setShowPollDialog] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<PollOption[]>([
    { text: '' },
    { text: '' }
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info'>('success');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentUserData, setCurrentUserData] = useState<{username?: string; name?: string; profilePic?: string}>({});
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showDeleteMessageDialog, setShowDeleteMessageDialog] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Message | null>(null);
  const [announcementMenuAnchorEl, setAnnouncementMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [showEditAnnouncementDialog, setShowEditAnnouncementDialog] = useState(false);
  const [showDeleteAnnouncementDialog, setShowDeleteAnnouncementDialog] = useState(false);
  const [editedAnnouncementText, setEditedAnnouncementText] = useState('');
  const [pollMenuAnchorEl, setPollMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedPoll, setSelectedPoll] = useState<Message | null>(null);
  const [showDeletePollDialog, setShowDeletePollDialog] = useState(false);
  const [showPendingRequestsDialog, setShowPendingRequestsDialog] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<Array<{id: string, username: string, profilePic?: string}>>([]);
  
  // Add new state for members management
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [roomMembers, setRoomMembers] = useState<Array<{id: string, username: string, name?: string, profilePic?: string}>>([]);
  const [memberMenuAnchorEl, setMemberMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedMember, setSelectedMember] = useState<{id: string, username: string} | null>(null);
  
  // Add new state for user profiles and blocked users
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<{id: string, username: string, name?: string, profilePic?: string} | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [showBlockedUserAlert, setShowBlockedUserAlert] = useState(false);
  const [blockedUserInRoom, setBlockedUserInRoom] = useState<{id: string, username: string} | null>(null);
  
  // Add new state for rules management
  const [roomRules, setRoomRules] = useState<string[]>([]);
  const [showAddRuleDialog, setShowAddRuleDialog] = useState(false);
  const [newRule, setNewRule] = useState('');
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [editingRuleText, setEditingRuleText] = useState('');
  const [showDeleteRuleDialog, setShowDeleteRuleDialog] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<number | null>(null);
  
  // Common emojis for the scrollbar/picker
  const commonEmojis = [
    '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊', 
    '😋', '😎', '😍', '🥰', '😘', '😗', '😙', '😚', '🙂', '🤗',
    '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮',
    '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '👊', '👋', '🙌',
    '❤️', '💔', '💖', '💙', '😢', '😭', '😤', '😠', '😡', '🤬'
  ];
  
  // New state for emoji reactions
  const [reactionPopover, setReactionPopover] = useState<{
    anchorEl: HTMLElement | null;
    message: Message | null;
  }>({ anchorEl: null, message: null });
  
  const [reactionDetailsPopover, setReactionDetailsPopover] = useState<{
    anchorEl: HTMLElement | null;
    message: Message | null;
    emoji: string | null;
  }>({ anchorEl: null, message: null, emoji: null });
  
  // Available reactions
  const availableReactions = [
    { emoji: '👍', label: 'Like' },
    { emoji: '❤️', label: 'Love' },
    { emoji: '😀', label: 'Happy' },
    { emoji: '😔', label: 'Sad' },
    { emoji: '👀', label: 'Eyes' },
    { emoji: '🔥', label: 'Fire' },
    { emoji: '🎉', label: 'Celebration' },
    { emoji: '🤔', label: 'Thinking' }
  ];
  
  // Theme and media query for responsive design
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, announcements]);

  useEffect(() => {
    if (!roomId || !currentUser) {
      navigate('/messages');
      return;
    }

    const fetchRoom = async () => {
      try {
        const roomRef = doc(db, 'rooms', roomId);
        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) {
          toast.error('Room not found');
          navigate('/messages');
          return;
        }

        const roomData = {
          id: roomSnap.id,
          ...roomSnap.data()
        } as Room;

        setRoom(roomData);
        setIsOwner(roomData.createdBy === currentUser.uid);
        
        // Load room rules
        setRoomRules(roomData.rules || []);

        // Check if user is a member
        if (!roomData.members.includes(currentUser.uid)) {
          // If room is locked and user is not owner, handle join request
          if (roomData.locked && roomData.createdBy !== currentUser.uid) {
            // Check if user already has a pending request
            const alreadyPending = roomData.pendingRequests && roomData.pendingRequests.includes(currentUser.uid);
            
            if (alreadyPending) {
              toast.success('Your request to join this room is pending approval');
            } else {
              // Add user to pending requests
              const pendingRequests = roomData.pendingRequests || [];
              await updateDoc(roomRef, {
                pendingRequests: [...pendingRequests, currentUser.uid]
              });
              
              // Create notification for room owner
              const notificationRef = collection(db, 'notifications');
              await addDoc(notificationRef, {
                type: 'room_join_request',
                senderId: currentUser.uid,
                senderName: currentUser.displayName || 'User',
                senderAvatar: currentUser.photoURL || '',
                recipientId: roomData.createdBy,
                content: `${currentUser.displayName || 'A user'} wants to join your room "${roomData.name}"`,
                roomId: roomId,
                roomName: roomData.name,
                isRead: false,
                createdAt: serverTimestamp()
              });
              
              toast.success('Your request to join this room has been sent to the owner');
            }
            
            // Navigate back to messages since user can't join yet
            navigate('/messages');
            return;
          }
          
          // If room is not locked or user is owner, add to members
          await updateDoc(roomRef, {
            members: [...roomData.members, currentUser.uid]
          });
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching room:', error);
        toast.error('Failed to load room');
        navigate('/messages');
      }
    };

    fetchRoom();

    // Listen for messages
    const messagesRef = collection(db, 'rooms', roomId, 'messages');
    
    // General chat messages
    const chatQuery = query(
      messagesRef,
      where('type', '==', 'chat'),
      orderBy('timestamp', 'asc'),
      limit(100)
    );
    
    const chatUnsubscribe = onSnapshot(chatQuery, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setChatMessages(messages);
    });

    // Announcements
    const announcementsQuery = query(
      messagesRef,
      where('type', '==', 'announcement'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    
    const announcementsUnsubscribe = onSnapshot(announcementsQuery, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setAnnouncements(messages);
    });

    // Polls
    const pollsQuery = query(
      messagesRef,
      where('type', '==', 'poll'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    
    const pollsUnsubscribe = onSnapshot(pollsQuery, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setPolls(messages);
    });

    return () => {
      chatUnsubscribe();
      announcementsUnsubscribe();
      pollsUnsubscribe();
    };
  }, [roomId, currentUser, navigate, db]);

  useEffect(() => {
    if (!currentUser) return;
    
    // Fetch current user's profile data from Firestore
    const fetchUserData = async () => {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setCurrentUserData({
            username: userData.username,
            name: userData.name,
            profilePic: userData.profilePic || userData.photoURL
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };
    
    fetchUserData();
  }, [currentUser, db]);

  const sendMessage = async () => {
    if (!message.trim() && !isUploading) return;
    
    try {
      // If there's a file, upload it first
      if (isUploading) {
        await handleFileUpload();
        return;
      }
      
      await addDoc(collection(db, 'rooms', roomId!, 'messages'), {
        text: message.trim(),
        sender: currentUser?.uid,
        senderName: currentUserData.name || currentUserData.username || currentUser?.displayName || 'Anonymous',
        senderPhoto: currentUserData.profilePic || currentUser?.photoURL || null,
        timestamp: serverTimestamp(),
        type: 'chat',
        reactions: []  // Initialize empty reactions array
      });
      
      setMessage('');
      scrollToBottom();
      
    } catch (error) {
      console.error('Error sending message:', error);
      setSnackbarMessage('Failed to send message');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const sendAnnouncement = async () => {
    if (!announcement.trim() || !currentUser || !isOwner) return;

    try {
      const messagesRef = collection(db, 'rooms', roomId!, 'messages');
      await addDoc(messagesRef, {
        text: announcement.trim(),
        sender: currentUser.uid,
        senderName: currentUserData.name || currentUserData.username || currentUser.displayName || 'User',
        senderPhoto: currentUserData.profilePic || currentUser.photoURL || '',
        timestamp: serverTimestamp(),
        type: 'announcement',
        reactions: [] // Initialize empty reactions array
      });

      // Notify all room members about the new announcement
      await notifyRoomMembers(
        'room_announcement', 
        `📢 New announcement in "${room?.name}": ${announcement.trim().substring(0, 100)}${announcement.trim().length > 100 ? '...' : ''}`,
        { postId: null } // No specific post ID for announcements
      );

      setAnnouncement('');
      setSnackbarMessage('Announcement posted');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error posting announcement:', error);
      toast.error('Failed to post announcement');
    }
  };

  const createPoll = async () => {
    if (!pollQuestion.trim() || !currentUser || !isOwner) return;
    
    // Filter out empty options
    const validOptions = pollOptions.map(option => option.text.trim()).filter(Boolean);
    
    if (validOptions.length < 2) {
      setSnackbarMessage('A poll needs at least 2 options');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    try {
      const messagesRef = collection(db, 'rooms', roomId!, 'messages');
      await addDoc(messagesRef, {
        text: pollQuestion.trim(),
        sender: currentUser.uid,
        senderName: currentUserData.name || currentUserData.username || currentUser.displayName || 'User',
        senderPhoto: currentUserData.profilePic || currentUser.photoURL || '',
        timestamp: serverTimestamp(),
        type: 'poll',
        pollOptions: validOptions,
        pollVotes: {}
      });

      // Notify all room members about the new poll
      await notifyRoomMembers(
        'room_poll', 
        `📊 New poll in "${room?.name}": ${pollQuestion.trim().substring(0, 80)}${pollQuestion.trim().length > 80 ? '...' : ''}`,
        { postId: null } // No specific post ID for polls
      );

      setPollQuestion('');
      setPollOptions([{ text: '' }, { text: '' }]);
      setShowPollDialog(false);
      setSnackbarMessage('Poll created');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error creating poll:', error);
      toast.error('Failed to create poll');
    }
  };

  const handleAddPollOption = () => {
    setPollOptions([...pollOptions, { text: '' }]);
  };

  const handlePollOptionChange = (index: number, value: string) => {
    const newOptions = [...pollOptions];
    newOptions[index].text = value;
    setPollOptions(newOptions);
  };

  const handleVotePoll = async (pollId: string, optionIndex: number) => {
    if (!currentUser) return;
    
    try {
      const pollRef = doc(db, 'rooms', roomId!, 'messages', pollId);
      const pollSnap = await getDoc(pollRef);
      
      if (!pollSnap.exists()) return;
      
      const pollData = pollSnap.data();
      const votes = pollData.pollVotes || {};
      
      // Remove previous vote if exists
      Object.keys(votes).forEach(option => {
        if (votes[option]?.includes(currentUser.uid)) {
          votes[option] = votes[option].filter((id: string) => id !== currentUser.uid);
        }
      });
      
      // Add new vote
      const optionKey = optionIndex.toString();
      if (!votes[optionKey]) {
        votes[optionKey] = [];
      }
      votes[optionKey] = [...votes[optionKey], currentUser.uid];
      
      await updateDoc(pollRef, { pollVotes: votes });
    } catch (error) {
      console.error('Error voting on poll:', error);
      toast.error('Failed to submit vote');
    }
  };

  const handleSearchUsers = async () => {
    if (!searchQuery.trim()) return;

    try {
      setSearchResults([]); // Clear previous results
      const lowerQuery = searchQuery.trim().toLowerCase();
      const usersRef = collection(db, 'users');
      
      // Initialize array for search results
      let results: any[] = [];
      
      // 1. Try searching by username_lower if it exists
      try {
        const usernameQuery = query(
          usersRef,
          orderBy('username_lower'),
          startAt(lowerQuery),
          endAt(lowerQuery + '\uf8ff'),
          limit(20)
        );
        
        const usernameSnapshot = await getDocs(usernameQuery);
        results = usernameSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log(`Found ${results.length} users by username_lower`);
      } catch (error) {
        console.error('Error searching by username_lower:', error);
        // Continue with next search strategy if this fails
      }
      
      // 2. Try searching by name_lower if not enough results
      if (results.length < 10) {
        try {
          const nameQuery = query(
            usersRef,
            orderBy('name_lower'),
            startAt(lowerQuery),
            endAt(lowerQuery + '\uf8ff'),
            limit(20)
          );
          
          const nameSnapshot = await getDocs(nameQuery);
          const nameResults = nameSnapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            }))
            .filter(user => !results.some(existingUser => existingUser.id === user.id));
          
          results = [...results, ...nameResults];
          console.log(`Added ${nameResults.length} users by name_lower, total: ${results.length}`);
        } catch (error) {
          console.error('Error searching by name_lower:', error);
          // Continue with next search strategy if this fails
        }
      }
      
      // 3. Fallback to standard username and name fields if the above methods fail
      if (results.length === 0) {
        try {
          const usernameStandardQuery = query(
            usersRef, 
            where('username', '>=', lowerQuery), 
            where('username', '<=', lowerQuery + '\uf8ff'),
            limit(20)
          );
          
          const nameStandardQuery = query(
            usersRef,
            where('name', '>=', lowerQuery),
            where('name', '<=', lowerQuery + '\uf8ff'),
            limit(20)
          );
          
          const [usernameSnapshot, nameSnapshot] = await Promise.all([
            getDocs(usernameStandardQuery),
            getDocs(nameStandardQuery)
          ]);
          
          // Use a map to avoid duplicates
          const userMap = new Map();
          
          usernameSnapshot.docs.forEach(doc => {
            userMap.set(doc.id, { id: doc.id, ...doc.data() });
          });
          
          nameSnapshot.docs.forEach(doc => {
            userMap.set(doc.id, { id: doc.id, ...doc.data() });
          });
          
          results = Array.from(userMap.values());
          console.log(`Found ${results.length} users using standard fields`);
        } catch (error) {
          console.error('Error with fallback search:', error);
        }
      }
      
      // 4. Last resort: get some users and filter client-side
      if (results.length === 0) {
        try {
          console.log('Using last resort search method');
          const allUsersQuery = query(usersRef, limit(50));
          const snapshot = await getDocs(allUsersQuery);
          
          results = snapshot.docs
            .map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                username: data.username as string,
                name: data.name as string,
                profilePic: data.profilePic as string | undefined,
                ...data
              };
            })
            .filter(user => 
              (user.username && user.username.toLowerCase().includes(lowerQuery)) || 
              (user.name && user.name.toLowerCase().includes(lowerQuery))
            );
          
          console.log(`Found ${results.length} users with client-side filtering`);
        } catch (error) {
          console.error('Error with last resort search:', error);
        }
      }
      
      // Filter out current user and existing members
      const filteredResults = results.filter(user => 
        user.id !== currentUser?.uid && 
        !room?.members.includes(user.id)
      );
      
      console.log(`Returning ${filteredResults.length} users after filtering`);
      setSearchResults(filteredResults);
      
      if (filteredResults.length === 0) {
        // Show feedback but don't use error toast
        setSnackbarMessage('No matching users found');
        setSnackbarSeverity('info');
        setSnackbarOpen(true);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setSnackbarMessage('Failed to search users');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const inviteMember = async (userId: string) => {
    if (!room || !currentUser) return;
    
    try {
      // Update room members
      const roomRef = doc(db, 'rooms', roomId!);
      await updateDoc(roomRef, {
        members: [...room.members, userId]
      });
      
      // Create notification for the invited user
      const notificationRef = collection(db, 'notifications');
      await addDoc(notificationRef, {
        type: 'room_invite',
        from: currentUser.uid,
        to: userId,
        roomId: roomId,
        roomName: room.name,
        read: false,
        timestamp: serverTimestamp()
      });
      
      setSearchResults(prev => prev.filter(user => user.id !== userId));
      setSnackbarMessage('User invited to room');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error inviting user:', error);
      toast.error('Failed to invite user');
    }
  };

  const leaveRoom = async () => {
    if (!room || !currentUser) return;
    
    try {
      const roomRef = doc(db, 'rooms', roomId!);
      await updateDoc(roomRef, {
        members: room.members.filter(id => id !== currentUser.uid)
      });
      
      navigate('/messages');
      toast.success('You left the room');
    } catch (error) {
      console.error('Error leaving room:', error);
      toast.error('Failed to leave room');
    }
  };

  const deleteRoom = async () => {
    if (!isOwner || !roomId) return;
    
    try {
      setLoading(true);
      
      // Delete all messages in the room
      const messagesRef = collection(db, 'rooms', roomId, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);
      
      const deletePromises = messagesSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Delete the room document
      await deleteDoc(doc(db, 'rooms', roomId));
      
      navigate('/messages');
      toast.success('Room deleted');
    } catch (error) {
      console.error('Error deleting room:', error);
      toast.error('Failed to delete room');
      setLoading(false);
    }
  };

  const reportRoom = () => {
    // Implement report functionality
    setSnackbarMessage('Room reported to moderators');
    setSnackbarSeverity('info');
    setSnackbarOpen(true);
    handleMenuClose();
  };

  const formatTimestamp = (timestamp: Timestamp) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate();
    return date.toLocaleString();
  };

  const handleMessageMouseDown = (msg: Message) => {
    // Only allow deleting own messages
    if (msg.sender !== currentUser?.uid) return;
    
    // Start a timer for long press
    const timer = setTimeout(() => {
      setSelectedMessage(msg);
      setShowDeleteMessageDialog(true);
    }, 500); // 500ms for long press
    
    setLongPressTimer(timer);
  };
  
  const handleMessageMouseUp = () => {
    // Clear the timer if mouse is released before long press is triggered
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };
  
  const handleMessageTouchStart = (msg: Message) => {
    // Only allow deleting own messages
    if (msg.sender !== currentUser?.uid) return;
    
    // Start a timer for long press
    const timer = setTimeout(() => {
      setSelectedMessage(msg);
      setShowDeleteMessageDialog(true);
    }, 500); // 500ms for long press
    
    setLongPressTimer(timer);
  };
  
  const handleMessageTouchEnd = () => {
    // Clear the timer if touch is released before long press is triggered
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const deleteMessage = async () => {
    if (!selectedMessage || !currentUser || selectedMessage.sender !== currentUser.uid) {
      setShowDeleteMessageDialog(false);
      setSelectedMessage(null);
      return;
    }
    
    try {
      // Delete the message from Firestore
      const messageRef = doc(db, 'rooms', roomId!, 'messages', selectedMessage.id);
      await deleteDoc(messageRef);
      
      setSnackbarMessage('Message deleted');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error deleting message:', error);
      setSnackbarMessage('Failed to delete message');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setShowDeleteMessageDialog(false);
      setSelectedMessage(null);
    }
  };

  // Add a function to handle file uploads
  const handleFileUpload = async (event?: React.ChangeEvent<HTMLInputElement>) => {
    // If called from sendMessage (no event), use the stored file reference
    const file = event ? event.target.files?.[0] : fileInputRef.current?.files?.[0];
    if (!file || !currentUser || !roomId) return;
    
    // Check file size (limit to 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('File too large. Maximum size is 10MB.');
      return;
    }
    
    // Verify file type
    const fileType = file.type.split('/')[0];
    if (fileType !== 'image' && fileType !== 'video') {
      toast.error('Only image and video files are supported.');
      return;
    }
    
    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      // Create a reference to the file in Firebase Storage
      const storageRef = ref(storage, `chat-media/rooms/${roomId}/${Date.now()}_${file.name}`);
      
      // Upload the file
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      // Track upload progress
      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Error uploading file:', error);
          toast.error('Upload failed: ' + error.message);
          setIsUploading(false);
          setUploadProgress(null);
        },
        async () => {
          // Upload completed successfully, get download URL
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            // Send the media message
            await sendMediaMessage(downloadURL, fileType as 'image' | 'video');
            
            setIsUploading(false);
            setUploadProgress(null);
          } catch (urlError) {
            console.error('Error getting download URL:', urlError);
            toast.error('Failed to process uploaded file');
            setIsUploading(false);
            setUploadProgress(null);
          }
        }
      );
    } catch (error) {
      console.error('Error handling file upload:', error);
      toast.error('Failed to upload file');
      setIsUploading(false);
      setUploadProgress(null);
    }
    
    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendMediaMessage = async (mediaUrl: string, mediaType: 'image' | 'video') => {
    if (!currentUser) return;

    try {
      const messagesRef = collection(db, 'rooms', roomId!, 'messages');
      const messagePreview = mediaType === 'image' ? 'Sent an image' : 'Sent a video';
      
      await addDoc(messagesRef, {
        text: messagePreview,
        sender: currentUser.uid,
        senderName: currentUserData.name || currentUserData.username || currentUser.displayName || 'User',
        senderPhoto: currentUserData.profilePic || currentUser.photoURL || '',
        timestamp: serverTimestamp(),
        type: 'chat',
        mediaUrl,
        mediaType
      });

      scrollToBottom();
    } catch (error) {
      console.error('Error sending media message:', error);
      toast.error('Failed to send media');
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };
  
  // Toggle emoji picker
  const toggleEmojiPicker = () => {
    setShowEmojiPicker(!showEmojiPicker);
  };
  
  // Add emoji to message
  const addEmojiToMessage = (emoji: string) => {
    setMessage(prev => prev + emoji);
  };

  const handleAnnouncementMenuOpen = (event: React.MouseEvent<HTMLButtonElement>, announcement: Message) => {
    event.stopPropagation();
    setAnnouncementMenuAnchorEl(event.currentTarget);
    setSelectedAnnouncement(announcement);
  };

  const handleAnnouncementMenuClose = () => {
    setAnnouncementMenuAnchorEl(null);
  };

  const handleEditAnnouncementOpen = () => {
    if (selectedAnnouncement) {
      setEditedAnnouncementText(selectedAnnouncement.text);
      setShowEditAnnouncementDialog(true);
    }
    handleAnnouncementMenuClose();
  };

  const handleDeleteAnnouncementOpen = () => {
    setShowDeleteAnnouncementDialog(true);
    handleAnnouncementMenuClose();
  };

  

  const handleEditAnnouncement = async () => {
    if (!selectedAnnouncement || !currentUser || !isOwner || !editedAnnouncementText.trim()) return;

    try {
      const announcementRef = doc(db, 'rooms', roomId!, 'messages', selectedAnnouncement.id);
      await updateDoc(announcementRef, {
        text: editedAnnouncementText.trim()
      });

      setSnackbarMessage('Announcement updated');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setShowEditAnnouncementDialog(false);
    } catch (error) {
      console.error('Error updating announcement:', error);
      setSnackbarMessage('Failed to update announcement');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleDeleteAnnouncement = async () => {
    if (!selectedAnnouncement || !currentUser || !isOwner) return;

    try {
      const announcementRef = doc(db, 'rooms', roomId!, 'messages', selectedAnnouncement.id);
      await deleteDoc(announcementRef);

      setSnackbarMessage('Announcement deleted');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setShowDeleteAnnouncementDialog(false);
      setSelectedAnnouncement(null);
    } catch (error) {
      console.error('Error deleting announcement:', error);
      setSnackbarMessage('Failed to delete announcement');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handlePollMenuOpen = (event: React.MouseEvent<HTMLButtonElement>, poll: Message) => {
    event.stopPropagation();
    setPollMenuAnchorEl(event.currentTarget);
    setSelectedPoll(poll);
  };

  const handlePollMenuClose = () => {
    setPollMenuAnchorEl(null);
  };

  const handleDeletePollOpen = () => {
    setShowDeletePollDialog(true);
    handlePollMenuClose();
  };

const handleDeletePoll = async () => {
  if (!selectedPoll || !currentUser || !isOwner) return;

  try {
    const pollRef = doc(db, 'rooms', roomId!, 'messages', selectedPoll.id);
    await deleteDoc(pollRef);

    setSnackbarMessage('Poll deleted');
    setSnackbarSeverity('success');
    setSnackbarOpen(true);
    setShowDeletePollDialog(false);
    setSelectedPoll(null);
  } catch (error) {
    console.error('Error deleting poll:', error);
    setSnackbarMessage('Failed to delete poll');
    setSnackbarSeverity('error');
    setSnackbarOpen(true);
  }
};

  // Add the reaction handlers
  const handleOpenReactions = (event: React.MouseEvent<HTMLElement>, message: Message) => {
    setReactionPopover({
      anchorEl: event.currentTarget,
      message: message
    });
  };
  
  const handleCloseReactions = () => {
    setReactionPopover({
      anchorEl: null,
      message: null
    });
  };
  
  const handleOpenReactionDetails = (event: React.MouseEvent<HTMLElement>, message: Message, emoji: string) => {
    event.stopPropagation();
    
    setReactionDetailsPopover({
      anchorEl: event.currentTarget,
      message,
      emoji
    });
  };
  
  const handleCloseReactionDetails = () => {
    setReactionDetailsPopover({
      anchorEl: null,
      message: null,
      emoji: null
    });
  };
  
  const removeReaction = async (messageId: string, emoji: string) => {
    if (!currentUser?.uid || !roomId) {
      return;
    }
    
    try {
      const messageRef = doc(db, 'rooms', roomId, 'messages', messageId);
      
      // Get the message to access its reactions
      const messageDoc = await getDoc(messageRef);
      if (!messageDoc.exists()) {
        setSnackbarMessage('Message not found');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        return;
      }
      
      const messageData = messageDoc.data();
      const existingReactions = messageData.reactions || [];
      
      // Filter out the user's reaction with this emoji
      const updatedReactions = existingReactions.filter(
        (r: Reaction) => !(r.userId === currentUser.uid && r.emoji === emoji)
      );
      
      // Update Firestore
      await updateDoc(messageRef, {
        reactions: updatedReactions
      });
      
      // Update local state (chatMessages or announcements based on message type)
      if (messageData.type === 'chat') {
        setChatMessages(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, reactions: updatedReactions } : msg
        ));
      } else if (messageData.type === 'announcement') {
        setAnnouncements(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, reactions: updatedReactions } : msg
        ));
      }
      
      // Close the details popover
      handleCloseReactionDetails();
      
    } catch (error) {
      console.error('Error removing reaction:', error);
      setSnackbarMessage('Failed to remove reaction');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };
  
  const addReaction = async (emoji: string) => {
    if (!reactionPopover.message || !currentUser?.uid || !roomId) {
      return;
    }
    
    try {
      const messageId = reactionPopover.message.id;
      const messageRef = doc(db, 'rooms', roomId, 'messages', messageId);
      
      // Get existing reactions or initialize empty array
      const existingReactions = reactionPopover.message.reactions || [];
      
      // Check if user already reacted with this emoji
      const existingReactionIndex = existingReactions.findIndex(
        r => r.userId === currentUser.uid && r.emoji === emoji
      );
      
      if (existingReactionIndex !== -1) {
        // User already reacted with this emoji, remove the reaction
        const updatedReactions = [...existingReactions];
        updatedReactions.splice(existingReactionIndex, 1);
        
        // Update Firestore
        await updateDoc(messageRef, {
          reactions: updatedReactions
        });
        
        // Update local state based on message type
        if (reactionPopover.message.type === 'chat') {
          setChatMessages(prev => prev.map(msg => 
            msg.id === messageId ? { ...msg, reactions: updatedReactions } : msg
          ));
        } else if (reactionPopover.message.type === 'announcement') {
          setAnnouncements(prev => prev.map(msg => 
            msg.id === messageId ? { ...msg, reactions: updatedReactions } : msg
          ));
        }
      } else {
        // Add new reaction
        const newReaction: Reaction = {
          emoji,
          userId: currentUser.uid,
          username: currentUser.displayName || ''
        };
        
        const updatedReactions = [...existingReactions, newReaction];
        
        // Update Firestore
        await updateDoc(messageRef, {
          reactions: updatedReactions
        });
        
        // Update local state based on message type
        if (reactionPopover.message.type === 'chat') {
          setChatMessages(prev => prev.map(msg => 
            msg.id === messageId ? { ...msg, reactions: updatedReactions } : msg
          ));
        } else if (reactionPopover.message.type === 'announcement') {
          setAnnouncements(prev => prev.map(msg => 
            msg.id === messageId ? { ...msg, reactions: updatedReactions } : msg
          ));
        }
      }
      
      // Close the reaction popover
      handleCloseReactions();
      
    } catch (error) {
      console.error('Error adding reaction:', error);
      setSnackbarMessage('Failed to add reaction');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      handleCloseReactions();
    }
  };

  const toggleRoomLock = async () => {
    if (!room || !isOwner) return;
    
    try {
      const newLockedStatus = !room.locked;
      const roomRef = doc(db, 'rooms', roomId!);
      
      // Update the room's locked status
      await updateDoc(roomRef, {
        locked: newLockedStatus
      });
      
      // Update local state
      setRoom({
        ...room,
        locked: newLockedStatus
      });
      
      // Show feedback message
      setSnackbarMessage(`Room ${newLockedStatus ? 'locked' : 'unlocked'}`);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      handleMenuClose();
    } catch (error) {
      console.error('Error toggling room lock:', error);
      setSnackbarMessage('Failed to update room settings');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };
  
  const fetchPendingRequests = async () => {
    if (!room || !isOwner) return;
    
    try {
      // If room has pendingRequests array
      if (room.pendingRequests && room.pendingRequests.length > 0) {
        // Fetch user details for each pending request
        const requestUsers = await Promise.all(
          room.pendingRequests.map(async (userId) => {
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
              const userData = userSnap.data();
              return {
                id: userId,
                username: userData.username || 'Unknown user',
                profilePic: userData.profilePic
              };
            }
            return null;
          })
        );
        
        // Filter out nulls and update state
        setPendingRequests(requestUsers.filter(Boolean) as Array<{id: string, username: string, profilePic?: string}>);
      } else {
        setPendingRequests([]);
      }
      
      setShowPendingRequestsDialog(true);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      setSnackbarMessage('Failed to load join requests');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };
  
  const approveJoinRequest = async (userId: string) => {
    if (!room || !isOwner) return;
    
    try {
      const roomRef = doc(db, 'rooms', roomId!);
      
      // Remove from pending requests and add to members
      const updatedPendingRequests = (room.pendingRequests || []).filter(id => id !== userId);
      const updatedMembers = [...room.members, userId];
      
      await updateDoc(roomRef, {
        pendingRequests: updatedPendingRequests,
        members: updatedMembers
      });
      
      // Update local state
      setRoom({
        ...room,
        pendingRequests: updatedPendingRequests,
        members: updatedMembers
      });
      
      // Remove from UI
      setPendingRequests(prev => prev.filter(user => user.id !== userId));
      
      // Create notification for the approved user
      const notificationRef = collection(db, 'notifications');
      await addDoc(notificationRef, {
        type: 'room_join_approved',
        senderId: currentUser?.uid,
        senderName: currentUserData.name || currentUserData.username || currentUser?.displayName || 'Room owner',
        senderAvatar: currentUserData.profilePic || currentUser?.photoURL || '',
        recipientId: userId,
        content: `Your request to join "${room.name}" has been approved`,
        roomId: roomId,
        roomName: room.name,
        isRead: false,
        createdAt: serverTimestamp()
      });
      
      setSnackbarMessage('Join request approved');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error approving join request:', error);
      setSnackbarMessage('Failed to approve join request');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };
  
  const rejectJoinRequest = async (userId: string) => {
    if (!room || !isOwner) return;
    
    try {
      const roomRef = doc(db, 'rooms', roomId!);
      
      // Remove from pending requests
      const updatedPendingRequests = (room.pendingRequests || []).filter(id => id !== userId);
      
      await updateDoc(roomRef, {
        pendingRequests: updatedPendingRequests
      });
      
      // Update local state
      setRoom({
        ...room,
        pendingRequests: updatedPendingRequests
      });
      
      // Remove from UI
      setPendingRequests(prev => prev.filter(user => user.id !== userId));
      
      // Create notification for the rejected user
      const notificationRef = collection(db, 'notifications');
      await addDoc(notificationRef, {
        type: 'room_join_rejected',
        senderId: currentUser?.uid,
        senderName: currentUserData.name || currentUserData.username || currentUser?.displayName || 'Room owner',
        senderAvatar: currentUserData.profilePic || currentUser?.photoURL || '',
        recipientId: userId,
        content: `Your request to join "${room.name}" has been declined`,
        roomId: roomId,
        roomName: room.name,
        isRead: false,
        createdAt: serverTimestamp()
      });
      
      setSnackbarMessage('Join request declined');
      setSnackbarSeverity('info');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error rejecting join request:', error);
      setSnackbarMessage('Failed to decline join request');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  // Add new functions for member management
  const fetchRoomMembers = async () => {
    if (!room || !room.members) return;
    
    try {
      const membersData = await Promise.all(
        room.members.map(async (memberId) => {
          const userRef = doc(db, 'users', memberId);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            return {
              id: memberId,
              username: userData.username || 'Unknown user',
              name: userData.name,
              profilePic: userData.profilePic
            };
          }
          return null;
        })
      );
      
      setRoomMembers(membersData.filter(Boolean) as Array<{id: string, username: string, name?: string, profilePic?: string}>);
    } catch (error) {
      console.error('Error fetching room members:', error);
      setSnackbarMessage('Failed to load room members');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleMemberMenuOpen = (event: React.MouseEvent<HTMLElement>, member: {id: string, username: string}) => {
    event.stopPropagation();
    setMemberMenuAnchorEl(event.currentTarget);
    setSelectedMember(member);
  };

  const handleMemberMenuClose = () => {
    setMemberMenuAnchorEl(null);
    setSelectedMember(null);
  };

  const handleRemoveMember = async () => {
    if (!selectedMember || !room || !isOwner) return;
    
    try {
      const roomRef = doc(db, 'rooms', roomId!);
      
      // Remove member from room
      const updatedMembers = room.members.filter(id => id !== selectedMember.id);
      
      await updateDoc(roomRef, {
        members: updatedMembers
      });
      
      // Update local state
      setRoom({
        ...room,
        members: updatedMembers
      });
      
      // Remove from UI
      setRoomMembers(prev => prev.filter(member => member.id !== selectedMember.id));
      
      // Create notification for the removed user
      const notificationRef = collection(db, 'notifications');
      await addDoc(notificationRef, {
        type: 'room_removed',
        senderId: currentUser?.uid,
        senderName: currentUserData.name || currentUserData.username || currentUser?.displayName || 'Room owner',
        senderAvatar: currentUserData.profilePic || currentUser?.photoURL || '',
        recipientId: selectedMember.id,
        content: `You have been removed from "${room.name}"`,
        roomId: roomId,
        roomName: room.name,
        isRead: false,
        createdAt: serverTimestamp()
      });
      
      setSnackbarMessage('Member removed from room');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      handleMemberMenuClose();
    } catch (error) {
      console.error('Error removing member:', error);
      setSnackbarMessage('Failed to remove member');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleReportMember = () => {
    if (!selectedMember) return;
    
    // Implement report functionality
    setSnackbarMessage(`Reported ${selectedMember.username}`);
    setSnackbarSeverity('info');
    setSnackbarOpen(true);
    handleMemberMenuClose();
  };

  // Add new functions for user profiles and blocked users
  const fetchBlockedUsers = async () => {
    if (!currentUser) return;
    
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        setBlockedUsers(userData.blockedUsers || []);
      }
    } catch (error) {
      console.error('Error fetching blocked users:', error);
    }
  };

  const checkForBlockedUsersInRoom = () => {
    if (!room || !blockedUsers.length) return;
    
    const blockedUser = roomMembers.find(member => blockedUsers.includes(member.id));
    if (blockedUser) {
      setBlockedUserInRoom(blockedUser);
      setShowBlockedUserAlert(true);
    }
  };

  const handleViewProfile = (member: {id: string, username: string}) => {
    navigate(`/profile/${member.id}`);
  };

  const handleBlockUser = async () => {
    if (!currentUser || !selectedProfile) return;
    
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const updatedBlockedUsers = [...blockedUsers, selectedProfile.id];
      
      await updateDoc(userRef, {
        blockedUsers: updatedBlockedUsers
      });
      
      setBlockedUsers(updatedBlockedUsers);
      setSnackbarMessage(`Blocked ${selectedProfile.username}`);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setShowProfileDialog(false);
      
      // If blocked user is in the room, show alert
      if (room?.members.includes(selectedProfile.id)) {
        setBlockedUserInRoom(selectedProfile);
        setShowBlockedUserAlert(true);
      }
    } catch (error) {
      console.error('Error blocking user:', error);
      setSnackbarMessage('Failed to block user');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleUnblockUser = async () => {
    if (!currentUser || !selectedProfile) return;
    
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const updatedBlockedUsers = blockedUsers.filter(id => id !== selectedProfile.id);
      
      await updateDoc(userRef, {
        blockedUsers: updatedBlockedUsers
      });
      
      setBlockedUsers(updatedBlockedUsers);
      setSnackbarMessage(`Unblocked ${selectedProfile.username}`);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setShowProfileDialog(false);
    } catch (error) {
      console.error('Error unblocking user:', error);
      setSnackbarMessage('Failed to unblock user');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  // Add useEffect to fetch blocked users and check for blocked users in room
  useEffect(() => {
    if (currentUser) {
      fetchBlockedUsers();
    }
  }, [currentUser]);

  useEffect(() => {
    if (roomMembers.length > 0) {
      checkForBlockedUsersInRoom();
    }
  }, [roomMembers, blockedUsers]);

  // Rules management functions
  const handleAddRule = async () => {
    if (!newRule.trim() || !isOwner || !roomId) return;
    
    try {
      const updatedRules = [...roomRules, newRule.trim()];
      
      // Update Firestore
      const roomRef = doc(db, 'rooms', roomId);
      await updateDoc(roomRef, {
        rules: updatedRules
      });
      
      // Update local state
      setRoomRules(updatedRules);
      setNewRule('');
      setShowAddRuleDialog(false);
      
      setSnackbarMessage('Rule added successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error adding rule:', error);
      setSnackbarMessage('Failed to add rule');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleUpdateRule = async (index: number) => {
    if (!editingRuleText.trim() || !isOwner || !roomId) return;
    
    try {
      const updatedRules = [...roomRules];
      updatedRules[index] = editingRuleText.trim();
      
      // Update Firestore
      const roomRef = doc(db, 'rooms', roomId);
      await updateDoc(roomRef, {
        rules: updatedRules
      });
      
      // Update local state
      setRoomRules(updatedRules);
      setEditingRuleIndex(null);
      setEditingRuleText('');
      
      setSnackbarMessage('Rule updated successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error updating rule:', error);
      setSnackbarMessage('Failed to update rule');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleDeleteRule = async () => {
    if (ruleToDelete === null || !isOwner || !roomId) return;
    
    try {
      const updatedRules = roomRules.filter((_, index) => index !== ruleToDelete);
      
      // Update Firestore
      const roomRef = doc(db, 'rooms', roomId);
      await updateDoc(roomRef, {
        rules: updatedRules
      });
      
      // Update local state
      setRoomRules(updatedRules);
      setRuleToDelete(null);
      setShowDeleteRuleDialog(false);
      
      setSnackbarMessage('Rule deleted successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error deleting rule:', error);
      setSnackbarMessage('Failed to delete rule');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  // Function to notify all room members except the sender
  const notifyRoomMembers = async (type: string, content: string, additionalData?: any) => {
    if (!room || !currentUser || !isOwner) return;
    
    try {
      // Get all room members except the current user (sender)
      const membersToNotify = room.members.filter(memberId => memberId !== currentUser.uid);
      
      // Create notifications for each member
      const notificationPromises = membersToNotify.map(memberId => 
        addNotification({
          type: type,
          senderId: currentUser.uid,
          senderName: currentUserData.name || currentUserData.username || currentUser.displayName || 'Room Owner',
          senderAvatar: currentUserData.profilePic || currentUser.photoURL || '',
          recipientId: memberId,
          content: content,
          roomId: roomId!,
          roomName: room.name,
          ...additionalData
        })
      );
      
      await Promise.all(notificationPromises);
      console.log(`Sent ${type} notifications to ${membersToNotify.length} room members`);
    } catch (error) {
      console.error('Error sending room notifications:', error);
    }
  };

  const handleRoomLinkClick = (roomId: string) => {
    navigate(`/side-room/${roomId}`);
  };

  const renderMessageContent = (text: string) => {
    // Regular expression to match room links and extract room ID
    const roomLinkRegex = /(https?:\/\/[^\s]+\/side-room\/[^\s]+)/g;
    const parts = text.split(roomLinkRegex);

    return parts.map((part, index) => {
      if (part.match(roomLinkRegex)) {
        // Extract the room ID from the URL
        const url = new URL(part);
        const pathSegments = url.pathname.split('/');
        const roomId = pathSegments[pathSegments.length - 1];

        return (
          <Box
            key={index}
            component="button"
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation(); // Prevent reaction menu from opening
              handleRoomLinkClick(roomId);
            }}
            sx={{
              color: 'inherit',
              textDecoration: 'underline',
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit',
              cursor: 'pointer',
              '&:hover': {
                opacity: 0.8
              }
            }}
          >
            {part}
          </Box>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const handleAnnouncementReaction = async (announcementId: string, emoji: string) => {
    if (!currentUser?.uid || !roomId) {
      return;
    }
    
    try {
      const announcementRef = doc(db, 'rooms', roomId, 'messages', announcementId);
      
      // Get the current announcement to access its reactions
      const announcementDoc = await getDoc(announcementRef);
      if (!announcementDoc.exists()) {
        setSnackbarMessage('Announcement not found');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        return;
      }
      
      const announcementData = announcementDoc.data();
      const existingReactions = announcementData.reactions || [];
      
      // Check if user already reacted with this emoji
      const existingReactionIndex = existingReactions.findIndex(
        (r: Reaction) => r.userId === currentUser.uid && r.emoji === emoji
      );
      
      let updatedReactions: Reaction[];
      
      if (existingReactionIndex !== -1) {
        // User already reacted with this emoji, remove the reaction
        updatedReactions = [...existingReactions];
        updatedReactions.splice(existingReactionIndex, 1);
      } else {
        // Add new reaction, but first remove any other emoji reactions from this user
        const reactionsWithoutUserReactions = existingReactions.filter(
          (r: Reaction) => r.userId !== currentUser.uid
        );
        
        const newReaction: Reaction = {
          emoji,
          userId: currentUser.uid,
          username: currentUserData.name || currentUserData.username || currentUser.displayName || ''
        };
        
        updatedReactions = [...reactionsWithoutUserReactions, newReaction];
      }
      
      // Update Firestore
      await updateDoc(announcementRef, {
        reactions: updatedReactions
      });
      
      // Update local state
      setAnnouncements(prev => prev.map(announcement => 
        announcement.id === announcementId 
          ? { ...announcement, reactions: updatedReactions } 
          : announcement
      ));
      
    } catch (error) {
      console.error('Error handling announcement reaction:', error);
      setSnackbarMessage('Failed to update reaction');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ 
      mt: 2, 
      mb: { xs: 10, md: 8 }, // More bottom margin on mobile
      height: '100%' 
    }}>
      <Paper elevation={0} sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton onClick={() => navigate('/messages')} sx={{ mr: 1 }}>
              <BackIcon />
            </IconButton>
            <Typography variant="h6" fontWeight="bold">
              {room?.name}
            </Typography>
          </Box>
          
          <IconButton onClick={handleMenuOpen}>
            <MoreVertIcon />
          </IconButton>
        </Box>
        
        {room?.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {room.description}
          </Typography>
        )}
        
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            aria-label="room tabs"
            variant="fullWidth"
          >
            <Tooltip title="General Chat" arrow>
              <Tab 
                icon={<ChatIcon />} 
                id="room-tab-0" 
                aria-controls="room-tabpanel-0"
                sx={{ minWidth: 'auto' }}
              />
            </Tooltip>
            <Tooltip title="Announcements" arrow>
              <Tab 
                icon={<AnnouncementIcon />} 
                id="room-tab-1" 
                aria-controls="room-tabpanel-1"
                sx={{ minWidth: 'auto' }}
              />
            </Tooltip>
            <Tooltip title="Polls" arrow>
              <Tab 
                icon={<PollIcon />} 
                id="room-tab-2" 
                aria-controls="room-tabpanel-2"
                sx={{ minWidth: 'auto' }}
              />
            </Tooltip>
            <Tooltip title="Rules" arrow>
              <Tab 
                icon={<LockIcon />} 
                id="room-tab-3" 
                aria-controls="room-tabpanel-3"
                sx={{ minWidth: 'auto' }}
              />
            </Tooltip>
          </Tabs>
        </Box>
      </Paper>
      
      {/* Show upload progress if an upload is in progress */}
      {isUploading && (
        <Box sx={{ width: '100%', px: 2, py: 1, bgcolor: 'background.paper' }}>
          <Typography variant="caption" gutterBottom>
            Uploading media... {uploadProgress ? Math.round(uploadProgress) : 0}%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={uploadProgress || 0}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>
      )}
      
      <Paper elevation={0} sx={{ 
        height: { 
          xs: 'calc(100vh - 280px)', // More space for mobile bottom nav
          md: 'calc(100vh - 250px)' 
        }, 
        mt: 2 
      }}>
        <TabPanel value={tabValue} index={0}>
          {/* General Chat */}
          <Box sx={{ height: 'calc(100vh - 350px)', overflowY: 'auto', mb: 2 }}>
            {chatMessages.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary">
                  No messages yet. Start the conversation!
                </Typography>
              </Box>
            ) : (
              <List>
                {chatMessages.map((msg) => {
                  const isCurrentUser = msg.sender === currentUser?.uid;
                  
                  return (
                    <ListItem 
                      key={msg.id} 
                      alignItems="flex-start"
                      sx={{
                        flexDirection: isCurrentUser ? 'row-reverse' : 'row',
                        px: 1
                      }}
                    >
                      <ListItemAvatar sx={{ minWidth: isCurrentUser ? '40px' : '56px', ml: isCurrentUser ? 1 : 0 }}>
                        <Box sx={{ position: 'relative' }}>
                          <Avatar 
                            alt={msg.senderName} 
                            src={msg.senderPhoto}
                            sx={{ 
                              width: 40, 
                              height: 40,
                              bgcolor: !msg.senderPhoto ? (isCurrentUser ? 'primary.main' : 'secondary.main') : undefined,
                              cursor: 'pointer',
                              '&:hover': {
                                opacity: 0.8
                              }
                            }}
                            onClick={() => navigate(`/profile/${msg.sender}`)}
                          >
                            {!msg.senderPhoto && msg.senderName?.charAt(0)?.toUpperCase()}
                          </Avatar>
                          {!isCurrentUser && (
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: 4,
                                right: 4,
                                zIndex: 1
                              }}
                            >
                              <OnlineIndicator 
                                isOnline={isUserOnline(msg.sender)} 
                                size="small" 
                              />
                            </Box>
                          )}
                        </Box>
                      </ListItemAvatar>
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isCurrentUser ? 'flex-end' : 'flex-start',
                          maxWidth: '75%'
                        }}
                      >
                        <Typography 
                          variant="caption" 
                          color="text.secondary"
                          sx={{ 
                            mb: 0.5,
                            cursor: 'pointer',
                            '&:hover': {
                              textDecoration: 'underline'
                            }
                          }}
                          onClick={() => navigate(`/profile/${msg.sender}`)}
                        >
                          {isCurrentUser ? 'You' : msg.senderName}
                        </Typography>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 1.5,
                            borderRadius: 2,
                            bgcolor: isCurrentUser ? 'primary.light' : 'background.paper',
                            color: isCurrentUser ? 'primary.contrastText' : 'text.primary',
                            cursor: 'pointer',
                            position: 'relative',
                            '&:hover': {
                              opacity: 0.9
                            }
                          }}
                          onClick={(e) => handleOpenReactions(e, msg)}
                          onMouseDown={() => isCurrentUser && handleMessageMouseDown(msg)}
                          onMouseUp={handleMessageMouseUp}
                          onTouchStart={() => isCurrentUser && handleMessageTouchStart(msg)}
                          onTouchEnd={handleMessageTouchEnd}
                        >
                          {msg.mediaUrl && msg.mediaType === 'image' && (
                            <Box sx={{ mb: 1 }}>
                              <img 
                                src={msg.mediaUrl} 
                                alt="Shared image" 
                                style={{ 
                                  maxWidth: '100%', 
                                  maxHeight: '300px', 
                                  borderRadius: '8px',
                                  display: 'block'
                                }} 
                              />
                            </Box>
                          )}
                          
                          {msg.mediaUrl && msg.mediaType === 'video' && (
                            <Box sx={{ mb: 1 }}>
                              <video 
                                src={msg.mediaUrl} 
                                controls
                                style={{ 
                                  maxWidth: '100%', 
                                  maxHeight: '300px', 
                                  borderRadius: '8px',
                                  display: 'block'
                                }} 
                              />
                            </Box>
                          )}

                          <Typography variant="body1">
                            {renderMessageContent(msg.text)}
                          </Typography>
                          <Typography 
                            variant="caption" 
                            color={isCurrentUser ? 'primary.contrastText' : 'text.secondary'}
                            sx={{ 
                              display: 'block',
                              opacity: 0.8,
                              mt: 0.5,
                              textAlign: 'right'
                            }}
                          >
                            {formatTimestamp(msg.timestamp)}
                          </Typography>
                        </Paper>
                        
                        {/* Render reactions if any exist */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <Box 
                            sx={{
                              display: 'flex',
                              flexDirection: isCurrentUser ? 'row-reverse' : 'row',
                              flexWrap: 'wrap',
                              gap: 0.5,
                              mt: 0.5,
                              maxWidth: '100%',
                            }}
                          >
                            {/* Group reactions by emoji and show count */}
                            {Object.entries(
                              msg.reactions.reduce((acc, reaction) => {
                                acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
                                return acc;
                              }, {} as Record<string, number>)
                            ).map(([emoji, count]) => {
                              // Check if current user has this reaction
                              const userHasThisReaction = msg.reactions?.some(
                                r => r.emoji === emoji && r.userId === currentUser?.uid
                              );
                              
                              return (
                                <Chip
                                  key={emoji}
                                  label={`${emoji} ${count}`}
                                  size="small"
                                  variant="outlined"
                                  onClick={(e) => handleOpenReactionDetails(e, msg, emoji)}
                                  sx={{ 
                                    borderRadius: '12px',
                                    height: '24px',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    backgroundColor: (theme) => 
                                      userHasThisReaction
                                        ? theme.palette.mode === 'dark' 
                                          ? 'rgba(25, 118, 210, 0.2)' 
                                          : 'rgba(25, 118, 210, 0.1)'
                                        : theme.palette.mode === 'dark' 
                                          ? 'rgba(255,255,255,0.1)' 
                                          : 'rgba(0,0,0,0.05)',
                                    border: (theme) => 
                                      userHasThisReaction 
                                        ? `1px solid ${theme.palette.primary.main}` 
                                        : undefined,
                                    '&:hover': {
                                      backgroundColor: (theme) => 
                                        userHasThisReaction
                                          ? theme.palette.mode === 'dark' 
                                            ? 'rgba(25, 118, 210, 0.3)' 
                                            : 'rgba(25, 118, 210, 0.2)'
                                          : theme.palette.mode === 'dark' 
                                            ? 'rgba(255,255,255,0.15)' 
                                            : 'rgba(0,0,0,0.1)',
                                    }
                                  }}
                                />
                              );
                            })}
                          </Box>
                        )}
                      </Box>
                    </ListItem>
                  );
                })}
                <div ref={messagesEndRef} />
              </List>
            )}
          </Box>
          
          {/* Update the input section to include emoji picker and file upload */}
          <Box sx={{ display: 'flex', p: 1 }}>
            {/* Add file upload input (hidden) */}
            <HiddenFileInput
              ref={fileInputRef}
              accept="image/*,video/*"
              id="file-upload-input"
              type="file"
              onChange={handleFileUpload}
            />
            
            {/* File upload button */}
            <IconButton 
              onClick={handleUploadClick}
              color="primary"
              sx={{ mr: 1 }}
              aria-label="attach file"
            >
              <AttachFileIcon />
            </IconButton>
            
            {/* Emoji button */}
            <IconButton
              onClick={toggleEmojiPicker}
              color="primary"
              sx={{ mr: 1 }}
              aria-label="add emoji"
            >
              <EmojiIcon />
            </IconButton>
            
            <TextField
              fullWidth
              placeholder="Type a message..."
              variant="outlined"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              sx={{ mr: 1 }}
            />
            <Button 
              variant="contained" 
              endIcon={<SendIcon />}
              onClick={sendMessage}
              disabled={!message.trim() && !isUploading}
            >
              Send
            </Button>
          </Box>
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          {/* Announcements */}
          {isOwner && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
              <Typography variant="subtitle1" gutterBottom>
                Create Announcement
              </Typography>
              <TextField
                fullWidth
                placeholder="Post an announcement to all members..."
                variant="outlined"
                multiline
                rows={3}
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                sx={{ mb: 1 }}
              />
              <Button 
                variant="contained" 
                endIcon={<AnnouncementIcon />}
                onClick={sendAnnouncement}
                disabled={!announcement.trim()}
              >
                Post Announcement
              </Button>
            </Box>
          )}
          
          <Box>
            {announcements.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No announcements yet.
                </Typography>
              </Box>
            ) : (
              <List>
                {announcements.map((announcement) => (
                  <Paper key={announcement.id} elevation={0} sx={{ mb: 2, p: 2, bgcolor: 'background.default' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Box sx={{ position: 'relative', mr: 1 }}>
                        <Avatar alt={announcement.senderName} src={announcement.senderPhoto} />
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: 4,
                            right: 4,
                            zIndex: 1
                          }}
                        >
                          <OnlineIndicator 
                            isOnline={isUserOnline(announcement.sender)} 
                            size="small" 
                          />
                        </Box>
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle2">{announcement.senderName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatTimestamp(announcement.timestamp)}
                        </Typography>
                      </Box>
                      {isOwner && (
                        <IconButton 
                          size="small"
                          onClick={(e) => handleAnnouncementMenuOpen(e, announcement)}
                          sx={{ ml: 1 }}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                    <Typography variant="body1" sx={{ mb: 2 }}>{announcement.text}</Typography>
                    
                    {/* Heart and Heartbreak Buttons */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                      {/* Heart Button */}
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <IconButton
                          size="small"
                          onClick={() => handleAnnouncementReaction(announcement.id, '❤️')}
                          sx={{
                            color: announcement.reactions?.some(r => r.emoji === '❤️' && r.userId === currentUser?.uid) 
                              ? 'red' 
                              : 'text.secondary',
                            '&:hover': {
                              color: 'red',
                              backgroundColor: 'rgba(255, 0, 0, 0.1)'
                            }
                          }}
                        >
                          ❤️
                        </IconButton>
                        <Typography variant="caption" color="text.secondary">
                          {announcement.reactions?.filter(r => r.emoji === '❤️').length || 0}
                        </Typography>
                      </Box>

                      {/* Heartbreak Button */}
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <IconButton
                          size="small"
                          onClick={() => handleAnnouncementReaction(announcement.id, '💔')}
                          sx={{
                            color: announcement.reactions?.some(r => r.emoji === '💔' && r.userId === currentUser?.uid) 
                              ? 'purple' 
                              : 'text.secondary',
                            '&:hover': {
                              color: 'purple',
                              backgroundColor: 'rgba(128, 0, 128, 0.1)'
                            }
                          }}
                        >
                          💔
                        </IconButton>
                        <Typography variant="caption" color="text.secondary">
                          {announcement.reactions?.filter(r => r.emoji === '💔').length || 0}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                ))}
              </List>
            )}
          </Box>
        </TabPanel>
        
        <TabPanel value={tabValue} index={2}>
          {/* Polls */}
          {isOwner && (
            <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
              <Typography variant="subtitle1" gutterBottom>
                Create Poll
              </Typography>
              <Button 
                variant="contained" 
                startIcon={<PollIcon />}
                onClick={() => setShowPollDialog(true)}
                fullWidth
              >
                Create New Poll
              </Button>
            </Box>
          )}
          
          <Box>
            {polls.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No polls have been created yet.
                </Typography>
              </Box>
            ) : (
              <List>
                {polls.map((poll) => (
                  <Paper key={poll.id} elevation={0} sx={{ mb: 3, p: 2, bgcolor: 'background.default' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Box sx={{ position: 'relative', mr: 1 }}>
                        <Avatar alt={poll.senderName} src={poll.senderPhoto} />
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: 4,
                            right: 4,
                            zIndex: 1
                          }}
                        >
                          <OnlineIndicator 
                            isOnline={isUserOnline(poll.sender)} 
                            size="small" 
                          />
                        </Box>
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle2">{poll.senderName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatTimestamp(poll.timestamp)}
                        </Typography>
                      </Box>
                      {isOwner && poll.sender === currentUser?.uid && (
                        <IconButton 
                          size="small"
                          onClick={(e) => handlePollMenuOpen(e, poll)}
                          sx={{ ml: 1 }}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                    
                    <Typography variant="h6" gutterBottom>{poll.text}</Typography>
                    
                    {poll.pollOptions?.map((option, index) => {
                      // Calculate votes for this option
                      const votes = poll.pollVotes?.[index.toString()] || [];
                      const voteCount = votes.length;
                      const totalVotes = Object.values(poll.pollVotes || {}).reduce(
                        (sum, voters) => sum + (voters?.length || 0), 0
                      );
                      const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                      const hasVoted = votes.includes(currentUser?.uid || '');
                      
                      return (
                        <Box 
                          key={index} 
                          sx={{ 
                            mb: 1,
                            p: 1.5,
                            borderRadius: 1,
                            bgcolor: hasVoted ? 'primary.light' : 'background.paper',
                            position: 'relative',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            '&:hover': {
                              bgcolor: hasVoted ? 'primary.light' : 'action.hover'
                            }
                          }}
                          onClick={() => handleVotePoll(poll.id, index)}
                        >
                          {/* Background progress bar */}
                          <Box 
                            sx={{ 
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              height: '100%',
                              width: `${percentage}%`,
                              bgcolor: 'primary.main',
                              opacity: 0.2,
                              zIndex: 0
                            }}
                          />
                          
                          {/* Option text and vote count */}
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
                            <Typography variant="body1">{option}</Typography>
                            <Typography variant="body2">
                              {voteCount} {voteCount === 1 ? 'vote' : 'votes'} ({percentage}%)
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </Paper>
                ))}
              </List>
            )}
          </Box>
        </TabPanel>
        
        <TabPanel value={tabValue} index={3}>
          {/* Rules */}
          <Box sx={{ pb: { xs: 2, md: 0 } }}>
            {roomRules.length === 0 ? (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                py: { xs: 2, md: 4 },
                px: { xs: 1, md: 2 }
              }}>
                <Typography 
                  variant={isDesktop ? "h6" : "subtitle1"} 
                  color="text.secondary" 
                  gutterBottom
                  sx={{ textAlign: 'center' }}
                >
                  {isOwner ? "No rules set" : "No rules"}
                </Typography>
                {isOwner && (
                  <Tooltip title="Add first rule" arrow>
                    <IconButton
                      color="primary"
                      onClick={() => setShowAddRuleDialog(true)}
                      sx={{ 
                        bgcolor: 'primary.main',
                        color: 'white',
                        '&:hover': {
                          bgcolor: 'primary.dark',
                        },
                        width: { xs: 48, md: 56 },
                        height: { xs: 48, md: 56 }
                      }}
                    >
                      <AddIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            ) : (
              <>
                {/* Add Rule Button for existing rules - more compact on mobile */}
                {isOwner && (
                  <Box sx={{ 
                    mb: { xs: 1.5, md: 2 }, 
                    px: { xs: 1, md: 0 },
                    display: 'flex',
                    justifyContent: { xs: 'center', md: 'flex-start' }
                  }}>
                    <Tooltip title="Add new rule" arrow>
                      <IconButton
                        color="primary"
                        onClick={() => setShowAddRuleDialog(true)}
                        sx={{ 
                          bgcolor: 'primary.main',
                          color: 'white',
                          '&:hover': {
                            bgcolor: 'primary.dark',
                          },
                          width: { xs: 44, md: 48 },
                          height: { xs: 44, md: 48 }
                        }}
                      >
                        <AddIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
                
                <List sx={{ 
                  bgcolor: 'background.paper', 
                  borderRadius: 1,
                  px: { xs: 1, md: 0 }
                }}>
                  {roomRules.map((rule, index) => (
                    <Paper 
                      key={index} 
                      elevation={0} 
                      sx={{ 
                        mb: { xs: 1.5, md: 2 }, 
                        p: { xs: 1.5, md: 2 }, 
                        bgcolor: 'background.default' 
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <Box sx={{ flexGrow: 1, mr: 1 }}>
                          <Typography 
                            variant="subtitle2" 
                            sx={{ 
                              mb: 1, 
                              color: 'primary.main',
                              fontSize: { xs: '0.8rem', md: '0.875rem' }
                            }}
                          >
                            Rule #{index + 1}
                          </Typography>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontSize: { xs: '0.875rem', md: '1rem' },
                              lineHeight: { xs: 1.4, md: 1.5 }
                            }}
                          >
                            {rule}
                          </Typography>
                        </Box>
                        
                        {isOwner && (
                          <Box sx={{ 
                            display: 'flex',
                            flexDirection: { xs: 'column', md: 'row' },
                            gap: { xs: 0.5, md: 1 }
                          }}>
                            <Tooltip title="Edit rule" arrow>
                              <IconButton 
                                size="small"
                                onClick={() => {
                                  setEditingRuleIndex(index);
                                  setEditingRuleText(rule);
                                }}
                                sx={{ 
                                  p: { xs: 0.5, md: 1 }
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete rule" arrow>
                              <IconButton 
                                size="small"
                                onClick={() => {
                                  setRuleToDelete(index);
                                  setShowDeleteRuleDialog(true);
                                }}
                                color="error"
                                sx={{ 
                                  p: { xs: 0.5, md: 1 }
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                      </Box>
                      
                      {editingRuleIndex === index && (
                        <Box sx={{ 
                          mt: { xs: 1.5, md: 2 }, 
                          pt: { xs: 1.5, md: 2 }, 
                          borderTop: 1, 
                          borderColor: 'divider' 
                        }}>
                          <TextField
                            fullWidth
                            multiline
                            rows={2}
                            value={editingRuleText}
                            onChange={(e) => setEditingRuleText(e.target.value)}
                            sx={{ mb: { xs: 1.5, md: 2 } }}
                            size={isDesktop ? "medium" : "small"}
                          />
                          <Box sx={{ 
                            display: 'flex', 
                            gap: 1,
                            justifyContent: 'center'
                          }}>
                            <Tooltip title="Save changes" arrow>
                              <IconButton
                                color="primary"
                                onClick={() => handleUpdateRule(index)}
                                disabled={!editingRuleText.trim()}
                                sx={{ 
                                  bgcolor: 'success.main',
                                  color: 'white',
                                  '&:hover': {
                                    bgcolor: 'success.dark',
                                  },
                                  '&:disabled': {
                                    bgcolor: 'action.disabled',
                                    color: 'action.disabled'
                                  },
                                  width: { xs: 36, md: 40 },
                                  height: { xs: 36, md: 40 }
                                }}
                              >
                                <CheckIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Cancel editing" arrow>
                              <IconButton
                                color="error"
                                onClick={() => {
                                  setEditingRuleIndex(null);
                                  setEditingRuleText('');
                                }}
                                sx={{ 
                                  bgcolor: 'error.main',
                                  color: 'white',
                                  '&:hover': {
                                    bgcolor: 'error.dark',
                                  },
                                  width: { xs: 36, md: 40 },
                                  height: { xs: 36, md: 40 }
                                }}
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>
                      )}
                    </Paper>
                  ))}
                </List>
              </>
            )}
          </Box>
        </TabPanel>
      </Paper>
      
      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        {isOwner ? (
          // Owner options
          <>
            <MenuItem onClick={() => { setShowInviteDialog(true); handleMenuClose(); }}>
              <ListItemIcon>
                <InviteIcon fontSize="small" />
              </ListItemIcon>
              Invite People
            </MenuItem>
            <MenuItem onClick={() => { setShowMembersDialog(true); fetchRoomMembers(); handleMenuClose(); }}>
              <ListItemIcon>
                <PersonAddIcon fontSize="small" />
              </ListItemIcon>
              Members
            </MenuItem>
            <MenuItem onClick={toggleRoomLock}>
              <ListItemIcon>
                {room?.locked ? (
                  <LockOpenIcon fontSize="small" />
                ) : (
                  <LockIcon fontSize="small" />
                )}
              </ListItemIcon>
              {room?.locked ? 'Unlock Room' : 'Lock Room'}
            </MenuItem>
            {room?.locked && room?.pendingRequests && room.pendingRequests.length > 0 && (
              <MenuItem onClick={fetchPendingRequests}>
                <ListItemIcon>
                  <PersonAddIcon fontSize="small" />
                </ListItemIcon>
                View Join Requests
                <Badge 
                  color="primary" 
                  badgeContent={room.pendingRequests.length} 
                  sx={{ ml: 1 }}
                />
              </MenuItem>
            )}
            <MenuItem onClick={() => { setShowDeleteDialog(true); handleMenuClose(); }} sx={{ color: 'error.main' }}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" color="error" />
              </ListItemIcon>
              Delete Room
            </MenuItem>
          </>
        ) : (
          // Member options
          <>
            <MenuItem onClick={reportRoom}>
              <ListItemIcon>
                <ReportIcon fontSize="small" />
              </ListItemIcon>
              Report Room
            </MenuItem>
            <MenuItem onClick={leaveRoom} sx={{ color: 'error.main' }}>
              <ListItemIcon>
                <LeaveIcon fontSize="small" color="error" />
              </ListItemIcon>
              Leave Room
            </MenuItem>
          </>
        )}
      </Menu>
      
      {/* Invite Dialog */}
      <Dialog
        open={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Invite People to Room</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Search for users to add to this room.
          </DialogContentText>
          
          <Box sx={{ display: 'flex', mb: 2 }}>
            <TextField
              fullWidth
              label="Search by username"
              variant="outlined"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearchUsers()}
              sx={{ mr: 1 }}
            />
            <Button variant="contained" onClick={handleSearchUsers}>
              Search
            </Button>
          </Box>
          
          {searchResults.length > 0 ? (
            <List>
              {searchResults.map((user) => (
                <ListItem
                  key={user.id}
                  secondaryAction={
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddMemberIcon />}
                      onClick={() => inviteMember(user.id)}
                    >
                      Invite
                    </Button>
                  }
                >
                  <ListItemAvatar>
                    <Box sx={{ position: 'relative' }}>
                      <Avatar alt={user.username} src={user.profilePic} />
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: 4,
                          right: 4,
                          zIndex: 1
                        }}
                      >
                        <OnlineIndicator 
                          isOnline={isUserOnline(user.id)} 
                          size="small" 
                        />
                      </Box>
                    </Box>
                  </ListItemAvatar>
                  <ListItemText
                    primary={user.name || user.username}
                    secondary={`@${user.username}`}
                  />
                </ListItem>
              ))}
            </List>
          ) : searchQuery ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No users found matching "{searchQuery}"
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowInviteDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Room Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
      >
        <DialogTitle>Delete Room?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this room? This action cannot be undone and all messages will be permanently deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
          <Button onClick={deleteRoom} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Create Poll Dialog */}
      <Dialog
        open={showPollDialog}
        onClose={() => setShowPollDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create Poll</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Poll Question"
            fullWidth
            variant="outlined"
            value={pollQuestion}
            onChange={(e) => setPollQuestion(e.target.value)}
            sx={{ mb: 3 }}
          />
          
          <Typography variant="subtitle2" gutterBottom>
            Options
          </Typography>
          
          {pollOptions.map((option, index) => (
            <TextField
              key={index}
              margin="dense"
              label={`Option ${index + 1}`}
              fullWidth
              variant="outlined"
              value={option.text}
              onChange={(e) => handlePollOptionChange(index, e.target.value)}
              sx={{ mb: 1 }}
            />
          ))}
          
          <Button
            variant="outlined"
            startIcon={<AddMemberIcon />}
            onClick={handleAddPollOption}
            sx={{ mt: 1 }}
          >
            Add Option
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPollDialog(false)}>Cancel</Button>
          <Button
            onClick={createPoll}
            variant="contained"
            disabled={!pollQuestion.trim() || pollOptions.filter(o => o.text.trim()).length < 2}
          >
            Create Poll
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Message Confirmation Dialog */}
      <Dialog
        open={showDeleteMessageDialog}
        onClose={() => {
          setShowDeleteMessageDialog(false);
          setSelectedMessage(null);
        }}
      >
        <DialogTitle>Delete Message?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this message? This action cannot be undone.
          </DialogContentText>
          {selectedMessage && (
            <Paper elevation={0} sx={{ p: 2, mt: 2, bgcolor: 'background.default' }}>
              <Typography variant="body1">{selectedMessage.text}</Typography>
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setShowDeleteMessageDialog(false);
              setSelectedMessage(null);
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={deleteMessage} 
            color="error" 
            startIcon={<DeleteOutlineIcon />}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Emoji Picker Popover */}
      <Popover
        open={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        anchorReference="anchorPosition"
        anchorPosition={{ top: window.innerHeight - 300, left: window.innerWidth / 2 }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
      >
        <Box sx={{ 
          p: 1, 
          width: '300px',
          maxWidth: '90vw',
          height: '200px',
          overflow: 'auto',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          {commonEmojis.map((emoji) => (
            <Box
              key={emoji}
              component="button"
              onClick={() => {
                addEmojiToMessage(emoji);
                setShowEmojiPicker(false);
              }}
              sx={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '1.8rem',
                m: 0.5,
                p: 0.5,
                borderRadius: '4px',
                minWidth: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                '&:hover': {
                  background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                }
              }}
            >
              {emoji}
            </Box>
          ))}
        </Box>
      </Popover>
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={snackbarSeverity} 
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>

      {/* Add Announcement Menu */}
      <Menu
        anchorEl={announcementMenuAnchorEl}
        open={Boolean(announcementMenuAnchorEl)}
        onClose={handleAnnouncementMenuClose}
      >
        <MenuItem onClick={handleEditAnnouncementOpen}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          Edit Announcement
        </MenuItem>
        <MenuItem onClick={handleDeleteAnnouncementOpen} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          Delete Announcement
        </MenuItem>
      </Menu>

      {/* Edit Announcement Dialog */}
      <Dialog
        open={showEditAnnouncementDialog}
        onClose={() => setShowEditAnnouncementDialog(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Edit Announcement</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={4}
            value={editedAnnouncementText}
            onChange={(e) => setEditedAnnouncementText(e.target.value)}
            margin="dense"
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditAnnouncementDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleEditAnnouncement} 
            variant="contained" 
            color="primary"
            disabled={!editedAnnouncementText.trim()}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Announcement Confirmation Dialog */}
      <Dialog
        open={showDeleteAnnouncementDialog}
        onClose={() => setShowDeleteAnnouncementDialog(false)}
      >
        <DialogTitle>Delete Announcement?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this announcement? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteAnnouncementDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleDeleteAnnouncement} 
            color="error" 
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Poll Confirmation Dialog */}
      <Dialog
        open={showDeletePollDialog}
        onClose={() => setShowDeletePollDialog(false)}
      >
        <DialogTitle>Delete Poll?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this poll? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeletePollDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleDeletePoll} 
            color="error" 
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Poll Menu */}
      <Menu
        anchorEl={pollMenuAnchorEl}
        open={Boolean(pollMenuAnchorEl)}
        onClose={handlePollMenuClose}
      >
        <MenuItem onClick={handleDeletePollOpen} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          Delete Poll
        </MenuItem>
      </Menu>

      {/* Reaction Popover */}
      <Popover
        open={Boolean(reactionPopover.anchorEl)}
        anchorEl={reactionPopover.anchorEl}
        onClose={handleCloseReactions}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
      >
        <Box sx={{ p: 1, display: 'flex', flexWrap: 'wrap', maxWidth: '300px' }}>
          {availableReactions.map((reaction) => (
            <IconButton
              key={reaction.emoji}
              onClick={() => addReaction(reaction.emoji)}
              sx={{ 
                m: 0.5,
                '&:hover': {
                  bgcolor: 'rgba(0,0,0,0.04)'
                }
              }}
              aria-label={reaction.label}
            >
              <Typography variant="body1" sx={{ fontSize: '1.4rem' }}>
                {reaction.emoji}
              </Typography>
            </IconButton>
          ))}
        </Box>
      </Popover>
      
      {/* Reaction Details Popover */}
      <Popover
        open={Boolean(reactionDetailsPopover.anchorEl)}
        anchorEl={reactionDetailsPopover.anchorEl}
        onClose={handleCloseReactionDetails}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
      >
        <Box sx={{ p: 2, maxWidth: '250px' }}>
          {/* Reaction Header */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            mb: 1.5,
            pb: 1,
            borderBottom: 1,
            borderColor: 'divider'
          }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
              <Box component="span" sx={{ fontSize: '1.6rem', mr: 1 }}>
                {reactionDetailsPopover.emoji}
              </Box>
              Reactions
            </Typography>
            
            {/* If user has this reaction, show Remove button */}
            {reactionDetailsPopover.message && reactionDetailsPopover.emoji && 
             reactionDetailsPopover.message.reactions?.some(
               r => r.emoji === reactionDetailsPopover.emoji && r.userId === currentUser?.uid
             ) && (
              <Button 
                variant="outlined" 
                color="error" 
                size="small"
                onClick={() => removeReaction(
                  reactionDetailsPopover.message?.id || '', 
                  reactionDetailsPopover.emoji || ''
                )}
              >
                Remove
              </Button>
            )}
          </Box>
          
          {/* Users who reacted list */}
          <List sx={{ py: 0 }}>
            {reactionDetailsPopover.message && reactionDetailsPopover.emoji && 
             reactionDetailsPopover.message.reactions
              ?.filter(r => r.emoji === reactionDetailsPopover.emoji)
              .map((reaction, index) => (
                <ListItem 
                  key={`${reaction.userId}-${index}`}
                  sx={{ 
                    py: 0.5, 
                    px: 1,
                    borderRadius: 1,
                    my: 0.3,
                    bgcolor: reaction.userId === currentUser?.uid 
                      ? 'rgba(25, 118, 210, 0.15)'
                      : 'transparent'
                  }}
                >
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    width: '100%',
                    justifyContent: 'space-between'
                  }}>
                    <Typography>
                      {reaction.username || 'User'} 
                      {reaction.userId === currentUser?.uid && (
                        <Typography component="span" color="text.secondary" sx={{ ml: 0.5, fontSize: '0.8rem' }}>
                          (you)
                        </Typography>
                      )}
                    </Typography>
                    <Typography fontSize="1.2rem">
                      {reaction.emoji}
                    </Typography>
                  </Box>
                </ListItem>
            ))}
          </List>
        </Box>
      </Popover>
      
      {/* Pending Join Requests Dialog */}
      <Dialog
        open={showPendingRequestsDialog}
        onClose={() => setShowPendingRequestsDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Join Requests</DialogTitle>
        <DialogContent>
          {pendingRequests.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No pending join requests
            </Typography>
          ) : (
            <List>
              {pendingRequests.map((user) => (
                <ListItem
                  key={user.id}
                  secondaryAction={
                    <Box>
                      <Button
                        variant="outlined"
                        color="primary"
                        size="small"
                        onClick={() => approveJoinRequest(user.id)}
                        sx={{ mr: 1 }}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={() => rejectJoinRequest(user.id)}
                      >
                        Decline
                      </Button>
                    </Box>
                  }
                >
                  <ListItemAvatar>
                    <Avatar alt={user.username} src={user.profilePic} />
                  </ListItemAvatar>
                  <ListItemText
                    primary={user.username}
                    secondary="Wants to join this room"
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPendingRequestsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Add Members Dialog */}
      <Dialog
        open={showMembersDialog}
        onClose={() => setShowMembersDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Room Members</DialogTitle>
        <DialogContent>
          {roomMembers.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No members found
            </Typography>
          ) : (
            <List>
              {roomMembers.map((member) => (
                <ListItem
                  key={member.id}
                  secondaryAction={
                    member.id !== currentUser?.uid && (
                      <IconButton
                        edge="end"
                        onClick={(e) => handleMemberMenuOpen(e, member)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    )
                  }
                  sx={{
                    cursor: 'pointer',
                    opacity: blockedUsers.includes(member.id) ? 0.5 : 1,
                    '&:hover': {
                      backgroundColor: 'action.hover'
                    }
                  }}
                  onClick={() => handleViewProfile(member)}
                >
                  <ListItemAvatar>
                    <Box sx={{ position: 'relative' }}>
                      <Avatar alt={member.username} src={member.profilePic} />
                                            <Box
                        sx={{
                          position: 'absolute',
                          bottom: 4,
                          right: 4,
                          zIndex: 1
                        }}
                      >
                         <OnlineIndicator 
                           isOnline={isUserOnline(member.id)} 
                           size="small" 
                         />
                       </Box>
                     </Box>
                    </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {member.name || member.username}
                        {blockedUsers.includes(member.id) && (
                          <Chip
                            label="Blocked"
                            size="small"
                            color="error"
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>
                    }
                    secondary={`@${member.username}`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMembersDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Member Menu */}
      <Menu
        anchorEl={memberMenuAnchorEl}
        open={Boolean(memberMenuAnchorEl)}
        onClose={handleMemberMenuClose}
      >
        {isOwner && selectedMember && selectedMember.id !== currentUser?.uid && (
          <MenuItem onClick={handleRemoveMember} sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            Remove from Room
          </MenuItem>
        )}
        {selectedMember && selectedMember.id !== currentUser?.uid && (
          <MenuItem onClick={handleReportMember} sx={{ color: 'warning.main' }}>
            <ListItemIcon>
              <ReportIcon fontSize="small" color="warning" />
            </ListItemIcon>
            Report User
          </MenuItem>
        )}
      </Menu>

      {/* Profile Dialog */}
      <Dialog
        open={showProfileDialog}
        onClose={() => setShowProfileDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              src={selectedProfile?.profilePic}
              alt={selectedProfile?.username}
              sx={{ width: 64, height: 64 }}
            />
            <Box>
              <Typography variant="h6">{selectedProfile?.name || selectedProfile?.username}</Typography>
              <Typography variant="subtitle2" color="text.secondary">
                @{selectedProfile?.username}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {selectedProfile && blockedUsers.includes(selectedProfile.id) ? (
              <Button
                variant="outlined"
                color="primary"
                fullWidth
                onClick={handleUnblockUser}
                startIcon={<PersonAddIcon />}
              >
                Unblock User
              </Button>
            ) : (
              <Button
                variant="outlined"
                color="error"
                fullWidth
                onClick={handleBlockUser}
                startIcon={<BlockIcon />}
              >
                Block User
              </Button>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProfileDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Add Rule Dialog */}
      <Dialog
        open={showAddRuleDialog}
        onClose={() => setShowAddRuleDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            m: { xs: 1, md: 2 }, // Smaller margins on mobile
            maxHeight: { xs: '90vh', md: 'none' }
          }
        }}
      >
        <DialogTitle sx={{ 
          fontSize: { xs: '1.1rem', md: '1.25rem' },
          pb: { xs: 1, md: 2 }
        }}>
          Add New Rule
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, md: 3 } }}>
          <DialogContentText sx={{ 
            mb: 2, 
            fontSize: { xs: '0.875rem', md: '1rem' }
          }}>
            Add a new rule to help maintain a positive environment in your room.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Rule"
            fullWidth
            variant="outlined"
            multiline
            rows={isDesktop ? 3 : 2}
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            placeholder="Enter a clear and specific rule..."
            size={isDesktop ? "medium" : "small"}
          />
        </DialogContent>
        <DialogActions sx={{ 
          px: { xs: 2, md: 3 },
          pb: { xs: 2, md: 2 },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 0 }
        }}>
          <Button 
            onClick={() => {
              setShowAddRuleDialog(false);
              setNewRule('');
            }}
            size={isDesktop ? "medium" : "small"}
            sx={{ 
              order: { xs: 2, sm: 1 },
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleAddRule}
            variant="contained"
            disabled={!newRule.trim()}
            size={isDesktop ? "medium" : "small"}
            sx={{ 
              order: { xs: 1, sm: 2 },
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            Add Rule
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Rule Confirmation Dialog */}
      <Dialog
        open={showDeleteRuleDialog}
        onClose={() => setShowDeleteRuleDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            m: { xs: 1, md: 2 },
            maxHeight: { xs: '90vh', md: 'none' }
          }
        }}
      >
        <DialogTitle sx={{ 
          fontSize: { xs: '1.1rem', md: '1.25rem' },
          pb: { xs: 1, md: 2 }
        }}>
          Delete Rule?
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, md: 3 } }}>
          <DialogContentText sx={{ 
            fontSize: { xs: '0.875rem', md: '1rem' }
          }}>
            Are you sure you want to delete this rule? This action cannot be undone.
          </DialogContentText>
          {ruleToDelete !== null && roomRules[ruleToDelete] && (
            <Paper elevation={0} sx={{ 
              p: { xs: 1.5, md: 2 }, 
              mt: 2, 
              bgcolor: 'background.default' 
            }}>
              <Typography 
                variant="subtitle2" 
                sx={{ 
                  mb: 1, 
                  color: 'primary.main',
                  fontSize: { xs: '0.8rem', md: '0.875rem' }
                }}
              >
                Rule #{ruleToDelete + 1}
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontSize: { xs: '0.875rem', md: '1rem' }
                }}
              >
                {roomRules[ruleToDelete]}
              </Typography>
            </Paper>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          px: { xs: 2, md: 3 },
          pb: { xs: 2, md: 2 },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 0 }
        }}>
          <Button 
            onClick={() => {
              setShowDeleteRuleDialog(false);
              setRuleToDelete(null);
            }}
            size={isDesktop ? "medium" : "small"}
            sx={{ 
              order: { xs: 2, sm: 1 },
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteRule} 
            color="error" 
            variant="contained"
            size={isDesktop ? "medium" : "small"}
            sx={{ 
              order: { xs: 1, sm: 2 },
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            Delete Rule
          </Button>
        </DialogActions>
      </Dialog>

      {/* Blocked User Alert */}
      <Snackbar
        open={showBlockedUserAlert}
        autoHideDuration={6000}
        onClose={() => setShowBlockedUserAlert(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setShowBlockedUserAlert(false)} 
          severity="warning" 
          sx={{ width: '100%' }}
        >
          {blockedUserInRoom && (
            <>
              You have blocked {blockedUserInRoom.username}. You can unblock them from their profile.
            </>
          )}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default RoomChat; 