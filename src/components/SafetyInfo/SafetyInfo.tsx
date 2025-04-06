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
} from '@mui/icons-material';

const SafetyInfo: React.FC = () => {
  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Community Guidelines & Safety
      </Typography>

      <Accordion>
        <AccordionSummary expandIcon={<SecurityIcon />}>
          <Typography>Our Commitment to Safety</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            We are committed to maintaining a safe and respectful environment for all users.
            Our platform encourages healthy banter and shade while strictly prohibiting
            harassment, bullying, harmful content, misinformation, fraud, and cybercrime.
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<WarningIcon />}>
          <Typography>Prohibited Content</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <List>
            <ListItem>
              <ListItemIcon>
                <BlockIcon />
              </ListItemIcon>
              <ListItemText
                primary="Harassment & Bullying"
                secondary="Targeted attacks, threats, or persistent harassment of any kind"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <BlockIcon />
              </ListItemIcon>
              <ListItemText
                primary="Hate Speech"
                secondary="Content that attacks or incites violence against individuals or groups"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <BlockIcon />
              </ListItemIcon>
              <ListItemText
                primary="Misinformation"
                secondary="Spreading false or misleading information about health, science, or current events"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <BlockIcon />
              </ListItemIcon>
              <ListItemText
                primary="Fraud & Scams"
                secondary="Financial scams, phishing attempts, or deceptive business practices"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <BlockIcon />
              </ListItemIcon>
              <ListItemText
                primary="Cybercrime"
                secondary="Hacking attempts, malware distribution, or other illegal online activities"
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
          <List>
            <ListItem>
              <ListItemIcon>
                <VerifiedUserIcon />
              </ListItemIcon>
              <ListItemText
                primary="AI-Powered Detection"
                secondary="Advanced algorithms detect harmful content, misinformation, and suspicious activities"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <BugReportIcon />
              </ListItemIcon>
              <ListItemText
                primary="Automated Checks"
                secondary="Real-time scanning for fraud, cybercrime, and policy violations"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <ReportIcon />
              </ListItemIcon>
              <ListItemText
                primary="User Reports"
                secondary="Community-driven reporting system for suspicious content"
              />
            </ListItem>
          </List>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ReportIcon />}>
          <Typography>Reporting & Moderation</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <List>
            <ListItem>
              <ListItemIcon>
                <ReportIcon />
              </ListItemIcon>
              <ListItemText
                primary="How to Report"
                secondary="Click the report button on any content that violates our guidelines"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <ReportIcon />
              </ListItemIcon>
              <ListItemText
                primary="Moderation Process"
                secondary="Reports are reviewed by our team and appropriate action is taken"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <ReportIcon />
              </ListItemIcon>
              <ListItemText
                primary="Appeals Process"
                secondary="Users can appeal moderation decisions through our support system"
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
          <List>
            <ListItem>
              <ListItemIcon>
                <HelpIcon />
              </ListItemIcon>
              <ListItemText
                primary="Support Resources"
                secondary="Access to mental health resources and support services"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <HelpIcon />
              </ListItemIcon>
              <ListItemText
                primary="Safety Tips"
                secondary="Guidelines for staying safe online and protecting your account"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <HelpIcon />
              </ListItemIcon>
              <ListItemText
                primary="Contact Us"
                secondary="Reach out to our support team for assistance"
              />
            </ListItem>
          </List>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default SafetyInfo; 