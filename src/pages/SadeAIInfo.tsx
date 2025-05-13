import React from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Paper, 
  Divider, 
  Button, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText,
  Avatar,
  Grid,
  Card,
  CardContent,
  CardMedia
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import SecurityIcon from '@mui/icons-material/Security';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import { useTheme } from '@mui/material/styles';

const SadeAIInfo: React.FC = () => {
  const theme = useTheme();

  const features = [
    {
      icon: <SearchIcon fontSize="large" />,
      title: "Advanced Search",
      description: "Sade can search the web for information to answer your questions with up-to-date facts and knowledge."
    },
    {
      icon: <SportsEsportsIcon fontSize="large" />,
      title: "Interactive Games",
      description: "Play fun games like Connect 4, Guess the Number, and more directly in your chat with Sade."
    },
    {
      icon: <SecurityIcon fontSize="large" />,
      title: "Threat Detection",
      description: "Sade monitors conversations to identify potential harmful content and helps keep the community safe."
    },
    {
      icon: <QuestionAnswerIcon fontSize="large" />,
      title: "Conversational Support",
      description: "Get help with app features, troubleshooting, and general inquiries through natural conversation."
    },
    {
      icon: <TipsAndUpdatesIcon fontSize="large" />,
      title: "Helpful Tips",
      description: "Receive suggestions and advice about app features and how to make the most of SideEye."
    },
    {
      icon: <FactCheckIcon fontSize="large" />,
      title: "Facts & Proverbs",
      description: "Learn interesting facts and traditional proverbs with a British-Nigerian cultural influence."
    }
  ];

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
        <Avatar 
          src="/images/sade-avatar.jpg" 
          sx={{ width: 120, height: 120, mb: 2 }}
          alt="Sade AI Avatar"
        />
        <Typography variant="h3" component="h1" gutterBottom align="center" fontWeight="bold">
          Meet Sade AI
        </Typography>
        <Typography variant="h6" color="text.secondary" align="center" sx={{ maxWidth: 600, mb: 3 }}>
          <b>S</b>ystematic <b>A</b>I for <b>D</b>etection and <b>E</b>ngagement
        </Typography>
        <Typography variant="body1" align="center" sx={{ maxWidth: 700, mb: 4 }}>
          Sade (pronounced "SHA-DEY") is your friendly AI companion with a Yoruba name, 
          designed to make your experience on SideEye more helpful, enjoyable, and safe.
        </Typography>
        <Button 
          variant="contained" 
          size="large" 
          component={RouterLink} 
          to="/sade-ai"
          startIcon={<SmartToyIcon />}
          sx={{ borderRadius: 2 }}
        >
          Chat with Sade
        </Button>
      </Box>

      <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: `1px solid ${theme.palette.divider}`, mb: 4 }}>
        <Typography variant="h5" gutterBottom fontWeight="medium">
          Who is Sade?
        </Typography>
        <Typography variant="body1" paragraph>
          Sade is an AI assistant with a British-Nigerian personality built specifically for the SideEye platform. 
          Her name, which has Yoruba origins, reflects the cultural fusion at the heart of SideEye.
        </Typography>
        <Typography variant="body1" paragraph>
          Designed to be your helpful companion throughout the app, Sade can answer questions, 
          provide assistance with app features, engage in casual conversation, and help keep the community safe 
          by identifying potential threats or harmful content.
        </Typography>
        <Typography variant="body1">
          With her unique blend of British and Nigerian slang and cultural references, Sade offers a 
          personalized and authentic communication experience that resonates with SideEye's diverse community.
        </Typography>
      </Paper>

      <Typography variant="h5" gutterBottom fontWeight="medium" sx={{ mb: 3 }}>
        What Sade Can Do
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {features.map((feature, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card elevation={0} sx={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2
            }}>
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                p: 2, 
                color: theme.palette.primary.main 
              }}>
                {feature.icon}
              </Box>
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h6" component="h3" align="center" gutterBottom>
                  {feature.title}
                </Typography>
                <Typography variant="body2" align="center">
                  {feature.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: `1px solid ${theme.palette.divider}`, mb: 4 }}>
        <Typography variant="h5" gutterBottom fontWeight="medium">
          How to Use Sade
        </Typography>
        <List>
          <ListItem>
            <ListItemIcon>
              <Box sx={{ bgcolor: 'primary.main', borderRadius: '50%', width: 24, height: 24, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: 'white' }}>1</Typography>
              </Box>
            </ListItemIcon>
            <ListItemText 
              primary="Start a conversation" 
              secondary="Navigate to the Sade AI page through the main navigation or settings menu."
            />
          </ListItem>
          <Divider component="li" variant="inset" />
          <ListItem>
            <ListItemIcon>
              <Box sx={{ bgcolor: 'primary.main', borderRadius: '50%', width: 24, height: 24, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: 'white' }}>2</Typography>
              </Box>
            </ListItemIcon>
            <ListItemText 
              primary="Ask anything" 
              secondary="Type your question, request or just say hello. Sade can handle general queries, app-specific questions, or casual conversation."
            />
          </ListItem>
          <Divider component="li" variant="inset" />
          <ListItem>
            <ListItemIcon>
              <Box sx={{ bgcolor: 'primary.main', borderRadius: '50%', width: 24, height: 24, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: 'white' }}>3</Typography>
              </Box>
            </ListItemIcon>
            <ListItemText 
              primary="Try special features" 
              secondary="Ask Sade to search for specific information using the search icon, play games, or provide facts and proverbs."
            />
          </ListItem>
        </List>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <Button 
          variant="contained" 
          size="large" 
          component={RouterLink} 
          to="/sade-ai"
          startIcon={<SmartToyIcon />}
          sx={{ borderRadius: 2 }}
        >
          Chat with Sade Now
        </Button>
      </Box>
    </Container>
  );
};

export default SadeAIInfo; 