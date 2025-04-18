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
            <li>Profile information (bio, profile picture, custom avatars)</li>
            <li>Content you post (posts, comments, likes, reposts)</li>
            <li>Videos you upload to Vibits (including metadata and engagement data)</li>
            <li>Connection data (followers, following relationships)</li>
            <li>Messages and communications between users</li>
            <li>Usage information and interaction with the platform</li>
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
            <li>Facilitate connections between users</li>
            <li>Display relevant content in your feed</li>
            <li>Process and deliver messages between users</li>
            <li>Recommend relevant videos in Vibits based on your preferences</li>
            <li>Monitor and enforce our community guidelines</li>
            <li>Communicate with you about updates and changes</li>
            <li>Ensure platform safety and security</li>
            <li>Comply with legal obligations</li>
          </ul>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            3. Sharing Your Information
          </Typography>
          <Typography variant="body1" paragraph>
            We may share your information in the following ways:
          </Typography>
          <ul>
            <li><strong>With Other Users:</strong> Your profile information, posts, videos, and content are shared with other users according to your privacy settings.</li>
            <li><strong>Service Providers:</strong> We may share information with third-party vendors who provide services on our behalf, including video hosting and processing.</li>
            <li><strong>Legal Requirements:</strong> We may disclose information if required by law or to protect rights, safety, and security.</li>
            <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets.</li>
          </ul>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            4. Data Security
          </Typography>
          <Typography variant="body1" paragraph>
            We implement appropriate security measures to protect your personal information, including encryption of sensitive data, secure storage protocols, and regular security audits. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            5. Your Rights
          </Typography>
          <Typography variant="body1" paragraph>
            You have the right to:
          </Typography>
          <ul>
            <li>Access your personal information</li>
            <li>Correct inaccurate information</li>
            <li>Delete your account and associated data</li>
            <li>Delete videos you've uploaded to Vibits</li>
            <li>Control your privacy settings and follower relationships</li>
            <li>Restrict processing of your information</li>
            <li>Request a data export of your content</li>
            <li>Opt-out of marketing communications</li>
          </ul>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            6. Content Removal and Retention
          </Typography>
          <Typography variant="body1" paragraph>
            When you delete content, it may remain in our backup systems for a limited time. Deleted content is moved to a temporary storage for 24 hours before permanent deletion, allowing for potential recovery if accidentally deleted. For Vibits videos, we may retain non-personally identifiable analytics data even after video deletion.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            7. Cookies and Tracking
          </Typography>
          <Typography variant="body1" paragraph>
            We use cookies and similar tracking technologies to improve your experience, maintain login sessions, and analyze usage patterns. Please see our Cookie Policy for more details on how we use these technologies.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            8. Third-Party Links
          </Typography>
          <Typography variant="body1" paragraph>
            Our service may contain links to third-party websites or services that are not owned or controlled by us. We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party services.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            9. Vibits Video Information
          </Typography>
          <Typography variant="body1" paragraph>
            When you upload videos to Vibits, we collect:
          </Typography>
          <ul>
            <li><strong>Video Content:</strong> The actual video file you upload</li>
            <li><strong>Metadata:</strong> Information such as upload time, duration, and format</li>
            <li><strong>User Association:</strong> Connection between your account and the video</li>
            <li><strong>Engagement Data:</strong> Likes, comments, shares, and viewing statistics</li>
            <li><strong>Device Information:</strong> Information about the device used to upload the video</li>
          </ul>
          <Typography variant="body1" paragraph>
            We use this information to provide the Vibits service, recommend videos to other users, and improve our platform. You maintain ownership of your videos and can delete them at any time, though we may retain anonymized analytics data.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            10. Children's Privacy
          </Typography>
          <Typography variant="body1" paragraph>
            Our services are not intended for use by children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            11. Changes to This Policy
          </Typography>
          <Typography variant="body1" paragraph>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            12. Contact Us
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