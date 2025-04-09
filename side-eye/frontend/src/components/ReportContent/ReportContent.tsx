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
import { getDb } from '../../services/firebase';
import { doc, updateDoc, arrayUnion, getDoc, Firestore } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';

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
  const [db, setDb] = useState<Firestore | null>(null);
  const [preview, setPreview] = useState<ContentPreview | null>(null);
  const [reportType, setReportType] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '' });

  // Initialize Firestore
  useEffect(() => {
    const initializeDb = async () => {
      try {
        const firestore = await getDb();
        setDb(firestore);
      } catch (err) {
        console.error('Error initializing Firestore:', err);
        setError('Failed to initialize database');
      }
    };

    initializeDb();
  }, []);

  useEffect(() => {
    if (db && open) {
      fetchContent();
    }
  }, [db, open]);

  const fetchContent = async () => {
    if (!db) return;

    try {
      const contentRef = doc(db, contentType + 's', contentId);
      const contentDoc = await getDoc(contentRef);
      if (contentDoc.exists()) {
        setPreview(contentDoc.data() as ContentPreview);
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

      const reportRef = doc(db, 'reports', contentId);
      await updateDoc(reportRef, {
        reports: arrayUnion({
          type: reportType,
          description,
          reporterId: currentUser.uid,
          timestamp: new Date().toISOString()
        })
      });

      // Create notification for admins
      const notificationRef = doc(db, 'notifications', 'admin');
      await updateDoc(notificationRef, {
        reports: arrayUnion({
          contentId,
          contentType,
          reporterId: currentUser.uid,
          timestamp: new Date().toISOString()
        })
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