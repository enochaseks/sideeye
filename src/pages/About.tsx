import React from 'react';
import { Container, Typography, Box } from '@mui/material';

const About: React.FC = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 12 }}>
      <Typography 
        variant="h1" 
        component="h1" 
        sx={{ 
          textAlign: 'center',
          fontWeight: 'bold',
          mb: 12,
          fontSize: { xs: '3rem', md: '4rem' },
          color: 'primary.main',
          textTransform: 'uppercase',
          letterSpacing: 2
        }}
      >
        About SideEye
      </Typography>
      
      <Box sx={{ mb: 12 }}>
        <Typography 
          variant="h2" 
          sx={{ 
            fontWeight: 'medium',
            mb: 6,
            fontSize: { xs: '2rem', md: '2.5rem' },
            color: 'text.primary'
          }}
        >
          Our Mission
        </Typography>
        <Typography 
          variant="h4" 
          sx={{ 
            lineHeight: 1.8,
            color: 'text.secondary',
            fontSize: { xs: '1.25rem', md: '1.5rem' }
          }}
        >
          SideEye is a platform dedicated to creating a safe and engaging space for users to share their thoughts, 
          connect with others, and express themselves through various forms of content. We believe in fostering 
          meaningful conversations while maintaining a respectful and inclusive environment.
        </Typography>
      </Box>

      <Box>
        <Typography 
          variant="h2" 
          sx={{ 
            fontWeight: 'medium',
            mb: 8,
            fontSize: { xs: '2rem', md: '2.5rem' },
            color: 'text.primary'
          }}
        >
          Features
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Box>
            <Typography 
              variant="h3" 
              sx={{ 
                fontWeight: 'medium',
                mb: 3,
                fontSize: { xs: '1.75rem', md: '2rem' },
                color: 'primary.main'
              }}
            >
              Tea Rooms
            </Typography>
            <Typography 
              variant="h4" 
              sx={{ 
                lineHeight: 1.8,
                color: 'text.secondary',
                fontSize: { xs: '1.25rem', md: '1.5rem' }
              }}
            >
              Join themed discussion rooms to connect with like-minded individuals and share your thoughts.
            </Typography>
          </Box>
          <Box>
            <Typography 
              variant="h3" 
              sx={{ 
                fontWeight: 'medium',
                mb: 3,
                fontSize: { xs: '1.75rem', md: '2rem' },
                color: 'primary.main'
              }}
            >
              Shade Meter
            </Typography>
            <Typography 
              variant="h4" 
              sx={{ 
                lineHeight: 1.8,
                color: 'text.secondary',
                fontSize: { xs: '1.25rem', md: '1.5rem' }
              }}
            >
              Our unique content moderation system helps maintain a positive community atmosphere.
            </Typography>
          </Box>
          <Box>
            <Typography 
              variant="h3" 
              sx={{ 
                fontWeight: 'medium',
                mb: 3,
                fontSize: { xs: '1.75rem', md: '2rem' },
                color: 'primary.main'
              }}
            >
              Achievements
            </Typography>
            <Typography 
              variant="h4" 
              sx={{ 
                lineHeight: 1.8,
                color: 'text.secondary',
                fontSize: { xs: '1.25rem', md: '1.5rem' }
              }}
            >
              Earn badges and recognition for your contributions to the community.
            </Typography>
          </Box>
          <Box>
            <Typography 
              variant="h3" 
              sx={{ 
                fontWeight: 'medium',
                mb: 3,
                fontSize: { xs: '1.75rem', md: '2rem' },
                color: 'primary.main'
              }}
            >
              Leaderboard
            </Typography>
            <Typography 
              variant="h4" 
              sx={{ 
                lineHeight: 1.8,
                color: 'text.secondary',
                fontSize: { xs: '1.25rem', md: '1.5rem' }
              }}
            >
              Compete and climb the ranks based on your positive contributions.
            </Typography>
          </Box>
        </Box>
      </Box>
    </Container>
  );
};

export default About; 