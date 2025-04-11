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
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Community Guidelines & Safety
      </Typography>
      
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
                <PsychologyIcon />
              </ListItemIcon>
              <ListItemText
                primary="Mental Health Support"
                secondary="We provide resources and tools to support users' wellbeing"
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
          </List>
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
            or by contacting support@sideeye.com.
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
                primary="How to Report"
                secondary="Click the three dots menu on any post, comment, or profile and select 'Report' to flag content that violates our guidelines"
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
                secondary="If you believe a moderation decision was made in error, you can appeal through your account settings or by contacting support@sideeye.com"
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
                primary="Support Resources"
                secondary="Access to mental health resources, crisis helplines, and support services through our Help Center"
              />
            </ListItem>
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
                secondary="Reach out to our support team at support@sideeye.com for assistance with safety concerns"
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
    </Box>
  );
};

export default SafetyInfo; 