import React, { useEffect, useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Paper,
    Button,
    CircularProgress,
    Alert,
    Card,
    CardContent,
    Divider,
    Chip
} from '@mui/material';
import {
    CheckCircle as CheckCircleIcon,
    Receipt as ReceiptIcon,
    Home as HomeIcon,
    CardGiftcard as GiftIcon
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';

const PaymentSuccess: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [paymentData, setPaymentData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const sessionId = searchParams.get('session_id');
        
        if (!sessionId) {
            setError('No payment session found');
            setLoading(false);
            return;
        }

        // Fetch payment details from backend
        const fetchPaymentDetails = async () => {
            try {
                const backendUrl = 'https://sideeye-backend-production.up.railway.app';
                const response = await fetch(`${backendUrl}/api/payment-success/${sessionId}`);
                
                if (!response.ok) {
                    throw new Error('Failed to fetch payment details');
                }
                
                const data = await response.json();
                setPaymentData(data);
                
                // Show success toast
                toast.success('Payment completed successfully! 🎉', {
                    duration: 5000,
                    position: 'top-center',
                });
                
            } catch (error: any) {
                console.error('Error fetching payment details:', error);
                setError(error.message || 'Failed to load payment details');
            } finally {
                setLoading(false);
            }
        };

        fetchPaymentDetails();
    }, [searchParams]);

    const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: currency,
        }).format(amount);
    };

    if (loading) {
        return (
            <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
                <CircularProgress size={60} />
                <Typography variant="h6" sx={{ mt: 2 }}>
                    Processing your payment...
                </Typography>
            </Container>
        );
    }

    if (error) {
        return (
            <Container maxWidth="sm" sx={{ mt: 8 }}>
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
                <Button
                    variant="contained"
                    onClick={() => navigate('/')}
                    startIcon={<HomeIcon />}
                >
                    Return Home
                </Button>
            </Container>
        );
    }

    return (
        <Container maxWidth="sm" sx={{ mt: 4, mb: 4 }}>
            <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
                {/* Success Icon */}
                <CheckCircleIcon 
                    sx={{ 
                        fontSize: 80, 
                        color: 'success.main', 
                        mb: 2 
                    }} 
                />
                
                {/* Success Message */}
                <Typography variant="h4" gutterBottom color="success.main" fontWeight="bold">
                    Payment Successful!
                </Typography>
                
                <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                    Your gift has been sent successfully. The recipient will receive SideCoins in their wallet.
                </Typography>

                {/* Payment Details Card */}
                {paymentData && (
                    <Card sx={{ mb: 3, textAlign: 'left' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <ReceiptIcon sx={{ mr: 1, color: 'primary.main' }} />
                                <Typography variant="h6" fontWeight="bold">
                                    Payment Receipt
                                </Typography>
                            </Box>
                            
                            <Divider sx={{ mb: 2 }} />
                            
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Payment ID:
                                </Typography>
                                <Typography variant="body2" fontFamily="monospace">
                                    {paymentData.paymentId}
                                </Typography>
                            </Box>
                            
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Amount Paid:
                                </Typography>
                                <Typography variant="body2" fontWeight="bold">
                                    {formatCurrency(paymentData.amount, paymentData.currency)}
                                </Typography>
                            </Box>
                            
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Status:
                                </Typography>
                                <Chip 
                                    label={paymentData.status === 'complete' ? 'Completed' : paymentData.status}
                                    color="success"
                                    size="small"
                                />
                            </Box>
                            
                            <Divider sx={{ my: 2 }} />
                            
                            <Alert severity="info" sx={{ mt: 2 }}>
                                <Typography variant="body2">
                                    <strong>Host Earnings:</strong> The recipient will receive approximately{' '}
                                    <strong>{((paymentData.amount * 0.8) / 0.005).toFixed(2)} SideCoins</strong>{' '}
                                    (80% of gift value) in their wallet.
                                </Typography>
                            </Alert>
                        </CardContent>
                    </Card>
                )}

                {/* Action Buttons */}
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Button
                        variant="contained"
                        onClick={() => navigate('/')}
                        startIcon={<HomeIcon />}
                        size="large"
                    >
                        Return Home
                    </Button>
                    
                    <Button
                        variant="outlined"
                        onClick={() => navigate('/wallet')}
                        startIcon={<GiftIcon />}
                        size="large"
                    >
                        View Wallet
                    </Button>
                </Box>

                {/* Additional Info */}
                <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
                    A receipt has been sent to your email address. Thank you for using SideEye!
                </Typography>
            </Paper>
        </Container>
    );
};

export default PaymentSuccess; 