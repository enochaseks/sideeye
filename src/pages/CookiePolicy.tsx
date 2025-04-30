import React from 'react';
import { Container, Typography, Box, Paper } from '@mui/material';

const CookiePolicy: React.FC = () => {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Cookie Policy
        </Typography>
        <Typography variant="body1" paragraph>
          Last updated: {new Date().toLocaleDateString()}
        </Typography>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Introduction
          </Typography>
          <Typography variant="body1" paragraph>
            We use cookies and similar technologies to provide, improve, and secure our services. This Cookie Policy explains 
            how we use cookies, what types we use, their purposes, and how you can control them. These technologies help us 
            deliver our audio-based features, including Side Rooms and Spaces, and ensure a smooth user experience.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            What Are Cookies?
          </Typography>
          <Typography variant="body1" paragraph>
            Cookies are small text files that are stored on your device when you visit a website. They are widely used to make 
            websites work more efficiently and provide information to the website owners. Cookies can be "persistent" or "session" 
            cookies. Persistent cookies remain on your device after you close your browser, while session cookies are deleted 
            when you close your browser.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Types of Cookies We Use
          </Typography>
          <Typography variant="body1" paragraph>
            We use the following types of cookies for the purposes explained below:
          </Typography>
          
          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            1. Essential Cookies
          </Typography>
          <Typography variant="body1" paragraph>
            These cookies are necessary for the functioning of our platform and cannot be switched off. They include:
          </Typography>
          <ul>
            <li>Authentication cookies to recognize you when you log in</li>
            <li>Security cookies to prevent fraudulent activities</li>
            <li>Session cookies to maintain your active session</li>
          </ul>
          
          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            2. Performance Cookies
          </Typography>
          <Typography variant="body1" paragraph>
            These cookies help us understand how visitors interact with our platform by collecting information anonymously. They include:
          </Typography>
          <ul>
            <li>Analytics cookies to measure user interactions with content</li>
            <li>Error monitoring cookies to identify and fix platform issues</li>
            <li>Load balancing cookies to distribute traffic to our servers</li>
            <li>Audio quality monitoring cookies to ensure optimal performance</li>
          </ul>
          
          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            3. Functional Cookies
          </Typography>
          <Typography variant="body1" paragraph>
            These cookies enable enhanced functionality and personalization. They include:
          </Typography>
          <ul>
            <li>Preference cookies to remember your settings and choices</li>
            <li>Interface customization cookies for personalized layouts</li>
            <li>Language preference cookies</li>
          </ul>
          
          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            4. Targeting/Advertising Cookies
          </Typography>
          <Typography variant="body1" paragraph>
            These cookies may be set through our site by our advertising partners to build a profile of your interests. They include:
          </Typography>
          <ul>
            <li>Social media cookies for content sharing and network integration</li>
            <li>Recommendation cookies to suggest relevant content</li>
          </ul>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Specific Cookies Used by SideEye
          </Typography>
          <Typography variant="body1" paragraph>
            Below are some of the key cookies we use on SideEye:
          </Typography>
          <ul>
            <li><strong>sideeye_session</strong>: Authentication and session management</li>
            <li><strong>sideeye_preferences</strong>: Stores user preferences like theme and layout settings</li>
            <li><strong>sideeye_auth</strong>: Maintains login state and authentication details</li>
            <li><strong>sideeye_analytics</strong>: Collects anonymous usage data to improve our services</li>
            <li><strong>sideeye_audio</strong>: Stores audio quality preferences and device settings</li>
          </ul>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Third-Party Cookies
          </Typography>
          <Typography variant="body1" paragraph>
            We may allow third parties to place cookies on your device when you visit our platform. These third parties include:
          </Typography>
          <ul>
            <li><strong>Analytics providers</strong> (such as Google Analytics) to help us understand user behavior</li>
            <li><strong>Social media platforms</strong> (such as Twitter, Facebook) when you use social sharing features</li>
            <li><strong>Security services</strong> to protect against malicious activities</li>
          </ul>
          <Typography variant="body1" paragraph>
            These third parties may use cookies, web beacons, and similar technologies to collect information about your use of 
            our platform and other websites. We do not control these third-party technologies and their use is governed by the 
            privacy policies of these third parties.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Managing Your Cookie Preferences
          </Typography>
          <Typography variant="body1" paragraph>
            You can control and/or delete cookies as you wish. You can delete all cookies that are already on your device and 
            you can set most browsers to prevent them from being placed. However, if you do this, you may have to manually 
            adjust some preferences every time you visit our platform, and some services and functionalities may not work.
          </Typography>
          <Typography variant="body1" paragraph>
            You can manage your cookie preferences through your browser settings:
          </Typography>
          <ul>
            <li>Chrome: Settings {'->'} Privacy and Security {'->'} Cookies and other site data</li>
            <li>Firefox: Options {'->'} Privacy & Security {'->'} Cookies and Site Data</li>
            <li>Safari: Preferences {'->'} Privacy {'->'} Cookies and website data</li>
            <li>Edge: Settings {'->'} Cookies and site permissions {'->'} Cookies and site data</li>
          </ul>
          <Typography variant="body1" paragraph>
            For more information about cookies and how to disable them, please visit www.allaboutcookies.org
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Do Not Track
          </Typography>
          <Typography variant="body1" paragraph>
            Some browsers have a "Do Not Track" feature that signals to websites that you visit that you do not want to have 
            your online activity tracked. Given the diverse and evolving state of "Do Not Track" implementations, we may or 
            may not respond to "Do Not Track" signals.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Changes to Our Cookie Policy
          </Typography>
          <Typography variant="body1" paragraph>
            We may update our Cookie Policy from time to time. Any changes will be posted on this page with an updated revision date.
            We encourage you to review this Cookie Policy periodically to stay informed about our use of cookies.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Contact Us
          </Typography>
          <Typography variant="body1" paragraph>
            If you have any questions about our use of cookies, please contact us at:
            <br />
            Email: privacy@sideeye.com
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default CookiePolicy; 