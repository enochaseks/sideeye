import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { useAuthState, useSignOut } from 'react-firebase-hooks/auth';
import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Box,
  InputBase,
  Menu,
  MenuItem,
  Popper,
  Paper,
  List,
  ListItem,
  ListItemButton,
  Divider,
  Avatar,
  Link,
  ListItemIcon,
  ListItemText,
  TextField,
  useTheme,
  useMediaQuery,
  InputAdornment,
  ClickAwayListener,
  CircularProgress,
  ListItemAvatar
} from '@mui/material';
import {
  Menu as MenuIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  LocalCafe,
  Psychology,
  EmojiEvents,
  MilitaryTech,
  Security as SecurityIcon,
  Person,
  Info as InfoIcon,
  Policy as PolicyIcon,
  Cookie as CookieIcon,
  Forum as ForumIcon,
  TrendingUp as TrendingUpIcon,
  Home as HomeIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Tag as TagIcon,
  LocalCafe as SideRoomIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

interface SearchResult {
  id: string;
  type: 'user' | 'post' | 'forum' | 'sideRoom';
  title: string;
  subtitle?: string;
  avatar?: string;
}

interface UserData {
  username: string;
  name: string;
  profilePic: string;
}

interface PostData {
  content: string;
  authorId: string;
  timestamp: any;
  likes: string[];
  comments: number;
}

interface ForumData {
  title: string;
  description: string;
}

interface SideRoomData {
  name: string;
  description: string;
}

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [user] = useAuthState(auth);
  const [signOut] = useSignOut(auth);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'day' | 'week' | 'month'>('all');
  const [popularityFilter, setPopularityFilter] = useState<'all' | 'likes' | 'comments'>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);
  const { currentUser } = useAuth();

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  const handleResultClick = (result: SearchResult) => {
    setShowResults(false);
    setSearchQuery('');
    switch (result.type) {
      case 'user':
        navigate(`/profile/${result.id}`);
        break;
      case 'post':
        navigate(`/post/${result.id}`);
        break;
      case 'forum':
        navigate(`/forum/${result.id}`);
        break;
      case 'sideRoom':
        navigate(`/side-room/${result.id}`);
        break;
    }
  };

  // Add keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && searchResults.length > 0 && searchQuery) {
        const firstResult = searchResults[0];
        handleResultClick(firstResult);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchResults, searchQuery]);

  // Keyboard navigation for search results
  useHotkeys('up', () => {
    if (showResults && searchResults.length > 0) {
      setSelectedResultIndex(prev => 
        prev <= 0 ? searchResults.length - 1 : prev - 1
      );
    }
  }, { enableOnFormTags: true });

  useHotkeys('down', () => {
    if (showResults && searchResults.length > 0) {
      setSelectedResultIndex(prev => 
        prev >= searchResults.length - 1 ? 0 : prev + 1
      );
    }
  }, { enableOnFormTags: true });

  useHotkeys('esc', () => {
    setShowResults(false);
  }, { enableOnFormTags: true });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchResultsRef.current && !searchResultsRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    handleMenuClose();
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    handleMenuClose();
  };

  return (
    <>
      <AppBar 
        position="static" 
        elevation={0}
        sx={{
          backgroundColor: 'transparent',
          backgroundImage: 'none',
          boxShadow: 'none',
          borderBottom: 'none',
          padding: '0 24px',
        }}
      >
        <Toolbar 
          sx={{ 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 0',
            minHeight: 'auto',
          }}
          disableGutters
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Avatar
              src="/logo.png"
              alt="Side Eye"
              sx={{ 
                width: 40, 
                height: 40, 
                cursor: 'pointer',
                '&:hover': {
                  opacity: 0.8,
                },
              }}
              onClick={() => navigate('/')}
            />
            <Typography
              variant="h5"
              component="div"
              sx={{ 
                fontWeight: 'bold',
                cursor: 'pointer',
                color: 'primary.main',
                '&:hover': {
                  opacity: 0.8,
                },
              }}
              onClick={() => navigate('/')}
            >
              SideEye
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1, position: 'relative', maxWidth: 600, mx: 4 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search users, posts, forums..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearch(searchQuery);
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {user ? (
              <>
                <IconButton
                  color="inherit"
                  onClick={() => navigate('/')}
                  sx={{ 
                    color: 'text.primary',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    },
                  }}
                >
                  <HomeIcon />
                </IconButton>
                <IconButton
                  color="inherit"
                  sx={{ 
                    color: 'text.primary',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    },
                  }}
                >
                  <NotificationsIcon />
                </IconButton>
                <IconButton
                  color="inherit"
                  onClick={handleMenuOpen}
                  sx={{ 
                    color: 'text.primary',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    },
                  }}
                >
                  <MenuIcon />
                </IconButton>
              </>
            ) : (
              <>
                <Button
                  color="inherit"
                  onClick={() => navigate('/login')}
                  sx={{ 
                    color: 'text.primary',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    },
                  }}
                >
                  Login
                </Button>
                <Button
                  color="inherit"
                  onClick={() => navigate('/register')}
                  sx={{ 
                    color: 'text.primary',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    },
                  }}
                >
                  Register
                </Button>
              </>
            )}
          </Box>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            sx={{
              '& .MuiPaper-root': {
                borderRadius: 2,
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                minWidth: 200,
                border: 'none',
              },
            }}
          >
            <MenuItem onClick={() => handleNavigation('/side-rooms')}>
              <ListItemIcon>
                <LocalCafe />
              </ListItemIcon>
              <ListItemText primary="Side Rooms" />
            </MenuItem>
            <MenuItem onClick={() => handleNavigation('/forums')}>
              <ListItemIcon>
                <ForumIcon />
              </ListItemIcon>
              <ListItemText primary="Forums" />
            </MenuItem>
            <MenuItem onClick={() => handleNavigation('/safety')}>
              <ListItemIcon>
                <SecurityIcon />
              </ListItemIcon>
              <ListItemText primary="Safety" />
            </MenuItem>
            <MenuItem onClick={() => handleNavigation('/about')}>
              <ListItemIcon>
                <InfoIcon />
              </ListItemIcon>
              <ListItemText>About</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleNavigation('/privacy-policy')}>
              <ListItemIcon>
                <PolicyIcon />
              </ListItemIcon>
              <ListItemText>Privacy Policy</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleNavigation('/terms')}>
              <ListItemIcon>
                <PolicyIcon />
              </ListItemIcon>
              <ListItemText>Terms of Service</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleNavigation('/cookies')}>
              <ListItemIcon>
                <CookieIcon />
              </ListItemIcon>
              <ListItemText>Cookie Policy</ListItemText>
            </MenuItem>
            {user && (
              <>
                <Divider />
                <MenuItem onClick={() => handleNavigation('/profile')}>
                  <ListItemIcon>
                    <Person />
                  </ListItemIcon>
                  <ListItemText>Profile</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleSignOut}>
                  <ListItemIcon>
                    <Person />
                  </ListItemIcon>
                  <ListItemText>Logout</ListItemText>
                </MenuItem>
              </>
            )}
          </Menu>
        </Toolbar>
      </AppBar>
    </>
  );
};

export default Navbar; 