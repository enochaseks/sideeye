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
            <li>Audio and video content from Side Rooms</li>
            <li>Connection data (followers, following relationships)</li>
            <li>Messages and communications between users</li>
            <li>Sade AI chat history and interactions</li>
            <li>Server chat history and interactions</li>
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
            <li>Process and deliver messages between users</li>
            <li>Monitor and enforce our community guidelines</li>
            <li>Monitor Sade AI interactions for quality and safety</li>
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
            <li><strong>With Other Users:</strong> Your profile information, Side Rooms activity, and messages are shared with other users according to your privacy settings.</li>
            <li><strong>Service Providers:</strong> We may share information with third-party vendors who provide services on our behalf, including audio processing and AI functionality.</li>
            <li><strong>Server Chat:</strong> We may share your server chat history and interactions with other users in the server.</li>
            <li><strong>AI Development:</strong> We may use anonymized Sade AI interactions to improve our AI systems and services.</li>
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
            <li>Delete audio content from Side Rooms</li>
            <li>Delete server chat history and interactions</li>
            <li>Request deletion of message history</li>
            <li>Request deletion of Sade AI chat history</li>
            <li>Request deletion of server chat history</li>
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
            When you delete content such as Side Room audio/video, messages, or Sade AI interactions, it may remain in our backup systems for a limited time. Deleted content is moved to a temporary storage for 24 hours before permanent deletion, allowing for potential recovery if accidentally deleted. For audio/video content and AI interactions, we may retain non-personally identifiable analytics data even after deletion to improve our services.
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
            9. Audio and Video Content Information
          </Typography>
          <Typography variant="body1" paragraph>
            When you participate in Side Rooms, we collect:
          </Typography>
          <ul>
            <li><strong>Audio Content:</strong> The audio data from your participation</li>
            <li><strong>Video Content:</strong> The video data from your participation</li>
            <li><strong>Metadata:</strong> Information such as duration, timestamps, and participant information</li>
            <li><strong>User Association:</strong> Connection between your account and the audio session</li>
            <li><strong>Engagement Data:</strong> Participation statistics and interaction data</li>
            <li><strong>Device Information:</strong> Information about the device used to participate</li>
          </ul>
          <Typography variant="body1" paragraph>
            We use this information to provide the audio chat services, improve our platform, and ensure quality of service. You maintain control over your audio content and can request deletion at any time, though we may retain anonymized analytics data.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            10. Sade AI Information
          </Typography>
          <Typography variant="body1" paragraph>
            When you interact with Sade AI, we collect and process:
          </Typography>
          <ul>
            <li><strong>Chat Content:</strong> The text of your conversations with Sade AI</li>
            <li><strong>Instructions:</strong> Commands and requests you give to the AI</li>
            <li><strong>Usage Patterns:</strong> How you interact with various AI features</li>
            <li><strong>Search Queries:</strong> Web searches performed through the AI</li>
          </ul>
          <Typography variant="body1" paragraph>
            Our team monitors Sade AI chat history for several important purposes:
          </Typography>
          <ul>
            <li>To ensure quality and appropriate AI responses</li>
            <li>To identify and address potential safety concerns</li>
            <li>To improve the AI's understanding and functionality</li>
            <li>To enforce our platform guidelines and prevent misuse</li>
            <li>To develop new features based on common user needs</li>
          </ul>
          <Typography variant="body1" paragraph>
            This monitoring is essential to maintain the integrity of our AI services and ensure a safe experience for all users. While we respect your privacy, understanding how users interact with Sade AI helps us improve the service for everyone.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            11. Children's Privacy
          </Typography>
          <Typography variant="body1" paragraph>
            Our services are not intended for use by children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us at support@sideeye.uk.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            12. Changes to This Policy
          </Typography>
          <Typography variant="body1" paragraph>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            13. Contact Us
          </Typography>
          <Typography variant="body1" paragraph>
            If you have any questions about this Privacy Policy, please contact us at:
            <br />
            Email: support@sideeye.uk
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default PrivacyPolicy; 