import React from 'react';
import { Container, Box, Typography, Paper } from '@mui/material';

const TeaRoomList: React.FC = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4 }}>
        <Paper elevation={0} sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom>
            Tea Rooms
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Coming soon! Our tea rooms will be a place for focused discussions on specific topics.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default TeaRoomList; 