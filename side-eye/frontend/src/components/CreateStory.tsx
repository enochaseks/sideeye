import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Box,
  IconButton,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Close as CloseIcon, PhotoCamera, Videocam, AddPhotoAlternate } from '@mui/icons-material';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, storage } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

interface CreateStoryProps {
  open: boolean;
  onClose: () => void;
}

const CreateStory: React.FC<CreateStoryProps> = ({ open, onClose }) => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    if (open) {
      setActiveTab(0);
      setMediaUrl(null);
      setError(null);
      setIsRecording(false);
      setRecordedChunks([]);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [mediaStream]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setMediaUrl(null);
    setError(null);
    setIsRecording(false);
    setRecordedChunks([]);
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMediaStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        setRecordedChunks(chunks);
        setMediaUrl(URL.createObjectURL(blob));
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      setError('Failed to access camera');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('File size should be less than 10MB');
        return;
      }
      if (!file.type.match(/^(image\/(jpeg|png|gif)|video\/mp4|video\/webm)$/)) {
        setError('Only JPEG, PNG, GIF images and MP4, WebM videos are allowed');
        return;
      }
      setMediaUrl(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!currentUser || (!mediaUrl && recordedChunks.length === 0)) return;

    try {
      setIsUploading(true);
      setError(null);

      let mediaBlob: Blob;
      let mediaType: 'image' | 'video';

      if (recordedChunks.length > 0) {
        mediaBlob = new Blob(recordedChunks, { type: 'video/webm' });
        mediaType = 'video';
      } else if (mediaUrl) {
        const response = await fetch(mediaUrl);
        mediaBlob = await response.blob();
        mediaType = mediaUrl.startsWith('data:video') ? 'video' : 'image';
      } else {
        throw new Error('No media to upload');
      }

      const storageRef = ref(storage, `stories/${currentUser.uid}/${Date.now()}_${mediaType}`);
      await uploadBytes(storageRef, mediaBlob);
      const uploadedMediaUrl = await getDownloadURL(storageRef);

      // Add 24-hour expiration
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await addDoc(collection(db, 'stories'), {
        authorId: currentUser.uid,
        mediaUrl: uploadedMediaUrl,
        mediaType,
        timestamp: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
        views: []
      });

      onClose();
    } catch (error) {
      console.error('Error uploading story:', error);
      setError('Failed to upload story');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Create New Story
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 2 }}>
          <Tab icon={<Videocam />} label="Record Video" />
          <Tab icon={<PhotoCamera />} label="Take Photo" />
          <Tab icon={<AddPhotoAlternate />} label="Upload" />
        </Tabs>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {activeTab === 0 && (
            <>
              <video
                ref={videoRef}
                autoPlay
                muted
                style={{ width: '100%', maxHeight: '400px', objectFit: 'contain' }}
              />
              <Box sx={{ mt: 2 }}>
                {!isRecording ? (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={startRecording}
                    disabled={isUploading}
                  >
                    Start Recording
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={stopRecording}
                    disabled={isUploading}
                  >
                    Stop Recording
                  </Button>
                )}
              </Box>
            </>
          )}

          {activeTab === 1 && (
            <>
              <video
                ref={videoRef}
                autoPlay
                muted
                style={{ width: '100%', maxHeight: '400px', objectFit: 'contain' }}
              />
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={async () => {
                    if (videoRef.current) {
                      const canvas = document.createElement('canvas');
                      canvas.width = videoRef.current.videoWidth;
                      canvas.height = videoRef.current.videoHeight;
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        ctx.drawImage(videoRef.current, 0, 0);
                        setMediaUrl(canvas.toDataURL('image/jpeg'));
                      }
                    }
                  }}
                  disabled={isUploading}
                >
                  Take Photo
                </Button>
              </Box>
            </>
          )}

          {activeTab === 2 && (
            <Box sx={{ width: '100%', textAlign: 'center' }}>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button
                  variant="contained"
                  component="span"
                  disabled={isUploading}
                >
                  Choose File
                </Button>
              </label>
            </Box>
          )}

          {mediaUrl && (
            <Box sx={{ mt: 2, width: '100%' }}>
              {mediaUrl.startsWith('data:video') ? (
                <video
                  src={mediaUrl}
                  controls
                  style={{ width: '100%', maxHeight: '400px', objectFit: 'contain' }}
                />
              ) : (
                <img
                  src={mediaUrl}
                  alt="Preview"
                  style={{ width: '100%', maxHeight: '400px', objectFit: 'contain' }}
                />
              )}
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          disabled={!mediaUrl || isUploading}
        >
          {isUploading ? (
            <>
              <CircularProgress size={24} sx={{ mr: 1 }} />
              Uploading...
            </>
          ) : (
            'Upload Story'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateStory; 