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
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Link } from 'react-router-dom';
import { UserProfile } from '../types/index';

const SearchBar: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const searchUsers = async () => {
      if (!searchTerm.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const usersRef = collection(db, 'users');
        const q = query(
          usersRef,
          where('username', '>=', searchTerm.toLowerCase()),
          where('username', '<=', searchTerm.toLowerCase() + '\uf8ff'),
          orderBy('username'),
          limit(5)
        );

        const querySnapshot = await getDocs(q);
        const searchResults = querySnapshot.docs.map(doc => ({
          uid: doc.id,
          username: doc.data().username || '',
          email: doc.data().email || '',
          name: doc.data().name || '',
          avatar: doc.data().avatar || '',
          profilePic: doc.data().profilePic || '',
          bio: doc.data().bio || '',
          isVerified: doc.data().isVerified || false,
          followers: doc.data().followers || [],
          following: doc.data().following || 0,
          posts: doc.data().posts || 0,
          createdAt: doc.data().createdAt || new Date()
        })) as UserProfile[];

        setResults(searchResults);
      } catch (error) {
        console.error('Error searching users:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

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
              {results.map((user) => (
                <ListItem 
                  key={user.uid} 
                  component={Link} 
                  to={`/profile/${user.uid}`}
                  sx={{ 
                    textDecoration: 'none',
                    color: 'inherit',
                    '&:hover': {
                      backgroundColor: 'action.hover'
                    }
                  }}
                >
                  <ListItemAvatar>
                    <Avatar src={user.profilePic} />
                  </ListItemAvatar>
                  <ListItemText
                    primary={user.name}
                    secondary={`@${user.username}`}
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