import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Container, Box, Typography, CircularProgress, Alert, Paper, List, ListItem, ListItemAvatar, ListItemText, ListItemSecondaryAction, IconButton, Avatar, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Slide, AppBar, Toolbar, Divider } from '@mui/material';
import { useNavigate, Link } from 'react-router-dom';
import CreatePostDialog from '../components/CreatePostDialog';
import Stories from '../components/Stories';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, arrayUnion, arrayRemove, serverTimestamp, where, limit, deleteDoc, getDoc, increment, Timestamp, getDocs, DocumentData, documentId, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../services/firebase';
import { UserProfile, PostData, Comment } from '../types';
import { useFirestore } from '../context/FirestoreContext';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { PostComponent } from '../components/PostComponent';
import Post from '../components/Post';
import { formatDistanceToNow } from 'date-fns';
import FavoriteIcon from '@mui/icons-material/Favorite';
import RepeatIcon from '@mui/icons-material/Repeat';
import CommentIcon from '@mui/icons-material/Comment';
import { TransitionProps } from '@mui/material/transitions';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import DeleteIcon from '@mui/icons-material/Delete';

// Slide up transition for dialog
const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

// Add interface for repost data
interface RepostData {
  id: string;
  postId: string;
  userId: string;
  originalAuthorId: string;
  timestamp: any;
}

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
  const [selectedPost, setSelectedPost] = useState<PostData | null>(null);
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [commentText, setCommentText] = useState('');
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [localReposts, setLocalReposts] = useState<{postId: string, added: boolean}[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const open = Boolean(anchorEl);
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Function to load reposts separately
  const loadReposts = async (regularPosts: PostData[]) => {
    if (!db || !currentUser) return;
    
    try {
      // Get user's reposts
      const repostsRef = collection(db, 'reposts');
      const myRepostsQuery = query(
        repostsRef,
        where('userId', '==', currentUser.uid)
      );
      
      const myRepostsSnapshot = await getDocs(myRepostsQuery);
      console.log("Feed: User reposts received, count:", myRepostsSnapshot.size);
      
      // Get post IDs from reposts
      const repostedPostIds: string[] = [];
      const repostUserMap = new Map<string, string>();
      
      myRepostsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.postId) {
          repostedPostIds.push(data.postId);
          repostUserMap.set(data.postId, data.userId);
        }
      });
      
      if (repostedPostIds.length === 0) {
        return; // No reposts to load
      }
      
      // Fetch each reposted post individually to avoid permission issues
      const repostedPosts: PostData[] = [];
      
      for (const postId of repostedPostIds) {
        try {
          const postDoc = await getDoc(doc(db, 'posts', postId));
          if (postDoc.exists()) {
            const postData = postDoc.data();
            const repostedById = repostUserMap.get(postId);
            
            repostedPosts.push({
              id: postId,
              authorId: postData.authorId || '',
              authorName: postData.authorName || '',
              content: postData.content || '',
              timestamp: postData.timestamp || Timestamp.now(),
              likes: postData.likes || 0,
              likedBy: postData.likedBy || [],
              comments: postData.comments || [],
              reposts: postData.reposts || 0,
              repostedBy: postData.repostedBy || [],
              isRepost: true,
              repostedById,
              ...postData
            } as PostData);
          }
        } catch (err) {
          console.error(`Error fetching reposted post ${postId}:`, err);
        }
      }
      
      // Filter out posts that are already in the main posts list
      const existingPostIds = regularPosts.map(p => p.id);
      const newReposts = repostedPosts.filter(p => !existingPostIds.includes(p.id));
      
      console.log("Feed: Filtered reposts count:", newReposts.length);
      
      // Combine with existing posts and update state
      if (newReposts.length > 0) {
        setPosts(prevPosts => {
          const combined = [...prevPosts, ...newReposts];
          // Sort by timestamp
          combined.sort((a, b) => {
            const timeA = a.timestamp?.toDate?.() || new Date();
            const timeB = b.timestamp?.toDate?.() || new Date();
            return timeB.getTime() - timeA.getTime();
          });
          return combined;
        });
      }
    } catch (error) {
      console.error('Error loading reposts:', error);
      // We don't set an error state here since main posts are already loaded
    }
  };

  useEffect(() => {
    if (authLoading || !currentUser || !db) {
      return;
    }

    console.log("Feed: Auth finished, currentUser exists. Loading user profile...");
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
        setFeedLoading(false);
      } catch (error) {
        console.error('Error loading user profile:', error);
        setError('Failed to load user profile');
        setFeedLoading(false);
      }
    };

    loadUserProfile();
  }, [currentUser, db, authLoading]);

  useEffect(() => {
    if (!db || !currentUser) {
      setFeedLoading(false);
      return;
    }

    const fetchPosts = async () => {
      try {
        setIsLoading(true);
        
        // Get the list of users being followed
        const followingRef = collection(db, 'users', currentUser.uid, 'following');
        const followingSnapshot = await getDocs(followingRef);
        const followingIds = followingSnapshot.docs.map(doc => doc.id).filter(Boolean);
        
        // Add the current user's ID to the list to see their own posts too
        const userIdsToFetch = [...followingIds, currentUser.uid].filter(Boolean);

        if (userIdsToFetch.length === 0) {
          setPosts([]);
          setFeedLoading(false);
          setIsLoading(false);
          return;
        }

        // Create a query to get posts from followed users and own posts
        const postsQuery = query(
          collection(db, 'posts'),
          where('authorId', 'in', userIdsToFetch),
          orderBy('timestamp', 'desc')
        );

        const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
          const postsList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as PostData[];
          setPosts(postsList);
          setIsLoading(false);
          setFeedLoading(false);
        }, (error) => {
          console.error('Error fetching posts:', error);
          setError('Failed to load posts');
          setIsLoading(false);
          setFeedLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error setting up posts listener:', error);
        setError('Failed to load posts');
        setIsLoading(false);
        setFeedLoading(false);
      }
    };

    fetchPosts();
  }, [db, currentUser]);

  const uploadImage = async (file: File): Promise<string> => {
    const storageRef = ref(storage, `posts/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  const handleCreatePost = async (content: string, imageFile?: File) => {
    if (!currentUser || !db) return;

    try {
      setIsLoading(true);
      setError(null);

      let imageUrl = null;
      if (imageFile) {
        const storageRef = ref(storage, `posts/${currentUser.uid}/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      }

      const postData = {
        content,
        authorId: currentUser.uid,
        userId: currentUser.uid,
        timestamp: serverTimestamp(),
        likes: 0,
        likedBy: [],
        authorName: currentUser.displayName || 'Anonymous',
        ...(imageUrl && { imageUrl }),
        authorAvatar: currentUser.photoURL || '',
        comments: [],
        tags: content.match(/#[a-zA-Z0-9_]+/g) || [],
        isPrivate: false,
        reposts: 0,
        repostedBy: [],
        views: 0,
        isPinned: false,
        isEdited: false,
        isArchived: false,
        deleted: false
      };

      await addDoc(collection(db, 'posts'), postData);
      setCreatePostOpen(false);
    } catch (error) {
      console.error('Error creating post:', error);
      setError('Failed to create post. Please try again.');
    } finally {
      setIsLoading(false);
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
      
      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }
      
      const postData = postDoc.data();
      const isLiked = postData.likedBy?.includes(currentUser.uid);
      const currentLikes = postData.likes || 0;
      
      if (isLiked) {
        // Unlike
        await updateDoc(postRef, {
          likedBy: arrayRemove(currentUser.uid),
          likes: Math.max(0, currentLikes - 1)
        });
      } else {
        // Like
        await updateDoc(postRef, {
          likedBy: arrayUnion(currentUser.uid),
          likes: currentLikes + 1
        });

        // Create notification for post owner
        if (postData.authorId !== currentUser.uid) {
          const notificationData = {
            type: 'like',
            senderId: currentUser.uid,
            senderName: currentUser.displayName || 'Anonymous',
            senderAvatar: currentUser.photoURL || '',
            recipientId: postData.authorId,
            postId: postId,
            content: `${currentUser.displayName || 'Someone'} liked your post`,
            createdAt: serverTimestamp(),
            isRead: false
          };
          await addDoc(collection(db, 'users', postData.authorId, 'notifications'), notificationData);
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to update like');
    }
  };

  const handleRepost = async (postId: string) => {
    if (!currentUser || !db) {
      toast.error('You must be logged in to repost');
      return;
    }

    // Find the post that's being reposted
    const originalPost = posts.find(post => post.id === postId);
    if (!originalPost) {
      toast.error('Post not found');
      return;
    }

    // Check if user has already reposted this post
    const hasReposted = posts.some(post => 
      post.isRepost && post.id === postId && post.repostedById === currentUser.uid
    );

    try {
      if (hasReposted) {
        // User is un-reposting
        // Add to local queue for syncing later
        setLocalReposts(prev => [...prev, { postId, added: false }]);
        
        // Update UI immediately by removing from posts and updating original post's repost count
        setPosts(prev => prev.map(post => {
          if (post.id === postId && !post.isRepost) {
            return { ...post, reposts: Math.max(0, (post.reposts || 0) - 1) };
          }
          return post;
        }).filter(post => 
          !(post.isRepost && post.id === postId && post.repostedById === currentUser.uid)
        ));
        
        toast.success('Repost removed');
      } else {
        // User is reposting
        // Add to local queue for syncing later
        setLocalReposts(prev => [...prev, { postId, added: true }]);
        
        // Update UI immediately by adding repost to posts and updating original post's repost count
        setPosts(prev => [
          {
            ...originalPost,
            timestamp: Timestamp.now(),
            isRepost: true,
            repostedById: currentUser.uid,
            reposts: (originalPost.reposts || 0) + 1
          },
          ...prev.map(post => {
            if (post.id === postId && !post.isRepost) {
              return { ...post, reposts: (post.reposts || 0) + 1 };
            }
            return post;
          })
        ]);
        
        // Create notification for post owner
        if (originalPost.authorId !== currentUser.uid) {
          const notificationData = {
            type: 'repost',
            senderId: currentUser.uid,
            senderName: currentUser.displayName || 'Anonymous',
            senderAvatar: currentUser.photoURL || '',
            recipientId: originalPost.authorId,
            postId: postId,
            content: `${currentUser.displayName || 'Someone'} reposted your post`,
            createdAt: serverTimestamp(),
            isRead: false
          };
          await addDoc(collection(db, 'users', originalPost.authorId, 'notifications'), notificationData);
        }
        
        toast.success('Post reposted!');
      }
      
      // Try to sync with server immediately
      await syncRepostsWithServer();
    } catch (error) {
      console.error('Error handling repost:', error);
      toast.error('Failed to process repost. Changes will sync later.');
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

      // Create notification for post owner
      if (postData && postData.authorId !== currentUser.uid) {
        const notificationData = {
          type: 'comment',
          senderId: currentUser.uid,
          senderName: currentUser.displayName || 'Anonymous',
          senderAvatar: currentUser.photoURL || '',
          recipientId: postData.authorId,
          postId: postId,
          content: `${currentUser.displayName || 'Someone'} commented on your post: "${content}"`,
          createdAt: serverTimestamp(),
          isRead: false
        };
        await addDoc(collection(db, 'users', postData.authorId, 'notifications'), notificationData);
      }

      // Check for mentions in comment
      const mentions = content.match(/@(\w+)/g);
      if (mentions) {
        const uniqueMentions = Array.from(new Set(mentions));
        for (const mention of uniqueMentions) {
          const username = mention.slice(1);
          const userQuery = query(collection(db, 'users'), where('username', '==', username), limit(1));
          const userDocs = await getDocs(userQuery);
          
          if (!userDocs.empty) {
            const mentionedUser = userDocs.docs[0];
            if (postData && mentionedUser.id !== currentUser.uid && mentionedUser.id !== postData.authorId) {
              const notificationData = {
                type: 'mention',
                senderId: currentUser.uid,
                senderName: currentUser.displayName || 'Anonymous',
                senderAvatar: currentUser.photoURL || '',
                recipientId: mentionedUser.id,
                postId: postId,
                content: `${currentUser.displayName || 'Someone'} mentioned you in a comment: "${content}"`,
                createdAt: serverTimestamp(),
                isRead: false
              };
              await addDoc(collection(db, 'users', mentionedUser.id, 'notifications'), notificationData);
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

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, postId: string) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedPostId(postId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedPostId(null);
  };

  const handleDeleteClick = () => {
    if (selectedPostId) {
      handleDeletePost(selectedPostId);
    }
    handleMenuClose();
  };

  const renderPost = (post: PostData) => (
    <ListItem 
      key={`${post.id}-${post.isRepost ? 'repost' : 'post'}`} 
      divider
      sx={{ 
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: 'action.hover'
        },
        mb: 2,
        borderRadius: 2,
        backgroundColor: 'background.paper',
        boxShadow: 1
      }}
      onClick={() => {
        setSelectedPost(post);
        setShowPostDialog(true);
      }}
    >
      {post.isRepost && (
        <Box 
          sx={{ 
            position: 'absolute', 
            top: -12, 
            left: 20, 
            backgroundColor: 'primary.main',
            color: 'white',
            borderRadius: 1,
            px: 1,
            py: 0.5,
            fontSize: '0.75rem',
            zIndex: 1
          }}
        >
          Reposted
        </Box>
      )}
      <ListItemAvatar>
        <Link to={`/profile/${post.authorId}`} style={{ textDecoration: 'none' }}>
          <Avatar src={post.authorAvatar || undefined} />
        </Link>
      </ListItemAvatar>
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Link to={`/profile/${post.authorId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Typography variant="subtitle1" component="span" sx={{ '&:hover': { textDecoration: 'underline' } }}>
                  {post.authorName}
                </Typography>
              </Link>
              <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 1 }}>
                {formatDistanceToNow(post.timestamp?.toDate?.() || new Date())} ago
              </Typography>
              {!post.isRepost && post.reposts > 0 && (
                <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 1 }}>
                  • {post.reposts} repost{post.reposts !== 1 ? 's' : ''}
                </Typography>
              )}
            </Box>
            {post.authorId === currentUser?.uid && (
              <IconButton
                size="small"
                onClick={(e) => handleMenuClick(e, post.id)}
              >
                <MoreVertIcon />
              </IconButton>
            )}
          </Box>
        }
        secondary={
          <Box>
            <Typography variant="body1" sx={{ mt: 1 }}>
              {post.content}
            </Typography>
            {post.isEdited && (
              <Typography variant="caption" color="text.secondary">
                (edited)
              </Typography>
            )}
            <Box sx={{ mt: 2 }}>
              {post.comments && post.comments.length > 0 && (
                <Box sx={{ 
                  backgroundColor: 'background.default',
                  borderRadius: 1,
                  p: 1,
                  mt: 1
                }}>
                  {post.comments.slice(0, 2).map((comment, index) => (
                    <Box key={index} sx={{ mb: 1 }}>
                      <Typography variant="subtitle2" component="span">
                        {comment.authorName}
                      </Typography>
                      <Typography variant="body2" component="span" sx={{ ml: 1 }}>
                        {comment.content}
                      </Typography>
                    </Box>
                  ))}
                  {post.comments.length > 2 && (
                    <Typography 
                      variant="body2" 
                      color="primary" 
                      sx={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPost(post);
                        setShowPostDialog(true);
                      }}
                    >
                      View all {post.comments.length} comments
                    </Typography>
                  )}
                </Box>
              )}
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <IconButton 
                  edge="end" 
                  aria-label="likes"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLike(post.id);
                  }}
                >
                  <FavoriteIcon color={post.likedBy?.includes(currentUser?.uid || '') ? "error" : "inherit"} />
                  <Typography variant="body2" component="span" sx={{ ml: 1 }}>
                    {post.likes || 0}
                  </Typography>
                </IconButton>
                <IconButton
                  edge="end"
                  aria-label="repost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRepost(post.id);
                  }}
                >
                  <RepeatIcon color={post.isRepost && post.repostedById === currentUser?.uid ? "primary" : "inherit"} />
                  <Typography variant="body2" component="span" sx={{ ml: 1 }}>
                    {post.reposts || 0}
                  </Typography>
                </IconButton>
                <IconButton
                  edge="end"
                  aria-label="comment"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPost(post);
                    setShowPostDialog(true);
                  }}
                >
                  <CommentIcon />
                  <Typography variant="body2" component="span" sx={{ ml: 1 }}>
                    {post.comments?.length || 0}
                  </Typography>
                </IconButton>
              </Box>
            </Box>
          </Box>
        }
      />
    </ListItem>
  );

  // Add the post dialog component
  const renderPostDialog = () => {
    if (!selectedPost) return null;
    
    return (
      <Dialog
        fullScreen
        open={showPostDialog}
        onClose={() => setShowPostDialog(false)}
        TransitionComponent={Transition}
      >
        <AppBar sx={{ position: 'relative' }}>
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => setShowPostDialog(false)}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
              {selectedPost.isRepost ? 'Reposted Post' : 'Post'}
            </Typography>
          </Toolbar>
        </AppBar>
        
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Link to={`/profile/${selectedPost.authorId}`} style={{ textDecoration: 'none' }}>
              <Avatar 
                src={selectedPost.authorAvatar || undefined} 
                sx={{ width: 48, height: 48, mr: 2 }}
              />
            </Link>
            <Box>
              <Link to={`/profile/${selectedPost.authorId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Typography variant="h6" sx={{ '&:hover': { textDecoration: 'underline' } }}>
                  {selectedPost.authorName}
                </Typography>
              </Link>
              <Typography variant="body2" color="text.secondary">
                {formatDistanceToNow(selectedPost.timestamp?.toDate?.() || new Date())} ago
              </Typography>
            </Box>
          </Box>
          
          <Typography variant="body1" sx={{ mb: 3 }}>
            {selectedPost.content}
          </Typography>
          
          {selectedPost.imageUrl && (
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
              <img 
                src={selectedPost.imageUrl} 
                alt="Post attachment" 
                style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '8px' }}
              />
            </Box>
          )}
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Button 
              startIcon={<FavoriteIcon color={selectedPost.likedBy?.includes(currentUser?.uid || '') ? "error" : "inherit"} />}
              onClick={() => handleLike(selectedPost.id)}
            >
              {selectedPost.likes || 0} Likes
            </Button>
            <Button 
              startIcon={<RepeatIcon color={selectedPost.isRepost && selectedPost.repostedById === currentUser?.uid ? "primary" : "inherit"} />}
              onClick={() => handleRepost(selectedPost.id)}
            >
              {selectedPost.reposts || 0} Reposts
            </Button>
            <Button 
              startIcon={<CommentIcon />}
              onClick={() => commentInputRef.current?.focus()}
            >
              {selectedPost.comments?.length || 0} Comments
            </Button>
          </Box>
          
          <Divider sx={{ mb: 3 }} />
          
          <Typography variant="h6" sx={{ mb: 2 }}>Comments</Typography>
          
          {selectedPost.comments && selectedPost.comments.length > 0 ? (
            <List>
              {selectedPost.comments.map((comment, index) => (
                <ListItem key={index} alignItems="flex-start" divider>
                  <ListItemAvatar>
                    <Avatar src={comment.authorAvatar || undefined} />
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="subtitle2">
                          {comment.authorName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {comment.timestamp ? formatDistanceToNow(comment.timestamp.toDate()) + ' ago' : ''}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.primary"
                        sx={{ display: 'inline', mt: 1 }}
                      >
                        {comment.content}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography color="text.secondary" sx={{ mb: 2 }}>No comments yet. Be the first to comment!</Typography>
          )}
          
          <Box sx={{ 
            position: 'fixed', 
            bottom: 0, 
            left: 0, 
            right: 0, 
            p: 2, 
            bgcolor: 'background.paper',
            boxShadow: 3,
            zIndex: 10,
            display: 'flex',
            gap: 1,
          }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Add a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              inputRef={commentInputRef}
              InputProps={{
                sx: { borderRadius: 4 }
              }}
            />
            <IconButton 
              color="primary" 
              disabled={!commentText.trim()}
              onClick={() => {
                if (commentText.trim()) {
                  handleComment(selectedPost.id, commentText.trim());
                  setCommentText('');
                }
              }}
            >
              <SendIcon />
            </IconButton>
          </Box>
          
          {/* Add padding at the bottom for the comment input */}
          <Box sx={{ height: '64px' }}></Box>
        </Box>
      </Dialog>
    );
  };

  // Function to sync local reposts with server
  const syncRepostsWithServer = async () => {
    if (!db || !currentUser || localReposts.length === 0) return;
    
    setIsSyncing(true);
    
    try {
      const batch = writeBatch(db);
      const repostsCollection = collection(db, 'reposts');
      
      for (const repost of localReposts) {
        const { postId, added } = repost;
        const repostDocId = `${currentUser.uid}_${postId}`;
        const repostRef = doc(repostsCollection, repostDocId);
        
        if (added) {
          // Add repost to Firestore
          batch.set(repostRef, {
            originalPostId: postId,
            userId: currentUser.uid,
            timestamp: Timestamp.now()
          });
        } else {
          // Remove repost from Firestore
          batch.delete(repostRef);
        }
      }
      
      await batch.commit();
      setLocalReposts([]);
      toast.success('Reposts synced successfully!');
    } catch (error) {
      console.error('Error syncing reposts:', error);
      toast.error('Failed to sync reposts. Try again later.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Add a UI element for the user to manually sync reposts
  const renderSyncButton = () => {
    if (localReposts.length === 0) return null;
    
    return (
      <Box sx={{ 
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 1000
      }}>
        <Button
          variant="contained"
          color="primary"
          onClick={syncRepostsWithServer}
          startIcon={<RepeatIcon />}
        >
          Sync {localReposts.length} Repost{localReposts.length !== 1 ? 's' : ''}
        </Button>
      </Box>
    );
  };

  if (authLoading) {
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

          <Paper 
            elevation={3}
            sx={{ 
              mb: 4,
              borderRadius: 2,
              p: 2,
              position: 'relative',
              zIndex: 10
            }}
          >
            <CreatePostDialog
              open={createPostOpen}
              onClose={() => setCreatePostOpen(false)}
            />
          </Paper>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {posts.length === 0 ? (
              <Typography variant="body1" color="text.secondary" align="center">
                No posts yet. Follow some users to see their posts!
              </Typography>
            ) : (
              <List>
                {posts.map(renderPost)}
              </List>
            )}
          </Box>
        </>
      )}

      {renderPostDialog()}
      {renderSyncButton()}

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={handleDeleteClick}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          Delete Post
        </MenuItem>
      </Menu>
    </Container>
  );
};

export default Feed;