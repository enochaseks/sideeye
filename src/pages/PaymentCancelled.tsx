import React from 'react';
import {
    Box,
    Container,
    Typography,
    Paper,
    Button,
    Alert
} from '@mui/material';
import {
    Cancel as CancelIcon,
    Home as HomeIcon,
    ArrowBack as ArrowBackIcon,
    CardGiftcard as GiftIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const PaymentCancelled: React.FC = () => {
    const navigate = useNavigate();

    return (
        <Container maxWidth="sm" sx={{ mt: 4, mb: 4 }}>
            <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
                {/* Cancel Icon */}
                <CancelIcon 
                    sx={{ 
                        fontSize: 80, 
                        color: 'warning.main', 
                        mb: 2 
                    }} 
                />
                
                {/* Cancel Message */}
                <Typography variant="h4" gutterBottom color="warning.main" fontWeight="bold">
                    Payment Cancelled
                </Typography>
                
                <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                    Your payment was cancelled and no charges were made to your account.
                </Typography>

                {/* Info Alert */}
                <Alert severity="info" sx={{ mb: 4, textAlign: 'left' }}>
                    <Typography variant="body2">
                        <strong>What happened?</strong><br />
                        You cancelled the payment process before it was completed. Your gift was not sent and no money was charged.
                    </Typography>
                </Alert>

                {/* Action Buttons */}
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Button
                        variant="contained"
                        onClick={() => navigate(-1)}
                        startIcon={<ArrowBackIcon />}
                        size="large"
                    >
                        Try Again
                    </Button>
                    
                    <Button
                        variant="outlined"
                        onClick={() => navigate('/')}
                        startIcon={<HomeIcon />}
                        size="large"
                    >
                        Return Home
                    </Button>
                </Box>

                {/* Additional Info */}
                <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
                    You can try sending the gift again at any time. No payment information was stored.
                </Typography>
            </Paper>
        </Container>
    );
};

export default PaymentCancelled; 