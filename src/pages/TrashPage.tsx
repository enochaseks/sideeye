import React from 'react';
import { Container, Typography, Box } from '@mui/material';


const TrashPage: React.FC = () => {
  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ mb: 4 }}>
          Trash
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Posts in the trash will be automatically deleted after 24 hours. You can restore them before then.
        </Typography>
      </Box>
    </Container>
  );
};

export default TrashPage; 