import React, { useState } from 'react';
import { Box, Button, Typography, CircularProgress } from '@mui/material';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../../services/firebase';
import { moderateContent } from '../../services/contentModeration';

interface MediaUploadProps {
  onUploadComplete: (url: string) => void;
  onError: (error: string) => void;
  accept?: string;
  maxSize?: number; // in MB
}

const MediaUpload: React.FC<MediaUploadProps> = ({
  onUploadComplete,
  onError,
  accept = 'image/*',
  maxSize = 5
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      onError(`File size exceeds ${maxSize}MB limit`);
      return;
    }

    // Check file type
    if (!file.type.match(accept)) {
      onError('Invalid file type');
      return;
    }

    try {
      setUploading(true);
      setProgress(0);

      // Create a storage reference
      const storageRef = ref(storage, `uploads/${Date.now()}_${file.name}`);

      // Upload file
      const uploadTask = uploadBytesResumable(storageRef, file);

      // Monitor upload progress
      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(progress);
        },
        (error) => {
          setUploading(false);
          onError(error.message);
        },
        async () => {
          try {
            // Get download URL
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            // Moderate content if it's an image
            if (file.type.startsWith('image/')) {
              const moderationResult = await moderateContent(downloadURL, 'image');
              if (!moderationResult.isApproved) {
                onError('Content does not meet our guidelines');
                return;
              }
            }

            onUploadComplete(downloadURL);
          } catch (error) {
            onError('Error getting download URL');
          } finally {
            setUploading(false);
          }
        }
      );
    } catch (error) {
      setUploading(false);
      onError('Error uploading file');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <input
        accept={accept}
        style={{ display: 'none' }}
        id="media-upload"
        type="file"
        onChange={handleFileChange}
        disabled={uploading}
      />
      <label htmlFor="media-upload">
        <Button
          variant="contained"
          component="span"
          disabled={uploading}
        >
          Upload Media
        </Button>
      </label>
      {uploading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CircularProgress variant="determinate" value={progress} />
          <Typography variant="body2">
            {Math.round(progress)}%
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default MediaUpload; 