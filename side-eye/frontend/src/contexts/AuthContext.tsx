import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { User, signOut as firebaseSignOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile as firebaseUpdateProfile, sendEmailVerification as firebaseSendEmailVerification, setPersistence, browserLocalPersistence, onAuthStateChanged } from 'firebase/auth';
import { UserProfile, UserPreferences } from '../types/index';
import { getDoc, doc, setDoc, Firestore, collection, query, orderBy, onSnapshot, addDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, where, limit, deleteDoc, increment, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
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

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tempUserForSourceCode, setTempUserForSourceCode] = useState<User | null>(null);
  const navigate = useNavigate();
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const activityCheckInterval = useRef<NodeJS.Timeout>();

  // Add rate limiting for source code verification
  const [lastVerificationAttempt, setLastVerificationAttempt] = useState<number>(0);
  const VERIFICATION_COOLDOWN = 2000; // 2 seconds cooldown

  const logError = (error: any, context: string) => {
    // Sanitize error message to prevent sensitive data leakage
    const sanitizedError = typeof error === 'object' 
      ? JSON.stringify({
          message: error.message,
          code: error.code,
          name: error.name
        }, null, 2)
      : String(error).replace(/password|token|key|secret/gi, '[REDACTED]');
    
    console.error(`[${context}] Error:`, sanitizedError);
    
    // In production, use a proper error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to error tracking service
      // You should replace this with your actual error tracking service
      try {
        // Only log non-sensitive information
        const errorLog = {
          timestamp: new Date().toISOString(),
          context,
          error: sanitizedError,
          path: window.location.pathname
        };
        
        // Send to error tracking service instead of localStorage
        // errorTrackingService.log(errorLog);
      } catch (e) {
        console.error('Failed to log error:', e);
      }
    }
  };

  const updateLastActivity = () => {
    setLastActivity(Date.now());
    if (currentUser && checkStoragePermission('functionality')) {
      const sessionId = localStorage.getItem('sessionId');
      if (sessionId && db) {
        const userRef = doc(db, 'users', currentUser.uid);
        updateDoc(userRef, {
          'sessions': arrayUnion({
            id: sessionId,
            lastActivity: new Date().toISOString()
          })
        }).catch(error => {
          console.error('Error updating session activity:', error);
        });
      }
    }
  };

  useEffect(() => {
    // Set up activity tracking
    const handleActivity = () => {
      updateLastActivity();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keypress', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);

    // Set up periodic activity check
    activityCheckInterval.current = setInterval(() => {
      if (currentUser && Date.now() - lastActivity > SESSION_TIMEOUT) {
        console.log('Session timeout detected, logging out...');
        logout();
      }
    }, ACTIVITY_CHECK_INTERVAL);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keypress', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      if (activityCheckInterval.current) {
        clearInterval(activityCheckInterval.current);
      }
    };
  }, [currentUser, lastActivity]);

  const registerDevice = async (userId: string) => {
    if (!db) {
      console.error('Firestore not initialized');
      return null;
    }

    try {
      // Generate a device ID if not exists
      let deviceId = localStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('deviceId', deviceId);
        console.log('Generated new device ID:', deviceId);
      }

      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        console.error('User document not found');
        return null;
      }

      const userData = userDoc.data();
      const registeredDevices = userData.registeredDevices || [];

      // Check if device is already registered
      if (!registeredDevices.includes(deviceId)) {
        console.log('Registering new device:', deviceId);
        await updateDoc(userRef, {
          registeredDevices: arrayUnion(deviceId)
        });
        console.log('Device registered successfully');
      } else {
        console.log('Device already registered:', deviceId);
      }

      return deviceId;
    } catch (error) {
      console.error('Error registering device:', error);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user ? 'User logged in' : 'No user');
      setLoading(true);
      
      if (user) {
        try {
          // Register device first
          const deviceId = await registerDevice(user.uid);
          if (!deviceId) {
            console.error('Failed to register device');
            setError('Failed to register device. Please try again.');
            setLoading(false);
            return;
          }

          // Get user profile
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          
          if (!userDoc.exists()) {
            console.error('User profile not found');
            setError('User profile not found');
            setLoading(false);
            return;
          }

          const profileData = userDoc.data();
          console.log('Profile data:', profileData);

          // Check if source code setup is complete for this device
          const isSetupComplete = profileData.sourceCodeSetupComplete || false;
          console.log('Source code setup complete:', isSetupComplete);

          if (isSetupComplete) {
            console.log('Source code setup complete, navigating to feed');
            setCurrentUser(user);
            setLoading(false);
            navigate('/');
          } else {
            console.log('Source code setup not complete, navigating to setup');
            setCurrentUser(user);
            setLoading(false);
            navigate('/setup-source-code');
          }
        } catch (error) {
          console.error('Error in auth state change:', error);
          setError('An error occurred while processing your login');
          setLoading(false);
        }
      } else {
        setCurrentUser(null);
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const checkStoragePermission = (type: 'necessary' | 'functionality' | 'analytics'): boolean => {
    try {
      const preferences = localStorage.getItem('cookiePreferences');
      if (!preferences) return false;
      
      const parsedPreferences = JSON.parse(preferences);
      return parsedPreferences[type] === true;
    } catch (error) {
      console.error('Error checking storage permissions:', error);
      return false;
    }
  };

  const cleanupOldSessions = async (userId: string) => {
    if (!db) return;
    
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.sessions && Array.isArray(data.sessions)) {
          const now = new Date();
          const validSessions = data.sessions.filter((session: any) => {
            const sessionTime = new Date(session.loginTime);
            // Keep sessions from the last 30 days
            return (now.getTime() - sessionTime.getTime()) < (30 * 24 * 60 * 60 * 1000);
          });
          
          if (validSessions.length !== data.sessions.length) {
            await updateDoc(userRef, {
              sessions: validSessions
            });
            console.log('Cleaned up old sessions');
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up sessions:', error);
    }
  };

  const validateSession = async (userId: string, sessionId: string): Promise<boolean> => {
    if (!db) return false;
    
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.sessions && Array.isArray(data.sessions)) {
          return data.sessions.some((session: any) => session.id === sessionId);
        }
      }
      return false;
    } catch (error) {
      console.error('Error validating session:', error);
      return false;
    }
  };

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
        console.log('Email not verified, signing out...');
        setError('Please verify your email before logging in.');
        await firebaseSignOut(auth);
        setLoading(false);
        return;
      }

      // Clean up old sessions before creating a new one
      await cleanupOldSessions(user.uid);

      if (checkStoragePermission('functionality')) {
        const sessionId = crypto.randomUUID();
        localStorage.setItem('sessionId', sessionId);
        console.log('Generated new session ID:', sessionId);

        if (db) {
          try {
            const userRef = doc(db, 'users', user.uid);
            const sessionInfo = {
              id: sessionId,
              loginTime: new Date().toISOString(),
              deviceInfo: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                ip: await fetch('https://api.ipify.org?format=json').then(res => res.json()).then(data => data.ip).catch(() => 'unknown')
              },
              lastActivity: new Date().toISOString()
            };
            
            await updateDoc(userRef, {
              sessions: arrayUnion(sessionInfo)
            });
            
            console.log('Session information updated in Firestore');
          } catch (firestoreError) {
            console.error('Error updating session information:', firestoreError);
          }
        }
      }
      
      setLoading(false);
      
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

    // Check rate limiting
    const now = Date.now();
    if (now - lastVerificationAttempt < VERIFICATION_COOLDOWN) {
      setError('Please wait a moment before trying again');
      return;
    }
    setLastVerificationAttempt(now);

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

      // Add artificial delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify the source code
      const isMatch = await bcrypt.compare(code, profileData.sourceCodeHash);
      
      if (!isMatch) {
        setError('Invalid source code');
        return;
      }

      // Get the current session ID
      const sessionId = localStorage.getItem('sessionId');
      if (!sessionId) {
        setError('Session ID not found');
        return;
      }

      try {
        // Update the session's verification status
        await updateDoc(userRef, {
          'sessions.verifications': arrayUnion({
            sessionId,
            timestamp: new Date().toISOString()
          })
        });
        console.log('Session verification status updated successfully');
      } catch (updateError) {
        // Log but don't fail the verification if session update fails
        console.error('Error updating session verification status:', updateError);
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
        // We'll continue even if Firestore profile creation fails
        // It can be created later in the onAuthStateChanged listener
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
      if (currentUser && checkStoragePermission('functionality')) {
        const sessionId = localStorage.getItem('sessionId');
        if (sessionId && db) {
          const userRef = doc(db, 'users', currentUser.uid);
          await updateDoc(userRef, {
            'sessions': arrayRemove({
              id: sessionId
            })
          });
        }
        localStorage.removeItem('sessionId');
      }
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
    // Use either currentUser (if logged in and verified) or user (if unverified)
    const userToSend = currentUser || user;

    if (!userToSend) {
      // If neither exists, then truly no user is available
      throw new Error('No user available to send verification email');
    }

    try {
      setLoading(true);
      console.log('Sending email verification to:', userToSend.email);

      // First, reload the user to ensure we have the latest state
      await userToSend.reload();
      const refreshedUser = auth.currentUser; // Get the potentially updated user object after reload

      // Use the potentially refreshed user object for the check and send
      const userForCheck = refreshedUser || userToSend;

      // Check if already verified AFTER reload
      if (userForCheck.emailVerified) {
        console.log('User is already verified');
        // Optional: Maybe navigate away or update state if verified now?
        setLoading(false);
        // Potentially trigger forceCheckEmailVerification here to update context state fully
        await forceCheckEmailVerification(userForCheck);
        // Check if currentUser is now set and navigate if appropriate
        if (auth.currentUser) {
          navigate('/setup-source-code'); // Or wherever a verified user should go
        }
        return;
      }

      // Set up action code settings for the verification link
      const actionCodeSettings = {
        url: `${window.location.origin}/verify-email`, // Redirect back to verify page to handle the code
        handleCodeInApp: true
      };

      // Send the verification email with action code settings using the correct user object
      await firebaseSendEmailVerification(userForCheck, actionCodeSettings);
      console.log('Verification email sent successfully');

      // Update Firestore to reflect verification attempt (optional, based on your needs)
      if (db) {
        try {
          const userRef = doc(db, 'users', userForCheck.uid);
          await updateDoc(userRef, {
            lastVerificationAttempt: serverTimestamp(),
            verificationStatus: 'pending' // Indicate email was just sent
          });
          console.log('Updated Firestore with verification attempt timestamp');
        } catch (firestoreError) {
           console.error('Error updating Firestore after sending verification email:', firestoreError);
        }
      }
    } catch (error: any) {
      console.error('Error sending verification email:', error);
      setError(error.message);
      throw error; // Rethrow the error so the calling component knows it failed
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
      
      // Force a reload of the user object
      await user.reload();
      const refreshedUser = auth.currentUser;
      
      if (!refreshedUser) {
        console.error('User disappeared after reload');
        return false;
      }

      // Double check the verification status
      const isVerified = refreshedUser.emailVerified;
      console.log('Email verification status after reload:', isVerified);
      
      // If verified, ensure the user profile is also marked as verified
      if (isVerified && db) {
        try {
          const userRef = doc(db, 'users', refreshedUser.uid);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const profileData = userDoc.data() as UserProfile;
            
            // Only update if the profile isn't already marked as verified
            if (!profileData.isVerified) {
              // Check if user is admin before attempting update
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
      
      // Additional check: Verify the token and force a token refresh
      try {
        const idTokenResult = await refreshedUser.getIdTokenResult(true);
        console.log('Token verification status:', idTokenResult.claims.email_verified);
        
        // If the token says verified but the user object doesn't, force another reload
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