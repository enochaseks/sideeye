import React, { useState, useEffect, useCallback } from 'react';
import { Container, Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Paper, Chip } from '@mui/material';
import Post from '../components/Post';
import CreatePost from '../components/CreatePost';
import Stories from '../components/Stories';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, arrayUnion, arrayRemove, serverTimestamp, where, limit, deleteDoc, getDoc, increment, setDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
import { User, UserProfile } from '../types';

interface PostData {
  id: string;
  author: {
    name: string;
    avatar: string;
    username: string;
    isVerified: boolean;
  };
  content: string;
  timestamp: Date;
  likes: number;
  comments: number;
  likedBy: string[];
  imageUrl?: string;
  tags?: string[];
}

interface TrendingTopic {
  tag: string;
  count: number;
  posts: PostData[];
}

const HomePage: React.FC = () => {
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostData | null>(null);
  const [commentText, setCommentText] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Get user profile
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('User profile loaded:', userData);
          setUserProfile(userData as UserProfile);
        } else {
          // Create user profile if it doesn't exist
          const newUserProfile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            name: user.displayName || 'Anonymous',
            username: user.email?.split('@')[0] || 'anonymous',
            avatar: user.photoURL || '',
            profilePic: user.photoURL || '',
            bio: '',
            isVerified: false,
            followers: 0,
            following: 0,
            posts: 0,
            createdAt: serverTimestamp()
          };
          await setDoc(doc(db, 'users', user.uid), newUserProfile);
          console.log('Created new user profile:', newUserProfile);
          setUserProfile(newUserProfile);
        }
      } else {
        setUserProfile(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const setupListeners = useCallback(() => {
    if (!currentUser) return () => {};

    // Listen for user profile changes
    const userRef = doc(db, 'users', currentUser.uid);
    const unsubscribeUser = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        console.log('User profile updated:', userData);
        setUserProfile(userData as UserProfile);
      }
    });

    // Listen for posts
    const postsQuery = query(
      collection(db, 'posts'),
      orderBy('timestamp', 'desc')
    );
    const unsubscribePosts = onSnapshot(postsQuery, (snapshot) => {
      const newPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      })) as PostData[];
      setPosts(newPosts);
      setLoading(false);
    });

    // Listen for trending topics
    const topicsQuery = query(
      collection(db, 'trending'),
      orderBy('count', 'desc'),
      limit(5)
    );
    const unsubscribeTrending = onSnapshot(topicsQuery, (snapshot) => {
      const newTopics = snapshot.docs.map(doc => ({
        tag: doc.id,
        count: doc.data().count,
        posts: doc.data().posts || [],
      }));
      setTrendingTopics(newTopics);
    });

    return () => {
      unsubscribeUser();
      unsubscribePosts();
      unsubscribeTrending();
    };
  }, [currentUser]);

  useEffect(() => {
    const cleanup = setupListeners();
    return cleanup;
  }, [setupListeners]);

  const handleCreatePost = async () => {
    if (!currentUser || !userProfile) {
      setError('You must be logged in to create a post');
      return;
    }

    if (!newPostContent.trim() && !selectedImage) {
      setError('Please add some content or an image to your post');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let imageUrl = null;
      if (selectedImage) {
        const storageRef = ref(storage, `posts/${currentUser.uid}/${Date.now()}_${selectedImage.name}`);
        await uploadBytes(storageRef, selectedImage);
        imageUrl = await getDownloadURL(storageRef);
      }

      const postData = {
        userId: currentUser.uid,
        author: {
          name: userProfile.name,
          avatar: userProfile.avatar,
          username: userProfile.username,
          isVerified: userProfile.isVerified,
        },
        content: newPostContent.trim(),
        imageUrl,
        timestamp: serverTimestamp(),
        likes: 0,
        comments: 0,
        likedBy: [],
        tags: newPostContent.match(/#[a-zA-Z0-9_]+/g)?.map(tag => tag.slice(1)) || [],
      };

      console.log('Creating post with data:', JSON.stringify(postData, null, 2));

      // First create the post
      const postRef = await addDoc(collection(db, 'posts'), postData);

      // Then update user's post count
      await updateDoc(doc(db, 'users', currentUser.uid), {
        posts: increment(1),
      });

      // Update trending topics
      if (postData.tags.length > 0) {
        for (const tag of postData.tags) {
          const tagRef = doc(db, 'trending', tag);
          const tagDoc = await getDoc(tagRef);
          if (tagDoc.exists()) {
            await updateDoc(tagRef, {
              count: increment(1),
              lastUpdated: serverTimestamp(),
            });
          } else {
            await setDoc(tagRef, {
              tag: tag,
              count: 1,
              lastUpdated: serverTimestamp(),
            });
          }
        }
      }

      setNewPostContent('');
      setSelectedImage(null);
      setImagePreview(null);
    } catch (err) {
      console.error('Error creating post:', err);
      setError('Failed to create post. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!currentUser) return;

    try {
      const postRef = doc(db, 'posts', postId);
      const post = posts.find(p => p.id === postId);

      if (post?.likedBy.includes(currentUser.uid)) {
        await updateDoc(postRef, {
          likes: post.likes - 1,
          likedBy: arrayRemove(currentUser.uid),
        });
      } else {
        await updateDoc(postRef, {
          likes: (post?.likes || 0) + 1,
          likedBy: arrayUnion(currentUser.uid),
        });
      }
    } catch (error) {
      console.error('Error updating like:', error);
    }
  };

  const handleComment = (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (post) {
      setSelectedPost(post);
      setCommentDialogOpen(true);
    }
  };

  const handleCommentSubmit = async () => {
    if (!currentUser || !selectedPost) return;

    try {
      const postRef = doc(db, 'posts', selectedPost.id);
      await updateDoc(postRef, {
        comments: selectedPost.comments + 1,
      });

      await addDoc(collection(db, 'comments'), {
        postId: selectedPost.id,
        author: {
          name: currentUser.displayName || 'Anonymous',
          avatar: currentUser.photoURL || '',
          username: currentUser.email?.split('@')[0] || 'anonymous',
        },
        content: commentText,
        timestamp: serverTimestamp(),
      });

      setCommentDialogOpen(false);
      setCommentText('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleShare = async (postId: string) => {
    // Implement share functionality
    console.log('Sharing post:', postId);
  };

  const handleDeletePost = async (postId: string) => {
    if (!currentUser) return;

    try {
      const postRef = doc(db, 'posts', postId);
      const post = posts.find(p => p.id === postId);

      if (post?.author.username === currentUser.email?.split('@')[0]) {
        await deleteDoc(postRef);
      }
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  if (!currentUser) {
    return (
      <Container maxWidth="md">
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="h5">
            Please sign in to view the feed
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4 }}>
        <Stories />
        
        {/* Trending Topics Section */}
        {trendingTopics.length > 0 && (
          <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Trending Topics
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {trendingTopics.map((topic) => (
                <Chip
                  key={topic.tag}
                  label={`#${topic.tag} (${topic.count})`}
                  onClick={() => {
                    setPosts(topic.posts);
                  }}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Paper>
        )}

        {currentUser && userProfile && (
          <CreatePost
            user={{
              name: userProfile?.name || currentUser?.displayName || 'Anonymous',
              avatar: userProfile?.profilePic || currentUser?.photoURL || '',
            }}
            onSubmit={handleCreatePost}
          />
        )}
        
        {loading ? (
          <Typography>Loading posts...</Typography>
        ) : posts.length === 0 ? (
          <Typography>No posts yet. Be the first to post!</Typography>
        ) : (
          posts.map((post) => (
            <Post
              key={post.id}
              {...post}
              isLiked={post.likedBy.includes(currentUser?.uid || '')}
              onLike={handleLike}
              onComment={handleComment}
              onShare={handleShare}
              onDelete={handleDeletePost}
              isOwnPost={post.author.username === currentUser?.email?.split('@')[0]}
            />
          ))
        )}

        <Dialog open={commentDialogOpen} onClose={() => setCommentDialogOpen(false)}>
          <DialogTitle>Add a Comment</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Your comment"
              fullWidth
              multiline
              rows={4}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCommentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCommentSubmit} variant="contained">
              Comment
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default HomePage; 