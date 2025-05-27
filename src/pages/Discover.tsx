import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Container,
  Alert,
  Tabs,
  Tab,
  Paper,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  Divider,
  CircularProgress,
  Chip,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Button,
  useTheme,
  useMediaQuery,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { 
  TrendingUp as TrendingIcon,
  Group as GroupIcon,
  Whatshot as WhatshotIcon,
  Search as SearchIcon,
  PersonAdd as PersonAddIcon,
  Message as MessageIcon,
  People as PeopleIcon,
  Public as PublicIcon,
  VerifiedUser as VerifiedUserIcon,
  EmojiEvents as TrophyIcon,
  VisibilityOutlined as EyeIcon,
  Close as CloseIcon,
  ViewStream as GridViewIcon,
  ViewDay as SwipeViewIcon
} from '@mui/icons-material';
import { useNavigate, Link } from 'react-router-dom';
import { 
  collection, 
  query as firestoreQuery, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  DocumentData, 
  Timestamp, 
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  addDoc,
  updateDoc,
  getDoc,
  DocumentSnapshot,
  onSnapshot,
  startAt,
  endAt
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { formatTimestamp } from '../utils/dateUtils';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Popper from '@mui/material/Popper';
import Peeks from '../components/Peeks';
import Slider from 'react-slick';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { 
  StreamVideo, 
  StreamCall, 
  useStreamVideoClient, 
  ParticipantsAudio,
  Call,
  StreamVideoClient,
  StreamVideoClientOptions,
  ParticipantsAudioProps,
  useCallStateHooks
} from '@stream-io/video-react-sdk';
import { User } from 'firebase/auth';
import debounce from 'lodash/debounce';

interface UserProfile {
  id: string;
  username: string;
  name: string;
  profilePic?: string;
  bio?: string;
  coverPhoto?: string;
  isPublic?: boolean;
  isAuthenticated?: boolean;
  createdAt: Timestamp;
  isActive?: boolean;
  isVerified?: boolean;
  email?: string;
  isTopHost?: boolean;
  totalViews?: number;
  activeRooms?: number;
}

interface Room {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  shareCount: number;
  isPrivate: boolean;
  createdAt: Date;
  creatorName: string;
  creatorId: string;
  creatorAvatar: string;
  tags: string[];
  lastActive: Date;
  maxMembers: number;
  activeUsers: number;
  isLive: boolean;
  thumbnailUrl?: string; // Add thumbnailUrl
  isPopular?: boolean;
}

interface FirestoreUser extends DocumentData {
  id: string;
  username: string;
  name: string;
  bio?: string;
  profilePic?: string;
  avatar?: string;
  email?: string;
  createdAt: Timestamp;
  isVerified?: boolean;
}

interface FirestoreRoom extends DocumentData {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: Timestamp;
  lastActive: Timestamp;
  tags?: string[];
  isPrivate: boolean;
  activeUsers: number;
  isLive: boolean;
  thumbnailUrl?: string; // Add thumbnailUrl
}

const Discover: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [isSearchView, setIsSearchView] = useState(false);
  const [dropdownUsers, setDropdownUsers] = useState<UserProfile[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showPeopleTab, setShowPeopleTab] = useState<boolean>(false);
  const [showJoinRoomChatDialog, setShowJoinRoomChatDialog] = useState<boolean>(false);
  const [serverChatRoom, setServerChatRoom] = useState<{id: string, name: string} | null>(null);
  const [ownerData, setOwnerData] = useState<{username?: string} | null>(null);
  const [topHosts, setTopHosts] = useState<UserProfile[]>([]);
  const [filteredTopHosts, setFilteredTopHosts] = useState<UserProfile[]>([]);
  const [topHostSearchQuery, setTopHostSearchQuery] = useState('');
  const [selectedTopHostCategory, setSelectedTopHostCategory] = useState<string>('All');
  const [isSearchingTopHosts, setIsSearchingTopHosts] = useState(false);
  const [popularRooms, setPopularRooms] = useState<Room[]>([]);
  const [filteredPopularRooms, setFilteredPopularRooms] = useState<Room[]>([]);
  const [popularRoomSearchQuery, setPopularRoomSearchQuery] = useState('');
  const [selectedPopularRoomCategory, setSelectedPopularRoomCategory] = useState<string>('All');
  const [isSearchingPopularRooms, setIsSearchingPopularRooms] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isSwipeViewActive, setIsSwipeViewActive] = useState(false);
  const [currentRoomIndex, setCurrentRoomIndex] = useState(0);
  const [showListenPrompt, setShowListenPrompt] = useState(false);
  const [listeningRoom, setListeningRoom] = useState<Room | null>(null);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [streamToken, setStreamToken] = useState<string | null>(null);
  const [activeStreamCallInstance, setActiveStreamCallInstance] = useState<Call | null>(null);
  const [isJoiningCall, setIsJoiningCall] = useState(false);
  // Add state for Stream client
  const [streamClient, setStreamClient] = useState<StreamVideoClient | null>(null);
  // Add connection state tracking
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const MAX_RECONNECT_ATTEMPTS = 3;
  const RECONNECT_DELAY = 2000; // 2 seconds

  const categories = [
    'ASMR',
    'Just Chatting',
    'Music',
    'Gossip',
    'Podcasts',
    'Shows',
    'Social',
    'Other'
  ];

  const LISTEN_PROMPT_DELAY = 60000; // 1 minute in milliseconds

  const fetchDefaultUsers = async () => {
    try {
      const usersRef = collection(db, 'users');
      
      // Simply fetch all users with limit
      const q = firestoreQuery(
        usersRef,
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      
      const querySnapshot = await getDocs(q);
      const usersData = querySnapshot.docs
        // Filter out system/auto-responder accounts
        .filter(doc => doc.id !== 'sideeye' && doc.id !== 'contact-team')
        .map(doc => ({
          id: doc.id,
          username: doc.data().username || '',
          name: doc.data().name || '',
          profilePic: doc.data().profilePic,
          bio: doc.data().bio,
          coverPhoto: doc.data().coverPhoto,
          isPublic: doc.data().isPublic,
          isAuthenticated: doc.data().isAuthenticated,
          createdAt: doc.data().createdAt,
          isActive: doc.data().isActive,
          isVerified: true, // Set all users as verified
          email: doc.data().email
        })) as UserProfile[];
      
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBlockedAndBlockingUsers = async (): Promise<string[]> => {
    // Get the current user from the auth context
    if (!currentUser || !db) return [];
    
    try {
      // Get users who have blocked the current user
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      const blockedByUsers: string[] = [];
      
      usersSnapshot.forEach(userDoc => {
        const userData = userDoc.data();
        if (userData.blockedUsers && 
            Array.isArray(userData.blockedUsers) && 
            userData.blockedUsers.includes(currentUser.uid)) {
          blockedByUsers.push(userDoc.id);
        }
      });
      
      // Get current user's blocked users
      const blockedUsers = currentUser.blockedUsers || [];
      
      // Return combined list
      return [...blockedUsers, ...blockedByUsers];
    } catch (error) {
      console.error('Error fetching blocked users:', error);
      return [];
    }
  };

  const fetchRooms = async () => {
    try {
      setLoading(true);
      if (!db) return;
      
      // Get list of users to hide content from
      const usersToHide = await getBlockedAndBlockingUsers();

      const roomsRef = collection(db, 'sideRooms');
      const q = firestoreQuery(
        roomsRef,
        where('deleted', '!=', true)
      );
      const querySnapshot = await getDocs(q);

      const roomsData = querySnapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data
          } as FirestoreRoom;
        });
      
      // Filter out rooms from blocked users
      const filteredRooms = roomsData.filter(room => 
        !usersToHide.includes(room.ownerId)
      );

      // Process the filtered rooms
      const roomsWithOwnerData = await Promise.all(
        filteredRooms.map(async room => {
          try {
            const ownerDoc = await getDoc(doc(db, 'users', room.ownerId));
            const ownerData = ownerDoc.exists() ? ownerDoc.data() : null;

            return {
              id: room.id,
              name: room.name || '',
              description: room.description || '',
              memberCount: room.memberCount || 0,
              shareCount: 0,
              isPrivate: room.isPrivate || false,
              createdAt: room.createdAt?.toDate() || new Date(),
              creatorName: ownerData?.username || 'Unknown',
              creatorId: room.ownerId,
              creatorAvatar: ownerData?.profilePic || '',
              tags: room.tags || [],
              lastActive: room.lastActive?.toDate() || new Date(),
              maxMembers: room.maxMembers || 100,
              activeUsers: room.activeUsers || 0,
              isLive: room.isLive || false,
              thumbnailUrl: room.thumbnailUrl || '',
              isPopular: (room.activeUsers || 0) >= 200
            } as Room;
          } catch (error) {
            console.error(`Error fetching owner data for room ${room.id}:`, error);
            return null;
          }
        })
      );

      // Filter out any null rooms from failed owner fetches and sort by popularity
      const validRooms = roomsWithOwnerData
        .filter((room): room is Room => room !== null)
        .sort((a, b) => {
          // First sort by popularity
          if (a.isPopular && !b.isPopular) return -1;
          if (!a.isPopular && b.isPopular) return 1;
          // Then sort by active users
          return (b.activeUsers || 0) - (a.activeUsers || 0);
        });

      // Group rooms by category
      const roomsByCategory = categories.reduce((acc, category) => {
        acc[category] = validRooms.filter(room => room.tags?.includes(category));
        return acc;
      }, {} as { [key: string]: Room[] });

      // Add "All" category
      roomsByCategory['All'] = validRooms;

      setRooms(validRooms);
      
      // Log category counts for debugging
      Object.entries(roomsByCategory).forEach(([category, rooms]) => {
        console.log(`Category ${category}: ${rooms.length} rooms`);
      });

    } catch (error) {
      console.error('Error fetching rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  // Add new function to fetch top hosts
  const fetchTopHosts = async () => {
    try {
      const roomsRef = collection(db, 'sideRooms');
      const roomsSnapshot = await getDocs(roomsRef);
      
      // Create a map to track host stats
      const hostStats = new Map<string, { totalViews: number, activeRooms: number }>();
      
      // Process all rooms to get host statistics
      roomsSnapshot.docs.forEach(doc => {
        const roomData = doc.data();
        const ownerId = roomData.ownerId;
        const views = roomData.activeUsers || 0;
        
        if (hostStats.has(ownerId)) {
          const stats = hostStats.get(ownerId)!;
          stats.totalViews += views;
          stats.activeRooms += 1;
        } else {
          hostStats.set(ownerId, { totalViews: views, activeRooms: 1 });
        }
      });
      
      // Filter hosts with 200+ views
      const topHostIds = Array.from(hostStats.entries())
        .filter(([_, stats]) => stats.totalViews >= 200)
        .map(([id]) => id);
      
      // Fetch user data for top hosts
      const topHostsData = await Promise.all(
        topHostIds.map(async (hostId) => {
          const userRef = doc(db, 'users', hostId);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const stats = hostStats.get(hostId)!;
            
            return {
              id: hostId,
              username: userData.username || '',
              name: userData.name || '',
              profilePic: userData.profilePic,
              bio: userData.bio,
              isPublic: userData.isPublic ?? true,
              isAuthenticated: userData.isAuthenticated,
              createdAt: userData.createdAt,
              isActive: userData.isActive,
              isVerified: true,
              isTopHost: true,
              totalViews: stats.totalViews,
              activeRooms: stats.activeRooms
            } as UserProfile;
          }
          return null;
        })
      );
      
      setTopHosts(topHostsData.filter(Boolean) as UserProfile[]);
    } catch (error) {
      console.error('Error fetching top hosts:', error);
    }
  };

  // Add new function to fetch popular rooms
  const fetchPopularRooms = async () => {
    try {
      const roomsRef = collection(db, 'sideRooms');
      const q = firestoreQuery(
        roomsRef,
        where('deleted', '!=', true)
      );
      const querySnapshot = await getDocs(q);

      const roomsData = querySnapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data
          } as FirestoreRoom;
        })
        .filter(room => (room.activeUsers || 0) >= 200);

      // Process the filtered rooms
      const roomsWithOwnerData = await Promise.all(
        roomsData.map(async room => {
          try {
            const ownerDoc = await getDoc(doc(db, 'users', room.ownerId));
            const ownerData = ownerDoc.exists() ? ownerDoc.data() : null;

            return {
              id: room.id,
              name: room.name || '',
              description: room.description || '',
              memberCount: room.memberCount || 0,
              shareCount: 0,
              isPrivate: room.isPrivate || false,
              createdAt: room.createdAt?.toDate() || new Date(),
              creatorName: ownerData?.username || 'Unknown',
              creatorId: room.ownerId,
              creatorAvatar: ownerData?.profilePic || '',
              tags: room.tags || [],
              lastActive: room.lastActive?.toDate() || new Date(),
              maxMembers: room.maxMembers || 100,
              activeUsers: room.activeUsers || 0,
              isLive: room.isLive || false,
              thumbnailUrl: room.thumbnailUrl || '',
              isPopular: true
            } as Room;
          } catch (error) {
            console.error(`Error fetching owner data for room ${room.id}:`, error);
            return null;
          }
        })
      );

      const validRooms = roomsWithOwnerData.filter(room => room !== null) as Room[];
      setPopularRooms(validRooms);
      setFilteredPopularRooms(validRooms);
    } catch (error) {
      console.error('Error fetching popular rooms:', error);
    }
  };

  // Update useEffect to include fetchTopHosts and fetchPopularRooms
  useEffect(() => {
    fetchDefaultUsers();
    fetchRooms();
    fetchTopHosts();
    fetchPopularRooms();
    
    // Update following status and pending requests
    const updateFollowStatus = async () => {
      if (currentUser) {
        await fetchFollowing();
        await fetchPendingRequests();
      }
    };
    
    updateFollowStatus();
    
    // Set up a focus event listener to refresh follow status when returning to this page
    const handleFocus = () => {
      updateFollowStatus();
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentUser]);
  
  // Update pending requests whenever following state changes
  useEffect(() => {
    if (currentUser && following.size > 0) {
      fetchPendingRequests();
    }
  }, [following]);

  const fetchFollowing = async () => {
    if (!currentUser || !db) return;
    try {
      // First, check "following" collection to find users we're following
      const followingQuery = firestoreQuery(
        collection(db, `users/${currentUser.uid}/following`)
      );
      const snapshot = await getDocs(followingQuery);
      const followingIds = new Set(snapshot.docs.map(doc => doc.id));
      
      // Also check "followers" collections of all users to ensure we don't miss any
      // This handles cases where DB might be inconsistent between collections
      const usersQuery = firestoreQuery(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      
      // Check each user's followers collection for our ID
      await Promise.all(usersSnapshot.docs.map(async (userDoc) => {
        if (followingIds.has(userDoc.id)) return; // Skip if already known to be following
        
        const followerRef = doc(db, `users/${userDoc.id}/followers/${currentUser.uid}`);
        const followerDoc = await getDoc(followerRef);
        
        if (followerDoc.exists()) {
          followingIds.add(userDoc.id);
          
          // Fix inconsistency by adding to our following collection if missing
          const followingRef = doc(db, `users/${currentUser.uid}/following/${userDoc.id}`);
          const followingDoc = await getDoc(followingRef);
          
          if (!followingDoc.exists()) {
            await setDoc(followingRef, { timestamp: serverTimestamp() });
            console.log(`Fixed inconsistent follow status for user ${userDoc.id}`);
          }
        }
      }));
      
      setFollowing(followingIds);
    } catch (error) {
      console.error('Error fetching following:', error);
    }
  };

  // Improved function to fetch pending follow requests
  const fetchPendingRequests = async () => {
    if (!currentUser || !db) return;
    try {
      const pendingIds = new Set<string>();
      
      // Only check private accounts that we're not already following
      const privateUsersQuery = firestoreQuery(
        collection(db, 'users'),
        where('isPrivate', '==', true)
      );
      
      const privateUsersSnapshot = await getDocs(privateUsersQuery);
      
      // For each private account, check if we have a pending request
      await Promise.all(privateUsersSnapshot.docs.map(async (userDoc) => {
        // Skip if we're already following
        if (following.has(userDoc.id)) return;
        
        const requestRef = doc(db, `users/${userDoc.id}/followRequests/${currentUser.uid}`);
        const requestSnapshot = await getDoc(requestRef);
        
        if (requestSnapshot.exists()) {
          pendingIds.add(userDoc.id);
        }
      }));
      
      // Also check legacy private accounts (using isPublic:false instead of isPrivate:true)
      const legacyPrivateUsersQuery = firestoreQuery(
        collection(db, 'users'),
        where('isPublic', '==', false)
      );
      
      const legacyPrivateUsersSnapshot = await getDocs(legacyPrivateUsersQuery);
      
      await Promise.all(legacyPrivateUsersSnapshot.docs.map(async (userDoc) => {
        // Skip if we're already following or already checked
        if (following.has(userDoc.id) || pendingIds.has(userDoc.id)) return;
        
        const requestRef = doc(db, `users/${userDoc.id}/followRequests/${currentUser.uid}`);
        const requestSnapshot = await getDoc(requestRef);
        
        if (requestSnapshot.exists()) {
          pendingIds.add(userDoc.id);
        }
      }));
      
      setPendingRequests(pendingIds);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    }
  };

  const checkIfPrivateAccount = async (userId: string): Promise<boolean> => {
    if (!db) return false;
    
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Check both isPrivate (newer field) and !isPublic (older field) for compatibility
        return userData.isPrivate === true || userData.isPublic === false;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking if account is private:', error);
      return false;
    }
  };

  // Check if room owner has a server chat room
  const checkForServerChatRoom = async (ownerId: string) => {
    if (!db || !ownerId) return null;
    
    try {
      // Query for public rooms created by the owner
      const roomsRef = collection(db, 'rooms');
      const q = firestoreQuery(
        roomsRef,
        where('createdBy', '==', ownerId),
        where('type', '==', 'public')
      );
      
      const roomsSnapshot = await getDocs(q);
      if (!roomsSnapshot.empty) {
        // Owner has at least one server chat room
        const roomDoc = roomsSnapshot.docs[0]; // Take the first one
        
        // Get owner data for the dialog
        const ownerRef = doc(db, 'users', ownerId);
        const ownerDoc = await getDoc(ownerRef);
        if (ownerDoc.exists()) {
          setOwnerData({
            username: ownerDoc.data().username || ownerDoc.data().name
          });
        }
        
        return {
          id: roomDoc.id,
          name: roomDoc.data().name || 'Chat Room'
        };
      }
      return null;
    } catch (error) {
      console.error('[Discover] Error checking for server chat room:', error);
      return null;
    }
  };

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
  };

  const handleFollow = async (userId: string) => {
    if (!currentUser || userId === currentUser.uid) return;
    
    try {
      const followingRef = doc(db, `users/${currentUser.uid}/following`, userId);
      const followerRef = doc(db, `users/${userId}/followers`, currentUser.uid);
      
      if (following.has(userId)) {
        // Unfollow
        await deleteDoc(followingRef);
        await deleteDoc(followerRef);
        setFollowing(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
        toast.success('Unfollowed user');
      } else {
        // Check if the target account is private
        const isPrivate = await checkIfPrivateAccount(userId);
        
        if (isPrivate) {
          // Send follow request instead of direct follow
          const requestRef = doc(db, 'users', userId, 'followRequests', currentUser.uid);
          await setDoc(requestRef, {
            userId: currentUser.uid,
            username: currentUser.displayName || currentUser.email?.split('@')[0] || `User_${currentUser.uid.substring(0, 5)}`,
            timestamp: serverTimestamp()
          });
          // Update pending requests state
          setPendingRequests(prev => new Set(prev).add(userId));
          toast.success('Follow request sent');
          
          // We don't check for server chat room here since it's just a request
        } else {
          // Direct follow for public accounts
          await setDoc(followingRef, {
            timestamp: serverTimestamp()
          });
          await setDoc(followerRef, {
            timestamp: serverTimestamp()
          });
          setFollowing(prev => new Set(prev).add(userId));

          // Create notification for followed user
          const notificationData = {
            type: 'follow',
            senderId: currentUser.uid,
            senderName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Someone',
            senderAvatar: currentUser.photoURL || '',
            recipientId: userId,
            content: `${currentUser.displayName || currentUser.email?.split('@')[0] || 'Someone'} started following you`,
            createdAt: serverTimestamp(),
            isRead: false
          };
          await addDoc(collection(db, 'notifications'), notificationData);

          // Check if the user has a server chat room
          const chatRoom = await checkForServerChatRoom(userId);
          if (chatRoom) {
            setServerChatRoom(chatRoom);
            setShowJoinRoomChatDialog(true);
          }

          toast.success('Followed user');
        }
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast.error('Failed to update follow status');
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleUserClick = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  const handleRoomClick = (roomId: string) => {
    navigate(`/side-room/${roomId}`);
  };

  const handleSearch = async (query: string, isSubmit: boolean = false) => {
    setSearchQuery(query);
    
    if (query.trim() === '') {
      setUsers([]);
      setRooms([]);
      setIsSearchView(false);
      return;
    }

    try {
      setLoading(true);
      setIsSearchView(true);

      // Get a list of blocked users and users who have blocked the current user
      const blockedUsers = currentUser?.blockedUsers || [];
      const blockedByUsers: string[] = [];
      
      if (currentUser && db) {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        usersSnapshot.forEach(doc => {
          const userData = doc.data();
          if (userData.blockedUsers && 
              Array.isArray(userData.blockedUsers) && 
              userData.blockedUsers.includes(currentUser.uid)) {
            blockedByUsers.push(doc.id);
          }
        });
      }
      
      // Combine both lists of users to exclude
      const excludeUserIds = [...blockedUsers, ...blockedByUsers];

      // Initialize arrays to collect search results
      let usersResults: UserProfile[] = [];
      
      // Search users by username (case insensitive)
      const usersRef = collection(db, 'users');
      const lowerQuery = query.toLowerCase();
      
      // 1. Try searching by username_lower if it exists
      try {
        const usernameQuery = firestoreQuery(
          usersRef,
          orderBy('username_lower'),
          startAt(lowerQuery),
          endAt(lowerQuery + '\uf8ff'),
          limit(20)
        );
        
        const usernameSnapshot = await getDocs(usernameQuery);
        usersResults = usernameSnapshot.docs
          .map(doc => ({
            id: doc.id,
            username: doc.data().username || '',
            name: doc.data().name || '',
            bio: doc.data().bio || '',
            profilePic: doc.data().profilePic || '',
            isPublic: doc.data().isPublic ?? true,
            isAuthenticated: doc.data().isAuthenticated,
            createdAt: doc.data().createdAt,
            isActive: doc.data().isActive,
            isVerified: true,
            email: doc.data().email
          }))
          .filter(user => !excludeUserIds.includes(user.id) && user.id !== 'sideeye' && user.id !== 'contact-team');
      } catch (error) {
        console.error('Error searching by username_lower:', error);
      }
      
      // 2. If we didn't get enough results or username_lower doesn't exist, try name_lower
      if (usersResults.length < 10) {
        try {
          const nameQuery = firestoreQuery(
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
              username: doc.data().username || '',
              name: doc.data().name || '',
              bio: doc.data().bio || '',
              profilePic: doc.data().profilePic || '',
              isPublic: doc.data().isPublic ?? true,
              isAuthenticated: doc.data().isAuthenticated,
              createdAt: doc.data().createdAt,
              isActive: doc.data().isActive,
              isVerified: true,
              email: doc.data().email
            }))
            .filter(user => 
              !excludeUserIds.includes(user.id) && 
              user.id !== 'sideeye' && 
              user.id !== 'contact-team' &&
              !usersResults.some(existingUser => existingUser.id === user.id)
            );
          
          // Combine results (avoiding duplicates)
          usersResults = [...usersResults, ...nameResults];
        } catch (error) {
          console.error('Error searching by name_lower:', error);
        }
      }
      
      // 3. Fallback to a simple 'get all and filter' approach if needed
      if (usersResults.length === 0) {
        console.log('Falling back to simple search approach');
        const allUsersQuery = firestoreQuery(
          usersRef,
          limit(50)
        );
        
        const allUsersSnapshot = await getDocs(allUsersQuery);
        usersResults = allUsersSnapshot.docs
          .map(doc => ({
            id: doc.id,
            username: doc.data().username || '',
            name: doc.data().name || '',
            bio: doc.data().bio || '',
            profilePic: doc.data().profilePic || '',
            isPublic: doc.data().isPublic ?? true,
            isAuthenticated: doc.data().isAuthenticated,
            createdAt: doc.data().createdAt,
            isActive: doc.data().isActive,
            isVerified: true,
            email: doc.data().email
          }))
          .filter(user => 
            !excludeUserIds.includes(user.id) && 
            user.id !== 'sideeye' && 
            user.id !== 'contact-team' &&
            (
              user.username.toLowerCase().includes(lowerQuery) ||
              user.name.toLowerCase().includes(lowerQuery)
            )
          );
      }

      // Search rooms with a more comprehensive approach
      const roomsRef = collection(db, 'sideRooms');
      let roomsResults: FirestoreRoom[] = [];
      
      // Try different search approaches for rooms
      try {
        // 1. Try exact name search first
        const exactRoomsQuery = firestoreQuery(
          roomsRef,
          where('name', '>=', query),
          where('name', '<=', query + '\uf8ff'),
          limit(20)
        );
        
        const exactRoomsSnapshot = await getDocs(exactRoomsQuery);
        roomsResults = exactRoomsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as FirestoreRoom));
        
        // 2. If not enough results, try a more general approach
        if (roomsResults.length < 5) {
          // Get rooms and filter client-side (not ideal but works as a fallback)
          const generalRoomsQuery = firestoreQuery(
            roomsRef,
            where('deleted', '!=', true),
            limit(50)
          );
          
          const generalRoomsSnapshot = await getDocs(generalRoomsQuery);
          const additionalRooms = generalRoomsSnapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            } as FirestoreRoom))
            .filter(room => 
              !roomsResults.some(existingRoom => existingRoom.id === room.id) &&
              (
                room.name.toLowerCase().includes(lowerQuery) ||
                (room.description && room.description.toLowerCase().includes(lowerQuery)) ||
                (room.tags && room.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
              )
            );
          
          roomsResults = [...roomsResults, ...additionalRooms];
        }
      } catch (error) {
        console.error('Error searching rooms:', error);
      }
      
      // Filter rooms by blocked users
      roomsResults = roomsResults.filter(room => room.ownerId && !excludeUserIds.includes(room.ownerId));
      
      // Process room results to include owner data
      const roomsData = await Promise.all(
        roomsResults.map(async (room) => {
          try {
            const ownerDoc = await getDoc(doc(db, 'users', room.ownerId));
            const ownerData = ownerDoc.exists() ? ownerDoc.data() : null;

            return {
              id: room.id,
              name: room.name,
              description: room.description,
              memberCount: room.memberCount || 0,
              shareCount: 0,
              isPrivate: room.isPrivate || false,
              createdAt: room.createdAt?.toDate() || new Date(),
              creatorName: ownerData?.username || 'Unknown',
              creatorId: room.ownerId,
              creatorAvatar: ownerData?.profilePic || '',
              tags: room.tags || [],
              lastActive: room.lastActive?.toDate() || new Date(),
              maxMembers: room.maxMembers || 100,
              activeUsers: room.activeUsers || 0,
              isLive: room.isLive || false,
              thumbnailUrl: room.thumbnailUrl || ''
            } as Room;
          } catch (error) {
            console.error(`Error fetching owner data for room ${room.id}:`, error);
            return {
              id: room.id,
              name: room.name,
              description: room.description,
              memberCount: room.memberCount || 0,
              shareCount: 0,
              isPrivate: room.isPrivate || false,
              createdAt: room.createdAt?.toDate() || new Date(),
              creatorName: 'Unknown',
              creatorId: room.ownerId,
              creatorAvatar: '',
              tags: room.tags || [],
              lastActive: room.lastActive?.toDate() || new Date(),
              maxMembers: room.maxMembers || 100,
              activeUsers: room.activeUsers || 0,
              isLive: room.isLive || false,
              thumbnailUrl: room.thumbnailUrl || ''
            } as Room;
          }
        })
      );

      setUsers(usersResults);
      setRooms(roomsData);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch(searchQuery, true);
      setShowDropdown(false);
    }
  };

  const handleInstantSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (query.length < 1) {
      setDropdownUsers([]);
      setShowDropdown(false);
      return;
    }

    try {
      const searchTerm = query.toLowerCase();
      const usersRef = collection(db, 'users');
      
      const mapDocToUser = (doc: DocumentSnapshot<DocumentData>): UserProfile => ({
        id: doc.id,
        username: doc.data()?.username || '',
        name: doc.data()?.name || '',
        bio: doc.data()?.bio,
        profilePic: doc.data()?.profilePic,
        isPublic: doc.data()?.isPublic ?? true,
        isAuthenticated: doc.data()?.isAuthenticated,
        createdAt: doc.data()?.createdAt,
        isActive: doc.data()?.isActive,
        isVerified: true, // Set all users as verified
        email: doc.data()?.email
      });

      let usersData: UserProfile[] = [];
      
      // Try different search approaches one by one
      try {
        // 1. First try username_lower
        const usersQuery = firestoreQuery(
          usersRef,
          orderBy('username_lower'),
          startAt(searchTerm),
          endAt(searchTerm + '\uf8ff'),
          limit(10)
        );
        
        const usersSnapshot = await getDocs(usersQuery);
        usersData = usersSnapshot.docs
          .filter(doc => doc.id !== 'sideeye' && doc.id !== 'contact-team')
          .map(mapDocToUser);
      } catch (error) {
        console.log('Error searching by username_lower:', error);
      }
      
      // 2. If not enough results, try name_lower
      if (usersData.length < 5) {
        try {
          const nameQuery = firestoreQuery(
            usersRef,
            orderBy('name_lower'),
            startAt(searchTerm),
            endAt(searchTerm + '\uf8ff'),
            limit(10)
          );
          
          const nameSnapshot = await getDocs(nameQuery);
          const nameResults = nameSnapshot.docs
            .filter(doc => 
              doc.id !== 'sideeye' && 
              doc.id !== 'contact-team' &&
              !usersData.some(u => u.id === doc.id)
            )
            .map(mapDocToUser);
          
          usersData = [...usersData, ...nameResults];
        } catch (error) {
          console.log('Error searching by name_lower:', error);
        }
      }
      
      // 3. If still not enough, fallback to a comprehensive search
      if (usersData.length < 3) {
        const fallbackQuery = firestoreQuery(
          usersRef,
          limit(25) // Get a decent sample to filter from
        );
        
        try {
          const fallbackSnapshot = await getDocs(fallbackQuery);
          const fallbackResults = fallbackSnapshot.docs
            .filter(doc => 
              doc.id !== 'sideeye' && 
              doc.id !== 'contact-team' &&
              !usersData.some(u => u.id === doc.id) &&
              (
                (doc.data()?.username || '').toLowerCase().includes(searchTerm) ||
                (doc.data()?.name || '').toLowerCase().includes(searchTerm)
              )
            )
            .map(mapDocToUser);
          
          usersData = [...usersData, ...fallbackResults];
        } catch (error) {
          console.log('Error with fallback search:', error);
        }
      }
      
      // Filter for blocked users if needed
      if (currentUser?.blockedUsers) {
        usersData = usersData.filter(user => !currentUser.blockedUsers?.includes(user.id));
      }
      
      setDropdownUsers(usersData.slice(0, 5));
      setShowDropdown(usersData.length > 0);
    } catch (error) {
      console.error('Instant search error:', error);
    }
  };

  const handleClickAway = () => {
    setShowDropdown(false);
    if (!searchQuery.trim()) {
      setIsSearchExpanded(false);
    }
  };

  const handleCategoryChange = (event: React.SyntheticEvent, newValue: string) => {
    setSelectedCategory(newValue);
    // When changing category, ensure we are not in search view
    if (isSearchView) {
        setIsSearchView(false);
        // Optionally refetch default rooms or rely on existing data
        // fetchRooms(); // Uncomment if you want to refetch when category changes from search view
    }
  };

  const handleMainTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    // When changing to the People tab, ensure we fetch users if they haven't been loaded
    if (newValue === 1 && users.length === 0) {
      fetchDefaultUsers();
    }
  };

  // Effect to listen for follow request acceptance for private profiles
  useEffect(() => {
    if (!currentUser?.uid || !db) return;
    
    // Set up a listener for the user's following collection
    const userFollowingsRef = collection(db, "users", currentUser.uid, "following");
    const unsubscribe = onSnapshot(userFollowingsRef, async (snapshot) => {
      // When a new follow relationship is established (request accepted)
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const targetUserId = change.doc.id;
          
          // Check if this was a follow request (private account)
          // by checking if it was in the pendingRequests set
          if (pendingRequests.has(targetUserId)) {
            // Check if the user has a server chat room
            const chatRoom = await checkForServerChatRoom(targetUserId);
            if (chatRoom) {
              setServerChatRoom(chatRoom);
              setShowJoinRoomChatDialog(true);
              
              // Remove from pending requests
              setPendingRequests(prev => {
                const newSet = new Set(prev);
                newSet.delete(targetUserId);
                return newSet;
              });
            }
          }
        }
      });
    });
    
    return () => unsubscribe();
  }, [currentUser?.uid, db, pendingRequests]);

  // Add new function to search top hosts
  const searchTopHosts = async (query: string) => {
    if (!query.trim()) {
      setFilteredTopHosts(topHosts);
      return;
    }

    setIsSearchingTopHosts(true);
    try {
      const searchTerm = query.toLowerCase();
      const usersRef = collection(db, 'users');
      
      // Search by username or name
      const q = firestoreQuery(
        usersRef,
        where('username_lower', '>=', searchTerm),
        where('username_lower', '<=', searchTerm + '\uf8ff'),
        limit(20)
      );
      
      const querySnapshot = await getDocs(q);
      const searchResults = querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(user => topHosts.some(host => host.id === user.id));

      setFilteredTopHosts(searchResults as UserProfile[]);
    } catch (error) {
      console.error('Error searching top hosts:', error);
      setFilteredTopHosts([]);
    } finally {
      setIsSearchingTopHosts(false);
    }
  };

  // Add function to filter top hosts by category
  const filterTopHostsByCategory = (category: string) => {
    setSelectedTopHostCategory(category);
    
    if (category === 'All') {
      setFilteredTopHosts(topHosts);
      return;
    }

    const filtered = topHosts.filter(host => {
      // Get the host's rooms and check if any match the category
      const hostRooms = rooms.filter(room => room.creatorId === host.id);
      return hostRooms.some(room => room.tags?.includes(category));
    });

    setFilteredTopHosts(filtered);
  };

  // Update useEffect to initialize filteredTopHosts
  useEffect(() => {
    setFilteredTopHosts(topHosts);
  }, [topHosts]);

  // Add function to search popular rooms
  const searchPopularRooms = async (query: string) => {
    if (!query.trim()) {
      setFilteredPopularRooms(popularRooms);
      return;
    }

    setIsSearchingPopularRooms(true);
    try {
      const searchTerm = query.toLowerCase();
      const filtered = popularRooms.filter(room => 
        room.name.toLowerCase().includes(searchTerm) ||
        room.description.toLowerCase().includes(searchTerm) ||
        room.creatorName.toLowerCase().includes(searchTerm)
      );
      setFilteredPopularRooms(filtered);
    } catch (error) {
      console.error('Error searching popular rooms:', error);
      setFilteredPopularRooms([]);
    } finally {
      setIsSearchingPopularRooms(false);
    }
  };

  // Add function to filter popular rooms by category
  const filterPopularRoomsByCategory = (category: string) => {
    setSelectedPopularRoomCategory(category);
    
    if (category === 'All') {
      setFilteredPopularRooms(popularRooms);
      return;
    }

    const filtered = popularRooms.filter(room => 
      room.tags?.includes(category)
    );

    setFilteredPopularRooms(filtered);
  };

  const handleViewToggle = () => {
    setIsSwipeViewActive(!isSwipeViewActive);
    // Reset room index when toggling view
    setCurrentRoomIndex(0);
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Add cleanup effect
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Add room timer effect
  useEffect(() => {
    if (isSwipeViewActive && rooms.length > 0) {
      // Start timer for current room
      timerRef.current = setTimeout(() => {
        setShowListenPrompt(true);
        setListeningRoom(rooms[currentRoomIndex]);
      }, LISTEN_PROMPT_DELAY);
    }
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentRoomIndex, isSwipeViewActive, rooms]);

  // Add after the fetchRooms function
  useEffect(() => {
    console.log('Current rooms:', rooms);
    console.log('Current index:', currentRoomIndex);
    console.log('Is swipe view active:', isSwipeViewActive);
  }, [rooms, currentRoomIndex, isSwipeViewActive]);

  // Update Stream client initialization
  useEffect(() => {
    if (!currentUser || !process.env.REACT_APP_STREAM_API_KEY) return;

    const initStreamClient = async (user: User) => {
      try {
        if (isConnecting) {
          console.log('Already attempting to initialize Stream client...');
          return;
        }

        setIsConnecting(true);

        // Get stream token from the backend
        const backendUrl = 'https://sideeye-backend-production.up.railway.app';
        const tokenResponse = await fetch(`${backendUrl}/api/stream-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: user.uid,
            displayName: user.displayName || 'Anonymous',
            photoURL: user.photoURL || ''
          })
        });
        
        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json().catch(() => ({}));
          console.error('Stream token fetch failed:', {
            status: tokenResponse.status,
            statusText: tokenResponse.statusText,
            error: errorData
          });
          throw new Error(`Failed to get stream token: ${tokenResponse.statusText}`);
        }
        
        const { token } = await tokenResponse.json();
        if (!token) {
          throw new Error('Stream token not found in response');
        }
        
        setStreamToken(token);
        
        if (!process.env.REACT_APP_STREAM_API_KEY) {
          throw new Error('Stream API key is not defined');
        }
        
        // Initialize Stream client with proper typing
        const options: StreamVideoClientOptions = {
          apiKey: process.env.REACT_APP_STREAM_API_KEY,
          token,
          user: {
            id: user.uid,
            name: user.displayName || 'Anonymous',
            image: user.photoURL || ''
          }
        };
        
        if (streamClient) {
          await streamClient.disconnectUser();
        }
        
        const streamClientInstance = new StreamVideoClient(options);
        setStreamClient(streamClientInstance);
        setConnectionAttempts(0);
      } catch (error) {
        console.error('Error initializing Stream client:', error);
        toast.error('Failed to initialize audio service. Please try again later.');
        setConnectionAttempts(prev => prev + 1);
      } finally {
        setIsConnecting(false);
      }
    };

    initStreamClient(currentUser);

    // Cleanup
    return () => {
      if (streamClient) {
        streamClient.disconnectUser();
        setStreamClient(null);
      }
      setConnectionAttempts(0);
    };
  }, [currentUser]);

  // Update joinAudioStream function
  const joinAudioStream = async (roomId: string) => {
    if (!currentUser || !streamClient) {
      toast.error('Audio service not initialized');
      return;
    }

    if (isConnecting) {
      console.log('Already attempting to connect...');
      return;
    }

    if (connectionAttempts >= MAX_RECONNECT_ATTEMPTS) {
      toast.error('Too many connection attempts. Please try again later.');
      setConnectionAttempts(0);
      return;
    }

    setIsConnecting(true);
    setIsJoiningCall(true);

    try {
      // Join the call with proper error handling
      const call = streamClient.call('default', roomId);
      await call.join({ create: false, ring: false });
      
      setActiveStreamCallInstance(call);
      setConnectionAttempts(0);
      toast.success('Connected to room audio');
    } catch (error: any) {
      console.error('Error joining audio stream:', error);
      
      if (error?.code === 9 || error?.StatusCode === 429) {
        toast.error('Too many connection attempts. Please wait a moment before trying again.');
        setConnectionAttempts(prev => prev + 1);
      } else {
        toast.error('Failed to join audio stream');
      }
    } finally {
      setIsConnecting(false);
      setIsJoiningCall(false);
    }
  };

  // Create a debounced version of joinAudioStream
  const debouncedJoinAudioStream = debounce(joinAudioStream, 1000, {
    leading: true,
    trailing: false
  });

  // Add cleanup for debounced function
  useEffect(() => {
    return () => {
      debouncedJoinAudioStream.cancel();
    };
  }, []);

  // Add function to leave audio stream
  const leaveAudioStream = async () => {
    if (activeStreamCallInstance) {
      try {
        await activeStreamCallInstance.leave();
      } catch (error) {
        console.error('Error leaving audio stream:', error);
      }
      setActiveStreamCallInstance(null);
    }
  };

  if (loading && !isSearchView) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      position: 'relative',
      backgroundColor: theme.palette.background.default,
      '& @keyframes pulse': {
        '0%': {
          opacity: 1,
        },
        '50%': {
          opacity: 0.7,
        },
        '100%': {
          opacity: 1,
        }
      }
    }}>
      {/* Header and Search Section */}
      <Box sx={{
        position: 'sticky',
        top: 0,
        backgroundColor: theme.palette.background.default,
        zIndex: 1000,
        pt: 0.5,
        pb: 0.5,
        borderBottom: 1,
        borderColor: 'divider'
      }}>
        <Container maxWidth={false} sx={{ maxWidth: '1440px' }}>
          {/* Collapsible Search Section */}
          <Box sx={{ mb: 0.5 }}>
            {/* Search Icon Button */}
            {!isSearchExpanded && !isSearchView && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
                <IconButton
                  onClick={() => setIsSearchExpanded(true)}
                  sx={{
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': {
                      bgcolor: 'action.hover'
                    }
                  }}
                >
                  <SearchIcon />
                </IconButton>
              </Box>
            )}

            {/* Expanded Search Bar */}
            {(isSearchExpanded || isSearchView) && (
              <ClickAwayListener onClickAway={() => {
                if (!searchQuery.trim()) {
                  setIsSearchExpanded(false);
                  setShowDropdown(false);
                }
              }}>
                <Box sx={{ 
                  position: 'relative',
                  mb: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}>
                  {isSearchView && (
                    <Typography 
                      variant={isMobile ? "h6" : "h5"} 
                      component="h1"
                      sx={{ fontWeight: 600, mr: 2 }}
                    >
                      Search Results
                    </Typography>
                  )}
                  <Box ref={searchRef} sx={{ flex: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Search rooms and users..."
                      value={searchQuery}
                      onChange={(e) => {
                        handleInstantSearch(e.target.value);
                        handleSearch(e.target.value);
                      }}
                      onKeyDown={handleSearchSubmit}
                      autoFocus={isSearchExpanded}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon />
                          </InputAdornment>
                        ),
                        endAdornment: (isSearchExpanded || isSearchView) && (
                          <InputAdornment position="end">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSearchQuery('');
                                setIsSearchExpanded(false);
                                setIsSearchView(false);
                                setShowDropdown(false);
                                setUsers([]);
                                setRooms([]);
                              }}
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                      sx={{ 
                        backgroundColor: 'background.paper',
                        borderRadius: 2,
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                        }
                      }}
                    />
                    {/* Dropdown Results */}
                    <Popper
                      open={showDropdown && dropdownUsers.length > 0}
                      anchorEl={searchRef.current}
                      placement="bottom-start"
                      style={{ width: searchRef.current?.offsetWidth, zIndex: 1400 }}
                    >
                      <Paper 
                        elevation={3}
                        sx={{ 
                          mt: 1,
                          maxHeight: '300px',
                          overflowY: 'auto',
                          borderRadius: 2
                        }}
                      >
                        <List sx={{ p: 0 }}>
                          {dropdownUsers.map((user, index) => (
                            <React.Fragment key={user.id}>
                              <ListItem
                                button
                                onClick={() => {
                                  navigate(`/profile/${user.id}`);
                                  setShowDropdown(false);
                                }}
                                sx={{ 
                                  py: 1,
                                  px: 2,
                                  '&:hover': {
                                    backgroundColor: 'action.hover'
                                  }
                                }}
                              >
                                <ListItemAvatar>
                                  <Avatar 
                                    src={user.isActive === false ? undefined : user.profilePic}
                                    alt={user.name}
                                    sx={{ width: 32, height: 32 }}
                                  >
                                    {(user.isActive !== false && !user.profilePic) ? user.name?.[0]?.toUpperCase() : null}
                                  </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                  primary={
                                    <Typography variant="body1" component="div">
                                      {user.name}
                                      {user.isVerified && (
                                        <VerifiedUserIcon 
                                          sx={{ 
                                            ml: 0.5, 
                                            color: 'primary.main',
                                            fontSize: '0.9rem',
                                            verticalAlign: 'middle'
                                          }} 
                                        />
                                      )}
                                    </Typography>
                                  }
                                  secondary={
                                    <>
                                      <Typography variant="body2" component="span" color="text.secondary">
                                        @{user.username}
                                      </Typography>
                                      {user.bio && (
                                        <Typography 
                                          variant="body2" 
                                          component="span"
                                          color="text.secondary"
                                          sx={{
                                            mt: 0.5,
                                            display: 'block',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden'
                                          }}
                                        >
                                          {user.bio}
                                        </Typography>
                                      )}
                                    </>
                                  }
                                  sx={{ my: 0 }}
                                />
                                {currentUser && user.id !== currentUser.uid && (
                                  <Box sx={{ display: 'flex', gap: 1 }}>
                                    <IconButton
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/messages/${user.id}`);
                                      }}
                                    >
                                      <MessageIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!pendingRequests.has(user.id)) {
                                          handleFollow(user.id);
                                        }
                                      }}
                                      color={following.has(user.id) ? "primary" : pendingRequests.has(user.id) ? "secondary" : "default"}
                                      disabled={pendingRequests.has(user.id)}
                                    >
                                      <PersonAddIcon fontSize="small" />
                                    </IconButton>
                                  </Box>
                                )}
                              </ListItem>
                              {index < dropdownUsers.length - 1 && <Divider />}
                            </React.Fragment>
                          ))}
                        </List>
                      </Paper>
                    </Popper>
                  </Box>
                </Box>
              </ClickAwayListener>
            )}
          </Box>

          {/* Peeks Stories Section */}
          {!isSearchView && (
            <Peeks />
          )}

          {/* Main Tabs - Rooms vs People vs Top Hosts vs Popular Rooms */}
          {!isSearchView && (
            <Tabs
              value={activeTab}
              onChange={handleMainTabChange}
              variant={isMobile ? "scrollable" : "standard"}
              scrollButtons={isMobile ? "auto" : false}
              sx={{
                mb: 0.5,
                '& .MuiTabs-indicator': {
                  height: 3
                }
              }}
            >
              <Tab icon={<PublicIcon />} label="ROOMS" iconPosition="start" />
              <Tab icon={<PeopleIcon />} label="PEOPLE" iconPosition="start" />
              <Tab icon={<TrophyIcon />} label="TOP HOSTS" iconPosition="start" />
              <Tab icon={<WhatshotIcon />} label="POPULAR" iconPosition="start" />
            </Tabs>
          )}

          {/* Category Tabs - Only show for Rooms tab when not in swipe view */}
          {!isSearchView && activeTab === 0 && !isSwipeViewActive && (
             <Tabs
               value={selectedCategory}
               onChange={handleCategoryChange}
               variant="scrollable"
               scrollButtons="auto"
               aria-label="room categories"
               sx={{
                 mb: 1,
                 borderBottom: 1,
                 borderColor: 'divider'
               }}
             >
               <Tab label="All" value="All" />
               {categories.map((category) => (
                 <Tab key={category} label={category} value={category} />
               ))}
             </Tabs>
          )}
          {/* End of Category Tabs section */}

          {!isSearchView && activeTab === 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1, mr: 2 }}>
              <IconButton
                onClick={handleViewToggle}
                color="primary"
                sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': {
                    bgcolor: 'action.hover'
                  }
                }}
              >
                {isSwipeViewActive ? <GridViewIcon /> : <SwipeViewIcon />}
              </IconButton>
            </Box>
          )}
        </Container>
      </Box>

      {/* Search Results or Content Grid/Swipe View */}
      <Container 
        maxWidth={false} 
        sx={{ 
          pt: 1,
          pb: 4, 
          px: isMobile ? 2 : 3,
          maxWidth: '1440px',
          // Adjust styling for swipe view to take full height and center content
          ...(activeTab === 0 && isSwipeViewActive && !isSearchView && {
             px: 0, // Remove horizontal padding for full width
             py: 0, // Remove vertical padding
             flexGrow: 1, // Allow container to grow
             display: 'flex',
             flexDirection: 'column', // Stack children vertically
             justifyContent: 'center', // Center content vertically
             alignItems: 'center', // Center content horizontally
             overflow: 'hidden', // Hide overflow
             // Min height to take available space below header/tabs and above bottom nav
             minHeight: 'calc(100vh - 64px - 48px - 56px)', // Example: viewport height - navbar - main tabs - bottom nav (adjust heights as needed)
          })
        }}
      >
        {isSearchView ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Users Section */}
            {users.length > 0 && (
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>Users</Typography>
                <List>
                  {users.map((user, index) => (
                    <React.Fragment key={user.id}>
                      <ListItem 
                        sx={{ 
                          py: 2,
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: 'action.hover'
                          }
                        }}
                        onClick={() => navigate(`/profile/${user.id}`)}
                      >
                        <ListItemAvatar>
                          <Avatar 
                            src={user.isActive === false ? undefined : user.profilePic}
                            alt={user.name}
                            sx={{ width: 50, height: 50 }}
                          >
                            {(user.isActive !== false && !user.profilePic) ? user.name?.[0]?.toUpperCase() : null}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle1" component="div" sx={{ fontWeight: 600 }}>
                              {user.name}
                              {user.isVerified && (
                                <VerifiedUserIcon 
                                  sx={{ 
                                    ml: 0.5, 
                                    color: 'primary.main',
                                    fontSize: '1rem',
                                    verticalAlign: 'middle'
                                  }} 
                                />
                              )}
                            </Typography>
                          }
                          secondary={
                            <>
                              <Typography variant="body2" component="span" color="text.secondary">
                                @{user.username}
                              </Typography>
                              {user.bio && (
                                <Typography 
                                  variant="body2" 
                                  component="span"
                                  color="text.secondary"
                                  sx={{
                                    mt: 0.5,
                                    display: 'block',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                  }}
                                >
                                  {user.bio}
                                </Typography>
                              )}
                            </>
                          }
                        />
                        {currentUser && user.id !== currentUser.uid && (
                          <ListItemSecondaryAction>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/chat/${user.id}`);
                                }}
                                size="small"
                              >
                                <MessageIcon />
                              </IconButton>
                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!pendingRequests.has(user.id)) {
                                    handleFollow(user.id);
                                  }
                                }}
                                size="small"
                                color={following.has(user.id) ? "primary" : pendingRequests.has(user.id) ? "secondary" : "default"}
                                disabled={pendingRequests.has(user.id)}
                              >
                                <PersonAddIcon />
                              </IconButton>
                            </Box>
                          </ListItemSecondaryAction>
                        )}
                      </ListItem>
                      {index < users.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              </Box>
            )}

            {/* Rooms Section */}
            {rooms.length > 0 && (
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>Rooms</Typography>
                <Grid container spacing={3}>
                  {rooms
                    .filter(room => {
                      const shouldInclude = selectedCategory === 'All' || (room.tags && room.tags.includes(selectedCategory));
                      return shouldInclude;
                    })
                    .map((room) => (
                    <Grid item xs={12} sm={6} md={4} key={room.id}>
                      <Card 
                        sx={{ 
                          display: 'flex',
                          flexDirection: 'column',
                          cursor: 'pointer',
                          borderRadius: 2,
                          overflow: 'hidden',
                          boxShadow: theme.shadows[3],
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            transition: 'transform 0.2s ease-in-out',
                            boxShadow: theme.shadows[6]
                          }
                        }}
                        onClick={() => handleRoomClick(room.id)}
                      >
                        <Box sx={{ position: 'relative' }}>
                          <CardMedia
                            component="img"
                            height={isMobile ? "160" : "200"}
                            image={room.thumbnailUrl || room.creatorAvatar || 'https://placehold.co/600x400/333/666?text=Room'}
                            alt={room.name}
                            sx={{ 
                              objectFit: 'cover',
                              width: '100%',
                              borderRadius: '8px 8px 0 0',
                              filter: 'brightness(0.95) contrast(1.05)',
                              transition: 'all 0.3s ease',
                              '&:hover': {
                                filter: 'brightness(1.05) contrast(1.1)',
                                transform: 'scale(1.02)'
                              }
                            }}
                          />
                          {/* Subtle gradient overlay for better text readability */}
                          <Box sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.2) 100%)',
                            borderRadius: '8px 8px 0 0'
                          }} />
                          <Box sx={{ 
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            display: 'flex',
                            gap: 0.5,
                            zIndex: 2
                          }}>
                            {room.isPopular && (
                              <Chip
                                label="Popular"
                                color="warning"
                                size="small"
                                icon={<WhatshotIcon />}
                                sx={{ 
                                  fontWeight: 'bold',
                                  fontSize: '0.7rem',
                                  height: 24,
                                  '& .MuiChip-label': {
                                    px: 1
                                  },
                                  '& .MuiChip-icon': {
                                    fontSize: '0.8rem'
                                  },
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                  backdropFilter: 'blur(4px)'
                                }}
                              />
                            )}
                            {room.isLive && (
                              <Chip
                                label="LIVE"
                                color="error"
                                size="small"
                                sx={{ 
                                  fontWeight: 'bold',
                                  fontSize: '0.7rem',
                                  height: 24,
                                  '& .MuiChip-label': {
                                    px: 1
                                  },
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                  backdropFilter: 'blur(4px)',
                                  animation: 'pulse 2s infinite'
                                }}
                              />
                            )}
                          </Box>
                        </Box>
                        <CardContent sx={{ 
                          flexGrow: 1,
                          p: 3,
                          '&:last-child': { pb: 3 }
                        }}>
                          <Box sx={{ mb: 2 }}>
                            <Typography 
                              gutterBottom 
                              variant={isMobile ? "h6" : "h5"} 
                              component="h2" 
                              noWrap
                              sx={{ 
                                fontWeight: 600,
                                mb: 1
                              }}
                            >
                              {room.name}
                            </Typography>
                            <Typography 
                              variant="body1" 
                              color="text.secondary" 
                              sx={{ 
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                mb: 2,
                                lineHeight: 1.5
                              }}
                            >
                              {room.description}
                            </Typography>
                          </Box>
                          <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 1.5, 
                            mb: 2,
                            flexWrap: 'wrap'
                          }}>
                            <Chip
                              icon={<EyeIcon sx={{ fontSize: isMobile ? '1.1rem' : '1.25rem' }} />}
                              label={`${room.activeUsers || 0} views`}
                              color="primary"
                              variant="outlined"
                              sx={{ 
                                height: 'auto',
                                padding: '8px 12px',
                                '& .MuiChip-label': {
                                  padding: '0 4px',
                                  fontSize: isMobile ? '0.875rem' : '1rem'
                                }
                              }}
                            />
                            {room.isPrivate && (
                              <Chip
                                label="Private"
                                color="secondary"
                                sx={{ 
                                  height: 'auto',
                                  padding: '8px 12px',
                                  '& .MuiChip-label': {
                                    padding: '0 4px',
                                    fontSize: isMobile ? '0.875rem' : '1rem'
                                  }
                                }}
                              />
                            )}
                          </Box>
                          <Typography 
                            variant="body2" 
                            color="text.secondary"
                            sx={{ 
                              fontSize: isMobile ? '0.75rem' : '0.875rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5
                            }}
                          >
                            Created by {room.creatorName || 'Anonymous'} • {formatTimestamp(room.lastActive)}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {users.length === 0 && rooms.length === 0 && !loading && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h6" color="text.secondary">
                  No results found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Try different keywords or check your spelling
                </Typography>
              </Box>
            )}
          </Box>
        ) : (
          // Show either Rooms (activeTab === 0) with swipe, People (activeTab === 1), Top Hosts (activeTab === 2), or Popular Rooms (activeTab === 3)
          activeTab === 0 ? (
            // Rooms tab content - Conditional rendering for Swipe View or Grid
            isSwipeViewActive && !isSearchView ? ( // Ensure swipe view is active and not in search view
              <Box sx={{
                height: 'calc(100vh - 200px)',
                width: '100%',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Add category tabs for swipe view */}
                <Tabs
                  value={selectedCategory}
                  onChange={handleCategoryChange}
                  variant="scrollable"
                  scrollButtons="auto"
                  aria-label="room categories"
                  sx={{
                    mb: 1,
                    px: 2,
                    '& .MuiTabs-scroller': {
                      height: '40px'
                    },
                    '& .MuiTab-root': {
                      color: 'white',
                      textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                      minHeight: '40px',
                      zIndex: 3
                    },
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 3,
                    bgcolor: 'rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <Tab label="All" value="All" />
                  {categories.map((category) => (
                    <Tab key={category} label={category} value={category} />
                  ))}
                </Tabs>

                {loading ? (
                  <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                    <CircularProgress />
                  </Box>
                ) : rooms.length > 0 ? (
                  <Box sx={{ height: '100%', width: '100%', position: 'relative' }}>
                    <motion.div
                      key={currentRoomIndex}
                      initial={{ opacity: 0, y: "100%" }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: "-100%" }}
                      transition={{ duration: 0.3 }}
                      style={{
                        height: '100%',
                        width: '100%',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        touchAction: 'pan-y'
                      }}
                      drag="y"
                      dragConstraints={{ top: 0, bottom: 0 }}
                      dragElastic={1}
                      onDragEnd={(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
                        const filteredRooms = rooms.filter(room => 
                          selectedCategory === 'All' || room.tags?.includes(selectedCategory)
                        );
                        if (info.offset.y < -50 && currentRoomIndex < filteredRooms.length - 1) {
                          setCurrentRoomIndex(prev => prev + 1);
                        } else if (info.offset.y > 50 && currentRoomIndex > 0) {
                          setCurrentRoomIndex(prev => prev - 1);
                        }
                      }}
                    >
                      {(() => {
                        const filteredRooms = rooms.filter(room => 
                          selectedCategory === 'All' || room.tags?.includes(selectedCategory)
                        );
                        
                        if (filteredRooms.length === 0) {
                          return (
                            <Box 
                              sx={{ 
                                height: '100%', 
                                width: '100%', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                flexDirection: 'column',
                                gap: 2,
                                bgcolor: 'background.paper',
                                color: 'text.primary'
                              }}
                            >
                              <Typography variant="h6">
                                No rooms in {selectedCategory} category
                              </Typography>
                              <Button 
                                variant="outlined" 
                                onClick={() => setSelectedCategory('All')}
                              >
                                View All Rooms
                              </Button>
                            </Box>
                          );
                        }

                        const currentRoom = filteredRooms[currentRoomIndex];
                        return (
                          <Box
                            sx={{
                              height: '100%',
                              width: '100%',
                              position: 'relative',
                              backgroundColor: 'rgba(0,0,0,0.9)',
                              cursor: 'pointer',
                            }}
                            onClick={() => handleRoomClick(currentRoom.id)}
                          >
                            {currentRoom?.thumbnailUrl ? (
                            <Box
                              sx={{
                                  height: '100%',
                                  width: '100%',
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  backgroundImage: `url(${currentRoom.thumbnailUrl})`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                  '&::before': {
                                    content: '""',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 20%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.7) 100%)',
                                    pointerEvents: 'none'
                                  }
                              }}
                            />
                            ) : (
                            <Box
                              sx={{
                                  height: '100%',
                                width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  background: 'linear-gradient(45deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.6) 100%)',
                                }}
                              >
                                <Avatar
                                  src={currentRoom?.creatorAvatar}
                                sx={{
                                    width: '200px',
                                    height: '200px',
                                    fontSize: '100px',
                                    bgcolor: 'primary.main'
                                  }}
                                >
                                  {currentRoom?.name?.[0]?.toUpperCase()}
                                </Avatar>
                              </Box>
                            )}

                            {/* Live Status Indicator */}
                            {currentRoom?.isLive && (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: 16,
                                  left: 16,
                                  zIndex: 3,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1
                                }}
                              >
                                <Box
                                  sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    bgcolor: 'error.main',
                                    animation: 'pulse 2s infinite'
                                  }}
                                />
                              <Typography
                                sx={{
                                    color: 'white',
                                    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  LIVE
                              </Typography>
                              </Box>
                            )}

                            {/* Room Info */}
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                p: 3,
                                color: 'white',
                                textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                                zIndex: 2,
                                background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)',
                                backdropFilter: 'blur(10px)'
                              }}
                            >
                              <Typography variant="h5" sx={{ mb: 1, fontWeight: 'bold' }}>
                                {currentRoom?.name}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                <Avatar
                                  src={currentRoom?.creatorAvatar}
                                  sx={{ width: 32, height: 32, mr: 1 }}
                                />
                                <Typography variant="subtitle1">
                                  @{currentRoom?.creatorName}
                                </Typography>
                              </Box>
                              <Typography variant="body1" sx={{ mb: 2, opacity: 0.9 }}>
                                {currentRoom?.description}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Chip
                                  icon={<EyeIcon sx={{ color: 'white' }} />}
                                  label={`${currentRoom?.activeUsers || 0} listening`}
                                  sx={{
                                    bgcolor: 'rgba(255,255,255,0.2)',
                                    color: 'white',
                                    backdropFilter: 'blur(4px)'
                                  }}
                                />
                                {currentRoom?.isLive && (
                                <Chip
                                  label="LIVE"
                                    color="error"
                                  sx={{
                                      animation: 'pulse 2s infinite'
                                    }}
                                  />
                                )}
                                {activeStreamCallInstance && (
                                  <Chip
                                    label="Connected"
                                    color="success"
                                    sx={{
                                      bgcolor: 'rgba(76,175,80,0.3)',
                                      backdropFilter: 'blur(4px)'
                                  }}
                                />
                              )}
                            </Box>
                          </Box>
                          </Box>
                        );
                      })()}
                    </motion.div>

                    {/* Room navigation indicators */}
                    <Box sx={{
                      position: 'absolute',
                      right: 16,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      zIndex: 2
                    }}>
                      {rooms
                        .filter(room => selectedCategory === 'All' || room.tags?.includes(selectedCategory))
                        .map((_, index) => (
                          <Box
                            key={index}
                            sx={{
                              width: 4,
                              height: 16,
                              borderRadius: 2,
                              bgcolor: index === currentRoomIndex ? 'primary.main' : 'rgba(255,255,255,0.5)',
                              transition: 'all 0.3s ease'
                            }}
                          />
                        ))}
                    </Box>
                  </Box>
                ) : (
                  <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                    <Typography variant="h6" color="text.secondary">
                      No rooms found
                    </Typography>
                  </Box>
                )}
              </Box>
            ) : ( // Grid view for rooms (when not swipe view or when in search view)
              <Grid container spacing={3}>
              {rooms
                  .filter(room => selectedCategory === 'All' || (room.tags && room.tags.includes(selectedCategory)))
                .map((room) => (
                <Grid item xs={12} sm={6} md={4} key={room.id}>
                  <Card 
                    sx={{ 
                      display: 'flex',
                      flexDirection: 'column',
                      cursor: 'pointer',
                      borderRadius: 2,
                      overflow: 'hidden',
                      boxShadow: theme.shadows[3],
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        transition: 'transform 0.2s ease-in-out',
                        boxShadow: theme.shadows[6]
                      }
                    }}
                    onClick={() => handleRoomClick(room.id)}
                  >
                    <Box sx={{ position: 'relative' }}>
                      <CardMedia
                        component="img"
                        height={isMobile ? "160" : "200"}
                        image={room.thumbnailUrl || room.creatorAvatar || 'https://placehold.co/600x400/333/666?text=Room'}
                        alt={room.name}
                        sx={{ 
                          objectFit: 'cover',
                          width: '100%',
                          borderRadius: '8px 8px 0 0',
                          filter: 'brightness(0.95) contrast(1.05)',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            filter: 'brightness(1.05) contrast(1.1)',
                            transform: 'scale(1.02)'
                          }
                        }}
                      />
                      {/* Subtle gradient overlay for better text readability */}
                      <Box sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.2) 100%)',
                        borderRadius: '8px 8px 0 0'
                      }} />
                      <Box sx={{ 
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        display: 'flex',
                        gap: 0.5,
                        zIndex: 2
                      }}>
                        {room.isPopular && (
                          <Chip
                            label="Popular"
                            color="warning"
                            size="small"
                            icon={<WhatshotIcon />}
                            sx={{ 
                              fontWeight: 'bold',
                              fontSize: '0.7rem',
                              height: 24,
                              '& .MuiChip-label': {
                                px: 1
                              },
                              '& .MuiChip-icon': {
                                fontSize: '0.8rem'
                              },
                              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                              backdropFilter: 'blur(4px)'
                            }}
                          />
                        )}
                        {room.isLive && (
                          <Chip
                            label="LIVE"
                            color="error"
                            size="small"
                            sx={{ 
                              fontWeight: 'bold',
                              fontSize: '0.7rem',
                              height: 24,
                              '& .MuiChip-label': {
                                px: 1
                              },
                              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                              backdropFilter: 'blur(4px)',
                              animation: 'pulse 2s infinite'
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                    <CardContent sx={{ 
                      flexGrow: 1,
                      p: 3,
                      '&:last-child': { pb: 3 }
                    }}>
                      <Box sx={{ mb: 2 }}>
                        <Typography 
                          gutterBottom 
                          variant={isMobile ? "h6" : "h5"} 
                          component="h2" 
                          noWrap
                          sx={{ 
                            fontWeight: 600,
                            mb: 1
                          }}
                        >
                          {room.name}
                        </Typography>
                        <Typography 
                          variant="body1" 
                          color="text.secondary" 
                          sx={{ 
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            mb: 2,
                            lineHeight: 1.5
                          }}
                        >
                          {room.description}
                        </Typography>
                      </Box>
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1.5, 
                        mb: 2,
                        flexWrap: 'wrap'
                      }}>
                        <Chip
                          icon={<EyeIcon sx={{ fontSize: isMobile ? '1.1rem' : '1.25rem' }} />}
                          label={`${room.activeUsers || 0} views`}
                          color="primary"
                          variant="outlined"
                          sx={{ 
                            height: 'auto',
                            padding: '8px 12px',
                            '& .MuiChip-label': {
                              padding: '1 4px',
                              fontSize: isMobile ? '0.875rem' : '1rem'
                            }
                          }}
                        />
                        {room.isPrivate && (
                          <Chip
                            label="Private"
                            color="secondary"
                            sx={{ 
                              height: 'auto',
                              padding: '8px 12px',
                              '& .MuiChip-label': {
                                padding: '0 4px',
                                fontSize: isMobile ? '0.875rem' : '1rem'
                              }
                            }}
                          />
                        )}
                      </Box>
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{ 
                          fontSize: isMobile ? '0.75rem' : '0.875rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5
                        }}
                      >
                        Created by {room.creatorName || 'Anonymous'} • {formatTimestamp(room.lastActive)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
            )
            ) : activeTab === 1 ? (
            // People tab content
            <Box sx={{ mt: 2 }}>
              {loading ? (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
                  <CircularProgress />
                </Box>
              ) : users.length > 0 ? (
                <List>
                  {users.map((user, index) => (
                    <React.Fragment key={user.id}>
                      <ListItem 
                        sx={{ 
                          py: 3,
                          px: 2,
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: 'action.hover'
                          },
                          borderRadius: 1,
                          mb: 1
                        }}
                        onClick={() => navigate(`/profile/${user.id}`)}
                      >
                        <ListItemAvatar>
                          <Avatar 
                            src={user.isActive === false ? undefined : user.profilePic}
                            alt={user.name}
                            sx={{ width: 60, height: 60, mr: 2 }}
                          >
                            {(user.isActive !== false && !user.profilePic) ? user.name?.[0]?.toUpperCase() : null}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle1" component="div" sx={{ fontWeight: 600 }}>
                              {user.name}
                              {user.isVerified && (
                                <VerifiedUserIcon 
                                  sx={{ 
                                    ml: 0.5, 
                                    color: 'primary.main',
                                    fontSize: '1rem',
                                    verticalAlign: 'middle'
                                  }} 
                                />
                              )}
                            </Typography>
                          }
                          secondary={
                            <>
                              <Typography variant="body2" component="span" color="text.secondary">
                                @{user.username}
                              </Typography>
                              {user.bio && (
                                <Typography 
                                  variant="body2" 
                                  component="span"
                                  color="text.secondary"
                                  sx={{
                                    mt: 0.5,
                                    display: 'block',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                  }}
                                >
                                  {user.bio}
                                </Typography>
                              )}
                            </>
                          }
                          sx={{ ml: 2 }}
                        />
                        {currentUser && user.id !== currentUser.uid && (
                          <ListItemSecondaryAction sx={{ right: 16 }}>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
                              <IconButton
                                color="primary"
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/chat/user/${user.id}`);
                                }}
                                sx={{ 
                                  border: '1px solid',
                                  borderColor: 'primary.main',
                                  p: 1
                                }}
                              >
                                <MessageIcon fontSize="small" />
                              </IconButton>
                              <Button
                                variant={following.has(user.id) ? "contained" : pendingRequests.has(user.id) ? "contained" : "outlined"}
                                size="small"
                                startIcon={following.has(user.id) || pendingRequests.has(user.id) ? null : <PersonAddIcon />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!pendingRequests.has(user.id)) {
                                    handleFollow(user.id);
                                  }
                                }}
                                color={pendingRequests.has(user.id) ? "secondary" : "primary"}
                                disabled={pendingRequests.has(user.id)}
                              >
                                {following.has(user.id) ? "Following" : pendingRequests.has(user.id) ? "Requested" : "Follow"}
                              </Button>
                            </Box>
                          </ListItemSecondaryAction>
                        )}
                      </ListItem>
                      {index < users.length - 1 && <Divider sx={{ my: 1 }} />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="h6" color="text.secondary">
                    No users found
                  </Typography>
                </Box>
              )}
            </Box>
          ) : activeTab === 2 ? (
            // Top Hosts tab content
            <Box sx={{ mt: 2 }}>
              {/* Search and Filter Section */}
              <Box sx={{ mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Search top hosts..."
                      value={topHostSearchQuery}
                      onChange={(e) => {
                        setTopHostSearchQuery(e.target.value);
                        searchTopHosts(e.target.value);
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ 
                        backgroundColor: 'background.paper',
                        borderRadius: 1,
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 1,
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Tabs
                      value={selectedTopHostCategory}
                      onChange={(_, newValue) => filterTopHostsByCategory(newValue)}
                      variant="scrollable"
                      scrollButtons="auto"
                      aria-label="top host categories"
                      sx={{
                        borderBottom: 1,
                        borderColor: 'divider'
                      }}
                    >
                      <Tab label="All" value="All" />
                      {categories.map((category) => (
                        <Tab key={category} label={category} value={category} />
                      ))}
                    </Tabs>
                  </Grid>
                </Grid>
              </Box>

              {loading || isSearchingTopHosts ? (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
                  <CircularProgress />
                </Box>
              ) : filteredTopHosts.length > 0 ? (
                <List>
                  {filteredTopHosts.map((host, index) => (
                    <React.Fragment key={host.id}>
                      <ListItem 
                        sx={{ 
                          py: 3,
                          px: 2,
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: 'action.hover'
                          },
                          borderRadius: 1,
                          mb: 1,
                          position: 'relative'
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar 
                            src={host.isActive === false ? undefined : host.profilePic}
                            alt={host.name}
                            sx={{ 
                              width: 60, 
                              height: 60, 
                              mr: 2,
                              cursor: 'pointer',
                              '&:hover': {
                                opacity: 0.8
                              }
                            }}
                            onClick={() => navigate(`/profile/${host.id}`)}
                          >
                            {(host.isActive !== false && !host.profilePic) ? host.name?.[0]?.toUpperCase() : null}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle1" component="div" sx={{ fontWeight: 600 }}>
                                {host.name}
                                {host.isVerified && (
                                  <VerifiedUserIcon 
                                    sx={{ 
                                      ml: 0.5, 
                                      color: 'primary.main',
                                      fontSize: '1rem',
                                      verticalAlign: 'middle'
                                    }} 
                                  />
                                )}
                              </Typography>
                              <Chip
                                label="Top Host"
                                color="warning"
                                size="small"
                                icon={<TrophyIcon />}
                                sx={{ 
                                  height: 'auto',
                                  '& .MuiChip-label': {
                                    px: 1
                                  }
                                }}
                              />
                            </Box>
                          }
                          secondary={
                            <>
                              <Typography variant="body2" component="span" color="text.secondary">
                                @{host.username}
                              </Typography>
                              <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
                                <Typography variant="body2" color="text.secondary">
                                  {host.totalViews?.toLocaleString()} total views
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {host.activeRooms} active rooms
                                </Typography>
                              </Box>
                              {host.bio && (
                                <Typography 
                                  variant="body2" 
                                  component="span"
                                  color="text.secondary"
                                  sx={{
                                    mt: 0.5,
                                    display: 'block',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                  }}
                                >
                                  {host.bio}
                                </Typography>
                              )}
                            </>
                          }
                          sx={{ ml: 2 }}
                        />
                        {currentUser && host.id !== currentUser.uid && (
                          <ListItemSecondaryAction sx={{ right: 16 }}>
                            <Button
                              variant={following.has(host.id) ? "contained" : pendingRequests.has(host.id) ? "contained" : "outlined"}
                              size="small"
                              startIcon={following.has(host.id) || pendingRequests.has(host.id) ? null : <PersonAddIcon />}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!pendingRequests.has(host.id)) {
                                  handleFollow(host.id);
                                }
                              }}
                              color={pendingRequests.has(host.id) ? "secondary" : "primary"}
                              disabled={pendingRequests.has(host.id)}
                            >
                              {following.has(host.id) ? "Following" : pendingRequests.has(host.id) ? "Requested" : "Follow"}
                            </Button>
                          </ListItemSecondaryAction>
                        )}
                      </ListItem>
                      {index < filteredTopHosts.length - 1 && <Divider sx={{ my: 1 }} />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="h6" color="text.secondary">
                    {topHostSearchQuery ? 'No matching top hosts found' : 'No top hosts found'}
                  </Typography>
                  {topHostSearchQuery && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Try different keywords or check your spelling
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          ) : (
            // Popular Rooms tab content
            <Box sx={{ mt: 2 }}>
              {/* Search and Filter Section */}
              <Box sx={{ mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Search popular rooms..."
                      value={popularRoomSearchQuery}
                      onChange={(e) => {
                        setPopularRoomSearchQuery(e.target.value);
                        searchPopularRooms(e.target.value);
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ 
                        backgroundColor: 'background.paper',
                        borderRadius: 1,
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 1,
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Tabs
                      value={selectedPopularRoomCategory}
                      onChange={(_, newValue) => filterPopularRoomsByCategory(newValue)}
                      variant="scrollable"
                      scrollButtons="auto"
                      aria-label="popular room categories"
                      sx={{
                        borderBottom: 1,
                        borderColor: 'divider'
                      }}
                    >
                      <Tab label="All" value="All" />
                      {categories.map((category) => (
                        <Tab key={category} label={category} value={category} />
                      ))}
                    </Tabs>
                  </Grid>
                </Grid>
              </Box>

              {loading || isSearchingPopularRooms ? (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
                  <CircularProgress />
                </Box>
              ) : filteredPopularRooms.length > 0 ? (
                <Grid container spacing={3}>
                  {filteredPopularRooms.map((room) => (
                    <Grid item xs={12} sm={6} md={4} key={room.id}>
                      <Card 
                        sx={{ 
                          display: 'flex',
                          flexDirection: 'column',
                          cursor: 'pointer',
                          borderRadius: 2,
                          overflow: 'hidden',
                          boxShadow: theme.shadows[3],
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            transition: 'transform 0.2s ease-in-out',
                            boxShadow: theme.shadows[6]
                          }
                        }}
                        onClick={() => handleRoomClick(room.id)}
                      >
                        <Box sx={{ position: 'relative' }}>
                          <CardMedia
                            component="img"
                            height={isMobile ? "160" : "200"}
                            image={room.thumbnailUrl || room.creatorAvatar || 'https://placehold.co/600x400/333/666?text=Room'}
                            alt={room.name}
                            sx={{ 
                              objectFit: 'cover',
                              width: '100%',
                              borderRadius: '8px 8px 0 0',
                              filter: 'brightness(0.95) contrast(1.05)',
                              transition: 'all 0.3s ease',
                              '&:hover': {
                                filter: 'brightness(1.05) contrast(1.1)',
                                transform: 'scale(1.02)'
                              }
                            }}
                          />
                          {/* Subtle gradient overlay for better text readability */}
                          <Box sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.2) 100%)',
                            borderRadius: '8px 8px 0 0'
                          }} />
                          <Box sx={{ 
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            display: 'flex',
                            gap: 0.5,
                            zIndex: 2
                          }}>
                            <Chip
                              label="Popular"
                              color="warning"
                              size="small"
                              icon={<WhatshotIcon />}
                              sx={{ 
                                fontWeight: 'bold',
                                fontSize: '0.7rem',
                                height: 24,
                                '& .MuiChip-label': {
                                  px: 1
                                },
                                '& .MuiChip-icon': {
                                  fontSize: '0.8rem'
                                },
                                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                backdropFilter: 'blur(4px)'
                              }}
                            />
                            {room.isLive && (
                              <Chip
                                label="LIVE"
                                color="error"
                                size="small"
                                sx={{ 
                                  fontWeight: 'bold',
                                  fontSize: '0.7rem',
                                  height: 24,
                                  '& .MuiChip-label': {
                                    px: 1
                                  },
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                  backdropFilter: 'blur(4px)',
                                  animation: 'pulse 2s infinite'
                                }}
                              />
                            )}
                          </Box>
                        </Box>
                        <CardContent sx={{ 
                          flexGrow: 1,
                          p: 3,
                          '&:last-child': { pb: 3 }
                        }}>
                          <Box sx={{ mb: 2 }}>
                            <Typography 
                              gutterBottom 
                              variant={isMobile ? "h6" : "h5"} 
                              component="h2" 
                              noWrap
                              sx={{ 
                                fontWeight: 600,
                                mb: 1
                              }}
                            >
                              {room.name}
                            </Typography>
                            <Typography 
                              variant="body1" 
                              color="text.secondary" 
                              sx={{ 
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                mb: 2,
                                lineHeight: 1.5
                              }}
                            >
                              {room.description}
                            </Typography>
                          </Box>
                          <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 1.5, 
                            mb: 2,
                            flexWrap: 'wrap'
                          }}>
                            <Chip
                              icon={<EyeIcon sx={{ fontSize: isMobile ? '1.1rem' : '1.25rem' }} />}
                              label={`${room.activeUsers || 0} views`}
                              color="primary"
                              variant="outlined"
                              sx={{ 
                                height: 'auto',
                                padding: '8px 12px',
                                '& .MuiChip-label': {
                                  padding: '1 4px',
                                  fontSize: isMobile ? '0.875rem' : '1rem'
                                }
                              }}
                            />
                            {room.isPrivate && (
                              <Chip
                                label="Private"
                                color="secondary"
                                sx={{ 
                                  height: 'auto',
                                  padding: '8px 12px',
                                  '& .MuiChip-label': {
                                    padding: '0 4px',
                                    fontSize: isMobile ? '0.875rem' : '1rem'
                                  }
                                }}
                              />
                            )}
                          </Box>
                          <Typography 
                            variant="body2" 
                            color="text.secondary"
                            sx={{ 
                              fontSize: isMobile ? '0.75rem' : '0.875rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5
                            }}
                          >
                            Created by {room.creatorName || 'Anonymous'} • {formatTimestamp(room.lastActive)}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="h6" color="text.secondary">
                    {popularRoomSearchQuery ? 'No matching popular rooms found' : 'No popular rooms found'}
                  </Typography>
                  {popularRoomSearchQuery && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Try different keywords or check your spelling
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          )
        )}
      </Container>

      {/* Join Server Chat Room Dialog */}
      <Dialog
        open={showJoinRoomChatDialog}
        onClose={handleDeclineServerChat} // Allow closing dialog to decline
        aria-labelledby="join-room-chat-dialog-title"
      >
        <DialogTitle id="join-room-chat-dialog-title">Join Room Chat?</DialogTitle>
        <DialogContent>
          <Typography>
            {ownerData?.username || "This creator"} has a server chat room: "{serverChatRoom?.name}". Would you like to join it to receive updates and connect with other followers?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeclineServerChat}>Not Now</Button>
          <Button onClick={handleJoinServerChat} variant="contained" color="primary">Join</Button>
        </DialogActions>
      </Dialog>

      {/* Listening Prompt Dialog */}
      <Dialog
        open={showListenPrompt}
        onClose={() => setShowListenPrompt(false)}
        PaperProps={{
          sx: {
            borderRadius: 2,
            maxWidth: 'sm',
            width: '90%'
          }
        }}
      >
        <DialogTitle>Keep Listening?</DialogTitle>
        <DialogContent>
          <Typography>
            Would you like to join {listeningRoom?.name} or continue listening from the stream?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowListenPrompt(false);
            leaveAudioStream();
          }}>
            Stop Listening
          </Button>
          <Button 
            onClick={() => {
              setShowListenPrompt(false);
              if (listeningRoom) {
                handleRoomClick(listeningRoom.id);
              }
            }}
            variant="contained" 
            color="primary"
          >
            Join Room
          </Button>
          <Button
            onClick={() => {
              setShowListenPrompt(false);
              if (listeningRoom) {
                joinAudioStream(listeningRoom.id);
              }
            }}
            variant="outlined"
            color="primary"
            disabled={isJoiningCall}
          >
            {isJoiningCall ? "Connecting..." : "Keep Listening"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Stream audio component */}
      {activeStreamCallInstance && streamClient && (
        <StreamVideo client={streamClient}>
          <StreamCall call={activeStreamCallInstance}>
            <CallContent />
          </StreamCall>
        </StreamVideo>
      )}
    </Box>
  );
};

// Add CallContent component
const CallContent = () => {
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  return <ParticipantsAudio participants={participants} />;
};

export default Discover; 