import React, { useState } from 'react';
import { 
  Container, 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  Paper, 
  CircularProgress 
} from '@mui/material';
import { SelectChangeEvent } from '@mui/material/Select';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const ReportPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [reportType, setReportType] = useState<string>('');
  const [reportedUser, setReportedUser] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleTypeChange = (event: SelectChangeEvent) => {
    setReportType(event.target.value as string);
    // Clear reportedUser if switching away from 'user' type
    if (event.target.value !== 'user') {
      setReportedUser('');
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser) {
      toast.error('You must be logged in to submit a report.');
      return;
    }
    if (!reportType || !description) {
      toast.error('Please select a report type and provide a description.');
      return;
    }
    if (reportType === 'user' && !reportedUser) {
        toast.error('Please enter the username of the user you are reporting.');
        return;
    }

    setIsSubmitting(true);

    try {
      const reportData: any = {
        reporterUid: currentUser.uid,
        reporterEmail: currentUser.email, // Include email if available
        reportType: reportType,
        description: description,
        timestamp: serverTimestamp(),
        status: 'new' // Initial status
      };

      if (reportType === 'user' && reportedUser) {
        reportData.reportedUsername = reportedUser.startsWith('@') ? reportedUser.substring(1) : reportedUser; // Store username without @ if present
      }

      // Add any other relevant data here (e.g., current page URL, user agent)
      // reportData.contextUrl = window.location.href;

      const docRef = await addDoc(collection(db, 'reports'), reportData);
      console.log("Report submitted with ID: ", docRef.id);
      toast.success('Report submitted successfully. Thank you!');
      // Optionally navigate away or clear the form
      navigate('/settings'); // Navigate back to settings after reporting
      // Clear form state (optional, as navigating away)
      // setReportType('');
      // setReportedUser('');
      // setDescription('');

    } catch (error) {
      console.error("Error submitting report: ", error);
      toast.error('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 4 }, borderRadius: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
          Report an Issue
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Help us keep SideEye safe and running smoothly. Please provide as much detail as possible.
        </Typography>
        
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <FormControl fullWidth margin="normal" required>
            <InputLabel id="report-type-label">Type of Report</InputLabel>
            <Select
              labelId="report-type-label"
              id="report-type"
              value={reportType}
              label="Type of Report"
              onChange={handleTypeChange}
            >
              <MenuItem value=""><em>Select a type...</em></MenuItem>
              <MenuItem value="user">Report a User (Harassment, Abuse, etc.)</MenuItem>
              <MenuItem value="bug">Report a Bug or Technical Issue</MenuItem>
              <MenuItem value="content">Report Inappropriate Content</MenuItem>
              <MenuItem value="other">Other Issue</MenuItem>
            </Select>
          </FormControl>

          {reportType === 'user' && (
            <TextField
              margin="normal"
              required
              fullWidth
              id="reportedUser"
              label="Username of User to Report (e.g., @username)"
              name="reportedUser"
              autoComplete="off"
              value={reportedUser}
              onChange={(e) => setReportedUser(e.target.value)}
            />
          )}

          <TextField
            margin="normal"
            required
            fullWidth
            id="description"
            label="Detailed Description"
            name="description"
            multiline
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            helperText="Please include specific details like what happened, when, and where (if applicable)."
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2, py: 1.5 }}
            disabled={isSubmitting}
          >
            {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Submit Report'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default ReportPage; 