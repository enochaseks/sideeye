import React, { useState, useEffect } from 'react';
import { 
  Snackbar, 
  Button, 
  Box, 
  Typography, 
  Alert,
  Slide,
  SlideProps,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton
} from '@mui/material';
import UpdateIcon from '@mui/icons-material/Update';
import CloseIcon from '@mui/icons-material/Close';
import { 
  checkForUpdate, 
  applyUpdate, 
  skipVersion, 
  CHECK_INTERVAL,
  VersionInfo
} from '../utils/versionChecker';

type TransitionProps = Omit<SlideProps, 'direction'>;

const SlideTransition = (props: TransitionProps) => {
  return <Slide {...props} direction="up" />;
};

const UpdateNotification: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [showDetails, setShowDetails] = useState<boolean>(false);

  // Function to check for updates
  const handleCheckForUpdates = async () => {
    try {
      const result = await checkForUpdate();
      
      if (result.updateAvailable && result.newVersion) {
        console.log('New version available:', result.newVersion.version);
        setVersionInfo(result.newVersion);
        setUpdateAvailable(true);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  };

  // Function to handle update click
  const handleUpdate = () => {
    if (versionInfo) {
      applyUpdate(versionInfo.version);
    }
  };

  // Function to skip this version
  const handleSkip = () => {
    if (versionInfo) {
      skipVersion(versionInfo.version);
      setUpdateAvailable(false);
      setShowDetails(false);
    }
  };

  // Function to show details dialog
  const handleShowDetails = () => {
    setShowDetails(true);
  };

  // Function to close details dialog
  const handleCloseDetails = () => {
    setShowDetails(false);
  };

  // Check for updates on component mount
  useEffect(() => {
    handleCheckForUpdates();
    
    // Set up periodic checks
    const interval = setInterval(handleCheckForUpdates, CHECK_INTERVAL);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Update Notification Snackbar */}
      <Snackbar
        open={updateAvailable}
        TransitionComponent={SlideTransition}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ 
          mb: { xs: 7, sm: 2 }, // Adjust based on bottom nav presence
          zIndex: 1400
        }}
      >
        <Alert 
          severity="info" 
          variant="filled"
          sx={{ 
            width: '100%',
            borderRadius: 2,
            boxShadow: 3
          }}
          icon={<UpdateIcon />}
          action={
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Button 
                color="inherit" 
                size="small"
                onClick={handleShowDetails}
                sx={{ mr: 1 }}
              >
                Details
              </Button>
              <Button 
                color="inherit" 
                size="small" 
                variant="outlined"
                onClick={handleUpdate}
                sx={{ 
                  fontWeight: 'bold',
                }}
              >
                Update Now
              </Button>
            </Box>
          }
        >
          <Typography variant="body2">
            A new version of SideEye is available
          </Typography>
        </Alert>
      </Snackbar>

      {/* Update Details Dialog */}
      <Dialog
        open={showDetails}
        onClose={handleCloseDetails}
        aria-labelledby="update-dialog-title"
        aria-describedby="update-dialog-description"
        PaperProps={{
          sx: {
            borderRadius: 2,
            width: '100%',
            maxWidth: 500
          }
        }}
      >
        <DialogTitle id="update-dialog-title" sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <UpdateIcon sx={{ mr: 1, color: 'primary.main' }} />
              New Update Available
            </Box>
            <IconButton
              aria-label="close"
              onClick={handleCloseDetails}
              sx={{ ml: 2 }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {versionInfo && (
            <>
              <DialogContentText sx={{ mb: 2 }}>
                SideEye has been updated to version {versionInfo.version}
              </DialogContentText>
              
              <Typography variant="subtitle2" gutterBottom>
                What's New:
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, whiteSpace: 'pre-line' }}>
                {versionInfo.releaseNotes || 'Bug fixes and performance improvements'}
              </Typography>
              
              <Typography variant="body2" color="text.secondary">
                Updates help improve security, stability, and provide new features.
                {versionInfo.requiredUpdate && 
                  ' This update is required to continue using the app.'}
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          {!versionInfo?.requiredUpdate && (
            <Button onClick={handleSkip} color="inherit">
              Skip This Version
            </Button>
          )}
          <Button onClick={handleCloseDetails} color="inherit">
            Later
          </Button>
          <Button 
            onClick={handleUpdate} 
            variant="contained" 
            color="primary"
            startIcon={<UpdateIcon />}
          >
            Update Now
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default UpdateNotification; 