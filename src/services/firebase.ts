import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, 
  enableMultiTabIndexedDbPersistence,
  enableIndexedDbPersistence,
  initializeFirestore,
  CACHE_SIZE_UNLIMITED
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL
};

// Initialize Firebase with performance monitoring disabled
const app = getApps().length === 0 ? initializeApp(firebaseConfig, {
  automaticDataCollectionEnabled: false
}) : getApp();

console.log('Initializing Firebase app');

// Initialize Firestore with optimized settings
const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  experimentalForceLongPolling: true
});

// Initialize Auth
const auth = getAuth(app);

// Initialize Storage
const storage = getStorage(app);

// Initialize Realtime Database
const rtdb = getDatabase(app);

// Add auth state change listener for debugging
onAuthStateChanged(auth, (user) => {
  console.log('Firebase auth state changed:', user ? 'User logged in' : 'No user');
});

// Export initialized services
export { app, auth, db, storage, rtdb };

// Add configuration check function
export const checkFirebaseConfig = () => {
  if (process.env.NODE_ENV === 'production') {
    console.log('Checking Firebase configuration in production...');
    console.log('Firebase App:', app.name);
    console.log('Firebase Auth:', auth.app.name);
    console.log('Firestore:', db.app.name);
    console.log('Realtime Database:', rtdb.app.name);
    
    // Check if we're using the correct project
    const projectId = app.options.projectId;
    console.log('Firebase Project ID:', projectId);
    
    // Check if we're using the correct API key
    const apiKey = app.options.apiKey;
    console.log('Firebase API Key:', apiKey ? 'Present' : 'Missing');
    
    // Check if we're using the correct auth domain
    const authDomain = app.options.authDomain;
    console.log('Firebase Auth Domain:', authDomain);
    
    // Log any configuration issues
    if (!projectId || !apiKey || !authDomain) {
      console.error('Firebase configuration is incomplete!');
      console.error('Project ID:', projectId);
      console.error('API Key:', apiKey ? 'Present' : 'Missing');
      console.error('Auth Domain:', authDomain);
    }
  }
};

// Call the check function
checkFirebaseConfig(); 