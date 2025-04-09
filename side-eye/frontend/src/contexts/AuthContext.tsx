import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { User, signOut as firebaseSignOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile as firebaseUpdateProfile, sendEmailVerification as firebaseSendEmailVerification } from 'firebase/auth';
import { UserProfile } from '../types/index';
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
  const [tempUserForSourceCode, setTempUserForSourceCode] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
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

          console.log('Auth state changed, processing user:', refreshedUser.uid);
          // Fetch user profile from Firestore
          let profileData: UserProfile | null = null;
          let userProfileExists = false;

          if (db) { // Ensure db is initialized
            const userDoc = await getDoc(doc(db, 'users', refreshedUser.uid));
            if (userDoc.exists()) {
              profileData = userDoc.data() as UserProfile;
              userProfileExists = true;
              setUserProfile(profileData);
              console.log('Auth state: Found existing profile for', refreshedUser.uid);
            }
          }

          // Check email verification status first
          if (!refreshedUser.emailVerified) {
            console.log('Auth state: Email not verified. Navigating to /verify-email');
            setUser(refreshedUser);
            setLoading(false);
            navigate('/verify-email', { replace: true });
            return;
          }

          // If email IS verified, but profile did NOT exist, CREATE it now.
          if (!userProfileExists && db) {
            console.log('Auth state: Email verified, but profile missing. Creating profile for', refreshedUser.uid);
            try {
              // IMPORTANT: Need username and dob here. If they are not available in refreshedUser,
              // we might need to store them temporarily after registration or fetch differently.
              // Assuming for now they might be part of refreshedUser or we skip fields.
              // You will likely need to adjust this profile creation logic.
              const newProfileData: Partial<UserProfile> = { // Using Partial as some data might be missing
                id: refreshedUser.uid,
                email: refreshedUser.email || '',
                // name: refreshedUser.displayName || '', // Likely not set yet
                // username: ???, // NEED TO GET THIS
                profilePic: refreshedUser.photoURL || '',
                isVerified: true, // Email is verified
                createdAt: Timestamp.fromDate(new Date()),
                updatedAt: new Date(),
                lastLogin: Timestamp.fromDate(new Date()),
                // dateOfBirth: ???, // NEED TO GET THIS
                // Default other fields as needed...
                sourceCodeSetupComplete: false // Definitely false for new profile
              };
              await setDoc(doc(db, 'users', refreshedUser.uid), newProfileData, { merge: true }); // Use merge to be safe
              profileData = newProfileData as UserProfile; // Assume creation worked for subsequent logic
              setUserProfile(profileData);
              console.log('Auth state: Profile created successfully.');
            } catch (profileCreateError) {
              console.error('Auth state: CRITICAL - Failed to create profile after verification:', profileCreateError);
              setError('Failed to initialize user profile. Please contact support.');
              await firebaseSignOut(auth);
              setCurrentUser(null); setUser(null); setUserProfile(null);
              setLoading(false);
              navigate('/login');
              return;
            }
          } else if (!userProfileExists && !db) {
              console.error('Auth state: DB not initialized, cannot create profile.');
              // Handle appropriately - maybe logout?
              await firebaseSignOut(auth);
              setCurrentUser(null); setUser(null); setUserProfile(null);
              setLoading(false);
              navigate('/login');
              return;
          }
          
          // --- Resume normal logic checking source code --- 
          // Ensure profileData is loaded before proceeding
          if (!profileData) {
              console.error('Auth state: Profile data still unavailable after creation attempt.');
              setError('Failed to load profile data.');
              await firebaseSignOut(auth);
              setCurrentUser(null); setUser(null); setUserProfile(null);
              setLoading(false);
              navigate('/login');
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
          console.error('CRITICAL Error in onAuthStateChanged processing user session:', err);
          setError('Failed to process user session');
          console.log('Navigating to /login due to CRITICAL error.');
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
  }, [navigate]); 

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    setTempUserForSourceCode(null); // Clear any pending source code state

    // Remove retry logic for simplicity
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        let user = userCredential.user; // Use 'let' as we reload it

        // Force reload user state to get latest emailVerified status
        await user.reload();
        user = auth.currentUser!; // Get the reloaded user object (non-null asserted as login succeeded)

        if (!user.emailVerified) {
          console.log('Login attempt: Email not verified.');
          setError('Please verify your email before logging in.');
          await firebaseSignOut(auth); // Log out the unverified user
          setLoading(false);
          navigate('/verify-email'); // Redirect to verify page
          return;
        }

        // Email is verified, now fetch profile
        let profileData: UserProfile | null = null;
        let userProfileExists = false;
        
        if (db) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            profileData = userDoc.data() as UserProfile;
            userProfileExists = true;
            setUserProfile(profileData);
            console.log('Login: Found existing profile for', user.uid);
          } else {
              // Profile missing during login - attempt to create it
              console.log('Login: Profile missing for verified user. Attempting to create profile for', user.uid);
              try {
                // You will likely need to adjust this profile creation logic.
                const newProfileData: Partial<UserProfile> = { // Using Partial as some data might be missing
                  id: user.uid,
                  email: user.email || '',
                  profilePic: user.photoURL || '',
                  isVerified: true, // Email is verified
                  createdAt: Timestamp.fromDate(new Date()),
                  updatedAt: new Date(),
                  lastLogin: Timestamp.fromDate(new Date()),
                  sourceCodeSetupComplete: false // Definitely false for new profile
                };
                await setDoc(doc(db, 'users', user.uid), newProfileData, { merge: true }); // Use merge to be safe
                profileData = newProfileData as UserProfile; // Assume creation worked for subsequent logic
                userProfileExists = true; // Mark as existing now
                setUserProfile(profileData);
                console.log('Login: Profile created successfully.');
              } catch (profileCreateError) {
                console.error('Login: CRITICAL - Failed to create profile during login:', profileCreateError);
                setError('Failed to initialize user profile. Please contact support.');
                await firebaseSignOut(auth);
                setLoading(false);
                navigate('/login');
                return;
              }
          }
        } else {
           // Handle db not initialized error
           console.error('Login failed: Database not initialized.');
           setError('Database connection error. Please try again later.');
           await firebaseSignOut(auth); // Log out if db fails
           setLoading(false);
           navigate('/login');
           return;
        }

        // Ensure profileData is loaded before proceeding
        if (!profileData) {
            console.error('Login: Profile data still unavailable after creation attempt.');
            setError('Failed to load profile data.');
            await firebaseSignOut(auth);
            setLoading(false);
            navigate('/login');
            return;
        }
        
        // --- Resume normal logic checking source code --- 
        // Profile exists, check source code setup
        if (profileData?.sourceCodeSetupComplete) {
            console.log('Login: Source code required. Navigating to /enter-source-code');
            setTempUserForSourceCode(user); // Store user temporarily for source code entry
            setUser(user); // Set basic user state
            // No need to set currentUser fully here, source code entry handles that
            setUserProfile(profileData); // Ensure profile state is set
            setLoading(false);
            navigate('/enter-source-code');
            return;
        } else {
            console.log('Login: Email verified, source code setup needed. Navigating to /setup-source-code');
            setCurrentUser(user); // Set as fully logged in
            setUser(user);
            setUserProfile(profileData); // Ensure profile state is set
            setLoading(false);
            navigate('/setup-source-code'); // Navigate to setup
            return;
        }
      } catch (error: any) {
        console.error("Login error:", error);
        setError(getAuthErrorMessage(error.code));
        setLoading(false);
        // Don't navigate here, just show error on login page
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
      // 1. Create user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Send verification email
      await firebaseSendEmailVerification(user);
      console.log("Verification email sent to:", user.email); // Log success

      // REMOVE Firestore profile creation block from register
      /*
      // 3. Create user profile in Firestore
      const userProfileData: UserProfile = {
        id: user.uid,
        email: user.email || '',
        // ... other fields ...
      };

      if (db) {
        try {
          console.log('Attempting to create user profile in Firestore for UID:', user.uid);
          console.log('UserProfile Data being sent:', JSON.stringify(userProfileData)); 
          await setDoc(doc(db, 'users', user.uid), userProfileData);
          console.log('Successfully created user profile in Firestore.');
          setUserProfile(userProfileData);
        } catch (firestoreError: any) {
          console.error('Firestore error creating user profile:', firestoreError);
          throw firestoreError;
        }
      } else {
          console.error('Firestore DB object is NULL, cannot write profile.');
          throw new Error('Firestore DB not initialized');
      }
      */

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