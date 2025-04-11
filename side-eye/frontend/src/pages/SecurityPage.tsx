import React from 'react';
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
  Alert
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
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';

const SecurityPage: React.FC = () => {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon color="primary" /> Security & Authentication
        </Typography>

        <Alert severity="info" sx={{ mt: 2, mb: 4 }}>
          SideEye takes your security and privacy seriously. Our multi-layer authentication system helps protect your account and data from unauthorized access.
        </Alert>

        <Box sx={{ mb: 5 }}>
          <Typography variant="h5" gutterBottom sx={{ color: 'primary.main', fontWeight: 'medium' }}>
            Authentication Flow
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <Typography variant="body1" paragraph>
            SideEye uses a multi-layer authentication system to ensure your account remains secure:
          </Typography>
          
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
            
            <ListItem>
              <ListItemIcon>
                <DevicesIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Step 4: Device Registration" 
                secondary="Each device you use is registered to your account, allowing you to monitor and manage access."
              />
            </ListItem>
          </List>
          
          <Typography variant="body1" sx={{ mt: 2, fontStyle: 'italic' }}>
            This layered approach provides robust security while maintaining a smooth user experience for legitimate account access.
          </Typography>
        </Box>

        <Box sx={{ mb: 5 }}>
          <Typography variant="h5" gutterBottom sx={{ color: 'primary.main', fontWeight: 'medium' }}>
            Source Code Security
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <Typography variant="body1" paragraph>
            Your Source Code is a personal 8-digit number that acts as a second factor of authentication:
          </Typography>
          
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <VpnKeyIcon fontSize="small" /> What is the Source Code?
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                The Source Code is an 8-digit number that you create during account setup. It functions as a second factor of authentication, 
                adding an extra layer of security beyond your password.
              </Typography>
              <Typography variant="body2">
                Even if someone obtains your email and password, they would still need your Source Code to access your account from a new device.
              </Typography>
            </AccordionDetails>
          </Accordion>
          
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShieldIcon fontSize="small" /> How Your Source Code is Protected
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                Your Source Code is never stored in plain text. We use bcrypt, a powerful one-way hashing algorithm, to securely store your code:
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary="• The Source Code is hashed with a unique salt before storage" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="• Even our administrators cannot see your actual Source Code" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="• In the case of a data breach, your Source Code remains protected" />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>
          
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon fontSize="small" color="warning" /> Lost Source Code
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                If you forget your Source Code, you'll need to reset it through the "Forgot Source Code" process:
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary="1. You'll need to verify your identity through your email" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="2. After verification, you can set a new Source Code" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="3. All previously registered devices will need to re-authenticate with the new code" />
                </ListItem>
              </List>
              <Alert severity="warning" sx={{ mt: 1 }}>
                For security reasons, resetting your Source Code will log you out of all devices.
              </Alert>
            </AccordionDetails>
          </Accordion>
        </Box>

        <Box sx={{ mb: 5 }}>
          <Typography variant="h5" gutterBottom sx={{ color: 'primary.main', fontWeight: 'medium' }}>
            Device Registration
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <Typography variant="body1" paragraph>
            SideEye uses device registration to provide seamless access while maintaining security:
          </Typography>
          
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DevicesIcon fontSize="small" /> How Device Registration Works
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                When you log in to SideEye from a new device, the following happens:
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary="1. A unique device ID is generated for your device" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="2. You must enter your Source Code to authorize the device" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="3. Once verified, the device is registered to your account" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="4. Future logins from this device will only require your password" />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>
          
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LockIcon fontSize="small" /> Managing Your Devices
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                You can manage your registered devices through your account settings:
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary="• View all devices currently registered to your account" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="• See when each device was last active" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="• Remove devices you no longer use" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="• Force-logout from suspicious devices" />
                </ListItem>
              </List>
              <Alert severity="info" sx={{ mt: 1 }}>
                Regularly reviewing your connected devices is recommended as a security best practice.
              </Alert>
            </AccordionDetails>
          </Accordion>
          
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
        </Box>

        <Box>
          <Typography variant="h5" gutterBottom sx={{ color: 'primary.main', fontWeight: 'medium' }}>
            Security Recommendations
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <List>
            <ListItem>
              <ListItemIcon>
                <ShieldIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Choose a Strong Password" 
                secondary="Use a unique password that's at least 12 characters long with a mix of letters, numbers, and symbols."
              />
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                <ShieldIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Protect Your Source Code" 
                secondary="Never share your Source Code with anyone, and don't use easily guessable numbers like birthdays."
              />
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                <ShieldIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Review Connected Devices" 
                secondary="Regularly check and remove unfamiliar or unused devices from your account."
              />
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                <ShieldIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Be Alert to Phishing" 
                secondary="SideEye will never ask for your Source Code via email, phone, or messaging. Only enter it on the official site."
              />
            </ListItem>
          </List>
          
          <Alert severity="warning" sx={{ mt: 3 }}>
            <Typography variant="body2">
              If you notice any suspicious activity on your account, immediately change your password and Source Code, 
              and contact support at security@sideeye.com.
            </Typography>
          </Alert>
        </Box>
      </Paper>
    </Container>
  );
};

export default SecurityPage; 