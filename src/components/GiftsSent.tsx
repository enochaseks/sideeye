import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Avatar,
    Chip,
    CircularProgress,
    Alert,
    Paper,
    Grid,
    useTheme
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
    CardGiftcard as CardGiftcardIcon,
    Favorite as FavoriteIcon,
    Visibility as VisibilityIcon,
    Celebration as CelebrationIcon,
    WorkspacePremium as WorkspacePremiumIcon,
    Diamond as DiamondIcon,
    EmojiEvents as EmojiEventsIcon
} from '@mui/icons-material';
import { db } from '../services/firebase';
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    getDocs, 
    doc, 
    getDoc,
    collectionGroup,
    onSnapshot
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import SCCoinIcon from './SCCoinIcon';

interface GiftSentItem {
    id: string;
    giftId: string;
    giftName: string;
    giftType: string;
    value: number;
    roomId: string;
    roomName: string;
    hostId: string;
    hostName: string;
    hostAvatar?: string;
    timestamp: any;
    roomDeleted?: boolean;
}

interface GiftsSentProps {
    userId: string;
    isOwnProfile: boolean;
}

// Gift icon mapping
const getGiftIcon = (giftId: string) => {
    switch (giftId) {
        case 'heart-gift':
            return <FavoriteIcon />;
        case 'side-eye-gift':
            return <VisibilityIcon />;
        case 'confetti-gift':
            return <CelebrationIcon />;
        case 'crown-gift':
            return <WorkspacePremiumIcon />;
        case 'diamond-gift':
            return <DiamondIcon />;
        case 'trophy-gift':
            return <EmojiEventsIcon />;
        default:
            return <CardGiftcardIcon />;
    }
};

// Gift color mapping
const getGiftColor = (giftId: string) => {
    switch (giftId) {
        case 'heart-gift':
            return '#FF5C8D';
        case 'side-eye-gift':
            return '#9C27B0';
        case 'confetti-gift':
            return '#FF9800';
        case 'crown-gift':
            return '#FFC107';
        case 'diamond-gift':
            return '#00BCD4';
        case 'trophy-gift':
            return '#4CAF50';
        default:
            return '#757575';
    }
};

const GiftsSent: React.FC<GiftsSentProps> = ({ userId, isOwnProfile }) => {
    const { currentUser } = useAuth();
    const theme = useTheme();
    const [giftsSent, setGiftsSent] = useState<GiftSentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [totalValue, setTotalValue] = useState(0);
    const [giftCount, setGiftCount] = useState(0);

    useEffect(() => {
        const fetchUserGifts = async () => {
            if (!userId) {
                setLoading(false);
                return;
            }

            console.log('[GiftsSent] Setting up real-time listeners for user:', userId);
            setLoading(true);

            try {
                // Get all rooms to check for gifts
                const roomsSnapshot = await getDocs(collection(db, 'sideRooms'));
                const unsubscribeFunctions: (() => void)[] = [];
                
                let allGifts: GiftSentItem[] = [];
                let roomCount = 0;
                
                const updateGiftsDisplay = () => {
                    // Sort gifts by timestamp (newest first)
                    allGifts.sort((a, b) => {
                        // Handle both timestamp formats - new numeric and old Firestore timestamp
                        const aTime = typeof a.timestamp === 'number' ? a.timestamp : 
                                     (a.timestamp?.toDate ? a.timestamp.toDate().getTime() : Date.now());
                        const bTime = typeof b.timestamp === 'number' ? b.timestamp : 
                                     (b.timestamp?.toDate ? b.timestamp.toDate().getTime() : Date.now());
                        return bTime - aTime;
                    });
                    setGiftsSent(allGifts);
                    
                    // Calculate statistics - show real money spent instead of SC
                    const totalMoneySpent = allGifts.reduce((sum, gift) => {
                        // All gifts now cost real money - show actual money spent by user
                        return sum + (gift.value || 0);
                    }, 0);
                    const totalCount = allGifts.length;
                    const uniqueHosts = new Set(allGifts.map(gift => gift.hostId)).size;
                    
                    setTotalValue(totalMoneySpent); // Shows actual money spent by user
                    setGiftCount(totalCount);
                    console.log('[GiftsSent] Statistics updated:', { totalMoneySpent, totalCount, uniqueHosts });
                };

                // Set up listeners for each room
                for (const roomDoc of roomsSnapshot.docs) {
                    const roomId = roomDoc.id;
                    const roomData = roomDoc.data();
                    
                    // Real-time listener for gifts sent by this user in each room
                    const giftsQuery = query(
                        collection(db, 'sideRooms', roomId, 'gifts'),
                        where('senderId', '==', userId),
                        orderBy('timestamp', 'desc')
                    );

                    const unsubscribe = onSnapshot(giftsQuery, async (snapshot) => {
                        // Remove old gifts from this room first
                        allGifts = allGifts.filter(gift => gift.roomId !== roomId);
                        
                        // Process gifts from this room
                        for (const giftDoc of snapshot.docs) {
                            const giftData = giftDoc.data();
                            
                            // Get receiver info
                            let receiverName = 'Unknown Host';
                            let receiverAvatar = '';
                            
                            try {
                                const receiverRef = doc(db, 'users', giftData.receiverId);
                                const receiverDoc = await getDoc(receiverRef);
                                
                                if (receiverDoc.exists()) {
                                    const receiverData = receiverDoc.data();
                                    receiverName = receiverData.name || receiverData.username || 'Host';
                                    receiverAvatar = receiverData.profilePic || '';
                                }
                            } catch (error) {
                                console.warn('[GiftsSent] Could not fetch receiver data for:', giftData.receiverId);
                            }

                            const giftItem: GiftSentItem = {
                                id: giftDoc.id,
                                giftId: giftData.giftId || 'unknown-gift',
                                giftName: giftData.giftName || 'Unknown Gift',
                                giftType: giftData.giftType || 'basic',
                                value: giftData.value || 0,
                                roomId: roomId,
                                roomName: roomData.name || 'Unknown Room',
                                hostId: giftData.receiverId,
                                hostName: receiverName,
                                hostAvatar: receiverAvatar,
                                timestamp: giftData.timestamp || Date.now(),
                                roomDeleted: roomData.deleted === true
                            };

                            allGifts.push(giftItem);
                        }
                        
                        updateGiftsDisplay();
                    });

                    unsubscribeFunctions.push(unsubscribe);
                }

                setLoading(false);
                
                // Return cleanup function
                return () => {
                    console.log('[GiftsSent] Cleaning up listeners');
                    unsubscribeFunctions.forEach(unsub => unsub());
                };

            } catch (error) {
                console.error('[GiftsSent] Error setting up gift listeners:', error);
                setLoading(false);
            }
        };

        let cleanup: (() => void) | undefined;
        fetchUserGifts().then(cleanupFn => {
            cleanup = cleanupFn;
        });

        return () => {
            if (cleanup) {
                cleanup();
            }
        };
    }, [userId]);

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'Unknown date';
        
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toLocaleDateString();
        } catch (error) {
            return 'Unknown date';
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ mt: 2 }}>
                {error}
            </Alert>
        );
    }

    if (giftsSent.length === 0) {
        return (
            <Box sx={{ textAlign: 'center', py: 4 }}>
                <CardGiftcardIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                    {isOwnProfile ? "You haven't sent any gifts yet" : "No gifts sent yet"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {isOwnProfile ? "Start gifting during live sessions to show your appreciation!" : "This user hasn't sent any gifts in live rooms."}
                </Typography>
            </Box>
        );
    }

    return (
        <Box>
            {/* Stats summary */}
            <Paper elevation={1} sx={{ p: 2, mb: 3, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <Grid container spacing={2} sx={{ textAlign: 'center' }}>
                    <Grid item xs={6}>
                        <Typography variant="h4" color="primary" fontWeight="bold">
                            {giftCount}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Gifts Sent
                        </Typography>
                    </Grid>
                    <Grid item xs={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                            <Typography variant="h4" color="secondary" fontWeight="bold">
                                £{totalValue.toFixed(2)}
                            </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                            Money Spent
                        </Typography>
                    </Grid>
                </Grid>
            </Paper>

            {/* Gifts organized by sections */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {(() => {
                    // Group gifts by gift type
                    const groupedGifts = giftsSent.reduce((groups, gift) => {
                        const giftType = gift.giftId || 'unknown-gift';
                        if (!groups[giftType]) {
                            groups[giftType] = [];
                        }
                        groups[giftType].push(gift);
                        return groups;
                    }, {} as Record<string, GiftSentItem[]>);

                    // Define gift order for consistent display
                    const giftOrder = ['heart-gift', 'side-eye-gift', 'confetti-gift', 'crown-gift', 'diamond-gift', 'trophy-gift'];
                    
                    // Sort groups by the defined order, then by gift name
                    const sortedGiftTypes = Object.keys(groupedGifts).sort((a, b) => {
                        const aIndex = giftOrder.indexOf(a);
                        const bIndex = giftOrder.indexOf(b);
                        
                        if (aIndex !== -1 && bIndex !== -1) {
                            return aIndex - bIndex;
                        } else if (aIndex !== -1) {
                            return -1;
                        } else if (bIndex !== -1) {
                            return 1;
                        } else {
                            return a.localeCompare(b);
                        }
                    });

                    return sortedGiftTypes.map(giftType => {
                        const giftsOfType = groupedGifts[giftType];
                        const firstGift = giftsOfType[0];
                        const giftCount = giftsOfType.length;
                        const actualMoneySpentOnType = giftsOfType.reduce((sum, gift) => {
                            // Only count actual money spent on paid gifts
                            return sum + (gift.giftType !== 'basic' ? gift.value : 0);
                        }, 0);

                        return (
                            <Paper key={giftType} elevation={2} sx={{ p: 3, borderRadius: 2 }}>
                                {/* Section Header */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                    <Box 
                                        sx={{ 
                                            color: getGiftColor(giftType),
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: 56,
                                            height: 56,
                                            borderRadius: '50%',
                                            bgcolor: alpha(getGiftColor(giftType), 0.1),
                                            border: `2px solid ${alpha(getGiftColor(giftType), 0.3)}`
                                        }}
                                    >
                                        {getGiftIcon(giftType)}
                                    </Box>
                                    <Box sx={{ flexGrow: 1 }}>
                                        <Typography variant="h5" component="div" fontWeight="bold">
                                            {firstGift.giftName}
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                                            <Chip 
                                                size="small" 
                                                label={`${giftCount} sent`}
                                                color="primary"
                                                variant="outlined"
                                            />
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Typography variant="body2" fontWeight="medium">
                                                    £{actualMoneySpentOnType.toFixed(2)} spent
                                                </Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                                                <Typography variant="caption" color="text.secondary">
                                                    (Host earned ~{((actualMoneySpentOnType * 0.8) / 0.005).toFixed(0)} SC)
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Box>
                                </Box>

                                {/* Gifts in this section */}
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                    {giftsOfType.map((gift) => (
                                        <Card 
                                            key={gift.id}
                                            variant="outlined"
                                            sx={{ 
                                                '&:hover': {
                                                    boxShadow: 2,
                                                    transform: 'translateY(-1px)',
                                                    transition: 'all 0.2s ease-in-out'
                                                },
                                                opacity: gift.roomDeleted ? 0.7 : 1,
                                                bgcolor: alpha(getGiftColor(giftType), 0.02)
                                            }}
                                        >
                                            <CardContent sx={{ p: 2 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                    {/* Host info */}
                                                    <Avatar 
                                                        src={gift.hostAvatar} 
                                                        alt={gift.hostName}
                                                        sx={{ width: 32, height: 32 }}
                                                    >
                                                        {gift.hostName.charAt(0).toUpperCase()}
                                                    </Avatar>
                                                    
                                                    {/* Gift details */}
                                                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                            <Typography variant="body1" fontWeight="medium" noWrap>
                                                                To: {gift.hostName}
                                                            </Typography>
                                                            {gift.roomDeleted && (
                                                                <Chip 
                                                                    size="small" 
                                                                    label="Deleted Room"
                                                                    color="error"
                                                                    variant="outlined"
                                                                />
                                                            )}
                                                        </Box>
                                                        <Typography variant="body2" color="text.secondary" noWrap>
                                                            Room: {gift.roomName}
                                                        </Typography>
                                                    </Box>

                                                    {/* Value and date */}
                                                    <Box sx={{ textAlign: 'right' }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end', mb: 0.5 }}>
                                                            <Typography variant="body2" fontWeight="bold">
                                                                £{gift.value.toFixed(2)}
                                                            </Typography>
                                                        </Box>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {formatDate(gift.timestamp)}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </Box>
                            </Paper>
                        );
                    });
                })()}
            </Box>
        </Box>
    );
};

export default GiftsSent; 