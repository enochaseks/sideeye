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
  Public as PublicIcon
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
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showPeopleTab, setShowPeopleTab] = useState<boolean>(false);

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
      const usersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        username: doc.data().username || '',
        name: doc.data().name || '',
        profilePic: doc.data().profilePic,
        bio: doc.data().bio,
        coverPhoto: doc.data().coverPhoto,
        isPublic: doc.data().isPublic,
        isAuthenticated: doc.data().isAuthenticated,
        createdAt: doc.data().createdAt,
        isActive: doc.data().isActive
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
              thumbnailUrl: room.thumbnailUrl || ''
            } as Room;
          } catch (error) {
            console.error(`Error fetching owner data for room ${room.id}:`, error);
            return null;
          }
        })
      );

      // Filter out any null rooms from failed owner fetches
      setRooms(roomsWithOwnerData.filter(room => room !== null) as Room[]);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDefaultUsers();
    fetchRooms();
    if (currentUser) {
      fetchFollowing();
    }
  }, [currentUser]);

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

      // Search users
      const usersRef = collection(db, 'users');
      const usersQuery = firestoreQuery(
        usersRef,
        where('username', '>=', query.toLowerCase()),
        where('username', '<=', query.toLowerCase() + '\uf8ff'),
        limit(10)
      );
      const usersSnapshot = await getDocs(usersQuery);
      
      // Filter out blocked users and users who have blocked the current user
      const usersData = usersSnapshot.docs
        .map(doc => ({
          id: doc.id,
          username: doc.data().username || '',
          name: doc.data().name || '',
          bio: doc.data().bio || '',
          profilePic: doc.data().profilePic || '',
          isPublic: doc.data().isPublic ?? true,
          isAuthenticated: doc.data().isAuthenticated,
          createdAt: doc.data().createdAt,
          isActive: doc.data().isActive
        }))
        .filter(user => !excludeUserIds.includes(user.id));

      // Search rooms similarly filtering out rooms from blocked users
      const roomsRef = collection(db, 'sideRooms');
      const roomsQuery = firestoreQuery(
        roomsRef,
        where('name', '>=', query),
        where('name', '<=', query + '\uf8ff'),
        limit(10)
      );
      const roomsSnapshot = await getDocs(roomsQuery);
      
      // Filter out rooms owned by blocked users or users who have blocked the current user
      const roomsData = await Promise.all(
        roomsSnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          } as FirestoreRoom))
          .filter(room => room.ownerId && !excludeUserIds.includes(room.ownerId))
          .map(async (room) => {
            // Fetch room owner data
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
              // Return a default Room object if we can't fetch owner data
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

      setUsers(usersData);
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
        isActive: doc.data()?.isActive
      });
      
      // Modified query to search by username
      const usersQuery = firestoreQuery(
        usersRef,
        orderBy('username_lower'),
        startAt(searchTerm),
        endAt(searchTerm + '\uf8ff'),
        limit(5)
      );

      const usersSnapshot = await getDocs(usersQuery);
      let usersData = usersSnapshot.docs.map(mapDocToUser);
      
      if (usersData.length < 5) {
        // If not enough results with username, try searching by display name
        const nameQuery = firestoreQuery(
          usersRef,
          orderBy('name_lower'),
          startAt(searchTerm),
          endAt(searchTerm + '\uf8ff'),
          limit(5 - usersData.length)
        );
        const nameSnapshot = await getDocs(nameQuery);
        const nameUsersData = nameSnapshot.docs.map(mapDocToUser);
        // Combine and remove duplicates
        const combined = [...usersData, ...nameUsersData];
        usersData = Array.from(new Map(combined.map(u => [u.id, u])).values());
      } 
      
      setDropdownUsers(usersData.slice(0, 5));
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
      }));
      
      // Find the room owner in the active users
      // We assume 'user' objects coming from Firestore presence have a 'role' property.
      // Using 'as any' here suppresses the TypeScript error temporarily.
      // Ideally, the 'activeUsers' array should be strongly typed where it's created.
      const roomOwner = activeUsers.find(user => (user as any).role === 'owner');
      
      // Ensure isLive is always a boolean
      // We assume the 'roomOwner', if found, has an 'isMuted' property.
      // Using 'as any' again. The Boolean() conversion handles cases where roomOwner is null/undefined.
      const isLive = Boolean(roomOwner && !(roomOwner as any).isMuted);
      
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
          if (roomIndex !== -1 && snapshot.exists()) { // Check if snapshot exists
            const roomData = snapshot.data(); // Get data here
            updatedRooms[roomIndex] = {
              ...updatedRooms[roomIndex],
              isLive: Boolean(roomData.isLive),  // Ensure boolean here too
              activeUsers: roomData.activeUsers || 0,
              lastActive: roomData.lastActive?.toDate() || new Date(),
              thumbnailUrl: roomData.thumbnailUrl || updatedRooms[roomIndex].thumbnailUrl // Update thumbnail if changed
            };
          }
          return updatedRooms;
        });
      }
    });

    // Store both unsubscribe functions
    setRoomListeners(prevListeners => [...prevListeners, roomUnsubscribe]);
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
                                    src={user.isActive === false ? undefined : user.profilePic}
                                    alt={user.name}
                                    sx={{ width: 32, height: 32 }}
                                  >
                                    {(user.isActive !== false && !user.profilePic) ? user.name?.[0]?.toUpperCase() : null}
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

          {/* Main Tabs - Rooms vs People */}
          {!isSearchView && (
            <Tabs
              value={activeTab}
              onChange={handleMainTabChange}
              variant="standard"
              sx={{
                mb: 2,
                '& .MuiTabs-indicator': {
                  height: 3
                }
              }}
            >
              <Tab icon={<PublicIcon />} label="ROOMS" iconPosition="start" />
              <Tab icon={<PeopleIcon />} label="PEOPLE" iconPosition="start" />
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
                 mb: 3, // Margin below tabs
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
                            src={user.isActive === false ? undefined : user.profilePic}
                            alt={user.name}
                            sx={{ width: 50, height: 50 }}
                          >
                            {(user.isActive !== false && !user.profilePic) ? user.name?.[0]?.toUpperCase() : null}
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
                                  navigate(`/chat/${user.id}`);
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
                            image={room.thumbnailUrl || room.creatorAvatar || '/default-room.jpg'}
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
          // Show either Rooms (activeTab === 0) or People (activeTab === 1)
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
                        image={room.thumbnailUrl || room.creatorAvatar || '/default-room.jpg'}
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
          ) : (
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
                          py: 2,
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: 'action.hover'
                          },
                          borderRadius: 1
                        }}
                        onClick={() => navigate(`/profile/${user.id}`)}
                      >
                        <ListItemAvatar>
                          <Avatar 
                            src={user.isActive === false ? undefined : user.profilePic}
                            alt={user.name}
                            sx={{ width: 60, height: 60 }}
                          >
                            {(user.isActive !== false && !user.profilePic) ? user.name?.[0]?.toUpperCase() : null}
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
                          sx={{ ml: 2 }}
                        />
                        {currentUser && user.id !== currentUser.uid && (
                          <ListItemSecondaryAction>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<MessageIcon />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/chat/${user.id}`);
                                }}
                              >
                                Message
                              </Button>
                              <Button
                                variant={following.has(user.id) ? "contained" : "outlined"}
                                size="small"
                                startIcon={following.has(user.id) ? null : <PersonAddIcon />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFollow(user.id);
                                }}
                                color="primary"
                              >
                                {following.has(user.id) ? "Following" : "Follow"}
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
          )
        )}
      </Container>
    </Box>
  );
};

export default Discover; 