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
  const { currentUser, loading: authLoading } = useAuth();
  const { db } = useFirestore();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState<string[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    if (authLoading || !currentUser) {
      if (!authLoading && !currentUser) {
        navigate('/login');
      }
      return;
    }

    if (!db) return;

    console.log("Feed: Auth finished, currentUser exists. Loading user profile...");
    setFeedLoading(true);
    const loadUserProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (!userDoc.exists()) {
          setError('User profile not found');
          setFeedLoading(false);
          return;
        }

        const userData = userDoc.data() as UserProfile;
        setUserProfile(userData);
        setFollowing(userData.connections || []);
        setProfileLoaded(true);
      } catch (error) {
        console.error('Error loading user profile:', error);
        setError('Failed to load user profile');
        setFeedLoading(false);
      }
    };

    loadUserProfile();
  }, [currentUser, db, navigate, authLoading]);

  useEffect(() => {
    if (authLoading || !currentUser || !db || !profileLoaded) {
      return;
    }

    console.log("Feed: Auth finished, profile loaded. Setting up posts listener...");
    setFeedLoading(true);
    const postsRef = collection(db, 'posts');
    
    const postsQuery = query(
      postsRef,
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      console.log("Feed: Posts snapshot received.");
      const newPosts: PostData[] = [];
      
      snapshot.forEach((doc) => {
        const post = { id: doc.id, ...doc.data() } as PostData;
        if ((!post.deleted) && (post.authorId === currentUser.uid || following.includes(post.authorId))) {
          newPosts.push(post);
        }
      });

      const filteredPosts = newPosts.filter(post => 
        !userProfile?.blockedUsers?.includes(post.authorId)
      );

      setPosts(filteredPosts);
      setError(null);
      setFeedLoading(false);
    }, (error) => {
      console.error('Error fetching posts:', error);
      setError('Error loading posts. Please try again later.');
      setFeedLoading(false);
    });

    return () => {
      console.log("Feed: Unsubscribing posts listener.");
      unsubscribe();
    };
  }, [currentUser, db, following, userProfile?.blockedUsers, authLoading, profileLoaded]);

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

      if (imageFile) {
        const imageUrl = await uploadImage(imageFile);
        if (imageUrl) {
          Object.assign(postData, { imageUrl });
        }
      }

      const docRef = await addDoc(collection(db, 'posts'), postData);
      
      const newPostDoc = await getDoc(docRef);
      if (newPostDoc.exists()) {
        const newPost: PostData = {
          ...newPostDoc.data() as PostData,
          id: newPostDoc.id
        };
        
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

      if (postData && postData.authorId !== currentUser.uid) {
        await createNotification(
          postData.authorId,
          'comment',
          `${currentUser.displayName || 'Someone'} commented on your post`,
          `/post/${postId}`,
          postId
        );
      }

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

        if (postData.imageUrl) {
          try {
            const imageRef = ref(storage, postData.imageUrl);
            await deleteObject(imageRef);
          } catch (error) {
            console.error('Error deleting image:', error);
          }
        }

        await deleteDoc(postRef);
        
        setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
        toast.success('Post deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      setError('Failed to delete post');
      toast.error('Failed to delete post');
    }
  };

  if (authLoading || feedLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!currentUser) {
    return (
      <Container maxWidth="md">
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="h6">Please sign in to view your feed</Typography>
        </Box>
      </Container>
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

      {feedLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box sx={{ mb: 4 }}>
            <Stories following={userProfile?.following || []} />
          </Box>

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