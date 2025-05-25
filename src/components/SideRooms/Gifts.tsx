import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Box, 
    Typography, 
    Grid, 
    Paper, 
    Button, 
    Avatar, 
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Fade,
    Zoom,
    Alert,
    Card,
    CardContent,
    CircularProgress,
    TextField
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { db } from '../../services/firebase';
import { 
    collection, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    onSnapshot, 
    doc, 
    updateDoc, 
    increment, 
    Timestamp,
    getDoc,
    serverTimestamp
} from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import CloseIcon from '@mui/icons-material/Close';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import DiamondIcon from '@mui/icons-material/Diamond';
import FavoriteIcon from '@mui/icons-material/Favorite';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CelebrationIcon from '@mui/icons-material/Celebration';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import { keyframes } from '@mui/system';
import { toast } from 'react-hot-toast';
import SCCoinIcon from '../SCCoinIcon';

// --- Payment API Types ---
declare global {
    interface Window {
        PaymentRequest?: new (
            methodData: any[],
            details: any,
            options?: any
        ) => {
            show(): Promise<{
                methodName: string;
                details: any;
                payerName?: string;
                payerEmail?: string;
                payerPhone?: string;
                complete(result: 'success' | 'fail' | 'unknown'): Promise<void>;
            }>;
        };
        google?: {
            payments?: any;
        };
        ApplePaySession?: {
            canMakePayments(): boolean;
        };
        Stripe?: (key: string) => {
            confirmCardPayment(clientSecret: string, options?: any): Promise<{
                error?: { message: string };
                paymentIntent?: { status: string };
            }>;
        };
    }
}

// Define gift types
interface Gift {
    id: string;
    type: 'basic' | 'premium' | 'luxury';
    name: string;
    icon: React.ReactNode;
    value: number;
    color: string;
}

// Define the gift history item
interface GiftHistoryItem {
    id: string;
    giftId: string;
    giftType: string;
    giftName: string;
    senderId: string;
    senderName: string;
    receiverId: string;
    timestamp: any;
    value: number;
}

interface GiftsProps {
    roomId: string;
    roomOwnerId: string;
    theme: any;
    roomStyle?: any;
}

// Old SC packages removed - using direct payment now

// Define gift costs in real money (GBP)
const getGiftCost = (giftId: string): number => {
    const costs: Record<string, number> = {
        'heart-gift': 0.50,      // 50p
        'side-eye-gift': 0.75,   // 75p  
        'confetti-gift': 1.00,   // £1.00
        'crown-gift': 2.00,      // £2.00
    };
    return costs[giftId] || 0.50;
};

// Helper function to format currency
const formatCurrency = (amount: number, currency: string = 'GBP') => {
    return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    }).format(amount);
};

// Helper function to get currency symbol
const getCurrencySymbol = (currency: string = 'GBP') => {
    const symbols: Record<string, string> = {
        'GBP': '£',
        'USD': '$',
        'EUR': '€',
        'NGN': '₦'
    };
    return symbols[currency] || '£';
};

// Browser payment methods are automatically detected

// Helper functions for currency conversion
const formatSideCoins = (amount: number) => {
    return amount.toFixed(2);
};

const formatLittleCoins = (sideCoins: number) => {
    return Math.round(sideCoins * 100);
};

// Gift earning rate: 80% of gift cost goes to host (in SC equivalent)
const HOST_EARNING_RATE = 0.8;
const SC_TO_MONEY_RATE = 0.005; // 1 SC = £0.005 (0.5p) - matches wallet conversion rate

// Convert money to SideCoins for host earnings
const convertMoneyToSC = (moneyAmount: number): number => {
    return moneyAmount / SC_TO_MONEY_RATE;
};

// Calculate how many SideCoins the host will earn from a gift
const calculateHostEarnings = (giftCostInMoney: number): number => {
    const hostMoneyEarning = giftCostInMoney * HOST_EARNING_RATE; // 80% of gift cost
    return convertMoneyToSC(hostMoneyEarning); // Convert to SideCoins
};

// Define animations
const floatAnimation = keyframes`
  0% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-20px) scale(1.2); }
  100% { transform: translateY(-40px) scale(0.8); opacity: 0; }
`;

const pulseAnimation = keyframes`
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
`;

const sideEyeAnimation = keyframes`
  0% { transform: translateX(0); }
  20% { transform: translateX(-15px); }
  40% { transform: translateX(15px); }
  60% { transform: translateX(-15px); }
  80% { transform: translateX(15px); }
  100% { transform: translateX(0); }
`;

const crownAnimation = keyframes`
  0% { transform: translateY(20px) scale(0.5); opacity: 0; }
  20% { transform: translateY(0) scale(1.2); opacity: 1; }
  40% { transform: translateY(-10px) scale(1.0); }
  60% { transform: rotate(-10deg); }
  80% { transform: rotate(10deg); }
  100% { transform: rotate(0) scale(1.1); }
`;

const confettiItem = keyframes`
  0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate(var(--x-end), var(--y-end)) rotate(var(--rotation)); opacity: 0; }
`;

// Confetti particle component
const ConfettiParticle = ({ color, delay, size }: { color: string, delay: number, size: number }) => {
    const xEnd = Math.random() * 300 - 150; // Random x between -150 and 150
    const yEnd = Math.random() * 200 - 50; // Random y between -50 and 150
    const rotation = Math.random() * 360; // Random rotation
    
    return (
        <Box 
            sx={{
                position: 'absolute',
                width: size,
                height: size,
                backgroundColor: color,
                borderRadius: '2px',
                opacity: 1,
                animation: `${confettiItem} 2s forwards ease-out`,
                animationDelay: `${delay}ms`,
                '--x-end': `${xEnd}px`,
                '--y-end': `${yEnd}px`,
                '--rotation': `${rotation}deg`,
            }}
        />
    );
};

// Confetti explosion component
const ConfettiExplosion = () => {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ff9900', '#9900ff'];
    const particles = [];
    
    // Generate 100 confetti particles
    for (let i = 0; i < 100; i++) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        const delay = Math.random() * 500; // Random delay up to 500ms
        const size = Math.random() * 6 + 4; // Random size between 4-10px
        
        particles.push(
            <ConfettiParticle 
                key={i} 
                color={color} 
                delay={delay} 
                size={size} 
            />
        );
    }
    
    return (
        <Box 
            sx={{ 
                position: 'absolute', 
                top: '50%', 
                left: '50%', 
                transform: 'translate(-50%, -50%)',
                width: 0,
                height: 0
            }}
        >
            {particles}
        </Box>
    );
};

// Side eye animation component
const SideEyeAnimation = ({ color }: { color: string }) => {
    return (
        <Box 
            sx={{
                display: 'flex',
                justifyContent: 'center',
                gap: 3,
                animation: `${sideEyeAnimation} 1.5s ease-in-out infinite`,
            }}
        >
            <Box 
                sx={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    border: '2px solid black',
                    overflow: 'hidden',
                }}
            >
                <Box 
                    sx={{
                        width: '25px',
                        height: '25px',
                        borderRadius: '50%',
                        backgroundColor: color,
                        marginRight: '2px',
                    }}
                />
            </Box>
            <Box 
                sx={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    border: '2px solid black',
                    overflow: 'hidden',
                }}
            >
                <Box 
                    sx={{
                        width: '25px',
                        height: '25px',
                        borderRadius: '50%',
                        backgroundColor: color,
                        marginRight: '2px',
                    }}
                />
            </Box>
        </Box>
    );
};

const GiftAnimation: React.FC<{ gift: Gift, onAnimationComplete: () => void }> = ({ gift, onAnimationComplete }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onAnimationComplete();
        }, 2500); // Animation duration
        
        return () => clearTimeout(timer);
    }, [onAnimationComplete]);
    
    const renderCustomAnimation = () => {
        switch (gift.id) {
            case 'side-eye-gift':
                return (
                    <Box 
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            animation: `${floatAnimation} 2.5s ease-out forwards`,
                        }}
                    >
                        <SideEyeAnimation color={gift.color} />
                        <Typography 
                            variant="h5" 
                            sx={{ 
                                color: 'white', 
                                fontWeight: 'bold',
                                textShadow: '0 0 10px rgba(0,0,0,0.5)',
                                mt: 2
                            }}
                        >
                            Side Eye!
                        </Typography>
                    </Box>
                );
                
            case 'crown-gift':
                return (
                    <Box 
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                        }}
                    >
                        <Box 
                            sx={{ 
                                color: gift.color,
                                fontSize: 120,
                                filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.8))',
                                animation: `${crownAnimation} 2s ease-out forwards`,
                                transformOrigin: 'center bottom',
                            }}
                        >
                            <WorkspacePremiumIcon fontSize="inherit" />
                        </Box>
                        <Typography 
                            variant="h5" 
                            sx={{ 
                                color: 'white', 
                                fontWeight: 'bold',
                                textShadow: '0 0 10px rgba(0,0,0,0.5)',
                                mt: 2
                            }}
                        >
                            Crown!
                        </Typography>
                    </Box>
                );
                
            case 'confetti-gift':
                return (
                    <Box 
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            position: 'relative',
                        }}
                    >
                        <ConfettiExplosion />
                        <Box 
                            sx={{ 
                                color: gift.color,
                                fontSize: 100,
                                animation: `${pulseAnimation} 0.5s ease-in-out infinite`,
                                filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.7))',
                                zIndex: 1,
                            }}
                        >
                            <CelebrationIcon fontSize="inherit" />
                        </Box>
                        <Typography 
                            variant="h5" 
                            sx={{ 
                                color: 'white', 
                                fontWeight: 'bold',
                                textShadow: '0 0 10px rgba(0,0,0,0.5)',
                                mt: 2,
                                zIndex: 1,
                            }}
                        >
                            Confetti!
                        </Typography>
                    </Box>
                );
                
            // Default animation for other gifts
            default:
                return (
                    <Box 
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            animation: `${floatAnimation} 2.5s ease-out forwards`,
                        }}
                    >
                        <Box 
                            sx={{ 
                                color: gift.color,
                                fontSize: 100,
                                animation: `${pulseAnimation} 0.5s ease-in-out infinite`,
                                filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.7))'
                            }}
                        >
                            {gift.icon}
                        </Box>
                        <Typography 
                            variant="h5" 
                            sx={{ 
                                color: 'white', 
                                fontWeight: 'bold',
                                textShadow: '0 0 10px rgba(0,0,0,0.5)',
                                mt: 2
                            }}
                        >
                            {gift.name}!
                        </Typography>
                    </Box>
                );
        }
    };
    
    return (
        <Box
            sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 9999,
                pointerEvents: 'none',
                bgcolor: 'rgba(0, 0, 0, 0.3)'
            }}
        >
            {renderCustomAnimation()}
        </Box>
    );
};

const Gifts: React.FC<GiftsProps> = ({ roomId, roomOwnerId, theme, roomStyle }) => {
    const { currentUser } = useAuth();
    const [freeGifts, setFreeGifts] = useState<Gift[]>([
        { 
            id: 'side-eye-gift', 
            type: 'basic', 
            name: 'Side Eye', 
            icon: <VisibilityIcon />, 
            value: getGiftCost('side-eye-gift'), // 75p
            color: '#9C27B0' 
        },
        { 
            id: 'heart-gift', 
            type: 'basic', 
            name: 'Heart', 
            icon: <FavoriteIcon />, 
            value: getGiftCost('heart-gift'), // 50p
            color: '#FF5C8D' 
        },
        { 
            id: 'confetti-gift', 
            type: 'basic', 
            name: 'Confetti', 
            icon: <CelebrationIcon />, 
            value: getGiftCost('confetti-gift'), // £1.00
            color: '#FF9800' 
        },
        { 
            id: 'crown-gift', 
            type: 'basic', 
            name: 'Crown', 
            icon: <WorkspacePremiumIcon />, 
            value: getGiftCost('crown-gift'), // £2.00
            color: '#FFC107' 
        }
    ]);
    
    const [paidGifts, setPaidGifts] = useState<Gift[]>([]);
    
    // Combined gifts for gift history lookup
    const allGifts = useMemo(() => [...freeGifts, ...paidGifts], [freeGifts, paidGifts]);
    
    const [giftHistory, setGiftHistory] = useState<GiftHistoryItem[]>([]);
    const [selectedGift, setSelectedGift] = useState<Gift | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showAnimation, setShowAnimation] = useState(false);
    const [animatingGift, setAnimatingGift] = useState<Gift | null>(null);

    // Payment processing state
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [cardDetails, setCardDetails] = useState({
        cardNumber: '',
        expiryMonth: '',
        expiryYear: '',
        cvc: '',
        cardholderName: '',
        email: ''
    });

    const handleCardPayment = async () => {
        if (!currentUser || !selectedGift || !roomId || !roomOwnerId) return;
        
        setIsProcessingPayment(true);
        
        try {
            const giftCost = getGiftCost(selectedGift.id);
            
            // Validate card details
            if (!cardDetails.cardNumber || !cardDetails.expiryMonth || !cardDetails.expiryYear || !cardDetails.cvc || !cardDetails.email) {
                throw new Error('Please fill in all card details and email address');
            }
            
            // Clean and validate card number
            const cleanCardNumber = cardDetails.cardNumber.replace(/\s/g, '');
            if (cleanCardNumber.length < 13 || cleanCardNumber.length > 19) {
                throw new Error('Please enter a valid card number');
            }
            
            // Validate expiry date
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth() + 1;
            const expiryYear = parseInt(cardDetails.expiryYear);
            const expiryMonth = parseInt(cardDetails.expiryMonth);
            
            if (expiryYear < currentYear || (expiryYear === currentYear && expiryMonth < currentMonth)) {
                throw new Error('Card has expired');
            }
            
            // Validate CVC
            if (cardDetails.cvc.length < 3 || cardDetails.cvc.length > 4) {
                throw new Error('Please enter a valid CVC');
            }
            
            // Validate email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(cardDetails.email)) {
                throw new Error('Please enter a valid email address');
            }
            
            // Send payment to backend with real Stripe integration
            const apiUrl = 'https://sideeye-backend-production.up.railway.app/api/process-gift-payment';
            
            console.log('[Gift Payment] Processing real payment for:', {
                giftId: selectedGift.id,
                amount: giftCost,
                currency: 'GBP'
            });
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    giftId: selectedGift.id,
                    giftName: selectedGift.name,
                    amount: giftCost,
                    currency: 'GBP',
                    senderId: currentUser.uid,
                    senderName: currentUser.displayName || 'Anonymous',
                    receiverId: roomOwnerId,
                    roomId: roomId,
                    paymentMethod: 'card',
                    paymentDetails: {
                        cardNumber: cleanCardNumber,
                        expiryMonth: cardDetails.expiryMonth.padStart(2, '0'),
                        expiryYear: cardDetails.expiryYear,
                        cvc: cardDetails.cvc,
                        cardholderName: cardDetails.cardholderName || 'Anonymous'
                    },
                    customerEmail: cardDetails.email,
                    description: `SideEye Gift: ${selectedGift.name}`,
                    metadata: {
                        giftId: selectedGift.id,
                        senderId: currentUser.uid,
                        receiverId: roomOwnerId,
                        roomId: roomId,
                        type: 'gift_payment'
                    }
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Payment API Error:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText
                });
                
                // Parse error message if possible
                try {
                    const errorData = JSON.parse(errorText);
                    throw new Error(errorData.error || `Payment failed: ${response.status}`);
                } catch {
                    throw new Error(`Payment failed: ${response.status} ${response.statusText}`);
                }
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Payment processing failed');
            }
            
            // Clear form on success
            setShowPaymentForm(false);
            setCardDetails({
                cardNumber: '',
                expiryMonth: '',
                expiryYear: '',
                cvc: '',
                cardholderName: '',
                email: ''
            });
            
            const hostEarnings = calculateHostEarnings(giftCost);
            toast.success(`🎉 Payment successful! Gift sent and host earned ${formatSideCoins(hostEarnings)} SC`, {
                duration: 6000,
                position: 'top-right',
            });
            
            console.log('[Gift Payment] Payment completed successfully:', result.paymentId);
            
        } catch (error: any) {
            console.error('[Gift Payment] Payment error:', error);
            toast.error(error.message || 'Payment failed. Please try again.');
        } finally {
            setIsProcessingPayment(false);
        }
    };

    // Check if current user is the room owner
    const isRoomOwner = currentUser?.uid === roomOwnerId;

    // Keep track of processed gifts to prevent duplicate animations
    const processedGiftsRef = useRef<Set<string>>(new Set());
    
    // Track first load to prevent animations when component mounts
    const isFirstLoadRef = useRef<boolean>(true);

    // Remove old balance tracking - no longer needed for direct payment

    // Fetch gift history for this room
    useEffect(() => {
        if (!roomId) return;

        const giftHistoryRef = collection(db, 'sideRooms', roomId, 'gifts');
        const giftHistoryQuery = query(
            giftHistoryRef,
            orderBy('timestamp', 'desc')
        );

        const unsubscribe = onSnapshot(giftHistoryQuery, (snapshot) => {
            const gifts: GiftHistoryItem[] = [];
            
            // Check for new gifts to animate for room owner
            if (currentUser?.uid === roomOwnerId && !isFirstLoadRef.current && snapshot.docChanges().length > 0) {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        // Find the gift to animate
                        const giftData = change.doc.data();
                        const giftId = change.doc.id;
                        
                        // Only process if we haven't seen this gift before
                        if (!processedGiftsRef.current.has(giftId)) {
                            processedGiftsRef.current.add(giftId);
                            
                            const matchingGift = allGifts.find(g => g.id === giftData.giftId);
                            
                            // Don't animate your own gifts
                            if (giftData.senderId !== currentUser.uid && matchingGift) {
                                setAnimatingGift(matchingGift);
                                setShowAnimation(true);
                            }
                        }
                    }
                });
            }
            
            // Mark first load as complete after processing
            if (isFirstLoadRef.current) {
                // Initialize processedGifts with existing gift IDs to avoid animating old gifts
                snapshot.forEach(doc => {
                    processedGiftsRef.current.add(doc.id);
                });
                
                isFirstLoadRef.current = false;
            }
            
            snapshot.forEach((doc) => {
                const data = doc.data();
                gifts.push({
                    id: doc.id,
                    giftId: data.giftId,
                    giftType: data.giftType,
                    giftName: data.giftName,
                    senderId: data.senderId,
                    senderName: data.senderName,
                    receiverId: data.receiverId,
                    timestamp: data.timestamp,
                    value: data.value
                });
            });
            setGiftHistory(gifts);
        });

        return () => unsubscribe();
    }, [roomId, currentUser, roomOwnerId, allGifts]);

    // Add a useEffect for the GiftAnimation component to ensure it renders properly
    useEffect(() => {
        const renderCustomAnimation = () => {
            if (!animatingGift) return null;
            
            switch (animatingGift.id) {
                case 'side-eye-gift':
                    return <SideEyeAnimation color={animatingGift.color} />;
                case 'crown-gift':
                    return (
                        <Box 
                            sx={{ 
                                color: animatingGift.color,
                                fontSize: 120,
                                filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.8))',
                                animation: `${crownAnimation} 2s ease-out forwards`,
                                transformOrigin: 'center bottom',
                            }}
                        >
                            <WorkspacePremiumIcon fontSize="inherit" />
                        </Box>
                    );
                case 'confetti-gift':
                    return <ConfettiExplosion />;
                case 'heart-gift':
                    return (
                        <Box 
                            sx={{ 
                                color: animatingGift.color,
                                fontSize: 100,
                                animation: `${pulseAnimation} 0.5s ease-in-out infinite`,
                                filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.7))'
                            }}
                        >
                            <FavoriteIcon fontSize="inherit" />
                        </Box>
                    );
                default:
                    return (
                        <Box 
                            sx={{ 
                                color: animatingGift.color,
                                fontSize: 100,
                                animation: `${pulseAnimation} 0.5s ease-in-out infinite`,
                                filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.7))'
                            }}
                        >
                            {animatingGift.icon}
                        </Box>
                    );
            }
        };
    }, [animatingGift]);

    const handleOpenGiftDialog = (gift: Gift) => {
        // Prevent room owners from sending gifts to themselves
        if (isRoomOwner) return;
        
        setSelectedGift(gift);
        setDialogOpen(true);
    };

    const handleCloseGiftDialog = () => {
        setDialogOpen(false);
    };

    const handleSendGift = async () => {
        if (!currentUser || !selectedGift || !roomId || !roomOwnerId) return;
        
        // Directly trigger payment
        setDialogOpen(false);
        await handlePaymentForGift();
    };

    // Show payment confirmation dialog
    const handlePaymentForGift = async () => {
        if (!currentUser || !selectedGift || !roomId || !roomOwnerId) return;
        
        // Show the payment dialog instead of processing immediately
        setShowPaymentDialog(true);
    };

    // Process the actual payment using browser's built-in Web Payments API
    const handleConfirmPayment = async () => {
        if (!currentUser || !selectedGift || !roomId || !roomOwnerId) return;
        
        setIsProcessingPayment(true);
        
        try {
            const giftCost = getGiftCost(selectedGift.id);
            
            // Show payment form
            setShowPaymentDialog(false);
            setShowPaymentForm(true);
            
        } catch (error: any) {
            console.error('Error processing gift payment:', error);
            
            // Handle specific payment errors
            if (error.name === 'AbortError') {
                toast.error('Payment was cancelled by user');
            } else if (error.name === 'NotSupportedError') {
                toast.error('Payment method not supported in your browser. Please try a different browser or device.');
            } else if (error.message?.includes('No payment methods available')) {
                toast.error('No payment methods available. Please add a payment method to your browser or try a different device.');
            } else if (error?.message === 'Payment was cancelled') {
                toast.error('Payment was cancelled');
            } else {
                toast.error(`Payment failed: ${error?.message || 'Unknown error occurred'}`);
            }
        } finally {
            setIsProcessingPayment(false);
        }
    };
    




    const handleAnimationComplete = () => {
        setShowAnimation(false);
        setAnimatingGift(null);
    };

    // Old purchase functions removed - using direct payment now

    return (
        <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            height: 400, 
            maxHeight: '50vh',
            border: `1px solid ${roomStyle?.accentColor ? alpha(roomStyle?.accentColor, 0.3) : theme.palette.divider}`, 
            borderRadius: 1, 
            overflow: 'hidden' 
        }}>
            {/* Animation overlay */}
            {showAnimation && animatingGift && (
                <GiftAnimation 
                    gift={animatingGift} 
                    onAnimationComplete={handleAnimationComplete} 
                />
            )}
            
            {/* Main Container with scrolling */}
            <Box sx={{ 
                flexGrow: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                overflowY: 'auto',
                '&::-webkit-scrollbar': {
                    width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                    backgroundColor: alpha(theme.palette.background.paper, 0.1),
                },
                '&::-webkit-scrollbar-thumb': {
                    backgroundColor: alpha(roomStyle?.accentColor || theme.palette.primary.main, 0.3),
                    borderRadius: '4px',
                },
                '&::-webkit-scrollbar-thumb:hover': {
                    backgroundColor: alpha(roomStyle?.accentColor || theme.palette.primary.main, 0.5),
                }
            }}>
                {/* Free Gifts Section - Only show if not room owner */}
                {!isRoomOwner && (
                    <Box sx={{
                        p: 1.5,
                        borderBottom: `1px solid ${roomStyle?.accentColor ? alpha(roomStyle?.accentColor, 0.3) : theme.palette.divider}`,
                        bgcolor: roomStyle?.headerColor ? alpha(roomStyle?.headerColor, 0.1) : alpha(theme.palette.background.paper, 0.7),
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5
                    }}>
                        <Typography variant="subtitle2" fontWeight="medium" sx={{ 
                            fontFamily: roomStyle?.font || 'inherit', 
                            color: roomStyle?.textColor || 'inherit' 
                        }}>
                            Send Gifts with Real Money
                        </Typography>
                        <Typography variant="caption" sx={{ 
                            color: alpha(roomStyle?.textColor || theme.palette.text.secondary, 0.8),
                            fontFamily: roomStyle?.font || 'inherit'
                        }}>
                            Pay securely with card, Google Pay, Apple Pay, or Flutterwave • Host earns SideCoins
                        </Typography>
                        <Grid container spacing={2} sx={{ mt: 0.5 }}>
                            {freeGifts.map((gift) => {
                                const giftCost = getGiftCost(gift.id);
                                
                                return (
                                <Grid item xs={6} sm={3} key={gift.id}>
                                    <Paper 
                                        elevation={2} 
                                        sx={{ 
                                            p: 1.5, 
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            bgcolor: alpha(gift.color, 0.1),
                                            border: `1px solid ${alpha(gift.color, 0.3)}`,
                                            '&:hover': {
                                                transform: 'translateY(-3px)',
                                                boxShadow: 3
                                            }
                                        }}
                                        onClick={() => handleOpenGiftDialog(gift)}
                                    >
                                        <Box sx={{ 
                                            color: gift.color, 
                                            mb: 1, 
                                            fontSize: 30, 
                                            display: 'flex', 
                                            justifyContent: 'center' 
                                        }}>
                                            {gift.icon}
                                        </Box>
                                        <Typography variant="body2" fontWeight="medium" sx={{ 
                                            fontFamily: roomStyle?.font || 'inherit',
                                            color: roomStyle?.textColor || theme.palette.text.primary
                                        }}>
                                            {gift.name}
                                        </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 1 }}>
                                                <Typography variant="body2" fontWeight="bold" sx={{
                                                    color: theme.palette.primary.main
                                                }}>
                                                    {formatCurrency(giftCost)}
                                                </Typography>
                                            </Box>
                                        <Box sx={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center', 
                                            gap: 0.3, 
                                            mt: 0.5 
                                        }}>
                                            <SCCoinIcon size="small" />
                                            <Typography variant="caption" sx={{ 
                                                color: alpha(roomStyle?.textColor || theme.palette.text.secondary, 0.7),
                                                fontSize: '0.65rem'
                                            }}>
                                                    Host gets {formatSideCoins(calculateHostEarnings(giftCost))} SC
                                            </Typography>
                                        </Box>
                                    </Paper>
                                </Grid>
                                );
                            })}
                        </Grid>
                    </Box>
                )}
                
                {/* Paid Gifts Section (Coming Soon) - Only show if not room owner */}
                {!isRoomOwner && (
                    <Box sx={{
                        p: 1.5,
                        borderBottom: `1px solid ${roomStyle?.accentColor ? alpha(roomStyle?.accentColor, 0.3) : theme.palette.divider}`,
                        bgcolor: alpha(theme.palette.background.paper, 0.5),
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="subtitle2" fontWeight="medium" sx={{ 
                                fontFamily: roomStyle?.font || 'inherit', 
                                color: roomStyle?.textColor || 'inherit' 
                            }}>
                                Premium Gifts
                            </Typography>
                            <Chip 
                                size="small" 
                                label="Coming Soon" 
                                sx={{ 
                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                    color: theme.palette.primary.main,
                                    fontWeight: 'bold'
                                }} 
                            />
                        </Box>
                        <Box sx={{ 
                            p: 3, 
                            textAlign: 'center',
                            color: alpha(roomStyle?.textColor || theme.palette.text.primary, 0.6),
                            fontStyle: 'italic'
                        }}>
                            <CardGiftcardIcon sx={{ fontSize: 40, mb: 1, opacity: 0.4 }} />
                            <Typography variant="body2" sx={{ mb: 1 }}>
                                Premium gifts will be available soon! Stay tuned for exciting new ways to show your support.
                            </Typography>
                            <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: 0.5, 
                                mt: 1 
                            }}>
                                <SCCoinIcon size="small" />
                                <Typography variant="caption" sx={{ 
                                    color: alpha(roomStyle?.textColor || theme.palette.text.secondary, 0.8),
                                    fontWeight: 'medium'
                                }}>
                                    Requires 100.00 SC (10,000 LC) to unlock
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                )}

                {/* Room owner message when they are viewing their own room */}
                {isRoomOwner && (
                    <Box sx={{
                        p: 3,
                        textAlign: 'center',
                        bgcolor: roomStyle?.headerColor ? alpha(roomStyle?.headerColor, 0.1) : alpha(theme.palette.background.paper, 0.7),
                        borderBottom: `1px solid ${roomStyle?.accentColor ? alpha(roomStyle?.accentColor, 0.3) : theme.palette.divider}`,
                    }}>
                        <Typography variant="subtitle2" fontWeight="medium" sx={{ 
                            fontFamily: roomStyle?.font || 'inherit', 
                            color: roomStyle?.textColor || 'inherit',
                            mb: 1 
                        }}>
                            Room Owner View
                        </Typography>
                        <Typography variant="body2" sx={{ 
                            color: alpha(roomStyle?.textColor || theme.palette.text.secondary, 0.7),
                            fontFamily: roomStyle?.font || 'inherit'
                        }}>
                            As the room owner, you can view gifts that others have sent to you. You earn {formatCurrency(HOST_EARNING_RATE)} for each gift received!
                        </Typography>
                    </Box>
                )}

                {/* Gift History - Always show */}
                <Box sx={{ 
                    p: 2, 
                    bgcolor: roomStyle?.backgroundGradient ? alpha(roomStyle?.backgroundColor || theme.palette.background.default, 0.3) : alpha(theme.palette.background.paper, 0.5) 
                }}>
                    <Typography variant="subtitle2" fontWeight="medium" sx={{ 
                        mb: 2,
                        fontFamily: roomStyle?.font || 'inherit', 
                        color: roomStyle?.textColor || 'inherit' 
                    }}>
                        {isRoomOwner ? 'Gifts Received' : 'Recent Gifts'}
                    </Typography>

                    {giftHistory.length === 0 ? (
                        <Typography 
                            variant="body2" 
                            color={roomStyle?.textColor ? alpha(roomStyle?.textColor, 0.7) : "text.secondary"}
                            sx={{ 
                                textAlign: 'center', 
                                fontStyle: 'italic', 
                                mt: 4,
                                fontFamily: roomStyle?.font || 'inherit'
                            }}
                        >
                            {isRoomOwner 
                                ? "You haven't received any gifts yet." 
                                : "No gifts have been sent yet. Be the first to send a gift!"}
                        </Typography>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            {giftHistory.map((item) => {
                                // Find the gift color based on gift ID
                                const giftInfo = allGifts.find(g => g.id === item.giftId) || {
                                    id: item.giftId,
                                    type: item.giftType as 'basic' | 'premium' | 'luxury',
                                    name: item.giftName,
                                    icon: <CardGiftcardIcon />,
                                    value: item.value,
                                    color: '#757575'
                                };
                                
                                return (
                                    <Paper 
                                        key={item.id}
                                        elevation={1}
                                        sx={{ 
                                            p: 1.5, 
                                            display: 'flex', 
                                            alignItems: 'center',
                                            bgcolor: alpha(giftInfo.color, 0.05),
                                            border: `1px solid ${alpha(giftInfo.color, 0.2)}`
                                        }}
                                    >
                                        <Box sx={{ 
                                            color: giftInfo.color, 
                                            mr: 1.5, 
                                            display: 'flex' 
                                        }}>
                                            {giftInfo.icon}
                                        </Box>
                                        <Box sx={{ flexGrow: 1 }}>
                                            <Typography variant="body2" sx={{ 
                                                fontFamily: roomStyle?.font || 'inherit',
                                                color: roomStyle?.textColor || theme.palette.text.primary
                                            }}>
                                                <strong>{item.senderName}</strong> sent a <strong>{item.giftName}</strong>
                                            </Typography>
                                            <Typography variant="caption" sx={{ 
                                                color: alpha(roomStyle?.textColor || theme.palette.text.secondary, 0.7),
                                                fontFamily: roomStyle?.font || 'inherit'
                                            }}>
                                                {item.timestamp ? new Date(item.timestamp.toDate()).toLocaleString() : 'Just now'}
                                            </Typography>
                                        </Box>
                                    </Paper>
                                );
                            })}
                        </Box>
                    )}
                </Box>
            </Box>

            {/* Gift Confirmation Dialog */}
            <Dialog open={dialogOpen} onClose={handleCloseGiftDialog} maxWidth="xs" fullWidth>
                <DialogTitle>
                    Send Gift
                    <IconButton
                        aria-label="close"
                        onClick={handleCloseGiftDialog}
                        sx={{
                            position: 'absolute',
                            right: 8,
                            top: 8,
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    {selectedGift && (
                        <Box sx={{ textAlign: 'center', py: 2 }}>
                            <Box sx={{ 
                                color: selectedGift.color, 
                                fontSize: 60, 
                                mb: 2,
                                display: 'flex',
                                justifyContent: 'center'
                            }}>
                                {selectedGift.icon}
                            </Box>
                            <Typography variant="h6" gutterBottom>
                                {selectedGift.name}
                            </Typography>
                                <Box sx={{ 
                                    mt: 2, 
                                    p: 1.5, 
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                    borderRadius: 1,
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
                                }}>
                                <Typography variant="h5" color="primary" sx={{ fontWeight: 'bold', mb: 1 }}>
                                    {formatCurrency(getGiftCost(selectedGift.id))}
                                    </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                    Host will receive {formatSideCoins(calculateHostEarnings(getGiftCost(selectedGift.id)))} SC
                                </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                    Secure payment via multiple methods available
                                        </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                            Your browser will show available payment methods (cards, Apple Pay, Google Pay)
                                        </Typography>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseGiftDialog} color="inherit">
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSendGift} 
                        variant="contained"
                        color="primary"
                        disabled={isLoading || isProcessingPayment}
                        sx={{
                            bgcolor: selectedGift?.color,
                            '&:hover': {
                                bgcolor: alpha(selectedGift?.color || '#000', 0.8)
                            }
                        }}
                    >
                        {isLoading || isProcessingPayment ? 'Processing...' : 'Send Gift'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Beautiful Payment Confirmation Dialog */}
            <Dialog 
                open={showPaymentDialog} 
                onClose={() => setShowPaymentDialog(false)} 
                maxWidth="sm" 
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        background: `linear-gradient(135deg, ${theme.palette.background.paper}, ${alpha(theme.palette.primary.main, 0.05)})`,
                    }
                }}
            >
                <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        {selectedGift && (
                            <Box sx={{ 
                                color: selectedGift.color, 
                                fontSize: 48,
                                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))'
                            }}>
                                {selectedGift.icon}
                            </Box>
                        )}
                        <Typography variant="h5" fontWeight="bold">
                            Confirm Gift Payment
                        </Typography>
                    </Box>
                    <IconButton
                        aria-label="close"
                        onClick={() => setShowPaymentDialog(false)}
                        sx={{
                            position: 'absolute',
                            right: 8,
                            top: 8,
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                
                <DialogContent sx={{ pt: 0 }}>
                    {selectedGift && (
                        <Box>
                            {/* Gift Details */}
                            <Paper 
                                elevation={0} 
                                sx={{ 
                                    p: 3, 
                                    mb: 3, 
                                    textAlign: 'center',
                                    background: alpha(selectedGift.color, 0.1),
                                    border: `2px solid ${alpha(selectedGift.color, 0.3)}`,
                                    borderRadius: 2
                                }}
                            >
                                <Typography variant="h6" gutterBottom fontWeight="bold">
                                    {selectedGift.name}
                                </Typography>
                                <Typography variant="h4" color="primary" fontWeight="bold" sx={{ mb: 1 }}>
                                    £{getGiftCost(selectedGift.id).toFixed(2)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    One-time payment
                                </Typography>
                            </Paper>

                            {/* What Happens */}
                        <Box sx={{ mb: 3 }}>
                                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                    What happens when you pay:
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Box sx={{ 
                                            width: 32, 
                                            height: 32, 
                                            borderRadius: '50%', 
                                            bgcolor: 'success.main', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            color: 'white',
                                            fontWeight: 'bold'
                                        }}>
                                            1
                                    </Box>
                                        <Typography variant="body2">
                                            Your payment method will be charged £{getGiftCost(selectedGift.id).toFixed(2)}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Box sx={{ 
                                            width: 32, 
                                            height: 32, 
                                            borderRadius: '50%', 
                                            bgcolor: 'primary.main', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            color: 'white',
                                            fontWeight: 'bold'
                                        }}>
                                            2
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Typography variant="body2">
                                                Host receives {formatSideCoins(calculateHostEarnings(getGiftCost(selectedGift.id)))} SC
                                        </Typography>
                                            <SCCoinIcon size="small" />
                                    </Box>
                                </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Box sx={{ 
                                            width: 32, 
                                            height: 32, 
                                            borderRadius: '50%', 
                                            bgcolor: 'secondary.main', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            color: 'white',
                                            fontWeight: 'bold'
                                        }}>
                                            3
                                        </Box>
                                        <Typography variant="body2">
                                            Gift animation plays in the room
                            </Typography>
                                    </Box>
                                </Box>
                            </Box>

                            {/* Payment Method Info */}
                            <Alert severity="info" sx={{ mb: 2 }}>
                                <Typography variant="body2">
                                    <strong>Secure Payment:</strong> You'll be prompted to pay with your browser's secure payment methods (Apple Pay, Google Pay, or saved cards).
                                </Typography>
                            </Alert>

                            {/* Host Earnings Info */}
                            <Box sx={{ 
                                p: 2, 
                                bgcolor: alpha(theme.palette.success.main, 0.1),
                                borderRadius: 1,
                                border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`
                            }}>
                                <Typography variant="body2" color="success.main" fontWeight="bold">
                                    💰 Host can withdraw SideCoins as real money monthly!
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                    {formatSideCoins(calculateHostEarnings(getGiftCost(selectedGift.id)))} SC = £{(calculateHostEarnings(getGiftCost(selectedGift.id)) * SC_TO_MONEY_RATE).toFixed(2)} withdrawable
                                    </Typography>
                            </Box>
                        </Box>
                    )}
                </DialogContent>
                
                <DialogActions sx={{ p: 3, pt: 0 }}>
                    <Button 
                        onClick={() => setShowPaymentDialog(false)} 
                        variant="outlined"
                        size="large"
                        sx={{ minWidth: 120 }}
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleConfirmPayment}
                        variant="contained" 
                        size="large"
                        disabled={isProcessingPayment}
                        startIcon={isProcessingPayment ? <CircularProgress size={20} /> : null}
                        sx={{
                            minWidth: 160,
                            bgcolor: selectedGift?.color,
                            '&:hover': {
                                bgcolor: alpha(selectedGift?.color || '#000', 0.8)
                            }
                        }}
                    >
                        {isProcessingPayment ? 'Processing...' : `Pay £${selectedGift ? getGiftCost(selectedGift.id).toFixed(2) : '0.00'}`}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Payment Form Dialog */}
            <Dialog open={showPaymentForm} onClose={() => setShowPaymentForm(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {selectedGift && (
                            <Box sx={{ color: selectedGift.color, fontSize: 32 }}>
                                {selectedGift.icon}
                            </Box>
                        )}
                        <Typography variant="h6">Payment Details</Typography>
                    </Box>
                    <IconButton
                        aria-label="close"
                        onClick={() => setShowPaymentForm(false)}
                        sx={{ position: 'absolute', right: 8, top: 8 }}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                
                <DialogContent>
                    {selectedGift && (
                        <Box>
                            <Typography variant="h6" gutterBottom>
                                {selectedGift.name} - £{getGiftCost(selectedGift.id).toFixed(2)}
                            </Typography>
                            
                            <Box 
                                component="form" 
                                autoComplete="on"
                                sx={{ mt: 3 }}
                                onSubmit={(e) => e.preventDefault()}
                            >
                                <TextField
                                    fullWidth
                                    label="Card Number"
                                    name="cardnumber"
                                    value={cardDetails.cardNumber}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCardDetails(prev => ({ ...prev, cardNumber: e.target.value }))}
                                    placeholder="1234 5678 9012 3456"
                                    autoComplete="cc-number"
                                    inputProps={{
                                        inputMode: 'numeric',
                                        pattern: '[0-9\\s]{13,19}',
                                        maxLength: 19
                                    }}
                                    sx={{ mb: 2 }}
                                />
                                
                                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                                    <TextField
                                        label="Expiry Month"
                                        name="cc-exp-month"
                                        value={cardDetails.expiryMonth}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCardDetails(prev => ({ ...prev, expiryMonth: e.target.value }))}
                                        placeholder="MM"
                                        autoComplete="cc-exp-month"
                                        inputProps={{
                                            inputMode: 'numeric',
                                            pattern: '[0-9]{2}',
                                            maxLength: 2
                                        }}
                                        sx={{ flex: 1 }}
                                    />
                                    <TextField
                                        label="Expiry Year"
                                        name="cc-exp-year"
                                        value={cardDetails.expiryYear}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCardDetails(prev => ({ ...prev, expiryYear: e.target.value }))}
                                        placeholder="YYYY"
                                        autoComplete="cc-exp-year"
                                        inputProps={{
                                            inputMode: 'numeric',
                                            pattern: '[0-9]{4}',
                                            maxLength: 4
                                        }}
                                        sx={{ flex: 1 }}
                                    />
                                    <TextField
                                        label="CVC"
                                        name="cvc"
                                        value={cardDetails.cvc}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCardDetails(prev => ({ ...prev, cvc: e.target.value }))}
                                        placeholder="123"
                                        autoComplete="cc-csc"
                                        inputProps={{
                                            inputMode: 'numeric',
                                            pattern: '[0-9]{3,4}',
                                            maxLength: 4
                                        }}
                                        sx={{ flex: 1 }}
                                    />
                                </Box>
                                
                                <TextField
                                    fullWidth
                                    label="Cardholder Name"
                                    name="cc-name"
                                    value={cardDetails.cardholderName}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCardDetails(prev => ({ ...prev, cardholderName: e.target.value }))}
                                    placeholder="John Smith"
                                    autoComplete="cc-name"
                                    sx={{ mb: 2 }}
                                />
                                
                                <TextField
                                    fullWidth
                                    label="Email Address"
                                    name="email"
                                    type="email"
                                    value={cardDetails.email}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCardDetails(prev => ({ ...prev, email: e.target.value }))}
                                    placeholder="your@email.com"
                                    autoComplete="email"
                                    sx={{ mb: 2 }}
                                />
                            </Box>
                            
                            <Alert severity="info" sx={{ mt: 2 }}>
                                <Typography variant="body2">
                                    Your payment will be processed securely. The host will receive {formatSideCoins(calculateHostEarnings(getGiftCost(selectedGift.id)))} SC.
                                </Typography>
                            </Alert>
                        </Box>
                    )}
                </DialogContent>
                
                <DialogActions sx={{ p: 3 }}>
                    <Button onClick={() => setShowPaymentForm(false)} variant="outlined">
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleCardPayment}
                        variant="contained"
                        disabled={isProcessingPayment}
                        startIcon={isProcessingPayment ? <CircularProgress size={20} /> : null}
                        sx={{
                            bgcolor: selectedGift?.color,
                            '&:hover': {
                                bgcolor: alpha(selectedGift?.color || '#000', 0.8)
                            }
                        }}
                    >
                        {isProcessingPayment ? 'Processing...' : `Pay £${selectedGift ? getGiftCost(selectedGift.id).toFixed(2) : '0.00'}`}
                    </Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
};

export default Gifts; 