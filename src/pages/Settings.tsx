import React from 'react';
import { 
  Container, 
  Box, 
  Typography, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  Divider,
  Paper,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Security as SecurityIcon,
  Info as InfoIcon,
  Policy as PolicyIcon,
  Cookie as CookieIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { Link } from 'react-router-dom';

const Settings: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const settingsItems = [
    {
      title: 'Safety',
      icon: <SecurityIcon />,
      path: '/safety',
      description: 'Learn about our safety guidelines and reporting tools'
    },
    {
      title: 'About',
      icon: <InfoIcon />,
      path: '/about',
      description: 'Learn more about SideEye and our mission'
    },
    {
      title: 'Privacy Policy',
      icon: <PolicyIcon />,
      path: '/privacy-policy',
      description: 'Read our privacy policy and data handling practices'
    },
    {
      title: 'Terms of Service',
      icon: <PolicyIcon />,
      path: '/terms',
      description: 'Review our terms of service and community guidelines'
    },
    {
      title: 'Cookie Policy',
      icon: <CookieIcon />,
      path: '/cookies',
      description: 'Learn about how we use cookies and similar technologies'
    }
  ];

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
          Settings
        </Typography>
        
        <Paper elevation={0} sx={{ borderRadius: 2 }}>
          <List>
            {settingsItems.map((item, index) => (
              <React.Fragment key={item.path}>
                <ListItem 
                  component={Link} 
                  to={item.path}
                  sx={{
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <ListItemIcon>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.title}
                    secondary={item.description}
                  />
                </ListItem>
                {index < settingsItems.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Paper>
      </Box>
    </Container>
  );
};

export default Settings; 