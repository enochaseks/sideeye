import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Button, 
  IconButton, 
  Avatar,
  CircularProgress,
  Chip
} from '@mui/material';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  deleteDoc, 
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  increment,
  getDoc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import RestoreIcon from '@mui/icons-material/Restore';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';

interface DeletedPost {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  deletedAt: Date;
  scheduledForDeletion: Date;
  imageUrl?: string | null;
  tags?: string[];
}

const DeletedPosts: React.FC = () => {
  const { currentUser } = useAuth();
  const [deletedPosts, setDeletedPosts] = useState<DeletedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [permanentlyDeleting, setPermanentlyDeleting] = useState<string | null>(null);

  useEffect(() => {
    const fetchDeletedPosts = async () => {
      if (!currentUser) return;

      try {
        const deletedPostsQuery = query(
          collection(db, 'deleted_posts'),
          where('userId', '==', currentUser.uid)
        );

        const snapshot = await getDocs(deletedPostsQuery);
        const posts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          deletedAt: doc.data().deletedAt?.toDate(),
          scheduledForDeletion: doc.data().scheduledForDeletion?.toDate()
        })) as DeletedPost[];

        setDeletedPosts(posts);
      } catch (error) {
        console.error('Error fetching deleted posts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDeletedPosts();
  }, [currentUser]);

  const handleRestore = async (postId: string) => {
    if (!currentUser) return;

    setRestoring(postId);
    try {
      const deletedPostRef = doc(db, 'deleted_posts', postId);
      const deletedPostDoc = await getDoc(deletedPostRef);
      const deletedPost = deletedPostDoc.data();

      if (!deletedPost) {
        throw new Error('Post not found');
      }

      // Create new post with original data
      const newPostRef = doc(db, 'posts', postId);
      await updateDoc(newPostRef, {
        ...deletedPost,
        deletedAt: null,
        scheduledForDeletion: null
      });

      // Delete from deleted_posts collection
      await deleteDoc(deletedPostRef);

      // Update local state
      setDeletedPosts(prev => prev.filter(post => post.id !== postId));

      // Update user's post count
      await updateDoc(doc(db, 'users', currentUser.uid), {
        postCount: increment(1)
      });
    } catch (error) {
      console.error('Error restoring post:', error);
    } finally {
      setRestoring(null);
    }
  };

  const handlePermanentDelete = async (postId: string) => {
    if (!currentUser) return;

    setPermanentlyDeleting(postId);
    try {
      const deletedPostRef = doc(db, 'deleted_posts', postId);
      await deleteDoc(deletedPostRef);

      // Update local state
      setDeletedPosts(prev => prev.filter(post => post.id !== postId));
    } catch (error) {
      console.error('Error permanently deleting post:', error);
    } finally {
      setPermanentlyDeleting(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (deletedPosts.length === 0) {
    return (
      <Typography sx={{ mt: 4, textAlign: 'center' }}>
        No deleted posts found
      </Typography>
    );
  }

  return (
    <Box sx={{ mt: 4 }}>
      {deletedPosts.map((post) => (
        <Paper key={post.id} sx={{ p: 2, mb: 2, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Avatar 
              src={post.authorAvatar} 
              alt={post.authorName || 'Anonymous'}
              sx={{ mr: 2 }}
            >
              {post.authorName ? post.authorName.charAt(0) : 'A'}
            </Avatar>
            <Box>
              <Typography variant="subtitle1" fontWeight="bold">
                {post.authorName || 'Anonymous'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Deleted {formatDistanceToNow(post.deletedAt)} ago
              </Typography>
            </Box>
          </Box>

          <Typography sx={{ mb: 2 }}>{post.content}</Typography>

          {post.imageUrl && (
            <Box 
              component="img" 
              src={post.imageUrl} 
              alt="Post content" 
              sx={{ 
                maxWidth: '100%', 
                maxHeight: 300, 
                borderRadius: 1,
                mb: 2 
              }} 
            />
          )}

          {post.tags && post.tags.length > 0 && (
            <Box sx={{ mb: 2 }}>
              {post.tags.map((tag) => (
                <Chip 
                  key={tag} 
                  label={`#${tag}`} 
                  size="small" 
                  sx={{ mr: 1, mb: 1 }} 
                />
              ))}
            </Box>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<RestoreIcon />}
              onClick={() => handleRestore(post.id)}
              disabled={!!restoring}
            >
              {restoring === post.id ? <CircularProgress size={24} /> : 'Restore'}
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteForeverIcon />}
              onClick={() => handlePermanentDelete(post.id)}
              disabled={!!permanentlyDeleting}
            >
              {permanentlyDeleting === post.id ? <CircularProgress size={24} /> : 'Delete Forever'}
            </Button>
          </Box>
        </Paper>
      ))}
    </Box>
  );
};

export default DeletedPosts; 