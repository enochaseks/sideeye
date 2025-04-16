import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Switch,
  FormControlLabel,
  Chip,
  Stack
} from '@mui/material';
import {
  Security as SecurityIcon,
  LockOutlined as LockIcon,
  Devices as DevicesIcon,
  Shield as ShieldIcon,
  VerifiedUser as VerifiedUserIcon,
  VpnKey as VpnKeyIcon,
  Login as LoginIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Code as CodeIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useAuth, usePrivacy } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';

const SecurityPage: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const { canViewProfile, canViewContent } = usePrivacy();
  const [isPrivate, setIsPrivate] = useState(false);
  const [securityStatus, setSecurityStatus] = useState({
    emailVerified: false,
    deviceVerified: false,
    lastSecurityUpdate: null
  });

  useEffect(() => {
    if (!currentUser?.uid) return;

    const userRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        setIsPrivate(userData.isPrivate || false);
        
        // Update security status
        setSecurityStatus({
          emailVerified: currentUser.emailVerified || false,
          deviceVerified: userData.sourceCodeSetupComplete || false,
          lastSecurityUpdate: userData.lastSecurityUpdate || null
        });
      }
    });

    return () => unsubscribe();
  }, [currentUser?.uid, currentUser?.emailVerified]);

  const handlePrivacyToggle = async () => {
    if (!currentUser?.uid) return;
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        isPrivate: !isPrivate,
        lastSecurityUpdate: serverTimestamp()
      });
      toast.success(`Account is now ${!isPrivate ? 'private' : 'public'}`);
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      toast.error('Failed to update privacy settings');
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon color="primary" /> Security & Authentication
        </Typography>

        <Alert severity="info" sx={{ mt: 2, mb: 4 }}>
          SideEye takes your security and privacy seriously. Our multi-layer authentication system helps protect your account and data from unauthorized access.
        </Alert>

        {/* Security Status */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom sx={{ color: 'primary.main', fontWeight: 'medium' }}>
            Security Status
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            <Chip
              icon={securityStatus.emailVerified ? <CheckCircleIcon /> : <ErrorIcon />}
              label={securityStatus.emailVerified ? "Email Verified" : "Email Not Verified"}
              color={securityStatus.emailVerified ? "success" : "error"}
              variant="outlined"
            />
            <Chip
              icon={securityStatus.deviceVerified ? <CheckCircleIcon /> : <ErrorIcon />}
              label={securityStatus.deviceVerified ? "Device Verified" : "Device Not Verified"}
              color={securityStatus.deviceVerified ? "success" : "error"}
              variant="outlined"
            />
          </Stack>
        </Box>

        {/* Account Privacy */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom sx={{ color: 'primary.main', fontWeight: 'medium' }}>
            Account Privacy
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <Paper elevation={1} sx={{ p: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={isPrivate}
                  onChange={handlePrivacyToggle}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="subtitle1">Private Account</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {isPrivate 
                      ? 'Only approved followers can see your content' 
                      : 'Anyone can see your content'}
                  </Typography>
                </Box>
              }
            />
            
            <Alert severity="info" sx={{ mt: 2 }}>
              {isPrivate 
                ? 'When your account is private, only approved followers can see your content. New followers must send a follow request.'
                : 'When your account is public, anyone can see your content and follow you without approval.'}
            </Alert>
          </Paper>
        </Box>

        {/* Authentication Flow */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom sx={{ color: 'primary.main', fontWeight: 'medium' }}>
            Authentication Flow
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <List>
            <ListItem>
              <ListItemIcon>
                <LoginIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Step 1: Email & Password Authentication" 
                secondary="First, you log in with your email and password. This provides the initial layer of account security."
              />
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                <VerifiedUserIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Step 2: Email Verification" 
                secondary="New accounts must verify their email address before gaining full access to all features."
              />
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                <CodeIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Step 3: Source Code Authentication" 
                secondary="When logging in from a new device, you must enter your 8-digit source code as an additional security measure."
              />
            </ListItem>
          </List>
        </Box>

        {/* Browser Privacy Settings */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InfoIcon fontSize="small" /> Browser Privacy Settings
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              Some browsers have strict privacy settings that can affect device registration:
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText 
                  primary="• Safari users may need to enable website data storage" 
                  secondary="Safari > Preferences > Privacy > Website Data"
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="• Private/Incognito browsing may require re-authentication" 
                  secondary="Devices won't be persistently registered in private browsing modes"
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="• Clearing browser data will remove device registration" 
                  secondary="You'll need to re-authenticate with your Source Code"
                />
              </ListItem>
            </List>
          </AccordionDetails>
        </Accordion>
      </Paper>
    </Container>
  );
};

export default SecurityPage; 