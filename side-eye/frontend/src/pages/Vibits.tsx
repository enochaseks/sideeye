import React, { useState, useRef, useEffect } from 'react';
import { Box, IconButton, Typography, CircularProgress, Dialog, TextField, Button, Avatar, LinearProgress, DialogTitle, DialogContent, DialogActions, Menu, MenuItem, Select, FormControl, InputLabel, SelectChangeEvent, FormHelperText, Slider } from '@mui/material';
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
  PlayArrow as PlayArrowIcon
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
  setDoc
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject,
  UploadTaskSnapshot,
  StorageError
} from 'firebase/storage';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';

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
}

interface Comment {
  id: string;
  content: string;
  userId: string;
  username: string;
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
  const [comments, setComments] = useState<Comment[]>([]);
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
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(0.5);
  const [isPlaying, setIsPlaying] = useState(true);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [slideDirection, setSlideDirection] = useState<'up' | 'down'>('up');
  const [isTransitioning, setIsTransitioning] = useState(false);

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
    try {
      const commentsQuery = query(
        collection(db, `videos/${videoId}/comments`),
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(commentsQuery);
      const fetchedComments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Comment[];
      setComments(fetchedComments);
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
    if (!currentUser || !newComment.trim()) return;
    try {
      setCommentLoading(true);
      await addDoc(collection(db, `videos/${videoId}/comments`), {
        content: newComment,
        userId: currentUser.uid,
        username: currentUser.displayName || 'Anonymous',
        timestamp: serverTimestamp()
      });
      
      await updateDoc(doc(db, 'videos', videoId), {
        comments: increment(1)
      });
      
      setNewComment('');
      fetchComments(videoId);
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
      // Check video duration
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = async () => {
        window.URL.revokeObjectURL(video.src);
        const duration = video.duration;
        
        // Check if video is between 1-3 minutes (60-180 seconds)
        if (duration < 5 || duration > 180) {
          toast('Videos must be between 5 seconds and 3 minutes long');
          return;
        }
        
        // Continue with upload
        setUploading(true);
        setUploadProgress(0);
        const storage = getStorage();
        
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name}`;
        const storageRef = ref(storage, `videos/${currentUser.uid}/${fileName}`);
        
        // Create a video element to get resolution
        const videoEl = document.createElement('video');
        videoEl.preload = 'metadata';
        
        videoEl.onloadedmetadata = () => {
          const width = videoEl.videoWidth;
          const height = videoEl.videoHeight;
          const resolution = `${width}x${height}`;
          window.URL.revokeObjectURL(videoEl.src);
          
          // Generate available resolutions based on original
          const resolutions = ['360p'];
          if (height >= 480) resolutions.push('480p');
          if (height >= 720) resolutions.push('720p');
          if (height >= 1080) resolutions.push('1080p');
          resolutions.push('original');
          
          // Continue upload
          const uploadTask = uploadBytesResumable(storageRef, file);
          
          uploadTask.on('state_changed', 
            (snapshot: UploadTaskSnapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error: StorageError) => {
              console.error('Upload error:', error);
              toast.error('Upload failed');
              setUploading(false);
            },
            async () => {
              const videoUrl = await getDownloadURL(storageRef);
              
              // Get the user's display name from Firestore
              const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
              const userData = userDoc.data();
              const username = userData?.username || currentUser.displayName || currentUser.email?.split('@')[0] || 'Anonymous';
              
              await addDoc(collection(db, 'videos'), {
                url: videoUrl,
                userId: currentUser.uid,
                username: username,
                likes: 0,
                comments: 0,
                timestamp: serverTimestamp(),
                duration: duration,
                resolution: resolution,
                resolutions: resolutions
              });

              toast.success('Video uploaded successfully!');
              fetchVideos();
              setUploading(false);
              setUploadProgress(0);
            }
          );
        };
        
        videoEl.src = URL.createObjectURL(file);
      };
      
      video.src = URL.createObjectURL(file);
      
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

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    const diff = touchStartY.current - touchEndY.current;
    if (Math.abs(diff) > 50 && !isTransitioning) {
      setIsTransitioning(true);
      if (diff > 0 && currentVideoIndex < videos.length - 1) {
        setSlideDirection('up');
        setTimeout(() => {
          setCurrentVideoIndex(prev => prev + 1);
          setIsTransitioning(false);
        }, 300);
      } else if (diff < 0 && currentVideoIndex > 0) {
        setSlideDirection('down');
        setTimeout(() => {
          setCurrentVideoIndex(prev => prev - 1);
          setIsTransitioning(false);
        }, 300);
      } else {
        setIsTransitioning(false);
      }
    }
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
        toast.success('Followed user');
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast.error('Failed to update follow status');
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
    if (!currentVideo) return;
    
    // Format duration
    const totalSeconds = currentVideo.duration || 0;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    setCurrentVideoInfo({
      duration: formattedDuration,
      resolution: currentVideo.resolution || 'Unknown'
    });
    setVideoInfoAnchorEl(event.currentTarget);
  };

  const handleInfoMenuClose = () => {
    setVideoInfoAnchorEl(null);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const currentVideo = videos[currentVideoIndex];

  return (
    <Box sx={{ height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {videos.length > 0 ? (
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative'
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <video
            ref={videoRef}
            src={currentVideo.url}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 1,
              transition: 'transform 0.3s ease-in-out',
              transform: isTransitioning 
                ? slideDirection === 'up' 
                  ? 'translateY(-100%)' 
                  : 'translateY(100%)'
                : 'translateY(0)'
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
                transition: 'transform 0.3s ease-in-out',
                transform: isTransitioning && slideDirection === 'down'
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
                transition: 'transform 0.3s ease-in-out',
                transform: isTransitioning && slideDirection === 'up'
                  ? 'translateY(0)'
                  : 'translateY(100%)'
              }}
            />
          )}
          
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
                to={`/profile/${currentVideo.userId}`} 
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
                  @{currentVideo.username}
                </Typography>
              </Link>
              {currentUser && currentVideo.userId !== currentUser.uid && (
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => handleFollow(currentVideo.userId)}
                  startIcon={following.has(currentVideo.userId) ? <PersonAddAlt1Icon /> : <PersonAddIcon />}
                  color={following.has(currentVideo.userId) ? "primary" : "secondary"}
                  sx={{ 
                    fontWeight: 'bold',
                    borderRadius: '20px',
                    px: 2,
                    minWidth: '100px'
                  }}
                >
                  {following.has(currentVideo.userId) ? 'Following' : 'Follow'}
                </Button>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <IconButton 
                color="primary" 
                onClick={() => handleLike(currentVideo.id)}
              >
                {likedVideos.has(currentVideo.id) ? <FavoriteIcon /> : <FavoriteBorderIcon />}
              </IconButton>
              <IconButton 
                color="primary"
                onClick={() => {
                  setShowComments(true);
                  fetchComments(currentVideo.id);
                }}
              >
                <CommentIcon />
              </IconButton>
              <IconButton 
                color="primary"
                onClick={() => handleFavorite(currentVideo.id)}
              >
                {favoriteVideos.has(currentVideo.id) ? <BookmarkIcon /> : <BookmarkBorderIcon />}
              </IconButton>
              <IconButton 
                color="primary"
                onClick={() => handleShare(currentVideo.id)}
              >
                <ShareIcon />
              </IconButton>
              <IconButton 
                color="primary"
                onClick={handleResolutionMenuOpen}
              >
                <HighQualityIcon />
              </IconButton>
              {currentUser?.uid === currentVideo.userId && (
                <IconButton 
                  color="error"
                  onClick={() => {
                    setVideoToDelete(currentVideo);
                    setShowDeleteDialog(true);
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              )}
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
        {currentVideo?.resolutions?.map((resolution) => (
          <MenuItem 
            key={resolution} 
            onClick={() => handleResolutionChange(resolution)}
          >
            {resolution}
          </MenuItem>
        ))}
      </Menu>

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
      <Dialog
        open={showComments}
        onClose={() => setShowComments(false)}
        maxWidth="sm"
        fullWidth
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Comments
          </Typography>
          <Box sx={{ maxHeight: '400px', overflowY: 'auto', mb: 2 }}>
            {comments.map(comment => (
              <Box key={comment.id} sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Avatar>{comment.username[0]}</Avatar>
                <Box>
                  <Typography variant="subtitle2">{comment.username}</Typography>
                  <Typography variant="body2">{comment.content}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <Button
              variant="contained"
              onClick={() => handleComment(currentVideo.id)}
              disabled={commentLoading || !newComment.trim()}
            >
              <SendIcon />
            </Button>
          </Box>
        </Box>
      </Dialog>

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
            // Show duration limit toast before opening file picker
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