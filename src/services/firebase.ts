import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Always connect to the Auth emulator in this environment
connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });

// Add auth state change listener for debugging
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log('Auth state changed - User:', {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      providerData: user.providerData
    });
  } else {
    console.log('Auth state changed - No user');
  }
});

// Initialize Firestore with specific settings
const firestoreSettings = {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  experimentalForceLongPolling: true
};

let db: Firestore | null = null;
let firestoreEmulatorConnected = false; // Flag to prevent multiple connections

// Initialize Firestore and enable persistence
const initializeFirestoreWithPersistence = async (): Promise<Firestore> => {
  if (db) {
    return db;
  }

  try {
    // Initialize Firestore
    db = initializeFirestore(app, firestoreSettings);

    // Connect to Firestore emulator if not already connected
    if (process.env.NODE_ENV === 'development' && !firestoreEmulatorConnected) {
      connectFirestoreEmulator(db, 'localhost', 8080);
      firestoreEmulatorConnected = true;
      console.log('Connected to Firestore emulator on localhost:8080');
    }

    // Enable persistence
    await enableIndexedDbPersistence(db);
    console.log('Firestore persistence enabled');
    return db;
  } catch (err: any) {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
      // Still return the db instance even if persistence fails in other tabs
      return db!;
    } else if (err.code === 'unimplemented') {
      console.warn('The current browser does not support persistence.');
      // Still return the db instance even if persistence is unsupported
      return db!;
    } else {
      console.error('Error initializing Firestore or enabling persistence:', err);
      throw err;
    }
  }
};

// Initialize Storage
export const storage = getStorage(app);

// Initialize Realtime Database
export const rtdb = getDatabase(app);

// Export a getter function for db that ensures initialization
export const getDb = async (): Promise<Firestore> => {
  if (!db) {
    db = await initializeFirestoreWithPersistence();
  }
  return db;
};

// Function to reset Firestore state if needed
export const resetFirestore = async (): Promise<Firestore> => {
  try {
    db = null;
    return await initializeFirestoreWithPersistence();
  } catch (error) {
    console.error('Error resetting Firestore:', error);
    throw error;
  }
}; 