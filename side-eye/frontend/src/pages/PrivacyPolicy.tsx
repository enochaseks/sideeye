import React from 'react';
import { Container, Typography, Box, Paper } from '@mui/material';

const PrivacyPolicy: React.FC = () => {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Privacy Policy
        </Typography>
        <Typography variant="body1" paragraph>
          Last updated: {new Date().toLocaleDateString()}
        </Typography>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            1. Information We Collect
          </Typography>
          <Typography variant="body1" paragraph>
            We collect information that you provide directly to us, including:
          </Typography>
          <ul>
            <li>Account information (username, email, display name)</li>
            <li>Profile information (bio, profile picture)</li>
            <li>Content you post (comments, posts, messages)</li>
            <li>Communication preferences</li>
          </ul>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            2. How We Use Your Information
          </Typography>
          <Typography variant="body1" paragraph>
            We use the information we collect to:
          </Typography>
          <ul>
            <li>Provide and maintain our services</li>
            <li>Improve and personalize your experience</li>
            <li>Communicate with you about updates and changes</li>
            <li>Ensure platform safety and security</li>
            <li>Comply with legal obligations</li>
          </ul>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            3. Data Security
          </Typography>
          <Typography variant="body1" paragraph>
            We implement appropriate security measures to protect your personal information. However, no method of transmission over the internet is 100% secure.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            4. Your Rights
          </Typography>
          <Typography variant="body1" paragraph>
            You have the right to:
          </Typography>
          <ul>
            <li>Access your personal information</li>
            <li>Correct inaccurate information</li>
            <li>Request deletion of your information</li>
            <li>Opt-out of marketing communications</li>
          </ul>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            5. Cookies and Tracking
          </Typography>
          <Typography variant="body1" paragraph>
            We use cookies and similar tracking technologies to improve your experience and analyze usage patterns.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            6. Contact Us
          </Typography>
          <Typography variant="body1" paragraph>
            If you have any questions about this Privacy Policy, please contact us at:
            <br />
            Email: privacy@sideeye.com
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default PrivacyPolicy; 