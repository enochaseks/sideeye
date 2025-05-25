import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container,
    Typography,
    Box,
    Paper,
    Grid,
    Card,
    CardContent,
    Chip,
    Button,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Alert,
    CircularProgress,
    useTheme,
    alpha
} from '@mui/material';
import {
    AccountBalanceWallet as WalletIcon,
    CardGiftcard as GiftIcon,
    Favorite as HeartIcon,
    Star as StarIcon,
    Diamond as DiamondIcon,
    WorkspacePremium as PremiumIcon,
    Info as InfoIcon,
    TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import SCCoinIcon from '../components/SCCoinIcon';
import { Helmet } from 'react-helmet-async';

interface UserStats {
    totalGiftsSent: number;
    totalGiftsReceived: number;
    totalCoinsEarned: number;
    totalCoinsSpent: number;
}

interface GiftTip {
    icon: React.ReactElement;
    title: string;
    description: string;
    coins: number | string;
}

const Wallet: React.FC = () => {
    const { currentUser } = useAuth();
    const theme = useTheme();
    const navigate = useNavigate();
    const [currentBalance, setCurrentBalance] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [userStats, setUserStats] = useState<UserStats>({
        totalGiftsSent: 0,
        totalGiftsReceived: 0,
        totalCoinsEarned: 0,
        totalCoinsSpent: 0
    });

    // Helper functions for currency conversion
    const formatSideCoins = (amount: number) => {
        return amount.toFixed(2);
    };

    const formatLittleCoins = (sideCoins: number) => {
        return Math.round(sideCoins * 100);
    };

    const formatCurrencyDisplay = (sideCoins: number) => {
        const sc = formatSideCoins(sideCoins);
        const lc = formatLittleCoins(sideCoins);
        return { sc, lc };
    };

    // Check if user has premium access (100.00 SC threshold)
    const hasPremiumAccess = currentBalance >= 100.00;
    const premiumProgress = Math.min((currentBalance / 100.00) * 100, 100);

    useEffect(() => {
        if (!currentUser?.uid) {
            setLoading(false);
            return;
        }

        console.log('[Wallet] Setting up real-time listeners for user:', currentUser.uid);
        
        // Real-time listener for user's balance
        const userRef = doc(db, 'users', currentUser.uid);
        const unsubscribeUser = onSnapshot(userRef, (userDoc) => {
            if (userDoc.exists()) {
                const userData = userDoc.data();
                setCurrentBalance(userData.sideCoins || 0);
                console.log('[Wallet] Balance updated:', userData.sideCoins || 0);
            }
        });

        // Function to calculate gift statistics in real-time
        const calculateGiftStats = async () => {
            let totalSent = 0;
            let totalReceived = 0;
            let coinsSpent = 0;
            
            try {
                console.log('[Wallet] Calculating gift statistics...');
                
                // Get all rooms to check their gifts
                const roomsSnapshot = await getDocs(collection(db, 'sideRooms'));
                
                const unsubscribeFunctions: (() => void)[] = [];
                
                for (const roomDoc of roomsSnapshot.docs) {
                    const roomId = roomDoc.id;
                    
                    // Real-time listener for gifts sent by user in this room
                    const giftsSentQuery = query(
                        collection(db, 'sideRooms', roomId, 'gifts'),
                        where('senderId', '==', currentUser.uid)
                    );
                    
                    const unsubscribeSent = onSnapshot(giftsSentQuery, (snapshot) => {
                        let roomSentCount = 0;
                        let roomCoinsSpent = 0;
                        
                        snapshot.forEach(giftDoc => {
                            const giftData = giftDoc.data();
                            roomSentCount++;
                            if (giftData.giftType !== 'basic') {
                                roomCoinsSpent += giftData.value || 0;
                            }
                        });
                        
                        // Update totals (this is a simplified approach - in production you'd want to track this more efficiently)
                        console.log(`[Wallet] Room ${roomId} - Sent: ${roomSentCount}, Spent: ${roomCoinsSpent}`);
                    });
                    
                    unsubscribeFunctions.push(unsubscribeSent);
                    
                    // Real-time listener for gifts received by user in this room
                    const giftsReceivedQuery = query(
                        collection(db, 'sideRooms', roomId, 'gifts'),
                        where('receiverId', '==', currentUser.uid)
                    );
                    
                    const unsubscribeReceived = onSnapshot(giftsReceivedQuery, (snapshot) => {
                        let roomReceivedCount = 0;
                        
                        snapshot.forEach(giftDoc => {
                            roomReceivedCount++;
                        });
                        
                        console.log(`[Wallet] Room ${roomId} - Received: ${roomReceivedCount}`);
                    });
                    
                    unsubscribeFunctions.push(unsubscribeReceived);
                }
                
                // For now, let's do a one-time calculation and then the listeners will update individual rooms
                // In a production app, you'd want to aggregate this data more efficiently
                await recalculateAllStats();
                
                // Return cleanup function for all gift listeners
                return () => {
                    unsubscribeFunctions.forEach(unsub => unsub());
                };
                
            } catch (error) {
                console.error('[Wallet] Error setting up gift listeners:', error);
                return () => {}; // Return empty cleanup function
            }
        };

        // Function to recalculate all statistics (used initially and when needed)
        const recalculateAllStats = async () => {
            let totalSent = 0;
            let totalReceived = 0;
            let actualCoinsSpent = 0; // Only count actual SideCoins spent on paid gifts
            let actualCoinsEarned = 0; // Calculate actual SideCoins earned from gifts received
            
            try {
                const roomsSnapshot = await getDocs(collection(db, 'sideRooms'));
                
                for (const roomDoc of roomsSnapshot.docs) {
                    const roomId = roomDoc.id;
                    
                    // Get gifts sent by user
                    const giftsSentQuery = query(
                        collection(db, 'sideRooms', roomId, 'gifts'),
                        where('senderId', '==', currentUser.uid)
                    );
                    
                    const giftsSentSnapshot = await getDocs(giftsSentQuery);
                    giftsSentSnapshot.forEach(giftDoc => {
                        const giftData = giftDoc.data();
                        totalSent++;
                        // Only count actual SideCoins spent on paid gifts (not free gift values)
                        if (giftData.giftType !== 'basic') {
                            actualCoinsSpent += giftData.value || 0;
                        }
                        // Free gifts (basic type) cost 0 SideCoins to send
                    });
                    
                    // Get gifts received by user
                    const giftsReceivedQuery = query(
                        collection(db, 'sideRooms', roomId, 'gifts'),
                        where('receiverId', '==', currentUser.uid)
                    );
                    
                    const giftsReceivedSnapshot = await getDocs(giftsReceivedQuery);
                    giftsReceivedSnapshot.forEach(() => {
                        totalReceived++;
                        // Calculate actual SideCoins earned: 0.08 per gift received
                        actualCoinsEarned += 0.08;
                    });
                }
                
                setUserStats({
                    totalGiftsSent: totalSent,
                    totalGiftsReceived: totalReceived,
                    totalCoinsEarned: Math.round(actualCoinsEarned * 100) / 100, // Round to 2 decimal places
                    totalCoinsSpent: actualCoinsSpent
                });
                
                console.log('[Wallet] Statistics updated:', { 
                    totalSent, 
                    totalReceived, 
                    actualCoinsEarned: Math.round(actualCoinsEarned * 100) / 100,
                    actualCoinsSpent 
                });
                
            } catch (error) {
                console.error('[Wallet] Error calculating statistics:', error);
            }
        };

        // Set up gift statistics listeners
        let cleanupGiftListeners: (() => void) | undefined;
        calculateGiftStats().then(cleanup => {
            cleanupGiftListeners = cleanup;
            setLoading(false);
        });

        // Cleanup function
        return () => {
            console.log('[Wallet] Cleaning up listeners');
            unsubscribeUser();
            if (cleanupGiftListeners) {
                cleanupGiftListeners();
            }
        };
    }, [currentUser?.uid]);

    const freeGiftTips: GiftTip[] = [
        {
            icon: <HeartIcon color="error" />,
            title: "Send Free Gifts",
            description: "Send hearts, side eyes, confetti, and crowns for free during live streams",
            coins: "Free"
        },
        {
            icon: <StarIcon color="warning" />,
            title: "Receive Gifts",
            description: "Earn 0.08 SC (8 LC) for each gift you receive",
            coins: "+0.08 SC"
        },
        {
            icon: <GiftIcon color="primary" />,
            title: "Host Live Rooms",
            description: "Create engaging content to attract gift-giving viewers and earn SideCoins",
            coins: "Varies"
        }
    ];

    const premiumGifts = [
        {
            name: "Diamond Crown",
            cost: 100,
            icon: <DiamondIcon sx={{ color: '#00BCD4' }} />,
            description: "Ultra-rare premium gift"
        },
        {
            name: "Golden Trophy",
            cost: 50,
            icon: <PremiumIcon sx={{ color: '#FFD700' }} />,
            description: "Show ultimate appreciation"
        },
        {
            name: "Ruby Heart",
            cost: 25,
            icon: <HeartIcon sx={{ color: '#E91E63' }} />,
            description: "Premium love gift"
        }
    ];

    if (loading) {
        return (
            <Container maxWidth="lg" sx={{ py: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                    <CircularProgress />
                </Box>
            </Container>
        );
    }

    return (
        <>
            <Helmet>
                <title>Wallet - SideEye</title>
                <meta name="description" content="Manage your SideCoins balance and learn about earning rewards" />
            </Helmet>

            <Container maxWidth="lg" sx={{ py: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
                    <WalletIcon fontSize="large" color="primary" />
                    My Wallet
                </Typography>

                <Grid container spacing={3}>
                    {/* Current Balance Card */}
                    <Grid item xs={12} md={6}>
                        <Card sx={{ 
                            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                            color: 'white',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <CardContent sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                    <Typography variant="h6">Current Balance</Typography>
                                    <SCCoinIcon size="large" />
                                </Box>
                                
                                {/* SideCoins Display */}
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="h3" component="div" fontWeight="bold">
                                        {formatSideCoins(currentBalance)} SC
                                    </Typography>
                                    <Typography variant="h6" sx={{ opacity: 0.8 }}>
                                        {formatLittleCoins(currentBalance)} LC
                                    </Typography>
                                </Box>

                                {/* Premium Status */}
                                <Box sx={{ mb: 2 }}>
                                    {hasPremiumAccess ? (
                                        <Chip 
                                            label="💎 Premium Access Unlocked" 
                                            sx={{ 
                                                backgroundColor: alpha('#FFD700', 0.2),
                                                color: '#FFD700',
                                                fontWeight: 'bold'
                                            }}
                                        />
                                    ) : (
                                        <Box>
                                            <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
                                                Premium Access Progress: {premiumProgress.toFixed(1)}%
                                            </Typography>
                                            <Box sx={{ 
                                                width: '100%', 
                                                height: 6, 
                                                backgroundColor: alpha('#fff', 0.2), 
                                                borderRadius: 3,
                                                overflow: 'hidden'
                                            }}>
                                                <Box sx={{ 
                                                    width: `${premiumProgress}%`, 
                                                    height: '100%', 
                                                    backgroundColor: '#FFD700',
                                                    transition: 'width 0.3s ease'
                                                }} />
                                            </Box>
                                            <Typography variant="caption" sx={{ opacity: 0.8, mt: 0.5, display: 'block' }}>
                                                Need {formatSideCoins(100 - currentBalance)} SC more for premium gifts
                                            </Typography>
                                        </Box>
                                    )}
                                </Box>

                                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                    {hasPremiumAccess ? 'Ready to send premium gifts!' : 'SideCoins available to spend'}
                                </Typography>
                                
                                {/* Decorative background elements */}
                                <Box sx={{
                                    position: 'absolute',
                                    top: -50,
                                    right: -50,
                                    width: 150,
                                    height: 150,
                                    borderRadius: '50%',
                                    background: alpha('#fff', 0.1),
                                    zIndex: 0
                                }} />
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Quick Stats */}
                    <Grid item xs={12} md={6}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="h6" gutterBottom>
                                    <TrendingUpIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                                    Your Activity
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={6}>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h4" color="primary" fontWeight="bold">
                                                {userStats.totalGiftsSent}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Gifts Sent
                                            </Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <Typography variant="h4" color="secondary" fontWeight="bold">
                                                {userStats.totalGiftsReceived}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Gifts Received
                                            </Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Box sx={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                            <SCCoinIcon size="small" />
                                            <Typography variant="h4" color="success.main" fontWeight="bold">
                                                {formatSideCoins(userStats.totalCoinsEarned)}
                                            </Typography>
                                        </Box>
                                        <Typography variant="body2" color="text.secondary">
                                            SC Earned
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            ({formatLittleCoins(userStats.totalCoinsEarned)} LC)
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Box sx={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                            <SCCoinIcon size="small" />
                                            <Typography variant="h4" color="error" fontWeight="bold">
                                                {formatSideCoins(userStats.totalCoinsSpent)}
                                            </Typography>
                                        </Box>
                                        <Typography variant="body2" color="text.secondary">
                                            SC Spent
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            ({formatLittleCoins(userStats.totalCoinsSpent)} LC)
                                        </Typography>
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* How to Earn More Coins */}
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 3, height: '100%' }}>
                            <Typography variant="h6" gutterBottom color="primary">
                                💰 Earn More SideCoins
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Send free gifts during live streams to earn SideCoins!
                            </Typography>
                            
                            <List dense>
                                {freeGiftTips.map((tip, index) => (
                                    <ListItem key={index} sx={{ px: 0 }}>
                                        <ListItemIcon sx={{ minWidth: 40 }}>
                                            {tip.icon}
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={tip.title}
                                            secondary={tip.description}
                                        />
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            {typeof tip.coins === 'number' ? (
                                                <>
                                                    <SCCoinIcon size="small" />
                                                    <Typography variant="body2" fontWeight="bold">
                                                        +{tip.coins}
                                                    </Typography>
                                                </>
                                            ) : (
                                                <Typography variant="body2" fontWeight="bold" color="primary">
                                                    {tip.coins}
                                                </Typography>
                                            )}
                                        </Box>
                                    </ListItem>
                                ))}
                            </List>

                            {/* Link to SideCoins Guide */}
                            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    fullWidth
                                    onClick={() => {
                                        navigate('/settings#sidecoins-guide');
                                    }}
                                    startIcon={<InfoIcon />}
                                    sx={{ 
                                        textTransform: 'none',
                                        borderColor: alpha(theme.palette.primary.main, 0.5),
                                        '&:hover': {
                                            borderColor: theme.palette.primary.main,
                                            backgroundColor: alpha(theme.palette.primary.main, 0.05)
                                        }
                                    }}
                                >
                                    Learn More About SideCoins & LittleCoins
                                </Button>
                            </Box>
                        </Paper>
                    </Grid>

                    {/* Premium Gifts Coming Soon */}
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 3, height: '100%' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                <Typography variant="h6" color="primary">
                                    ✨ Premium Gifts
                                </Typography>
                                <Chip 
                                    label="Coming Soon" 
                                    size="small" 
                                    color="warning" 
                                    variant="outlined"
                                />
                            </Box>
                            
                            {/* Premium Access Status */}
                            <Alert 
                                severity={hasPremiumAccess ? "success" : "info"} 
                                sx={{ mb: 2 }}
                                icon={hasPremiumAccess ? <DiamondIcon /> : <InfoIcon />}
                            >
                                <Typography variant="body2">
                                    {hasPremiumAccess 
                                        ? "🎉 You have premium access! You can send premium gifts when they're released."
                                        : `Premium gifts require 100.00 SC (10,000 LC) to unlock. You need ${formatSideCoins(100 - currentBalance)} SC more.`
                                    }
                                </Typography>
                            </Alert>

                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Preview of upcoming premium gifts:
                            </Typography>

                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {premiumGifts.map((gift, index) => (
                                    <Box 
                                        key={index}
                                        sx={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: 2,
                                            p: 1.5,
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            borderRadius: 1,
                                            opacity: hasPremiumAccess ? 0.9 : 0.7,
                                            backgroundColor: hasPremiumAccess ? alpha(theme.palette.success.main, 0.05) : 'transparent'
                                        }}
                                    >
                                        {gift.icon}
                                        <Box sx={{ flexGrow: 1 }}>
                                            <Typography variant="body2" fontWeight="medium">
                                                {gift.name}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {gift.description}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <SCCoinIcon size="small" />
                                            <Typography variant="body2" fontWeight="bold">
                                                {gift.cost}.00 SC
                                            </Typography>
                                        </Box>
                                    </Box>
                                ))}
                            </Box>

                            {!hasPremiumAccess && (
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', textAlign: 'center' }}>
                                    💡 Earn {formatSideCoins(100 - currentBalance)} SC more by receiving ~{Math.ceil((100 - currentBalance) / 0.08)} gifts as a host!
                                </Typography>
                            )}

                            {/* Link to Currency Guide */}
                            <Box sx={{ mt: 2, textAlign: 'center' }}>
                                <Button
                                    variant="text"
                                    size="small"
                                    onClick={() => {
                                        navigate('/settings#sidecoins-guide');
                                    }}
                                    startIcon={<InfoIcon />}
                                    sx={{ 
                                        textTransform: 'none',
                                        fontSize: '0.75rem',
                                        color: alpha(theme.palette.text.secondary, 0.8),
                                        '&:hover': {
                                            color: theme.palette.primary.main
                                        }
                                    }}
                                >
                                    Understanding SideCoins & LittleCoins
                                </Button>
                            </Box>
                        </Paper>
                    </Grid>

                    {/* Get Started Section */}
                    <Grid item xs={12}>
                        <Paper sx={{ 
                            p: 4, 
                            textAlign: 'center',
                            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.secondary.main, 0.1)})`
                        }}>
                            <Typography variant="h5" gutterBottom>
                                Ready to Start Earning?
                            </Typography>
                            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                                Join live streams and start sending gifts to earn SideCoins!
                            </Typography>
                            <Button 
                                variant="contained" 
                                size="large"
                                onClick={() => navigate('/discover')}
                                sx={{ mr: 2 }}
                            >
                                Discover Live Rooms
                            </Button>
                            <Button 
                                variant="outlined" 
                                size="large"
                                onClick={() => navigate('/profile')}
                            >
                                View My Profile
                            </Button>
                        </Paper>
                    </Grid>
                </Grid>
            </Container>
        </>
    );
};

export default Wallet; 