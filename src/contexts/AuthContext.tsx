import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { User as FirebaseUser, signOut as firebaseSignOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile as firebaseUpdateProfile, sendEmailVerification as firebaseSendEmailVerification, setPersistence, browserLocalPersistence, onAuthStateChanged } from 'firebase/auth';
import { UserProfile, UserPreferences } from '../types/index';
import { getDoc, doc, setDoc, Firestore, collection, query, orderBy, onSnapshot, addDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, where, limit, deleteDoc, increment, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { toast } from 'react-hot-toast';
import bcrypt from 'bcryptjs';
import { checkAndResetRestrictions } from '../services/contentModeration';

export interface User extends FirebaseUser {
  profile?: UserProfile;
  hasUnreadNotifications?: boolean;
  isPrivate?: boolean;
  followers?: string[];
  following?: string[];
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
  tempUserForSourceCode: null
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tempUserForSourceCode, setTempUserForSourceCode] = useState<User | null>(null);
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
          const userDoc = await getDoc(doc(db, 'users', freshFirebaseUser.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
            setUser({
              ...freshFirebaseUser,
              profile: userData
            });
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
          settings: {
            theme: 'light',
            notifications: true,
            privacy: 'public',
          },
          preferences: defaultPreferences
        };
        
        await setDoc(doc(db, 'users', user.uid), newProfileData);
        console.log("Basic user profile created in Firestore");
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
    currentUser: user,
    userProfile: user?.profile || null,
    setUserProfile: (profile: UserProfile) => {
      if (user) {
        setUser({
          ...user,
          profile
        });
      }
    },
    verifySourceCodeAndCompleteLogin,
    tempUserForSourceCode
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