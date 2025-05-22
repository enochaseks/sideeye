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
    Zoom
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
    Timestamp
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
            value: 5, 
            color: '#9C27B0' 
        },
        { 
            id: 'heart-gift', 
            type: 'basic', 
            name: 'Heart', 
            icon: <FavoriteIcon />, 
            value: 10, 
            color: '#FF5C8D' 
        },
        { 
            id: 'confetti-gift', 
            type: 'basic', 
            name: 'Confetti', 
            icon: <CelebrationIcon />, 
            value: 15, 
            color: '#FF9800' 
        },
        { 
            id: 'crown-gift', 
            type: 'basic', 
            name: 'Crown', 
            icon: <WorkspacePremiumIcon />, 
            value: 20, 
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

    // Check if current user is the room owner
    const isRoomOwner = currentUser?.uid === roomOwnerId;

    // Keep track of processed gifts to prevent duplicate animations
    const processedGiftsRef = useRef<Set<string>>(new Set());
    
    // Track first load to prevent animations when component mounts
    const isFirstLoadRef = useRef<boolean>(true);

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
        
        setIsLoading(true);
        
        try {
            // Add gift to the gift history
            await addDoc(collection(db, 'sideRooms', roomId, 'gifts'), {
                giftId: selectedGift.id,
                giftType: selectedGift.type,
                giftName: selectedGift.name,
                senderId: currentUser.uid,
                senderName: currentUser.displayName || 'Anonymous',
                receiverId: roomOwnerId, // Assuming gifts are sent to the room owner
                timestamp: Timestamp.now(),
                value: selectedGift.value
            });
            
            // Update room owner's gift count/value
            const userRef = doc(db, 'users', roomOwnerId);
            await updateDoc(userRef, {
                giftCount: increment(1),
                giftValue: increment(selectedGift.value)
            });
            
            setDialogOpen(false);
            setIsLoading(false);
            
            // Show animation for sender
            setAnimatingGift(selectedGift);
            setShowAnimation(true);
            
        } catch (error) {
            console.error('Error sending gift:', error);
            setIsLoading(false);
        }
    };

    const handleAnimationComplete = () => {
        setShowAnimation(false);
        setAnimatingGift(null);
    };

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
                            Free Gifts
                        </Typography>
                        <Grid container spacing={2} sx={{ mt: 0.5 }}>
                            {freeGifts.map((gift) => (
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
                                        <Chip 
                                            size="small" 
                                            label="Gift" 
                                            sx={{ 
                                                mt: 1, 
                                                bgcolor: alpha(gift.color, 0.2),
                                                color: gift.color,
                                                fontWeight: 'bold'
                                            }} 
                                        />
                                    </Paper>
                                </Grid>
                            ))}
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
                            <Typography variant="body2">
                                Premium gifts will be available soon! Stay tuned for exciting new ways to show your support.
                            </Typography>
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
                            As the room owner, you can view gifts that others have sent to you.
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
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                Are you sure you want to send this gift to the room owner?
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
                        Send Gift
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Gifts; 