import React, { createContext, useContext, useState, useEffect } from 'react';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getDb } from '../services/firebase';
import { CircularProgress, Box, Typography } from '@mui/material';

interface FirestoreContextType {
  db: Firestore | null;
  loading: boolean;
  error: Error | null;
}

const FirestoreContext = createContext<FirestoreContextType>({
  db: null,
  loading: true,
  error: null
});

export const useFirestore = () => useContext(FirestoreContext);

export const FirestoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<Firestore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeDb = async () => {
      try {
        const firestore = await getDb();
        if (mounted) {
          setDb(firestore);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
          setLoading(false);
        }
      }
    };

    initializeDb();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <Box 
        display="flex" 
        flexDirection="column" 
        alignItems="center" 
        justifyContent="center" 
        minHeight="100vh"
      >
        <CircularProgress />
        <Typography variant="body1" mt={2}>
          Initializing Firestore...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box 
        display="flex" 
        flexDirection="column" 
        alignItems="center" 
        justifyContent="center" 
        minHeight="100vh"
      >
        <Typography variant="h6" color="error">
          Error: {error.message}
        </Typography>
      </Box>
    );
  }

  return (
    <FirestoreContext.Provider value={{ db, loading, error }}>
      {children}
    </FirestoreContext.Provider>
  );
}; 