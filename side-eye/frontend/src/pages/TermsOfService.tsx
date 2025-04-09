import React from 'react';
import { Container, Typography, Box, Paper } from '@mui/material';

const TermsOfService: React.FC = () => {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Terms of Service
        </Typography>
        <Typography variant="body1" paragraph>
          Last updated: {new Date().toLocaleDateString()}
        </Typography>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            1. Acceptance of Terms
          </Typography>
          <Typography variant="body1" paragraph>
            By accessing or using SideEye, you agree to be bound by these Terms of Service and all applicable laws and regulations. 
            If you do not agree with any of these terms, you are prohibited from using or accessing this site.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            2. User Accounts
          </Typography>
          <Typography variant="body1" paragraph>
            To use certain features of SideEye, you must create an account. You are responsible for:
          </Typography>
          <ul>
            <li>Maintaining the confidentiality of your account information</li>
            <li>All activities that occur under your account</li>
            <li>Providing accurate and complete information</li>
            <li>Notifying us immediately of any unauthorized use</li>
          </ul>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            3. User Conduct
          </Typography>
          <Typography variant="body1" paragraph>
            You agree not to:
          </Typography>
          <ul>
            <li>Post or transmit any content that is unlawful, harmful, or offensive</li>
            <li>Impersonate any person or entity</li>
            <li>Interfere with the proper functioning of the service</li>
            <li>Attempt to gain unauthorized access to any portion of the service</li>
            <li>Use the service for any illegal purpose</li>
          </ul>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            4. Content Ownership
          </Typography>
          <Typography variant="body1" paragraph>
            You retain ownership of any content you post on SideEye. By posting content, you grant us a worldwide, 
            non-exclusive, royalty-free license to use, reproduce, modify, and distribute your content.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            5. Termination
          </Typography>
          <Typography variant="body1" paragraph>
            We reserve the right to terminate or suspend your account and access to the service at our sole discretion, 
            without notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            6. Disclaimer
          </Typography>
          <Typography variant="body1" paragraph>
            The service is provided "as is" without any warranties, express or implied. We do not guarantee that the service 
            will be uninterrupted, timely, secure, or error-free.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            7. Limitation of Liability
          </Typography>
          <Typography variant="body1" paragraph>
            In no event shall SideEye be liable for any indirect, incidental, special, consequential, or punitive damages 
            arising out of or related to your use of the service.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            8. Changes to Terms
          </Typography>
          <Typography variant="body1" paragraph>
            We reserve the right to modify these Terms at any time. We will notify users of any material changes by posting 
            the new Terms on the service and updating the "Last updated" date.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            9. Contact Information
          </Typography>
          <Typography variant="body1" paragraph>
            If you have any questions about these Terms, please contact us at:
            <br />
            Email: legal@sideeye.com
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default TermsOfService; 