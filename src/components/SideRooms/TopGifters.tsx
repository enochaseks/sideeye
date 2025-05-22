import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Avatar,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Chip,
    Divider,
    Paper,
    Skeleton,
    alpha,
    ToggleButtonGroup,
    ToggleButton
} from '@mui/material';
import {
    EmojiEvents as TrophyIcon,
    Favorite as HeartIcon,
    WorkspacePremium as CrownIcon,
    CardGiftcard as GiftIcon,
    Home as RoomIcon,
    Public as GlobalIcon
} from '@mui/icons-material';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, DocumentData, collectionGroup } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Link } from 'react-router-dom';

interface TopGiftersProps {
    roomId: string;
    roomOwnerId: string;
    theme: any;
    roomStyle?: any;
}

interface Gifter {
    userId: string;
    username: string;
    displayName?: string;
    avatar: string;
    totalGifts: number;
    totalValue: number;
    lastGiftDate: Date;
    roomsGiftedIn?: Set<string>;
}

interface UserData {
    username?: string;
    displayName?: string;
    name?: string;
    profilePic?: string;  // Main field used in Firestore for profile pictures
    photoURL?: string;
    avatarUrl?: string;
    avatar?: string;
}

interface GiftData {
    giftId: string;
    senderId: string;
    senderName?: string;
    receiverId: string;
    value: number;
    timestamp: any;
    roomId?: string;
}

// Badge component to show ranking
const RankBadge: React.FC<{ rank: number }> = ({ rank }) => {
    const getBadgeColor = () => {
        switch (rank) {
            case 1: return '#FFD700'; // Gold
            case 2: return '#C0C0C0'; // Silver
            case 3: return '#CD7F32'; // Bronze
            default: return '#A0A0A0'; // Gray
        }
    };

    const getBadgeIcon = () => {
        switch (rank) {
            case 1: return <CrownIcon fontSize="small" />;
            case 2:
            case 3: return <TrophyIcon fontSize="small" />;
            default: return <GiftIcon fontSize="small" />;
        }
    };

    return (
        <Chip
            icon={getBadgeIcon()}
            label={`#${rank}`}
            size="small"
            sx={{
                bgcolor: alpha(getBadgeColor(), 0.15),
                color: getBadgeColor(),
                border: `1px solid ${getBadgeColor()}`,
                fontWeight: 'bold',
                '& .MuiChip-icon': {
                    color: getBadgeColor()
                }
            }}
        />
    );
};

const TopGifters: React.FC<TopGiftersProps> = ({ roomId, roomOwnerId, theme, roomStyle }) => {
    const [topGifters, setTopGifters] = useState<Gifter[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<'all' | 'month' | 'week'>('all');
    const [scope, setScope] = useState<'room' | 'all'>('all'); // Default to showing all gifts across rooms
    const [avatarErrors, setAvatarErrors] = useState<Set<string>>(new Set());

    const handleAvatarError = (userId: string) => {
        setAvatarErrors(prev => new Set(prev).add(userId));
    };

    useEffect(() => {
        const fetchTopGifters = async () => {
            try {
                setLoading(true);
                
                let giftsPromise;
                
                if (scope === 'room') {
                    // Fetch gifts only for this room
                    const giftsRef = collection(db, 'sideRooms', roomId, 'gifts');
                    let giftsQuery = query(
                        giftsRef,
                        where('receiverId', '==', roomOwnerId),
                        orderBy('timestamp', 'desc')
                    );
                    
                    // Apply time filtering if needed
                    if (timeRange !== 'all') {
                        const date = new Date();
                        if (timeRange === 'month') {
                            date.setMonth(date.getMonth() - 1);
                        } else if (timeRange === 'week') {
                            date.setDate(date.getDate() - 7);
                        }
                        
                        giftsQuery = query(
                            giftsRef,
                            where('receiverId', '==', roomOwnerId),
                            where('timestamp', '>=', date),
                            orderBy('timestamp', 'desc')
                        );
                    }
                    
                    giftsPromise = getDocs(giftsQuery);
                } else {
                    // Fetch gifts across all rooms for this owner
                    // Use collectionGroup to query all 'gifts' subcollections
                    const giftsRef = collectionGroup(db, 'gifts');
                    let giftsQuery = query(
                        giftsRef,
                        where('receiverId', '==', roomOwnerId),
                        orderBy('timestamp', 'desc')
                    );
                    
                    // Apply time filtering if needed
                    if (timeRange !== 'all') {
                        const date = new Date();
                        if (timeRange === 'month') {
                            date.setMonth(date.getMonth() - 1);
                        } else if (timeRange === 'week') {
                            date.setDate(date.getDate() - 7);
                        }
                        
                        giftsQuery = query(
                            giftsRef,
                            where('receiverId', '==', roomOwnerId),
                            where('timestamp', '>=', date),
                            orderBy('timestamp', 'desc')
                        );
                    }
                    
                    giftsPromise = getDocs(giftsQuery);
                }
                
                const snapshot = await giftsPromise;
                
                // Process the gifts to group by sender
                const gifterMap = new Map<string, Gifter>();
                
                for (const docSnapshot of snapshot.docs) {
                    const gift = docSnapshot.data() as GiftData;
                    const senderId = gift.senderId;
                    const timestamp = gift.timestamp?.toDate() || new Date();
                    
                    // Get the roomId from the document path
                    const docPath = docSnapshot.ref.path;
                    const roomIdFromPath = docPath.split('/')[1]; // Format: sideRooms/{roomId}/gifts/{giftId}
                    
                    if (gifterMap.has(senderId)) {
                        const gifter = gifterMap.get(senderId)!;
                        gifter.totalGifts += 1;
                        gifter.totalValue += gift.value || 0;
                        if (timestamp > gifter.lastGiftDate) {
                            gifter.lastGiftDate = timestamp;
                        }
                        // Track unique rooms they've gifted in
                        if (roomIdFromPath && gifter.roomsGiftedIn) {
                            gifter.roomsGiftedIn.add(roomIdFromPath);
                        }
                    } else {
                        // Fetch user details
                        try {
                            const userDocRef = doc(db, 'users', senderId);
                            const userDocSnapshot = await getDoc(userDocRef);
                            const userData = userDocSnapshot.data() as UserData | undefined;
                            
                            // Debug log to verify user data and profile picture fields
                            console.log(`Fetched user data for ${senderId}:`, userData);
                            
                            // Initialize the rooms set
                            const roomsGiftedIn = new Set<string>();
                            if (roomIdFromPath) {
                                roomsGiftedIn.add(roomIdFromPath);
                            }
                            
                            // Get the first character of the username/display name for avatar fallback
                            let nameInitial = '?';
                            if (userData?.displayName) {
                                nameInitial = userData.displayName.charAt(0).toUpperCase();
                            } else if (userData?.name) {
                                nameInitial = userData.name.charAt(0).toUpperCase();
                            } else if (userData?.username) {
                                nameInitial = userData.username.charAt(0).toUpperCase();
                            } else if (gift.senderName) {
                                nameInitial = gift.senderName.charAt(0).toUpperCase();
                            }
                            
                            // Construct avatar URL - check all possible field names
                            const avatarUrl = userData?.profilePic || 
                                           userData?.photoURL || 
                                           userData?.avatarUrl || 
                                           userData?.avatar || 
                                           '';
                            console.log(`Avatar URL for ${senderId}:`, avatarUrl);
                            
                            gifterMap.set(senderId, {
                                userId: senderId,
                                username: userData?.username || userData?.name || gift.senderName || 'Unknown User',
                                displayName: userData?.displayName || userData?.name,
                                avatar: avatarUrl,
                                totalGifts: 1,
                                totalValue: gift.value || 0,
                                lastGiftDate: timestamp,
                                roomsGiftedIn: roomsGiftedIn
                            });
                        } catch (error) {
                            console.error('Error fetching user data', error);
                            // Add minimal gifter data if user fetch fails
                            const roomsGiftedIn = new Set<string>();
                            if (roomIdFromPath) {
                                roomsGiftedIn.add(roomIdFromPath);
                            }
                            
                            gifterMap.set(senderId, {
                                userId: senderId,
                                username: gift.senderName || 'Unknown User',
                                avatar: '',
                                totalGifts: 1,
                                totalValue: gift.value || 0,
                                lastGiftDate: timestamp,
                                roomsGiftedIn: roomsGiftedIn
                            });
                        }
                    }
                }
                
                // Convert to array and sort by total value and consistency (number of rooms)
                const giftersList = Array.from(gifterMap.values())
                    .sort((a, b) => {
                        // First prioritize by total value
                        const valueComparison = b.totalValue - a.totalValue;
                        if (valueComparison !== 0) return valueComparison;
                        
                        // Then by room count (consistency) if tracking all rooms
                        if (scope === 'all') {
                            const aRoomCount = a.roomsGiftedIn?.size || 0;
                            const bRoomCount = b.roomsGiftedIn?.size || 0;
                            const roomComparison = bRoomCount - aRoomCount;
                            if (roomComparison !== 0) return roomComparison;
                        }
                        
                        // Finally by total gift count
                        return b.totalGifts - a.totalGifts;
                    });
                
                setTopGifters(giftersList);
                
            } catch (error) {
                console.error('Error fetching top gifters:', error);
            } finally {
                setLoading(false);
            }
        };
        
        if (roomOwnerId) {
            fetchTopGifters();
        }
        
    }, [roomId, roomOwnerId, timeRange, scope]);
    
    // Generate time period options
    const timePeriodOptions = [
        { value: 'all', label: 'All Time' },
        { value: 'month', label: 'This Month' },
        { value: 'week', label: 'This Week' }
    ];
    
    const handleScopeChange = (_: React.MouseEvent<HTMLElement>, newScope: 'room' | 'all' | null) => {
        if (newScope !== null) {
            setScope(newScope);
        }
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
            {/* Header */}
            <Box sx={{
                p: 1.5,
                borderBottom: `1px solid ${roomStyle?.accentColor ? alpha(roomStyle?.accentColor, 0.3) : theme.palette.divider}`,
                bgcolor: roomStyle?.headerColor ? alpha(roomStyle?.headerColor, 0.1) : alpha(theme.palette.background.paper, 0.7),
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5
            }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle2" fontWeight="medium" sx={{ 
                        fontFamily: roomStyle?.font || 'inherit', 
                        color: roomStyle?.textColor || 'inherit' 
                    }}>
                        Top Gifters
                    </Typography>
                    
                    <ToggleButtonGroup
                        value={scope}
                        exclusive
                        onChange={handleScopeChange}
                        size="small"
                        aria-label="gift scope"
                        sx={{
                            '& .MuiToggleButton-root': {
                                color: roomStyle?.textColor || theme.palette.text.primary,
                                fontSize: '0.7rem',
                                py: 0.5,
                                px: 1,
                                '&.Mui-selected': {
                                    color: roomStyle?.accentColor || theme.palette.primary.main,
                                    bgcolor: alpha(roomStyle?.accentColor || theme.palette.primary.main, 0.1)
                                }
                            }
                        }}
                    >
                        <ToggleButton value="room">
                            <RoomIcon fontSize="small" sx={{ mr: 0.5 }} />
                            This Room
                        </ToggleButton>
                        <ToggleButton value="all">
                            <GlobalIcon fontSize="small" sx={{ mr: 0.5 }} />
                            All Rooms
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Box>
                
                {/* Time period filter */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {timePeriodOptions.map((option) => (
                        <Chip
                            key={option.value}
                            label={option.label}
                            clickable
                            size="small"
                            color={timeRange === option.value ? "primary" : "default"}
                            onClick={() => setTimeRange(option.value as 'all' | 'month' | 'week')}
                            sx={{
                                bgcolor: timeRange === option.value ? 
                                    alpha(roomStyle?.accentColor || theme.palette.primary.main, 0.2) : 
                                    alpha(theme.palette.background.paper, 0.5),
                                color: timeRange === option.value ?
                                    roomStyle?.accentColor || theme.palette.primary.main :
                                    roomStyle?.textColor || theme.palette.text.primary,
                                borderColor: timeRange === option.value ?
                                    roomStyle?.accentColor || theme.palette.primary.main :
                                    theme.palette.divider,
                                border: '1px solid'
                            }}
                        />
                    ))}
                </Box>
            </Box>
            
            {/* Content */}
            <Box sx={{ 
                flexGrow: 1, 
                overflowY: 'auto', 
                p: 0,
                bgcolor: roomStyle?.backgroundGradient ? 
                    alpha(roomStyle?.backgroundColor || theme.palette.background.default, 0.3) : 
                    alpha(theme.palette.background.paper, 0.5),
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
                {loading ? (
                    // Loading skeletons
                    <List>
                        {[...Array(5)].map((_, i) => (
                            <React.Fragment key={i}>
                                <ListItem>
                                    <ListItemAvatar>
                                        <Skeleton variant="circular" width={40} height={40} />
                                    </ListItemAvatar>
                                    <ListItemText 
                                        primary={<Skeleton width="60%" />} 
                                        secondary={<Skeleton width="40%" />} 
                                    />
                                    <Skeleton variant="rounded" width={60} height={24} sx={{ ml: 1 }} />
                                </ListItem>
                                {i < 4 && <Divider variant="inset" component="li" />}
                            </React.Fragment>
                        ))}
                    </List>
                ) : topGifters.length > 0 ? (
                    <List sx={{ py: 0 }}>
                        {topGifters.map((gifter, index) => (
                            <React.Fragment key={gifter.userId}>
                                <ListItem 
                                    component={Link}
                                    to={`/profile/${gifter.userId}`}
                                    alignItems="center"
                                    sx={{ 
                                        transition: 'background-color 0.2s',
                                        bgcolor: index < 3 ? 
                                            alpha(index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32', 0.05) : 
                                            'transparent',
                                        '&:hover': {
                                            bgcolor: alpha(roomStyle?.accentColor || theme.palette.primary.main, 0.1),
                                            textDecoration: 'none'
                                        },
                                        textDecoration: 'none'
                                    }}
                                >
                                    <ListItemAvatar>
                                        <Avatar 
                                            src={avatarErrors.has(gifter.userId) ? '' : gifter.avatar}
                                            alt={gifter.displayName || gifter.username}
                                            onError={() => handleAvatarError(gifter.userId)}
                                            sx={{ 
                                                border: index < 3 ? 
                                                    `2px solid ${index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32'}` : 
                                                    undefined
                                            }}
                                        >
                                            {(avatarErrors.has(gifter.userId) || !gifter.avatar) && 
                                                (gifter.displayName || gifter.username || '?').charAt(0).toUpperCase()}
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={
                                            <Typography
                                                variant="body2"
                                                fontWeight={index < 3 ? 'bold' : 'medium'}
                                                sx={{ 
                                                    fontFamily: roomStyle?.font || 'inherit',
                                                    color: roomStyle?.textColor || theme.palette.text.primary
                                                }}
                                            >
                                                {gifter.displayName || gifter.username}
                                            </Typography>
                                        }
                                        secondary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Typography
                                                    variant="caption"
                                                    sx={{ 
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 0.5,
                                                        color: alpha(roomStyle?.textColor || theme.palette.text.secondary, 0.7),
                                                        fontFamily: roomStyle?.font || 'inherit'
                                                    }}
                                                >
                                                    <GiftIcon fontSize="inherit" />
                                                    {gifter.totalGifts} gift{gifter.totalGifts !== 1 ? 's' : ''}
                                                </Typography>
                                                
                                                {scope === 'all' && gifter.roomsGiftedIn && gifter.roomsGiftedIn.size > 1 && (
                                                    <Chip 
                                                        size="small"
                                                        label={`${gifter.roomsGiftedIn.size} rooms`}
                                                        sx={{ 
                                                            height: 16,
                                                            fontSize: '0.6rem',
                                                            ml: 1,
                                                            bgcolor: alpha(roomStyle?.accentColor || theme.palette.secondary.main, 0.1),
                                                            color: roomStyle?.textColor || theme.palette.text.secondary
                                                        }}
                                                    />
                                                )}
                                            </Box>
                                        }
                                    />
                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                        <Typography 
                                            variant="body2"
                                            sx={{ 
                                                fontWeight: 'bold',
                                                color: roomStyle?.accentColor || theme.palette.primary.main,
                                                fontFamily: roomStyle?.font || 'inherit'
                                            }}
                                        >
                                            {gifter.totalValue} pts
                                        </Typography>
                                        <RankBadge rank={index + 1} />
                                    </Box>
                                </ListItem>
                                {index < topGifters.length - 1 && <Divider variant="inset" component="li" />}
                            </React.Fragment>
                        ))}
                    </List>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', p: 3 }}>
                        <GiftIcon sx={{ fontSize: 40, color: alpha(roomStyle?.textColor || theme.palette.text.secondary, 0.5), mb: 2 }} />
                        <Typography 
                            variant="body1"
                            sx={{ 
                                textAlign: 'center',
                                color: alpha(roomStyle?.textColor || theme.palette.text.secondary, 0.7),
                                fontFamily: roomStyle?.font || 'inherit'
                            }}
                        >
                            {scope === 'room' 
                                ? 'No gifts have been sent in this room yet' 
                                : 'No gifts have been sent to this creator yet'}
                        </Typography>
                        <Typography 
                            variant="caption"
                            sx={{ 
                                textAlign: 'center',
                                color: alpha(roomStyle?.textColor || theme.palette.text.secondary, 0.5),
                                fontFamily: roomStyle?.font || 'inherit',
                                mt: 1
                            }}
                        >
                            Send a gift to show your appreciation!
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default TopGifters; 