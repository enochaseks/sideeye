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
  ListItemSecondaryAction
} from '@mui/material';
import { 
  TrendingUp as TrendingIcon,
  Group as GroupIcon,
  Whatshot as WhatshotIcon,
  Search as SearchIcon,
  PersonAdd as PersonAddIcon,
  Message as MessageIcon,
  People as PeopleIcon,
  Favorite as FavoriteIcon,
  Comment as CommentIcon,
  Store as StoreIcon,
  Share as ShareIcon
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
  arrayRemove,
  arrayUnion,
  getDoc,
  DocumentSnapshot,
  onSnapshot,
  runTransaction,
  increment,
  startAt,
  endAt
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { formatTimestamp } from '../utils/dateUtils';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Popper from '@mui/material/Popper';

interface UserProfile {
  id: string;
  username: string;
  name: string;
  profilePic: string;
  bio: string;
  coverPhoto?: string;
  isPublic: boolean;
  isAuthenticated?: boolean;
  createdAt: Timestamp;
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
}

interface FirestoreVideo extends DocumentData {
  id: string;
  title: string;
  description?: string;
  username: string;
  userId: string;
  url: string;
  thumbnailUrl?: string;
  timestamp: Timestamp;
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
}

interface Video {
  id: string;
  url: string;
  userId: string;
  username: string;
  likes: number;
  comments: number;
  timestamp: any;
  thumbnailUrl?: string;
}

interface PresenceData {
  id: string;
  role?: 'owner' | 'viewer';
  isMuted?: boolean;
  isOnline: boolean;
}

const Discover: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [showSearch, setShowSearch] = useState(false);
  const [isSearchView, setIsSearchView] = useState(false);
  const [dropdownUsers, setDropdownUsers] = useState<UserProfile[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);
  const [roomListeners, setRoomListeners] = useState<(() => void)[]>([]);

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
      const usersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserProfile[];
      
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async () => {
    try {
      setLoading(true);
      // Clean up existing listeners
      roomListeners.forEach(unsubscribe => unsubscribe());
      setRoomListeners([]);

      const roomsRef = collection(db, 'sideRooms');
      const q = firestoreQuery(
        roomsRef,
        orderBy('lastActive', 'desc'),
        limit(20)
      );

      // Initial fetch of rooms
      const querySnapshot = await getDocs(q);
      const roomsData = await Promise.all(querySnapshot.docs.map(async (docSnapshot) => {
        const data = docSnapshot.data();
        let creatorData = null;

        if (data.ownerId) {
          const creatorDocRef = doc(db, 'users', data.ownerId);
          const creatorDocSnapshot = await getDoc(creatorDocRef);
          if (creatorDocSnapshot.exists()) {
            creatorData = creatorDocSnapshot.data();
          }
        }

        return {
          id: docSnapshot.id,
          name: data.name || '',
          description: data.description || '',
          memberCount: data.memberCount || 0,
          shareCount: data.shareCount || 0,
          isPrivate: data.isPrivate || false,
          createdAt: data.createdAt?.toDate() || new Date(),
          creatorName: creatorData?.username || data.creatorName || '',
          creatorId: data.ownerId || '',
          creatorAvatar: creatorData?.profilePic || creatorData?.avatar || '',
          tags: data.tags || [],
          lastActive: data.lastActive?.toDate() || new Date(),
          maxMembers: data.maxMembers || 50,
          activeUsers: data.activeUsers || 0,
          isLive: data.isLive || false
        };
      }));

      setRooms(roomsData);

      // Set up real-time listeners for each room
      roomsData.forEach(room => {
        setupRoomListener(room.id);
      });

      // Set up a listener for new rooms
      const roomsListener = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            let creatorData = null;

            if (data.ownerId) {
              const creatorDocRef = doc(db, 'users', data.ownerId);
              const creatorDocSnapshot = await getDoc(creatorDocRef);
              if (creatorDocSnapshot.exists()) {
                creatorData = creatorDocSnapshot.data();
              }
            }

            const newRoom = {
              id: change.doc.id,
              name: data.name || '',
              description: data.description || '',
              memberCount: data.memberCount || 0,
              shareCount: data.shareCount || 0,
              isPrivate: data.isPrivate || false,
              createdAt: data.createdAt?.toDate() || new Date(),
              creatorName: creatorData?.username || data.creatorName || '',
              creatorId: data.ownerId || '',
              creatorAvatar: creatorData?.profilePic || creatorData?.avatar || '',
              tags: data.tags || [],
              lastActive: data.lastActive?.toDate() || new Date(),
              maxMembers: data.maxMembers || 50,
              activeUsers: data.activeUsers || 0,
              isLive: data.isLive || false
            };

            setRooms(prevRooms => {
              if (!prevRooms.find(r => r.id === newRoom.id)) {
                setupRoomListener(newRoom.id);
                return [newRoom, ...prevRooms];
              }
              return prevRooms;
            });
          }
          if (change.type === 'removed') {
            setRooms(prevRooms => prevRooms.filter(room => room.id !== change.doc.id));
          }
        });
      });

      // Add the rooms listener to the cleanup list
      setRoomListeners(prev => [...prev, roomsListener]);

    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDefaultUsers();
    fetchRooms();
    fetchVideos();
    if (currentUser) {
      fetchFollowing();
    }
  }, [currentUser]);

  const fetchVideos = async () => {
    try {
      const videosRef = collection(db, 'videos');
      const q = firestoreQuery(
        videosRef,
        orderBy('timestamp', 'desc'),
        limit(20)
      );
      
      const querySnapshot = await getDocs(q);
      const videosData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Video[];
      
      setVideos(videosData);
    } catch (error) {
      console.error('Error fetching videos:', error);
    }
  };

  const fetchFollowing = async () => {
    if (!currentUser) return;
    try {
      const followingQuery = firestoreQuery(
        collection(db, `users/${currentUser.uid}/following`)
      );
      const snapshot = await getDocs(followingQuery);
      const followingIds = new Set(snapshot.docs.map(doc => doc.id));
      setFollowing(followingIds);
    } catch (error) {
      console.error('Error fetching following:', error);
    }
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
        // Follow
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

        toast.success('Followed user');
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast.error('Failed to update follow status');
    }
  };

  const handleVibitLike = async (videoId: string, authorIdFromProp: string) => {
    if (!currentUser || !db) return;
    console.log(`Discover: handleVibitLike triggered for videoId: ${videoId}`);
    const videoRef = doc(db, 'videos', videoId);
    const userId = currentUser.uid;
    const notificationCollectionRef = collection(db, 'notifications');

    try {
      let videoAuthorId: string | null = null;
      await runTransaction(db, async (transaction) => {
        const videoDoc = await transaction.get(videoRef);
        if (!videoDoc.exists()) {
          throw new Error("Video not found");
        }
        const videoData = videoDoc.data();
        videoAuthorId = videoData.userId;
        let likedBy = videoData.likedBy || [];

        if (likedBy.includes(userId)) {
          console.log('[Transaction] Discover: Unliking vibit...');
          likedBy = likedBy.filter((uid: string) => uid !== userId);
          transaction.update(videoRef, { likedBy: likedBy, likes: likedBy.length });
        } else {
          console.log('[Transaction] Discover: Liking vibit...');
          likedBy = [...likedBy, userId];
          transaction.update(videoRef, { likedBy: likedBy, likes: likedBy.length });
        }
      });
      console.log('Discover: Vibit like transaction successful.');

      // Create notification only if the user just liked it AND it's not their own video
      const videoDocAfter = await getDoc(videoRef);
      if (videoDocAfter.exists()) {
        const videoData = videoDocAfter.data();
        const likedBy = videoData.likedBy || [];
        if (likedBy.includes(userId) && videoAuthorId && videoAuthorId !== userId) { 
          console.log('Discover: Creating vibit like notification...');
          const senderName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Someone';
          const notificationPayload = {
            type: 'vibit_like',
            senderId: userId,
            senderName: senderName,
            senderAvatar: currentUser.photoURL || '',
            recipientId: videoAuthorId,
            postId: videoId,
            content: `${senderName} liked your vibit`,
            createdAt: serverTimestamp(),
            isRead: false
          };
          await addDoc(notificationCollectionRef, notificationPayload);
          console.log('Discover: Vibit like notification created.');
        }
      }

    } catch (error) {
      console.error('Discover: Error toggling vibit like:', error);
      toast.error('Failed to update like status');
    }
  };

  const handleVibitComment = async (videoId: string, content: string) => {
    if (!currentUser || !db || !content.trim()) return;
    console.log(`Discover: handleVibitComment triggered for videoId: ${videoId}`);
    
    const videoRef = doc(db, 'videos', videoId);
    const commentsCollectionRef = collection(db, `videos/${videoId}/comments`);
    const userId = currentUser.uid;
    const notificationCollectionRef = collection(db, 'notifications');
    let newCommentRefId: string | null = null;
    let videoAuthorId: string | null = null;

    try {
       // Update comment count in a transaction
      await runTransaction(db, async (transaction) => {
        const videoDoc = await transaction.get(videoRef);
        if (!videoDoc.exists()) {
          throw new Error("Video not found");
        }
        console.log('[Transaction] Discover: Incrementing vibit comment count...');
        videoAuthorId = videoDoc.data().userId;
        const currentComments = videoDoc.data().comments || 0; 
        transaction.update(videoRef, { comments: increment(currentComments + 1) });
      });

      // Add the comment document outside the transaction
      console.log('Discover: Adding vibit comment document...');
      const commentData = {
        content: content.trim(),
        authorId: userId,
        authorName: currentUser.displayName || 'Anonymous',
        authorAvatar: currentUser.photoURL || '',
        timestamp: serverTimestamp() as Timestamp,
        likes: 0
      };
      const newCommentRef = await addDoc(commentsCollectionRef, commentData);
      newCommentRefId = newCommentRef.id;
      console.log('Discover: Vibit comment document added.');

      // Create notification for video owner (if not self)
      if (videoAuthorId && videoAuthorId !== userId) { 
        console.log('Discover: Creating vibit comment notification...');
        const senderName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Someone';
        const notificationPayload = {
          type: 'vibit_comment',
          senderId: userId,
          senderName: senderName,
          senderAvatar: currentUser.photoURL || '',
          recipientId: videoAuthorId,
          postId: videoId,
          commentId: newCommentRefId,
          content: `${senderName} commented on your vibit: "${content.trim()}"`,
          createdAt: serverTimestamp(),
          isRead: false
        };
        await addDoc(notificationCollectionRef, notificationPayload);
        console.log('Discover: Vibit comment notification created.');

        // --- Mention Notification Logic --- 
        console.log('Discover: Checking for mentions in vibit comment...');
        const mentionRegex = /@(\w+)/g;
        const mentions = content.match(mentionRegex);
        if (mentions) {
          for (const mention of mentions) {
            const username = mention.substring(1);
            const userQuery = firestoreQuery(collection(db, 'users'), where('username', '==', username), limit(1));
            const userSnapshot = await getDocs(userQuery);
            if (!userSnapshot.empty) {
              const mentionedUser = userSnapshot.docs[0];
              if (mentionedUser.id !== userId && mentionedUser.id !== videoAuthorId) { 
                console.log(`Discover: Creating vibit mention notification for ${username}...`);
                const mentionSenderName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Someone';
                const mentionNotificationPayload = {
                  type: 'vibit_mention',
                  senderId: userId,
                  senderName: mentionSenderName,
                  senderAvatar: currentUser.photoURL || '',
                  recipientId: mentionedUser.id,
                  postId: videoId,
                  commentId: newCommentRefId,
                  content: `${mentionSenderName} mentioned you in a vibit comment: "${content.trim()}"`,
                  createdAt: serverTimestamp(),
                  isRead: false
                };
                await addDoc(notificationCollectionRef, mentionNotificationPayload);
                console.log(`Discover: Vibit mention notification created for ${username}.`);
              }
            }
          }
        } // --- End Mention Logic ---
      }

    } catch (error) {
      console.error('Discover: Error adding vibit comment:', error);
      toast.error('Failed to add comment');
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
    
    if (query.length < 2 && !isSubmit) {
      setIsSearchView(false);
      fetchRooms();
      return;
    }

    if (isSubmit) {
      setIsSearchView(true);
      setLoading(true);
      try {
        const searchTerm = query.toLowerCase();
        
        // Modified user search query
        const usersRef = collection(db, 'users');
        const usersQuery = firestoreQuery(
          usersRef,
          orderBy('username'),
          startAt(searchTerm),
          endAt(searchTerm + '\uf8ff'),
          limit(20)
        );

        // Search for rooms
        const roomsRef = collection(db, 'sideRooms');
        const roomsQuery = firestoreQuery(
          roomsRef,
          where('name_lower', '>=', searchTerm),
          where('name_lower', '<=', searchTerm + '\uf8ff'),
          limit(20)
        );

        const [usersSnapshot, roomsSnapshot] = await Promise.all([
          getDocs(usersQuery),
          getDocs(roomsQuery)
        ]);

        // Process users with additional name search if needed
        let usersData = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          username: doc.data().username || '',
          name: doc.data().name || '',
          bio: doc.data().bio || '',
          profilePic: doc.data().profilePic || '',
          isPublic: true,
          isAuthenticated: true,
          createdAt: doc.data().createdAt
        }));

        // If no results by username, try searching by name
        if (usersData.length === 0) {
          const nameQuery = firestoreQuery(
            usersRef,
            orderBy('name'),
            startAt(searchTerm),
            endAt(searchTerm + '\uf8ff'),
            limit(20)
          );
          const nameSnapshot = await getDocs(nameQuery);
          usersData = nameSnapshot.docs.map(doc => ({
            id: doc.id,
            username: doc.data().username || '',
            name: doc.data().name || '',
            bio: doc.data().bio || '',
            profilePic: doc.data().profilePic || '',
            isPublic: true,
            isAuthenticated: true,
            createdAt: doc.data().createdAt
          }));
        }

        // Process rooms (keep existing room processing logic)
        const roomsData = await Promise.all(roomsSnapshot.docs.map(async (docSnapshot) => {
          const data = docSnapshot.data();
          const roomData: FirestoreRoom = {
            id: docSnapshot.id,
            name: data.name || '',
            description: data.description || '',
            ownerId: data.ownerId || '',
            createdAt: data.createdAt,
            lastActive: data.lastActive,
            tags: data.tags || [],
            isPrivate: data.isPrivate || false,
            activeUsers: data.activeUsers || 0,
            isLive: data.isLive || false
          };

          let creatorData: FirestoreUser | null = null;
          if (roomData.ownerId) {
            const creatorDocRef = doc(db, 'users', roomData.ownerId);
            const creatorDocSnapshot = await getDoc(creatorDocRef);
            if (creatorDocSnapshot.exists()) {
              creatorData = creatorDocSnapshot.data() as FirestoreUser;
            }
          }

          return {
            id: docSnapshot.id,
            name: roomData.name,
            description: roomData.description,
            memberCount: data.memberCount || 0,
            shareCount: data.shareCount || 0,
            isPrivate: roomData.isPrivate,
            createdAt: roomData.createdAt?.toDate() || new Date(),
            creatorName: creatorData?.username || data.creatorName || '',
            creatorId: roomData.ownerId,
            creatorAvatar: creatorData?.profilePic || creatorData?.avatar || '',
            tags: roomData.tags || [],
            lastActive: roomData.lastActive?.toDate() || new Date(),
            maxMembers: data.maxMembers || 50,
            activeUsers: roomData.activeUsers,
            isLive: roomData.isLive
          };
        }));

        setUsers(usersData);
        setRooms(roomsData);
      } catch (error: any) {
        console.error('Search error:', error);
        toast.error(`Search failed: ${error.code || error.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch(searchQuery, true);
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
      
      // Modified query to search by username
      const usersQuery = firestoreQuery(
        usersRef,
        orderBy('username'),
        startAt(searchTerm),
        endAt(searchTerm + '\uf8ff'),
        limit(5)
      );

      const usersSnapshot = await getDocs(usersQuery);
      
      if (usersSnapshot.empty) {
        // If no results with username, try searching by display name
        const nameQuery = firestoreQuery(
          usersRef,
          orderBy('name'),
          startAt(searchTerm),
          endAt(searchTerm + '\uf8ff'),
          limit(5)
        );
        const nameSnapshot = await getDocs(nameQuery);
        const usersData = nameSnapshot.docs.map(doc => ({
          id: doc.id,
          username: doc.data().username || '',
          name: doc.data().name || '',
          bio: doc.data().bio || '',
          profilePic: doc.data().profilePic || '',
          isPublic: true,
          isAuthenticated: true,
          createdAt: doc.data().createdAt
        }));
        setDropdownUsers(usersData);
      } else {
        const usersData = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          username: doc.data().username || '',
          name: doc.data().name || '',
          bio: doc.data().bio || '',
          profilePic: doc.data().profilePic || '',
          isPublic: true,
          isAuthenticated: true,
          createdAt: doc.data().createdAt
        }));
        setDropdownUsers(usersData);
      }
      
      setShowDropdown(true);
    } catch (error) {
      console.error('Instant search error:', error);
      toast.error('Failed to search users');
    }
  };

  const handleClickAway = () => {
    setShowDropdown(false);
  };

  // Cleanup function for listeners
  useEffect(() => {
    return () => {
      // Cleanup all room listeners when component unmounts
      roomListeners.forEach(unsubscribe => unsubscribe());
    };
  }, [roomListeners]);

  const setupRoomListener = (roomId: string) => {
    // Create a real-time listener for room status and presence
    const roomRef = doc(db, 'sideRooms', roomId);
    const presenceRef = collection(db, 'sideRooms', roomId, 'presence');
    
    // Listen to presence collection for active users
    const presenceQuery = firestoreQuery(presenceRef, where("isOnline", "==", true));
    const presenceUnsubscribe = onSnapshot(presenceQuery, (presenceSnapshot) => {
      const activeUsers = presenceSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PresenceData[];
      
      // Find the room owner in the active users
      const roomOwner = activeUsers.find(user => user.role === 'owner');
      // Ensure isLive is always a boolean
      const isLive = Boolean(roomOwner && !roomOwner.isMuted);
      
      // Update room's active users count and live status in Firestore
      updateDoc(roomRef, {
        activeUsers: activeUsers.length,
        isLive: isLive,  // Now guaranteed to be a boolean
        lastActive: serverTimestamp()
      }).catch(error => {
        console.error(`Error updating room ${roomId} status:`, error);
      });
    });

    // Listen to room document for other changes
    const roomUnsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const roomData = snapshot.data();
        setRooms(prevRooms => {
          const updatedRooms = [...prevRooms];
          const roomIndex = updatedRooms.findIndex(r => r.id === roomId);
          if (roomIndex !== -1) {
            updatedRooms[roomIndex] = {
              ...updatedRooms[roomIndex],
              isLive: Boolean(roomData.isLive),  // Ensure boolean here too
              activeUsers: roomData.activeUsers || 0,
              lastActive: roomData.lastActive?.toDate() || new Date()
            };
          }
          return updatedRooms;
        });
      }
    });

    // Store both unsubscribe functions
    setRoomListeners(prevListeners => [...prevListeners, presenceUnsubscribe, roomUnsubscribe]);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      height: '100vh',
      overflowY: 'auto',
      position: 'relative',
      backgroundColor: theme.palette.background.default
    }}>
      {/* Header and Search Section */}
      <Box sx={{
        position: 'sticky',
        top: 0,
        backgroundColor: theme.palette.background.default,
        zIndex: 1000,
        pt: 2,
        pb: 2,
        borderBottom: 1,
        borderColor: 'divider'
      }}>
        <Container maxWidth={false} sx={{ maxWidth: '1440px' }}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography 
                variant={isMobile ? "h5" : "h4"} 
                component="h1"
                sx={{ fontWeight: 600 }}
              >
                {isSearchView ? 'Search Results' : 'Discover'}
              </Typography>
            </Box>
            <ClickAwayListener onClickAway={handleClickAway}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, position: 'relative' }}>
                {showSearch && (
                  <Box ref={searchRef}>
                    <TextField
                      size="small"
                      placeholder="Search rooms and users..."
                      value={searchQuery}
                      onChange={(e) => {
                        handleInstantSearch(e.target.value);
                        handleSearch(e.target.value);
                      }}
                      onKeyDown={handleSearchSubmit}
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
                        width: isMobile ? '200px' : '250px',
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 1,
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
                          borderRadius: 1
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
                                    src={user.profilePic} 
                                    alt={user.name}
                                    sx={{ width: 32, height: 32 }}
                                  >
                                    {user.name[0]}
                                  </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                  primary={
                                    <Typography variant="body1">
                                      {user.name}
                                    </Typography>
                                  }
                                  secondary={
                                    <Typography variant="body2" color="text.secondary">
                                      @{user.username}
                                    </Typography>
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
                                        handleFollow(user.id);
                                      }}
                                      color={following.has(user.id) ? "primary" : "default"}
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
                )}
                <IconButton 
                  onClick={() => setShowSearch(!showSearch)}
                  sx={{ 
                    backgroundColor: 'background.paper',
                    '&:hover': { backgroundColor: 'action.hover' }
                  }}
                >
                  <SearchIcon />
                </IconButton>
              </Box>
            </ClickAwayListener>
          </Box>
        </Container>
      </Box>

      {/* Search Results or Rooms Grid */}
      <Container 
        maxWidth={false} 
        sx={{ 
          pt: 3,
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
                            src={user.profilePic} 
                            alt={user.name}
                            sx={{ width: 50, height: 50 }}
                          >
                            {user.name[0]}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              {user.name}
                            </Typography>
                          }
                          secondary={
                            <>
                              <Typography variant="body2" color="text.secondary">
                                @{user.username}
                              </Typography>
                              {user.bio && (
                                <Typography 
                                  variant="body2" 
                                  color="text.secondary"
                                  sx={{
                                    mt: 0.5,
                                    display: '-webkit-box',
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
                                  navigate(`/messages/${user.id}`);
                                }}
                                size="small"
                              >
                                <MessageIcon />
                              </IconButton>
                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFollow(user.id);
                                }}
                                size="small"
                                color={following.has(user.id) ? "primary" : "default"}
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
                  {rooms.map((room) => (
                    <Grid item xs={12} sm={6} md={4} key={room.id}>
                      <Card 
                        sx={{ 
                          height: '100%',
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
                            image={room.creatorAvatar || '/default-room.jpg'}
                            alt={room.name}
                            sx={{ 
                              objectFit: 'cover',
                              width: '100%'
                            }}
                          />
                          {room.isLive && (
                            <Chip
                              label="LIVE"
                              color="error"
                              size="small"
                              sx={{ 
                                position: 'absolute',
                                top: 12,
                                right: 12,
                                fontWeight: 'bold',
                                fontSize: isMobile ? '0.75rem' : '0.875rem',
                                height: 'auto',
                                padding: '6px 12px'
                              }}
                            />
                          )}
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
                              icon={<PeopleIcon sx={{ fontSize: isMobile ? '1.1rem' : '1.25rem' }} />}
                              label={`${room.activeUsers || 0} viewing`}
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
          <Grid container spacing={3}>
            {rooms.map((room) => (
              <Grid item xs={12} sm={6} md={4} key={room.id}>
                <Card 
                  sx={{ 
                    height: '100%',
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
                      image={room.creatorAvatar || '/default-room.jpg'}
                      alt={room.name}
                      sx={{ 
                        objectFit: 'cover',
                        width: '100%'
                      }}
                    />
                    {room.isLive && (
                      <Chip
                        label="LIVE"
                        color="error"
                        size="small"
                        sx={{ 
                          position: 'absolute',
                          top: 12,
                          right: 12,
                          fontWeight: 'bold',
                          fontSize: isMobile ? '0.75rem' : '0.875rem',
                          height: 'auto',
                          padding: '6px 12px'
                        }}
                      />
                    )}
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
                        icon={<PeopleIcon sx={{ fontSize: isMobile ? '1.1rem' : '1.25rem' }} />}
                        label={`${room.activeUsers || 0} viewing`}
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
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
      </Container>
    </Box>
  );
};

export default Discover; 