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
  Button
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
  Comment as CommentIcon
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
  increment
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import VibitIcon from '../components/VibitIcon';
import { formatTimestamp } from '../utils/dateUtils';

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

const Discover: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

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
      const roomsRef = collection(db, 'sideRooms');
      const q = firestoreQuery(
        roomsRef,
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      
      // Use onSnapshot instead of getDocs for real-time updates
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const roomsData = await Promise.all(snapshot.docs.map(async (docSnapshot) => {
          const roomData = docSnapshot.data();
          let creatorData = null;
          
          // Get creator data if ownerId exists
          if (roomData.ownerId) {
            const creatorDocRef = doc(db, 'users', roomData.ownerId);
            const creatorDocSnapshot = await getDoc(creatorDocRef);
            if (creatorDocSnapshot.exists()) {
              creatorData = creatorDocSnapshot.data();
            }
          }
          
          return {
            id: docSnapshot.id,
            name: roomData.name || 'Unnamed Room',
            description: roomData.description || '',
            memberCount: roomData.memberCount || 0,
            shareCount: roomData.shareCount || 0,
            isPrivate: roomData.isPrivate || false,
            createdAt: roomData.createdAt?.toDate() || new Date(),
            creatorName: creatorData?.username || roomData.creatorName || '',
            creatorId: roomData.ownerId || '',
            creatorAvatar: creatorData?.profilePic || creatorData?.avatar || '',
            tags: roomData.tags || [],
            lastActive: roomData.lastActive?.toDate() || new Date(),
            maxMembers: roomData.maxMembers || 50,
            activeUsers: roomData.activeUsers || 0,
            isLive: roomData.isLive || false
          };
        }));
        
        setRooms(roomsData);
        setLoading(false);
      }, (error) => {
        console.error('Error fetching rooms:', error);
        toast.error('Failed to load rooms');
        setLoading(false);
      });

      // Return unsubscribe function
      return () => unsubscribe();
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error('Failed to load rooms');
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

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (!currentUser || !db) {
      setUsers([]);
      setRooms([]);
      setVideos([]);
      return;
    }

    if (query.length < 2) {
      // If query is too short, fetch default data
      fetchDefaultUsers();
      fetchRooms();
      fetchVideos();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const searchTerm = query.toLowerCase();

      // Search for users
      const usersRef = collection(db, 'users');
      const usersQuery = firestoreQuery(
        usersRef,
        where('username_lower', '>=', searchTerm),
        where('username_lower', '<=', searchTerm + '\uf8ff'),
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

      // Search for videos
      const videosRef = collection(db, 'videos');
      const videosQuery = firestoreQuery(
        videosRef,
        where('title_lower', '>=', searchTerm),
        where('title_lower', '<=', searchTerm + '\uf8ff'),
        limit(20)
      );

      // Execute all queries in parallel
      const [usersSnapshot, roomsSnapshot, videosSnapshot] = await Promise.all([
        getDocs(usersQuery),
        getDocs(roomsQuery),
        getDocs(videosQuery)
      ]);

      // Process users results
      const usersData = usersSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          username: doc.data().username || '',
          name: doc.data().name || '',
          bio: doc.data().bio || '',
          profilePic: doc.data().profilePic || '',
          avatar: doc.data().avatar || '',
          createdAt: doc.data().createdAt
        } as FirestoreUser))
        .filter(user => 
          user.username.toLowerCase().includes(searchTerm) || 
          user.name.toLowerCase().includes(searchTerm) ||
          (user.bio && user.bio.toLowerCase().includes(searchTerm))
        );
      
      // Process rooms results
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
            const creatorDocData = creatorDocSnapshot.data();
            creatorData = {
              id: creatorDocSnapshot.id,
              username: creatorDocData.username || '',
              name: creatorDocData.name || '',
              profilePic: creatorDocData.profilePic || '',
              avatar: creatorDocData.avatar || '',
              createdAt: creatorDocData.createdAt
            } as FirestoreUser;
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
          tags: roomData.tags,
          lastActive: roomData.lastActive?.toDate() || new Date(),
          maxMembers: data.maxMembers || 50,
          activeUsers: roomData.activeUsers,
          isLive: roomData.isLive
        };
      }));

      // Filter rooms by search term
      const filteredRooms = roomsData.filter(room => 
        room.name.toLowerCase().includes(searchTerm) || 
        room.description.toLowerCase().includes(searchTerm) ||
        room.tags?.some((tag: string) => tag.toLowerCase().includes(searchTerm))
      );

      // Convert room data to Room type
      const roomResults = filteredRooms.map(room => ({
        id: room.id,
        name: room.name,
        description: room.description,
        memberCount: room.memberCount || 0,
        shareCount: room.shareCount || 0,
        isPrivate: room.isPrivate,
        createdAt: room.createdAt,
        creatorName: room.creatorName,
        creatorId: room.creatorId,
        creatorAvatar: room.creatorAvatar,
        tags: room.tags || [],
        lastActive: room.lastActive,
        maxMembers: room.maxMembers || 50,
        activeUsers: room.activeUsers,
        isLive: room.isLive
      })) as Room[];

      // Process videos results
      const videosData = videosSnapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || '',
            description: data.description || '',
            username: data.username || '',
            userId: data.userId || '',
            url: data.url || '',
            thumbnailUrl: data.thumbnailUrl || '',
            timestamp: data.timestamp
          } as FirestoreVideo;
        })
        .filter(video => 
          video.title.toLowerCase().includes(searchTerm) ||
          (video.description && video.description.toLowerCase().includes(searchTerm)) ||
          video.username.toLowerCase().includes(searchTerm)
        );

      // Convert FirestoreUser to UserProfile
      const userProfiles = usersData.map(user => ({
        id: user.id,
        username: user.username,
        name: user.name,
        profilePic: user.profilePic || '',
        bio: user.bio || '',
        coverPhoto: user.coverPhoto || '',
        isPublic: true,
        isAuthenticated: true,
        createdAt: user.createdAt
      }));

      // Convert FirestoreVideo to Video
      const videoResults = videosData.map(video => ({
        id: video.id,
        title: video.title,
        description: video.description || '',
        username: video.username,
        userId: video.userId,
        url: video.url,
        thumbnailUrl: video.thumbnailUrl || '',
        timestamp: video.timestamp,
        likes: 0,
        comments: 0
      }));

      setUsers(userProfiles);
      setRooms(roomResults);
      setVideos(videoResults);

    } catch (error: any) {
      console.error('Search error:', error);
      setError(`Failed to perform search: ${error.message}`);
      toast.error(`Search failed: ${error.code || error.message}`);
      // Fallback to default data on error
      fetchDefaultUsers();
      fetchRooms();
      fetchVideos();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <TrendingIcon fontSize="large" color="primary" />
        <Typography variant="h4" component="h1">
          Discover
        </Typography>
      </Box>

      <Paper sx={{ p: 2, mb: 4 }}>
        <TextField
          fullWidth
          placeholder="Search users and rooms..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: loading && (
              <InputAdornment position="end">
                <CircularProgress size={20} />
              </InputAdornment>
            )
          }}
        />
      </Paper>

      <Box sx={{ width: '100%', mb: 4 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab icon={<PeopleIcon />} label="People" />
          <Tab icon={<GroupIcon />} label="Rooms" />
          <Tab icon={<VibitIcon />} label="Vibits" />
        </Tabs>
      </Box>
      
      {activeTab === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Users Section */}
          <Paper>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6" component="h2">
                Users
              </Typography>
            </Box>
            <List>
              {users.length === 0 ? (
                <ListItem>
                  <ListItemText 
                    primary="No users found" 
                    secondary="Try a different search term"
                  />
                </ListItem>
              ) : (
                users.map((user, index) => (
                  <React.Fragment key={user.id}>
                    <ListItem
                      secondaryAction={
                        user.id !== currentUser?.uid && (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton
                              edge="end"
                              onClick={() => navigate(`/messages/${user.id}`)}
                              title="Send message"
                            >
                              <MessageIcon />
                            </IconButton>
                            <IconButton
                              edge="end"
                              onClick={() => handleFollow(user.id)}
                              title={following.has(user.id) ? "Unfollow user" : "Follow user"}
                              color={following.has(user.id) ? "primary" : "default"}
                            >
                              <PersonAddIcon />
                            </IconButton>
                          </Box>
                        )
                      }
                    >
                      <ListItemAvatar>
                        <Avatar src={user.profilePic} alt={user.name}>
                          {user.name[0]}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={user.name}
                        secondary={
                          <React.Fragment>
                            @{user.username}
                            {user.bio && (
                              <Typography
                                component="span"
                                variant="body2"
                                color="text.secondary"
                                sx={{ display: 'block' }}
                              >
                                {user.bio.length > 100 
                                  ? `${user.bio.substring(0, 100)}...` 
                                  : user.bio}
                              </Typography>
                            )}
                          </React.Fragment>
                        }
                        onClick={() => handleUserClick(user.id)}
                        sx={{ cursor: 'pointer' }}
                      />
                    </ListItem>
                    {index < users.length - 1 && <Divider />}
                  </React.Fragment>
                ))
              )}
            </List>
          </Paper>
        </Box>
      )}
      
      {activeTab === 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Rooms Section */}
          <Paper>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6" component="h2">
                Rooms
              </Typography>
            </Box>
            <List>
              {rooms.length === 0 ? (
                <ListItem>
                  <ListItemText 
                    primary="No rooms found" 
                    secondary="No side rooms have been created yet."
                  />
                </ListItem>
              ) : (
                rooms.map((room, index) => (
                  <React.Fragment key={room.id}>
                    <ListItem
                      secondaryAction={
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Chip
                            icon={<PeopleIcon />}
                            label={`${room.activeUsers || 0} viewing`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                          {room.isLive && (
                            <Chip
                              label="Live"
                              color="error"
                              size="small"
                            />
                          )}
                          {room.isPrivate && (
                            <Chip
                              label="Private"
                              color="secondary"
                              size="small"
                            />
                          )}
                        </Box>
                      }
                    >
                      <ListItemAvatar>
                        <Link to={`/profile/${room.creatorId}`} style={{ textDecoration: 'none' }}>
                          <Avatar 
                            src={room.creatorAvatar}
                            alt={room.creatorName}
                          >
                            {room.creatorName ? room.creatorName.charAt(0).toUpperCase() : '?'}
                          </Avatar>
                        </Link>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle1">{room.name}</Typography>
                            {room.tags && room.tags.map((tag, i) => (
                              <Chip
                                key={i}
                                label={tag}
                                size="small"
                                sx={{ height: 20 }}
                              />
                            ))}
                          </Box>
                        }
                        secondary={
                          <React.Fragment>
                            <Typography
                              component="span"
                              variant="body2"
                              color="text.secondary"
                              sx={{ display: 'block' }}
                            >
                              {room.description}
                            </Typography>
                            <Typography
                              component="span"
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: 'block', mt: 0.5 }}
                            >
                              Created by{' '}
                              {room.creatorName ? (
                                <Link 
                                  to={`/profile/${room.creatorId}`}
                                  style={{ textDecoration: 'none', color: 'inherit', fontWeight: 'bold' }}
                                >
                                  {room.creatorName}
                                </Link>
                              ) : (
                                <span style={{ fontStyle: 'italic' }}>deleted user</span>
                              )}
                              {' • '}
                              Last active {formatTimestamp(room.lastActive)}
                            </Typography>
                          </React.Fragment>
                        }
                        onClick={() => handleRoomClick(room.id)}
                        sx={{ cursor: 'pointer' }}
                      />
                    </ListItem>
                    {index < rooms.length - 1 && <Divider />}
                  </React.Fragment>
                ))
              )}
            </List>
          </Paper>
        </Box>
      )}
      
      {activeTab === 2 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Vibits Section */}
          <Paper>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <VibitIcon color="primary" /> Vibits
              </Typography>
            </Box>
            
            {videos.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary">
                  No videos found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Check back later or upload your own!
                </Typography>
                <Button 
                  variant="contained" 
                  color="primary" 
                  sx={{ mt: 2 }}
                  onClick={() => navigate('/vibits')}
                  startIcon={<VibitIcon />}
                >
                  Go to Vibits
                </Button>
              </Box>
            ) : (
              <Grid container spacing={2} sx={{ p: 2 }}>
                {videos.map((video) => (
                  <Grid item xs={12} sm={6} md={4} key={video.id}>
                    <Card key={video.id} sx={{ position: 'relative' }}>
                      <CardMedia
                        component="video"
                        image={video.thumbnailUrl || video.url}
                        sx={{
                          height: { xs: 'auto', sm: 200 },
                          width: '100%',
                          aspectRatio: '16/9',
                          objectFit: 'cover',
                          backgroundColor: 'black',
                          '@media (max-width: 600px)': {
                            height: 'auto',
                            maxHeight: '60vh',
                            objectFit: 'contain'
                          }
                        }}
                        controls
                        preload="metadata"
                        playsInline
                        muted
                        loop
                        poster={video.thumbnailUrl}
                      />
                      <Box sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        p: 1,
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                        color: 'white'
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="subtitle2">@{video.username}</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <FavoriteIcon fontSize="small" />
                              <Typography variant="caption" sx={{ ml: 0.5 }}>{video.likes}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <CommentIcon fontSize="small" />
                              <Typography variant="caption" sx={{ ml: 0.5 }}>{video.comments}</Typography>
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        </Box>
      )}
    </Container>
  );
};

export default Discover; 