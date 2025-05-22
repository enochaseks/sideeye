import React, { useState } from 'react';
import { 
  Container, 
  Box, 
  Typography, 
  Paper, 
  List, 
  ListItem, 
  ListItemIcon, 
  Divider, 
  useTheme,
  alpha,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { 
  HelpOutline as HelpOutlineIcon,
  ExpandMore as ExpandMoreIcon 
} from '@mui/icons-material';

const FAQPage: React.FC = () => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<string | false>(false);

  const handleChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 'bold' }}>
          Frequently Asked Questions
        </Typography>
        <Paper elevation={0} sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
          {/* Source Code Section Title */}
          <ListItem sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), py: 1.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Source Code Security
            </Typography>
          </ListItem>
          
          {/* Convert each FAQ item to an Accordion */}
          <Accordion expanded={expanded === 'panel1'} onChange={handleChange('panel1')}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="panel1-content"
              id="panel1-header"
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <HelpOutlineIcon />
                </ListItemIcon>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  Why do I need to set up a source code?
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ pl: 6 }}>
                The source code is an essential security feature that protects your account from unauthorized access. 
                When you set up a source code, it gets registered with your current device. If you log in from a new device, 
                you'll need to enter this code to verify your identity. This additional layer of security ensures that 
                even if someone obtains your email and password, they still cannot access your account without the source code. 
                Think of it as a permanent device-specific two-factor authentication that only you know.
              </Typography>
            </AccordionDetails>
          </Accordion>
          
          <Accordion expanded={expanded === 'panel2'} onChange={handleChange('panel2')}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="panel2-content"
              id="panel2-header"
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <HelpOutlineIcon />
                </ListItemIcon>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  Why can't I reset my source code?
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ pl: 6 }}>
                We intentionally don't provide an option to reset your source code due to cybersecurity concerns. 
                Hackers who target accounts typically already know information like email addresses and may have access to 
                compromised passwords. They often exploit password reset mechanisms to gain unauthorized access. 
                By making the source code permanent and non-resettable, we create a significant barrier against these attacks. 
                Your source code is stored securely in your settings page - please make sure to remember it or securely 
                record it for future device logins. This design protects your account even if other credentials are compromised.
              </Typography>
            </AccordionDetails>
          </Accordion>
          
          <Accordion expanded={expanded === 'panel3'} onChange={handleChange('panel3')}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="panel3-content"
              id="panel3-header"
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <HelpOutlineIcon />
                </ListItemIcon>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  What should I do if I forget my source code?
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ pl: 6 }}>
                Since the source code cannot be reset for security reasons, it's vital that you remember it or store it securely. 
                We recommend writing it down in a secure location or using a trusted password manager. 
                As long as you continue using the same device, you won't need to re-enter your source code frequently. 
                However, for new device logins, you'll need this code to access your account. Remember, this strict 
                security measure is in place to protect your account from unauthorized access.
              </Typography>
            </AccordionDetails>
          </Accordion>
          
          <Accordion expanded={expanded === 'panel4'} onChange={handleChange('panel4')}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="panel4-content"
              id="panel4-header"
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <HelpOutlineIcon />
                </ListItemIcon>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  Setting Up Your Source Code
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ pl: 6 }}>
                When setting up your source code, make sure it is 8 characters long. Do not make your source code your birthday or an easy number like 1111111 or 12345678.
                Your source code should be something you can remember and not easily guessable.
              </Typography>
            </AccordionDetails>
          </Accordion>
          
          <Accordion expanded={expanded === 'panel5'} onChange={handleChange('panel5')}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="panel5-content"
              id="panel5-header"
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <HelpOutlineIcon />
                </ListItemIcon>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  How do I view my source code?
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ pl: 6 }}>
                You can view your source code by going to Settings and selecting "View Source Code". 
                For security purposes, you'll need to enter your source code to verify your identity.
                Keep your source code safe and private - you'll need it when logging in from a new device.
              </Typography>
            </AccordionDetails>
          </Accordion>
          
          <Accordion expanded={expanded === 'panel6'} onChange={handleChange('panel6')}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="panel6-content"
              id="panel6-header"
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <HelpOutlineIcon />
                </ListItemIcon>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  What is my source code used for?
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ pl: 6 }}>
                Your source code is the 8-digit security code you created during account setup. This is the only code you'll need to remember.
                You'll use this code when logging in from new devices as an additional security measure.
                Think of it as a permanent device-specific two-factor authentication that only you know.
              </Typography>
            </AccordionDetails>
          </Accordion>
          
          {/* Room Creation Section Title */}
          <ListItem sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), py: 1.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Room Creation & Management
            </Typography>
          </ListItem>
          
          <Accordion expanded={expanded === 'panel7'} onChange={handleChange('panel7')}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="panel7-content"
              id="panel7-header"
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <HelpOutlineIcon />
                </ListItemIcon>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  How to Create and Manage a Room
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ pl: 6 }}>
                <strong>Creating a Room:</strong><br />
                <strong>On Desktop:</strong> Navigate to the Side Room page and click the "Create Room" button. 
                Fill in your room details including name, description, and privacy settings.<br /><br />
                
                <strong>On Mobile:</strong> Tap the "+" button in the bottom navigation bar from any screen. 
                The create room dialog will slide up from the bottom, allowing you to set up your room on the go.<br /><br />
                
                <strong>Room Features:</strong><br />
                • <strong>Customization:</strong> As a room owner, you can customize your room's appearance with colors, backgrounds, and text styles.<br />
                • <strong>Privacy:</strong> Set your room as public or private with optional password protection.<br />
                • <strong>Audio/Video:</strong> Both room owners and participants can join via audio or video calls.<br />
                • <strong>Media Sharing:</strong> Share videos, screen content, and other media with room participants.<br />
                • <strong>Gift Tracking:</strong> View your top gifters and their contributions over different time periods.<br /><br />
                
                <strong>Room Owner Features:</strong><br />
                • Edit room details and appearance at any time<br />
                • Mute participants in voice/video chats<br />
                • Enable video to be seen by participants<br />
                • Receive gifts from viewers and track top supporters<br />
                • Share and control media content<br /><br />
                
                <strong>Participant Features:</strong><br />
                • Join conversations via text, audio, or video<br />
                • Enable video to be seen by other participants<br />
                • Send gifts to room owners<br />
                • View shared media content<br />
                • Block users you don't want to interact with<br />
                • Follow room owners and get notifications for new content
              </Typography>
            </AccordionDetails>
          </Accordion>
          
          <Accordion expanded={expanded === 'panel8'} onChange={handleChange('panel8')}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="panel8-content"
              id="panel8-header"
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <HelpOutlineIcon />
                </ListItemIcon>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  How to Customize and Manage Your Room
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ pl: 6 }}>
                <strong>Room Customization:</strong><br />
                Once you've created a room, you can customize its appearance to match your style:<br />
                • <strong>Header Color:</strong> Change the color of your room's header bar<br />
                • <strong>Background Color:</strong> Set the main background color of your room<br />
                • <strong>Text Color:</strong> Customize the color of text in your room<br />
                • <strong>Accent Color:</strong> Set highlight colors for buttons and interactive elements<br />
                • <strong>Gradients:</strong> Enable gradient effects for headers and backgrounds<br /><br />
                
                <strong>Managing Interactions:</strong><br />
                As a room owner or participant, you have several tools to manage your experience:<br />
                • <strong>Mute Users:</strong> Room owners can temporarily prevent a user from speaking in voice chats<br />
                • <strong>Block Users:</strong> Both owners and participants can block users they don't want to interact with<br /><br />
                
                <strong>Audio and Video:</strong><br />
                Participate in rooms via audio or video:<br />
                • <strong>Enable Video:</strong> Turn on your camera to be seen by other participants<br />
                • <strong>Audio Only:</strong> Join with just your microphone if you prefer not to use video<br />
                • <strong>Mute Yourself:</strong> Control when others can hear you by toggling your microphone<br /><br />
                
                <strong>Content Sharing:</strong><br />
                Share content with your room participants:<br />
                • <strong>Video Sharing:</strong> Share YouTube videos that everyone can watch together<br />
                • <strong>Screen Sharing:</strong> Share your screen for presentations or demonstrations<br />
                • <strong>Audio Sharing:</strong> Share audio clips or music with your participants<br /><br />
                
                <strong>Privacy Management:</strong><br />
                Control who can access your room:<br />
                • <strong>Public Rooms:</strong> Anyone can join without restrictions<br />
                • <strong>Private Rooms:</strong> Set a password to control who can enter<br />
                • <strong>Invite Only:</strong> Manually invite specific users to join your room
              </Typography>
            </AccordionDetails>
          </Accordion>
          
          {/* Profile Management Section Title */}
          <ListItem sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), py: 1.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Profile Management
            </Typography>
          </ListItem>
          
          <Accordion expanded={expanded === 'panel9'} onChange={handleChange('panel9')}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="panel9-content"
              id="panel9-header"
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <HelpOutlineIcon />
                </ListItemIcon>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  Profile Management
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ pl: 6 }}>
                <strong>Editing Your Profile:</strong><br />
                You can customize your profile information at any time:<br />
                • <strong>Access Your Profile:</strong> Tap your profile picture or navigate to your profile page<br />
                • <strong>Edit Profile:</strong> Click the "Edit Profile" button to make changes<br />
                • <strong>Change Profile Picture:</strong> Click the camera icon on your profile picture to upload a new image<br />
                • <strong>Update Information:</strong> Edit your name, username, and bio<br />
                <br /><br />
                
                <strong>Privacy Settings:</strong><br />
                Control who can see your content and interact with you:<br />
                • <strong>Private Account:</strong> Go to Settings → Privacy and toggle "Private Account" to require approval for followers<br />
                • <strong>Follow Requests:</strong> When your account is private, you'll need to approve follow requests<br />
                • <strong>Manage Requests:</strong> View and respond to follow requests in Settings → Privacy<br /><br />
                
                <strong>Blocking Users:</strong><br />
                If you need to block someone:<br />
                • <strong>From Profile:</strong> Visit their profile, tap the three dots (⋮), and select "Block User"<br />
                • <strong>Effects of Blocking:</strong> Blocked users cannot see your profile, rooms, or messages<br />
                • <strong>Manage Blocked Users:</strong> Go to Settings → Privacy → Blocked Users to view and unblock users<br /><br />
                
                <strong>Notification Preferences:</strong><br />
                Customize your email notifications:<br />
                • <strong>Access Settings:</strong> Go to Settings → Email Notifications<br />
                • <strong>Room Notifications:</strong> Toggle whether you receive emails about Side Room activity<br />
                • <strong>Message Notifications:</strong> Toggle whether you receive emails about new direct messages<br />
                • <strong>Follow Notifications:</strong> Toggle whether you receive emails when someone follows you<br /><br />
                
                <strong>Account Privacy:</strong><br />
                When your account is set to private:<br />
                • Only approved followers can see your Side Rooms<br />
                • Follow requests appear in your Settings for approval<br />
                • You can accept or decline each request individually<br />
                • If you change from private to public, all pending requests will be automatically accepted
              </Typography>
            </AccordionDetails>
          </Accordion>
          
          {/* Reporting Section Title */}
          <ListItem sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), py: 1.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Reporting Content & Users
            </Typography>
          </ListItem>
          
          <Accordion expanded={expanded === 'panel10'} onChange={handleChange('panel10')}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="panel10-content"
              id="panel10-header"
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <HelpOutlineIcon />
                </ListItemIcon>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  How to Report Issues
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ pl: 6 }}>
                <strong>What Can Be Reported:</strong><br />
                You can report several types of content on SideEye:<br />
                • <strong>Users:</strong> Report users for harassment, inappropriate behavior, or other violations<br />
                • <strong>Side Rooms:</strong> Report rooms containing inappropriate content or activities<br />
                • <strong>Messages:</strong> Report specific messages in chats or rooms<br />
                • <strong>Technical Issues:</strong> Report bugs or functionality problems<br /><br />
                
                <strong>How to Report Content:</strong><br />
                <strong>From Content:</strong><br />
                • Most content has a three-dot menu (⋮) or report icon<br />
                • Click this menu and select "Report" option<br />
                • Select a reason for reporting (harassment, inappropriate content, etc.)<br />
                • Add details about the issue<br />
                • Submit your report<br /><br />
                
                <strong>From Report Page:</strong><br />
                • Go to Settings → Report an Issue<br />
                • Select the type of report (user, bug, content, other)<br />
                • If reporting a user, enter their username<br />
                • Provide detailed information about the issue<br />
                • Submit your report<br /><br />
                
                <strong>Using Sade AI to Report:</strong><br />
                You can also use Sade AI to help with reporting issues:<br />
                • Open Sade AI from the main navigation<br />
                • Type something like "I need to report a user" or "How do I report inappropriate content?"<br />
                • Sade will guide you through the reporting process<br />
                • You can provide details about your issue to Sade<br />
                • Sade can direct you to the appropriate reporting form or help you report directly<br /><br />
                
                <strong>After Submitting a Report:</strong><br />
                • All reports are reviewed by our moderation team<br />
                • You'll receive a notification when your report has been processed<br />
                • Depending on the severity, action may be taken immediately or after review<br />
                • We take all reports seriously and investigate each one thoroughly<br /><br />
                
                <strong>Report Categories:</strong><br />
                • <strong>Harassment:</strong> Bullying, threats, or targeted abuse<br />
                • <strong>Hate Speech:</strong> Content targeting groups based on identity<br />
                • <strong>Inappropriate Content:</strong> Explicit, offensive, or unsuitable material<br />
                • <strong>Spam:</strong> Unwanted commercial content or repetitive messages<br />
                • <strong>Misinformation:</strong> False or misleading content<br />
                • <strong>Technical Issues:</strong> Bugs, glitches, or functionality problems
              </Typography>
            </AccordionDetails>
          </Accordion>
          
          <br /><br />
          {/* Messaging and Chatting Section Title */}
          <ListItem sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), py: 1.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Messaging and Chatting
            </Typography>
          </ListItem>
          
          <Accordion expanded={expanded === 'panel11'} onChange={handleChange('panel11')}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="panel11-content"
              id="panel11-header"
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <HelpOutlineIcon />
                </ListItemIcon>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  Direct Messaging Overview
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ pl: 6 }}>
                <strong>Starting a Conversation:</strong><br />
                You can message other users directly through our messaging system:<br />
                • <strong>From Messages:</strong> Go to Messages → Click the Edit icon in the top right → Search for a user<br />
                • <strong>From a Profile:</strong> Visit any user's profile and click the Message button<br /><br />
                
                <strong>Message Requests System:</strong><br />
                For privacy and safety, we have a message request system:<br />
                • Messages from users you <strong>follow</strong> go directly to your inbox<br />
                • Messages from users you <strong>don't follow</strong> go to your "Message Requests" tab<br />
                • You can accept or decline each request individually<br />
                • Declining a request deletes the conversation and all messages<br /><br />
                
                <strong>Messaging Features:</strong><br />
                • <strong>Text Messages:</strong> Send text messages in real-time<br />
                • <strong>Media Sharing:</strong> Share photos and videos (up to 10MB)<br />
                • <strong>Emoji Reactions:</strong> React to messages with emojis<br />
                • <strong>Link Sharing:</strong> Share links to rooms and content<br />
                • <strong>Message Management:</strong> Delete your own messages<br />
                • <strong>Read Receipts:</strong> See when your messages have been read
              </Typography>
            </AccordionDetails>
          </Accordion>
          
          <Accordion expanded={expanded === 'panel12'} onChange={handleChange('panel12')}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="panel12-content"
              id="panel12-header"
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <HelpOutlineIcon />
                </ListItemIcon>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  Rooms and Server Chats
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ pl: 6 }}>
                <strong>Finding Rooms:</strong><br />
                • <strong>Browse Rooms:</strong> Go to Messages → Switch to the "Rooms +" tab<br />
                • <strong>Public Rooms:</strong> All public rooms are visible in this tab<br />
                • <strong>Room Types:</strong> You'll see rooms you've created, rooms you've joined, and public rooms you can join<br /><br />
                
                <strong>Creating a Room:</strong><br />
                • Go to Messages → "Rooms +" tab → Click "Create a Room"<br />
                • Enter a name and description for your room<br />
                • Your room will be visible to your followers and they'll receive a notification when you create it<br /><br />
                
                <strong>Room Privacy Settings:</strong><br />
                • <strong>Public Rooms:</strong> Anyone can view and join<br />
                • <strong>Locked Rooms:</strong> Room owners can lock rooms, requiring approval to join<br />
                • <strong>Join Requests:</strong> For locked rooms, users must request to join, and the owner can approve or decline<br /><br />
                
                <strong>Room Features:</strong><br />
                • <strong>General Chat:</strong> Real-time text chat with all room members<br />
                • <strong>Announcements:</strong> Room owners can post important announcements<br />
                • <strong>Polls:</strong> Room owners can create polls for members to vote on<br />
                • <strong>Media Sharing:</strong> Share images and videos in the chat<br />
                • <strong>Reactions:</strong> React to messages with emoji reactions
              </Typography>
            </AccordionDetails>
          </Accordion>
          
          <Accordion expanded={expanded === 'panel13'} onChange={handleChange('panel13')}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="panel13-content"
              id="panel13-header"
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <HelpOutlineIcon />
                </ListItemIcon>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  Room Management
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ pl: 6 }}>
                <strong>For Room Owners:</strong><br />
                As a room owner, you have special privileges:<br />
                • <strong>Invite Users:</strong> Invite specific users to your room<br />
                • <strong>Manage Members:</strong> View and remove members from your room<br />
                • <strong>Lock/Unlock:</strong> Toggle whether users need approval to join<br />
                • <strong>Approve Requests:</strong> Accept or decline join requests<br />
                • <strong>Post Announcements:</strong> Share important updates with all members<br />
                • <strong>Create Polls:</strong> Make polls for members to vote on<br />
                • <strong>Delete:</strong> Delete the entire room and all its content<br /><br />
                
                <strong>For Room Members:</strong><br />
                As a room member, you can:<br />
                • <strong>Send Messages:</strong> Participate in the general chat<br />
                • <strong>Share Media:</strong> Upload images and videos to share<br />
                • <strong>Vote in Polls:</strong> Participate in polls created by the owner<br />
                • <strong>React:</strong> Add emoji reactions to messages<br />
                • <strong>Leave Room:</strong> Leave the room at any time<br />
                • <strong>Report:</strong> Report inappropriate content or behavior
              </Typography>
            </AccordionDetails>
          </Accordion>
          
          <Accordion expanded={expanded === 'panel14'} onChange={handleChange('panel14')}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="panel14-content"
              id="panel14-header"
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <HelpOutlineIcon />
                </ListItemIcon>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  Message Privacy and Blocking
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ pl: 6 }}>
                <strong>Who Can Message You:</strong><br />
                • Anyone can send you a message request<br />
                • Messages from users you follow go directly to your inbox<br />
                • Messages from users you don't follow go to your "Message Requests" tab<br />
                • You must accept a request before you can receive direct messages from that user<br /><br />
                
                <strong>Blocking Users:</strong><br />
                If you need to block someone:<br />
                • <strong>From Profile:</strong> Visit their profile, tap the three dots (⋮), and select "Block User"<br />
                • <strong>From Messages:</strong> Open a conversation, tap the three dots in the top right, select "Block User"<br />
                • <strong>From Rooms:</strong> Click on a member's name, view their profile, and select "Block User"<br /><br />
                
                <strong>Effects of Blocking:</strong><br />
                When you block someone:<br />
                • They cannot send you messages<br />
                • Existing conversations are hidden from both users<br />
                • They cannot see your rooms or join them<br />
                • You will not see their messages in shared rooms<br />
                • You'll be notified if they are in a room you join<br /><br />
                
                <strong>Managing Blocked Users:</strong><br />
                • View your blocked users list in Settings → Privacy → Blocked Users<br />
                • You can unblock users at any time<br />
                • Unblocking someone does not automatically restore previous conversations
              </Typography>
            </AccordionDetails>
          </Accordion>
          
          <Accordion expanded={expanded === 'panel15'} onChange={handleChange('panel15')}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="panel15-content"
              id="panel15-header"
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <HelpOutlineIcon />
                </ListItemIcon>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  Messaging Etiquette and Tips
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ pl: 6 }}>
                <strong>Best Practices:</strong><br />
                • <strong>Be Respectful:</strong> Treat all users with respect in your messages<br />
                • <strong>Avoid Spam:</strong> Don't send excessive messages or repetitive content<br />
                • <strong>Media Safety:</strong> Only share appropriate images and videos<br />
                • <strong>Response Time:</strong> Not everyone responds immediately, be patient<br />
                • <strong>Group Messaging:</strong> Use rooms for group conversations rather than individual DMs<br /><br />
                
                <strong>Useful Tips:</strong><br />
                • <strong>Emoji Reactions:</strong> Long-press (or right-click) on a message to add a reaction<br />
                • <strong>Message Delete:</strong> Long-press on your own messages to delete them<br />
                • <strong>Media Upload:</strong> Use the attachment icon to upload photos and videos<br />
                • <strong>Room Links:</strong> Share room links in messages by pasting the URL<br />
                • <strong>Message Search:</strong> Use the search bar at the top of your inbox to find conversations<br /><br />
                
                <strong>Security Tips:</strong><br />
                • Never share your source code or password in messages<br />
                • Be cautious about clicking links from users you don't know<br />
                • Report suspicious messages or behavior using the report function<br />
                • Consider keeping your account private if you want more control over who can contact you
              </Typography>
            </AccordionDetails>
          </Accordion>
        </Paper>
      </Box>
    </Container>
  );
};

export default FAQPage; 