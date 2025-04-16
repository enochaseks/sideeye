import React, { createContext, useContext, useState, useEffect } from 'react';
import { getFirestore, Firestore } from 'firebase/firestore';
// import { getDb } from '../services/firebase'; // Remove old import
import { db as firestoreDb } from '../services/firebase'; // Import db directly (aliased to avoid name conflict)
import { CircularProgress, Box, Typography } from '@mui/material';

interface FirestoreContextType {
  db: Firestore | null;
  loading: boolean;
  error: Error | null;
}

const FirestoreContext = createContext<FirestoreContextType>({
  db: null,
  loading: false,
  error: null
});

export const useFirestore = () => {
  const context = useContext(FirestoreContext);
  if (context === undefined) {
    throw new Error('useFirestore must be used within a FirestoreProvider');
  }
  if (context.db === null) {
    console.warn('useFirestore called before db was initialized or initialization failed');
  }
  return context;
};

export const FirestoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = {
    db: firestoreDb,
    loading: false,
    error: null
  };

  return (
    <FirestoreContext.Provider value={value}>
      {children}
    </FirestoreContext.Provider>
  );
}; 