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

  const logError = (error: any, context: string) => {
    const errorMessage = typeof error === 'object' ? JSON.stringify(error, null, 2) : String(error);
    console.error(`[${context}] Error:`, errorMessage);
    
    // Log to a remote service if needed
    if (process.env.NODE_ENV === 'production') {
      // You can add your error tracking service here (e.g., Sentry, LogRocket)
      try {
        // Example: Log to localStorage for debugging
        const errorLog = {
          timestamp: new Date().toISOString(),
          context,
          error: errorMessage,
          userAgent: navigator.userAgent,
          url: window.location.href
        };
        
        const existingLogs = JSON.parse(localStorage.getItem('errorLogs') || '[]');
        existingLogs.push(errorLog);
        localStorage.setItem('errorLogs', JSON.stringify(existingLogs.slice(-10))); // Keep last 10 errors
      } catch (e) {
        console.error('Failed to log error:', e);
      }
    }
  };

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

            // Add retry logic for verification check
            let isVerified = false;
            let retryCount = 0;
            const maxRetries = 3;

            while (!isVerified && retryCount < maxRetries) {
              try {
                isVerified = await forceCheckEmailVerification(initialUser);
                console.log(`Verification check attempt ${retryCount + 1}:`, isVerified);
                
                if (!isVerified) {
                  retryCount++;
                  if (retryCount < maxRetries) {
                    console.log('Waiting before retry...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                  }
                }
              } catch (verificationError) {
                logError(verificationError, 'Email Verification Check');
                retryCount++;
              }
            }

            const refreshedUser = auth.currentUser;

            if (!refreshedUser) {
              logError('User disappeared after verification check', 'Auth State');
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
              console.log('Auth state: Email not verified after all retries. Navigating to /verify-email');
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
            logError(reloadOrInnerError, 'User Reload/Inner Processing');
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
        logError(outerError, 'Outer Auth State Change');
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
      console.log('Starting login process for:', email);
      
      // Set persistence to LOCAL to maintain session across page refreshes
      await setPersistence(auth, browserLocalPersistence);
      console.log('Persistence set to LOCAL');
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log('Login successful, checking verification status...');
      console.log('User object:', {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        providerData: user.providerData
      });
      
      // Force a reload and check verification status
      const isVerified = await forceCheckEmailVerification(user);
      console.log('Email verification status after login:', isVerified);
      
      if (!isVerified) {
        console.log('Email not verified, signing out...');
        setError('Please verify your email before logging in.');
        await firebaseSignOut(auth);
        setLoading(false);
        return;
      }

      // Check if this is a new device
      const deviceId = localStorage.getItem('deviceId');
      console.log('Current device ID:', deviceId);
      
      if (!deviceId) {
        // Generate a new device ID for this device
        const newDeviceId = crypto.randomUUID();
        localStorage.setItem('deviceId', newDeviceId);
        console.log('Generated new device ID:', newDeviceId);
        
        // Update user's devices in Firestore
        if (db) {
          try {
            const userRef = doc(db, 'users', user.uid);
            const deviceInfo = {
              id: newDeviceId,
              lastLogin: new Date().toISOString(), // Use ISO string instead of serverTimestamp
              sourceCodeSetupComplete: false,
              deviceInfo: {
                userAgent: navigator.userAgent,
                platform: navigator.platform
              }
            };
            
            // First, get the current devices array
            const userDoc = await getDoc(userRef);
            const currentDevices = userDoc.data()?.devices || [];
            
            // Update the document with the new devices array
            await updateDoc(userRef, {
              devices: [...currentDevices, deviceInfo]
            });
            
            console.log('Device information updated in Firestore');
          } catch (firestoreError) {
            console.error('Error updating device information:', firestoreError);
            // Don't fail the login if device update fails
          }
        }
      }
      
      // If verified, let onAuthStateChanged handle the rest
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
      
      // Log the error for debugging
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

      // Get the current device ID
      const deviceId = localStorage.getItem('deviceId');
      if (!deviceId) {
        setError('Device ID not found');
        return;
      }

      // Update the device's source code setup status
      const devices = profileData.devices || [];
      const updatedDevices = devices.map(device => 
        device.id === deviceId 
          ? { ...device, sourceCodeSetupComplete: true }
          : device
      );

      await updateDoc(userRef, {
        devices: updatedDevices
      });

      // Set the current user and navigate to feed
      setCurrentUser(tempUserForSourceCode);
      setUserProfile(profileData);
      setTempUserForSourceCode(null);
      setLoading(false);
      navigate('/');
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
              await updateDoc(userRef, {
                isVerified: true,
                updatedAt: serverTimestamp()
              });
              console.log('Updated user profile verification status in Firestore');
            }
          }
        } catch (error) {
          console.error('Error updating user profile verification status:', error);
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