import React from 'react';
import { Container, Typography, Box, Paper } from '@mui/material';
import SafetyInfo from '../components/SafetyInfo/SafetyInfo';

const SafetyPage: React.FC = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
          Safety & Community Guidelines
        </Typography>
        <Paper elevation={3} sx={{ p: { xs: 2, md: 4 }, borderRadius: 2 }}>
          <SafetyInfo />
        </Paper>
      </Box>
    </Container>
  );
};

export default SafetyPage; 