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
  Tab
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
  CardGiftcard as CardGiftcardIcon
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

  const userId = targetUserId || currentUser?.uid || '';

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
  }, [fetchUserData]);

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
                  sx={{
                    width: 100,
                    height: 100,
                    border: '3px solid',
                    borderColor: 'background.paper',
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
    </Container>
  );
};

export default Profile; 
