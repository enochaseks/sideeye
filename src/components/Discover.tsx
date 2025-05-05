import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActionArea,
  Chip,
  Avatar,
  IconButton,
  CircularProgress,
} from '@mui/material';
import { db } from '../firebase';
import { collection, query, orderBy, limit, getDocs, doc, getDoc, DocumentData } from 'firebase/firestore';
import { Link } from 'react-router-dom';

interface UserData {
  username: string;
  avatarUrl: string;
}

interface PostData {
  content: string;
  imageUrl?: string;
  likes: number;
  comments: number;
  authorId: string;
  createdAt: any;
}

interface TrendingPost {
  id: string;
  content: string;
  imageUrl?: string;
  likes: number;
  comments: number;
  author: {
    username: string;
    avatarUrl: string;
  };
  createdAt: Date;
}

const Discover: React.FC = () => {
  const [trendingPosts, setTrendingPosts] = useState<TrendingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrendingPosts = async () => {
      try {
        const postsRef = collection(db, 'posts');
        const q = query(postsRef, orderBy('likes', 'desc'), limit(10));
        const querySnapshot = await getDocs(q);
        
        const posts = await Promise.all(
          querySnapshot.docs.map(async (postDoc) => {
            const postData = postDoc.data() as PostData;
            const authorRef = doc(db, 'users', postData.authorId);
            const authorDoc = await getDoc(authorRef);
            const authorData = authorDoc.data() as UserData;
            
            return {
              id: postDoc.id,
              content: postData.content,
              imageUrl: postData.imageUrl,
              likes: postData.likes || 0,
              comments: postData.comments || 0,
              author: {
                username: authorData?.username || 'Unknown User',
                avatarUrl: authorData?.avatarUrl || ''
              },
              createdAt: postData.createdAt?.toDate() || new Date()
            };
          })
        );
        
        setTrendingPosts(posts);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch trending posts');
        setLoading(false);
        console.error('Error fetching trending posts:', err);
      }
    };

    fetchTrendingPosts();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box p={2}>
      <Typography variant="h5" gutterBottom>
        Trending Posts
      </Typography>
      <Grid container spacing={2}>
        {trendingPosts.map((post) => (
          <Grid item xs={12} sm={6} md={4} key={post.id}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <Avatar
                    src={post.author.avatarUrl}
                    alt={post.author.username}
                    component={Link}
                    to={`/profile/${post.author.username}`}
                  />
                  <Typography
                    variant="subtitle1"
                    component={Link}
                    to={`/profile/${post.author.username}`}
                    sx={{ ml: 1, textDecoration: 'none', color: 'inherit' }}
                  >
                    {post.author.username}
                  </Typography>
                </Box>
                <Typography variant="body1" gutterBottom>
                  {post.content}
                </Typography>
                {post.imageUrl && (
                  <Box mt={2}>
                    <img
                      src={post.imageUrl}
                      alt="Post content"
                      style={{ maxWidth: '100%', height: 'auto' }}
                    />
                  </Box>
                )}
                <Box display="flex" justifyContent="space-between" mt={2}>
                  <Typography variant="body2" color="textSecondary">
                    {post.likes} likes
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {post.comments} comments
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Discover; 