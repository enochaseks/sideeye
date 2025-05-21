import React from 'react';
import { 
  Container, 
  Box, 
  Typography, 
  Paper, 
  Avatar, 
  Link as MuiLink,
  Button,
  useTheme,
  Breadcrumbs
} from '@mui/material';
import { Link } from 'react-router-dom';
import { Home as HomeIcon, Settings as SettingsIcon } from '@mui/icons-material';

const AboutFounder: React.FC = () => {
  const theme = useTheme();
  
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Breadcrumbs sx={{ mb: 3 }}>
        <MuiLink component={Link} to="/" sx={{ display: 'flex', alignItems: 'center' }}>
          <HomeIcon sx={{ mr: 0.5, fontSize: 18 }} />
          Home
        </MuiLink>
        <MuiLink component={Link} to="/settings" sx={{ display: 'flex', alignItems: 'center' }}>
          <SettingsIcon sx={{ mr: 0.5, fontSize: 18 }} />
          Settings
        </MuiLink>
        <Typography color="text.primary">About The Founder</Typography>
      </Breadcrumbs>
      
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
        About The Founder
      </Typography>
      
      <Paper 
        elevation={0} 
        sx={{ 
          p: 4, 
          borderRadius: 2, 
          border: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'center', sm: 'flex-start' },
          gap: 4
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Avatar 
            src="/images/founder.jpg" 
            alt="Enoch Asekomhe"
            sx={{ 
              width: { xs: 160, sm: 180 }, 
              height: { xs: 160, sm: 180 },
              border: `3px solid ${theme.palette.primary.main}`
            }}
          />
        </Box>
        
        <Box>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
            Enoch Asekomhe
          </Typography>
          <Typography variant="subtitle1" color="primary" gutterBottom sx={{ fontWeight: 500 }}>
            Developer & Founder
          </Typography>
          
          <Typography paragraph sx={{ mt: 2 }}>
            Enoch is the founder and developer of SideEye, born in Lagos, Nigeria and now located in United Kingdom. 
            Enoch created SideEye as a platform to voice your opinion, talk with AI and enjoy great features 
            that will boost your audience and creativity.
          </Typography>
          
          <Typography paragraph>
            He graduated from De MontFort University and got a degree in BA (Honours) Film, Media & Communications 
            and Masters of Science in Software Engineering. With this degree he built this app as a way to build his skills.
          </Typography>
          
          <Typography paragraph>
            You can follow him on instagram @ayomideasekomhe or click the link here: {' '}
            <MuiLink href="https://www.instagram.com/ayomideasekomhe/" target="_blank" rel="noopener noreferrer">
              @ayomideasekomhe
            </MuiLink>
          </Typography>
          
          <Button 
            variant="outlined" 
            component="a" 
            href="https://www.instagram.com/ayomideasekomhe/" 
            target="_blank"
            rel="noopener noreferrer"
            sx={{ mt: 2 }}
          >
            Follow on Instagram
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default AboutFounder; 