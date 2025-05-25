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
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, updateDoc, addDoc, serverTimestamp, orderBy, deleteDoc, writeBatch } from 'firebase/firestore';
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

interface SavedBankDetails {
    id: string;
    accountName: string;
    accountNumber: string; // This will be encrypted
    sortCode: string;
    bankName: string;
    isDefault: boolean;
    createdAt: any;
    lastUsed?: any;
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
    const [showBankDetailsDialog, setShowBankDetailsDialog] = useState(false);
    const [withdrawalAmount, setWithdrawalAmount] = useState<string>('');
    const [bankDetails, setBankDetails] = useState({
        accountName: '',
        accountNumber: '',
        sortCode: '',
        bankName: ''
    });
    const [savedBankDetails, setSavedBankDetails] = useState<SavedBankDetails[]>([]);
    const [selectedBankDetailsId, setSelectedBankDetailsId] = useState<string>('');
    const [isProcessingWithdrawal, setIsProcessingWithdrawal] = useState(false);
    const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalRequest[]>([]);
    const [canWithdrawThisMonth, setCanWithdrawThisMonth] = useState(true);
    const [nextWithdrawalDate, setNextWithdrawalDate] = useState<Date | null>(null);
    const [isLoadingBankDetails, setIsLoadingBankDetails] = useState(false);
    const [isSavingBankDetails, setIsSavingBankDetails] = useState(false);
    


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

    // Check if user can withdraw this month and calculate next withdrawal date
    const checkWithdrawalEligibility = () => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        // Find the most recent completed withdrawal
        const lastWithdrawal = withdrawalHistory
            .filter(w => w.status === 'completed' || w.status === 'approved')
            .sort((a, b) => b.requestDate.toDate().getTime() - a.requestDate.toDate().getTime())[0];
        
        if (lastWithdrawal) {
            const lastWithdrawalDate = lastWithdrawal.requestDate.toDate();
            const lastWithdrawalMonth = lastWithdrawalDate.getMonth();
            const lastWithdrawalYear = lastWithdrawalDate.getFullYear();
            
            // Check if last withdrawal was this month
            const hasWithdrawnThisMonth = lastWithdrawalMonth === currentMonth && lastWithdrawalYear === currentYear;
            
            setCanWithdrawThisMonth(!hasWithdrawnThisMonth);
            
            if (hasWithdrawnThisMonth) {
                // Calculate next withdrawal date (first day of next month)
                const nextMonth = new Date(currentYear, currentMonth + 1, 1);
                setNextWithdrawalDate(nextMonth);
            } else {
                setNextWithdrawalDate(null);
            }
        } else {
            setCanWithdrawThisMonth(true);
            setNextWithdrawalDate(null);
        }
    };

    // Load saved bank details
    const loadSavedBankDetails = async () => {
        if (!currentUser?.uid) return;
        
        setIsLoadingBankDetails(true);
        try {
            const bankDetailsQuery = query(
                collection(db, 'users', currentUser.uid, 'bankDetails'),
                orderBy('createdAt', 'desc')
            );
            
            const unsubscribe = onSnapshot(bankDetailsQuery, (snapshot) => {
                const details: SavedBankDetails[] = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    details.push({
                        id: doc.id,
                        accountName: data.accountName,
                        accountNumber: data.accountNumber, // Will be masked for display
                        sortCode: data.sortCode,
                        bankName: data.bankName,
                        isDefault: data.isDefault || false,
                        createdAt: data.createdAt,
                        lastUsed: data.lastUsed
                    });
                });
                setSavedBankDetails(details);
                
                // Auto-select default bank details
                const defaultDetails = details.find(d => d.isDefault);
                if (defaultDetails && !selectedBankDetailsId) {
                    setSelectedBankDetailsId(defaultDetails.id);
                }
            });
            
            return unsubscribe;
        } catch (error) {
            console.error('Error loading bank details:', error);
            toast.error('Failed to load saved bank details');
        } finally {
            setIsLoadingBankDetails(false);
        }
    };

    // Save new bank details
    const saveBankDetails = async () => {
        if (!currentUser?.uid || !bankDetails.accountName || !bankDetails.accountNumber || !bankDetails.sortCode || !bankDetails.bankName) {
            toast.error('Please fill in all bank details');
            return;
        }
        
        setIsSavingBankDetails(true);
        try {
            // Validate sort code format (6 digits)
            const sortCodeRegex = /^\d{6}$/;
            if (!sortCodeRegex.test(bankDetails.sortCode.replace(/[-\s]/g, ''))) {
                toast.error('Sort code must be 6 digits (e.g., 123456 or 12-34-56)');
                return;
            }
            
            // Validate account number (8 digits for UK)
            const accountNumberRegex = /^\d{8}$/;
            if (!accountNumberRegex.test(bankDetails.accountNumber)) {
                toast.error('Account number must be 8 digits');
                return;
            }
            
            // Check if this is the first bank details (make it default)
            const isFirstDetails = savedBankDetails.length === 0;
            
            // Save to Firestore (account number will be encrypted on backend)
            const bankDetailsRef = collection(db, 'users', currentUser.uid, 'bankDetails');
            const docRef = await addDoc(bankDetailsRef, {
                accountName: bankDetails.accountName,
                accountNumber: bankDetails.accountNumber, // Backend should encrypt this
                sortCode: bankDetails.sortCode.replace(/[-\s]/g, ''), // Remove formatting
                bankName: bankDetails.bankName,
                isDefault: isFirstDetails,
                createdAt: serverTimestamp(),
                encryptionVersion: 1 // For future encryption upgrades
            });
            
            // Clear form
            setBankDetails({
                accountName: '',
                accountNumber: '',
                sortCode: '',
                bankName: ''
            });
            
            setSelectedBankDetailsId(docRef.id);
            setShowBankDetailsDialog(false);
            toast.success('Bank details saved securely');
            
        } catch (error) {
            console.error('Error saving bank details:', error);
            toast.error('Failed to save bank details');
        } finally {
            setIsSavingBankDetails(false);
        }
    };

    // Delete saved bank details
    const deleteBankDetails = async (detailsId: string) => {
        if (!currentUser?.uid) return;
        
        if (window.confirm('Are you sure you want to delete these bank details?')) {
            try {
                await deleteDoc(doc(db, 'users', currentUser.uid, 'bankDetails', detailsId));
                toast.success('Bank details deleted');
                
                // If this was the selected one, clear selection
                if (selectedBankDetailsId === detailsId) {
                    setSelectedBankDetailsId('');
                }
            } catch (error) {
                console.error('Error deleting bank details:', error);
                toast.error('Failed to delete bank details');
            }
        }
    };

    // Set bank details as default
    const setAsDefaultBankDetails = async (detailsId: string) => {
        if (!currentUser?.uid) return;
        
        try {
            const batch = writeBatch(db);
            
            // Remove default from all other bank details
            savedBankDetails.forEach(details => {
                if (details.id !== detailsId) {
                    const ref = doc(db, 'users', currentUser.uid, 'bankDetails', details.id);
                    batch.update(ref, { isDefault: false });
                }
            });
            
            // Set this one as default
            const ref = doc(db, 'users', currentUser.uid, 'bankDetails', detailsId);
            batch.update(ref, { isDefault: true });
            
            await batch.commit();
            toast.success('Default bank details updated');
            
        } catch (error) {
            console.error('Error setting default bank details:', error);
            toast.error('Failed to update default bank details');
        }
    };

    const handleWithdrawalRequest = async () => {
        // Coming Soon functionality
        console.log('🚀 Withdrawal feature coming soon!');
        toast.success('Withdrawal feature coming soon! 🚀', {
            duration: 3000,
            position: 'top-center',
        });
        setShowWithdrawalDialog(false);
        return;

        // TODO: Uncomment below when withdrawal system is ready
        /*
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
            const nextDateStr = nextWithdrawalDate ? nextWithdrawalDate.toLocaleDateString() : 'next month';
            toast.error(`You can only withdraw once per month. Next withdrawal available: ${nextDateStr}`);
            return;
        }

        // Check if bank details are selected
        if (!selectedBankDetailsId) {
            toast.error('Please select or add bank details for withdrawal');
            setShowBankDetailsDialog(true);
            return;
        }

        const selectedDetails = savedBankDetails.find(d => d.id === selectedBankDetailsId);
        if (!selectedDetails) {
            toast.error('Selected bank details not found');
            return;
        }

        setIsProcessingWithdrawal(true);

        try {
            const calculation = calculateWithdrawalAmount(amountSC);
            
            // Create withdrawal request with reference to saved bank details
            const withdrawalRequest = {
                userId: currentUser.uid,
                amount: amountSC,
                moneyAmount: calculation.netAmount,
                platformFee: calculation.platformFee,
                grossAmount: calculation.grossAmount,
                status: 'pending',
                requestDate: serverTimestamp(),
                bankDetailsId: selectedBankDetailsId, // Reference to saved bank details
                userEmail: currentUser.email,
                userName: currentUser.displayName || 'Unknown User',
                withdrawalMonth: new Date().getMonth(),
                withdrawalYear: new Date().getFullYear()
            };

            await addDoc(collection(db, 'withdrawalRequests'), withdrawalRequest);

            // Update last used timestamp for bank details
            const bankDetailsRef = doc(db, 'users', currentUser.uid, 'bankDetails', selectedBankDetailsId);
            await updateDoc(bankDetailsRef, {
                lastUsed: serverTimestamp()
            });

            // Deduct the amount from user's balance immediately (pending approval)
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, {
                sideCoins: currentBalance - amountSC,
                pendingWithdrawal: amountSC // Track pending amount
            });

            toast.success(`Withdrawal request submitted! You'll receive £${calculation.netAmount.toFixed(2)} after processing.`);
            setShowWithdrawalDialog(false);
            setWithdrawalAmount('');

        } catch (error) {
            console.error('Error submitting withdrawal request:', error);
            toast.error('Failed to submit withdrawal request');
        } finally {
            setIsProcessingWithdrawal(false);
        }
        */
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

    // Load data on component mount
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
            where('userId', '==', currentUser.uid),
            orderBy('requestDate', 'desc')
        );
        const unsubscribeWithdrawals = onSnapshot(withdrawalsQuery, (snapshot) => {
            const withdrawals: WithdrawalRequest[] = [];
            snapshot.forEach(doc => {
                withdrawals.push({ id: doc.id, ...doc.data() } as WithdrawalRequest);
            });
            setWithdrawalHistory(withdrawals);
        });

        // Load saved bank details
        let unsubscribeBankDetails: (() => void) | undefined;
        loadSavedBankDetails().then(unsub => {
            unsubscribeBankDetails = unsub;
        });

        // Load user stats
        const loadUserStats = async () => {
            try {
                console.log('[Wallet] Loading user stats for:', currentUser.uid);
                
                // Get all rooms first
                const roomsSnapshot = await getDocs(collection(db, 'sideRooms'));
                
                let totalCoinsEarned = 0;
                let totalCoinsSpent = 0;
                let totalGiftsSent = 0;
                let totalGiftsReceived = 0;
                
                // Check gifts in each room's subcollection
                for (const roomDoc of roomsSnapshot.docs) {
                    const roomId = roomDoc.id;
                    
                    // Get gifts sent by this user in this room
                    const sentQuery = query(
                        collection(db, 'sideRooms', roomId, 'gifts'),
                        where('senderId', '==', currentUser.uid)
                    );
                    const sentSnapshot = await getDocs(sentQuery);
                    
                    // Get gifts received by this user in this room
                    const receivedQuery = query(
                        collection(db, 'sideRooms', roomId, 'gifts'),
                        where('receiverId', '==', currentUser.uid)
                    );
                    const receivedSnapshot = await getDocs(receivedQuery);
                    
                    // Count sent gifts and calculate spent amount
                    totalGiftsSent += sentSnapshot.size;
                    sentSnapshot.forEach(doc => {
                        const gift = doc.data();
                        if (gift.value) {
                            totalCoinsSpent += gift.value; // Amount spent on gifts
                        }
                    });
                    
                    // Count received gifts and calculate earned SideCoins
                    totalGiftsReceived += receivedSnapshot.size;
                    receivedSnapshot.forEach(doc => {
                        const gift = doc.data();
                        if (gift.value) {
                            // Host earns 80% of gift value in SideCoins
                            const hostEarning = (gift.value * 0.8) / 0.005; // Convert to SideCoins
                            totalCoinsEarned += hostEarning;
                        }
                    });
                }
                
                console.log('[Wallet] Stats calculated:', {
                    totalGiftsSent,
                    totalGiftsReceived,
                    totalCoinsEarned,
                    totalCoinsSpent
                });
                
                setUserStats({
                    totalGiftsSent,
                    totalGiftsReceived,
                    totalCoinsEarned,
                    totalCoinsSpent
                });
                
            } catch (error) {
                console.error('[Wallet] Error loading user stats:', error);
            } finally {
                setLoading(false);
            }
        };

        loadUserStats();

        // Cleanup function
        return () => {
            unsubscribeUser();
            unsubscribeWithdrawals();
            if (unsubscribeBankDetails) {
                unsubscribeBankDetails();
            }
        };
    }, [currentUser?.uid]);

    // Check withdrawal eligibility when withdrawal history changes
    useEffect(() => {
        checkWithdrawalEligibility();
    }, [withdrawalHistory]);

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
                                        £{convertSCToMoney(currentBalance).toFixed(2)}
                                    </Typography>
                                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                        Current Money Value
                                    </Typography>
                                    <Typography variant="caption" sx={{ opacity: 0.8 }}>
                                        After 10% platform fee: £{calculateWithdrawalAmount(currentBalance).netAmount.toFixed(2)}
                                    </Typography>
                                </Box>

                                {/* Withdrawal Button */}
                                <Button
                                    variant="contained"
                                    fullWidth
                                    onClick={() => setShowWithdrawalDialog(true)}
                                    disabled={false} // Always enabled for "Coming Soon" demo
                                    startIcon={<BankIcon />}
                                    sx={{
                                        bgcolor: '#FFD700',
                                        color: '#000',
                                        fontWeight: 'bold',
                                        '&:hover': {
                                            bgcolor: '#FFC107'
                                        }
                                    }}
                                >
                                    Withdraw Money (Coming Soon)
                                </Button>

                                {/* Premium Status */}
                                <Box sx={{ mt: 2 }}>
                                    {nextWithdrawalDate && (
                                        <Chip 
                                            label={`Next Withdrawal: ${nextWithdrawalDate.toLocaleDateString()}`}
                                            color="info"
                                            size="small"
                                        />
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
                                <strong>Available:</strong> {formatSideCoins(currentBalance)} SC (£{convertSCToMoney(currentBalance).toFixed(2)})
                                <br />
                                <strong>Platform Fee:</strong> 10% • <strong>Minimum:</strong> {MIN_WITHDRAWAL_SC} SC
                                {!canWithdrawThisMonth && nextWithdrawalDate && (
                                    <>
                                        <br />
                                        <strong>Next Withdrawal:</strong> {nextWithdrawalDate.toLocaleDateString()}
                                    </>
                                )}
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
                            disabled={!canWithdrawThisMonth}
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
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6">Bank Details</Typography>
                            <Button 
                                variant="outlined" 
                                size="small"
                                onClick={() => setShowBankDetailsDialog(true)}
                                startIcon={<BankIcon />}
                            >
                                Add New
                            </Button>
                        </Box>
                        
                        {isLoadingBankDetails ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                                <CircularProgress size={24} />
                            </Box>
                        ) : savedBankDetails.length === 0 ? (
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                <Typography variant="body2">
                                    No saved bank details found. Please add your bank details to proceed with withdrawal.
                                </Typography>
                            </Alert>
                        ) : (
                            <FormControl fullWidth sx={{ mb: 2 }}>
                                <InputLabel>Select Bank Account</InputLabel>
                                <Select
                                    value={selectedBankDetailsId}
                                    onChange={(e) => setSelectedBankDetailsId(e.target.value)}
                                    label="Select Bank Account"
                                >
                                    {savedBankDetails.map((details) => (
                                        <MenuItem key={details.id} value={details.id}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                                <Box>
                                                    <Typography variant="body2" fontWeight="bold">
                                                        {details.accountName}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {details.bankName} • ****{details.accountNumber.slice(-4)}
                                                        {details.isDefault && ' (Default)'}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

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
                                !selectedBankDetailsId ||
                                !canWithdrawThisMonth ||
                                isProcessingWithdrawal
                            }
                            startIcon={isProcessingWithdrawal ? <CircularProgress size={20} /> : <BankIcon />}
                        >
                            {isProcessingWithdrawal ? 'Processing...' : 'Submit Withdrawal Request'}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Bank Details Management Dialog */}
                <Dialog open={showBankDetailsDialog} onClose={() => setShowBankDetailsDialog(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <BankIcon />
                            <Typography variant="h6">Bank Details</Typography>
                        </Box>
                    </DialogTitle>
                    <DialogContent>
                        <Alert severity="info" sx={{ mb: 3 }}>
                            <Typography variant="body2">
                                Your bank details are encrypted and stored securely. We only use this information for processing withdrawals.
                            </Typography>
                        </Alert>

                        {/* Add New Bank Details Form */}
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle1" gutterBottom>Add New Bank Account</Typography>
                            
                            <TextField
                                fullWidth
                                label="Account Holder Name"
                                value={bankDetails.accountName}
                                onChange={(e) => setBankDetails(prev => ({ ...prev, accountName: e.target.value }))}
                                sx={{ mb: 2 }}
                                placeholder="John Smith"
                            />
                            
                            <TextField
                                fullWidth
                                label="Account Number"
                                value={bankDetails.accountNumber}
                                onChange={(e) => setBankDetails(prev => ({ ...prev, accountNumber: e.target.value.replace(/\D/g, '') }))}
                                sx={{ mb: 2 }}
                                placeholder="12345678"
                                inputProps={{ maxLength: 8 }}
                            />
                            
                            <TextField
                                fullWidth
                                label="Sort Code"
                                value={bankDetails.sortCode}
                                onChange={(e) => {
                                    let value = e.target.value.replace(/\D/g, '');
                                    if (value.length > 2 && value.length <= 4) {
                                        value = value.slice(0, 2) + '-' + value.slice(2);
                                    } else if (value.length > 4) {
                                        value = value.slice(0, 2) + '-' + value.slice(2, 4) + '-' + value.slice(4, 6);
                                    }
                                    setBankDetails(prev => ({ ...prev, sortCode: value }));
                                }}
                                sx={{ mb: 2 }}
                                placeholder="12-34-56"
                                inputProps={{ maxLength: 8 }}
                            />
                            
                            <TextField
                                fullWidth
                                label="Bank Name"
                                value={bankDetails.bankName}
                                onChange={(e) => setBankDetails(prev => ({ ...prev, bankName: e.target.value }))}
                                sx={{ mb: 2 }}
                                placeholder="Barclays Bank"
                            />

                            <Button
                                variant="contained"
                                onClick={saveBankDetails}
                                disabled={isSavingBankDetails || !bankDetails.accountName || !bankDetails.accountNumber || !bankDetails.sortCode || !bankDetails.bankName}
                                startIcon={isSavingBankDetails ? <CircularProgress size={20} /> : <BankIcon />}
                                fullWidth
                            >
                                {isSavingBankDetails ? 'Saving...' : 'Save Bank Details'}
                            </Button>
                        </Box>

                        {/* Saved Bank Details List */}
                        {savedBankDetails.length > 0 && (
                            <>
                                <Divider sx={{ my: 2 }} />
                                <Typography variant="subtitle1" gutterBottom>Saved Bank Accounts</Typography>
                                
                                {savedBankDetails.map((details) => (
                                    <Paper key={details.id} elevation={1} sx={{ p: 2, mb: 2 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <Box sx={{ flex: 1 }}>
                                                <Typography variant="body1" fontWeight="bold">
                                                    {details.accountName}
                                                    {details.isDefault && (
                                                        <Chip label="Default" size="small" color="primary" sx={{ ml: 1 }} />
                                                    )}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {details.bankName}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Account: ****{details.accountNumber.slice(-4)} • Sort: {details.sortCode}
                                                </Typography>
                                                {details.lastUsed && (
                                                    <Typography variant="caption" color="text.secondary">
                                                        Last used: {details.lastUsed.toDate().toLocaleDateString()}
                                                    </Typography>
                                                )}
                                            </Box>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                {!details.isDefault && (
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        onClick={() => setAsDefaultBankDetails(details.id)}
                                                    >
                                                        Set Default
                                                    </Button>
                                                )}
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    color="error"
                                                    onClick={() => deleteBankDetails(details.id)}
                                                >
                                                    Delete
                                                </Button>
                                            </Box>
                                        </Box>
                                    </Paper>
                                ))}
                            </>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setShowBankDetailsDialog(false)}>Close</Button>
                    </DialogActions>
                </Dialog>

            </Container>
        </>
    );
};

export default Wallet; 