import React, { useState, useEffect, useCallback } from 'react';
import { Container, Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Paper, Chip, CircularProgress, Snackbar, Alert } from '@mui/material';
import Post from '../components/Post';
import CreatePost from '../components/CreatePost';
import Stories from '../components/Stories';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, arrayUnion, arrayRemove, serverTimestamp, where, limit, deleteDoc, getDoc, increment, setDoc, getDocs, writeBatch, DocumentData } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../services/firebase';
import { UserProfile } from '../types/index';
import { Send as SendIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface UserData {
  name: string;
  avatar: string;
  username: string;
  isVerified: boolean;
}

interface PostData {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  username: string;
  timestamp: any;
  likes: number;
  likedBy: string[];
  comments: Comment[];
  commentCount: number;
  imageUrl?: string;
  userId: string;
  tags: string[];
  location?: string;
  isPrivate: boolean;
  isPinned: boolean;
  isEdited: boolean;
  lastEdited?: any;
  reposts: number;
  views: number;
  isArchived: boolean;
}

interface Comment {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  timestamp: any;
  likes: number;
  likedBy: string[];
  isEdited: boolean;
  lastEdited?: any;
  replies?: Comment[];
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
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log('Auth state changed - User logged in:', user);
        // Get user profile
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('User profile loaded:', userData);
          setUserProfile(userData as UserProfile);
        } else {
          // Create a new user profile document
          const newUserProfile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            name: user.displayName || '',
            username: user.displayName?.toLowerCase().replace(/\s+/g, '') || '',
            avatar: user.photoURL || '',
            profilePic: user.photoURL || '',
            bio: '',
            isVerified: false,
            followers: [], // Changed from number to string[]
            following: 0,
            posts: 0,
            createdAt: new Date()
          };

          await setDoc(doc(db, 'users', user.uid), newUserProfile);
          console.log('Created new user profile:', newUserProfile);
          setUserProfile(newUserProfile);
        }
      } else {
        console.log('Auth state changed - No user');
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
    const unsubscribePosts = onSnapshot(postsQuery, async (snapshot) => {
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
          likedBy: data.likedBy || [],
          comments: (data.comments || []).map((comment: any) => ({
            ...comment,
            timestamp: comment.timestamp?.toDate() || new Date()
          })),
          commentCount: data.commentCount || 0,
          imageUrl: data.imageUrl || '',
          userId: data.userId || '',
          tags: data.tags || [],
          isPrivate: data.isPrivate || false,
          isPinned: data.isPinned || false,
          isEdited: data.isEdited || false,
          reposts: data.reposts || 0,
          views: data.views || 0,
          isArchived: data.isArchived || false
        } as PostData;
      }));
      setPosts(newPosts);
      setLoading(false);
    });

    // Listen for trending topics
    const topicsQuery = query(
      collection(db, 'trending'),
      orderBy('count', 'desc'),
      limit(5)
    );
    const unsubscribeTrending = onSnapshot(topicsQuery, async (snapshot) => {
      const newTopics = await Promise.all(snapshot.docs.map(async (topicDoc) => {
        const data = topicDoc.data() as DocumentData;
        const posts = Array.isArray(data.posts) ? data.posts : [];
        
        // Ensure each post has the required properties
        const processedPosts = await Promise.all(posts.map(async (post: any) => {
          if (!post.authorId) return null;
          
          // Fetch author information
          const authorRef = doc(db, 'users', post.authorId);
          const authorDoc = await getDoc(authorRef);
          const authorData = authorDoc.exists() ? authorDoc.data() as UserProfile : null;
          
          return {
            id: post.id || '',
            content: post.content || '',
            authorId: post.authorId || '',
            authorName: authorData?.name || 'Anonymous',
            authorAvatar: authorData?.profilePic || '',
            username: authorData?.username || 'anonymous',
            timestamp: post.timestamp?.toDate() || new Date(),
            likes: post.likes || 0,
            likedBy: post.likedBy || [],
            comments: post.comments || [],
            commentCount: post.commentCount || 0,
            imageUrl: post.imageUrl || '',
            userId: post.userId || '',
            tags: post.tags || [],
            isPrivate: post.isPrivate || false,
            isPinned: post.isPinned || false,
            isEdited: post.isEdited || false,
            reposts: post.reposts || 0,
            views: post.views || 0,
            isArchived: post.isArchived || false
          } as PostData;
        }));

        return {
          tag: topicDoc.id,
          count: data.count || 0,
          posts: processedPosts.filter(Boolean) as PostData[]
        };
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

  const handleCreatePost = async (content: string, imageFile?: File) => {
    if (!currentUser || !userProfile) {
      console.error('User not authenticated or profile not loaded');
      return;
    }

    try {
      let imageUrl = '';
      
      // Upload image if provided
      if (imageFile) {
        const imageRef = ref(storage, `posts/${currentUser.uid}/${Date.now()}_${imageFile.name}`);
        await uploadBytes(imageRef, imageFile);
        imageUrl = await getDownloadURL(imageRef);
      }

      const tags = content.match(/#[a-zA-Z0-9_]+/g)?.map(tag => tag.slice(1)) || [];
      
      const newPost: Omit<PostData, 'id'> = {
        authorId: currentUser.uid,
        authorName: userProfile?.name || currentUser?.displayName || 'Anonymous',
        authorAvatar: userProfile?.profilePic || currentUser?.photoURL || 'https://ui-avatars.com/api/?name=Anonymous&background=random',
        username: userProfile?.username || 'anonymous',
        content,
        timestamp: new Date(),
        likes: 0,
        likedBy: [],
        comments: [],
        commentCount: 0,
        tags,
        reposts: 0,
        userId: currentUser.uid,
        isPrivate: false,
        isPinned: false,
        isEdited: false,
        views: 0,
        isArchived: false
      };

      if (imageUrl) {
        newPost.imageUrl = imageUrl;
      }

      // Add post to Firestore
      const postRef = await addDoc(collection(db, 'posts'), {
        ...newPost,
        timestamp: serverTimestamp()
      });

      // Update local state with the new post
      setPosts(prevPosts => [{
        ...newPost,
        id: postRef.id,
        timestamp: new Date()
      }, ...prevPosts]);

      // Update user's post count
      await updateDoc(doc(db, 'users', currentUser.uid), {
        postCount: increment(1)
      });

      console.log('Post created successfully');
    } catch (error) {
      console.error('Error creating post:', error);
    }
  };

  const handleLike = async (postId: string) => {
    if (!currentUser) return;

    try {
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
      
      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }

      const postData = postDoc.data();
      const isLiked = postData.likedBy?.includes(currentUser.uid) || false;

      if (isLiked) {
        // Unlike
        await updateDoc(postRef, {
          likes: increment(-1),
          likedBy: arrayRemove(currentUser.uid)
        });
      } else {
        // Like
        await updateDoc(postRef, {
          likes: increment(1),
          likedBy: arrayUnion(currentUser.uid)
        });
      }
    } catch (error) {
      console.error('Error updating like:', error);
    }
  };

  const handleComment = async (postId: string, content: string): Promise<void> => {
    if (!currentUser || !userProfile) return;
    
    try {
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
      
      if (!postDoc.exists()) {
        console.error('Post not found');
        return;
      }

      const newComment: Comment = {
        id: Date.now().toString(),
        content,
        authorId: currentUser.uid,
        authorName: userProfile.name || currentUser.displayName || 'Anonymous',
        authorAvatar: userProfile.profilePic || currentUser.photoURL || '',
        timestamp: new Date(),
        likes: 0,
        likedBy: [],
        isEdited: false
      };

      await updateDoc(postRef, {
        comments: arrayUnion(newComment)
      });

      setPosts((prev: PostData[]) => prev.map((post: PostData) => {
        if (post.id === postId) {
          const updatedPost: PostData = {
            ...post,
            comments: [...post.comments, newComment]
          };
          return updatedPost;
        }
        return post;
      }));
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleCommentSubmit = async () => {
    if (!currentUser || !selectedPostId || !commentText.trim()) {
      setError('Please enter a comment');
      return;
    }

    try {
      const postRef = doc(db, 'posts', selectedPostId);
      const postDoc = await getDoc(postRef);
      
      if (!postDoc.exists()) {
        setError('Post not found');
        return;
      }

      const postData = postDoc.data();
      
      // Create comment with all required fields from Comment interface
      const commentData: Comment = {
        id: Date.now().toString(),
        content: commentText.trim(),
        authorId: currentUser.uid,
        authorName: userProfile?.name || currentUser.displayName || 'Anonymous',
        authorAvatar: userProfile?.profilePic || currentUser.photoURL || '',
        timestamp: new Date(),
        likes: 0,
        likedBy: [],
        isEdited: false
      };

      // Add comment to post
      await updateDoc(postRef, {
        comments: arrayUnion(commentData)
      });

      // Create notification for post author if not the commenter
      if (postData.userId !== currentUser.uid) {
        await addDoc(collection(db, 'notifications'), {
          type: 'comment',
          senderId: currentUser.uid,
          receiverId: postData.userId,
          postId: selectedPostId,
          content: `${currentUser.displayName || 'Someone'} commented on your post`,
          timestamp: serverTimestamp(),
          read: false
        });
      }

      // Update local state
      setPosts(prev => prev.map(post => {
        if (post.id === selectedPostId) {
          return {
            ...post,
            comments: [...post.comments, commentData]
          };
        }
        return post;
      }));

      setCommentText('');
      setCommentDialogOpen(false);
      setSuccess('Comment added successfully');
    } catch (error) {
      console.error('Error adding comment:', error);
      setError('Failed to add comment');
    }
  };

  const handleShare = async (postId: string) => {
    if (!currentUser || !userProfile) {
      console.error('User not authenticated or profile not loaded');
      return;
    }

    try {
      const post = posts.find(p => p.id === postId);
      if (!post) {
        throw new Error('Post not found');
      }

      // Check if user has already reposted this post
      const repostQuery = query(
        collection(db, 'reposts'),
        where('originalPostId', '==', postId),
        where('reposterId', '==', currentUser.uid)
      );
      const repostSnapshot = await getDocs(repostQuery);
      
      if (!repostSnapshot.empty) {
        throw new Error('You have already reposted this post');
      }

      // Create a repost record
      const repostData = {
        originalPostId: postId,
        reposterId: currentUser.uid,
        reposterName: userProfile.name,
        reposterUsername: userProfile.username,
        reposterAvatar: userProfile.profilePic,
        timestamp: serverTimestamp()
      };

      // Add repost to Firestore
      await addDoc(collection(db, 'reposts'), repostData);

      // Update the original post's repost count
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        reposts: increment(1)
      });

      // Create repost notification
      if (post.userId !== currentUser.uid) {
        const notificationRef = doc(db, 'notifications', `${post.userId}_${postId}_repost`);
        await setDoc(notificationRef, {
          type: 'repost',
          postId,
          fromUser: {
            name: userProfile.name,
            username: userProfile.username,
            avatar: userProfile.profilePic
          },
          timestamp: serverTimestamp(),
          read: false
        });
      }

      // Update local state
      setPosts(prevPosts => prevPosts.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            reposts: (p.reposts || 0) + 1
          };
        }
        return p;
      }));

      console.log('Post reposted successfully');
    } catch (error) {
      console.error('Error sharing post:', error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!currentUser) {
      console.error('User not authenticated');
      return;
    }

    try {
      // Create a reference to the post document
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
      
      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }

      const postData = postDoc.data() as PostData;
      
      // Verify the current user is the owner of the post
      if (postData.userId !== currentUser.uid) {
        throw new Error('You can only delete your own posts');
      }

      // Create a reference to the deleted_posts collection
      const deletedPostRef = doc(db, 'deleted_posts', postId);
      
      // Copy the post to the deleted_posts collection with all necessary properties
      // Ensure no undefined values are passed
      const deletedPostData = {
        id: postId,
        content: postData.content || '',
        authorId: postData.authorId || '',
        authorName: postData.authorName || 'Anonymous',
        authorAvatar: postData.authorAvatar || '',
        timestamp: postData.timestamp || serverTimestamp(),
        likes: postData.likes || 0,
        likedBy: postData.likedBy || [],
        comments: postData.comments || [],
        commentCount: postData.comments?.length || 0,
        imageUrl: postData.imageUrl || null,
        userId: postData.userId || currentUser.uid,
        tags: postData.tags || [],
        location: postData.location || null,
        isPrivate: postData.isPrivate || false,
        isPinned: postData.isPinned || false,
        isEdited: postData.isEdited || false,
        lastEdited: postData.lastEdited || null,
        reposts: postData.reposts || 0,
        views: postData.views || 0,
        isArchived: postData.isArchived || false,
        isDeleted: true,
        deletedAt: serverTimestamp(),
        scheduledForDeletion: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      };

      await setDoc(deletedPostRef, deletedPostData);

      // Delete the original post
      await deleteDoc(postRef);

      // Delete the associated image if it exists
      if (postData.imageUrl) {
        const imageRef = ref(storage, postData.imageUrl);
        await deleteObject(imageRef).catch(error => {
          console.error('Error deleting image:', error);
        });
      }

      // Update the user's post count
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        postCount: increment(-1)
      });

      // Update local state
      setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
      
      console.log('Post moved to trash. It will be permanently deleted after 24 hours.');
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  // Add cleanup function
  const cleanupOldPosts = async () => {
    if (!currentUser) return;
    
    try {
      const postsRef = collection(db, 'posts');
      const q = query(
        postsRef,
        where('userId', '==', currentUser.uid),
        orderBy('timestamp', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const postsToDelete: string[] = [];
      
      querySnapshot.forEach((doc) => {
        const postData = doc.data();
        const postDate = postData.timestamp.toDate();
        const now = new Date();
        const diffInDays = Math.floor((now.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Delete posts older than 30 days
        if (diffInDays > 30) {
          postsToDelete.push(doc.id);
        }
      });
      
      // Delete posts in batches to avoid overwhelming Firestore
      const batch = writeBatch(db);
      for (const postId of postsToDelete) {
        const postRef = doc(db, 'posts', postId);
        batch.delete(postRef);
      }
      
      if (postsToDelete.length > 0) {
        await batch.commit();
        console.log(`Successfully deleted ${postsToDelete.length} old posts`);
      }
    } catch (error) {
      console.error('Error cleaning up old posts:', error);
    }
  };

  const clearCacheAndRefresh = async () => {
    try {
      // Clear the posts state
      setPosts([]);
      
      // Force a fresh fetch of posts
      const postsRef = collection(db, 'posts');
      const q = query(
        postsRef,
        where('userId', '==', currentUser?.uid),
        limit(50)
      );

      // Get fresh data from server
      const querySnapshot = await getDocs(q);
      
      const fetchedPosts: PostData[] = [];
      for (const postDoc of querySnapshot.docs) {
        const postData = postDoc.data();
        const authorDocRef = doc(db, 'users', postData.userId);
        const authorDoc = await getDoc(authorDocRef);
        const authorData = authorDoc.data() as UserData;

        if (authorData) {
          fetchedPosts.push({
            id: postDoc.id,
            content: postData.content,
            authorId: postData.userId,
            authorName: authorData.name || 'Unknown User',
            authorAvatar: authorData.avatar || '',
            username: authorData.username || 'anonymous',
            timestamp: postData.timestamp,
            likes: postData.likes || 0,
            likedBy: postData.likedBy || [],
            comments: postData.comments || [],
            commentCount: postData.commentCount || 0,
            imageUrl: postData.imageUrl || null,
            userId: postData.userId,
            tags: postData.tags || [],
            location: postData.location || null,
            isPrivate: postData.isPrivate || false,
            isPinned: postData.isPinned || false,
            isEdited: postData.isEdited || false,
            lastEdited: postData.lastEdited || null,
            reposts: postData.reposts || 0,
            views: postData.views || 0,
            isArchived: postData.isArchived || false
          });
        }
      }

      // Sort posts by timestamp in memory
      fetchedPosts.sort((a, b) => {
        const dateA = a.timestamp?.toDate?.() || new Date(0);
        const dateB = b.timestamp?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      setPosts(fetchedPosts);
      console.log('Cache cleared and data refreshed successfully');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  };

  useEffect(() => {
    const fetchPosts = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // First, clean up old posts
        await cleanupOldPosts();

        // Then fetch current posts
        const postsRef = collection(db, 'posts');
        const q = query(
          postsRef,
          where('userId', '==', currentUser.uid),
          limit(50)
        );

        const querySnapshot = await getDocs(q);
        const fetchedPosts: PostData[] = [];

        for (const postDoc of querySnapshot.docs) {
          const postData = postDoc.data();
          const authorDocRef = doc(db, 'users', postData.userId);
          const authorDoc = await getDoc(authorDocRef);
          const authorData = authorDoc.data() as UserData;

          if (authorData) {
            fetchedPosts.push({
              id: postDoc.id,
              content: postData.content,
              authorId: postData.userId,
              authorName: authorData.name || 'Unknown User',
              authorAvatar: authorData.avatar || '',
              username: authorData.username || 'anonymous',
              timestamp: postData.timestamp,
              likes: postData.likes || 0,
              likedBy: postData.likedBy || [],
              comments: postData.comments || [],
              commentCount: postData.commentCount || 0,
              imageUrl: postData.imageUrl || null,
              userId: postData.userId,
              tags: postData.tags || [],
              location: postData.location || null,
              isPrivate: postData.isPrivate || false,
              isPinned: postData.isPinned || false,
              isEdited: postData.isEdited || false,
              lastEdited: postData.lastEdited || null,
              reposts: postData.reposts || 0,
              views: postData.views || 0,
              isArchived: postData.isArchived || false
            });
          }
        }

        // Sort posts by timestamp in memory
        fetchedPosts.sort((a, b) => {
          const dateA = a.timestamp?.toDate?.() || new Date(0);
          const dateB = b.timestamp?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });

        setPosts(fetchedPosts);
      } catch (err) {
        console.error('Error fetching posts:', err);
        setError('Failed to load posts. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [currentUser]);

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
      <Box sx={{ py: 4 }}>
        <Stories />
        
        {currentUser && userProfile && (
          <CreatePost
            user={{
              name: userProfile?.name || currentUser?.displayName || 'Anonymous',
              avatar: userProfile?.profilePic || currentUser?.photoURL || '',
              username: userProfile?.username || currentUser?.email?.split('@')[0] || 'anonymous',
              isVerified: userProfile?.isVerified || false
            }}
            onSubmit={handleCreatePost}
          />
        )}
        
        <Box sx={{ mt: 4 }}>
          {/* Trending Topics Section */}
          {trendingTopics.length > 0 && (
            <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Trending Topics
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {trendingTopics.map((topic: TrendingTopic) => (
                  <Chip
                    key={topic.tag}
                    label={`#${topic.tag} (${topic.count})`}
                    onClick={() => {
                      if (Array.isArray(topic.posts)) {
                        // Ensure each post has the required string properties
                        const validPosts = topic.posts.map(post => ({
                          ...post,
                          content: String(post.content || ''),
                          authorName: String(post.authorName || 'Anonymous'),
                          authorAvatar: String(post.authorAvatar || ''),
                          username: String(post.username || 'anonymous'),
                          imageUrl: String(post.imageUrl || ''),
                          userId: String(post.userId || ''),
                          authorId: String(post.authorId || ''),
                          id: String(post.id || ''),
                          tags: Array.isArray(post.tags) ? post.tags.map(String) : []
                        }));
                        setPosts(validPosts);
                      } else {
                        console.error('Invalid posts data:', topic.posts);
                        setError('Error loading posts for this topic');
                      }
                    }}
                    sx={{
                      m: 0.5,
                      backgroundColor: '#f5f5f5',
                      '&:hover': {
                        backgroundColor: '#e0e0e0',
                      },
                    }}
                  />
                ))}
              </Box>
            </Paper>
          )}
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <CircularProgress />
            </Box>
          ) : posts.length === 0 ? (
            <Typography>No posts yet. Be the first to post!</Typography>
          ) : (
            posts.map((post) => (
              <Post
                key={post.id}
                id={post.id}
                authorId={post.authorId}
                authorName={post.authorName || 'Anonymous'}
                authorAvatar={post.authorAvatar || ''}
                content={post.content}
                timestamp={post.timestamp}
                likes={post.likes}
                likedBy={post.likedBy}
                comments={post.comments}
                commentCount={post.comments.length}
                imageUrl={post.imageUrl}
                tags={post.tags || []}
                isOwnPost={post.authorId === currentUser?.uid}
                onLike={handleLike}
                onComment={handleComment}
                onShare={handleShare}
                onDelete={handleDeletePost}
              />
            ))
          )}
        </Box>

        <Dialog 
          open={commentDialogOpen} 
          onClose={() => {
            setCommentDialogOpen(false);
            setCommentText('');
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Add Comment</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Your comment"
              type="text"
              fullWidth
              multiline
              rows={4}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setCommentDialogOpen(false);
              setCommentText('');
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleCommentSubmit}
              variant="contained"
              disabled={!commentText.trim()}
              startIcon={<SendIcon />}
            >
              Comment
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={() => setError(null)}
        >
          <Alert severity="error">{error}</Alert>
        </Snackbar>
        <Snackbar
          open={!!success}
          autoHideDuration={6000}
          onClose={() => setSuccess(null)}
        >
          <Alert severity="success">{success}</Alert>
        </Snackbar>
      </Box>
    </Container>
  );
};

export default HomePage;