import React from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Security as SecurityIcon,
  Warning as WarningIcon,
  Block as BlockIcon,
  Report as ReportIcon,
  Help as HelpIcon,
  Gavel as GavelIcon,
  VerifiedUser as VerifiedUserIcon,
  BugReport as BugReportIcon,
  Shield as ShieldIcon,
  Psychology as PsychologyIcon,
  Public as PublicIcon,
  PersonOutline as PersonOutlineIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

const SafetyInfo: React.FC = () => {
  return (
    <Box sx={{ mx: 'auto' }}>
      <Typography variant="body1" sx={{ mb: 3 }}>
        These guidelines help ensure SideEye remains a platform where users can express themselves 
        freely while maintaining a respectful and safe environment for all.
      </Typography>

      <Typography variant="body1" sx={{ mb: 3, bgcolor: 'info.light', p: 2, borderRadius: 1 }}>
        <strong>Important Notice:</strong> SideEye uses an AI-powered moderation system that automatically 
        scans all content against our community guidelines. Violations will result in strike points 
        on your account, which can lead to warnings, restrictions, or account suspension. See the 
        "Strike System" section below for more details.
      </Typography>

      <Accordion>
        <AccordionSummary expandIcon={<SecurityIcon />}>
          <Typography>Our Commitment to Safety</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography paragraph>
            We are committed to maintaining a safe and respectful environment for all users.
            Our platform encourages healthy banter and shade while strictly prohibiting
            harassment, bullying, harmful content, misinformation, fraud, and cybercrime.
          </Typography>
          <Typography paragraph>
            We believe in:
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <ShieldIcon />
              </ListItemIcon>
              <ListItemText
                primary="Protecting User Privacy"
                secondary="We implement strict data protection measures and transparent privacy policies"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <PublicIcon />
              </ListItemIcon>
              <ListItemText
                primary="Inclusive Community"
                secondary="We foster an environment that welcomes diverse perspectives and experiences"
              />
            </ListItem>
          </List>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<WarningIcon />}>
          <Typography>Prohibited Content</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography paragraph>
            The following content is not permitted on our platform and may result in content removal, account restrictions, or termination:
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <BlockIcon />
              </ListItemIcon>
              <ListItemText
                primary="Harassment & Bullying"
                secondary="Targeted attacks, threats, persistent unwanted attention, or content designed to degrade or shame others"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <BlockIcon />
              </ListItemIcon>
              <ListItemText
                primary="Hate Speech"
                secondary="Content that promotes discrimination, hostility, or violence against protected characteristics including race, ethnicity, national origin, religious affiliation, sexual orientation, gender, gender identity, or disability"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <BlockIcon />
              </ListItemIcon>
              <ListItemText
                primary="Misinformation"
                secondary="Deliberate spreading of false information about health, science, elections, or current events that may cause public harm"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <BlockIcon />
              </ListItemIcon>
              <ListItemText
                primary="Fraud & Scams"
                secondary="Financial scams, phishing attempts, pyramid schemes, deceptive business practices, or unauthorized promotions"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <BlockIcon />
              </ListItemIcon>
              <ListItemText
                primary="Cybercrime"
                secondary="Hacking attempts, malware distribution, unauthorized access, or other illegal online activities"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <BlockIcon />
              </ListItemIcon>
              <ListItemText
                primary="Adult Content & Exploitation"
                secondary="Sexually explicit content, non-consensual intimate imagery, sexual exploitation, or content that sexualizes minors"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <BlockIcon />
              </ListItemIcon>
              <ListItemText
                primary="Violence & Gore"
                secondary="Gratuitous violence, content promoting self-harm, suicide, eating disorders, or graphic injury"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <BlockIcon />
              </ListItemIcon>
              <ListItemText
                primary="Copyright Infringement"
                secondary="Content that violates copyright laws, including unauthorized use of intellectual property, especially in Side Rooms or voice content"
              />
            </ListItem>
          </List>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<GavelIcon />}>
          <Typography>Side Room Community Guidelines</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography paragraph>
            Our Side Room audio and video features have specific guidelines to ensure a safe and enjoyable experience for all users:
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <VerifiedUserIcon />
              </ListItemIcon>
              <ListItemText
                primary="Content Ownership"
                secondary="Only share audio and video content that you've created or have permission to use. Respect copyright and intellectual property rights"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <BlockIcon />
              </ListItemIcon>
              <ListItemText
                primary="Appropriate Content"
                secondary="Audio and video content must not contain hate speech, violent language, dangerous activities promotion, or references to illegal substances"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <PersonOutlineIcon />
              </ListItemIcon>
              <ListItemText
                primary="Privacy & Consent"
                secondary="Get consent before recording or sharing conversations with other individuals, especially in private settings"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <InfoIcon />
              </ListItemIcon>
              <ListItemText
                primary="Disclosure"
                secondary="Clearly disclose if your content is sponsored, contains affiliate links, or is otherwise commercial in nature"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <ShieldIcon />
              </ListItemIcon>
              <ListItemText
                primary="Music, Audio and Video"
                secondary="Only use music, audio and video that you have rights to use or that is available through our platform's licensed library"
              />
            </ListItem>
          </List>
          <Typography paragraph>
            Side Room content is subject to both human and AI-powered moderation. Audio and video content that violates these guidelines may be removed,
            and repeated violations may result in account restrictions or termination.
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<GavelIcon />}>
          <Typography>Content Moderation</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography paragraph>
            Our content moderation approach combines technology and human review to enforce our community guidelines fairly and consistently:
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <VerifiedUserIcon />
              </ListItemIcon>
              <ListItemText
                primary="AI-Powered Detection"
                secondary="Advanced algorithms detect harmful content, misinformation, and suspicious activities in real-time"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <BugReportIcon />
              </ListItemIcon>
              <ListItemText
                primary="Automated Checks"
                secondary="Real-time scanning for fraud, cybercrime, and policy violations using pattern recognition"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <PersonOutlineIcon />
              </ListItemIcon>
              <ListItemText
                primary="Human Review"
                secondary="Trained moderators review flagged content and complex cases with cultural and contextual awareness"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <InfoIcon />
              </ListItemIcon>
              <ListItemText
                primary="Educational Approach"
                secondary="First-time or minor violations may result in warnings with educational resources"
              />
            </ListItem>
          </List>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>
            Enforcement Actions
          </Typography>
          <Typography paragraph>
            Depending on the severity and frequency of violations, we may take the following actions:
          </Typography>
          <ul>
            <li>Content removal</li>
            <li>Warning notifications</li>
            <li>Temporary feature restrictions</li>
            <li>Temporary account suspension</li>
            <li>Permanent account termination</li>
          </ul>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<WarningIcon />}>
          <Typography>Strike System</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography paragraph>
            SideEye employs a strike system to enforce our community guidelines fairly and consistently:
          </Typography>
          
          <Typography variant="h6" gutterBottom>
            Strike Points
          </Typography>
          <Typography paragraph>
            Violations of our guidelines result in strike points based on severity:
          </Typography>
          <ul>
            <li><strong>Standard violations:</strong> 1 strike point</li>
            <li><strong>Serious violations</strong> (misinformation, fraud, violence): 1.5 strike points</li>
            <li><strong>Severe violations</strong> (harmful content, cybercrime, exploitation): 2 strike points</li>
          </ul>
          
          <Typography variant="h6" gutterBottom>
            Consequences
          </Typography>
          <Typography paragraph>
            As strike points accumulate, the following actions will be taken:
          </Typography>
          <ul>
            <li><strong>3+ points:</strong> Warning and educational resources</li>
            <li><strong>6+ points:</strong> Temporary feature restrictions for 3 days</li>
            <li><strong>9+ points:</strong> Account suspension for 7 days</li>
            <li><strong>12+ points:</strong> Permanent account suspension</li>
          </ul>
          
          <Typography variant="h6" gutterBottom>
            Appeals
          </Typography>
          <Typography paragraph>
            If you believe a strike was issued in error, you can appeal through your account settings 
            or by contacting support@sideeye.uk.
          </Typography>
          
          <Typography variant="h6" gutterBottom>
            Expiration
          </Typography>
          <Typography paragraph>
            Strike points remain on your account for 6 months before beginning to expire.
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ReportIcon />}>
          <Typography>Reporting & Moderation</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography paragraph>
            We rely on our community to help maintain a safe environment. If you encounter content that violates our guidelines, please report it immediately.
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <ReportIcon />
              </ListItemIcon>
              <ListItemText
                primary="Reporting Content"
                secondary="Click the three dots menu on any Side Room, message, or profile and select 'Report' to flag content that violates our guidelines"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <ReportIcon />
              </ListItemIcon>
              <ListItemText
                primary="What Happens Next"
                secondary="Our team reviews reports promptly, typically within 24-48 hours, and takes appropriate action based on our guidelines"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <ReportIcon />
              </ListItemIcon>
              <ListItemText
                primary="Appeals Process"
                secondary="If you believe a moderation decision was made in error, you can appeal through your account settings or by contacting support@sideeye.uk"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <ReportIcon />
              </ListItemIcon>
              <ListItemText
                primary="Transparency"
                secondary="We publish regular reports on content moderation actions and policy enforcement to maintain accountability"
              />
            </ListItem>
          </List>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<HelpIcon />}>
          <Typography>Getting Help</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography paragraph>
            We're committed to supporting our users' wellbeing and safety both on and off the platform.
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <HelpIcon />
              </ListItemIcon>
              <ListItemText
                primary="Safety Tips"
                secondary="Guidelines for protecting your privacy, recognizing potential scams, and staying safe online"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <HelpIcon />
              </ListItemIcon>
              <ListItemText
                primary="Contact Us"
                secondary="Reach out to our support team at support@sideeye.uk for assistance with safety concerns"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <HelpIcon />
              </ListItemIcon>
              <ListItemText
                primary="Emergency Situations"
                secondary="If you're experiencing an emergency or believe someone is in immediate danger, please contact local emergency services immediately"
              />
            </ListItem>
          </List>
          <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic' }}>
            SideEye is committed to continuously improving our safety measures and community guidelines.
            We regularly update our policies based on emerging threats, user feedback, and industry best practices.
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<SecurityIcon />}>
          <Typography> Room + Server Chat</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography paragraph>
            Our Room + Server Chat features have specific guidelines to ensure a safe and enjoyable experience for all users:
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <ShieldIcon />
              </ListItemIcon>
              <ListItemText
                primary="Content Ownership"
                secondary="You are responsible for the content you post in Room + Server Chat. We do not claim ownership of your content."
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <ShieldIcon />
              </ListItemIcon>
              <ListItemText
                primary="Prohibited Content"
                secondary="You may not post any content that violates our community guidelines, including hate speech, harassment, or harmful content."
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <ShieldIcon />
              </ListItemIcon>
              <ListItemText
                primary="Privacy & Consent"
                secondary="Do not share personal information without consent. Respect user privacy and consent when sharing content."
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <ShieldIcon />
              </ListItemIcon>
              <ListItemText
                primary="Copyright Infringement"
                secondary="Do not post content that infringes on copyright laws. Respect intellectual property rights."
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <ShieldIcon />
              </ListItemIcon>
              <ListItemText
                primary="Reporting & Moderation"
                secondary="If you see content that violates our guidelines, please report it immediately."
              />
            </ListItem>
          </List>
        </AccordionDetails>
      </Accordion>


      <Accordion>
        <AccordionSummary expandIcon={<SecurityIcon />}>
          <Typography>Side Room Security & Privacy</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography paragraph>
            We take the security and privacy of your Side Room audio and video content seriously. Here's how we protect your content:
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <ShieldIcon />
              </ListItemIcon>
              <ListItemText
                primary="Control Over Your Content"
                secondary="You can delete your audio and video content at any time, and you control who can listen, join, and engage with your content"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <PersonOutlineIcon />
              </ListItemIcon>
              <ListItemText
                primary="Privacy Controls"
                secondary="You can set privacy settings for your audio and video content to control who can access it"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <VerifiedUserIcon />
              </ListItemIcon>
              <ListItemText
                primary="Content Protection"
                secondary="We implement measures to prevent unauthorized downloading and redistribution of your audio and video content"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <BugReportIcon />
              </ListItemIcon>
              <ListItemText
                primary="Metadata Stripping"
                secondary="We remove sensitive metadata from audio and video content that could reveal your location or device information"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <BlockIcon />
              </ListItemIcon>
              <ListItemText
                primary="Report & Remove"
                secondary="We provide tools to report audio and video content that violates our guidelines, and we respond quickly to removal requests"
              />
            </ListItem>
          </List>
          <Typography paragraph>
            To enhance your privacy when using Side Rooms:
          </Typography>
          <Box component="ul" sx={{ pl: 2 }}>
            <li>Use private Side Rooms for sensitive discussions</li>
            <li>Review your audio and video settings before starting a room to ensure you're comfortable with all content</li>
            <li>Be cautious about sharing personal information in public Side Rooms</li>
            <li>Familiarize yourself with room moderation controls to manage who can speak</li>
            <li>Report any concerns about privacy violations to our support team</li>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default SafetyInfo; 