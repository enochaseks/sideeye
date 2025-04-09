import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { User, signOut as firebaseSignOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile as firebaseUpdateProfile, sendEmailVerification as firebaseSendEmailVerification, setPersistence, browserLocalPersistence } from 'firebase/auth';
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tempUserForSourceCode, setTempUserForSourceCode] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (userAuth) => {
      if (userAuth && currentUser && userAuth.uid === currentUser.uid && !loading) {
        console.log(`Auth state: Listener triggered for existing user ${currentUser.uid}, state seems stable. Skipping redundant run.`);
        if (loading) setLoading(false);
        return;
      }

      try {
        console.log('Auth state changed:', userAuth ? `User UID: ${userAuth.uid}, Verified: ${userAuth.emailVerified}` : 'No user');
        setError(null);

        if (userAuth) {
          const initialUser = userAuth;
          setLoading(true);

          try {
            console.log(`Auth state: Reloading user ${initialUser.uid} to ensure latest status...`);
            await initialUser.reload();

            const isVerified = await forceCheckEmailVerification(initialUser);
            console.log(`Auth state: User ${initialUser.uid} verification status: ${isVerified}`);

            const refreshedUser = auth.currentUser;

            if (!refreshedUser) {
              console.error('Auth State: User disappeared after verification check.');
              setError('Authentication state lost. Please log in again.');
              await firebaseSignOut(auth);
              setCurrentUser(null);
              setUser(null);
              setUserProfile(null);
              setTempUserForSourceCode(null);
              setLoading(false);
              navigate('/login');
              return;
            }

            if (!isVerified) {
              console.log('Auth state: Email not verified (confirmed). Navigating to /verify-email');
              setUser(refreshedUser);
              setCurrentUser(null);
              setUserProfile(null);
              setTempUserForSourceCode(null);
              setLoading(false);
              navigate('/verify-email', { replace: true });
              return;
            }

            // Get the current device ID
            const deviceId = localStorage.getItem('deviceId');
            
            // Fetch user profile with device-specific information
            if (db) {
              const userRef = doc(db, 'users', refreshedUser.uid);
              const docSnap = await getDoc(userRef);
              
              if (docSnap.exists()) {
                const profileData = docSnap.data() as UserProfile;
                
                // Check if this device has completed source code setup
                const deviceSetupComplete = profileData.devices?.find(
                  (device: any) => device.id === deviceId
                )?.sourceCodeSetupComplete;

                if (profileData.sourceCodeSetupComplete && !deviceSetupComplete) {
                  console.log('Auth state: Source code setup complete on other device, but not on this device. Navigating to /enter-source-code');
                  setTempUserForSourceCode(refreshedUser);
                  setLoading(false);
                  navigate('/enter-source-code', { replace: true });
                  return;
                }

                if (!profileData.sourceCodeSetupComplete) {
                  console.log('Auth state: Source code setup required. Navigating to /setup-source-code');
                  setTempUserForSourceCode(null);
                  setLoading(false);
                  navigate('/setup-source-code', { replace: true });
                  return;
                }

                // If we get here, both profile and device setup are complete
                console.log('Auth state: All setup complete. Navigating to feed');
                setCurrentUser(refreshedUser);
                setUser(refreshedUser);
                setUserProfile(profileData);
                setTempUserForSourceCode(null);
                setLoading(false);
                navigate('/', { replace: true });
                return;
              }
            }
          } catch (reloadOrInnerError) {
            console.error('CRITICAL Error during user reload or inner processing:', reloadOrInnerError);
            setError('An unexpected error occurred during authentication update.');
            await firebaseSignOut(auth);
            setCurrentUser(null);
            setUser(null);
            setUserProfile(null);
            setTempUserForSourceCode(null);
            setLoading(false);
            navigate('/login');
          }
        } else {
          console.log('Auth state changed - No user / explicit logout');
          setCurrentUser(null);
          setUser(null);
          setUserProfile(null);
          setTempUserForSourceCode(null);
          setLoading(false);
        }
      } catch (outerError) {
        console.error('CRITICAL Error in outer onAuthStateChanged scope:', outerError);
        setError('A critical error occurred during authentication setup.');
        await firebaseSignOut(auth);
        setCurrentUser(null);
        setUser(null);
        setUserProfile(null);
        setTempUserForSourceCode(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [navigate]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      // Set persistence to LOCAL to maintain session across page refreshes
      await setPersistence(auth, browserLocalPersistence);
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log('Login successful, checking verification status...');
      
      // Force a reload and check verification status
      const isVerified = await forceCheckEmailVerification(user);
      console.log('Email verification status after login:', isVerified);
      
      if (!isVerified) {
        setError('Please verify your email before logging in.');
        await firebaseSignOut(auth);
        setLoading(false);
        return;
      }

      // Check if this is a new device
      const deviceId = localStorage.getItem('deviceId');
      if (!deviceId) {
        // Generate a new device ID for this device
        const newDeviceId = crypto.randomUUID();
        localStorage.setItem('deviceId', newDeviceId);
        
        // Update user's devices in Firestore
        if (db) {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            devices: arrayUnion({
              id: newDeviceId,
              lastLogin: serverTimestamp(),
              deviceInfo: {
                userAgent: navigator.userAgent,
                platform: navigator.platform
              }
            })
          });
        }
      }
      
      // If verified, let onAuthStateChanged handle the rest
      setLoading(false);
      
    } catch (error: any) {
      console.error("Login function error:", error);
      setError(getAuthErrorMessage(error.code));
      setLoading(false);
    }
  };

  const verifySourceCodeAndCompleteLogin = async (code: string) => {
    if (!tempUserForSourceCode || !userProfile || !userProfile.sourceCodeHash) {
      setError('Login state lost or source code not set up.');
      console.error('verifySourceCodeAndCompleteLogin: Missing temp user, profile, or hash.', { hasTempUser: !!tempUserForSourceCode, hasProfile: !!userProfile, hasHash: !!userProfile?.sourceCodeHash });
      setCurrentUser(null);
      setUser(null);
      setUserProfile(null);
      setTempUserForSourceCode(null);
      navigate('/login');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    console.log('Verifying source code for login. Hash from profile:', userProfile.sourceCodeHash);
    console.log('Code entered:', code);
    
    try {
      const isMatch = await bcrypt.compare(code, userProfile.sourceCodeHash);
      console.log('bcrypt.compare result (isMatch):', isMatch);
      
      if (isMatch) {
        console.log('Source code matched! Finalizing login and navigating to /');
        
        // Get the current device ID
        const deviceId = localStorage.getItem('deviceId');
        
        // Update the device's source code setup status
        if (db && deviceId) {
          const userRef = doc(db, 'users', tempUserForSourceCode.uid);
          await updateDoc(userRef, {
            devices: arrayUnion({
              id: deviceId,
              lastLogin: serverTimestamp(),
              sourceCodeSetupComplete: true,
              deviceInfo: {
                userAgent: navigator.userAgent,
                platform: navigator.platform
              }
            })
          });
        }
        
        setCurrentUser(tempUserForSourceCode);
        setUser(tempUserForSourceCode);
        setTempUserForSourceCode(null);
        setLoading(false);
        setTimeout(() => navigate('/', { replace: true }), 0);
      } else {
        setError('Invalid source code.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error verifying source code during login:', err);
      setError('Failed to verify source code. Please try again.');
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
      // Doing this early helps prevent issues if user verifies email from a different device
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
            isVerified: false, // Will be updated to true after email verification
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

      // Do not set currentUser here - let onAuthStateChanged handle it
      // which will send them to email verification page
      
    } catch (error: any) {
      console.error('Registration error:', error);
      setError(getAuthErrorMessage(error.code));
      throw error; // Let the Register component handle specific error cases
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

  const forceCheckEmailVerification = async (user: User): Promise<boolean> => {
    try {
      // Force a reload of the user object to get the latest verification status
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
          await updateDoc(userRef, {
            isVerified: true,
            updatedAt: Timestamp.fromDate(new Date())
          });
          console.log('Updated user profile verification status');
        } catch (error) {
          console.error('Error updating user profile verification status:', error);
        }
      }
      
      return isVerified;
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