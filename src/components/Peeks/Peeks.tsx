import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  Dialog,
  DialogContent,
  LinearProgress,
  Fab,
  Card,
  CardContent,
  Button,
  TextField,
  Snackbar,
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Chip,
  Drawer,
  Slide
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  ArrowBackIos as ArrowBackIcon,
  ArrowForwardIos as ArrowForwardIcon,
  Send as SendIcon,
  Image as ImageIcon,
  Videocam as VideocamIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db, storage } from '../../services/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface Story {
  id: string;
  userId: string;
  username: string;
  userAvatar: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  createdAt: Timestamp;
  expiresAt: Timestamp;
  views: string[];
  isViewed?: boolean;
}

interface StoryGroup {
  userId: string;
  username: string;
  userAvatar: string;
  stories: Story[];
  hasUnviewed: boolean;
}

const Peeks: React.FC = () => {
  const { currentUser, blockUser } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<StoryGroup | null>(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);
  const [createContent, setCreateContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCameraView, setShowCameraView] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState<Blob | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [textOverlays, setTextOverlays] = useState<Array<{
    id: string;
    text: string;
    x: number;
    y: number;
    fontSize: number;
    color: string;
  }>>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [currentTextInput, setCurrentTextInput] = useState('');
  const [showPostDrawer, setShowPostDrawer] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [storyViewers, setStoryViewers] = useState<Array<{id: string, username: string, avatar: string}>>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedViewer, setSelectedViewer] = useState<{id: string, username: string, avatar: string} | null>(null);
  const [showViewerMenu, setShowViewerMenu] = useState(false);
  const [userProfileData, setUserProfileData] = useState<any>(null);
  const [isStoryViewerOpening, setIsStoryViewerOpening] = useState(false);
  
  // Fetch current user's profile data from Firestore
  const fetchUserProfile = async () => {
    if (!currentUser) return;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        setUserProfileData(userDoc.data());
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  // Debug logging
  useEffect(() => {
    console.log('State update:', {
      previewMode,
      showPostDrawer,
      hasSelectedFile: !!selectedFile,
      hasCapturedPhoto: !!capturedPhoto,
      hasRecordedVideo: !!recordedVideo,
      showCameraView
    });
  }, [previewMode, showPostDrawer, selectedFile, capturedPhoto, recordedVideo, showCameraView]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  // Fetch stories from users that the current user follows (and their own stories)
  const fetchStories = async () => {
    if (!currentUser) {
      console.log('No current user, skipping story fetch');
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching stories for user:', currentUser.uid);
      
      // Get users that the current user follows from the following subcollection
      const followingQuery = query(collection(db, `users/${currentUser.uid}/following`));
      const followingSnapshot = await getDocs(followingQuery);
      const following = followingSnapshot.docs.map(doc => doc.id);
      console.log('Following list from subcollection:', following);
      
      // Include current user to see their own stories + users they follow
      const allUserIds = [currentUser.uid, ...following];
      console.log('All user IDs to fetch stories for:', allUserIds);

      // Fetch stories from the last 24 hours
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      let storiesSnapshot;
      
      try {
        // Firestore 'in' queries are limited to 10 items, so we need to batch if more users
        if (allUserIds.length <= 10) {
          const storiesQuery = query(
            collection(db, 'stories'),
            where('userId', 'in', allUserIds),
            where('expiresAt', '>', Timestamp.fromDate(twentyFourHoursAgo)),
            orderBy('expiresAt'),
            orderBy('createdAt', 'desc')
          );

          console.log('Executing stories query for', allUserIds.length, 'users...');
          storiesSnapshot = await getDocs(storiesQuery);
          console.log('Found', storiesSnapshot.docs.length, 'stories');
        } else {
          // Handle more than 10 users by batching queries
          console.log('More than 10 users, batching queries...');
          const batches = [];
          for (let i = 0; i < allUserIds.length; i += 10) {
            const batch = allUserIds.slice(i, i + 10);
            const batchQuery = query(
              collection(db, 'stories'),
              where('userId', 'in', batch),
              where('expiresAt', '>', Timestamp.fromDate(twentyFourHoursAgo)),
              orderBy('expiresAt'),
              orderBy('createdAt', 'desc')
            );
            batches.push(getDocs(batchQuery));
          }
          
          const batchResults = await Promise.all(batches);
          const allDocs = batchResults.flatMap(snapshot => snapshot.docs);
          storiesSnapshot = { docs: allDocs };
          console.log('Found', allDocs.length, 'stories from batched queries');
        }
      } catch (queryError) {
        console.error('Error with compound query, trying simpler approach:', queryError);
        
        // Fallback: Just get current user's stories
        const userStoriesQuery = query(
          collection(db, 'stories'),
          where('userId', '==', currentUser.uid),
          where('expiresAt', '>', Timestamp.fromDate(twentyFourHoursAgo)),
          orderBy('expiresAt', 'desc')
        );
        
        storiesSnapshot = await getDocs(userStoriesQuery);
        console.log('Fallback query found', storiesSnapshot.docs.length, 'user stories');
      }
      
      const stories: Story[] = [];

      for (const storyDoc of storiesSnapshot.docs) {
        const storyData = storyDoc.data();
        console.log('Processing story:', storyDoc.id, storyData);
        
        // Get user data
        const userDocRef = doc(db, 'users', storyData.userId);
        const userDocSnap = await getDoc(userDocRef);
        const userData = userDocSnap.data();

        stories.push({
          id: storyDoc.id,
          userId: storyData.userId,
          username: userData?.username || userData?.name || 'Unknown User',
          userAvatar: userData?.profilePic || userData?.photoURL || '',
          content: storyData.content || '',
          mediaUrl: storyData.mediaUrl,
          mediaType: storyData.mediaType,
          createdAt: storyData.createdAt,
          expiresAt: storyData.expiresAt,
          views: storyData.views || [],
          isViewed: storyData.views?.includes(currentUser.uid) || false
        });
      }

      console.log('Processed stories:', stories);

      // Group stories by user
      const groupedStories: { [key: string]: StoryGroup } = {};
      
      stories.forEach(story => {
        if (!groupedStories[story.userId]) {
          groupedStories[story.userId] = {
            userId: story.userId,
            username: story.username,
            userAvatar: story.userAvatar,
            stories: [],
            hasUnviewed: false
          };
        }
        
        groupedStories[story.userId].stories.push(story);
        
        if (!story.isViewed && story.userId !== currentUser.uid) {
          groupedStories[story.userId].hasUnviewed = true;
        }
      });

      // Convert to array and sort (current user first, then by unviewed status)
      const groupsArray = Object.values(groupedStories).sort((a, b) => {
        if (a.userId === currentUser.uid) return -1;
        if (b.userId === currentUser.uid) return 1;
        if (a.hasUnviewed && !b.hasUnviewed) return -1;
        if (!a.hasUnviewed && b.hasUnviewed) return 1;
        return 0;
      });

      console.log('Final story groups:', groupsArray);
      setStoryGroups(groupsArray);
    } catch (error) {
      console.error('Error fetching stories:', error);
      setError('Failed to load stories');
    } finally {
      setLoading(false);
    }
  };

  // Mark story as viewed
  const markStoryAsViewed = async (storyId: string) => {
    if (!currentUser) return;

    try {
      const storyRef = doc(db, 'stories', storyId);
      await updateDoc(storyRef, {
        views: arrayUnion(currentUser.uid)
      });
    } catch (error) {
      console.error('Error marking story as viewed:', error);
    }
  };

  // Delete story
  const deleteStory = async (storyId: string) => {
    if (!currentUser) return;

    try {
      // Delete from Firestore
      await deleteDoc(doc(db, 'stories', storyId));
      
      // Close viewers and story viewer
      setShowViewers(false);
      setSelectedGroup(null);
      setShowDeleteConfirm(false);
      
      setSuccess('Story deleted successfully!');
      
      // Refresh stories
      setTimeout(async () => {
        await fetchStories();
      }, 500);
    } catch (error) {
      console.error('Error deleting story:', error);
      setError('Failed to delete story');
    }
  };

  // Get story viewers
  const getStoryViewers = async (storyId: string) => {
    if (!currentUser) return;

    try {
      const storyRef = doc(db, 'stories', storyId);
      const storyDoc = await getDoc(storyRef);
      
      if (storyDoc.exists()) {
        const storyData = storyDoc.data();
        const viewerIds = storyData.views || [];
        
        const viewers = [];
        for (const viewerId of viewerIds) {
          const userRef = doc(db, 'users', viewerId);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            viewers.push({
              id: viewerId,
              username: userData.username || userData.name || 'Unknown User',
              avatar: userData.profilePic || userData.photoURL || ''
            });
          }
        }
        
        setStoryViewers(viewers);
        setShowViewers(true);
      }
    } catch (error) {
      console.error('Error getting story viewers:', error);
      setError('Failed to load viewers');
    }
  };

  // Block user using existing AuthContext function
  const handleBlockUser = async (userId: string) => {
    if (!currentUser) return;

    try {
      await blockUser(userId);
      setSuccess('User blocked successfully');
      setShowViewerMenu(false);
      setSelectedViewer(null);
      
      // Refresh viewers list to remove blocked user
      if (selectedGroup) {
        await getStoryViewers(selectedGroup.stories[currentStoryIndex].id);
      }
    } catch (error) {
      console.error('Error blocking user:', error);
      setError('Failed to block user');
    }
  };

  // Hide story from user
  const hideStoryFromUser = async (userId: string, storyId: string) => {
    if (!currentUser) return;

    try {
      // Add to story's hidden users list
      const storyRef = doc(db, 'stories', storyId);
      await updateDoc(storyRef, {
        hiddenFrom: arrayUnion(userId)
      });

      setSuccess('Story hidden from user');
      setShowViewerMenu(false);
      setSelectedViewer(null);
      
      // Refresh viewers list
      if (selectedGroup) {
        await getStoryViewers(selectedGroup.stories[currentStoryIndex].id);
      }
    } catch (error) {
      console.error('Error hiding story:', error);
      setError('Failed to hide story');
    }
  };

  // Navigate to user profile
  const viewUserProfile = (userId: string) => {
    setShowViewerMenu(false);
    setSelectedViewer(null);
    setShowViewers(false);
    setSelectedGroup(null);
    navigate(`/profile/${userId}`);
  };

  // Handle story viewing
  const openStoryViewer = (group: StoryGroup, startIndex: number = 0) => {
    // Prevent multiple rapid opens
    if (isStoryViewerOpening) return;
    
    setIsStoryViewerOpening(true);
    setSelectedGroup(group);
    setCurrentStoryIndex(startIndex);
    setStoryProgress(0);
    
    // Mark first story as viewed if not own story
    if (group.stories[startIndex] && group.stories[startIndex].userId !== currentUser?.uid) {
      markStoryAsViewed(group.stories[startIndex].id);
    }
    
    // Reset the flag after a short delay
    setTimeout(() => {
      setIsStoryViewerOpening(false);
    }, 500);
  };

  // Story progress timer - pauses when viewers dialog is open
  useEffect(() => {
    if (selectedGroup && selectedGroup.stories.length > 0 && !showViewers) {
      progressInterval.current = setInterval(() => {
        setStoryProgress(prev => {
          if (prev >= 100) {
            // Move to next story
            const nextIndex = currentStoryIndex + 1;
            if (nextIndex < selectedGroup.stories.length) {
              setCurrentStoryIndex(nextIndex);
              // Mark next story as viewed
              if (selectedGroup.stories[nextIndex].userId !== currentUser?.uid) {
                markStoryAsViewed(selectedGroup.stories[nextIndex].id);
              }
              return 0;
            } else {
              // Close viewer
              setSelectedGroup(null);
              return 0;
            }
          }
          return prev + 2; // 5 seconds per story (100/20 = 5)
        });
      }, 100);
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [selectedGroup, currentStoryIndex, currentUser, showViewers]);

  // Navigate stories
  const goToNextStory = () => {
    if (!selectedGroup) return;
    
    const nextIndex = currentStoryIndex + 1;
    if (nextIndex < selectedGroup.stories.length) {
      setCurrentStoryIndex(nextIndex);
      setStoryProgress(0);
      if (selectedGroup.stories[nextIndex].userId !== currentUser?.uid) {
        markStoryAsViewed(selectedGroup.stories[nextIndex].id);
      }
    } else {
      setSelectedGroup(null);
    }
  };

  const goToPreviousStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(currentStoryIndex - 1);
      setStoryProgress(0);
    }
  };

  // Create story
  const handleCreateStory = async () => {
    console.log('Creating story...', { 
      hasUser: !!currentUser, 
      hasContent: !!createContent.trim(), 
      hasFile: !!selectedFile 
    });

    if (!currentUser || (!createContent.trim() && !selectedFile)) {
      setError('Please add content or select a file');
      return;
    }

    try {
      setUploading(true);
      setError(null); // Clear any previous errors
      
      let mediaUrl = '';
      let mediaType: 'image' | 'video' | undefined;

      // Upload file if selected
      if (selectedFile) {
        console.log('Uploading file:', selectedFile.name, selectedFile.type);
        const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
        mediaType = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension || '') ? 'image' : 'video';
        
        const storageRef = ref(storage, `stories/${currentUser.uid}/${Date.now()}_${selectedFile.name}`);
        console.log('Storage ref created:', storageRef.fullPath);
        
        const uploadResult = await uploadBytes(storageRef, selectedFile);
        console.log('Upload completed:', uploadResult);
        
        mediaUrl = await getDownloadURL(uploadResult.ref);
        console.log('Download URL obtained:', mediaUrl);
      }

      // Create expiration date (24 hours from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const storyData = {
        userId: currentUser.uid,
        content: createContent.trim(),
        mediaUrl,
        mediaType,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
        views: []
      };

      console.log('Creating story document:', storyData);

      // Add story to database
      const docRef = await addDoc(collection(db, 'stories'), storyData);
      console.log('Story created with ID:', docRef.id);

      // Verify the story was created by reading it back
      const createdStoryDoc = await getDoc(docRef);
      if (createdStoryDoc.exists()) {
        console.log('Story verified in database:', createdStoryDoc.data());
      } else {
        console.error('Story was not found after creation!');
      }

      setSuccess('Story created successfully!');
      setShowPostDrawer(false);
      setShowCameraView(false);
      setPreviewMode(false);
      setCreateContent('');
      setSelectedFile(null);
      setRecordedVideo(null);
      setCapturedPhoto(null);
      setTextOverlays([]);
      
      // Stop camera if still running
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
      
      // Refresh stories and user profile with a small delay to ensure Firestore consistency
      console.log('Refreshing stories...');
      setTimeout(async () => {
        await fetchStories();
        await fetchUserProfile();
        console.log('Stories refreshed');
      }, 1000);
    } catch (error) {
      console.error('Error creating story:', error);
      setError(`Failed to create story: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        setError('File size must be less than 50MB');
        return;
      }
      setSelectedFile(file);
      
      // Enter preview mode but DON'T open drawer yet - user needs to click Next
      setPreviewMode(true);
      setShowCameraView(true); // Keep camera view open for preview
    }
    
    // Reset the input value so the same file can be selected again
    event.target.value = '';
  };

  // Camera functionality
  const startCamera = async () => {
    try {
      // Use portrait orientation for mobile devices
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      const videoConstraints = isMobileDevice ? {
        facingMode: 'user',
        width: { ideal: 720 },  // Portrait: height > width
        height: { ideal: 1280 }
      } : {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
      };

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: videoConstraints, 
        audio: true 
      });
      setCameraStream(stream);
      setShowCameraView(true);
      
      // Set video source after the dialog opens
      setTimeout(() => {
        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(console.error);
        }
      }, 100);
    } catch (error) {
      console.error('Error accessing camera:', error);
      setError('Could not access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCameraView(false);
    setIsRecording(false);
    setRecordedVideo(null);
    setCapturedPhoto(null);
    setPreviewMode(false);
    setShowPostDrawer(false);
    setTextOverlays([]);
    setCreateContent('');
    setSelectedFile(null);
  };

  const startRecording = () => {
    if (!cameraStream) {
      console.error('No camera stream available for recording');
      return;
    }

    try {
      console.log('Starting video recording...');
      
      // Check if MediaRecorder is supported
      if (!MediaRecorder.isTypeSupported('video/webm')) {
        console.warn('video/webm not supported, trying video/mp4');
        if (!MediaRecorder.isTypeSupported('video/mp4')) {
          setError('Video recording not supported on this device');
          return;
        }
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4';
      
      // Configure recorder options for better mobile compatibility
      const recorderOptions: MediaRecorderOptions = { 
        mimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps for good quality
      };
      
      const recorder = new MediaRecorder(cameraStream, recorderOptions);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        console.log('Data available:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        console.log('Recording stopped, creating blob from', chunks.length, 'chunks');
        const blob = new Blob(chunks, { type: mimeType });
        console.log('Created blob:', blob.size, 'bytes');
        
        if (blob.size === 0) {
          console.error('Recorded blob is empty!');
          setError('Recording failed - no data captured');
          return;
        }
        
        setRecordedVideo(blob);
        
        // Convert blob to file for upload
        const fileExtension = mimeType === 'video/webm' ? 'webm' : 'mp4';
        const file = new File([blob], `story_${Date.now()}.${fileExtension}`, { type: mimeType });
        setSelectedFile(file);
        
        console.log('Switching to preview mode...');
        // Switch to preview mode - this will show the Next button
        setPreviewMode(true);
      };

      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Recording error occurred');
      };

      // Start recording with timeslice for better data capture
      recorder.start(1000); // Capture data every second
      setMediaRecorder(recorder);
      setIsRecording(true);
      console.log('Recording started successfully');
    } catch (error) {
      console.error('Error starting recording:', error);
      setError('Could not start recording');
    }
  };

  const stopRecording = () => {
    console.log('Stopping recording...', { mediaRecorder: !!mediaRecorder, isRecording });
    if (mediaRecorder && isRecording) {
      try {
        mediaRecorder.stop();
        setIsRecording(false);
        setMediaRecorder(null);
        console.log('Recording stop requested');
      } catch (error) {
        console.error('Error stopping recording:', error);
        setError('Error stopping recording');
      }
    }
  };

  const retakeVideo = () => {
    setRecordedVideo(null);
    setSelectedFile(null);
    setCapturedPhoto(null);
    setTextOverlays([]);
    setPreviewMode(false);
    setShowPostDrawer(false);
    setCreateContent('');
    
    // Ensure camera stream is active and video element is connected
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(console.error);
    } else if (!cameraStream) {
      // Restart camera if stream was lost
      startCamera();
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !cameraStream) return;

    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Flip the image horizontally to match the mirrored video
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      
      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedPhoto(photoDataUrl);
      
      // Convert to file for upload
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
          setSelectedFile(file);
          setPreviewMode(true); // This will show the Next button
        }
      }, 'image/jpeg', 0.8);
    }
  };

  // Text overlay functions
  const addTextOverlay = () => {
    const newText = {
      id: Date.now().toString(),
      text: currentTextInput || 'Tap to edit',
      x: 50, // Center position
      y: 50,
      fontSize: 24,
      color: '#ffffff'
    };
    setTextOverlays(prev => [...prev, newText]);
    setCurrentTextInput('');
    setShowTextEditor(false);
  };

  const updateTextOverlay = (id: string, updates: Partial<typeof textOverlays[0]>) => {
    setTextOverlays(prev => 
      prev.map(overlay => 
        overlay.id === id ? { ...overlay, ...updates } : overlay
      )
    );
  };

  const deleteTextOverlay = (id: string) => {
    setTextOverlays(prev => prev.filter(overlay => overlay.id !== id));
    setEditingTextId(null);
  };

  // Handle photo selection separately
  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      if (file.size > 50 * 1024 * 1024) {
        setError('File size must be less than 50MB');
        return;
      }
      setSelectedFile(file);
      
      // Enter preview mode but DON'T open drawer yet - user needs to click Next
      setPreviewMode(true);
      setShowCameraView(true); // Keep camera view open for preview
    }
    
    // Reset the input value
    event.target.value = '';
  };

  // Connect camera stream to video element
  useEffect(() => {
    if (showCameraView && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(console.error);
    }
  }, [showCameraView, cameraStream]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  useEffect(() => {
    fetchStories();
    fetchUserProfile();
  }, [currentUser]);



  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      py: 1,
      '& @keyframes pulse': {
        '0%': {
          transform: 'scale(1)',
          boxShadow: '0 8px 30px rgba(0, 122, 255, 0.6)'
        },
        '50%': {
          transform: 'scale(1.05)',
          boxShadow: '0 12px 40px rgba(0, 122, 255, 0.8)'
        },
        '100%': {
          transform: 'scale(1)',
          boxShadow: '0 8px 30px rgba(0, 122, 255, 0.6)'
        }
      }
    }}>
      <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
        Peeks
      </Typography>
      

      
      <Box sx={{ 
        display: 'flex', 
        gap: 2, 
        overflowX: 'auto',
        pb: 1,
        '&::-webkit-scrollbar': {
          height: 6,
        },
        '&::-webkit-scrollbar-track': {
          backgroundColor: 'rgba(0,0,0,0.1)',
          borderRadius: 3,
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(0,0,0,0.3)',
          borderRadius: 3,
        },
      }}>
        {/* Add Story Button */}
        {currentUser && (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            minWidth: 80,
            cursor: 'pointer'
          }}
          onClick={startCamera}
          >
            <Box sx={{ position: 'relative' }}>
              <Avatar
                src={
                  userProfileData?.profilePic || 
                  userProfileData?.photoURL || 
                  currentUser.photoURL || 
                  ''
                }
                sx={{ 
                  width: 64, 
                  height: 64,
                  border: '2px solid',
                  borderColor: 'divider'
                }}
              >
                {(
                  userProfileData?.username || 
                  userProfileData?.name || 
                  currentUser.displayName || 
                  currentUser.email
                )?.[0]?.toUpperCase()}
              </Avatar>
              <Fab
                size="small"
                color="primary"
                sx={{
                  position: 'absolute',
                  bottom: -4,
                  right: -4,
                  width: 24,
                  height: 24,
                  minHeight: 24
                }}
              >
                <AddIcon sx={{ fontSize: 16 }} />
              </Fab>
            </Box>
            <Typography variant="caption" sx={{ mt: 1, textAlign: 'center' }}>
              Your Story
            </Typography>
          </Box>
        )}

        {/* Story Groups */}
        {storyGroups.map((group) => (
          <Box
            key={group.userId}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: 80,
              cursor: 'pointer'
            }}
            onClick={() => openStoryViewer(group)}
          >
            <Avatar
              src={group.userAvatar}
              sx={{
                width: 64,
                height: 64,
                border: '3px solid',
                borderColor: group.hasUnviewed ? 'primary.main' : 'divider',
                p: group.hasUnviewed ? 0.5 : 0
              }}
            >
              {group.username[0]?.toUpperCase()}
            </Avatar>
            <Typography variant="caption" sx={{ mt: 1, textAlign: 'center' }}>
              {group.userId === currentUser?.uid ? 'You' : group.username}
            </Typography>
            {group.hasUnviewed && (
              <Chip
                label="New"
                size="small"
                color="primary"
                sx={{ mt: 0.5, height: 16, fontSize: '0.7rem' }}
              />
            )}
          </Box>
        ))}

        {storyGroups.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
            No stories available. Follow users to see their stories here!
          </Typography>
        )}
      </Box>

      {/* Instagram-Style Story Viewer */}
      <Dialog
        open={!!selectedGroup}
        onClose={() => setSelectedGroup(null)}
        fullScreen
        PaperProps={{
          sx: {
            bgcolor: 'black',
            color: 'white',
            margin: 0,
            maxHeight: '100vh',
            maxWidth: '100vw'
          }
        }}
        TransitionProps={{
          timeout: 300
        }}
      >
        {selectedGroup && selectedGroup.stories[currentStoryIndex] && (
          <Box sx={{ 
            position: 'relative', 
            height: '100vh', 
            width: '100vw',
            overflow: 'hidden',
            bgcolor: 'black'
          }}>
            {/* Story Content - Full Screen Background */}
            <Box sx={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0,
              zIndex: 1
            }}>
              {selectedGroup.stories[currentStoryIndex].mediaUrl ? (
                selectedGroup.stories[currentStoryIndex].mediaType === 'video' ? (
                  <video
                    src={selectedGroup.stories[currentStoryIndex].mediaUrl}
                    autoPlay
                    muted
                    loop
                    playsInline // Important for iOS to prevent fullscreen
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover', // Fill entire screen like Instagram
                      objectPosition: 'center'
                    }}
                  />
                ) : (
                  <img
                    src={selectedGroup.stories[currentStoryIndex].mediaUrl}
                    alt="Story"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover', // Fill entire screen like Instagram
                      objectPosition: 'center'
                    }}
                  />
                )
              ) : (
                // Text-only story with gradient background
                <Box sx={{
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }} />
              )}
            </Box>

            {/* Dark overlay for better text readability */}
            <Box sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 20%, rgba(0,0,0,0) 80%, rgba(0,0,0,0.3) 100%)',
              zIndex: 2
            }} />

            {/* Progress bars */}
            <Box sx={{ 
              position: 'absolute', 
              top: 20, 
              left: 16, 
              right: 16, 
              zIndex: 10,
              display: 'flex',
              gap: 4
            }}>
              {selectedGroup.stories.map((_, index) => (
                <Box
                  key={index}
                  sx={{
                    flex: 1,
                    height: 3,
                    bgcolor: 'rgba(255,255,255,0.3)',
                    borderRadius: 2,
                    overflow: 'hidden'
                  }}
                >
                  <Box
                    sx={{
                      height: '100%',
                      width: index < currentStoryIndex ? '100%' : 
                             index === currentStoryIndex ? `${storyProgress}%` : '0%',
                      bgcolor: 'white',
                      transition: index === currentStoryIndex ? 'none' : 'width 0.3s ease'
                    }}
                  />
                </Box>
              ))}
            </Box>

            {/* Header */}
            <Box sx={{
              position: 'absolute',
              top: 40,
              left: 16,
              right: 16,
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar
                  src={selectedGroup.userAvatar}
                  sx={{ 
                    width: 40, 
                    height: 40,
                    border: '2px solid white'
                  }}
                >
                  {selectedGroup.username[0]?.toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" sx={{ 
                    fontWeight: 600,
                    fontSize: 16,
                    textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                  }}>
                  {selectedGroup.username}
                </Typography>
                  <Typography variant="caption" sx={{ 
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: 12,
                    textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                  }}>
                  {selectedGroup.stories[currentStoryIndex].createdAt?.toDate().toLocaleTimeString()}
                </Typography>
              </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {/* Delete button - only show for own stories */}
                {selectedGroup.stories[currentStoryIndex].userId === currentUser?.uid && (
                  <IconButton
                    onClick={() => setShowDeleteConfirm(true)}
                    sx={{ 
                      color: 'white',
                      bgcolor: 'rgba(0,0,0,0.3)',
                      backdropFilter: 'blur(10px)',
                      '&:hover': {
                        bgcolor: 'rgba(255,0,0,0.5)'
                      }
                    }}
                  >
                    <Typography sx={{ fontSize: 18 }}>🗑️</Typography>
                  </IconButton>
                )}
              <IconButton
                onClick={() => setSelectedGroup(null)}
                  sx={{ 
                    color: 'white',
                    bgcolor: 'rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(10px)',
                    '&:hover': {
                      bgcolor: 'rgba(0,0,0,0.5)'
                    }
                  }}
              >
                <CloseIcon />
              </IconButton>
              </Box>
            </Box>

            {/* Story Text Content */}
            {selectedGroup.stories[currentStoryIndex].content && (
            <Box sx={{
                position: 'absolute',
                bottom: 100,
                left: 20,
                right: 20,
                zIndex: 10,
                textAlign: 'center'
              }}>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 600,
                    fontSize: { xs: 20, sm: 24 },
                    textShadow: '2px 2px 8px rgba(0,0,0,0.8)',
                    lineHeight: 1.3,
                    wordBreak: 'break-word'
                  }}
                >
                  {selectedGroup.stories[currentStoryIndex].content}
                </Typography>
              </Box>
            )}

            {/* Swipe Up Area - Only for own stories */}
            {selectedGroup.stories[currentStoryIndex].userId === currentUser?.uid && !showViewers && (
              <Box
                onClick={() => getStoryViewers(selectedGroup.stories[currentStoryIndex].id)}
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 120,
                  zIndex: 15,
                  cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
                  justifyContent: 'flex-end',
                  pb: 3,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 100%)'
                }}
              >
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  bgcolor: 'rgba(0,0,0,0.5)',
                  px: 2,
                  py: 1,
                  borderRadius: 3,
                  backdropFilter: 'blur(10px)'
                }}>
                  <Typography sx={{ fontSize: 16 }}>👁️</Typography>
                  <Typography variant="body2" sx={{ 
                    color: 'white',
                    fontWeight: 500
                  }}>
                    {selectedGroup.stories[currentStoryIndex].views?.length || 0} views
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ 
                  color: 'rgba(255,255,255,0.8)',
                  mt: 1,
                  textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                }}>
                  Tap to see who viewed your story
                </Typography>
              </Box>
            )}

            {/* Viewers List - Shows inside the story */}
            {showViewers && selectedGroup.stories[currentStoryIndex].userId === currentUser?.uid && (
              <Box
                  sx={{
                    position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '50vh',
                  bgcolor: 'rgba(0,0,0,0.9)',
                  backdropFilter: 'blur(20px)',
                  zIndex: 20,
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {/* Drag Handle */}
                <Box sx={{
                  width: 36,
                  height: 5,
                  bgcolor: 'rgba(255,255,255,0.3)',
                  borderRadius: 3,
                  mx: 'auto',
                  mt: 1,
                  mb: 2
                }} />
                
                {/* Header */}
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  px: 3,
                  pb: 2
                }}>
                  <Typography variant="h6" sx={{ 
                    color: 'white',
                    fontWeight: 600
                  }}>
                    Viewed by {storyViewers.length}
                  </Typography>
                  <IconButton
                    onClick={() => setShowViewers(false)}
                    sx={{ color: 'white' }}
                  >
                    <CloseIcon />
                  </IconButton>
                </Box>

                {/* Viewers List */}
                <Box sx={{ 
                  flex: 1, 
                  overflow: 'auto',
                  px: 3
                }}>
                  {storyViewers.length === 0 ? (
                    <Box sx={{ 
                    textAlign: 'center',
                      py: 4,
                      color: 'rgba(255,255,255,0.7)'
                    }}>
                      <Typography sx={{ fontSize: 48, mb: 2 }}>👁️</Typography>
                      <Typography variant="body1" sx={{ color: 'white' }}>
                        No views yet
                      </Typography>
                      <Typography variant="body2">
                        When people view your story, you'll see them here
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {storyViewers.map((viewer) => (
                        <Box
                          key={viewer.id}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            py: 1,
                            position: 'relative'
                          }}
                        >
                          <Avatar
                            src={viewer.avatar}
                            sx={{ width: 50, height: 50 }}
                          >
                            {viewer.username[0]?.toUpperCase()}
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body1" sx={{ 
                              fontWeight: 500,
                              color: 'white'
                            }}>
                              {viewer.username}
                </Typography>
                          </Box>
                          <IconButton
                            onClick={() => {
                              setSelectedViewer(viewer);
                              setShowViewerMenu(true);
                            }}
                            sx={{ 
                              color: 'rgba(255,255,255,0.7)',
                              '&:hover': {
                                color: 'white',
                                bgcolor: 'rgba(255,255,255,0.1)'
                              }
                            }}
                          >
                            <Typography sx={{ fontSize: 20, fontWeight: 'bold' }}>⋯</Typography>
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>
            )}

            {/* Navigation areas - Only when NOT viewing own story */}
            {selectedGroup.stories[currentStoryIndex].userId !== currentUser?.uid && (
              <>
              <Box
                sx={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                    width: '40%',
                  cursor: 'pointer',
                    zIndex: 5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  pl: 2
                }}
                onClick={goToPreviousStory}
              >
                {currentStoryIndex > 0 && (
                    <ArrowBackIcon sx={{ 
                      color: 'rgba(255,255,255,0.0)',
                      fontSize: 40,
                      transition: 'color 0.2s ease',
                      '&:hover': {
                        color: 'rgba(255,255,255,0.7)'
                      }
                    }} />
                )}
              </Box>
              
              <Box
                sx={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                    width: '40%',
                  cursor: 'pointer',
                    zIndex: 5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  pr: 2
                }}
                onClick={goToNextStory}
              >
                  <ArrowForwardIcon sx={{ 
                    color: 'rgba(255,255,255,0.0)',
                    fontSize: 40,
                    transition: 'color 0.2s ease',
                    '&:hover': {
                      color: 'rgba(255,255,255,0.7)'
                    }
                  }} />
              </Box>
              </>
            )}

            {/* Navigation for own stories - smaller zones that don't interfere */}
            {selectedGroup.stories[currentStoryIndex].userId === currentUser?.uid && (
              <>
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    top: 100,
                    bottom: 150,
                    width: '25%',
                    cursor: 'pointer',
                    zIndex: 5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    pl: 2
                  }}
                  onClick={goToPreviousStory}
                >
                  {currentStoryIndex > 0 && (
                    <ArrowBackIcon sx={{ 
                      color: 'rgba(255,255,255,0.0)',
                      fontSize: 40,
                      transition: 'color 0.2s ease',
                      '&:hover': {
                        color: 'rgba(255,255,255,0.7)'
                      }
                    }} />
                  )}
            </Box>
                
                <Box
                  sx={{
                    position: 'absolute',
                    right: 0,
                    top: 100,
                    bottom: 150,
                    width: '25%',
                    cursor: 'pointer',
                    zIndex: 5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    pr: 2
                  }}
                  onClick={goToNextStory}
                >
                  <ArrowForwardIcon sx={{ 
                    color: 'rgba(255,255,255,0.0)',
                    fontSize: 40,
                    transition: 'color 0.2s ease',
                    '&:hover': {
                      color: 'rgba(255,255,255,0.7)'
                    }
                  }} />
                </Box>
              </>
            )}
          </Box>
        )}
      </Dialog>

      {/* Camera View Dialog */}
      <Dialog
        open={showCameraView}
        onClose={stopCamera}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            bgcolor: 'black',
            color: 'white',
            height: isMobile ? '100vh' : '90vh'
          }
        }}
      >
        <DialogContent sx={{ p: 0, position: 'relative', height: '100%', display: 'flex' }}>
                      {/* Camera View */}
          <Box sx={{ 
            flex: 1, 
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'black',
            width: '100%',
            height: '100%'
          }}>
            {!previewMode ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)' // Mirror the video for selfie effect
                }}
                onLoadedMetadata={() => {
                  if (videoRef.current) {
                    videoRef.current.play().catch(console.error);
                  }
                }}
              />
            ) : (
              // Preview mode - show captured content
              <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
                {capturedPhoto ? (
                  <img
                    src={capturedPhoto}
                    alt="Captured"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                ) : recordedVideo ? (
                  <video
                    src={URL.createObjectURL(recordedVideo)}
                    controls
                    autoPlay
                    muted
                    loop
                    playsInline // Important for iOS to prevent fullscreen
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                    onLoadedData={() => console.log('Recorded video loaded for preview')}
                    onError={(e) => console.error('Error loading recorded video:', e)}
                  />
                ) : null}
              </Box>
            )}

            {/* Mobile Controls */}
            <Box sx={{
              position: 'absolute',
              bottom: 20,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              px: 3
            }}>
              {!previewMode ? (
                <>
                  {/* Photo Button */}
                  <IconButton
                    onClick={capturePhoto}
                    sx={{
                      width: 60,
                      height: 60,
                      bgcolor: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      backdropFilter: 'blur(10px)',
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.3)'
                      }
                    }}
                  >
                    <ImageIcon sx={{ fontSize: 28 }} />
                  </IconButton>

                  {/* Record Button */}
                  <IconButton
                    onClick={isRecording ? stopRecording : startRecording}
                    sx={{
                      width: 80,
                      height: 80,
                      bgcolor: isRecording ? 'error.main' : 'white',
                      color: isRecording ? 'white' : 'primary.main',
                      border: isRecording ? 'none' : '4px solid white',
                      '&:hover': {
                        bgcolor: isRecording ? 'error.dark' : 'rgba(255,255,255,0.9)'
                      }
                    }}
                  >
                    {isRecording ? (
                      <Box sx={{ width: 30, height: 30, bgcolor: 'white', borderRadius: 1 }} />
                    ) : (
                      <Box sx={{ 
                        width: 30, 
                        height: 30, 
                        bgcolor: 'error.main', 
                        borderRadius: '50%' 
                      }} />
                    )}
                  </IconButton>

                  {/* Gallery Button */}
                  <IconButton
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.click();
                      }
                    }}
                    sx={{
                      width: 60,
                      height: 60,
                      bgcolor: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      backdropFilter: 'blur(10px)',
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.3)'
                      }
                    }}
                  >
                    <VideocamIcon sx={{ fontSize: 28 }} />
                  </IconButton>
                </>
              ) : (
                // Preview mode controls
                <Box sx={{ 
                  display: 'flex', 
                  gap: 2, 
                  width: '100%', 
                  justifyContent: 'center' 
                }}>
                  <Button
                    onClick={retakeVideo}
                    variant="outlined"
                    sx={{ 
                      color: 'white', 
                      borderColor: 'white',
                      px: 4,
                      py: 1.5,
                      borderRadius: 3
                    }}
                  >
                    Retake
                  </Button>
                </Box>
              )}
            </Box>

            {/* Next Button - Posts directly to story */}
            {previewMode && (selectedFile || capturedPhoto || recordedVideo) && (
              <Fab
                                 onClick={() => {
                  console.log('Next button clicked - posting story directly!');
                  handleCreateStory();
                }}
                sx={{
                  position: 'absolute',
                  bottom: 100,
                  right: 30,
                  bgcolor: '#007aff',
                  color: 'white',
                  width: 70,
                  height: 70,
                  zIndex: 100000,
                  boxShadow: '0 8px 30px rgba(0, 122, 255, 0.6)',
                  border: '3px solid white',
                  '&:hover': {
                    bgcolor: '#0056b3',
                    transform: 'scale(1.1)',
                    boxShadow: '0 12px 40px rgba(0, 122, 255, 0.8)'
                  },
                  transition: 'all 0.3s ease-in-out'
                }}
              >
                <ArrowForwardIcon sx={{ fontSize: 28 }} />
              </Fab>
            )}

            {/* Mobile Caption Input - Shows when text editor is open */}
            {isMobile && showTextEditor && (
              <Box sx={{
                position: 'absolute',
                bottom: 120,
                left: 16,
                right: 16,
                bgcolor: 'rgba(0,0,0,0.8)',
                borderRadius: 2,
                p: 2,
                zIndex: 15
              }}>
                <TextField
                  fullWidth
                  placeholder="Add text to your story..."
                  value={currentTextInput}
                  onChange={(e) => setCurrentTextInput(e.target.value)}
                  autoFocus
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: 'white',
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                      '&.Mui-focused fieldset': { borderColor: 'primary.main' }
                    }
                  }}
                />
                <Box sx={{ display: 'flex', gap: 1, mt: 1, justifyContent: 'flex-end' }}>
                  <Button
                    onClick={() => {
                      setShowTextEditor(false);
                      setCurrentTextInput('');
                      setEditingTextId(null);
                    }}
                    size="small"
                    sx={{ color: 'white' }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (editingTextId) {
                        updateTextOverlay(editingTextId, { text: currentTextInput });
                        setEditingTextId(null);
                      } else {
                        addTextOverlay();
                      }
                      setShowTextEditor(false);
                    }}
                    variant="contained"
                    size="small"
                    disabled={!currentTextInput.trim()}
                  >
                    {editingTextId ? 'Update' : 'Add'}
                  </Button>
                </Box>
              </Box>
            )}

            {/* Text Overlays on Video */}
            {textOverlays.map((overlay) => (
              <Box
                key={overlay.id}
                sx={{
                  position: 'absolute',
                  left: `${overlay.x}%`,
                  top: `${overlay.y}%`,
                  transform: 'translate(-50%, -50%)',
                  color: overlay.color,
                  fontSize: overlay.fontSize,
                  fontWeight: 'bold',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  zIndex: 5
                }}
                onClick={() => {
                  setEditingTextId(overlay.id);
                  setCurrentTextInput(overlay.text);
                  setShowTextEditor(true);
                }}
              >
                {overlay.text}
              </Box>
            ))}

            {/* Top Controls */}
            <Box sx={{
              position: 'absolute',
              top: 16,
              left: 16,
              right: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              zIndex: 10
            }}>
              {/* Text Editor Button */}
              <IconButton
                onClick={() => setShowTextEditor(true)}
                sx={{
                  color: 'white',
                  bgcolor: 'rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(10px)',
                  '&:hover': {
                    bgcolor: 'rgba(0,0,0,0.7)'
                  }
                }}
              >
                <Typography sx={{ fontSize: 20, fontWeight: 'bold' }}>Aa</Typography>
              </IconButton>

              {/* Close Button */}
              <IconButton
                onClick={stopCamera}
                sx={{
                  color: 'white',
                  bgcolor: 'rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(10px)',
                  '&:hover': {
                    bgcolor: 'rgba(0,0,0,0.7)'
                  }
                }}
              >
                <CloseIcon />
              </IconButton>
            </Box>

            {/* Recording Indicator */}
            {isRecording && (
              <Box sx={{
                position: 'absolute',
                top: 70,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: 'rgba(0,0,0,0.7)',
                px: 2,
                py: 1,
                borderRadius: 2,
                zIndex: 10
              }}>
                <Box sx={{
                  width: 8,
                  height: 8,
                  bgcolor: 'error.main',
                  borderRadius: '50%',
                  animation: 'pulse 1s infinite'
                }} />
                <Typography variant="body2" sx={{ color: 'white', fontWeight: 'bold' }}>
                  Recording...
                </Typography>
              </Box>
            )}
          </Box>

          {/* Side Panel - Hidden on mobile when camera is active */}
          {!isMobile && (
            <Box sx={{
              width: 300,
              position: 'relative',
              height: '100%',
              bgcolor: 'rgba(0,0,0,0.8)',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}>
            <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
              Create Your Peek
            </Typography>

            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="Add a caption..."
              value={createContent}
              onChange={(e) => setCreateContent(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'white',
                  '& fieldset': {
                    borderColor: 'rgba(255,255,255,0.3)'
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(255,255,255,0.5)'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'primary.main'
                  }
                },
                '& .MuiInputLabel-root': {
                  color: 'rgba(255,255,255,0.7)'
                }
              }}
            />

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                startIcon={<ImageIcon />}
                onClick={() => fileInputRef.current?.click()}
                variant="outlined"
                size="small"
                sx={{ color: 'white', borderColor: 'white' }}
              >
                Photo
              </Button>
              <Button
                startIcon={<VideocamIcon />}
                onClick={() => fileInputRef.current?.click()}
                variant="outlined"
                size="small"
                sx={{ color: 'white', borderColor: 'white' }}
              >
                Gallery
              </Button>
            </Box>

            {selectedFile && (
              <Card sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}>
                <CardContent>
                  <Typography variant="body2" sx={{ color: 'white' }}>
                    {selectedFile.name}
                  </Typography>
                </CardContent>
              </Card>
            )}

            </Box>
          )}

          {/* Hidden file inputs - always available */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelect}
            style={{ display: 'none' }}
          />
        </DialogContent>
      </Dialog>

      

      {/* Text Editor Dialog - Desktop only */}
      {!isMobile && (
        <Dialog
          open={showTextEditor}
          onClose={() => {
            setShowTextEditor(false);
            setEditingTextId(null);
            setCurrentTextInput('');
          }}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              bgcolor: 'rgba(0,0,0,0.9)',
              color: 'white',
              backdropFilter: 'blur(20px)'
            }
          }}
        >
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, color: 'white' }}>
            {editingTextId ? 'Edit Text' : 'Add Text'}
          </Typography>
          
          <TextField
            fullWidth
            multiline
            rows={3}
            placeholder="Enter your text..."
            value={currentTextInput}
            onChange={(e) => setCurrentTextInput(e.target.value)}
            autoFocus
            sx={{
              mb: 3,
              '& .MuiOutlinedInput-root': {
                color: 'white',
                fontSize: '1.2rem',
                '& fieldset': {
                  borderColor: 'rgba(255,255,255,0.3)'
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(255,255,255,0.5)'
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.main'
                }
              }
            }}
          />

          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            {editingTextId && (
              <Button
                onClick={() => {
                  deleteTextOverlay(editingTextId);
                  setShowTextEditor(false);
                }}
                color="error"
                variant="outlined"
              >
                Delete
              </Button>
            )}
            <Button
              onClick={() => {
                setShowTextEditor(false);
                setEditingTextId(null);
                setCurrentTextInput('');
              }}
              sx={{ color: 'white' }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingTextId) {
                  updateTextOverlay(editingTextId, { text: currentTextInput });
                  setEditingTextId(null);
                } else {
                  addTextOverlay();
                }
                setShowTextEditor(false);
              }}
              variant="contained"
              color="primary"
              disabled={!currentTextInput.trim()}
            >
              {editingTextId ? 'Update' : 'Add'}
            </Button>
          </Box>
        </DialogContent>
        </Dialog>
      )}



      {/* Viewer Actions Menu */}
      <Dialog
        open={showViewerMenu}
        onClose={() => {
          setShowViewerMenu(false);
          setSelectedViewer(null);
        }}
        PaperProps={{
          sx: {
            borderRadius: 3,
            bgcolor: '#1c1c1e',
            color: 'white',
            minWidth: 300
          }
        }}
      >
        {selectedViewer && (
          <Box sx={{ p: 2 }}>
            {/* Header with user info */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 2, 
              mb: 3,
              pb: 2,
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
              <Avatar
                src={selectedViewer.avatar}
                sx={{ width: 50, height: 50 }}
              >
                {selectedViewer.username[0]?.toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {selectedViewer.username}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Story viewer
                </Typography>
              </Box>
            </Box>

            {/* Menu Options */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                onClick={() => viewUserProfile(selectedViewer.id)}
                sx={{
                  justifyContent: 'flex-start',
                  color: 'white',
                  textTransform: 'none',
                  py: 1.5,
                  px: 2,
                  borderRadius: 2,
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.1)'
                  }
                }}
              >
                <Typography sx={{ fontSize: 18, mr: 2 }}>👤</Typography>
                View Profile
              </Button>

              <Button
                onClick={() => {
                  if (selectedGroup) {
                    hideStoryFromUser(selectedViewer.id, selectedGroup.stories[currentStoryIndex].id);
                  }
                }}
                sx={{
                  justifyContent: 'flex-start',
                  color: 'white',
                  textTransform: 'none',
                  py: 1.5,
                  px: 2,
                  borderRadius: 2,
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.1)'
                  }
                }}
              >
                <Typography sx={{ fontSize: 18, mr: 2 }}>🙈</Typography>
                Hide Story From This User
              </Button>

              <Button
                onClick={() => handleBlockUser(selectedViewer.id)}
                sx={{
                  justifyContent: 'flex-start',
                  color: '#ff3b30',
                  textTransform: 'none',
                  py: 1.5,
                  px: 2,
                  borderRadius: 2,
                  '&:hover': {
                    bgcolor: 'rgba(255, 59, 48, 0.1)'
                  }
                }}
              >
                <Typography sx={{ fontSize: 18, mr: 2 }}>🚫</Typography>
                Block User
              </Button>
            </Box>

            {/* Cancel Button */}
            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <Button
                onClick={() => {
                  setShowViewerMenu(false);
                  setSelectedViewer(null);
                }}
                fullWidth
                variant="outlined"
                sx={{
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.3)',
                  py: 1.5,
                  borderRadius: 2,
                  '&:hover': {
                    borderColor: 'rgba(255,255,255,0.5)',
                    bgcolor: 'rgba(255,255,255,0.05)'
                  }
                }}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        PaperProps={{
          sx: {
            borderRadius: 3,
            bgcolor: '#1c1c1e',
            color: 'white'
          }
        }}
      >
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 48, mb: 2 }}>🗑️</Typography>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Delete Story?
          </Typography>
          <Typography variant="body2" sx={{ 
            color: 'rgba(255,255,255,0.7)', 
            mb: 3,
            lineHeight: 1.5
          }}>
            This story will be permanently deleted and removed from your profile.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              onClick={() => setShowDeleteConfirm(false)}
              variant="outlined"
              sx={{
                color: 'white',
                borderColor: 'rgba(255,255,255,0.3)',
                px: 3,
                py: 1,
                borderRadius: 2,
                '&:hover': {
                  borderColor: 'rgba(255,255,255,0.5)',
                  bgcolor: 'rgba(255,255,255,0.05)'
                }
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedGroup && selectedGroup.stories[currentStoryIndex]) {
                  deleteStory(selectedGroup.stories[currentStoryIndex].id);
                }
              }}
              variant="contained"
              sx={{
                bgcolor: '#ff3b30',
                color: 'white',
                px: 3,
                py: 1,
                borderRadius: 2,
                '&:hover': {
                  bgcolor: '#d70015'
                }
              }}
            >
              Delete
            </Button>
          </Box>
        </Box>
      </Dialog>

      {/* Snackbars */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
      >
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Peeks; 