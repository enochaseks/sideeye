import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import { User, signOut as firebaseSignOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile as firebaseUpdateProfile, sendEmailVerification as firebaseSendEmailVerification } from 'firebase/auth';
import { UserProfile } from '../types/index';
import { getDoc, doc, setDoc, Firestore, collection, query, orderBy, onSnapshot, addDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, where, limit, deleteDoc, increment, Timestamp, getDocs } from 'firebase/firestore';
import { getDb } from '../services/firebase';
import { toast } from 'react-hot-toast';

interface AuthContextType {
  currentUser: User | null;
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (data: { displayName?: string; photoURL?: string }) => Promise<void>;
  sendEmailVerification: () => Promise<void>;
  verifyEmail: (code: string) => Promise<void>;
  setupTwoFactorAuth: () => Promise<void>;
  verifyTwoFactorAuth: (code: string) => Promise<void>;
  setUserProfile: (profile: UserProfile | null) => void;
  setError: (error: string | null) => void;
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
  setError: () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [db, setDb] = useState<Firestore | null>(null);

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
      setCurrentUser(user);
      setUser(user);
      if (user) {
        try {
          // Fetch user profile from Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
            setUserProfile({
              ...userData,
              id: user.uid,
              email: user.email || '',
              name: user.displayName || userData.name || '',
              username: userData.username || user.email?.split('@')[0] || '',
              profilePic: user.photoURL || userData.profilePic || '',
              connections: userData.connections || [],
              followers: userData.followers || [],
              following: userData.following || [],
              isVerified: user.emailVerified || userData.isVerified || false,
              createdAt: userData.createdAt || Timestamp.fromDate(new Date()),
              lastLogin: Timestamp.fromDate(new Date()),
              settings: userData.settings || {
                theme: 'light',
                notifications: true,
                privacy: 'public'
              },
              updatedAt: new Date(),
              isPrivate: false,
              isActive: true,
              lastSeen: new Date(),
              status: 'online',
              preferences: userData.preferences || {
                theme: 'light',
                language: 'en',
                notifications: true,
                emailNotifications: true,
                pushNotifications: true
              }
            });
          } else {
            // Create new user profile if it doesn't exist
            const newUserProfile: UserProfile = {
              id: user.uid,
              email: user.email || '',
              name: user.displayName || '',
              username: user.email?.split('@')[0] || '',
              profilePic: user.photoURL || '',
              bio: '',
              location: '',
              website: '',
              followers: [],
              following: [],
              connections: [],
              isVerified: false,
              createdAt: Timestamp.now(),
              lastLogin: Timestamp.now(),
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
            await setDoc(doc(db, 'users', user.uid), newUserProfile);
            setUserProfile(newUserProfile);
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
          setError('Failed to fetch user profile');
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [db]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        if (!user.emailVerified) {
          setError('Please verify your email before logging in');
          await firebaseSignOut(auth);
          return;
        }

        // Fetch user profile
        if (db) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
            setUserProfile({
              ...userData,
              id: user.uid,
              email: user.email || '',
              name: user.displayName || userData.name || '',
              username: userData.username || user.email?.split('@')[0] || '',
              profilePic: user.photoURL || userData.profilePic || '',
              lastLogin: Timestamp.fromDate(new Date())
            });
          }
        }
        return;
      } catch (error: any) {
        retryCount++;
        if (retryCount === maxRetries) {
          setError(getAuthErrorMessage(error.code));
          setLoading(false);
          return;
        }
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }
    }
  };

  const register = async (email: string, password: string, username: string) => {
    setLoading(true);
    setError(null);
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        // Check if username is already taken
        if (db) {
          const usernameQuery = query(
            collection(db, 'users'),
            where('username', '==', username.toLowerCase())
          );
          const usernameSnapshot = await getDocs(usernameQuery);
          if (!usernameSnapshot.empty) {
            setError('Username is already taken');
            setLoading(false);
            return;
          }
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create user profile
        if (db) {
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

          await setDoc(doc(db, 'users', user.uid), newUserProfile);
          setUserProfile(newUserProfile);
        }

        // Send email verification
        await firebaseSendEmailVerification(user);
        setError('Please verify your email to continue');
        return;
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

  const logout = async () => {
    try {
      setLoading(true);
      await firebaseSignOut(auth);
      setCurrentUser(null);
      setUser(null);
      setUserProfile(null);
      window.location.href = '/login';
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
      await firebaseSendEmailVerification(currentUser);
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