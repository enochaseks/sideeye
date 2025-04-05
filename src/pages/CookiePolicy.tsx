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
            What Are Cookies
          </Typography>
          <Typography variant="body1" paragraph>
            Cookies are small text files that are placed on your computer or mobile device when you visit a website. 
            They are widely used to make websites work more efficiently and provide useful information to website owners.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            How We Use Cookies
          </Typography>
          <Typography variant="body1" paragraph>
            We use cookies for the following purposes:
          </Typography>
          <ul>
            <li>Essential cookies: Required for the website to function properly</li>
            <li>Authentication cookies: To keep you logged in</li>
            <li>Preference cookies: To remember your settings and preferences</li>
            <li>Analytics cookies: To understand how visitors use our website</li>
            <li>Marketing cookies: To deliver relevant advertisements</li>
          </ul>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Types of Cookies We Use
          </Typography>
          <Typography variant="body1" paragraph>
            <strong>1. Essential Cookies</strong>
            <br />
            These cookies are necessary for the website to function and cannot be switched off. They are usually only set in 
            response to actions made by you, such as setting your privacy preferences or filling in forms.
          </Typography>
          <Typography variant="body1" paragraph>
            <strong>2. Performance Cookies</strong>
            <br />
            These cookies allow us to count visits and traffic sources so we can measure and improve the performance of our site.
          </Typography>
          <Typography variant="body1" paragraph>
            <strong>3. Functionality Cookies</strong>
            <br />
            These cookies enable the website to provide enhanced functionality and personalization.
          </Typography>
          <Typography variant="body1" paragraph>
            <strong>4. Targeting Cookies</strong>
            <br />
            These cookies may be set through our site by our advertising partners to build a profile of your interests.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Managing Cookies
          </Typography>
          <Typography variant="body1" paragraph>
            You can control and/or delete cookies as you wish. You can delete all cookies that are already on your computer 
            and you can set most browsers to prevent them from being placed. If you do this, however, you may have to manually 
            adjust some preferences every time you visit a site and some services and functionalities may not work.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Third-Party Cookies
          </Typography>
          <Typography variant="body1" paragraph>
            Some cookies are placed by third-party services that appear on our pages. We have no control over these cookies 
            and they are subject to the privacy policies of the respective third parties.
          </Typography>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Updates to This Policy
          </Typography>
          <Typography variant="body1" paragraph>
            We may update this Cookie Policy from time to time. We will notify you of any changes by posting the new Cookie 
            Policy on this page and updating the "Last updated" date.
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