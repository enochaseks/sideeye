import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, storage } from '../services/firebase';
import { User as FirebaseUser, signOut as firebaseSignOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile as firebaseUpdateProfile, sendEmailVerification as firebaseSendEmailVerification, setPersistence, browserLocalPersistence, onAuthStateChanged } from 'firebase/auth';
import { UserProfile, UserPreferences } from '../types/index';
import { getDoc, doc, setDoc, Firestore, collection, query, orderBy, onSnapshot, addDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, where, limit, deleteDoc, increment, Timestamp, getDocs, writeBatch } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import bcrypt from 'bcryptjs';
import { checkAndResetRestrictions } from '../services/contentModeration';

export interface User extends FirebaseUser {
  profile?: UserProfile;
  hasUnreadNotifications?: boolean;
  isPrivate?: boolean;
  followers?: string[];
  following?: string[];
  blockedUsers?: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string, dateOfBirth: Timestamp) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendEmailVerification: () => Promise<void>;
  setError: (error: string | null) => void;
  forceCheckEmailVerification: (user: User) => Promise<boolean>;
  currentUser: User | null;
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile) => void;
  verifySourceCodeAndCompleteLogin: (code: string) => Promise<void>;
  tempUserForSourceCode: User | null;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  isUserBlocked: (userId: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  resetPassword: async () => {},
  sendEmailVerification: async () => {},
  setError: () => {},
  forceCheckEmailVerification: async () => false,
  currentUser: null,
  userProfile: null,
  setUserProfile: () => {},
  verifySourceCodeAndCompleteLogin: async () => {},
  tempUserForSourceCode: null,
  blockUser: async () => {},
  unblockUser: async () => {},
  isUserBlocked: () => false
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tempUserForSourceCode, setTempUserForSourceCode] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const navigate = useNavigate();

  const logError = (error: any, context: string) => {
    console.error(`[${context}] Error:`, error);
  };

  useEffect(() => {
    console.log('Setting up auth state listener');
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser ? 'User logged in' : 'No user');
      if (firebaseUser) {
        try {
          console.log('Reloading Firebase user data...');
          await firebaseUser.reload();
          const freshFirebaseUser = auth.currentUser;
          console.log('Firebase user data reloaded.');

          if (!freshFirebaseUser) {
            console.log('User is null after reload, signing out.');
            setUser(null);
            setLoading(false);
            return;
          }

          console.log('Fetching Firestore document for:', freshFirebaseUser.uid);
          const userRef = doc(db, 'users', freshFirebaseUser.uid);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
            
            // Check if the account is deactivated
            if (userData.isActive === false) {
              console.log('Reactivating deactivated account:', freshFirebaseUser.uid);
              
              // Reactivate the account
              await updateDoc(userRef, {
                isActive: true,
                reactivatedAt: new Date().toISOString(),
                deactivatedAt: null // Remove deactivated timestamp
              });
              
              // Fetch the updated user data
              const updatedUserDoc = await getDoc(userRef);
              if (updatedUserDoc.exists()) {
                const updatedUserData = updatedUserDoc.data() as UserProfile;
                
                setUser({
                  ...freshFirebaseUser,
                  profile: updatedUserData
                });
                
                // Show reactivation message
                toast.success('Welcome back! Your account has been reactivated.');
              }
            } else {
              // Normal login for active account
              setUser({
                ...freshFirebaseUser,
                profile: userData
              });
            }
            
            console.log('User data loaded successfully:', freshFirebaseUser.uid);
            setLoading(false);
          } else {
            console.error('User document not found in Firestore:', freshFirebaseUser.uid);
            setUser(null);
            firebaseSignOut(auth);
            console.log('Signed out due to missing Firestore document.');
            setLoading(false);
          }
        } catch (error) {
          console.error('Error loading user data:', error);
          setUser(null);
          setLoading(false);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      console.log('Cleaning up auth state listener');
      unsubscribe();
    };
  }, []);

  // Add effect to update userProfile and currentUser state when user changes
  useEffect(() => {
    if (user) {
      setCurrentUser(user);
      setUserProfile(user.profile || null);
    } else {
      setCurrentUser(null);
      setUserProfile(null);
    }
  }, [user]);

  // Enhanced real-time listener for privacy settings
  useEffect(() => {
    if (!user?.uid || !db) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data() as UserProfile;
        const previousIsPrivate = user.profile?.isPrivate;
        setUser(prev => prev ? {
          ...prev,
          profile: userData
        } : null);
        
        // Update user state with new privacy settings and followers
        setUser(prev => prev ? {
          ...prev,
          isPrivate: userData.isPrivate || false,
          followers: userData.followers || [],
          following: userData.following || []
        } : null);

        // Notify other components of privacy changes
        if (previousIsPrivate !== userData.isPrivate) {
          toast.success(`Account is now ${userData.isPrivate ? 'private' : 'public'}`);
          // Force a refresh of the profile data
          if (window.location.pathname.includes('/profile')) {
            window.location.reload();
          }
        }
      }
    }, (error) => {
      console.error('Error listening to privacy changes:', error);
      toast.error('Failed to sync privacy settings');
    });

    return () => unsubscribe();
  }, [user?.uid, db, user?.profile?.isPrivate]);

  // Add effect to check verification status
  useEffect(() => {
    if (user && !loading) {
      // Check email verification
      if (!user.emailVerified) {
        toast.error('Please verify your email to continue', {
          duration: 5000,
          id: 'email-verification-needed'
        });
      }
      
      // Check source code setup
      if (user.profile && !user.profile.sourceCodeSetupComplete) {
        toast.error('Please set up your source code to continue', {
          duration: 5000,
          id: 'source-code-setup-needed'
        });
      }
    }
  }, [user, loading]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
      if (!emailRegex.test(email)) {
        throw new Error('auth/invalid-email');
      }

      console.log('Starting login process for:', email);
      
      await setPersistence(auth, browserLocalPersistence);
      console.log('Persistence set to LOCAL');
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      console.log('Firebase Auth login successful for user:', firebaseUser.uid);
      
      const isVerified = await forceCheckEmailVerification(firebaseUser);
      console.log('Email verification status:', isVerified);
      
      if (!isVerified) {
        console.log('Email not verified, redirecting to verification page...');
        setError('Please verify your email before logging in.');
        await firebaseSignOut(auth);
        setLoading(false);
        navigate('/verify-email', { replace: true });
        return;
      }
      
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (!userDoc.exists()) {
        console.log('User profile not found, creating default profile...');
        // Create a default profile if it doesn't exist
        const defaultProfile = {
          name: firebaseUser.displayName || '',
          username: firebaseUser.displayName || '',
          email: firebaseUser.email || '',
          profilePic: firebaseUser.photoURL || '',
          bio: '',
          location: '',
          website: '',
          followers: [],
          following: [],
          connections: [],
          isVerified: false,
          sourceCodeHash: null,
          sourceCodeSetupComplete: false,
          createdAt: Timestamp.fromDate(new Date()),
          lastLogin: Timestamp.fromDate(new Date()),
          dateOfBirth: Timestamp.fromDate(new Date(2000, 0, 1)), // Default date
          sideCoins: 10, // Initial SideCoins balance for new users (10 free SC)
          settings: {
            theme: 'light',
            notifications: true,
            privacy: 'public',
          },
          preferences: {
            theme: 'light',
            language: 'en',
            notifications: true,
            emailNotifications: true,
            pushNotifications: true,
          }
        };
        
        await setDoc(doc(db, 'users', firebaseUser.uid), defaultProfile);
        console.log('Created default user profile');
        
        // Get the newly created profile
        const newUserDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        const profileData = newUserDoc.data() as UserProfile;
        
        // Check if source code setup is complete
        if (!profileData.sourceCodeSetupComplete) {
          console.log('Source code setup not complete, redirecting to setup...');
          setLoading(false);
          navigate('/setup-source-code', { replace: true });
          return;
        }
        
        // Set user state and complete login
        setUser({
          ...firebaseUser,
          profile: profileData
        });
        setLoading(false);
        
        // Navigate to feed after successful login
        console.log('Login complete, redirecting to feed...');
        navigate('/', { replace: true });
      } else {
        const profileData = userDoc.data() as UserProfile;
        console.log('Retrieved user profile:', profileData);
        
        // Check if source code setup is complete
        if (!profileData.sourceCodeSetupComplete) {
          console.log('Source code setup not complete, redirecting to setup...');
          setLoading(false);
          navigate('/setup-source-code', { replace: true });
          return;
        }
        
        // Set user state and complete login
        setUser({
          ...firebaseUser,
          profile: profileData
        });
        setLoading(false);
        
        // Navigate to feed after successful login
        console.log('Login complete, redirecting to feed...');
        navigate('/', { replace: true });
      }
    } catch (error: any) {
      console.error("Login function error:", error);
      let errorMessage = 'An error occurred during login.';
      
      if (error.code === 'auth/invalid-credential' || error.message === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (error.code === 'auth/user-not-found' || error.message === 'auth/user-not-found') {
        errorMessage = 'No account found with this email.';
      } else if (error.code === 'auth/wrong-password' || error.message === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.';
      } else if (error.code === 'auth/too-many-requests' || error.message === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (error.code === 'auth/network-request-failed' || error.message === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.code === 'auth/invalid-email' || error.message === 'auth/invalid-email') {
        errorMessage = 'Invalid email address. Please check the format.';
      } else if (error.message === 'User profile not found') {
        errorMessage = 'User profile not found. Please contact support.';
      }
      
      setError(errorMessage);
      setUser(null);
      setLoading(false);
      logError(error, 'Login Function');
    }
  };

  const register = async (email: string, password: string, username: string, dateOfBirth: Timestamp) => {
    setLoading(true);
    setError(null);

    try {
      // 1. Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("User created successfully with UID:", user.uid);

      // 2. Update the user profile with displayName for better UX
      await firebaseUpdateProfile(user, { displayName: username });
      console.log("User profile updated with username:", username);

      // 3. Send verification email
      await firebaseSendEmailVerification(user);
      console.log("Verification email sent to:", user.email);

      // 4. Create a basic user profile in Firestore with sourceCodeSetupComplete=false
      if (db) {
        const defaultPreferences = {
          theme: 'light',
          language: 'en',
          notifications: true,
          emailNotifications: true,
          pushNotifications: true,
        };

        const newProfileData = {
          name: username,
          username: username,
          email: email || '',
          profilePic: user.photoURL || '',
          bio: '',
          location: '',
          website: '',
          followers: [],
          following: [],
          connections: [],
          isVerified: false,
          sourceCodeHash: null,
          sourceCodeSetupComplete: false,
          createdAt: Timestamp.fromDate(new Date()),
          lastLogin: Timestamp.fromDate(new Date()),
          dateOfBirth: dateOfBirth,
          sideCoins: 10, // Initial SideCoins balance for new users (10 free SC)
          settings: {
            theme: 'light',
            notifications: true,
            privacy: 'public',
          },
          preferences: defaultPreferences
        };
        
        await setDoc(doc(db, 'users', user.uid), newProfileData);
        console.log("Basic user profile created in Firestore");
        
        // Send welcome message from SideEye Contact Team
        await sendWelcomeMessage(user.uid, username);
      }

      // Set the user state to trigger onAuthStateChanged
      setUser(user);

    } catch (error: any) {
      console.error('Registration error:', error);
      setError(getAuthErrorMessage(error.code));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Starting logout process...');
      
      // Disconnect audio before signing out
      // console.log('Disconnecting audio service...');
      // audioService.disconnect();
      // console.log('Audio service disconnected.');

      await firebaseSignOut(auth);
      console.log('Firebase sign out successful.');
      
      setUser(null); // Clear user state immediately
      setLoading(false);
      console.log('User state cleared, navigating to /login...');
      navigate('/login', { replace: true }); // Navigate to login page
      console.log('Navigation to /login triggered.');
    } catch (error: any) {
      console.error('Error during logout:', error);
      logError(error, 'Logout');
      setError(getAuthErrorMessage(error.code));
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendEmailVerification = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError('No user available to send verification email');
      return;
    }

    try {
      setLoading(true);
      await currentUser.reload();
      const refreshedUser = auth.currentUser;

      if (!refreshedUser) {
        setError('User not found');
        return;
      }

      if (refreshedUser.emailVerified) {
        await forceCheckEmailVerification(refreshedUser);
        navigate('/setup-source-code');
        return;
      }

      await firebaseSendEmailVerification(refreshedUser, {
        url: `${window.location.origin}/verify-email`,
        handleCodeInApp: true
      });

      if (db) {
        await updateDoc(doc(db, 'users', refreshedUser.uid), {
          lastVerificationAttempt: serverTimestamp(),
          verificationStatus: 'pending'
        });
      }

      toast.success('Verification email sent');
    } catch (error: any) {
      console.error('Error sending verification email:', error);
      setError(getAuthErrorMessage(error.code || error.message));
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = async (userId: string): Promise<boolean> => {
    if (!db) return false;
    try {
      const adminDoc = await getDoc(doc(db, 'admins', userId));
      return adminDoc.exists();
    } catch (error) {
      console.log('Error checking admin status:', error);
      return false;
    }
  };

  const forceCheckEmailVerification = async (user: User): Promise<boolean> => {
    try {
      console.log('Starting forceCheckEmailVerification for user:', user.uid);
      console.log('Initial emailVerified status:', user.emailVerified);
      
      await user.reload();
      const refreshedUser = auth.currentUser;
      
      if (!refreshedUser) {
        console.error('User disappeared after reload');
        return false;
      }

      const isVerified = refreshedUser.emailVerified;
      console.log('Email verification status after reload:', isVerified);
      
      if (isVerified && db) {
        try {
          const userRef = doc(db, 'users', refreshedUser.uid);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const profileData = userDoc.data() as UserProfile;
            
            if (!profileData.isVerified) {
              const userIsAdmin = await isAdmin(refreshedUser.uid);
              if (userIsAdmin) {
                await updateDoc(userRef, {
                  isVerified: true,
                  updatedAt: serverTimestamp()
                });
                console.log('Updated user profile verification status in Firestore');
              } else {
                console.log('User is not admin, skipping verification status update');
              }
            }
          }
        } catch (error) {
          console.log('Could not access user profile in Firestore');
        }
      }
      
      try {
        const idTokenResult = await refreshedUser.getIdTokenResult(true);
        console.log('Token verification status:', idTokenResult.claims.email_verified);
        
        if (idTokenResult.claims.email_verified && !isVerified) {
          await refreshedUser.reload();
          return refreshedUser.emailVerified;
        }
        
        return idTokenResult.claims.email_verified === true;
      } catch (tokenError) {
        console.error('Error checking token verification status:', tokenError);
        return isVerified;
      }
    } catch (error) {
      console.error('Failed to check email verification status:', error);
      return false;
    }
  };

  const completeInitialSetupAndLogin = (user: User, profile: UserProfile) => {
    console.log('Initial source code setup complete. Finalizing login directly.');
    setUser({
      ...user,
      profile
    });
    setError(null);
    setLoading(false);
    navigate('/', { replace: true });
  };

  const verifySourceCodeAndCompleteLogin = async (code: string) => {
    if (!tempUserForSourceCode || !db) {
      setError('No user logged in');
      console.error('verifySourceCodeAndCompleteLogin: No temporary user found');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Get the user's profile from Firestore
      const userRef = doc(db, 'users', tempUserForSourceCode.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        setError('User profile not found');
        console.error('verifySourceCodeAndCompleteLogin: User profile not found');
        return;
      }

      const profileData = userDoc.data() as UserProfile;
      
      if (!profileData.sourceCodeHash) {
        setError('Source code not set up');
        console.error('verifySourceCodeAndCompleteLogin: No source code hash found');
        return;
      }

      // Verify the source code
      const isMatch = await bcrypt.compare(code, profileData.sourceCodeHash);
      
      if (!isMatch) {
        setError('Invalid source code');
        return;
      }

      // Set the user state and navigate to feed
      setUser({
        ...tempUserForSourceCode,
        profile: profileData
      });
      setTempUserForSourceCode(null);
      setLoading(false);
      
      // Using setTimeout to allow React state updates to complete before navigation
      setTimeout(() => {
        navigate('/');
      }, 0);
    } catch (error) {
      console.error('Error verifying source code:', error);
      setError('Failed to verify source code');
      setLoading(false);
    }
  };

  // Add block user function
  const blockUser = async (userId: string) => {
    if (!currentUser?.uid || !db) {
      setError('You must be logged in to block users');
      return;
    }

    try {
      // 1. Add userId to current user's blockedUsers array
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        blockedUsers: arrayUnion(userId),
        updatedAt: serverTimestamp()
      });

      // 2. Remove any follower/following relationships
      await updateDoc(userRef, {
        followers: arrayRemove(userId),
        following: arrayRemove(userId)
      });

      // 3. Remove current user from blocked user's followers/following
      const blockedUserRef = doc(db, 'users', userId);
      await updateDoc(blockedUserRef, {
        followers: arrayRemove(currentUser.uid),
        following: arrayRemove(currentUser.uid)
      });

      // 4. Delete any follower/following documents
      try {
        const followerDoc = doc(db, `users/${currentUser.uid}/followers`, userId);
        const followingDoc = doc(db, `users/${currentUser.uid}/following`, userId);
        await deleteDoc(followerDoc).catch(() => {});
        await deleteDoc(followingDoc).catch(() => {});
        
        const theirFollowerDoc = doc(db, `users/${userId}/followers`, currentUser.uid);
        const theirFollowingDoc = doc(db, `users/${userId}/following`, currentUser.uid);
        await deleteDoc(theirFollowerDoc).catch(() => {});
        await deleteDoc(theirFollowingDoc).catch(() => {});
      } catch (error) {
        console.error('Error removing follower documents:', error);
        // Continue anyway as this is not critical
      }

      // 5. Delete any existing conversations between the users
      try {
        const conversationsRef = collection(db, 'conversations');
        const q = query(
          conversationsRef,
          where('participants', 'array-contains', currentUser.uid)
        );
        const conversationsSnapshot = await getDocs(q);
        
        // Find conversations with the blocked user
        const conversationsToDelete = conversationsSnapshot.docs.filter(doc => {
          const data = doc.data();
          return data.participants.includes(userId);
        });
        
        // Delete each conversation
        const batch = writeBatch(db);
        conversationsToDelete.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
      } catch (error) {
        console.error('Error deleting conversations:', error);
        // Continue anyway
      }

      // 6. Update local state
      setUser(prev => {
        if (!prev) return null;
        
        const updatedBlockedUsers = [...(prev.blockedUsers || []), userId];
        const updatedFollowers = prev.followers?.filter(id => id !== userId) || [];
        const updatedFollowing = prev.following?.filter(id => id !== userId) || [];
        
        return {
          ...prev,
          blockedUsers: updatedBlockedUsers,
          followers: updatedFollowers,
          following: updatedFollowing
        };
      });

      toast.success('User blocked successfully');
    } catch (error) {
      console.error('Error blocking user:', error);
      setError('Failed to block user');
      toast.error('Failed to block user');
    }
  };

  // Add unblock user function
  const unblockUser = async (userId: string) => {
    if (!currentUser?.uid || !db) {
      setError('You must be logged in to unblock users');
      return;
    }

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        blockedUsers: arrayRemove(userId),
        updatedAt: serverTimestamp()
      });

      // Update local state
      setUser(prev => {
        if (!prev) return null;
        
        const updatedBlockedUsers = prev.blockedUsers?.filter(id => id !== userId) || [];
        
        return {
          ...prev,
          blockedUsers: updatedBlockedUsers
        };
      });

      toast.success('User unblocked successfully');
    } catch (error) {
      console.error('Error unblocking user:', error);
      setError('Failed to unblock user');
      toast.error('Failed to unblock user');
    }
  };

  // Add helper function to check if a user is blocked
  const isUserBlocked = (userId: string): boolean => {
    return currentUser?.blockedUsers?.includes(userId) || false;
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    resetPassword,
    sendEmailVerification,
    setError,
    forceCheckEmailVerification,
    currentUser,
    userProfile,
    setUserProfile,
    verifySourceCodeAndCompleteLogin,
    tempUserForSourceCode,
    blockUser,
    unblockUser,
    isUserBlocked
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const getAuthErrorMessage = (code: string): string => {
  switch (code) {
    case 'auth/invalid-email':
      return 'Invalid email address';
    case 'auth/user-disabled':
      return 'This account has been disabled';
    case 'auth/user-not-found':
      return 'No account found with this email';
    case 'auth/wrong-password':
      return 'Incorrect password';
    case 'auth/email-already-in-use':
      return 'Email is already in use';
    case 'auth/weak-password':
      return 'Password is too weak';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later';
    default:
      return 'An error occurred. Please try again';
  }
};

// Add privacy-related helper functions
export const usePrivacy = () => {
  const { user } = useAuth();
  
  const canViewProfile = (targetUserId: string) => {
    if (!user) return false;
    if (user.uid === targetUserId) return true;
    
    const targetUser = user.profile?.followers?.includes(targetUserId);
    return !user.profile?.isPrivate || targetUser;
  };

  const canViewContent = (targetUserId: string) => {
    if (!user) return false;
    if (user.uid === targetUserId) return true;
    
    const isFollowing = user.profile?.following?.includes(targetUserId);
    return !user.profile?.isPrivate || isFollowing;
  };

  return {
    canViewProfile,
    canViewContent
  };
};

// Function to send welcome message to new users from SideEye system
const sendWelcomeMessage = async (userId: string, username: string) => {
  if (!db) return;
  
  try {
    console.log("Sending welcome message to new user:", userId);
    
    // Use the existing official SideEye Contact Team ID
    // This should already exist in the system and have a profile
    const contactTeamId = "sideeye"; // Use the actual existing account ID
    
    // Create a new conversation between the new user and SideEye
    const conversationRef = doc(collection(db, 'conversations'));
    await setDoc(conversationRef, {
      participants: [contactTeamId, userId],
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
      unreadCount: {
        [contactTeamId]: 0,
        [userId]: 1 // Set unread count for new user
      },
      status: 'accepted' // Auto-accept
    });
    
    // Add welcome message
    const welcomeMessage = `Hello ${username}, Welcome to SideEye! It is nice to have you on our platform. If you need any support or help, you can just message us here and we will be happy to respond.`;
    
    // Add the message to the conversation
    const messagesRef = collection(db, 'conversations', conversationRef.id, 'messages');
    await addDoc(messagesRef, {
      text: welcomeMessage,
      sender: contactTeamId,
      timestamp: serverTimestamp(),
      read: false,
      reactions: [] // Add empty reactions array for consistency
    });
    
    // Update conversation with last message info
    await updateDoc(conversationRef, {
      lastMessage: {
        text: welcomeMessage,
        sender: contactTeamId,
        timestamp: serverTimestamp()
      },
      lastUpdated: serverTimestamp()
    });
    
    // Add notification for the new user
    await createWelcomeNotification(db, {
      type: 'message',
      senderId: contactTeamId,
      senderName: "SideEye Contact Team",
      senderAvatar: "/logo.png", 
      recipientId: userId,
      content: `New message: ${welcomeMessage.slice(0, 50)}${welcomeMessage.length > 50 ? '...' : ''}`,
      postId: conversationRef.id,
      roomId: conversationRef.id
    });
    
    console.log("Welcome message sent successfully to:", userId);
  } catch (error) {
    console.error("Error sending welcome message:", error);
    // Don't throw the error to avoid disrupting the registration process
  }
};

// Create utility function for notification
const createWelcomeNotification = async (db: Firestore, notification: {
  type: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  recipientId: string;
  content: string;
  postId: string;
  roomId: string;
}) => {
  try {
    // Add to notifications collection
    const notificationsRef = collection(db, 'notifications');
    await addDoc(notificationsRef, {
      ...notification,
      createdAt: serverTimestamp(),
      isRead: false
    });
    
    // Update user's unread notification counter
    const userRef = doc(db, 'users', notification.recipientId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const currentUnreadCount = userData.unreadNotificationsCount || 0;
      
      await updateDoc(userRef, {
        unreadNotificationsCount: currentUnreadCount + 1
      });
    }
    
    console.log("Notification created successfully");
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}; 