import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Container,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Box,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery,
  ListItemButton
} from '@mui/material';
import { collection, query, where, getDocs, getDoc, doc, orderBy, limit } from 'firebase/firestore';
import { SideRoom } from '../types/index';
import { useFirestore } from '../context/FirestoreContext';

interface SearchResult {
  id: string;
  type: 'user' | 'post' | 'forum' | 'sideRoom';
  data: any;
}

interface UserData {
  username: string;
  name?: string;
  avatar?: string;
}

interface PostData {
  content: string;
  authorId: string;
  author?: UserData;
}

interface ForumData {
  title: string;
  description?: string;
}

interface SideRoomData {
  name: string;
  description?: string;
}

const SearchResults: React.FC = () => {
  const navigate = useNavigate();
  const { searchQuery } = useParams<{ searchQuery: string }>();
  const { db, loading: dbLoading, error: dbError } = useFirestore();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<number>(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    const search = async () => {
      if (!searchQuery || !db) return;

      try {
        setLoading(true);
        const results: SearchResult[] = [];

        // Search users
        const usersQuery = query(
          collection(db, 'users'),
          where('username', '>=', searchQuery.toLowerCase()),
          where('username', '<=', searchQuery.toLowerCase() + '\uf8ff'),
          limit(20)
        );

        const usersSnapshot = await getDocs(usersQuery);
        usersSnapshot.forEach(doc => {
          const userData = doc.data() as UserData;
          results.push({
            id: doc.id,
            type: 'user',
            data: userData
          });
        });

        // Search posts
        const postsQuery = query(
          collection(db, 'posts'),
          where('content', '>=', searchQuery.toLowerCase()),
          where('content', '<=', searchQuery.toLowerCase() + '\uf8ff'),
          orderBy('content'),
          limit(20)
        );

        const postsSnapshot = await getDocs(postsQuery);
        for (const postDoc of postsSnapshot.docs) {
          const postData = postDoc.data() as PostData;
          const authorDoc = await getDoc(doc(db, 'users', postData.authorId));
          const authorData = authorDoc.data() as UserData;
          results.push({
            id: postDoc.id,
            type: 'post',
            data: {
              ...postData,
              author: authorData
            }
          });
        }

        // Search forums
        const forumsQuery = query(
          collection(db, 'forums'),
          where('title', '>=', searchQuery.toLowerCase()),
          where('title', '<=', searchQuery.toLowerCase() + '\uf8ff'),
          limit(20)
        );

        const forumsSnapshot = await getDocs(forumsQuery);
        forumsSnapshot.forEach(doc => {
          const forumData = doc.data() as ForumData;
          results.push({
            id: doc.id,
            type: 'forum',
            data: forumData
          });
        });

        // Search side rooms
        const sideRoomsQuery = query(
          collection(db, 'sideRooms'),
          where('name', '>=', searchQuery.toLowerCase()),
          where('name', '<=', searchQuery.toLowerCase() + '\uf8ff'),
          limit(20)
        );

        const sideRoomsSnapshot = await getDocs(sideRoomsQuery);
        sideRoomsSnapshot.forEach(doc => {
          const roomData = doc.data() as SideRoomData;
          results.push({
            id: doc.id,
            type: 'sideRoom',
            data: roomData
          });
        });

        setResults(results);
      } catch (err) {
        console.error('Error searching:', err);
        setError('Failed to search. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    search();
  }, [searchQuery, db]);

  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case 'user':
        navigate(`/profile/${result.id}`);
        break;
      case 'post':
        navigate(`/post/${result.id}`);
        break;
      case 'forum':
        navigate(`/forum/${result.id}`);
        break;
      case 'sideRoom':
        navigate(`/side-room/${result.id}`);
        break;
    }
  };

  const filteredResults = results.filter(result => {
    switch (activeTab) {
      case 0:
        return result.type === 'user';
      case 1:
        return result.type === 'post';
      case 2:
        return result.type === 'forum';
      case 3:
        return result.type === 'sideRoom';
      default:
        return true;
    }
  });

  // Show loading state while Firestore is initializing
  if (dbLoading) {
    return <div>Loading...</div>;
  }

  // Show error if Firestore failed to initialize
  if (dbError) {
    return <div>Error: {dbError.message}</div>;
  }

  // Show error if no database connection
  if (!db) {
    return <div>Error: Database connection failed</div>;
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Search Results for "{searchQuery}"
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab label="Users" />
          <Tab label="Posts" />
          <Tab label="Forums" />
          <Tab label="Side Rooms" />
        </Tabs>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : filteredResults.length === 0 ? (
        <Typography variant="body1" color="text.secondary">
          No results found
        </Typography>
      ) : (
        <List>
          {filteredResults.map(result => (
            <ListItemButton
              key={result.id}
              onClick={() => handleResultClick(result)}
              sx={{ mb: 1, borderRadius: 1 }}
            >
              <ListItemAvatar>
                {result.type === 'user' ? (
                  <Avatar src={result.data.avatar} />
                ) : (
                  <Avatar>
                    {result.type === 'post' ? 'P' : result.type === 'forum' ? 'F' : 'S'}
                  </Avatar>
                )}
              </ListItemAvatar>
              <ListItemText
                primary={result.data.title || result.data.username || result.data.name}
                secondary={
                  result.type === 'post'
                    ? result.data.content.substring(0, 100) + '...'
                    : result.data.description
                }
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Container>
  );
};

export default SearchResults; 