import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Box, 
  Tabs, 
  Tab, 
  Card, 
  CardContent, 
  Typography, 
  TextField,
  Button,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Favorite, Comment, Share, Add } from '@mui/icons-material';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../services/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { User, UserProfile } from '../types/index';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index } = props;
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const Forums: React.FC = () => {
  const [value, setValue] = useState(0);
  const [newPost, setNewPost] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
  const [user] = useAuthState(auth);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const navigate = useNavigate();
  const [openCreateForum, setOpenCreateForum] = useState(false);
  const [newForumTitle, setNewForumTitle] = useState('');
  const [newForumDescription, setNewForumDescription] = useState('');

  useEffect(() => {
    if (user) {
      const fetchUserProfile = async () => {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data() as UserProfile);
        }
      };
      fetchUserProfile();
    }
  }, [user]);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const handlePost = async () => {
    if (!user || !newPost.trim()) return;

    try {
      await addDoc(collection(db, 'posts'), {
        content: newPost.trim(),
        authorId: user.uid,
        timestamp: new Date(),
        likes: [],
        comments: 0
      });
      setNewPost('');
    } catch (error) {
      console.error('Error creating post:', error);
    }
  };

  const handleCreateForum = async () => {
    if (!user || !newForumTitle.trim() || !newForumDescription.trim()) return;

    try {
      await addDoc(collection(db, 'forums'), {
        title: newForumTitle.trim(),
        description: newForumDescription.trim(),
        creatorId: user.uid,
        createdAt: new Date(),
        members: [user.uid],
        posts: 0
      });
      setOpenCreateForum(false);
      setNewForumTitle('');
      setNewForumDescription('');
    } catch (error) {
      console.error('Error creating forum:', error);
    }
  };

  React.useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const newPosts = await Promise.all(snapshot.docs.map(async (postDoc) => {
        const data = postDoc.data();
        // Fetch author information
        const authorRef = doc(db, 'users', data.authorId);
        const authorDoc = await getDoc(authorRef);
        const authorData = authorDoc.exists() ? authorDoc.data() as UserProfile : null;
        
        return {
          id: postDoc.id,
          content: data.content || '',
          authorId: data.authorId || '',
          authorName: authorData?.name || 'Anonymous',
          authorAvatar: authorData?.profilePic || '',
          username: authorData?.username || 'anonymous',
          timestamp: data.timestamp?.toDate() || new Date(),
          likes: data.likes || [],
          comments: data.comments || 0
        };
      }));
      setPosts(newPosts);
    });

    return () => unsubscribe();
  }, []);

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Forums
        </Typography>

        <Tabs value={value} onChange={handleChange} centered>
          <Tab label="For You" />
          <Tab label="Following" />
          <Tab label="Popular" />
        </Tabs>

        <TabPanel value={value} index={0}>
          {user && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Avatar 
                    src={userProfile?.profilePic || undefined}
                    onClick={() => navigate(`/profile/${user.uid}`)}
                    sx={{ cursor: 'pointer' }}
                  />
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="What's happening?"
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                  />
                </Box>
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button variant="contained" onClick={handlePost}>
                    Post
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}

          {posts.map((post) => (
            <Card key={post.id} sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <Avatar 
                    src={post.authorAvatar} 
                    onClick={() => navigate(`/profile/${post.authorId}`)}
                    sx={{ cursor: 'pointer' }}
                  />
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {post.authorName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      @{post.username}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(post.timestamp).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Box>
                <Typography>{post.content}</Typography>
                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <IconButton size="small">
                    <Favorite />
                    <Typography variant="body2" sx={{ ml: 1 }}>
                      {post.likes.length}
                    </Typography>
                  </IconButton>
                  <IconButton size="small">
                    <Comment />
                    <Typography variant="body2" sx={{ ml: 1 }}>
                      {post.comments}
                    </Typography>
                  </IconButton>
                  <IconButton size="small">
                    <Share />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          ))}
        </TabPanel>

        <TabPanel value={value} index={1}>
          <Typography>Following content will appear here</Typography>
        </TabPanel>

        <TabPanel value={value} index={2}>
          <Typography>Popular content will appear here</Typography>
        </TabPanel>

        <Dialog open={openCreateForum} onClose={() => setOpenCreateForum(false)}>
          <DialogTitle>Create New Forum</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Forum Title"
              fullWidth
              value={newForumTitle}
              onChange={(e) => setNewForumTitle(e.target.value)}
            />
            <TextField
              margin="dense"
              label="Description"
              fullWidth
              multiline
              rows={4}
              value={newForumDescription}
              onChange={(e) => setNewForumDescription(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenCreateForum(false)}>Cancel</Button>
            <Button onClick={handleCreateForum} variant="contained">Create</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default Forums; 