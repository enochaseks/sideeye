import React from 'react';
import { Container, Typography, Box, Divider, Paper } from '@mui/material';

const About: React.FC = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 12 }}>
      <Paper elevation={3} sx={{ p: { xs: 3, md: 6 }, mb: 6 }}>
        <Typography 
          variant="h1" 
          component="h1" 
          sx={{ 
            textAlign: 'center',
            fontWeight: 'bold',
            mb: 6,
            fontSize: { xs: '2.5rem', md: '3.5rem' },
            color: 'primary.main',
            textTransform: 'uppercase',
            letterSpacing: 2
          }}
        >
          About SideEye
        </Typography>
        
        <Divider sx={{ my: 6 }} />
        
        <Box sx={{ mb: 8 }}>
          <Typography 
            variant="h2" 
            sx={{ 
              fontWeight: 'medium',
              mb: 4,
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
            SideEye is a moderated social media platform dedicated to creating a safe and engaging space for users to share their thoughts, 
            connect with others, and express themselves through various forms of content. We believe in fostering 
            meaningful conversations while maintaining a respectful and inclusive environment through our comprehensive 
            moderation system that ensures all users can interact authentically within clear community guidelines.
          </Typography>
        </Box>

        <Box>
          <Typography 
            variant="h2" 
            sx={{ 
              fontWeight: 'medium',
              mb: 6,
              fontSize: { xs: '2rem', md: '2.5rem' },
              color: 'text.primary'
            }}
          >
            Features
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                Side Rooms
              </Typography>
              <Typography 
                variant="h4" 
                sx={{ 
                  lineHeight: 1.8,
                  color: 'text.secondary',
                  fontSize: { xs: '1.25rem', md: '1.5rem' }
                }}
              >
                Create or join audio-based discussion rooms where you can connect with other users in real-time. 
                Side Rooms provide a space for meaningful conversations and community building through voice interactions. 
                These rooms can be public or private, with customizable settings for membership and moderation. 
                Each room serves as a dedicated space for focused discussions around specific topics or interests, 
                allowing users to engage in authentic conversations with like-minded individuals.
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
                Discover
              </Typography>
              <Typography 
                variant="h4" 
                sx={{ 
                  lineHeight: 1.8,
                  color: 'text.secondary',
                  fontSize: { xs: '1.25rem', md: '1.5rem' }
                }}
              >
                Explore new content, find interesting users to follow, and discover trending Side Rooms through 
                our Discover feature. This curated exploration space helps you find content aligned with your 
                interests and introduces you to new communities within the platform. Discover makes it easy to 
                expand your network and find engaging discussions to join.
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
                AI Moderation
              </Typography>
              <Typography 
                variant="h4" 
                sx={{ 
                  lineHeight: 1.8,
                  color: 'text.secondary',
                  fontSize: { xs: '1.25rem', md: '1.5rem' }
                }}
              >
                Our AI moderation system automatically scans all content against our community guidelines,
                detecting potential violations across multiple categories including harmful content, misinformation,
                fraud, cybercrime, adult content, and violence. This system helps maintain a safe environment by
                issuing appropriate warnings or restrictions when needed, while protecting users from harmful interactions.
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
                Sade AI
              </Typography>
              <Typography 
                variant="h4" 
                sx={{ 
                  lineHeight: 1.8,
                  color: 'text.secondary',
                  fontSize: { xs: '1.25rem', md: '1.5rem' }
                }}
              >
                Sade AI is our AI assistant that you can use to help you with your issues on the platform. You can play games with her like connect 4, 
                guess the number, and more. She is your friendly AI assistant where you can conversate with her, ask her to search the web for you, 
                and more. She also moderates the platform and checks for any violations of our community guidelines. To improve service quality and ensure safety,
                we monitor Sade AI chat history and interactions to maintain platform standards and enhance the AI's capabilities.
              </Typography>
            </Box>
          </Box>
        </Box>
      </Paper>
      
      <Box sx={{ textAlign: 'center', mt: 8 }}>
        <Typography variant="body2" color="text.secondary">
          &copy; {new Date().getFullYear()} SideEye | Created by Enoch Asekomhe | All Rights Reserved
        </Typography>
      </Box>
    </Container>
  );
};

export default About; 