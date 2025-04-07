import React, { useState, useEffect } from 'react';
import { Container, Box, Typography, CircularProgress, Alert, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import CreatePost from '../components/CreatePost';
import Stories from '../components/Stories';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, arrayUnion, arrayRemove, serverTimestamp, where, limit, deleteDoc, getDoc, increment, Timestamp, getDocs, DocumentData } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../services/firebase';
import { UserProfile, PostData, Comment } from '../types';
import { useFirestore } from '../context/FirestoreContext';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { PostComponent } from '../components/PostComponent';
import Post from '../components/Post';

const Feed: React.FC = () => {
  const { currentUser } = useAuth();
  const { db } = useFirestore();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState<string[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    if (!db) return;

    const loadUserProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (!userDoc.exists()) {
          setError('User profile not found');
          setLoading(false);
          return;
        }

        const userData = userDoc.data() as UserProfile;
        setUserProfile(userData);
        setFollowing(userData.connections || []);
        setProfileLoaded(true);
      } catch (error) {
        console.error('Error loading user profile:', error);
        setError('Failed to load user profile');
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [currentUser, db, navigate]);

  useEffect(() => {
    if (!currentUser || !db) {
      setLoading(false);
      return;
    }

    const postsRef = collection(db, 'posts');
    
    // Simpler query that only orders by timestamp
    const postsQuery = query(
      postsRef,
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const newPosts: PostData[] = [];
      
      snapshot.forEach((doc) => {
        const post = { id: doc.id, ...doc.data() } as PostData;
        // Filter posts client-side
        if ((!post.deleted) && (post.authorId === currentUser.uid || following.includes(post.authorId))) {
          newPosts.push(post);
        }
      });

      // Filter out posts from blocked users
      const filteredPosts = newPosts.filter(post => 
        !userProfile?.blockedUsers?.includes(post.authorId)
      );

      setPosts(filteredPosts);
      setError(null);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching posts:', error);
      setError('Error loading posts. Please try again later.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, db, following, userProfile?.blockedUsers]);

  const uploadImage = async (file: File): Promise<string> => {
    const storageRef = ref(storage, `posts/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  const handleCreatePost = async (content: string, imageFile?: File) => {
    if (!db || !currentUser) {
      setError('Please sign in to create a post');
      return;
    }

    try {
      // Get user profile data
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;

      const postData = {
        content: content.trim(),
        authorId: currentUser.uid,
        authorName: userData?.name || currentUser.displayName || 'Anonymous',
        authorAvatar: userData?.profilePic || currentUser.photoURL || '',
        timestamp: serverTimestamp() as any,
        likes: 0,
        likedBy: [],
        comments: [],
        tags: content.match(/#[a-zA-Z0-9_]+/g) || [],
        isPrivate: false,
        userId: currentUser.uid,
        reposts: 0,
        views: 0,
        isPinned: false,
        isEdited: false,
        isArchived: false,
        deleted: false
      };

      // Only add imageUrl if an image was uploaded successfully
      if (imageFile) {
        const imageUrl = await uploadImage(imageFile);
        if (imageUrl) {
          Object.assign(postData, { imageUrl });
        }
      }

      // Add the post to Firestore
      const docRef = await addDoc(collection(db, 'posts'), postData);
      
      // Get the newly created post with its ID
      const newPostDoc = await getDoc(docRef);
      if (newPostDoc.exists()) {
        const newPost: PostData = {
          ...newPostDoc.data() as PostData,
          id: newPostDoc.id
        };
        
        // Update local state with the new post
        setPosts(prevPosts => [newPost, ...prevPosts]);
        toast.success('Post created successfully');
      }
    } catch (error) {
      console.error('Error creating post:', error);
      setError('Failed to create post');
      toast.error('Failed to create post');
    }
  };

  const createNotification = async (recipientId: string, type: 'follow' | 'like' | 'comment' | 'tag' | 'mention' | 'room_invite', content: string, link: string, relatedId?: string) => {
    if (!db || !currentUser) return;

    try {
      const notificationData = {
        type,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'Anonymous',
        senderAvatar: currentUser.photoURL || '',
        recipientId,
        read: false,
        timestamp: serverTimestamp(),
        content,
        link,
        relatedId
      };

      await addDoc(collection(db, 'notifications'), notificationData);
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  };

  const handleLike = async (postId: string) => {
    if (!db || !currentUser) return;

    try {
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);

      if (postDoc.exists()) {
        const postData = postDoc.data();
        const isLiked = postData.likedBy?.includes(currentUser.uid);

        await updateDoc(postRef, {
          likes: isLiked ? increment(-1) : increment(1),
          likedBy: isLiked 
            ? arrayRemove(currentUser.uid)
            : arrayUnion(currentUser.uid)
        });

        // Create notification for like
        if (!isLiked && postData.authorId !== currentUser.uid) {
          await createNotification(
            postData.authorId,
            'like',
            `${currentUser.displayName || 'Someone'} liked your post`,
            `/post/${postId}`,
            postId
          );
        }
      }
    } catch (error) {
      console.error('Error updating like:', error);
      setError('Failed to update like');
    }
  };

  const handleComment = async (postId: string, content: string) => {
    if (!db || !currentUser) return;

    try {
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
      const postData = postDoc.data();

      const commentData = {
        content,
        authorId: currentUser.uid,
        authorName: currentUser.displayName || 'Anonymous',
        authorAvatar: currentUser.photoURL || '',
        timestamp: serverTimestamp() as Timestamp,
        likes: 0
      };

      await updateDoc(postRef, {
        comments: arrayUnion(commentData)
      });

      // Create notification for comment
      if (postData && postData.authorId !== currentUser.uid) {
        await createNotification(
          postData.authorId,
          'comment',
          `${currentUser.displayName || 'Someone'} commented on your post`,
          `/post/${postId}`,
          postId
        );
      }

      // Check for mentions and create notifications
      const mentions = content.match(/@(\w+)/g);
      if (mentions) {
        const uniqueMentions = Array.from(new Set(mentions));
        for (const mention of uniqueMentions) {
          const username = mention.slice(1);
          const userQuery = query(collection(db, 'users'), where('username', '==', username), limit(1));
          const userDocs = await getDocs(userQuery);
          
          if (!userDocs.empty) {
            const mentionedUser = userDocs.docs[0];
            if (mentionedUser.id !== currentUser.uid) {
              await createNotification(
                mentionedUser.id,
                'mention',
                `${currentUser.displayName || 'Someone'} mentioned you in a comment`,
                `/post/${postId}`,
                postId
              );
            }
          }
        }
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      setError('Failed to add comment');
    }
  };

  const handleEditPost = async (postId: string, newContent: string) => {
    if (!db || !currentUser) return;

    try {
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);

      if (postDoc.exists()) {
        const postData = postDoc.data();
        if (postData.authorId !== currentUser.uid) {
          throw new Error('You can only edit your own posts');
        }

        await updateDoc(postRef, {
          content: newContent,
          isEdited: true,
          lastEdited: serverTimestamp()
        });

        // Update local state
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post.id === postId 
              ? { 
                  ...post, 
                  content: newContent, 
                  isEdited: true, 
                  lastEdited: Timestamp.now() 
                }
              : post
          )
        );

        toast.success('Post updated successfully');
      }
    } catch (error) {
      console.error('Error updating post:', error);
      setError('Failed to update post');
      toast.error('Failed to update post');
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!db || !currentUser) return;

    try {
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);

      if (postDoc.exists()) {
        const postData = postDoc.data();
        if (postData.authorId !== currentUser.uid) {
          throw new Error('You can only delete your own posts');
        }

        // Delete associated image if it exists
        if (postData.imageUrl) {
          try {
            const imageRef = ref(storage, postData.imageUrl);
            await deleteObject(imageRef);
          } catch (error) {
            console.error('Error deleting image:', error);
            // Continue with post deletion even if image deletion fails
          }
        }

        await deleteDoc(postRef);
        
        // Update local state
        setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
        toast.success('Post deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      setError('Failed to delete post');
      toast.error('Failed to delete post');
    }
  };

  if (!currentUser) {
    return (
      <Container maxWidth="md">
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="h6">Please sign in to view your feed</Typography>
        </Box>
      </Container>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Container maxWidth="lg">
      {/* Feed Header */}
      <Box 
        sx={{ 
          mb: 4,
          pt: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative'
        }}
      >
        <Typography 
          variant="h4" 
          component="h1"
          sx={{
            fontWeight: 'bold',
            background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
            backgroundClip: 'text',
            textFillColor: 'transparent',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 1,
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            position: 'relative',
            '&::after': {
              content: '""',
              position: 'absolute',
              bottom: -8,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '60px',
              height: '4px',
              background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
              borderRadius: '2px'
            }
          }}
        >
          Your Feed
        </Typography>
        <Typography 
          variant="subtitle1" 
          color="text.secondary"
          sx={{ 
            textAlign: 'center',
            fontStyle: 'italic',
            mb: 2
          }}
        >
          Stay updated with your friends and community
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Stories Section */}
          <Box sx={{ mb: 4 }}>
            <Stories following={userProfile?.following || []} />
          </Box>

          {/* Create Post Section */}
          <Box sx={{ mb: 4 }}>
            <CreatePost 
              user={{
                name: currentUser?.displayName || 'Anonymous',
                avatar: currentUser?.photoURL || '',
                username: userProfile?.username || '',
                isVerified: userProfile?.isVerified || false
              }}
              onSubmit={handleCreatePost}
            />
          </Box>

          {/* Posts Section */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {posts.length === 0 ? (
              <Typography variant="body1" color="text.secondary" align="center">
                No posts yet. Follow some users to see their posts!
              </Typography>
            ) : (
              posts.map((post) => (
                <Post
                  key={post.id}
                  id={post.id}
                  authorId={post.authorId || currentUser?.uid || ''}
                  authorName={post.authorName || 'Anonymous'}
                  authorAvatar={post.authorAvatar || ''}
                  content={post.content || ''}
                  timestamp={post.timestamp || Timestamp.now()}
                  likes={post.likes || 0}
                  likedBy={post.likedBy || []}
                  comments={post.comments || []}
                  imageUrl={post.imageUrl}
                  tags={post.tags || []}
                  isPrivate={post.isPrivate || false}
                  userId={post.userId || currentUser?.uid || ''}
                  reposts={post.reposts || 0}
                  views={post.views || 0}
                  isPinned={post.isPinned || false}
                  isEdited={post.isEdited || false}
                  lastEdited={post.lastEdited}
                  isArchived={post.isArchived || false}
                  deleted={post.deleted || false}
                  onLike={handleLike}
                  onComment={handleComment}
                  onDelete={handleDeletePost}
                  onEdit={handleEditPost}
                  onShare={async () => {}}
                  isOwnPost={post.authorId === currentUser?.uid}
                />
              ))
            )}
          </Box>
        </>
      )}
    </Container>
  );
};

export default Feed;