import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Divider,
  CircularProgress,
  Paper,
  Tabs,
  Tab,
  useTheme,
  useMediaQuery,
  ListItemButton
} from '@mui/material';
import {
  Tag as TagIcon,
  Forum as ForumIcon,
  LocalCafe as SideRoomIcon,
  Group
} from '@mui/icons-material';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, getDoc, doc, orderBy, limit } from 'firebase/firestore';
import { SideRoom } from '../types/index';

interface SearchResult {
  id: string;
  type: 'user' | 'post' | 'forum' | 'sideRoom';
  title: string;
  subtitle: string;
  data: any;
}

interface UserData {
  username: string;
  name: string;
  profilePic: string;
}

interface PostData {
  content: string;
  authorId: string;
  timestamp: any;
  likes: string[];
  comments: number;
}

interface ForumData {
  title: string;
  description: string;
}

interface SideRoomData {
  name: string;
  description: string;
}

const SearchResults: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get('q');
    if (query) {
      setSearchQuery(query);
      handleSearch(query);
    }
  }, [location]);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
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
          title: userData.username,
          subtitle: userData.name || 'No name set',
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
          title: postData.content.substring(0, 50) + '...',
          subtitle: `by ${authorData?.name || authorData?.username || 'Unknown'}`,
          data: postData
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
          title: forumData.title,
          subtitle: forumData.description,
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
          title: roomData.name,
          subtitle: roomData.description,
          data: { id: doc.id, ...roomData } as SideRoom
        });
      });

      setResults(results);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
      case 0: return result.type === 'user';
      case 1: return result.type === 'post';
      case 2: return result.type === 'forum';
      case 3: return result.type === 'sideRoom';
      default: return true;
    }
  });

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Search Results for "{searchQuery}"
        </Typography>

        <Paper sx={{ mb: 4 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant={isMobile ? "fullWidth" : "standard"}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Users" />
            <Tab label="Posts" />
            <Tab label="Forums" />
            <Tab label="Side Rooms" />
          </Tabs>
        </Paper>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredResults.length > 0 ? (
          <List>
            {filteredResults.map((result, index) => (
              <React.Fragment key={result.id}>
                <ListItemButton
                  onClick={() => handleResultClick(result)}
                  sx={{
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <ListItemAvatar>
                    {result.type === 'user' ? (
                      <Avatar src={result.data.profilePic} />
                    ) : (
                      <Avatar>
                        {result.type === 'post' ? <TagIcon /> :
                         result.type === 'forum' ? <ForumIcon /> :
                         <SideRoomIcon />}
                      </Avatar>
                    )}
                  </ListItemAvatar>
                  <ListItemText
                    primary={result.title}
                    secondary={result.subtitle}
                  />
                </ListItemButton>
                {index < filteredResults.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        ) : (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No results found
            </Typography>
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default SearchResults; 