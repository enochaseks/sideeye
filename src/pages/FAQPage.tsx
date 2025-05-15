import React from 'react';
import { 
  Container, 
  Box, 
  Typography, 
  Paper, 
  List, 
  ListItem, 
  ListItemIcon, 
  Divider, 
  useTheme 
} from '@mui/material';
import { HelpOutline as HelpOutlineIcon } from '@mui/icons-material';

const FAQPage: React.FC = () => {
  const theme = useTheme();

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 'bold' }}>
          Frequently Asked Questions
        </Typography>
        <Paper elevation={0} sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
          <List disablePadding>
            <ListItem alignItems="flex-start" sx={{ flexDirection: 'column', py: 2 }} id="source-code-faq">
              <Box sx={{ width: '100%', display: 'flex', alignItems: 'center' }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <HelpOutlineIcon />
                </ListItemIcon>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  Why do I need to set up a source code?
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ pl: 6, mt: 1 }}>
                The source code is an essential security feature that protects your account from unauthorized access. 
                When you set up a source code, it gets registered with your current device. If you log in from a new device, 
                you'll need to enter this code to verify your identity. This additional layer of security ensures that 
                even if someone obtains your email and password, they still cannot access your account without the source code. 
                Think of it as a permanent device-specific two-factor authentication that only you know.
              </Typography>
            </ListItem>
            
            <Divider />
            
            <ListItem alignItems="flex-start" sx={{ flexDirection: 'column', py: 2 }}>
              <Box sx={{ width: '100%', display: 'flex', alignItems: 'center' }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <HelpOutlineIcon />
                </ListItemIcon>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  Why can't I reset my source code?
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ pl: 6, mt: 1 }}>
                We intentionally don't provide an option to reset your source code due to cybersecurity concerns. 
                Hackers who target accounts typically already know information like email addresses and may have access to 
                compromised passwords. They often exploit password reset mechanisms to gain unauthorized access. 
                By making the source code permanent and non-resettable, we create a significant barrier against these attacks. 
                Your source code is stored securely in your settings page - please make sure to remember it or securely 
                record it for future device logins. This design protects your account even if other credentials are compromised.
              </Typography>
            </ListItem>
            
            <Divider />
            
            <ListItem alignItems="flex-start" sx={{ flexDirection: 'column', py: 2 }}>
              <Box sx={{ width: '100%', display: 'flex', alignItems: 'center' }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <HelpOutlineIcon />
                </ListItemIcon>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  What should I do if I forget my source code?
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ pl: 6, mt: 1 }}>
                Since the source code cannot be reset for security reasons, it's vital that you remember it or store it securely. 
                We recommend writing it down in a secure location or using a trusted password manager. 
                As long as you continue using the same device, you won't need to re-enter your source code frequently. 
                However, for new device logins, you'll need this code to access your account. Remember, this strict 
                security measure is in place to protect your account from unauthorized access.
              </Typography>
            </ListItem>
            
            <Divider />
            
            <ListItem alignItems="flex-start" sx={{ flexDirection: 'column', py: 2 }}>
              <Box sx={{ width: '100%', display: 'flex', alignItems: 'center' }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <HelpOutlineIcon />
                </ListItemIcon>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  Setting Up Your Source Code
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ pl: 6, mt: 1 }}>
                When setting up your source code, make sure it is 8 characters long. Do not make your source code your birthday or an easy number like 1111111 or 12345678.
                Your source code should be something you can remember and not easily guessable.
              </Typography>
            </ListItem>
            
            <Divider />
            
            <ListItem alignItems="flex-start" sx={{ flexDirection: 'column', py: 2 }}>
              <Box sx={{ width: '100%', display: 'flex', alignItems: 'center' }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <HelpOutlineIcon />
                </ListItemIcon>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  How do I view my source code?
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ pl: 6, mt: 1 }}>
                You can view your source code by going to Settings and selecting "View Source Code". 
                For security purposes, you'll need to enter your source code to verify your identity.
                Keep your source code safe and private - you'll need it when logging in from a new device.
              </Typography>
            </ListItem>
            
            <Divider />
            
            <ListItem alignItems="flex-start" sx={{ flexDirection: 'column', py: 2 }}>
              <Box sx={{ width: '100%', display: 'flex', alignItems: 'center' }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <HelpOutlineIcon />
                </ListItemIcon>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  What is my source code used for?
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ pl: 6, mt: 1 }}>
                Your source code is the 8-digit security code you created during account setup. This is the only code you'll need to remember.
                You'll use this code when logging in from new devices as an additional security measure.
                Think of it as a permanent device-specific two-factor authentication that only you know.
              </Typography>
            </ListItem>
          </List>
        </Paper>
      </Box>
    </Container>
  );
};

export default FAQPage; 