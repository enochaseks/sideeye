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
  Close as CloseIcon
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

      setRooms(validRooms);
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
      backgroundColor: theme.palette.background.default
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

          {/* Category Tabs - Only show for Rooms tab */}
          {!isSearchView && activeTab === 0 && (
             <Tabs
               value={selectedCategory}
               onChange={handleCategoryChange}
               variant="scrollable"
               scrollButtons="auto"
               aria-label="room categories"
               sx={{
                 mb: 1, // Further reduced margin below tabs
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

        </Container>
      </Box>

      {/* Search Results or Content Grid */}
      <Container 
        maxWidth={false} 
        sx={{ 
          pt: 1,
          pb: 4, 
          px: isMobile ? 2 : 3,
          maxWidth: '1440px'
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
                            height={isMobile ? "220" : "280"}
                            image={room.thumbnailUrl || room.creatorAvatar || 'https://placehold.co/600x400/333/666?text=Room'}
                            alt={room.name}
                            sx={{ 
                              objectFit: 'cover',
                              width: '100%'
                            }}
                          />
                          <Box sx={{ 
                            position: 'absolute',
                            top: 12,
                            right: 12,
                            display: 'flex',
                            gap: 1
                          }}>
                            {room.isPopular && (
                              <Chip
                                label="Popular"
                                color="warning"
                                size="small"
                                icon={<WhatshotIcon />}
                                sx={{ 
                                  fontWeight: 'bold',
                                  fontSize: isMobile ? '0.75rem' : '0.875rem',
                                  height: 'auto',
                                  padding: '6px 12px'
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
                                  fontSize: isMobile ? '0.75rem' : '0.875rem',
                                  height: 'auto',
                                  padding: '6px 12px'
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
          // Show either Rooms (activeTab === 0), People (activeTab === 1), Top Hosts (activeTab === 2), or Popular Rooms (activeTab === 3)
          activeTab === 0 ? (
            // Rooms tab content
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
                        height={isMobile ? "220" : "280"}
                        image={room.thumbnailUrl || room.creatorAvatar || 'https://placehold.co/600x400/333/666?text=Room'}
                        alt={room.name}
                        sx={{ 
                          objectFit: 'cover',
                          width: '100%'
                        }}
                      />
                      <Box sx={{ 
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        display: 'flex',
                        gap: 1
                      }}>
                        {room.isPopular && (
                          <Chip
                            label="Popular"
                            color="warning"
                            size="small"
                            icon={<WhatshotIcon />}
                            sx={{ 
                              fontWeight: 'bold',
                              fontSize: isMobile ? '0.75rem' : '0.875rem',
                              height: 'auto',
                              padding: '6px 12px'
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
                              fontSize: isMobile ? '0.75rem' : '0.875rem',
                              height: 'auto',
                              padding: '6px 12px'
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
                            height={isMobile ? "220" : "280"}
                            image={room.thumbnailUrl || room.creatorAvatar || 'https://placehold.co/600x400/333/666?text=Room'}
                            alt={room.name}
                            sx={{ 
                              objectFit: 'cover',
                              width: '100%'
                            }}
                          />
                          <Box sx={{ 
                            position: 'absolute',
                            top: 12,
                            right: 12,
                            display: 'flex',
                            gap: 1
                          }}>
                            <Chip
                              label="Popular"
                              color="warning"
                              size="small"
                              icon={<WhatshotIcon />}
                              sx={{ 
                                fontWeight: 'bold',
                                fontSize: isMobile ? '0.75rem' : '0.875rem',
                                height: 'auto',
                                padding: '6px 12px'
                              }}
                            />
                            {room.isLive && (
                              <Chip
                                label="LIVE"
                                color="error"
                                size="small"
                                sx={{ 
                                  fontWeight: 'bold',
                                  fontSize: isMobile ? '0.75rem' : '0.875rem',
                                  height: 'auto',
                                  padding: '6px 12px'
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
        onClose={handleDeclineServerChat}
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
    </Box>
  );
};

export default Discover; 