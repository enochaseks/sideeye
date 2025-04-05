import React from 'react';
import { Container } from '@mui/material';
import SafetyInfo from '../components/SafetyInfo/SafetyInfo';

const SafetyPage: React.FC = () => {
  return (
    <Container maxWidth="lg">
      <SafetyInfo />
    </Container>
  );
};

export default SafetyPage; 