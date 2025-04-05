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
import { db } from '../../services/firebase';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';

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
  const [reportType, setReportType] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<ContentPreview | null>(null);
  const [notification, setNotification] = useState({ open: false, message: '' });

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const contentRef = doc(db, contentType + 's', contentId);
        const contentDoc = await getDoc(contentRef);
        if (contentDoc.exists()) {
          setPreview(contentDoc.data() as ContentPreview);
        }
      } catch (err) {
        console.error('Error fetching content preview:', err);
      }
    };

    if (open) {
      fetchContent();
    }
  }, [contentId, contentType, open]);

  const handleSubmit = async () => {
    if (!reportType) {
      setError('Please select a report type');
      return;
    }

    if (!description.trim()) {
      setError('Please provide a description');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const reportRef = doc(db, 'reports', contentId);
      await updateDoc(reportRef, {
        reports: arrayUnion({
          type: reportType,
          description: description.trim(),
          contentType,
          timestamp: new Date().toISOString(),
          status: 'pending',
          reviewedBy: null,
          resolution: null,
        }),
      });

      // Create notification for admins
      const notificationRef = doc(db, 'notifications', 'admin');
      await updateDoc(notificationRef, {
        reports: arrayUnion({
          contentId,
          contentType,
          reportType,
          timestamp: new Date().toISOString(),
          status: 'unread',
        }),
      });

      setNotification({
        open: true,
        message: 'Report submitted successfully. Our team will review it shortly.',
      });
      onClose();
    } catch (err) {
      setError('Error submitting report. Please try again.');
    } finally {
      setSubmitting(false);
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
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color="primary"
            disabled={submitting}
          >
            {submitting ? <CircularProgress size={24} /> : 'Submit Report'}
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