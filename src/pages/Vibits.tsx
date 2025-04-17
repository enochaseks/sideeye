import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, IconButton, Typography, CircularProgress, Dialog, TextField, Button, Avatar, LinearProgress, DialogTitle, DialogContent, DialogActions, Menu, MenuItem, Select, FormControl, InputLabel, SelectChangeEvent, FormHelperText, Slider, Tabs, Tab, useMediaQuery, useTheme, Drawer, List, ListItem, ListItemAvatar, ListItemText, Card, CardMedia, CardContent, Container } from '@mui/material';
import { 
  Add as AddIcon, 
  Favorite as FavoriteIcon, 
  FavoriteBorder as FavoriteBorderIcon,
  Comment as CommentIcon, 
  Share as ShareIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Send as SendIcon,
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  PersonAddAlt1 as PersonAddAlt1Icon,
  MoreVert as MoreVertIcon,
  HighQuality as HighQualityIcon,
  Info as InfoIcon,
  VolumeOff as VolumeOffIcon,
  VolumeUp as VolumeUpIcon,
  Pause as PauseIcon,
  PlayArrow as PlayArrowIcon,
  Save as SaveIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc, 
  increment,
  serverTimestamp,
  getDoc,
  setDoc,
  where,
  arrayUnion
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject,
  UploadTaskSnapshot,
  StorageError,
  getBytes,
  uploadBytes
} from 'firebase/storage';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { saveAs } from 'file-saver';
import { formatTimestamp } from '../utils/dateUtils';
import VibitIcon from '../components/VibitIcon';

interface Video {
  id: string;
  url: string;
  userId: string;
  username: string;
  likes: number;
  comments: number;
  timestamp: any;
  duration?: number;
  resolution?: string;
  resolutions?: string[];
  thumbnailUrl?: string;
  commentsList?: Comment[];
}

interface Comment {
  id: string;
  content: string;
  userId: string;
  username: string;
  userPhotoURL?: string;
  timestamp: any;
  likes?: number;
}

interface UserData {
  photoURL?: string;
  username?: string;
  displayName?: string;
}

interface CommentData {
  photoURL: string;
  profilePicture: string;
  userId: string;
  username: string;
  content: string;
  timestamp: any;
}

const Vibits: React.FC = () => {
  const { currentUser } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [likedVideos, setLikedVideos] = useState<Set<string>>(new Set());
  const [favoriteVideos, setFavoriteVideos] = useState<Set<string>>(new Set());
  const [showComments, setShowComments] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<Video | null>(null);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [videoResolution, setVideoResolution] = useState<string>('auto');
  const [resolutionAnchorEl, setResolutionAnchorEl] = useState<null | HTMLElement>(null);
  const [videoInfoAnchorEl, setVideoInfoAnchorEl] = useState<null | HTMLElement>(null);
  const [currentVideoInfo, setCurrentVideoInfo] = useState<{duration: string, resolution: string}>({duration: '0:00', resolution: 'Unknown'});
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isPlaying, setIsPlaying] = useState(true);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [swipeDirection, setSwipeDirection] = useState<'up' | 'down' | null>(null);
  const [swipeDistance, setSwipeDistance] = useState(0);
  const SWIPE_THRESHOLD = 100; // Minimum distance to trigger swipe
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTap = useRef(0);
  const [tabIndex, setTabIndex] = useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [isCommenting, setIsCommenting] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      if (isPlaying) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  }, [volume, isPlaying]);

  useEffect(() => {
    fetchVideos();
    if (currentUser) {
      fetchLikedVideos();
      fetchFavoriteVideos();
      fetchFollowing();
    }
  }, [currentUser]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'VolumeUp' || e.key === 'VolumeDown') {
        console.log('Volume button pressed');
        // Handle volume button press
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleDoubleTap = useCallback(() => {
    console.log('Double tap detected');
    // Handle double tap
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap.current;
    if (tapLength < 300 && tapLength > 0) {
      handleDoubleTap();
    }
    lastTap.current = currentTime;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY;
    const diff = touchStartY.current - currentY;
    if (Math.abs(diff) > 10) {
      setSwipeDirection(diff > 0 ? 'up' : 'down');
      setSwipeDistance(Math.abs(diff));
    }
  };

  const handleTouchEnd = () => {
    if (swipeDirection && swipeDistance > SWIPE_THRESHOLD) {
      setIsTransitioning(true);
      if (swipeDirection === 'up' && currentVideoIndex < videos.length - 1) {
        setCurrentVideoIndex(prev => prev + 1);
      } else if (swipeDirection === 'down' && currentVideoIndex > 0) {
        setCurrentVideoIndex(prev => prev - 1);
      }
      setTimeout(() => {
        setIsTransitioning(false);
        setSwipeDirection(null);
        setSwipeDistance(0);
      }, 500); // Increase transition time for smoother swipe
    } else {
      setSwipeDirection(null);
      setSwipeDistance(0);
    }
  };

  const fetchVideos = async () => {
    try {
      const videosQuery = query(
        collection(db, 'videos'),
        orderBy('timestamp', 'desc'),
        limit(10)
      );
      const snapshot = await getDocs(videosQuery);
      const fetchedVideos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Video[];
      setVideos(fetchedVideos);
    } catch (error) {
      console.error('Error fetching videos:', error);
      toast.error('Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const fetchLikedVideos = async () => {
    if (!currentUser) return;
    try {
      const likedVideosQuery = query(
        collection(db, `users/${currentUser.uid}/likes`)
      );
      const snapshot = await getDocs(likedVideosQuery);
      const likedIds = new Set(snapshot.docs.map(doc => doc.id));
      setLikedVideos(likedIds);
    } catch (error) {
      console.error('Error fetching liked videos:', error);
    }
  };

  const fetchFavoriteVideos = async () => {
    if (!currentUser) return;
    try {
      const favoriteVideosQuery = query(
        collection(db, `users/${currentUser.uid}/favorites`)
      );
      const snapshot = await getDocs(favoriteVideosQuery);
      const favoriteIds = new Set(snapshot.docs.map(doc => doc.id));
      setFavoriteVideos(favoriteIds);
    } catch (error) {
      console.error('Error fetching favorite videos:', error);
    }
  };

  const fetchFollowing = async () => {
    if (!currentUser) return;
    try {
      const followingQuery = query(
        collection(db, `users/${currentUser.uid}/following`)
      );
      const snapshot = await getDocs(followingQuery);
      const followingIds = new Set(snapshot.docs.map(doc => doc.id));
      setFollowing(followingIds);
    } catch (error) {
      console.error('Error fetching following:', error);
    }
  };

  const fetchComments = async (videoId: string) => {
    if (!videoId) return;
    
    try {
      const commentsQuery = query(
        collection(db, `videos/${videoId}/comments`),
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(commentsQuery);
      const fetchedComments = await Promise.all(snapshot.docs.map(async (commentDoc) => {
        const commentData = commentDoc.data() as CommentData;
        // Fetch user profile data
        const userDocRef = doc(db, 'users', commentData.userId);
        const userDoc = await getDoc(userDocRef);
        const userData = userDoc.data() as UserData | undefined;
        
        console.log('Fetched user data:', userData);
        
        return {
          id: commentDoc.id,
          ...commentData,
          userPhotoURL: userData?.photoURL || '',
          username: userData?.username || userData?.displayName || commentData.username || commentData.photoURL || 'Anonymous'
        };
      })) as Comment[];
      
      setSelectedVideo(prev => prev ? ({
        ...prev,
        commentsList: fetchedComments
      }) : null);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error('Failed to load comments');
    }
  };

  const handleLike = async (videoId: string) => {
    if (!currentUser) return;
    try {
      const videoRef = doc(db, 'videos', videoId);
      const likeRef = doc(db, `users/${currentUser.uid}/likes`, videoId);
      
      if (likedVideos.has(videoId)) {
        // Unlike
        await deleteDoc(likeRef);
        await updateDoc(videoRef, {
          likes: increment(-1)
        });
        setLikedVideos(prev => {
          const newSet = new Set(prev);
          newSet.delete(videoId);
          return newSet;
        });
      } else {
        // Like
        await addDoc(collection(db, `users/${currentUser.uid}/likes`), {
          videoId,
          timestamp: serverTimestamp()
        });
        await updateDoc(videoRef, {
          likes: increment(1)
        });
        setLikedVideos(prev => new Set(prev).add(videoId));

        // Create notification for video owner
        const videoDoc = await getDoc(videoRef);
        const videoData = videoDoc.data();
        if (videoData && videoData.userId !== currentUser.uid) {
          const notificationData = {
            type: 'like',
            senderId: currentUser.uid,
            senderName: currentUser.displayName || 'Anonymous',
            senderAvatar: currentUser.photoURL || '',
            recipientId: videoData.userId,
            postId: videoId,
            content: `${currentUser.displayName || 'Someone'} liked your video`,
            createdAt: serverTimestamp(),
            isRead: false
          };
          await addDoc(collection(db, 'users', videoData.userId, 'notifications'), notificationData);
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to update like');
    }
  };

  const handleFavorite = async (videoId: string) => {
    if (!currentUser) return;
    try {
      const favoriteRef = doc(db, `users/${currentUser.uid}/favorites`, videoId);
      
      if (favoriteVideos.has(videoId)) {
        // Remove from favorites
        await deleteDoc(favoriteRef);
        setFavoriteVideos(prev => {
          const newSet = new Set(prev);
          newSet.delete(videoId);
          return newSet;
        });
      } else {
        // Add to favorites
        await addDoc(collection(db, `users/${currentUser.uid}/favorites`), {
          videoId,
          timestamp: serverTimestamp()
        });
        setFavoriteVideos(prev => new Set(prev).add(videoId));
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorites');
    }
  };

  const handleComment = async (videoId: string) => {
    if (!currentUser || !newComment.trim() || !videoId) {
      toast.error('Please enter a comment and make sure you are logged in');
      return;
    }
    
    setCommentLoading(true);
    try {
      const videoRef = doc(db, 'videos', videoId);
      const videoDoc = await getDoc(videoRef);
      const videoData = videoDoc.data();

      const commentRef = await addDoc(collection(db, `videos/${videoId}/comments`), {
        content: newComment.trim(),
        userId: currentUser.uid,
        username: currentUser.displayName || 'Anonymous',
        userPhotoURL: currentUser.photoURL || '',
        timestamp: serverTimestamp()
      });

      await updateDoc(videoRef, {
        comments: increment(1)
      });

      // Create notification for video owner
      if (videoData && videoData.userId !== currentUser.uid) {
        const notificationData = {
          type: 'comment',
          senderId: currentUser.uid,
          senderName: currentUser.displayName || 'Anonymous',
          senderAvatar: currentUser.photoURL || '',
          recipientId: videoData.userId,
          postId: videoId,
          commentId: commentRef.id,
          content: `${currentUser.displayName || 'Someone'} commented on your video: "${newComment.trim()}"`,
          createdAt: serverTimestamp(),
          isRead: false
        };
        await addDoc(collection(db, 'users', videoData.userId, 'notifications'), notificationData);
      }

      // Update the local state
      const newCommentObj: Comment = {
        id: commentRef.id,
        content: newComment.trim(),
        userId: currentUser.uid,
        username: currentUser.displayName || 'Anonymous',
        userPhotoURL: currentUser.photoURL || '',
        timestamp: new Date()
      };

      setSelectedVideo(prev => prev ? {
        ...prev,
        comments: (prev.comments ?? 0) + 1,
        commentsList: [...(prev.commentsList || []), newCommentObj]
      } : null);

      setNewComment('');
      toast.success('Comment added successfully');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setCommentLoading(false);
    }
  };

  const handleShare = async (videoId: string) => {
    try {
      const videoUrl = `${window.location.origin}/vibits/${videoId}`;
      await navigator.clipboard.writeText(videoUrl);
      toast.success('Video link copied to clipboard');
    } catch (error) {
      console.error('Error sharing video:', error);
      toast.error('Failed to share video');
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    try {
      setUploading(true);
      setUploadProgress(0);

      // Create a URL for the video file
      const videoURL = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.src = videoURL;

      // Wait for video metadata to load
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
        video.load();
      });

      const duration = video.duration;
      
      // Clean up the temporary URL
      URL.revokeObjectURL(videoURL);
      
      // Check duration
      if (duration < 5 || duration > 180) {
        toast.error('Videos must be between 5 seconds and 3 minutes long');
        setUploading(false);
        return;
      }

      const storage = getStorage();
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const storageRef = ref(storage, `videos/${currentUser.uid}/${fileName}`);

      // Create thumbnail
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas dimensions based on video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw the video frame
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      // Convert canvas to blob
      const thumbnailBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
        }, 'image/jpeg', 0.7);
      });

      // Upload thumbnail
      const thumbnailRef = ref(storage, `thumbnails/${currentUser.uid}/${timestamp}.jpg`);
      await uploadBytes(thumbnailRef, thumbnailBlob);
      const thumbnailUrl = await getDownloadURL(thumbnailRef);

      // Upload video
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Upload error:', error);
          toast.error('Upload failed');
          setUploading(false);
        },
        async () => {
          try {
            const videoUrl = await getDownloadURL(storageRef);
            
            // Get user data
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            const userData = userDoc.data();
            const username = userData?.username || currentUser.displayName || 'Anonymous';

            // Add video document to Firestore
            await addDoc(collection(db, 'videos'), {
              url: videoUrl,
              thumbnailUrl,
              userId: currentUser.uid,
              username,
              likes: 0,
              comments: 0,
              timestamp: serverTimestamp(),
              duration,
              resolution: `${video.videoWidth}x${video.videoHeight}`
            });

            toast.success('Video uploaded successfully!');
            fetchVideos(); // Refresh video list
          } catch (error) {
            console.error('Error saving video data:', error);
            toast.error('Failed to save video data');
          } finally {
            setUploading(false);
            setUploadProgress(0);
          }
        }
      );
    } catch (error) {
      console.error('Error uploading video:', error);
      toast.error('Failed to upload video. Please try again.');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteVideo = async (video: Video) => {
    if (!currentUser || video.userId !== currentUser.uid) return;
    
    try {
      // Delete from Storage
      const storage = getStorage();
      // Extract the path from the full URL
      const urlParts = video.url.split('/');
      const pathIndex = urlParts.indexOf('videos');
      const storagePath = decodeURIComponent(urlParts.slice(pathIndex).join('/').split('?')[0]);
      const videoRef = ref(storage, storagePath);
      
      await deleteObject(videoRef);
      
      // Delete from Firestore
      await deleteDoc(doc(db, 'videos', video.id));
      
      // Delete associated likes and comments
      const likesQuery = query(collection(db, `users/${currentUser.uid}/likes`));
      const likesSnapshot = await getDocs(likesQuery);
      likesSnapshot.forEach(async (doc) => {
        if (doc.id === video.id) {
          await deleteDoc(doc.ref);
        }
      });
      
      const commentsQuery = query(collection(db, `videos/${video.id}/comments`));
      const commentsSnapshot = await getDocs(commentsQuery);
      commentsSnapshot.forEach(async (doc) => {
        await deleteDoc(doc.ref);
      });
      
      toast.success('Video deleted successfully');
      fetchVideos();
    } catch (error) {
      console.error('Error deleting video:', error);
      toast.error('Failed to delete video');
    } finally {
      setShowDeleteDialog(false);
      setVideoToDelete(null);
    }
  };

  const handleResolutionMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setResolutionAnchorEl(event.currentTarget);
  };

  const handleResolutionMenuClose = () => {
    setResolutionAnchorEl(null);
  };

  const handleResolutionChange = (resolution: string) => {
    setVideoResolution(resolution);
    handleResolutionMenuClose();
    toast.success(`Resolution changed to ${resolution}`);
  };

  const handleInfoMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    if (!selectedVideo) return;
    
    // Format duration
    const totalSeconds = selectedVideo.duration || 0;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    setCurrentVideoInfo({
      duration: formattedDuration,
      resolution: selectedVideo.resolution || 'Unknown'
    });
    setVideoInfoAnchorEl(event.currentTarget);
  };

  const handleInfoMenuClose = () => {
    setVideoInfoAnchorEl(null);
  };

  const handleFollow = async (userId: string) => {
    if (!currentUser || userId === currentUser.uid) return;
    
    try {
      const followingRef = doc(db, `users/${currentUser.uid}/following`, userId);
      const followerRef = doc(db, `users/${userId}/followers`, currentUser.uid);
      
      if (following.has(userId)) {
        // Unfollow
        await deleteDoc(followingRef);
        await deleteDoc(followerRef);
        setFollowing(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
        toast.success('Unfollowed user');
      } else {
        // Follow
        await setDoc(followingRef, {
          timestamp: serverTimestamp()
        });
        await setDoc(followerRef, {
          timestamp: serverTimestamp()
        });
        setFollowing(prev => new Set(prev).add(userId));

        // Create notification for followed user
        const notificationData = {
          type: 'follow',
          senderId: currentUser.uid,
          senderName: currentUser.displayName || 'Anonymous',
          senderAvatar: currentUser.photoURL || '',
          recipientId: userId,
          content: `${currentUser.displayName || 'Someone'} started following you`,
          createdAt: serverTimestamp(),
          isRead: false
        };
        await addDoc(collection(db, 'users', userId, 'notifications'), notificationData);

        toast.success('Followed user');
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast.error('Failed to update follow status');
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
    if (newValue === 0) {
      fetchVideos(); // Fetch 'For You' videos
    } else {
      fetchFollowingVideos(); // Fetch 'Following' videos
    }
  };

  const fetchFollowingVideos = async () => {
    if (!currentUser) return;
    try {
      const followingWithCurrentUser = new Set(following);
      followingWithCurrentUser.add(currentUser.uid);

      const followingVideosQuery = query(
        collection(db, 'videos'),
        where('userId', 'in', Array.from(followingWithCurrentUser)),
        orderBy('timestamp', 'desc'),
        limit(10)
      );
      const snapshot = await getDocs(followingVideosQuery);
      const fetchedVideos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Video[];
      setVideos(fetchedVideos);
    } catch (error) {
      console.error('Error fetching following videos:', error);
      toast.error('Failed to load following videos');
    }
  };

  const handleSaveVideo = async () => {
    try {
      if (!selectedVideo?.url) {
        throw new Error('No video selected');
      }

      // Extract the path from the full URL
      const urlParts = selectedVideo.url.split('/');
      const pathIndex = urlParts.indexOf('videos');
      const storagePath = decodeURIComponent(urlParts.slice(pathIndex).join('/').split('?')[0]);
      
      // Get the storage reference
      const storage = getStorage();
      const videoRef = ref(storage, storagePath);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(videoRef);
      
      // Create a temporary anchor element
      const link = document.createElement('a');
      link.href = downloadURL;
      link.download = `vibit_${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Video download started!');
    } catch (error) {
      console.error('Error saving video:', error);
      toast.error('Failed to save video. Please try again.');
    }
  };

  const handleVideoClick = (video: Video) => {
    setSelectedVideo(video);
    setShowComments(true);
    fetchComments(video.id);
  };

  const formatCommentTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    return formatTimestamp(timestamp);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!currentUser || !selectedVideo) return;
    
    try {
      // Delete from Firestore
      await deleteDoc(doc(db, `videos/${selectedVideo.id}/comments/${commentId}`));
      
      // Update local state
      setSelectedVideo(prev => prev ? ({
        ...prev,
        comments: (prev.comments ?? 0) - 1,
        commentsList: prev.commentsList?.filter(comment => comment.id !== commentId)
      }) : null);
      
      toast.success('Comment deleted successfully');
      fetchComments(selectedVideo.id);
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment');
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!currentUser || !selectedVideo) return;
    
    try {
      // Fetch the comment
      const commentDoc = await getDoc(doc(db, `videos/${selectedVideo.id}/comments/${commentId}`));
      const commentData = commentDoc.data() as CommentData;
      
      // Update like count
      await updateDoc(doc(db, `videos/${selectedVideo.id}/comments/${commentId}/likes`), {
        likes: increment(1)
      });
      
      // Update local state
      setSelectedVideo(prev => {
        if (!prev) return null;
        return {
          ...prev,
          commentsList: prev.commentsList?.map(comment =>
            comment.id === commentId ? { ...comment, likes: (comment.likes ?? 0) + 1 } : comment
          )
        };
      });
      
      toast.success('Comment liked successfully');
      fetchComments(selectedVideo.id);
    } catch (error) {
      console.error('Error liking comment:', error);
      toast.error('Failed to like comment');
    }
  };

  const handleReplyToComment = (commentId: string) => {
    // Implement reply functionality
    console.log('Reply to comment:', commentId);
  };

  const CommentsDrawer = () => (
    <Drawer
      anchor="bottom"
      open={showComments}
      onClose={() => setShowComments(false)}
      PaperProps={{
        sx: {
          height: '80vh',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        }
      }}
    >
      <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Comments</Typography>
          <IconButton onClick={() => setShowComments(false)}>
            <CloseIcon />
          </IconButton>
        </Box>
        
        <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
          {selectedVideo?.commentsList && selectedVideo.commentsList.length > 0 ? (
            <List>
              {selectedVideo.commentsList.map((comment) => (
                <ListItem key={comment.id} alignItems="flex-start">
                  <ListItemAvatar>
                    <Avatar 
                      src={comment.userPhotoURL}
                      alt={comment.username}
                      sx={{ width: 40, height: 40 }}
                    >
                      {!comment.userPhotoURL && comment.username.charAt(0)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2" component="span">
                          {comment.username}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatCommentTimestamp(comment.timestamp)}
                        </Typography>
                        {comment.userId === currentUser?.uid && (
                          <IconButton
                            edge="end"
                            aria-label="delete"
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.primary">
                          {comment.content}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                          <IconButton
                            color="primary"
                            onClick={() => handleLikeComment(comment.id)}
                          >
                            <FavoriteBorderIcon fontSize="small" />
                          </IconButton>
                          <Typography variant="caption" color="text.secondary">
                            {comment.likes || 0}
                          </Typography>
                          <IconButton
                            color="primary"
                            onClick={() => handleReplyToComment(comment.id)}
                          >
                            <CommentIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50%' }}>
              <CommentIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography color="text.secondary">No comments yet</Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ p: 2, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              size="small"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && selectedVideo?.id && !e.shiftKey) {
                  e.preventDefault();
                  handleComment(selectedVideo.id);
                }
              }}
              multiline
              maxRows={4}
              InputProps={{
                sx: {
                  '& .MuiInputBase-input': {
                    padding: '8px 12px',
                  }
                }
              }}
            />
            <Button
              variant="contained"
              onClick={() => selectedVideo?.id && handleComment(selectedVideo.id)}
              disabled={!newComment.trim() || commentLoading || !selectedVideo?.id}
              startIcon={<SendIcon />}
            >
              {commentLoading ? <CircularProgress size={20} /> : 'Send'}
            </Button>
          </Box>
        </Box>
      </Box>
    </Drawer>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      height: 'calc(100vh - 56px)',
      position: 'relative', 
      overflow: 'hidden',
      bgcolor: 'black',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Box sx={{ 
        position: 'relative',
        width: '100%',
        bgcolor: 'background.default',
        height: '48px',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Tabs
          value={tabIndex}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          centered
          sx={{
            width: '100%',
            height: '100%',
            '& .MuiTab-root': {
              color: 'text.primary',
              fontSize: '1.1rem',
              fontWeight: 500,
              textTransform: 'none',
              minHeight: '48px',
              '&.Mui-selected': {
                color: 'primary.main'
              }
            },
            '& .MuiTabs-indicator': {
              height: '3px'
            }
          }}
        >
          <Tab 
            label="DISCOVER" 
            sx={{ 
              flex: 1,
              maxWidth: 'none'
            }}
          />
          <Tab 
            label="FOLLOWING" 
            sx={{ 
              flex: 1,
              maxWidth: 'none'
            }}
          />
        </Tabs>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '32px',
            height: '32px',
            bgcolor: 'primary.main',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            boxShadow: 2,
            cursor: 'pointer'
          }}
        >
          <VibitIcon sx={{ color: '#fff', fontSize: 20 }} />
        </Box>
      </Box>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <CircularProgress />
        </Box>
      ) : videos.length > 0 ? (
        <Box
          sx={{
            height: '100%',
            width: '100%',
            position: 'relative',
            overflow: 'hidden',
            mt: '0'
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <video
            ref={videoRef}
            src={videos[currentVideoIndex]?.url}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            preload="metadata"
            poster={videos[currentVideoIndex]?.thumbnailUrl}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 1,
              transition: 'transform 0.5s ease-in-out',
              transform: isTransitioning 
                ? swipeDirection === 'up' 
                  ? 'translateY(-100%)' 
                  : 'translateY(100%)'
                : 'translateY(0)',
              backgroundColor: 'black'
            }}
            onClick={() => setIsPlaying(!isPlaying)}
          />
          {/* Previous video (if exists) */}
          {currentVideoIndex > 0 && (
            <video
              src={videos[currentVideoIndex - 1].url}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 0,
                transition: 'transform 0.5s ease-in-out',
                transform: isTransitioning && swipeDirection === 'down'
                  ? 'translateY(0)'
                  : 'translateY(-100%)'
              }}
            />
          )}
          {/* Next video (if exists) */}
          {currentVideoIndex < videos.length - 1 && (
            <video
              src={videos[currentVideoIndex + 1].url}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 0,
                transition: 'transform 0.5s ease-in-out',
                transform: isTransitioning && swipeDirection === 'up'
                  ? 'translateY(0)'
                  : 'translateY(100%)'
              }}
            />
          )}
          {/* Video Controls */}
          <Box sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 10,
            display: 'flex',
            gap: 1
          }}>
            <IconButton 
              color="primary"
              onClick={() => setIsPlaying(!isPlaying)}
              sx={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            >
              {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
            <IconButton 
              color="primary"
              onClick={() => setIsMuted(!isMuted)}
              sx={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            >
              {isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
            </IconButton>
            {!isMuted && (
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center',
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderRadius: 1,
                px: 1,
                py: 0.5
              }}>
                <Slider
                  value={volume}
                  onChange={(_, newValue) => {
                    setVolume(newValue as number);
                  }}
                  min={0}
                  max={1}
                  step={0.1}
                  sx={{
                    width: 100,
                    color: 'white',
                    '& .MuiSlider-thumb': {
                      width: 12,
                      height: 12,
                    },
                    '& .MuiSlider-track': {
                      height: 4,
                    },
                    '& .MuiSlider-rail': {
                      height: 4,
                    }
                  }}
                />
              </Box>
            )}
            <IconButton 
              color="primary"
              onClick={handleInfoMenuOpen}
              sx={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            >
              <MoreVertIcon />
            </IconButton>
          </Box>
          {/* Video Info Menu */}
          <Menu
            anchorEl={videoInfoAnchorEl}
            open={Boolean(videoInfoAnchorEl)}
            onClose={handleInfoMenuClose}
          >
            <MenuItem disabled>
              <Typography variant="subtitle2">Video Information</Typography>
            </MenuItem>
            <MenuItem disabled>
              <InfoIcon fontSize="small" sx={{ mr: 1 }} />
              Duration: {currentVideoInfo.duration}
            </MenuItem>
            <MenuItem disabled>
              <InfoIcon fontSize="small" sx={{ mr: 1 }} />
              Resolution: {currentVideoInfo.resolution}
            </MenuItem>
          </Menu>
          {/* Comments Dialog */}
          <CommentsDrawer />
          {/* Upload Progress Dialog */}
          {uploading && (
            <Dialog open={uploading} maxWidth="sm" fullWidth>
              <DialogContent>
                <Typography variant="h6" gutterBottom>
                  Uploading Video...
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={uploadProgress} 
                  sx={{ height: 10, borderRadius: 5 }}
                />
                <Typography variant="body2" align="center" sx={{ mt: 1 }}>
                  {Math.round(uploadProgress)}%
                </Typography>
              </DialogContent>
            </Dialog>
          )}
          <Box sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            p: 2,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
            zIndex: 10
          }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              gap: 1, 
              mb: 1,
              width: '100%'
            }}>
              <Link 
                to={`/profile/${videos[currentVideoIndex]?.userId}`} 
                style={{ 
                  textDecoration: 'none',
                  color: 'white'
                }}
              >
                <Typography variant="h6" sx={{ 
                  '&:hover': { 
                    textDecoration: 'underline',
                    cursor: 'pointer'
                  }
                }}>
                  @{videos[currentVideoIndex]?.username}
                </Typography>
              </Link>
              {currentUser && videos[currentVideoIndex]?.userId !== currentUser.uid && (
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => handleFollow(videos[currentVideoIndex]?.userId)}
                  startIcon={following.has(videos[currentVideoIndex]?.userId) ? <PersonAddAlt1Icon /> : <PersonAddIcon />}
                  color={following.has(videos[currentVideoIndex]?.userId) ? "primary" : "secondary"}
                  sx={{ 
                    fontWeight: 'bold',
                    borderRadius: '20px',
                    px: 2,
                    minWidth: '100px'
                  }}
                >
                  {following.has(videos[currentVideoIndex]?.userId) ? 'Following' : 'Follow'}
                </Button>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <IconButton 
                color="primary" 
                onClick={() => handleLike(videos[currentVideoIndex]?.id)}
              >
                {likedVideos.has(videos[currentVideoIndex]?.id) ? <FavoriteIcon /> : <FavoriteBorderIcon />}
              </IconButton>
              <IconButton 
                color="primary"
                onClick={() => handleVideoClick(videos[currentVideoIndex])}
              >
                <CommentIcon />
              </IconButton>
              <IconButton 
                color="primary"
                onClick={() => handleFavorite(videos[currentVideoIndex]?.id)}
              >
                {favoriteVideos.has(videos[currentVideoIndex]?.id) ? <BookmarkIcon /> : <BookmarkBorderIcon />}
              </IconButton>
              <IconButton 
                color="primary"
                onClick={() => handleShare(videos[currentVideoIndex]?.id)}
              >
                <ShareIcon />
              </IconButton>
              <IconButton 
                color="primary"
                onClick={handleResolutionMenuOpen}
              >
                <HighQualityIcon />
              </IconButton>
              {currentUser?.uid === videos[currentVideoIndex]?.userId && (
                <IconButton 
                  color="error"
                  onClick={() => {
                    setVideoToDelete(videos[currentVideoIndex]);
                    setShowDeleteDialog(true);
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              )}
              <IconButton 
                color="primary"
                onClick={handleSaveVideo}
              >
                <SaveIcon />
              </IconButton>
            </Box>
          </Box>
        </Box>
      ) : (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100%',
          gap: 2
        }}>
          <Typography variant="h6">No videos yet</Typography>
          <Typography variant="body2" color="text.secondary">
            Be the first to share a video!
          </Typography>
        </Box>
      )}

      {/* Resolution Menu */}
      <Menu
        anchorEl={resolutionAnchorEl}
        open={Boolean(resolutionAnchorEl)}
        onClose={handleResolutionMenuClose}
      >
        <MenuItem disabled>
          <Typography variant="subtitle2">Select Quality</Typography>
        </MenuItem>
        <MenuItem onClick={() => handleResolutionChange('auto')}>
          Auto (Recommended)
        </MenuItem>
        {videos[currentVideoIndex]?.resolutions?.map((resolution) => (
          <MenuItem 
            key={resolution} 
            onClick={() => handleResolutionChange(resolution)}
          >
            {resolution}
          </MenuItem>
        ))}
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={showDeleteDialog} 
        onClose={() => {
          setShowDeleteDialog(false);
          setVideoToDelete(null);
        }}
      >
        <DialogTitle>Delete Video</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this video? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowDeleteDialog(false);
            setVideoToDelete(null);
          }}>
            Cancel
          </Button>
          <Button 
            color="error" 
            onClick={() => videoToDelete && handleDeleteVideo(videoToDelete)}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <input
        type="file"
        accept="video/*"
        onChange={handleVideoUpload}
        style={{ display: 'none' }}
        id="video-upload"
        ref={videoInputRef}
      />
      <label htmlFor="video-upload">
        <IconButton
          color="primary"
          component="span"
          sx={{
            position: 'fixed',
            bottom: 140,
            right: 16,
            backgroundColor: 'primary.main',
            '&:hover': {
              backgroundColor: 'primary.dark'
            },
            boxShadow: 3,
            width: 56,
            height: 56,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => {
            toast('Videos must be between 5 seconds and 3 minutes long');
            setTimeout(() => {
              videoInputRef.current?.click();
            }, 1000);
          }}
        >
          {uploading ? (
            <CircularProgress 
              size={24} 
              color="inherit" 
              sx={{ 
                position: 'absolute',
                top: '50%',
                left: '50%',
                marginTop: '-12px',
                marginLeft: '-12px'
              }} 
            />
          ) : (
            <AddIcon sx={{ fontSize: 32 }} />
          )}
        </IconButton>
      </label>
    </Box>
  );
};

export default Vibits; 