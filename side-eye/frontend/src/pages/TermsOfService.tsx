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
            <li>Providing accurate and complete profile information</li>
            <li>Securing your login credentials</li>
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
            <li>Post or transmit any content that is unlawful, harmful, threatening, abusive, harassing, defamatory, vulgar, obscene, or otherwise objectionable</li>
            <li>Harass, bully, intimidate, or stalk other users</li>
            <li>Impersonate any person or entity or falsely state or misrepresent your affiliation with a person or entity</li>
            <li>Interfere with or disrupt the proper functioning of the service or servers</li>
            <li>Attempt to gain unauthorized access to any portion of the service or other systems</li>
            <li>Use the service for any illegal purpose or in violation of any local, state, national, or international law</li>
            <li>Collect or store personal data about other users without their consent</li>
            <li>Create multiple accounts to evade restrictions or limitations</li>
            <li>Engage in spamming, phishing, or other deceptive practices</li>
          </ul>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            4. Content Ownership and License
          </Typography>
          <Typography variant="body1" paragraph>
            You retain ownership of any content you post on SideEye. By posting content, you grant us a worldwide, 
            non-exclusive, royalty-free license (with the right to sublicense) to use, reproduce, process, adapt, modify, 
            publish, transmit, display, and distribute your content in any and all media or distribution methods.
          </Typography>
          <Typography variant="body1" paragraph>
            This license allows us to make your content available to the rest of the world and to let others do the same. 
            The license continues even if you stop using our services, but you can delete content from public view at any time.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            5. Follower Relationships
          </Typography>
          <Typography variant="body1" paragraph>
            SideEye allows users to follow other users and be followed by others. When you follow someone, you'll see their posts 
            and activity on your feed. Users you follow will be able to see that you follow them. Similarly, users who follow you 
            will be visible to you and others. You can unfollow users at any time.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            6. Direct Messages
          </Typography>
          <Typography variant="body1" paragraph>
            SideEye provides a direct messaging feature for users to communicate privately. You are responsible for the 
            content of your messages. While we strive to protect the privacy of your messages, we reserve the right to 
            review content in the case of reported violations. We may take action if messages violate our guidelines.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            7. Content Moderation
          </Typography>
          <Typography variant="body1" paragraph>
            We reserve the right to moderate content posted on our platform. We may remove, restrict, or disable access to any 
            content or account that we determine violates these Terms or our Community Guidelines. Content moderation decisions 
            are made in our sole discretion. Users can appeal moderation decisions through our support channels.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            8. Intellectual Property
          </Typography>
          <Typography variant="body1" paragraph>
            The SideEye service and its original content, features, and functionality are and will remain the exclusive property of 
            SideEye and its licensors. The service is protected by copyright, trademark, and other laws. Our trademarks and trade 
            dress may not be used in connection with any product or service without the prior written consent of SideEye.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            9. Termination
          </Typography>
          <Typography variant="body1" paragraph>
            We reserve the right to terminate or suspend your account and access to the service at our sole discretion, 
            without notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties, 
            or for any other reason. Upon termination, your right to use the service will immediately cease.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            10. Post Removal and Recovery
          </Typography>
          <Typography variant="body1" paragraph>
            When you delete content, it will be moved to a trash area for 24 hours before permanent deletion, allowing for 
            recovery if accidentally deleted. We reserve the right to retain certain information as required by law or for 
            legitimate business purposes.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            11. Disclaimer
          </Typography>
          <Typography variant="body1" paragraph>
            The service is provided "as is" without any warranties, express or implied. We do not guarantee that the service 
            will be uninterrupted, timely, secure, or error-free. We make no warranties or representations about the accuracy 
            or completeness of the content provided by our users.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            12. Limitation of Liability
          </Typography>
          <Typography variant="body1" paragraph>
            In no event shall SideEye be liable for any indirect, incidental, special, consequential, or punitive damages 
            arising out of or related to your use of the service, including but not limited to damages for loss of profits, 
            goodwill, use, data, or other intangible losses.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            13. Indemnification
          </Typography>
          <Typography variant="body1" paragraph>
            You agree to indemnify and hold harmless SideEye and its officers, directors, employees, and agents from any claims, 
            damages, liabilities, costs, or expenses (including reasonable attorney fees) arising from your use of the service 
            or your violation of these Terms.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            14. Changes to Terms
          </Typography>
          <Typography variant="body1" paragraph>
            We reserve the right to modify these Terms at any time. We will notify users of any material changes by posting 
            the new Terms on the service and updating the "Last updated" date. Your continued use of the service after such 
            changes constitutes your acceptance of the new Terms.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            15. Governing Law
          </Typography>
          <Typography variant="body1" paragraph>
            These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which we operate, 
            without regard to its conflict of law provisions.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            16. Contact Information
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