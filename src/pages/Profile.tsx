import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  TextField, 
  Button, 
  Avatar,
  Card,
  CardContent,
  Chip,
  IconButton,
  Paper,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Badge,
  Alert,
  Menu,
  MenuItem,
  CardActions,
  CardMedia,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  List,
  ListItem,
  Tabs,
  Tab,
  LinearProgress
} from '@mui/material';
import { 
  Edit as EditIcon,
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
  PhotoCamera,
  Message as MessageIcon,
  Lock as LockIcon,
  Group,
  Lock,
  MoreVert as MoreVertIcon,
  Block as BlockIcon,
  Report as ReportIcon,
  VerifiedUser as VerifiedUserIcon,
  Home as HomeIcon,
  CardGiftcard as CardGiftcardIcon,
  Close as CloseIcon,
  ArrowBackIos as ArrowBackIcon,
  ArrowForwardIos as ArrowForwardIcon
} from '@mui/icons-material';
import { auth, storage } from '../services/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, arrayUnion, arrayRemove, addDoc, onSnapshot, orderBy, serverTimestamp, setDoc, deleteDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { User, UserProfile, SideRoom, UserSideRoom } from '../types/index';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFirestore } from '../context/FirestoreContext';
import { toast } from 'react-hot-toast';
import { Firestore } from 'firebase/firestore';
import GiftsSent from '../components/GiftsSent';

interface ProfileProps {
  userId?: string;
}

interface Story {
  id: string;
  userId: string;
  username: string;
  userAvatar: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  createdAt: Timestamp;
  expiresAt: Timestamp;
  views: string[];
  isViewed?: boolean;
}

// Simple component to display when a profile is deactivated
const DeactivatedProfileMessage: React.FC = () => (
  <Container maxWidth="sm" sx={{ mt: 4, textAlign: 'center' }}>
    <Paper elevation={2} sx={{ p: 3 }}>
      <LockIcon sx={{ fontSize: 40, mb: 2 }} color="action" />
      <Typography variant="h6" gutterBottom>
        Account Deactivated
      </Typography>
      <Typography color="text.secondary">
        This user's account is currently deactivated.
      </Typography>
    </Paper>
  </Container>
);

const Profile: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { currentUser, user, userProfile, loading: authLoading, setUserProfile, blockUser } = useAuth();
  const { db } = useFirestore();
  const { userId: urlParam } = useParams<{ userId: string }>();
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connections, setConnections] = useState<string[]>([]);
  const [followers, setFollowers] = useState<string[]>([]);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [canViewFullProfile, setCanViewFullProfile] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followRequested, setFollowRequested] = useState(false);
  const [pendingFollowRequests, setPendingFollowRequests] = useState<any[]>([]);
  const [showFollowRequestsDialog, setShowFollowRequestsDialog] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [editedUsername, setEditedUsername] = useState('');
  const [joinedRooms, setJoinedRooms] = useState<UserSideRoom[]>([]);
  const [createdRooms, setCreatedRooms] = useState<SideRoom[]>([]);
  const [isDeactivated, setIsDeactivated] = useState(false);
  const navigate = useNavigate();
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  
  // Username validation states
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameTaken, setUsernameTaken] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameOptions, setUsernameOptions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const originalUsername = useRef<string>('');

  // Tab state
  const [activeTab, setActiveTab] = useState<'sideRooms' | 'giftsSent'>('sideRooms');

  // Story-related state
  const [userStories, setUserStories] = useState<Story[]>([]);
  const [hasActiveStories, setHasActiveStories] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const [storyViewers, setStoryViewers] = useState<Array<{id: string, username: string, avatar: string}>>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const storyViewerTimeout = useRef<NodeJS.Timeout | null>(null);
  const [isStoryViewerOpening, setIsStoryViewerOpening] = useState(false);

  const userId = targetUserId || currentUser?.uid || '';

  // Function to fetch user stories
  const fetchUserStories = useCallback(async () => {
    if (!db || !targetUserId) return;

    try {
      // Fetch stories from the last 24 hours for this specific user
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const storiesQuery = query(
        collection(db, 'stories'),
        where('userId', '==', targetUserId),
        where('expiresAt', '>', Timestamp.fromDate(twentyFourHoursAgo)),
        orderBy('expiresAt'),
        orderBy('createdAt', 'desc')
      );

      const storiesSnapshot = await getDocs(storiesQuery);
      const stories: Story[] = [];

      for (const storyDoc of storiesSnapshot.docs) {
        const storyData = storyDoc.data();
        
        // Get user data
        const userDocRef = doc(db, 'users', storyData.userId);
        const userDocSnap = await getDoc(userDocRef);
        const userData = userDocSnap.data();

        stories.push({
          id: storyDoc.id,
          userId: storyData.userId,
          username: userData?.username || userData?.name || 'Unknown User',
          userAvatar: userData?.profilePic || userData?.photoURL || '',
          content: storyData.content || '',
          mediaUrl: storyData.mediaUrl,
          mediaType: storyData.mediaType,
          createdAt: storyData.createdAt,
          expiresAt: storyData.expiresAt,
          views: storyData.views || [],
          isViewed: storyData.views?.includes(currentUser?.uid || '') || false
        });
      }

      setUserStories(stories);
      setHasActiveStories(stories.length > 0);
    } catch (error) {
      console.error('Error fetching user stories:', error);
    }
  }, [db, targetUserId, currentUser?.uid]);

  // Mark story as viewed
  const markStoryAsViewed = async (storyId: string) => {
    if (!currentUser || !db) return;

    try {
      const storyRef = doc(db, 'stories', storyId);
      await updateDoc(storyRef, {
        views: arrayUnion(currentUser.uid)
      });
    } catch (error) {
      console.error('Error marking story as viewed:', error);
    }
  };

  // Delete story
  const deleteStory = async (storyId: string) => {
    if (!currentUser || !db) return;

    try {
      await deleteDoc(doc(db, 'stories', storyId));
      setShowViewers(false);
      setShowStoryViewer(false);
      setShowDeleteConfirm(false);
      toast.success('Story deleted successfully!');
      
      // Refresh stories
      setTimeout(async () => {
        await fetchUserStories();
      }, 500);
    } catch (error) {
      console.error('Error deleting story:', error);
      toast.error('Failed to delete story');
    }
  };

  // Get story viewers
  const getStoryViewers = async (storyId: string) => {
    if (!currentUser || !db) return;

    try {
      const storyRef = doc(db, 'stories', storyId);
      const storyDoc = await getDoc(storyRef);
      
      if (storyDoc.exists()) {
        const storyData = storyDoc.data();
        const viewerIds = storyData.views || [];
        
        const viewers = [];
        for (const viewerId of viewerIds) {
          const userRef = doc(db, 'users', viewerId);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            viewers.push({
              id: viewerId,
              username: userData.username || userData.name || 'Unknown User',
              avatar: userData.profilePic || userData.photoURL || ''
            });
          }
        }
        
        setStoryViewers(viewers);
        setShowViewers(true);
      }
    } catch (error) {
      console.error('Error getting story viewers:', error);
      toast.error('Failed to load viewers');
    }
  };

  // Handle story viewing
  const openStoryViewer = (event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (userStories.length === 0 || isStoryViewerOpening) return;
    
    setIsStoryViewerOpening(true);
    
    // Prevent multiple rapid clicks/taps
    if (storyViewerTimeout.current) {
      clearTimeout(storyViewerTimeout.current);
    }
    
    // Debounce the story viewer opening
    storyViewerTimeout.current = setTimeout(() => {
      setShowStoryViewer(true);
      setCurrentStoryIndex(0);
      setStoryProgress(0);
      
      // Mark first story as viewed if not own story
      if (userStories[0] && userStories[0].userId !== currentUser?.uid) {
        markStoryAsViewed(userStories[0].id);
      }
      
      // Reset the flag after opening
      setTimeout(() => {
        setIsStoryViewerOpening(false);
      }, 500);
    }, 100);
  };

  // Navigate stories
  const goToNextStory = () => {
    const nextIndex = currentStoryIndex + 1;
    if (nextIndex < userStories.length) {
      setCurrentStoryIndex(nextIndex);
      setStoryProgress(0);
      if (userStories[nextIndex].userId !== currentUser?.uid) {
        markStoryAsViewed(userStories[nextIndex].id);
      }
    } else {
      setShowStoryViewer(false);
    }
  };

  const goToPreviousStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(currentStoryIndex - 1);
      setStoryProgress(0);
    }
  };

  // Function to check if username exists in Firestore
  const checkUsernameExists = async (username: string): Promise<boolean> => {
    if (!db) return false;
    
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username));
      const snapshot = await getDocs(q);
      
      // If we found the same username but it belongs to the current user, it's not taken
      if (!snapshot.empty && snapshot.docs.length === 1) {
        const foundUserId = snapshot.docs[0].id;
        if (foundUserId === currentUser?.uid) {
          return false; // Not taken, it's the current user's username
        }
      }
      
      return !snapshot.empty; // Taken if there are any documents
    } catch (error) {
      console.error('Error checking username:', error);
      return false;
    }
  };

  // Function to generate username suggestions
  const generateUsernameSuggestions = (username: string): string[] => {
    const suggestions: string[] = [];
    
    // Add a random number
    suggestions.push(`${username}${Math.floor(Math.random() * 100)}`);
    
    // Add the current year
    const currentYear = new Date().getFullYear();
    suggestions.push(`${username}${currentYear}`);
    
    // Add underscore and random number
    suggestions.push(`${username}_${Math.floor(Math.random() * 100)}`);
    
    // Add a prefix
    suggestions.push(`real_${username}`);
    
    // Add a suffix with random number
    suggestions.push(`${username}${Math.floor(Math.random() * 1000)}`);
    
    return suggestions;
  };
  
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUsername = e.target.value;
    setEditedUsername(newUsername);
    
    // Reset states
    if (newUsername === originalUsername.current) {
      setUsernameTaken(false);
      setUsernameError(null);
      setShowSuggestions(false);
      return;
    }
    
    // Basic validation
    if (!/^[a-zA-Z0-9_-]+$/.test(newUsername)) {
      setUsernameError('Username can only contain letters, numbers, underscores, and hyphens');
      return;
    } else if (newUsername.length < 3) {
      setUsernameError('Username must be at least 3 characters long');
      return;
    } else {
      setUsernameError(null);
    }
  };
  
  // Effect to validate username when it changes
  useEffect(() => {
    let isActive = true;
    const debounceTimeout = setTimeout(async () => {
      // Skip validation for empty usernames or if it's the original username
      if (!editedUsername || editedUsername === originalUsername.current || editedUsername.length < 3 || !currentUser) {
        return;
      }
      
      // Basic validation
      if (!/^[a-zA-Z0-9_-]+$/.test(editedUsername)) {
        return;
      }
      
      setCheckingUsername(true);
      
      try {
        const exists = await checkUsernameExists(editedUsername);
        
        if (!isActive) return;
        
        if (exists) {
          setUsernameTaken(true);
          setUsernameError('Username is already taken');
          
          // Generate suggestions
          const suggestions = generateUsernameSuggestions(editedUsername);
          
          // Verify suggestions are available
          const validatedSuggestions: string[] = [];
          
          // Check each suggestion in parallel
          const checkResults = await Promise.all(
            suggestions.map(async (suggestion) => {
              const exists = await checkUsernameExists(suggestion);
              return { suggestion, exists };
            })
          );
          
          // Filter out taken usernames
          checkResults.forEach(result => {
            if (!result.exists) {
              validatedSuggestions.push(result.suggestion);
            }
          });
          
          if (!isActive) return;
          
          setUsernameOptions(validatedSuggestions);
          setShowSuggestions(validatedSuggestions.length > 0);
        } else {
          setUsernameTaken(false);
          setUsernameError(null);
          setUsernameOptions([]);
          setShowSuggestions(false);
        }
      } catch (error) {
        console.error('Error validating username:', error);
      } finally {
        if (isActive) {
          setCheckingUsername(false);
        }
      }
    }, 500);

    return () => {
      isActive = false;
      clearTimeout(debounceTimeout);
    };
  }, [editedUsername, db, currentUser?.uid]);

  const handleSuggestionClick = (suggestion: string) => {
    setEditedUsername(suggestion);
    setUsernameTaken(false);
    setUsernameError(null);
    setShowSuggestions(false);
  };

  useEffect(() => {
    if (!urlParam) {
      setTargetUserId(currentUser?.uid || null);
    } else {
      setTargetUserId(urlParam);
    }
  }, [urlParam, currentUser?.uid]);

  useEffect(() => {
    if (!currentUser || !targetUserId || currentUser.uid === targetUserId) {
      // Own profile is always visible
      return;
    }

    // Check if current user is blocked by the target
    const checkIfBlockedByTarget = async () => {
      if (!db) return;
      
      try {
        const targetUserRef = doc(db, 'users', targetUserId);
        const targetUserDoc = await getDoc(targetUserRef);
        
        if (targetUserDoc.exists()) {
          const targetUserData = targetUserDoc.data();
          const blockedUsers = targetUserData.blockedUsers || [];
          
          // If the current user is blocked by the target user, redirect to discover page
          if (blockedUsers.includes(currentUser.uid)) {
            // Redirect to discover page - profile not found
            navigate('/discover');
          }
        }
      } catch (error) {
        console.error('Error checking if blocked by target:', error);
        navigate('/discover');
      }
    };
    
    // Check if we are blocked
    checkIfBlockedByTarget();
    
    // Check if we have blocked the target
    const hasBlockedTarget = currentUser.blockedUsers?.includes(targetUserId);
    if (hasBlockedTarget) {
      // Redirect to discover page - profile not found
      navigate('/discover');
    }
  }, [currentUser, targetUserId, db, navigate]);

  const fetchUserData = useCallback(async () => {
    if (!db || !targetUserId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setIsDeactivated(false);

      const userRef = doc(db, 'users', targetUserId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        setError('Profile not found');
        setIsLoading(false);
        return;
      }

      const userData = userDoc.data() as UserProfile;
      
      // Set user as verified
      userData.isVerified = true;
      
      // Update user profile in context if it's the current user
      if (currentUser?.uid === targetUserId && setUserProfile && userProfile) {
        const updatedProfile: UserProfile = {
          ...userProfile,
          isVerified: true
        };
        setUserProfile(updatedProfile);
      }

      if (userData.isActive === false) {
        setIsDeactivated(true);
        setError(null);
        setIsLoading(false);
        return;
      }

      const isPrivateAccount = userData.isPrivate || false;
      const isOwnProfile = currentUser?.uid === targetUserId;
      
      setIsPrivate(isPrivateAccount);
      setUsername(userData.username || '');
      setName(userData.name || '');
      setBio(userData.bio || '');
      setProfilePic(userData.profilePic || null);
      setEmail(userData.email || '');

      if (isOwnProfile || !isPrivateAccount) {
        setCanViewFullProfile(true);
        setError(null);
      } else {
        if (currentUser?.uid) {
          const followerRef = doc(db, `users/${targetUserId}/followers/${currentUser.uid}`);
          const followerDoc = await getDoc(followerRef);
          const isFollower = followerDoc.exists();
          
          setCanViewFullProfile(isFollower);
          if (!isFollower) {
            setError('This profile is private');
          }
        } else {
          setCanViewFullProfile(false);
          setError('This profile is private');
        }
      }

      // Fetch followers and following
      const [followersSnapshot, followingSnapshot] = await Promise.all([
        getDocs(collection(db, `users/${targetUserId}/followers`)),
        getDocs(collection(db, `users/${targetUserId}/following`))
      ]);

      setFollowers(followersSnapshot.docs.map(doc => doc.id));
      setConnections(followingSnapshot.docs.map(doc => doc.id));

      // Fetch side rooms
      const [joinedRoomsSnapshot, createdRoomsSnapshot] = await Promise.all([
        getDocs(query(
          collection(db, 'sideRooms'),
          where('members', 'array-contains', targetUserId)
        )),
        getDocs(query(
          collection(db, 'sideRooms'),
          where('ownerId', '==', targetUserId),
          where("deleted", "==", false)
        ))
      ]);

      setJoinedRooms(joinedRoomsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as UserSideRoom)));

      setCreatedRooms(createdRoomsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SideRoom)));

    } catch (error) {
      console.error('Error in fetchUserData:', error);
      setError('Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  }, [db, targetUserId, currentUser, setUserProfile]);

  useEffect(() => {
    fetchUserData();
    fetchUserStories();
  }, [fetchUserData, fetchUserStories]);

  // Story progress timer - pauses when viewers dialog is open
  useEffect(() => {
    if (showStoryViewer && userStories.length > 0 && !showViewers) {
      progressInterval.current = setInterval(() => {
        setStoryProgress(prev => {
          if (prev >= 100) {
            // Move to next story
            const nextIndex = currentStoryIndex + 1;
            if (nextIndex < userStories.length) {
              setCurrentStoryIndex(nextIndex);
              // Mark next story as viewed
              if (userStories[nextIndex].userId !== currentUser?.uid) {
                markStoryAsViewed(userStories[nextIndex].id);
              }
              return 0;
            } else {
              // Close viewer
              setShowStoryViewer(false);
              return 0;
            }
          }
          return prev + 2; // 5 seconds per story (100/20 = 5)
        });
      }, 100);
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [showStoryViewer, currentStoryIndex, currentUser, showViewers, userStories]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
      if (storyViewerTimeout.current) {
        clearTimeout(storyViewerTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!db || !userId) return;

    const followersRef = collection(db, 'users', userId, 'followers');
    const unsubscribe = onSnapshot(followersRef, (snapshot) => {
      const newFollowers = snapshot.docs.map(doc => doc.id);
      setFollowers(newFollowers);
    });

    // Debug: Fetch user data to verify the profile picture field
    const fetchUserDataForDebug = async () => {
      try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          console.log('DEBUG - User data structure:', userData);
          console.log('DEBUG - Profile pic field:', userData.profilePic);
          // Also check if there's an alternate field name that might be used
          console.log('DEBUG - Alternate fields:', {
            photoURL: userData.photoURL,
            avatarUrl: userData.avatarUrl,
            avatar: userData.avatar,
            photo: userData.photo,
            image: userData.image,
            profileImage: userData.profileImage
          });
        }
      } catch (error) {
        console.error('Error in debug fetch:', error);
      }
    };
    
    fetchUserDataForDebug();

    return () => unsubscribe();
  }, [db, userId]);

  useEffect(() => {
    if (!db || !userId) return;

    const followingRef = collection(db, 'users', userId, 'following');
    const unsubscribe = onSnapshot(followingRef, (snapshot) => {
      const newFollowing = snapshot.docs.map(doc => doc.id);
      setConnections(newFollowing);
    });

    return () => unsubscribe();
  }, [db, userId]);

  // EMERGENCY FIX: Force following state to sync by checking both collections
  useEffect(() => {
    if (!db || !currentUser || !userId) return;

    // Check both collections IMMEDIATELY at page load
    const forceFollowStateCheck = async () => {
      console.log("EMERGENCY: Checking follow state for", userId);
      
      try {
        // First, check our following collection
        const myFollowingRef = doc(db, 'users', currentUser.uid, 'following', userId);
        const followingDoc = await getDoc(myFollowingRef);
        
        // Then, check their followers collection
        const theirFollowersRef = doc(db, 'users', userId, 'followers', currentUser.uid);
        const followerDoc = await getDoc(theirFollowersRef);
        
        // If either indicates following, show as following
        if (followingDoc.exists() || followerDoc.exists()) {
          console.log("EMERGENCY: Setting isFollowing to TRUE for", userId);
          setIsFollowing(true);
          setFollowRequested(false);
          
          // Force data consistency in both directions
          if (!followingDoc.exists()) {
            await setDoc(myFollowingRef, { timestamp: serverTimestamp() });
            console.log("EMERGENCY: Fixed missing following entry for", userId);
          }
          
          if (!followerDoc.exists()) {
            await setDoc(theirFollowersRef, { timestamp: serverTimestamp() });
            console.log("EMERGENCY: Fixed missing follower entry for", userId);
          }
          
          return; // We've determined following status
        }
        
        // Next check for follow requests
        const requestRef = doc(db, 'users', userId, 'followRequests', currentUser.uid);
        const requestDoc = await getDoc(requestRef);
        
        if (requestDoc.exists()) {
          console.log("EMERGENCY: Setting followRequested to TRUE for", userId);
          setFollowRequested(true);
          setIsFollowing(false);
        } else {
          setFollowRequested(false);
          setIsFollowing(false);
        }
      } catch (error) {
        console.error("EMERGENCY: Error checking follow state:", error);
      }
    };
    
    // Run the emergency check immediately
    forceFollowStateCheck();
    
    // Set up real-time listeners
    const followingRef = doc(db, 'users', currentUser.uid, 'following', userId);
    const followerRef = doc(db, 'users', userId, 'followers', currentUser.uid);
    const requestRef = doc(db, 'users', userId, 'followRequests', currentUser.uid);
    
    // Monitor BOTH following and followers collections
    const unsubFollowing = onSnapshot(followingRef, (doc) => {
      if (doc.exists()) {
        console.log("EMERGENCY: following doc changed, exists=", doc.exists());
        setIsFollowing(true);
        setFollowRequested(false);
      }
    });
    
    const unsubFollower = onSnapshot(followerRef, (doc) => {
      if (doc.exists()) {
        console.log("EMERGENCY: follower doc changed, exists=", doc.exists());
        setIsFollowing(true);
        setFollowRequested(false);
        
        // Ensure consistency in following collection too
        setDoc(followingRef, { timestamp: serverTimestamp() })
          .catch(err => console.error("Failed to sync following doc:", err));
      }
    });
    
    // Also listen for follow requests
    const unsubRequest = onSnapshot(requestRef, (doc) => {
      if (doc.exists() && !isFollowing) {
        console.log("EMERGENCY: request doc changed, exists=", doc.exists());
        setFollowRequested(true);
      }
    });

    return () => {
      unsubFollowing();
      unsubFollower();
      unsubRequest();
    };
  }, [db, currentUser, userId, isFollowing]);

  useEffect(() => {
    if (isEditing) {
      setEditedName(name);
      setEditedUsername(username);
      originalUsername.current = username; // Store the original username
      setEditedBio(bio);
    }
  }, [isEditing, name, username, bio]);

  const handleFollow = async () => {
    if (!currentUser || !userId || !db) {
      setError('Database not initialized');
      return;
    }

    try {
      setIsLoading(true);
      
      // Update UI state FIRST before any async operations
      if (isPrivate) {
        // Immediately update UI for request
        setFollowRequested(true);
      } else {
        // Immediately update UI for follow
        setIsFollowing(true);
      }
      
      // Check if the target account is private
      if (isPrivate) {
        // Send follow request
        const requestRef = doc(db, 'users', userId, 'followRequests', currentUser.uid);
        await setDoc(requestRef, {
          userId: currentUser.uid,
          username: userProfile?.username || user?.displayName || `User_${currentUser.uid.substring(0, 5)}`,
          timestamp: serverTimestamp()
        });
        // UI already updated above
        toast.success('Follow request sent');
      } else {
        // Also check if the current user has a private account - if the current user follows someone,
        // that person can't automatically follow them back without a request
        const isCurrentUserPrivate = await checkIfFollowRequestNeeded(currentUser.uid);
        
        if (isCurrentUserPrivate) {
          // The current user's account is private, so the target user needs to send a request
          toast.success('Your account is private. They will need to send a request to follow you back.');
        }
        
        // Direct follow - UI already updated above 
        const followingRef = doc(db, 'users', currentUser.uid, 'following', userId);
        const followersRef = doc(db, 'users', userId, 'followers', currentUser.uid);
        
        try {
          // Use a batch to ensure both writes happen together
          const batch = writeBatch(db);
          batch.set(followingRef, { timestamp: serverTimestamp() });
          batch.set(followersRef, { timestamp: serverTimestamp() });
          await batch.commit();
          
          console.log("EMERGENCY: Successfully followed user with batch write");
          // UI already updated above
          toast.success('Followed successfully');
        } catch (batchError) {
          console.error("EMERGENCY: Batch write failed, trying individual writes", batchError);
          
          // If batch fails, try individual writes
          await setDoc(followingRef, { timestamp: serverTimestamp() });
          await setDoc(followersRef, { timestamp: serverTimestamp() });
          
          console.log("EMERGENCY: Individual writes succeeded");
          toast.success('Followed successfully');
        }
      }
    } catch (error) {
      console.error('EMERGENCY: Error in handleFollow:', error);
      
      // Revert UI changes on error
      if (isPrivate) {
        setFollowRequested(false);
      } else {
        setIsFollowing(false);
      }
      
      setError('Failed to process follow request');
      toast.error('Failed to follow user. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!currentUser || !userId || !db) {
      setError('Database not initialized');
      return;
    }

    try {
      setIsLoading(true);
      
      // Update UI state FIRST before database operations
      setIsFollowing(false);
      
      // References to both collections that need updating
      const followingDocRef = doc(db, 'users', currentUser.uid, 'following', userId);
      const followersRef = doc(db, 'users', userId, 'followers', currentUser.uid);
      
      try {
        // Use a batch to ensure both deletes happen together
        const batch = writeBatch(db);
        batch.delete(followingDocRef);
        batch.delete(followersRef);
        await batch.commit();
        
        console.log("EMERGENCY: Successfully unfollowed user with batch delete");
      } catch (batchError) {
        console.error("EMERGENCY: Batch delete failed, trying individual deletes", batchError);
        
        // If batch fails, try individual deletes
        try { await deleteDoc(followingDocRef); } catch (e) { console.error("Failed to delete following:", e); }
        try { await deleteDoc(followersRef); } catch (e) { console.error("Failed to delete follower:", e); }
        
        console.log("EMERGENCY: Individual deletes attempted");
      }

      // Update UI state regardless of DB operation success
      setFollowers(prev => prev.filter(id => id !== currentUser.uid));
      setConnections(prev => prev.filter(id => id !== userId));
      
      toast.success('Unfollowed successfully');
    } catch (error) {
      console.error('EMERGENCY: Error in handleUnfollow:', error);
      
      // Restore UI state on error
      setIsFollowing(true);
      
      setError('Failed to unfollow user');
      toast.error('Failed to unfollow user. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!currentUser || !db) return;

    // Validate username before saving
    if (editedUsername !== originalUsername.current && usernameTaken) {
      toast.error('Please choose a unique username');
      return;
    }

    // Check if username is valid
    if (!/^[a-zA-Z0-9_-]+$/.test(editedUsername)) {
      toast.error('Username can only contain letters, numbers, underscores, and hyphens');
      return;
    } else if (editedUsername.length < 3) {
      toast.error('Username must be at least 3 characters long');
      return;
    }

    try {
      setIsLoading(true);
      const userRef = doc(db, 'users', currentUser.uid);
      
      await updateDoc(userRef, {
        name: editedName,
        username: editedUsername,
        bio: editedBio,
        updatedAt: serverTimestamp()
      });

      setName(editedName);
      setUsername(editedUsername);
      setBio(editedBio);
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Failed to update profile');
      toast.error('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfilePicChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentUser || !event.target.files?.[0]) return;

    try {
      setIsLoading(true);
      const file = event.target.files[0];
      const storageRef = ref(storage, `profilePics/${currentUser.uid}/${file.name}`);
      
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // Ensure db is not null before using it. The check at the function start should guarantee this,
      // but TypeScript might not infer it across async operations. Using non-null assertion operator '!'.
      const userRef = doc(db!, 'users', currentUser.uid);
      await updateDoc(userRef, {
        profilePic: downloadURL,
        updatedAt: serverTimestamp()
      });

      setProfilePic(downloadURL);
      toast.success('Profile picture updated successfully');
    } catch (error) {
      console.error('Error updating profile picture:', error);
      setError('Failed to update profile picture');
      toast.error('Failed to update profile picture');
    } finally {
      setIsLoading(false);
    }
  };

  // Add a function to handle menu open
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };

  // Add a function to handle menu close
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  // Add a function to handle block user
  const handleBlockUser = async () => {
    if (!currentUser) return;
    setMenuAnchorEl(null);
    setShowBlockDialog(true);
  };

  // Add a function to confirm block user
  const confirmBlockUser = async () => {
    if (!currentUser || !userId) return;
    
    try {
      await blockUser(userId);
      setShowBlockDialog(false);
      navigate('/discover');
      toast.success(`You have blocked @${username}`);
    } catch (error) {
      console.error('Error blocking user:', error);
      toast.error('Failed to block user');
    }
  };

  // Add a function to handle report user
  const handleReportUser = () => {
    setMenuAnchorEl(null);
    setShowReportDialog(true);
  };

  // Add a function to submit report
  const submitReport = async (reason: string) => {
    if (!currentUser || !userId || !db) return;
    
    try {
      const reportRef = collection(db as Firestore, 'reports');
      await addDoc(reportRef, {
        reporterId: currentUser.uid,
        reportedUserId: userId,
        reason,
        timestamp: serverTimestamp(),
        status: 'pending'
      });
      
      setShowReportDialog(false);
      toast.success('Report submitted');
    } catch (error) {
      console.error('Error reporting user:', error);
      toast.error('Failed to submit report');
    }
  };

  // Add a function to check if a user needs to send a follow request
  const checkIfFollowRequestNeeded = async (targetUserId: string): Promise<boolean> => {
    if (!db) return false;
    
    try {
      const targetUserRef = doc(db, 'users', targetUserId);
      const targetUserDoc = await getDoc(targetUserRef);
      
      if (targetUserDoc.exists()) {
        const targetUserData = targetUserDoc.data();
        return targetUserData.isPrivate === true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking if follow request needed:', error);
      return false;
    }
  };

  if (authLoading || isLoading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (isDeactivated) {
    return <DeactivatedProfileMessage />;
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 2, mb: 8, px: { xs: 1, sm: 2 } }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Profile Header */}
        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, backgroundColor: 'background.paper' }}>
          {/* User name at the top with 3-dot menu for other users' profiles */}
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 3, position: 'relative' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography 
                variant="h5" 
                sx={{ 
                  fontWeight: 'bold',
                  textAlign: 'center'
                }}
              >
                {username || 'username'}
              </Typography>
              {userProfile?.isVerified && (
                <VerifiedUserIcon 
                  sx={{ 
                    ml: 0.5, 
                    color: email === 'enochaseks@yahoo.com' || email === 'contact@sideye.uk' ? 'gold' : 'primary.main', 
                    fontSize: '1.5rem' 
                  }} 
                />
              )}
              {isPrivate && <LockIcon sx={{ ml: 1, fontSize: 20, verticalAlign: 'middle' }} />}
            </Box>
            
            {/* 3-dot menu only shown when viewing other users' profiles */}
            {currentUser?.uid !== targetUserId && (
              <IconButton 
                onClick={handleMenuOpen} 
                size="small" 
                sx={{ position: 'absolute', right: 0 }}
              >
                <MoreVertIcon />
              </IconButton>
            )}
          </Box>

          {/* Menu for block and report options */}
          <Menu
            anchorEl={menuAnchorEl}
            open={Boolean(menuAnchorEl)}
            onClose={handleMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem onClick={handleBlockUser}>
              <ListItemIcon>
                <BlockIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Block User</ListItemText>
            </MenuItem>
            <MenuItem onClick={handleReportUser}>
              <ListItemIcon>
                <ReportIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Report User</ListItemText>
            </MenuItem>
          </Menu>

          {/* Updated layout - Profile picture at the top, centered content below */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            {/* Profile Picture - moved to top and centered */}
            <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center', width: '100%' }}>
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={
                  currentUser?.uid === targetUserId && (
                    <IconButton
                      component="label"
                      size="small"
                      sx={{
                        bgcolor: 'background.paper',
                        border: '2px solid',
                        borderColor: 'background.paper',
                      }}
                    >
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handleProfilePicChange}
                      />
                      <PhotoCamera fontSize="small" />
                    </IconButton>
                  )
                }
              >
                <Avatar
                  src={profilePic || undefined}
                  onClick={hasActiveStories ? (e) => openStoryViewer(e) : undefined}
                  sx={{
                    width: 100,
                    height: 100,
                    border: hasActiveStories ? '3px solid' : '3px solid',
                    borderColor: hasActiveStories ? 'primary.main' : 'background.paper',
                    cursor: hasActiveStories ? 'pointer' : 'default',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': hasActiveStories ? {
                      transform: 'scale(1.05)',
                      boxShadow: '0 4px 20px rgba(0, 122, 255, 0.3)'
                    } : {},
                    // Prevent double-tap zoom on mobile
                    touchAction: 'manipulation'
                  }}
                >
                  {!profilePic && username ? username.charAt(0).toUpperCase() : '?'}
                </Avatar>
              </Badge>
            </Box>
            
            {/* Profile Info - now centered below profile pic */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              {/* Name and Bio */}
              <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    width: '100%' 
                  }}
                >
                  <Typography 
                    variant="h6" 
                    component="h1" 
                    sx={{ 
                      fontWeight: 'bold',
                      textAlign: 'center',
                    }}
                  >
                    {name || username}
                  </Typography>
                  {userProfile?.isVerified && (
                    <VerifiedUserIcon 
                      sx={{ 
                        ml: 0.5, 
                        color: email === 'enochaseks@yahoo.com' || email === 'contact@sideye.uk' ? 'gold' : 'primary.main', 
                        fontSize: '1.2rem' 
                      }} 
                    />
                  )}
                </Box>
                {bio && (
                  <Typography 
                    variant="body1" 
                    color="text.secondary" 
                    sx={{ 
                      mt: 1, 
                      whiteSpace: 'pre-wrap',
                      textAlign: 'center',
                      width: '100%'
                    }}
                  >
                    {bio}
                  </Typography>
                )}
              </Box>
              
              {/* Stats */}
              <Box sx={{ display: 'flex', gap: 3, mt: 2, justifyContent: 'center', width: '100%' }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Rooms
                  </Typography>
                  <Typography variant="h6">
                    {createdRooms.length}
                  </Typography>
                </Box>
                <Box 
                  sx={{ textAlign: 'center', cursor: 'pointer' }}
                  component={Link}
                  to={`/profile/${userId}/followers`}
                >
                  <Typography variant="body2" color="text.secondary">
                    Followers
                  </Typography>
                  <Typography variant="h6">
                    {followers.length}
                  </Typography>
                </Box>
                <Box 
                  sx={{ textAlign: 'center', cursor: 'pointer' }}
                  component={Link}
                  to={`/profile/${userId}/following`}
                >
                  <Typography variant="body2" color="text.secondary">
                    Following
                  </Typography>
                  <Typography variant="h6">
                    {connections.length}
                  </Typography>
                </Box>
              </Box>
              
              {/* Add curved Edit Profile / Follow buttons */}
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', width: '100%' }}>
                {currentUser?.uid === targetUserId ? (
                  <Button
                    variant="outlined"
                    onClick={() => setIsEditing(true)}
                    fullWidth 
                    sx={{ borderRadius: 8, maxWidth: '300px' }}
                  >
                    Edit Profile
                  </Button>
                ) : currentUser ? (
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', width: '100%' }}>
                    {isFollowing ? (
                      <Button
                        variant="outlined"
                        onClick={handleUnfollow}
                        startIcon={<PersonRemoveIcon />}
                        size="small"
                        sx={{ 
                          borderRadius: 8, 
                          minWidth: '120px',
                          flex: '0 0 auto'
                        }}
                      >
                        Unfollow
                      </Button>
                    ) : followRequested ? (
                      <Button
                        variant="outlined"
                        color="secondary"
                        sx={{ 
                          borderRadius: 8,
                          flex: '0 0 auto',
                          minWidth: '120px'
                        }}
                        disabled={true}
                      >
                        Requested
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        onClick={handleFollow}
                        startIcon={<PersonAddIcon />}
                        sx={{ 
                          borderRadius: 8,
                          flex: '0 0 auto',
                          minWidth: '120px'
                        }}
                      >
                        Follow
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      component={Link}
                      to={`/chat/user/${userId}`}
                      startIcon={<MessageIcon />}
                      sx={{ 
                        borderRadius: 8,
                        flex: '0 0 auto'
                      }}
                    >
                      Message
                    </Button>
                  </Box>
                ) : null}
              </Box>
            </Box>
          </Box>
          
          {/* Add private account indicator below Follow/Message buttons */}
          {isPrivate && currentUser?.uid !== targetUserId && !canViewFullProfile && (
            <Box 
              sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                justifyContent: 'center',
                mt: 4,
                p: 3,
                textAlign: 'center',
                borderRadius: 2,
                bgcolor: 'background.paper'
              }}
            >
              <Box
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  bgcolor: 'action.hover',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2
                }}
              >
                <LockIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
              </Box>
              <Typography variant="h6" gutterBottom>
                This account is private
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Follow this account to see their side rooms.  {/* [DO NOT CHANGE THIS] */}
              </Typography> 
            </Box>
          )} 
        </Paper>
        
        
        {/* Tabbed Content Interface */}
        {(!isPrivate || canViewFullProfile || currentUser?.uid === targetUserId) && (
          <Paper elevation={0} sx={{ borderRadius: 2, backgroundColor: 'background.paper' }}>
            {/* Tab Navigation */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs 
                value={activeTab} 
                onChange={(_, newValue) => setActiveTab(newValue)}
                variant="fullWidth"
                sx={{
                  '& .MuiTab-root': {
                    textTransform: 'none',
                    fontWeight: 500,
                  }
                }}
              >
                <Tab 
                  label="Side Rooms" 
                  value="sideRooms" 
                  icon={<HomeIcon />}
                  iconPosition="start"
                />
                <Tab 
                  label="Gifts Sent" 
                  value="giftsSent" 
                  icon={<CardGiftcardIcon />}
                  iconPosition="start"
                />
              </Tabs>
            </Box>

            {/* Tab Content */}
            <Box sx={{ p: 3 }}>
              {/* Side Rooms Tab */}
              {activeTab === 'sideRooms' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {createdRooms.length > 0 && (
                    <Box>
                      <Typography variant="h6" sx={{ mb: 2 }}>
                        Created Rooms
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                        {createdRooms.map((room) => (
                          <Card 
                            key={room.id}
                            sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              height: '100%',
                              '&:hover': {
                                boxShadow: 6,
                                transform: 'translateY(-2px)',
                                transition: 'all 0.2s ease-in-out'
                              }
                            }}
                          >
                            {room.thumbnailUrl && (
                              <CardMedia
                                component="img"
                                height="140"
                                image={room.thumbnailUrl}
                                alt={room.name}
                                sx={{ objectFit: 'cover' }}
                              />
                            )}
                            <CardContent sx={{ flexGrow: 1 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                <Typography variant="h6" component="div">
                                  {room.name}
                                </Typography>
                                <Chip size="small" label="Owner" color="primary" />
                              </Box>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {room.description}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                <Chip
                                  size="small"
                                  label={`${room.memberCount || 0} members`}
                                  icon={<Group />}
                                />
                                {room.category && (
                                  <Chip
                                    size="small"
                                    label={room.category}
                                    variant="outlined"
                                  />
                                )}
                                {room.isPrivate && (
                                  <Chip
                                    size="small"
                                    icon={<Lock />}
                                    label="Private"
                                    variant="outlined"
                                  />
                                )}
                              </Box>
                            </CardContent>
                            <CardActions>
                              <Button
                                size="small"
                                component={Link}
                                to={`/side-room/${room.id}`}
                                variant="contained"
                                fullWidth
                              >
                                Enter Room
                              </Button>
                            </CardActions>
                          </Card>
                        ))}
                      </Box>
                    </Box>
                  )}

                  {joinedRooms.length > 0 && (
                    <Box>
                      <Typography variant="h6" sx={{ mb: 2 }}>
                        Joined Rooms
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                        {joinedRooms.map((room) => (
                          <Card 
                            key={room.id}
                            sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              height: '100%',
                              '&:hover': {
                                boxShadow: 6,
                                transform: 'translateY(-2px)',
                                transition: 'all 0.2s ease-in-out'
                              }
                            }}
                          >
                            {room.thumbnailUrl && (
                              <CardMedia
                                component="img"
                                height="140"
                                image={room.thumbnailUrl}
                                alt={room.name}
                                sx={{ objectFit: 'cover' }}
                              />
                            )}
                            <CardContent sx={{ flexGrow: 1 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                <Typography variant="h6" component="div">
                                  {room.name}
                                </Typography>
                                <Chip size="small" label="Member" />
                              </Box>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {room.description}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                <Chip
                                  size="small"
                                  label={`${room.memberCount || 0} members`}
                                  icon={<Group />}
                                />
                                {room.category && (
                                  <Chip
                                    size="small"
                                    label={room.category}
                                    variant="outlined"
                                  />
                                )}
                                {room.isPrivate && (
                                  <Chip
                                    size="small"
                                    icon={<Lock />}
                                    label="Private"
                                    variant="outlined"
                                  />
                                )}
                              </Box>
                            </CardContent>
                            <CardActions>
                              <Button
                                size="small"
                                component={Link}
                                to={`/side-room/${room.id}`}
                                variant="contained"
                                fullWidth
                              >
                                Enter Room
                              </Button>
                            </CardActions>
                          </Card>
                        ))}
                      </Box>
                    </Box>
                  )}

                  {createdRooms.length === 0 && joinedRooms.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        {currentUser?.uid === targetUserId 
                          ? "You have not created any side rooms yet."
                          : `${name || username || 'This person'} does not have an active room.`}
                      </Typography>
                      {currentUser?.uid === targetUserId && (
                        <Button
                          variant="contained"
                          color="primary"
                          component={Link}
                          to="/side-rooms"
                          sx={{ marginTop: 2 }}
                        >
                          Create Side Rooms
                        </Button>
                      )}
                    </Box>
                  )}
                </Box>
              )}

              {/* Gifts Sent Tab */}
              {activeTab === 'giftsSent' && (
                <Box>
                  <GiftsSent 
                    userId={userId} 
                    isOwnProfile={currentUser?.uid === targetUserId} 
                  />
                </Box>
              )}
            </Box>
          </Paper>
        )}
      </Box>

      {/* Edit Profile Dialog */}
      <Dialog open={isEditing} onClose={() => setIsEditing(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Profile</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Name"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              fullWidth
              variant="outlined"
              placeholder="Name"
            />
            <Box>
              <TextField
                label="Username"
                value={editedUsername}
                onChange={handleUsernameChange}
                fullWidth
                variant="outlined"
                placeholder="Username"
                InputProps={{
                  startAdornment: <InputAdornment position="start">@</InputAdornment>,
                  endAdornment: checkingUsername && (
                    <InputAdornment position="end">
                      <CircularProgress size={20} />
                    </InputAdornment>
                  )
                }}
                error={!!usernameError}
                helperText={usernameError}
              />
              {showSuggestions && (
                <Paper elevation={2} sx={{ mt: 0.5, p: 1, maxHeight: 150, overflow: 'auto' }}>
                  <Typography variant="caption" color="text.secondary">
                    Suggested alternatives:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    {usernameOptions.map((suggestion) => (
                      <Chip
                        key={suggestion}
                        label={suggestion}
                        size="small"
                        color="primary"
                        variant="outlined"
                        onClick={() => handleSuggestionClick(suggestion)}
                        sx={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Box>
                </Paper>
              )}
            </Box>
            <TextField
              label="Bio"
              value={editedBio}
              onChange={(e) => setEditedBio(e.target.value)}
              multiline
              rows={4}
              fullWidth
              variant="outlined"
              placeholder="Bio"
              helperText={`${editedBio.length}/150 characters`}
              inputProps={{ maxLength: 150 }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            variant="outlined"
            onClick={() => setIsEditing(false)}
            sx={{ 
              textTransform: 'none',
              minWidth: '100px'
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveProfile}
            disabled={isLoading || usernameTaken || !!usernameError}
            sx={{ 
              textTransform: 'none',
              minWidth: '100px'
            }}
          >
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Block User Confirmation Dialog */}
      <Dialog open={showBlockDialog} onClose={() => setShowBlockDialog(false)}>
        <DialogTitle>Block User</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Are you sure you want to block @{username}?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            When you block someone:
            <ul>
              <li>They won't be able to see your profile</li>
              <li>They will be removed from your followers</li>
              <li>Their rooms won't appear in your discover and side room pages</li>
              <li>You won't see their messages</li>
            </ul>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBlockDialog(false)}>Cancel</Button>
          <Button 
            onClick={confirmBlockUser} 
            color="error" 
            variant="contained"
          >
            Block
          </Button>
        </DialogActions>
      </Dialog>

      {/* Report User Dialog */}
      <Dialog open={showReportDialog} onClose={() => setShowReportDialog(false)}>
        <DialogTitle>Report User</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Why are you reporting @{username}?
          </Typography>
          <List>
            {[
              'Spam or misleading content',
              'Harassment or bullying',
              'Hate speech or symbols',
              'Violent or dangerous content',
              'Misinformation',
              'Impersonation',
              'Other'
            ].map((reason) => (
              <ListItem 
                key={reason} 
                onClick={() => submitReport(reason)}
                sx={{ borderRadius: 1, cursor: 'pointer' }}
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

      {/* Story Viewer Dialog */}
      <Dialog
        open={showStoryViewer}
        onClose={() => setShowStoryViewer(false)}
        fullScreen
        PaperProps={{
          sx: {
            bgcolor: 'black',
            color: 'white',
            margin: 0,
            maxHeight: '100vh',
            maxWidth: '100vw'
          }
        }}
        TransitionProps={{
          timeout: 300
        }}
      >
        {userStories.length > 0 && userStories[currentStoryIndex] && (
          <Box sx={{ 
            position: 'relative', 
            height: '100vh', 
            width: '100vw',
            overflow: 'hidden',
            bgcolor: 'black'
          }}>
            {/* Story Content - Full Screen Background */}
            <Box sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1
            }}>
              {userStories[currentStoryIndex].mediaUrl ? (
                userStories[currentStoryIndex].mediaType === 'video' ? (
                  <video
                    src={userStories[currentStoryIndex].mediaUrl}
                    autoPlay
                    muted
                    loop
                    playsInline // Important for iOS to prevent fullscreen
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center'
                    }}
                  />
                ) : (
                  <img
                    src={userStories[currentStoryIndex].mediaUrl}
                    alt="Story"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center'
                    }}
                  />
                )
              ) : (
                // Text-only story with gradient background
                <Box sx={{
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }} />
              )}
            </Box>

            {/* Dark overlay for better text readability */}
            <Box sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 20%, rgba(0,0,0,0) 80%, rgba(0,0,0,0.3) 100%)',
              zIndex: 2
            }} />

            {/* Progress bars */}
            <Box sx={{ 
              position: 'absolute', 
              top: 20, 
              left: 16, 
              right: 16, 
              zIndex: 10,
              display: 'flex',
              gap: 4
            }}>
              {userStories.map((_, index) => (
                <Box
                  key={index}
                  sx={{
                    flex: 1,
                    height: 3,
                    bgcolor: 'rgba(255,255,255,0.3)',
                    borderRadius: 2,
                    overflow: 'hidden'
                  }}
                >
                  <Box
                    sx={{
                      height: '100%',
                      width: index < currentStoryIndex ? '100%' : 
                             index === currentStoryIndex ? `${storyProgress}%` : '0%',
                      bgcolor: 'white',
                      transition: index === currentStoryIndex ? 'none' : 'width 0.3s ease'
                    }}
                  />
                </Box>
              ))}
            </Box>

            {/* Header */}
            <Box sx={{
              position: 'absolute',
              top: 40,
              left: 16,
              right: 16,
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar
                  src={userStories[currentStoryIndex].userAvatar}
                  sx={{ 
                    width: 40, 
                    height: 40,
                    border: '2px solid white'
                  }}
                >
                  {userStories[currentStoryIndex].username[0]?.toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" sx={{ 
                    fontWeight: 600,
                    fontSize: 16,
                    textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                  }}>
                    {userStories[currentStoryIndex].username}
                  </Typography>
                  <Typography variant="caption" sx={{ 
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: 12,
                    textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                  }}>
                    {userStories[currentStoryIndex].createdAt?.toDate().toLocaleTimeString()}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {/* Delete button - only show for own stories */}
                {userStories[currentStoryIndex].userId === currentUser?.uid && (
                  <IconButton
                    onClick={() => setShowDeleteConfirm(true)}
                    sx={{ 
                      color: 'white',
                      bgcolor: 'rgba(0,0,0,0.3)',
                      backdropFilter: 'blur(10px)',
                      '&:hover': {
                        bgcolor: 'rgba(255,0,0,0.5)'
                      }
                    }}
                  >
                    <Typography sx={{ fontSize: 18 }}>🗑️</Typography>
                  </IconButton>
                )}
                <IconButton
                  onClick={() => setShowStoryViewer(false)}
                  sx={{ 
                    color: 'white',
                    bgcolor: 'rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(10px)',
                    '&:hover': {
                      bgcolor: 'rgba(0,0,0,0.5)'
                    }
                  }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>
            </Box>

            {/* Story Text Content */}
            {userStories[currentStoryIndex].content && (
              <Box sx={{
                position: 'absolute',
                bottom: 100,
                left: 20,
                right: 20,
                zIndex: 10,
                textAlign: 'center'
              }}>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 600,
                    fontSize: { xs: 20, sm: 24 },
                    textShadow: '2px 2px 8px rgba(0,0,0,0.8)',
                    lineHeight: 1.3,
                    wordBreak: 'break-word'
                  }}
                >
                  {userStories[currentStoryIndex].content}
                </Typography>
              </Box>
            )}

            {/* Swipe Up Area - Only for own stories */}
            {userStories[currentStoryIndex].userId === currentUser?.uid && !showViewers && (
              <Box
                onClick={() => getStoryViewers(userStories[currentStoryIndex].id)}
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 120,
                  zIndex: 15,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  pb: 3,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 100%)'
                }}
              >
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  bgcolor: 'rgba(0,0,0,0.5)',
                  px: 2,
                  py: 1,
                  borderRadius: 3,
                  backdropFilter: 'blur(10px)'
                }}>
                  <Typography sx={{ fontSize: 16 }}>👁️</Typography>
                  <Typography variant="body2" sx={{ 
                    color: 'white',
                    fontWeight: 500
                  }}>
                    {userStories[currentStoryIndex].views?.length || 0} views
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ 
                  color: 'rgba(255,255,255,0.8)',
                  mt: 1,
                  textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                }}>
                  Tap to see who viewed your story
                </Typography>
              </Box>
            )}

            {/* Viewers List - Shows inside the story */}
            {showViewers && userStories[currentStoryIndex].userId === currentUser?.uid && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '50vh',
                  bgcolor: 'rgba(0,0,0,0.9)',
                  backdropFilter: 'blur(20px)',
                  zIndex: 20,
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {/* Drag Handle */}
                <Box sx={{
                  width: 36,
                  height: 5,
                  bgcolor: 'rgba(255,255,255,0.3)',
                  borderRadius: 3,
                  mx: 'auto',
                  mt: 1,
                  mb: 2
                }} />
                
                {/* Header */}
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  px: 3,
                  pb: 2
                }}>
                  <Typography variant="h6" sx={{ 
                    color: 'white',
                    fontWeight: 600
                  }}>
                    Viewed by {storyViewers.length}
                  </Typography>
                  <IconButton
                    onClick={() => setShowViewers(false)}
                    sx={{ color: 'white' }}
                  >
                    <CloseIcon />
                  </IconButton>
                </Box>

                {/* Viewers List */}
                <Box sx={{ 
                  flex: 1, 
                  overflow: 'auto',
                  px: 3
                }}>
                  {storyViewers.length === 0 ? (
                    <Box sx={{ 
                      textAlign: 'center', 
                      py: 4,
                      color: 'rgba(255,255,255,0.7)'
                    }}>
                      <Typography sx={{ fontSize: 48, mb: 2 }}>👁️</Typography>
                      <Typography variant="body1" sx={{ color: 'white' }}>
                        No views yet
                      </Typography>
                      <Typography variant="body2">
                        When people view your story, you'll see them here
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {storyViewers.map((viewer) => (
                        <Box
                          key={viewer.id}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            py: 1
                          }}
                        >
                          <Avatar
                            src={viewer.avatar}
                            sx={{ width: 50, height: 50 }}
                          >
                            {viewer.username[0]?.toUpperCase()}
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body1" sx={{ 
                              fontWeight: 500,
                              color: 'white'
                            }}>
                              {viewer.username}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>
            )}

            {/* Navigation areas */}
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                top: 100,
                bottom: showViewers ? '50vh' : 150,
                width: '40%',
                cursor: 'pointer',
                zIndex: 5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                pl: 2
              }}
              onClick={goToPreviousStory}
            >
              {currentStoryIndex > 0 && (
                <ArrowBackIcon sx={{ 
                  color: 'rgba(255,255,255,0.0)',
                  fontSize: 40,
                  transition: 'color 0.2s ease',
                  '&:hover': {
                    color: 'rgba(255,255,255,0.7)'
                  }
                }} />
              )}
            </Box>
            
            <Box
              sx={{
                position: 'absolute',
                right: 0,
                top: 100,
                bottom: showViewers ? '50vh' : 150,
                width: '40%',
                cursor: 'pointer',
                zIndex: 5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                pr: 2
              }}
              onClick={goToNextStory}
            >
              <ArrowForwardIcon sx={{ 
                color: 'rgba(255,255,255,0.0)',
                fontSize: 40,
                transition: 'color 0.2s ease',
                '&:hover': {
                  color: 'rgba(255,255,255,0.7)'
                }
              }} />
            </Box>
          </Box>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        PaperProps={{
          sx: {
            borderRadius: 3,
            bgcolor: '#1c1c1e',
            color: 'white'
          }
        }}
      >
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 48, mb: 2 }}>🗑️</Typography>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Delete Story?
          </Typography>
          <Typography variant="body2" sx={{ 
            color: 'rgba(255,255,255,0.7)', 
            mb: 3,
            lineHeight: 1.5
          }}>
            This story will be permanently deleted and removed from your profile.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              onClick={() => setShowDeleteConfirm(false)}
              variant="outlined"
              sx={{
                color: 'white',
                borderColor: 'rgba(255,255,255,0.3)',
                px: 3,
                py: 1,
                borderRadius: 2,
                '&:hover': {
                  borderColor: 'rgba(255,255,255,0.5)',
                  bgcolor: 'rgba(255,255,255,0.05)'
                }
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (userStories[currentStoryIndex]) {
                  deleteStory(userStories[currentStoryIndex].id);
                }
              }}
              variant="contained"
              sx={{
                bgcolor: '#ff3b30',
                color: 'white',
                px: 3,
                py: 1,
                borderRadius: 2,
                '&:hover': {
                  bgcolor: '#d70015'
                }
              }}
            >
              Delete
            </Button>
          </Box>
        </Box>
      </Dialog>
    </Container>
  );
};

export default Profile; 
