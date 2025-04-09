import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED, Firestore, connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
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

// Connect to the Auth emulator only in development
if (process.env.NODE_ENV === 'development') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  console.log('Connected to Auth emulator on localhost:9099');
}

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

// Initialize Firestore directly
export const db = getFirestore(app);

// Connect to Firestore emulator if in development
if (process.env.NODE_ENV === 'development') {
    try {
        connectFirestoreEmulator(db, 'localhost', 8080);
        console.log('Connected to Firestore emulator on localhost:8080');
    } catch (error) {
        console.warn('Error connecting to Firestore emulator (maybe already connected?):', error);
    }
}

// Attempt to enable persistence (optional, handle errors)
try {
    enableIndexedDbPersistence(db)
        .then(() => console.log('Firestore persistence enabled'))
        .catch((err: any) => {
            if (err.code === 'failed-precondition') {
                console.warn('Firestore Persistence: Multiple tabs open, only works in one.');
            } else if (err.code === 'unimplemented') {
                console.warn('Firestore Persistence: Browser does not support.');
            } else {
                console.error('Firestore Persistence: Error enabling:', err);
            }
        });
} catch (error) {
    console.error('Firestore Persistence: General error during setup:', error);
}

// Initialize Storage
export const storage = getStorage(app);

// Initialize Realtime Database
export const rtdb = getDatabase(app); 