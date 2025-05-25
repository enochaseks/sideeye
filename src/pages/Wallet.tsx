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
    alpha,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Divider
} from '@mui/material';
import {
    AccountBalanceWallet as WalletIcon,
    CardGiftcard as GiftIcon,
    Favorite as HeartIcon,
    Star as StarIcon,
    Diamond as DiamondIcon,
    WorkspacePremium as PremiumIcon,
    Info as InfoIcon,
    TrendingUp as TrendingUpIcon,
    AccountBalance as BankIcon,
    MonetizationOn as MoneyIcon,
    Schedule as ScheduleIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import SCCoinIcon from '../components/SCCoinIcon';
import { Helmet } from 'react-helmet-async';
import { toast } from 'react-hot-toast';

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

interface WithdrawalRequest {
    id: string;
    userId: string;
    amount: number; // in SC
    moneyAmount: number; // in GBP after fees
    platformFee: number; // in GBP
    status: 'pending' | 'approved' | 'rejected' | 'completed';
    requestDate: any;
    processedDate?: any;
    bankDetails: {
        accountName: string;
        accountNumber: string;
        sortCode: string;
        bankName: string;
    };
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

    // Withdrawal state
    const [showWithdrawalDialog, setShowWithdrawalDialog] = useState(false);
    const [withdrawalAmount, setWithdrawalAmount] = useState<string>('');
    const [bankDetails, setBankDetails] = useState({
        accountName: '',
        accountNumber: '',
        sortCode: '',
        bankName: ''
    });
    const [isProcessingWithdrawal, setIsProcessingWithdrawal] = useState(false);
    const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalRequest[]>([]);
    const [canWithdrawThisMonth, setCanWithdrawThisMonth] = useState(true);
    


    // Conversion rates
    const SC_TO_MONEY_RATE = 0.005; // 1 SC = £0.005 (0.5p)
    const PLATFORM_FEE_RATE = 0.10; // 10% platform fee
    const MIN_WITHDRAWAL_SC = 1000; // Minimum 1000 SC (£5) to withdraw

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

    // Convert SideCoins to money
    const convertSCToMoney = (sideCoins: number): number => {
        return sideCoins * SC_TO_MONEY_RATE;
    };

    // Calculate withdrawal amount after platform fee
    const calculateWithdrawalAmount = (sideCoins: number) => {
        const grossAmount = convertSCToMoney(sideCoins);
        const platformFee = grossAmount * PLATFORM_FEE_RATE;
        const netAmount = grossAmount - platformFee;
        return { grossAmount, platformFee, netAmount };
    };

    // Check if user can withdraw this month
    const checkWithdrawalEligibility = () => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        // Check if user has already withdrawn this month
        const hasWithdrawnThisMonth = withdrawalHistory.some(withdrawal => {
            const withdrawalDate = withdrawal.requestDate.toDate();
            return withdrawalDate.getMonth() === currentMonth && 
                   withdrawalDate.getFullYear() === currentYear &&
                   (withdrawal.status === 'approved' || withdrawal.status === 'completed');
        });
        
        setCanWithdrawThisMonth(!hasWithdrawnThisMonth);
    };

    // Check if user has premium access (100.00 SC threshold)
    const hasPremiumAccess = currentBalance >= 100.00;
    const premiumProgress = Math.min((currentBalance / 100.00) * 100, 100);

    // Calculate money value of current balance
    const currentMoneyValue = convertSCToMoney(currentBalance);
    const withdrawalCalculation = calculateWithdrawalAmount(currentBalance);

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

        // Real-time listener for withdrawal history
        const withdrawalsQuery = query(
            collection(db, 'withdrawalRequests'),
            where('userId', '==', currentUser.uid)
        );
        const unsubscribeWithdrawals = onSnapshot(withdrawalsQuery, (snapshot) => {
            const withdrawals: WithdrawalRequest[] = [];
            snapshot.forEach(doc => {
                withdrawals.push({ id: doc.id, ...doc.data() } as WithdrawalRequest);
            });
            setWithdrawalHistory(withdrawals);
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
                        // All gifts now cost SC
                        actualCoinsSpent += giftData.value || giftData.cost || 0;
                    });
                    
                    // Get gifts received by user
                    const giftsReceivedQuery = query(
                        collection(db, 'sideRooms', roomId, 'gifts'),
                        where('receiverId', '==', currentUser.uid)
                    );
                    
                    const giftsReceivedSnapshot = await getDocs(giftsReceivedQuery);
                    giftsReceivedSnapshot.forEach(giftDoc => {
                        const giftData = giftDoc.data();
                        totalReceived++;
                        // Calculate actual SideCoins earned: 80% of gift cost
                        const giftCost = giftData.value || giftData.cost || 0;
                        actualCoinsEarned += giftCost * 0.8; // Host gets 80%
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
            unsubscribeWithdrawals();
            if (cleanupGiftListeners) {
                cleanupGiftListeners();
            }
        };
    }, [currentUser?.uid]);

    // Check withdrawal eligibility when withdrawal history changes
    useEffect(() => {
        checkWithdrawalEligibility();
    }, [withdrawalHistory]);

    const handleWithdrawalRequest = async () => {
        if (!currentUser?.uid || !withdrawalAmount || isProcessingWithdrawal) return;

        const amountSC = parseFloat(withdrawalAmount);
        
        // Validation
        if (amountSC < MIN_WITHDRAWAL_SC) {
            toast.error(`Minimum withdrawal is ${MIN_WITHDRAWAL_SC} SC (£${(MIN_WITHDRAWAL_SC * SC_TO_MONEY_RATE).toFixed(2)})`);
            return;
        }

        if (amountSC > currentBalance) {
            toast.error('Insufficient balance');
            return;
        }

        if (!canWithdrawThisMonth) {
            toast.error('You can only withdraw once per month');
            return;
        }

        // Validate bank details
        if (!bankDetails.accountName || !bankDetails.accountNumber || !bankDetails.sortCode || !bankDetails.bankName) {
            toast.error('Please fill in all bank details');
            return;
        }

        setIsProcessingWithdrawal(true);

        try {
            const calculation = calculateWithdrawalAmount(amountSC);
            
            // Create withdrawal request
            const withdrawalRequest = {
                userId: currentUser.uid,
                amount: amountSC,
                moneyAmount: calculation.netAmount,
                platformFee: calculation.platformFee,
                grossAmount: calculation.grossAmount,
                status: 'pending',
                requestDate: serverTimestamp(),
                bankDetails: bankDetails,
                userEmail: currentUser.email,
                userName: currentUser.displayName || 'Unknown User'
            };

            await addDoc(collection(db, 'withdrawalRequests'), withdrawalRequest);

            // Deduct the amount from user's balance immediately (pending approval)
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, {
                sideCoins: currentBalance - amountSC,
                pendingWithdrawal: amountSC // Track pending amount
            });

            toast.success(`Withdrawal request submitted! You'll receive £${calculation.netAmount.toFixed(2)} after processing.`);
            setShowWithdrawalDialog(false);
            setWithdrawalAmount('');
            setBankDetails({
                accountName: '',
                accountNumber: '',
                sortCode: '',
                bankName: ''
            });

        } catch (error) {
            console.error('Error submitting withdrawal request:', error);
            toast.error('Failed to submit withdrawal request');
        } finally {
            setIsProcessingWithdrawal(false);
        }
    };

    const freeGiftTips: GiftTip[] = [
        {
            icon: <HeartIcon color="error" />,
            title: "Receive Gifts & Earn Money",
            description: "Host live rooms and earn SideCoins from gifts - withdraw as real money monthly!",
            coins: "£0.005 per SC"
        },
        {
            icon: <StarIcon color="warning" />,
            title: "Monthly Withdrawals",
            description: "Convert your SideCoins to real money once per month (10% platform fee)",
            coins: "90% to you"
        },
        {
            icon: <GiftIcon color="primary" />,
            title: "Host Live Rooms",
            description: "Create engaging content to attract gift-giving viewers and earn withdrawable income",
            coins: "Varies"
        }
    ];

    // Debug function to manually correct balance (temporary)
    const handleCorrectBalance = async () => {
        if (!currentUser?.uid || !db) {
            toast.error("Cannot correct balance: User not authenticated");
            return;
        }

        if (window.confirm(`This will set your balance to match your calculated earnings (${formatSideCoins(userStats.totalCoinsEarned)} SC). Continue?`)) {
            try {
                const userRef = doc(db, 'users', currentUser.uid);
                await updateDoc(userRef, {
                    sideCoins: userStats.totalCoinsEarned
                });
                toast.success(`Balance corrected to ${formatSideCoins(userStats.totalCoinsEarned)} SC!`);
                console.log(`[Balance Correction] Updated balance from ${currentBalance} to ${userStats.totalCoinsEarned}`);
            } catch (error) {
                console.error('[Balance Correction] Error:', error);
                toast.error('Failed to correct balance');
            }
        }
    };



    const premiumGifts = [
        {
            name: "Diamond Crown",
            cost: "£10.00",
            icon: <DiamondIcon sx={{ color: '#00BCD4' }} />,
            description: "Ultra-rare premium gift"
        },
        {
            name: "Golden Trophy",
            cost: "£5.00",
            icon: <PremiumIcon sx={{ color: '#FFD700' }} />,
            description: "Show ultimate appreciation"
        },
        {
            name: "Ruby Heart",
            cost: "£3.00",
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
                <meta name="description" content="Manage your SideCoins balance and withdraw real money" />
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

                                {/* Money Value Display */}
                                <Box sx={{ mb: 2, p: 2, bgcolor: alpha('#fff', 0.1), borderRadius: 1 }}>
                                    <Typography variant="h4" component="div" fontWeight="bold" sx={{ color: '#FFD700' }}>
                                        £{currentMoneyValue.toFixed(2)}
                                    </Typography>
                                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                        Current Money Value
                                    </Typography>
                                    <Typography variant="caption" sx={{ opacity: 0.8 }}>
                                        After 10% platform fee: £{withdrawalCalculation.netAmount.toFixed(2)}
                                    </Typography>
                                </Box>

                                {/* Withdrawal Button */}
                                <Button
                                    variant="contained"
                                    fullWidth
                                    onClick={() => setShowWithdrawalDialog(true)}
                                    disabled={currentBalance < MIN_WITHDRAWAL_SC || !canWithdrawThisMonth}
                                    startIcon={<BankIcon />}
                                    sx={{
                                        bgcolor: '#FFD700',
                                        color: '#000',
                                        fontWeight: 'bold',
                                        '&:hover': {
                                            bgcolor: '#FFC107'
                                        },
                                        '&:disabled': {
                                            bgcolor: alpha('#fff', 0.2),
                                            color: alpha('#fff', 0.5)
                                        }
                                    }}
                                >
                                    {!canWithdrawThisMonth ? 'Already Withdrawn This Month' : 
                                     currentBalance < MIN_WITHDRAWAL_SC ? `Need ${MIN_WITHDRAWAL_SC} SC to Withdraw` : 
                                     'Withdraw Money'}
                                </Button>

                                {/* Premium Status */}
                                <Box sx={{ mt: 2 }}>
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
                                
                                {/* Debug Alert for Balance Discrepancy */}
                                {Math.abs(currentBalance - userStats.totalCoinsEarned) > 0.01 && (
                                    <Alert 
                                        severity="warning" 
                                        sx={{ mb: 2 }}
                                        action={
                                            <Button 
                                                color="inherit" 
                                                size="small" 
                                                onClick={handleCorrectBalance}
                                                variant="outlined"
                                            >
                                                Fix Balance
                                            </Button>
                                        }
                                    >
                                        <Typography variant="body2">
                                            Balance mismatch detected! You should have {formatSideCoins(userStats.totalCoinsEarned)} SC but have {formatSideCoins(currentBalance)} SC.
                                        </Typography>
                                    </Alert>
                                )}
                                
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
                                        <Typography variant="caption" color="success.main" fontWeight="bold">
                                            £{convertSCToMoney(userStats.totalCoinsEarned).toFixed(2)} value
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

                    {/* Withdrawal Information */}
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 3, height: '100%' }}>
                            <Typography variant="h6" gutterBottom color="primary">
                                💰 Withdrawal Information
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Convert your SideCoins to real money with monthly withdrawals.
                            </Typography>
                            
                            <List dense>
                                <ListItem sx={{ px: 0 }}>
                                    <ListItemIcon sx={{ minWidth: 40 }}>
                                        <MoneyIcon color="success" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary="Conversion Rate"
                                        secondary="1 SC = £0.005 (0.5p) • 1000 SC = £5"
                                    />
                                </ListItem>
                                <ListItem sx={{ px: 0 }}>
                                    <ListItemIcon sx={{ minWidth: 40 }}>
                                        <ScheduleIcon color="info" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary="Monthly Withdrawals"
                                        secondary="Withdraw once per month, processed within 5-7 business days"
                                    />
                                </ListItem>
                                <ListItem sx={{ px: 0 }}>
                                    <ListItemIcon sx={{ minWidth: 40 }}>
                                        <WarningIcon color="warning" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary="Platform Fee"
                                        secondary="10% fee applies to all withdrawals (you keep 90%)"
                                    />
                                </ListItem>
                            </List>

                            <Alert severity="info" sx={{ mt: 2 }}>
                                <Typography variant="body2">
                                    <strong>Next withdrawal available:</strong> {canWithdrawThisMonth ? 'Now' : 'Next month'}
                                </Typography>
                            </Alert>
                        </Paper>
                    </Grid>

                    {/* How to Earn More */}
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 3, height: '100%' }}>
                            <Typography variant="h6" gutterBottom color="primary">
                                📈 How to Earn More
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Maximize your earnings by hosting engaging live streams.
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
                                        <Typography variant="body2" fontWeight="bold" color="primary">
                                            {tip.coins}
                                        </Typography>
                                    </ListItem>
                                ))}
                            </List>
                        </Paper>
                    </Grid>

                    {/* Withdrawal History */}
                    {withdrawalHistory.length > 0 && (
                        <Grid item xs={12}>
                            <Paper sx={{ p: 3 }}>
                                <Typography variant="h6" gutterBottom>
                                    Withdrawal History
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {withdrawalHistory.slice(0, 5).map((withdrawal) => (
                                        <Box 
                                            key={withdrawal.id}
                                            sx={{ 
                                                display: 'flex', 
                                                justifyContent: 'space-between', 
                                                alignItems: 'center',
                                                p: 2,
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                borderRadius: 1
                                            }}
                                        >
                                            <Box>
                                                <Typography variant="body1" fontWeight="medium">
                                                    {withdrawal.amount} SC → £{withdrawal.moneyAmount.toFixed(2)}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {withdrawal.requestDate.toDate().toLocaleDateString()} • Fee: £{withdrawal.platformFee.toFixed(2)}
                                                </Typography>
                                            </Box>
                                            <Chip 
                                                label={withdrawal.status.toUpperCase()}
                                                color={
                                                    withdrawal.status === 'completed' ? 'success' :
                                                    withdrawal.status === 'approved' ? 'info' :
                                                    withdrawal.status === 'rejected' ? 'error' : 'default'
                                                }
                                                size="small"
                                            />
                                        </Box>
                                    ))}
                                </Box>
                            </Paper>
                        </Grid>
                    )}

                    {/* Get Started Section */}
                    <Grid item xs={12}>
                        <Paper sx={{ 
                            p: 4, 
                            textAlign: 'center',
                            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.secondary.main, 0.1)})`
                        }}>
                            <Typography variant="h5" gutterBottom>
                                Ready to Start Earning Real Money?
                            </Typography>
                            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                                Host live streams and receive gifts that convert to withdrawable cash!
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

                {/* Withdrawal Dialog */}
                <Dialog open={showWithdrawalDialog} onClose={() => setShowWithdrawalDialog(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <BankIcon />
                            <Typography variant="h6">Withdraw Money</Typography>
                        </Box>
                    </DialogTitle>
                    <DialogContent>
                        <Alert severity="info" sx={{ mb: 3 }}>
                            <Typography variant="body2">
                                <strong>Available:</strong> {formatSideCoins(currentBalance)} SC (£{currentMoneyValue.toFixed(2)})
                                <br />
                                <strong>Platform Fee:</strong> 10% • <strong>Minimum:</strong> {MIN_WITHDRAWAL_SC} SC
                            </Typography>
                        </Alert>

                        <TextField
                            fullWidth
                            label="Amount to Withdraw (SC)"
                            type="number"
                            value={withdrawalAmount}
                            onChange={(e) => setWithdrawalAmount(e.target.value)}
                            sx={{ mb: 2 }}
                            inputProps={{ min: MIN_WITHDRAWAL_SC, max: currentBalance }}
                        />

                        {withdrawalAmount && parseFloat(withdrawalAmount) >= MIN_WITHDRAWAL_SC && (
                            <Box sx={{ mb: 3, p: 2, bgcolor: alpha(theme.palette.success.main, 0.1), borderRadius: 1 }}>
                                <Typography variant="body2" gutterBottom>
                                    <strong>Withdrawal Breakdown:</strong>
                                </Typography>
                                <Typography variant="body2">
                                    Gross Amount: £{calculateWithdrawalAmount(parseFloat(withdrawalAmount)).grossAmount.toFixed(2)}
                                </Typography>
                                <Typography variant="body2">
                                    Platform Fee (10%): -£{calculateWithdrawalAmount(parseFloat(withdrawalAmount)).platformFee.toFixed(2)}
                                </Typography>
                                <Typography variant="body1" fontWeight="bold" color="success.main">
                                    You'll Receive: £{calculateWithdrawalAmount(parseFloat(withdrawalAmount)).netAmount.toFixed(2)}
                                </Typography>
                            </Box>
                        )}

                        <Divider sx={{ my: 2 }} />
                        
                        <Typography variant="h6" gutterBottom>Bank Details</Typography>
                        
                        <TextField
                            fullWidth
                            label="Account Holder Name"
                            value={bankDetails.accountName}
                            onChange={(e) => setBankDetails(prev => ({ ...prev, accountName: e.target.value }))}
                            sx={{ mb: 2 }}
                        />
                        
                        <TextField
                            fullWidth
                            label="Account Number"
                            value={bankDetails.accountNumber}
                            onChange={(e) => setBankDetails(prev => ({ ...prev, accountNumber: e.target.value }))}
                            sx={{ mb: 2 }}
                        />
                        
                        <TextField
                            fullWidth
                            label="Sort Code"
                            value={bankDetails.sortCode}
                            onChange={(e) => setBankDetails(prev => ({ ...prev, sortCode: e.target.value }))}
                            sx={{ mb: 2 }}
                        />
                        
                        <TextField
                            fullWidth
                            label="Bank Name"
                            value={bankDetails.bankName}
                            onChange={(e) => setBankDetails(prev => ({ ...prev, bankName: e.target.value }))}
                            sx={{ mb: 2 }}
                        />

                        <Alert severity="warning" sx={{ mt: 2 }}>
                            <Typography variant="body2">
                                Withdrawals are processed once per month. Please ensure your bank details are correct as changes cannot be made after submission.
                            </Typography>
                        </Alert>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setShowWithdrawalDialog(false)}>Cancel</Button>
                        <Button 
                            variant="contained" 
                            onClick={handleWithdrawalRequest}
                            disabled={
                                !withdrawalAmount || 
                                parseFloat(withdrawalAmount) < MIN_WITHDRAWAL_SC || 
                                parseFloat(withdrawalAmount) > currentBalance ||
                                !bankDetails.accountName ||
                                !bankDetails.accountNumber ||
                                !bankDetails.sortCode ||
                                !bankDetails.bankName ||
                                isProcessingWithdrawal
                            }
                            startIcon={isProcessingWithdrawal ? <CircularProgress size={20} /> : <BankIcon />}
                        >
                            {isProcessingWithdrawal ? 'Processing...' : 'Submit Withdrawal Request'}
                                            </Button>
                </DialogActions>
            </Dialog>


        </Container>
    </>
);
};

export default Wallet; 