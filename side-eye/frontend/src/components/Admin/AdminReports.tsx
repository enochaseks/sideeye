import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { collection, query, where, getDocs, doc, updateDoc, Firestore } from 'firebase/firestore';
import { db } from '../../services/firebase';

interface Report {
  id: string;
  type: string;
  description: string;
  contentType: string;
  timestamp: string;
  status: 'pending' | 'reviewed' | 'resolved';
  reviewedBy: string | null;
  resolution: string | null;
}

const AdminReports: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [resolution, setResolution] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (db) {
      fetchReports();
    }
  }, [db]);

  const fetchReports = async () => {
    if (!db) return;

    try {
      setLoading(true);
      const reportsRef = collection(db, 'reports');
      const q = query(reportsRef, where('status', '==', 'pending'));
      const querySnapshot = await getDocs(q);

      const reportsData: Report[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        reportsData.push({
          id: doc.id,
          ...data,
        } as Report);
      });

      setReports(reportsData);
    } catch (err) {
      setError('Error fetching reports');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedReport || !resolution || !db) return;

    try {
      setUpdating(true);
      const reportRef = doc(db, 'reports', selectedReport.id);
      await updateDoc(reportRef, {
        status: 'resolved',
        resolution,
        reviewedBy: 'admin', // Replace with actual admin ID
        resolvedAt: new Date().toISOString(),
      });

      setReports(reports.filter((r) => r.id !== selectedReport.id));
      setSelectedReport(null);
      setResolution('');
    } catch (err) {
      setError('Error resolving report');
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'reviewed':
        return 'info';
      case 'resolved':
        return 'success';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Content Reports
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Content Type</TableCell>
              <TableCell>Report Type</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reports.map((report) => (
              <TableRow key={report.id}>
                <TableCell>{report.contentType}</TableCell>
                <TableCell>{report.type}</TableCell>
                <TableCell>{report.description}</TableCell>
                <TableCell>
                  <Chip
                    label={report.status}
                    color={getStatusColor(report.status) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setSelectedReport(report)}
                  >
                    Review
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Review Report</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <Typography variant="subtitle1">
              Content Type: {selectedReport?.contentType}
            </Typography>
            <Typography variant="subtitle1">
              Report Type: {selectedReport?.type}
            </Typography>
            <Typography variant="body1">
              Description: {selectedReport?.description}
            </Typography>
            <TextField
              select
              label="Resolution"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              fullWidth
            >
              <MenuItem value="no_action">No Action Required</MenuItem>
              <MenuItem value="content_removed">Content Removed</MenuItem>
              <MenuItem value="user_warned">User Warned</MenuItem>
              <MenuItem value="user_banned">User Banned</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedReport(null)}>Cancel</Button>
          <Button
            onClick={handleResolve}
            variant="contained"
            disabled={!resolution || updating}
          >
            {updating ? <CircularProgress size={24} /> : 'Resolve'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminReports; 