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
  profilePicture?: string;
  hasUnreadNotifications?: boolean;
  isPrivate?: boolean;
  followers?: string[];
  following?: string[];
}

interface AuthContextType {
  currentUser: User | null;
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string, dateOfBirth: Timestamp) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendEmailVerification: () => Promise<void>;
  setUserProfile: (profile: UserProfile | null) => void;
  setError: (error: string | null) => void;
  tempUserForSourceCode?: User | null;
  verifySourceCodeAndCompleteLogin: (code: string) => Promise<void>;
  forceCheckEmailVerification: (user: User) => Promise<boolean>;
  completeInitialSetupAndLogin: (user: User, profile: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  user: null,
  userProfile: null,
  loading: true,
  error: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  resetPassword: async () => {},
  sendEmailVerification: async () => {},
  setUserProfile: () => {},
  setError: () => {},
  tempUserForSourceCode: null,
  verifySourceCodeAndCompleteLogin: async () => {},
  forceCheckEmailVerification: async () => false,
  completeInitialSetupAndLogin: () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tempUserForSourceCode, setTempUserForSourceCode] = useState<User | null>(null);
  const navigate = useNavigate();

  const logError = (error: any, context: string) => {
    console.error(`[${context}] Error:`, error);
  };

  useEffect(() => {
    console.log('Setting up auth state listener');
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user ? 'User logged in' : 'No user');
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({
              ...user,
              ...userData,
              uid: user.uid
            });
            console.log('User data loaded successfully:', user.uid);
          } else {
            console.error('User document not found in Firestore:', user.uid);
            setUser(null);
          }
        } catch (error) {
          console.error('Error loading user data:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      console.log('Cleaning up auth state listener');
      unsubscribe();
    };
  }, []);

  // Enhanced real-time listener for privacy settings
  useEffect(() => {
    if (!currentUser?.uid || !db) return;

    const userRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data() as UserProfile;
        const previousIsPrivate = userProfile?.isPrivate;
        setUserProfile(userData);
        
        // Update user state with new privacy settings and followers
        setUser(prev => prev ? {
          ...prev,
          ...userData,
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
  }, [currentUser?.uid, db, userProfile?.isPrivate]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log('Starting login process for:', email);
      
      await setPersistence(auth, browserLocalPersistence);
      console.log('Persistence set to LOCAL');
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log('Login successful, checking verification status...');
      
      const isVerified = await forceCheckEmailVerification(user);
      console.log('Email verification status after login:', isVerified);
      
      if (!isVerified) {
        console.log('Email not verified, redirecting to verification page...');
        setError('Please verify your email before logging in.');
        setCurrentUser(null);
        setUser(null);
        setUserProfile(null);
        await firebaseSignOut(auth);
        setLoading(false);
        navigate('/verify-email', { replace: true });
        return;
      }
      
      // Get user profile from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        throw new Error('User profile not found');
      }
      
      const profileData = userDoc.data() as UserProfile;
      
      // Check if source code setup is complete
      if (!profileData.sourceCodeSetupComplete) {
        console.log('Source code setup not complete, redirecting to setup...');
        setTempUserForSourceCode(user);
        setLoading(false);
        navigate('/setup-source-code', { replace: true });
        return;
      }
      
      // Set user states and complete login
      setCurrentUser(user);
      setUser(user);
      setUserProfile(profileData);
      setLoading(false);
      
      // Navigate to feed after successful login
      console.log('Login complete, redirecting to feed...');
      navigate('/', { replace: true });
      
    } catch (error: any) {
      console.error("Login function error:", error);
      let errorMessage = 'An error occurred during login.';
      
      if (error.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password.';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      setError(errorMessage);
      setCurrentUser(null);
      setUser(null);
      setUserProfile(null);
      setLoading(false);
      logError(error, 'Login Function');
    }
  };

  const verifySourceCodeAndCompleteLogin = async (code: string) => {
    if (!tempUserForSourceCode) {
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

      // Set the current user and navigate to feed
        setCurrentUser(tempUserForSourceCode);
      setUserProfile(profileData);
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
      try {
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
      } catch (firestoreError) {
        console.error("Error creating user profile in Firestore:", firestoreError);
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
    try {
      setLoading(true);
      await firebaseSignOut(auth);
      setCurrentUser(null);
      setUser(null);
      setUserProfile(null);
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Failed to log out');
    } finally {
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
    const userToSend = currentUser || user;

    if (!userToSend) {
      throw new Error('No user available to send verification email');
    }

    try {
      setLoading(true);
      console.log('Sending email verification to:', userToSend.email);

      await userToSend.reload();
      const refreshedUser = auth.currentUser;

      const userForCheck = refreshedUser || userToSend;

      if (userForCheck.emailVerified) {
        console.log('User is already verified');
        setLoading(false);
        await forceCheckEmailVerification(userForCheck);
        if (auth.currentUser) {
          navigate('/setup-source-code');
        }
        return;
      }

      const actionCodeSettings = {
        url: `${window.location.origin}/verify-email`,
        handleCodeInApp: true
      };

      await firebaseSendEmailVerification(userForCheck, actionCodeSettings);
      console.log('Verification email sent successfully');

      if (db) {
        try {
          const userRef = doc(db, 'users', userForCheck.uid);
          await updateDoc(userRef, {
            lastVerificationAttempt: serverTimestamp(),
            verificationStatus: 'pending'
          });
          console.log('Updated Firestore with verification attempt timestamp');
        } catch (firestoreError) {
           console.error('Error updating Firestore after sending verification email:', firestoreError);
        }
      }
    } catch (error: any) {
      console.error('Error sending verification email:', error);
      setError(error.message);
      throw error;
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
    setCurrentUser(user);
    setUser(user);
    setUserProfile(profile);
    setTempUserForSourceCode(null);
    setError(null);
    setLoading(false);
    navigate('/', { replace: true });
  };

  const value = {
    currentUser,
    user,
    userProfile,
    loading,
    error,
    login,
    register,
    logout,
    resetPassword,
    sendEmailVerification,
    setUserProfile,
    setError,
    tempUserForSourceCode,
    verifySourceCodeAndCompleteLogin,
    forceCheckEmailVerification,
    completeInitialSetupAndLogin
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
  const { currentUser, userProfile } = useAuth();
  
  const canViewProfile = (targetUserId: string) => {
    if (!currentUser || !userProfile) return false;
    if (currentUser.uid === targetUserId) return true;
    
    const targetUser = userProfile.followers?.includes(targetUserId);
    return !userProfile.isPrivate || targetUser;
  };

  const canViewContent = (targetUserId: string) => {
    if (!currentUser || !userProfile) return false;
    if (currentUser.uid === targetUserId) return true;
    
    const isFollowing = userProfile.following?.includes(targetUserId);
    return !userProfile.isPrivate || isFollowing;
  };

  return {
    canViewProfile,
    canViewContent
  };
}; 