import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED, Firestore } from 'firebase/firestore';
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

// Initialize Firestore with specific settings
const firestoreSettings = {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  experimentalForceLongPolling: true
};

let db: Firestore | null = null;

// Initialize Firestore and enable persistence
const initializeFirestoreWithPersistence = async (): Promise<Firestore> => {
  if (db) {
    return db;
  }

  try {
    // Initialize Firestore
    db = initializeFirestore(app, firestoreSettings);

    // Enable persistence
    await enableIndexedDbPersistence(db);
    console.log('Firestore persistence enabled');
    return db;
  } catch (err: any) {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
      return db!;
    } else if (err.code === 'unimplemented') {
      console.warn('The current browser does not support persistence.');
      return db!;
    } else {
      console.error('Error enabling persistence:', err);
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