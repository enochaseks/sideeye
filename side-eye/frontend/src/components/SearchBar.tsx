import React, { useState, useEffect } from 'react';
import { 
  Box, 
  TextField, 
  List, 
  ListItem, 
  ListItemAvatar, 
  ListItemText, 
  Avatar, 
  Typography,
  Paper,
  CircularProgress
} from '@mui/material';
import { collection, query, where, getDocs, orderBy, limit, Firestore } from 'firebase/firestore';
import { getDb } from '../services/firebase';
import { Link } from 'react-router-dom';
import { UserProfile } from '../types/index';
import { useAuth } from '../contexts/AuthContext';

interface SearchResult {
  id: string;
  type: 'user' | 'post' | 'room';
  title: string;
  description?: string;
  avatar?: string;
}

const SearchBar: React.FC = () => {
  const { currentUser } = useAuth();
  const [db, setDb] = useState<Firestore | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Firestore
  useEffect(() => {
    const initializeDb = async () => {
      try {
        const firestore = await getDb();
        setDb(firestore);
      } catch (err) {
        console.error('Error initializing Firestore:', err);
        setError('Failed to initialize database');
      }
    };

    initializeDb();
  }, []);

  useEffect(() => {
    if (db && searchTerm.trim()) {
      searchContent();
    } else {
      setResults([]);
    }
  }, [db, searchTerm]);

  const searchContent = async () => {
    if (!db || !currentUser) return;

    try {
      setLoading(true);
      setError(null);

      // Search users
      const usersQuery = query(
        collection(db, 'users'),
        where('username', '>=', searchTerm),
        where('username', '<=', searchTerm + '\uf8ff')
      );
      const usersSnapshot = await getDocs(usersQuery);
      const userResults = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        type: 'user' as const,
        title: doc.data().username,
        avatar: doc.data().avatar
      }));

      // Search posts
      const postsQuery = query(
        collection(db, 'posts'),
        where('content', '>=', searchTerm),
        where('content', '<=', searchTerm + '\uf8ff')
      );
      const postsSnapshot = await getDocs(postsQuery);
      const postResults = postsSnapshot.docs.map(doc => ({
        id: doc.id,
        type: 'post' as const,
        title: doc.data().content.substring(0, 50) + '...',
        description: `Posted by ${doc.data().authorName}`
      }));

      // Search rooms
      const roomsQuery = query(
        collection(db, 'rooms'),
        where('name', '>=', searchTerm),
        where('name', '<=', searchTerm + '\uf8ff')
      );
      const roomsSnapshot = await getDocs(roomsQuery);
      const roomResults = roomsSnapshot.docs.map(doc => ({
        id: doc.id,
        type: 'room' as const,
        title: doc.data().name,
        description: doc.data().description
      }));

      setResults([...userResults, ...postResults, ...roomResults]);
    } catch (error) {
      console.error('Error searching content:', error);
      setError('Failed to search content');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      <TextField
        fullWidth
        variant="outlined"
        placeholder="Search users..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2 }}
      />
      
      {searchTerm && (
        <Paper 
          elevation={3} 
          sx={{ 
            position: 'absolute', 
            top: '100%', 
            left: 0, 
            right: 0, 
            zIndex: 1000,
            maxHeight: '300px',
            overflow: 'auto'
          }}
        >
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : results.length > 0 ? (
            <List>
              {results.map((result) => (
                <ListItem 
                  key={result.id} 
                  component={Link} 
                  to={`/profile/${result.id}`}
                  sx={{ 
                    textDecoration: 'none',
                    color: 'inherit',
                    '&:hover': {
                      backgroundColor: 'action.hover'
                    }
                  }}
                >
                  <ListItemAvatar>
                    <Avatar src={result.avatar} />
                  </ListItemAvatar>
                  <ListItemText
                    primary={result.title}
                    secondary={result.description}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No users found
              </Typography>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default SearchBar; 