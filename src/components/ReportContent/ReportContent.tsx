import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  MenuItem,
  CircularProgress,
  Paper,
  Divider,
  Alert,
  Snackbar,
} from '@mui/material';
import { collection, addDoc, serverTimestamp, Firestore, Timestamp, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';

interface ReportContentProps {
  contentId: string;
  contentType: 'post' | 'comment' | 'user';
  onClose: () => void;
  open: boolean;
}

interface ContentPreview {
  title?: string;
  content?: string;
  author?: string;
  timestamp?: string;
}

const REPORT_TYPES = [
  { value: 'harassment', label: 'Harassment' },
  { value: 'hate_speech', label: 'Hate Speech' },
  { value: 'spam', label: 'Spam' },
  { value: 'inappropriate', label: 'Inappropriate Content' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'copyright', label: 'Copyright Violation' },
  { value: 'privacy', label: 'Privacy Violation' },
  { value: 'other', label: 'Other' },
];

const ReportContent: React.FC<ReportContentProps> = ({
  contentId,
  contentType,
  onClose,
  open,
}) => {
  const { currentUser } = useAuth();
  const [preview, setPreview] = useState<ContentPreview | null>(null);
  const [reportType, setReportType] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '' });

  useEffect(() => {
    if (open) {
      fetchContent();
    }
  }, [open]);

  const fetchContent = async () => {
    try {
      const contentRef = collection(db, contentType + 's');
      const contentDoc = await addDoc(contentRef, { id: contentId });
      const contentData = await addDoc(collection(contentRef, contentDoc.id, 'reports'), {
        type: reportType,
        description,
        reporterId: currentUser?.uid,
        timestamp: serverTimestamp()
      });
      const contentPreviewRef = doc(db, contentType + 's', contentId);
      const contentPreviewSnap = await getDoc(contentPreviewRef);

      if (contentPreviewSnap.exists()) {
        const previewData = contentPreviewSnap.data();
        setPreview({
          title: previewData?.title,
          content: previewData?.content,
          author: previewData?.author,
          timestamp: previewData?.timestamp?.toDate().toISOString()
        });
      } else {
        console.log("Preview document does not exist!");
        setPreview(null);
      }
    } catch (error) {
      console.error('Error fetching content:', error);
      setError('Failed to fetch content');
    }
  };

  const handleSubmit = async () => {
    if (!currentUser || !db) return;

    try {
      setLoading(true);
      setError('');

      const reportRef = collection(db, 'reports');
      await addDoc(reportRef, {
        type: reportType,
        description,
        reporterId: currentUser.uid,
        timestamp: serverTimestamp()
      });

      // Create notification for admins
      const notificationRef = collection(db, 'notifications', 'admin', 'reports');
      await addDoc(notificationRef, {
        contentId,
        contentType,
        reporterId: currentUser.uid,
        timestamp: serverTimestamp()
      });

      setNotification({
        open: true,
        message: 'Report submitted successfully. Our team will review it shortly.',
      });
      onClose();
    } catch (error) {
      console.error('Error submitting report:', error);
      setError('Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Report Content</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
            {preview && (
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Content Preview
                </Typography>
                {preview.title && (
                  <Typography variant="subtitle1" gutterBottom>
                    {preview.title}
                  </Typography>
                )}
                {preview.content && (
                  <Typography variant="body1" gutterBottom>
                    {preview.content}
                  </Typography>
                )}
                {preview.author && (
                  <Typography variant="caption" color="text.secondary">
                    By: {preview.author}
                  </Typography>
                )}
              </Paper>
            )}

            <Divider />

            <TextField
              select
              label="Report Type"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              fullWidth
              required
            >
              {REPORT_TYPES.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={4}
              fullWidth
              required
              placeholder="Please provide details about why you are reporting this content..."
            />

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color="primary"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Submit Report'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        <Alert
          onClose={() => setNotification({ ...notification, open: false })}
          severity="success"
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ReportContent; 