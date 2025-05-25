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
    CircularProgress
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
    getDoc
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

// Payment methods configuration
interface PaymentMethod {
    id: string;
    name: string;
    icon: string;
    supportedCountries: string[];
    currencies: string[];
}

const PAYMENT_METHODS: PaymentMethod[] = [
    {
        id: 'stripe',
        name: 'Card Payment',
        icon: '💳',
        supportedCountries: ['GB', 'US', 'EU', 'CA', 'AU'],
        currencies: ['GBP', 'USD', 'EUR', 'CAD', 'AUD']
    },
    {
        id: 'google_pay',
        name: 'Google Pay',
        icon: '🟢',
        supportedCountries: ['GB', 'US', 'EU', 'CA', 'AU', 'IN'],
        currencies: ['GBP', 'USD', 'EUR', 'CAD', 'AUD', 'INR']
    },
    {
        id: 'apple_pay',
        name: 'Apple Pay',
        icon: '🍎',
        supportedCountries: ['GB', 'US', 'EU', 'CA', 'AU'],
        currencies: ['GBP', 'USD', 'EUR', 'CAD', 'AUD']
    },
    {
        id: 'flutterwave',
        name: 'Flutterwave',
        icon: '🌊',
        supportedCountries: ['NG', 'GH', 'KE', 'UG', 'ZA'],
        currencies: ['NGN', 'GHS', 'KES', 'UGX', 'ZAR']
    }
];

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

    // Remove old SC purchase state - no longer needed
    
    // Add payment method state
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
    const [userCurrency, setUserCurrency] = useState<string>('GBP');
    const [userCountry, setUserCountry] = useState<string>('GB');
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);

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
        
        // Show payment dialog instead of checking balance
        setShowPaymentDialog(true);
        setDialogOpen(false);
    };

    // New function to handle direct payment for gifts
    const handlePaymentForGift = async () => {
        if (!currentUser || !selectedGift || !roomId || !roomOwnerId || !selectedPaymentMethod) return;
        
        setIsProcessingPayment(true);
        
        try {
            // Get the cost of this gift in real money
            const giftCostInMoney = getGiftCost(selectedGift.id);
            console.log('[Gift Payment] Gift cost in GBP:', giftCostInMoney);
            console.log('[Gift Payment] User currency:', userCurrency);
            console.log('[Gift Payment] User country:', userCountry);
            
            // Convert to user's currency if needed
            const convertedAmount = await convertCurrency(giftCostInMoney, 'GBP', userCurrency);
            console.log('[Gift Payment] Converted amount:', convertedAmount);
            
            // Call backend to process payment
            const backendUrl = 'https://sideeye-backend-production.up.railway.app';
            console.log('[Gift Payment] Sending request to:', `${backendUrl}/api/process-gift-payment`);
            
            const requestBody = {
                giftId: selectedGift.id,
                giftName: selectedGift.name,
                amount: Math.round(convertedAmount * 100), // Convert to smallest currency unit
                currency: userCurrency,
                paymentMethod: selectedPaymentMethod.id,
                senderId: currentUser.uid,
                senderName: currentUser.displayName || 'Anonymous',
                receiverId: roomOwnerId,
                roomId: roomId,
                country: userCountry
            };
            
            console.log('[Gift Payment] Request body:', requestBody);
            
            const response = await fetch(`${backendUrl}/api/process-gift-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });
            
            console.log('[Gift Payment] Response status:', response.status);
            console.log('[Gift Payment] Response headers:', Object.fromEntries(response.headers.entries()));
            
            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.text();
                    console.log('[Gift Payment] Error response body:', errorData);
                    errorMessage = errorData || errorMessage;
                } catch (e) {
                    console.log('[Gift Payment] Could not read error response body');
                }
                throw new Error(`Payment processing failed - ${errorMessage}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                // Handle different payment methods
                if (selectedPaymentMethod.id === 'stripe') {
                    // For Stripe Checkout, redirect to payment page
                    if (result.checkoutUrl) {
                        window.open(result.checkoutUrl, '_blank');
                        setShowPaymentDialog(false);
                        setSelectedPaymentMethod(null);
                        setIsProcessingPayment(false);
                        
                        toast.success('Redirecting to secure payment page...', {
                            duration: 3000,
                            position: 'top-right',
                        });
                        return;
                    }
                } else if (selectedPaymentMethod.id === 'flutterwave') {
                    // For Flutterwave, redirect to payment page
                    if (result.paymentUrl) {
                        window.open(result.paymentUrl, '_blank');
                        setShowPaymentDialog(false);
                        setSelectedPaymentMethod(null);
                        setIsProcessingPayment(false);
                        
                        toast.success('Redirecting to secure payment page...', {
                            duration: 3000,
                            position: 'top-right',
                        });
                        return;
                    }
                } else {
                    // For Google Pay/Apple Pay, handle client-side payment
                    if (result.clientSecret) {
                        // You would integrate with Stripe Elements here for Google Pay/Apple Pay
                        // For now, we'll show a message
                        toast.success('Payment initiated. Please complete the payment in the popup.', {
                            duration: 4000,
                            position: 'top-right',
                        });
                        
                        setShowPaymentDialog(false);
                        setSelectedPaymentMethod(null);
                        setIsProcessingPayment(false);
                        return;
                    }
                }
                
                // If we reach here, something went wrong
                throw new Error('Payment method not properly configured');
                
            } else {
                throw new Error(result.error || 'Payment failed');
            }
            
        } catch (error) {
            console.error('Error processing gift payment:', error);
            setIsProcessingPayment(false);
            toast.error(`Payment failed: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
        }
    };

    // Helper function to convert currency (you'll need to implement this with a real API)
    const convertCurrency = async (amount: number, fromCurrency: string, toCurrency: string): Promise<number> => {
        console.log('[Currency Conversion] Converting', amount, 'from', fromCurrency, 'to', toCurrency);
        
        if (fromCurrency === toCurrency) {
            console.log('[Currency Conversion] Same currency, returning original amount');
            return amount;
        }
        
        try {
            // In production, use a real currency conversion API
            // For now, using approximate rates
            const rates: Record<string, number> = {
                'GBP': 1,
                'USD': 1.27,
                'EUR': 1.17,
                'NGN': 950,
                'CAD': 1.71,
                'AUD': 1.91
            };
            
            const fromRate = rates[fromCurrency] || 1;
            const toRate = rates[toCurrency] || 1;
            const baseAmount = amount / fromRate;
            const convertedAmount = baseAmount * toRate;
            
            console.log('[Currency Conversion] Rates - from:', fromRate, 'to:', toRate);
            console.log('[Currency Conversion] Base amount:', baseAmount, 'Converted:', convertedAmount);
            
            return convertedAmount;
        } catch (error) {
            console.error('Currency conversion error:', error);
            return amount; // Fallback to original amount
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
                                Choose your payment method on the next screen
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
                        disabled={isLoading}
                        sx={{
                            bgcolor: selectedGift?.color,
                            '&:hover': {
                                bgcolor: alpha(selectedGift?.color || '#000', 0.8)
                            }
                        }}
                    >
                        {isLoading ? 'Processing...' : 'Continue to Payment'}
                    </Button>
                </DialogActions>
            </Dialog>



            {/* Payment Method Selection Dialog */}
            <Dialog open={showPaymentDialog} onClose={() => setShowPaymentDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h6">Choose Payment Method</Typography>
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
                <DialogContent>
                    {selectedGift && (
                        <Box sx={{ mb: 3 }}>
                            <Alert severity="info" sx={{ mb: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{ color: selectedGift.color, fontSize: 24 }}>
                                        {selectedGift.icon}
                                    </Box>
                                    <Box>
                                        <Typography variant="body2" fontWeight="bold">
                                            Sending: {selectedGift.name}
                                        </Typography>
                                        <Typography variant="body2">
                                            Cost: {formatCurrency(getGiftCost(selectedGift.id), userCurrency)}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Alert>
                            
                            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, mb: 1 }}>
                                Select Payment Method:
                            </Typography>
                            
                            <Grid container spacing={2}>
                                {PAYMENT_METHODS.map((method) => (
                                    <Grid item xs={6} key={method.id}>
                                        <Card 
                                            sx={{ 
                                                cursor: 'pointer',
                                                border: selectedPaymentMethod?.id === method.id ? '2px solid' : '1px solid',
                                                borderColor: selectedPaymentMethod?.id === method.id ? 'primary.main' : 'divider',
                                                '&:hover': { boxShadow: 2 }
                                            }}
                                            onClick={() => setSelectedPaymentMethod(method)}
                                        >
                                            <CardContent sx={{ textAlign: 'center', p: 2 }}>
                                                <Typography variant="h4" sx={{ mb: 1 }}>
                                                    {method.icon}
                                                </Typography>
                                                <Typography variant="body2" fontWeight="medium">
                                                    {method.name}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {method.currencies.join(', ')}
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                            
                            {selectedPaymentMethod && (
                                <Alert severity="success" sx={{ mt: 2 }}>
                                    <Typography variant="body2">
                                        ✓ {selectedPaymentMethod.name} selected
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        You will be redirected to complete your payment securely
                                    </Typography>
                                </Alert>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
                    <Button 
                        variant="contained" 
                        onClick={handlePaymentForGift}
                        disabled={!selectedPaymentMethod || isProcessingPayment}
                        startIcon={isProcessingPayment ? <CircularProgress size={20} /> : null}
                    >
                        {isProcessingPayment ? 'Processing...' : `Pay ${formatCurrency(selectedGift ? getGiftCost(selectedGift.id) : 0, userCurrency)}`}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Gifts; 