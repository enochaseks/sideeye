import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { User, signOut as firebaseSignOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile as firebaseUpdateProfile, sendEmailVerification as firebaseSendEmailVerification } from 'firebase/auth';
import { UserProfile } from '../types/index';
import { getDoc, doc, setDoc, Firestore, collection, query, orderBy, onSnapshot, addDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, where, limit, deleteDoc, increment, Timestamp, getDocs } from 'firebase/firestore';
import { getDb } from '../services/firebase';
import { toast } from 'react-hot-toast';
import bcrypt from 'bcryptjs';

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
  updateProfile: (data: { displayName?: string; photoURL?: string }) => Promise<void>;
  sendEmailVerification: () => Promise<void>;
  verifyEmail: (code: string) => Promise<void>;
  setupTwoFactorAuth: () => Promise<void>;
  verifyTwoFactorAuth: (code: string) => Promise<void>;
  setUserProfile: (profile: UserProfile | null) => void;
  setError: (error: string | null) => void;
  tempUserForSourceCode?: User | null;
  verifySourceCodeAndCompleteLogin: (code: string) => Promise<void>;
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
  updateProfile: async () => {},
  sendEmailVerification: async () => {},
  verifyEmail: async () => {},
  setupTwoFactorAuth: async () => {},
  verifyTwoFactorAuth: async () => {},
  setUserProfile: () => {},
  setError: () => {},
  tempUserForSourceCode: null,
  verifySourceCodeAndCompleteLogin: async () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [db, setDb] = useState<Firestore | null>(null);
  const [tempUserForSourceCode, setTempUserForSourceCode] = useState<User | null>(null);
  const navigate = useNavigate();

  // Initialize Firestore
  useEffect(() => {
    const initializeDb = async () => {
      try {
        const firestore = await getDb();
        setDb(firestore);
      } catch (err) {
        console.error('Error initializing Firestore:', err);
        setError('Failed to initialize database');
      }
    };

    initializeDb();
  }, []);

  useEffect(() => {
    if (!db) return;

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      // If the context already has a fully authenticated currentUser, 
      // don't interfere with ongoing operations (like post-verification redirect).
      // However, we still need to handle the case where the Firebase user disappears (logout).
      if (currentUser && user && currentUser.uid === user.uid) {
        console.log('onAuthStateChanged: currentUser already set, skipping session restore logic.');
        setLoading(false); // Ensure loading is off
        return; // Do nothing if currentUser is already set and matches Firebase user
      }
      
      // Clear temp user if Firebase user disappears or changes significantly
      if (!user) {
          setTempUserForSourceCode(null);
      }

      // Proceed with session restoration/check ONLY if currentUser is not already set
      if (user) {
        try {
          // Force refresh user state to get latest emailVerified status
          await user.reload();
          // Now get the potentially updated user object
          const refreshedUser = auth.currentUser; 
          if (!refreshedUser) { // Check if user disappeared after reload
              await firebaseSignOut(auth); // Log out if something went wrong
              throw new Error('User state lost after reload.');
          }

          // Fetch user profile from Firestore
          const userDoc = await getDoc(doc(db, 'users', refreshedUser.uid));
          let profileData: UserProfile | null = null;

          if (userDoc.exists()) {
            profileData = userDoc.data() as UserProfile;
            // Update profile state immediately for potential use elsewhere
            setUserProfile(profileData);
          } else {
            // Profile doesn't exist - this shouldn't happen for an existing session
            // but if it does, maybe treat as needing setup?
            console.warn('User profile not found for existing session UID:', refreshedUser.uid);
            // For safety, let's log them out if profile is missing
            await firebaseSignOut(auth);
            setCurrentUser(null);
            setUser(null);
            setUserProfile(null);
            setLoading(false);
            navigate('/login');
            return;
          }
          
          // Check email verification first using the refreshed user
          console.log(`Checking email verification status for ${refreshedUser.uid}:`, refreshedUser.emailVerified);
          if (!refreshedUser.emailVerified) {
            console.log('Session restored, but email not verified (after reload). Navigating to /verify-email');
            setUser(refreshedUser); // Keep basic user info
            setLoading(false);
            navigate('/verify-email', { replace: true });
            return;
          }

          // Check if source code needs to be entered (using profileData)
          if (profileData?.sourceCodeSetupComplete) {
              console.log('Session restore: Source code required (email verified). Navigating to /enter-source-code');
              setTempUserForSourceCode(refreshedUser);
              setUser(refreshedUser); 
              setLoading(false);
              navigate('/enter-source-code', { replace: true });
              return;
          } else {
            // Source code not set up (email verified)
            console.log('Session restore: Source code setup required (email verified). Navigating to /setup-source-code');
            setCurrentUser(refreshedUser); 
            setUser(refreshedUser);
            setLoading(false);
            navigate('/setup-source-code', { replace: true });
            return;
          }

          // If we reach here, it means email verified BUT source code NOT set up (handled above)
          // This path shouldn't logically be reached anymore with the checks above.
          // Let's keep the original behaviour just in case, but log it.
          // console.warn('Reached unexpected state in onAuthStateChanged');
          // setCurrentUser(user); // Set as fully logged in (Original behaviour)
          // setUser(user);

        } catch (err) {
          console.error('Error in onAuthStateChanged processing user session:', err);
          setError('Failed to process user session');
          // Maybe log out on error?
          await firebaseSignOut(auth); 
          setCurrentUser(null);
          setUser(null);
          setUserProfile(null);
          navigate('/login'); // Redirect to login on error
        }
      } else {
        // No user session found (logout)
        setCurrentUser(null);
        setUser(null);
        setUserProfile(null);
        setTempUserForSourceCode(null); // Clear temp state on logout
      }
      setLoading(false);
    });

    return unsubscribe;
  // NOTE: We intentionally DO NOT include currentUser in the dependency array
  // to prevent loops. We only want this to run on db/navigate changes or
  // when the auth state *itself* changes from Firebase.
  }, [db, navigate]); 

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    setTempUserForSourceCode(null);

    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        if (!user.emailVerified) {
          setError('Please verify your email before logging in');
          await firebaseSignOut(auth);
          setLoading(false);
          navigate('/verify-email');
          return;
        }

        let profileData: UserProfile | null = null;
        if (db) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            profileData = userDoc.data() as UserProfile;
          } else {
            console.warn('User profile not found during login for UID:', user.uid);
            setError('User profile incomplete. Please contact support or try registering again.');
            await firebaseSignOut(auth);
            setLoading(false);
            return;
          }
        }
        
        if (profileData?.sourceCodeSetupComplete) {
            setTempUserForSourceCode(user);
            setUserProfile(profileData);
            setLoading(false);
            navigate('/enter-source-code');
            return;
        } else {
            setCurrentUser(user);
            setUser(user);
            setUserProfile(profileData);
            setLoading(false);
            navigate('/setup-source-code');
            return;
        }
      } catch (error: any) {
        retryCount++;
        if (retryCount === maxRetries) {
          setError(getAuthErrorMessage(error.code));
          setLoading(false);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }
    }
  };

  const verifySourceCodeAndCompleteLogin = async (code: string) => {
    if (!tempUserForSourceCode || !userProfile || !userProfile.sourceCodeHash) {
      setError('Login state lost or source code not set up.');
      console.error('verifySourceCodeAndCompleteLogin: Missing temp user, profile, or hash.', { hasTempUser: !!tempUserForSourceCode, hasProfile: !!userProfile, hasHash: !!userProfile?.sourceCodeHash });
      navigate('/login');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    console.log('Verifying source code. Hash from profile:', userProfile.sourceCodeHash);
    console.log('Code entered:', code); // Log the entered code
    
    try {
      const isMatch = await bcrypt.compare(code, userProfile.sourceCodeHash);
      console.log('bcrypt.compare result (isMatch):', isMatch); // Log the result
      
      if (isMatch) {
        setCurrentUser(tempUserForSourceCode);
        setUser(tempUserForSourceCode);
        setTempUserForSourceCode(null);
        setLoading(false);
        navigate('/');
      } else {
        setError('Invalid source code.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error verifying source code:', err);
      setError('Failed to verify source code. Please try again.');
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, username: string, dateOfBirth: Timestamp) => {
    setLoading(true);
    setError(null);

    try {
      // Create the user account first
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Send verification email immediately with actionCodeSettings
      const actionCodeSettings = {
        url: window.location.origin + '/setup-source-code',
        handleCodeInApp: true
      };
      await firebaseSendEmailVerification(user, actionCodeSettings);

      // Then create the user profile
      if (db) {
        try {
          const newUserProfile: UserProfile = {
            id: user.uid,
            email: user.email || '',
            name: user.displayName || '',
            username: username.toLowerCase(),
            profilePic: user.photoURL || '',
            bio: '',
            location: '',
            website: '',
            followers: [],
            following: [],
            connections: [],
            isVerified: false,
            createdAt: Timestamp.fromDate(new Date()),
            lastLogin: Timestamp.fromDate(new Date()),
            dateOfBirth: dateOfBirth,
            settings: {
              theme: 'light',
              notifications: true,
              privacy: 'public'
            },
            updatedAt: new Date(),
            isPrivate: false,
            isActive: true,
            lastSeen: new Date(),
            status: 'online',
            preferences: {
              theme: 'light',
              language: 'en',
              notifications: true,
              emailNotifications: true,
              pushNotifications: true
            }
          };
  
          console.log('Attempting to create user profile in Firestore for UID:', user.uid);
          await setDoc(doc(db, 'users', user.uid), newUserProfile);
          console.log('Successfully created user profile in Firestore.');
          setUserProfile(newUserProfile);
        } catch (firestoreError: any) {
          console.error('Firestore error creating user profile:', firestoreError);
          // Re-throw the error or handle it specifically if needed
          // For now, let's re-throw to ensure it bubbles up
          throw firestoreError;
        }
      }

      // Update local state
      setCurrentUser(user);
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

  const updateProfile = async (data: { displayName?: string; photoURL?: string }) => {
    if (!currentUser) {
      throw new Error('No user logged in');
    }

    try {
      setLoading(true);
      await firebaseUpdateProfile(currentUser, data);
      setCurrentUser({ ...currentUser, ...data });
    } catch (error: any) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendEmailVerification = async () => {
    if (!currentUser) {
      throw new Error('No user logged in');
    }

    try {
      setLoading(true);
      const actionCodeSettings = {
        url: window.location.origin + '/setup-source-code',
        handleCodeInApp: true
      };
      await firebaseSendEmailVerification(currentUser, actionCodeSettings);
    } catch (error: any) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
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
    updateProfile,
    sendEmailVerification,
    verifyEmail: async () => {},
    setupTwoFactorAuth: async () => {},
    verifyTwoFactorAuth: async () => {},
    setUserProfile,
    setError,
    tempUserForSourceCode,
    verifySourceCodeAndCompleteLogin
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

// Helper function for auth error messages
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