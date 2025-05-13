import React, { useState, useEffect } from 'react';
import {
  Container, 
  Typography, 
  Box,
  TextField, 
  Button, 
  Avatar,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  IconButton,
  Paper,
  CircularProgress,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Badge,
  Menu,
  MenuItem,
  ListItemIcon,
  Tabs,
  Tab,
  Alert,
  Snackbar
} from '@mui/material';
import { 
  Search as SearchIcon,
  Add as AddIcon,
  Edit as EditIcon,
  ArrowBack as ArrowBackIcon,
  Send as SendIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  CheckCircle as AcceptIcon,
  Cancel as DeclineIcon,
  NotificationsActive as RequestsIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, getDocs, collection, query, where, orderBy, limit, onSnapshot, setDoc, serverTimestamp, deleteDoc, writeBatch, arrayUnion, arrayRemove, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { toast } from 'react-hot-toast';

interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: {
    text: string;
    sender: string;
    timestamp: any;
  };
  unreadCount?: number;
  displayName?: string;
  photoURL?: string;
  status?: 'pending' | 'accepted';
}

interface UserProfile {
  id: string;
  username: string;
  name?: string;
  profilePic?: string;
}

interface UserData {
  username?: string;
  name?: string;
  profilePic?: string;
  following?: string[];
  followers?: string[];
  [key: string]: any;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`messages-tabpanel-${index}`}
      aria-labelledby={`messages-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const Messages: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [userFollowing, setUserFollowing] = useState<string[]>([]);
  const [userFollowers, setUserFollowers] = useState<string[]>([]);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  useEffect(() => {
    if (!currentUser?.uid) return;

    // Fetch current user's following/followers list
    const fetchUserNetwork = async () => {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserData;
          setUserFollowing(userData.following || []);
          setUserFollowers(userData.followers || []);
        }
      } catch (error) {
        console.error('Error fetching user network:', error);
      }
    };

    fetchUserNetwork();

    // Listen to user's conversations
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', currentUser.uid),
      orderBy('lastUpdated', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const acceptedConversations: Conversation[] = [];
      const pendingConversations: Conversation[] = [];
      
      // If there are no conversations, update state and exit early
      if (snapshot.empty) {
        console.log('[Messages] No conversations found for user');
        setConversations([]);
        setPendingRequests([]);
        setLoading(false);
        return;
      }

      try {
        console.log(`[Messages] Processing ${snapshot.docs.length} conversations`);
        
        // Process each conversation document
        for (const docSnapshot of snapshot.docs) {
          const data = docSnapshot.data();
          const otherParticipantId = data.participants.find((id: string) => id !== currentUser.uid);
          
          if (!otherParticipantId) {
            console.log('[Messages] No other participant found in conversation:', docSnapshot.id);
            continue; // Skip this conversation
          }
          
          // Determine if this is a message request based on the status field
          const status = data.status || 'accepted';
          console.log(`[Messages] Conversation ${docSnapshot.id} status: ${status}`);
          
          // Fetch complete user data for the conversation partner
          try {
            const userDocRef = doc(db, 'users', otherParticipantId);
            const userDoc = await getDoc(userDocRef);
            const userData = userDoc.data() as UserData || {};
            
            // Try multiple profile pic fields in case different fields are used
            const profilePic = userData?.profilePic || userData?.photoURL || userData?.avatarUrl || undefined;
            
            const conversationData = {
              id: docSnapshot.id,
              participants: data.participants,
              lastMessage: data.lastMessage,
              unreadCount: data.unreadCount?.[currentUser.uid] || 0,
              displayName: userData?.name || userData?.username || 'Unknown User',
              photoURL: profilePic,
              status: status
            };
            
            // SIMPLE RULE: If status is pending, it goes to requests, otherwise inbox
            if (status === 'pending') {
              pendingConversations.push(conversationData);
              console.log(`[Messages] Added to REQUESTS: conversation with ${conversationData.displayName}`);
            } else {
              acceptedConversations.push(conversationData);
              console.log(`[Messages] Added to INBOX: conversation with ${conversationData.displayName}`);
            }
          } catch (error) {
            console.error('[Messages] Error fetching user data for conversation:', error);
            // Still create a basic conversation object with available data
            const conversationData = {
              id: docSnapshot.id,
              participants: data.participants,
              lastMessage: data.lastMessage,
              unreadCount: data.unreadCount?.[currentUser.uid] || 0,
              displayName: 'Unknown User',
              status: status
            };
            
            // Same simple rule for error fallback
            if (status === 'pending') {
              pendingConversations.push(conversationData);
            } else {
              acceptedConversations.push(conversationData);
            }
          }
        }
        
        console.log('[Messages] Processed conversations:', { 
          accepted: acceptedConversations.length, 
          pending: pendingConversations.length 
        });
        
        // Update state with processed conversations
        setConversations(acceptedConversations);
        setPendingRequests(pendingConversations);
      } catch (error) {
        console.error('[Messages] Error processing conversations:', error);
        // Set empty arrays in case of error
        setConversations([]);
        setPendingRequests([]);
      } finally {
        // Always set loading to false
        setLoading(false);
      }
    }, (error) => {
      console.error('[Messages] Error in conversations listener:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);
  
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    setLoading(true);
    try {
      // Search for users by username - ensure lowercase for case-insensitive search
      const lowerQuery = searchQuery.toLowerCase().trim();
      const usersRef = collection(db, 'users');
      
      // Query by username (case insensitive)
      const usernameQuery = query(
        usersRef,
        where('username', '>=', lowerQuery),
        where('username', '<=', lowerQuery + '\uf8ff'),
        limit(10)
      );
      
      const snapshot = await getDocs(usernameQuery);
      
      // Query by displayName/name 
      const nameQuery = query(
        usersRef,
        where('name', '>=', searchQuery),
        where('name', '<=', searchQuery + '\uf8ff'),
        limit(10)
      );
      
      const nameSnapshot = await getDocs(nameQuery);
      
      // Combine results, removing duplicates
      const uniqueUsers = new Map();
      
      snapshot.docs.forEach(docSnapshot => {
        uniqueUsers.set(docSnapshot.id, { id: docSnapshot.id, ...docSnapshot.data() });
      });
      
      nameSnapshot.docs.forEach(docSnapshot => {
        uniqueUsers.set(docSnapshot.id, { id: docSnapshot.id, ...docSnapshot.data() });
      });
      
      const results = Array.from(uniqueUsers.values()) as UserProfile[];
      
      // Filter out the current user
      const filteredResults = results.filter(user => user.id !== currentUser?.uid);
      
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching users:', error);
      toast.error('Failed to search users');
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = async (userId: string) => {
    if (!currentUser?.uid) return;
    
    setCreatingChat(true);
    try {
      // Check if conversation already exists
      const existingConversationQuery = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', currentUser.uid)
      );
      
      const snapshot = await getDocs(existingConversationQuery);
      let existingConversationId: string | null = null;
      
      snapshot.docs.forEach(docSnapshot => {
        const data = docSnapshot.data();
        if (data.participants.includes(userId)) {
          existingConversationId = docSnapshot.id;
        }
      });
      
      if (existingConversationId) {
        // Conversation exists, navigate to it
        navigate(`/chat/conversation/${existingConversationId}`);
        return;
      }
      
      // Check if the current user follows the recipient
      // Get the recipient user data
      const recipientRef = doc(db, 'users', userId);
      const recipientDoc = await getDoc(recipientRef);
      
      if (!recipientDoc.exists()) {
        toast.error('User not found');
        return;
      }
      
      // Does the recipient follow the current user?
      const recipientData = recipientDoc.data() as UserData;
      const recipientFollowsCurrentUser = recipientData.following?.includes(currentUser.uid) || false;
      
      console.log(`[Messages] Creating conversation: ${recipientData.username || userId} follows current user? ${recipientFollowsCurrentUser}`);
      
      // Create new conversation with appropriate status
      const newConversationRef = doc(collection(db, 'conversations'));
      await setDoc(newConversationRef, {
        participants: [currentUser.uid, userId],
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        unreadCount: {
          [currentUser.uid]: 0,
          [userId]: 0
        },
        // If recipient follows the sender, it's accepted. Otherwise, it's a pending request
        status: recipientFollowsCurrentUser ? 'accepted' : 'pending'
      });
      
      navigate(`/chat/conversation/${newConversationRef.id}`);
    } catch (error) {
      console.error('[Messages] Error creating conversation:', error);
      toast.error('Failed to start conversation');
    } finally {
      setCreatingChat(false);
      setShowNewChatDialog(false);
    }
  };
  
  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const day = 24 * 60 * 60 * 1000;
    
    if (diff < day) {
      // Today - show time
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diff < 2 * day) {
      // Yesterday
      return 'Yesterday';
    } else {
      // Older - show date
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>, conversation: Conversation) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setSelectedConversation(conversation);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedConversation(null);
  };
  
  const handleDeleteConversation = async () => {
    if (!selectedConversation || !currentUser) {
      handleMenuClose();
      return;
    }
    
    try {
      setLoading(true);
      
      // Create a batch for multiple operations
      const batch = writeBatch(db);
      
      // First, delete all messages in the conversation
      const messagesRef = collection(db, 'conversations', selectedConversation.id, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);
      
      // Add all message deletes to batch
      messagesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Next, delete the conversation document
      const conversationRef = doc(db, 'conversations', selectedConversation.id);
      batch.delete(conversationRef);
      
      // Commit the batch
      await batch.commit();
      
      // Remove from local state to update UI immediately
      setConversations(prev => prev.filter(conv => conv.id !== selectedConversation.id));
      setPendingRequests(prev => prev.filter(conv => conv.id !== selectedConversation.id));
      
      setSnackbarMessage('Conversation deleted');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Failed to delete conversation');
    } finally {
      setLoading(false);
      handleMenuClose();
    }
  };

  const handleAcceptRequest = async (conversation: Conversation) => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      
      // Update conversation status to accepted
      const conversationRef = doc(db, 'conversations', conversation.id);
      await updateDoc(conversationRef, {
        status: 'accepted'
      });
      
      // Move from pending to accepted in local state
      setPendingRequests(prev => prev.filter(conv => conv.id !== conversation.id));
      setConversations(prev => [{ ...conversation, status: 'accepted' }, ...prev]);
      
      setSnackbarMessage('Message request accepted');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error accepting message request:', error);
      toast.error('Failed to accept message request');
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineRequest = async (conversation: Conversation) => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      
      // Delete the conversation and all messages
      const batch = writeBatch(db);
      
      // Delete all messages
      const messagesRef = collection(db, 'conversations', conversation.id, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);
      
      messagesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Delete the conversation
      const conversationRef = doc(db, 'conversations', conversation.id);
      batch.delete(conversationRef);
      
      await batch.commit();
      
      // Remove from local state
      setPendingRequests(prev => prev.filter(conv => conv.id !== conversation.id));
      
      setSnackbarMessage('Message request declined');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error declining message request:', error);
      toast.error('Failed to decline message request');
    } finally {
      setLoading(false);
    }
  };

  const renderConversationList = (conversationList: Conversation[]) => {
    if (conversationList.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', mt: 4, p: 3 }}>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            {tabValue === 0 ? "You haven't started any conversations yet" : "No message requests"}
          </Typography>
          {tabValue === 0 && (
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => setShowNewChatDialog(true)}
              sx={{ mt: 2 }}
            >
              Start a new chat
            </Button>
          )}
        </Box>
      );
    }

    return (
      <List sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
        {conversationList.map((conversation, index) => (
          <React.Fragment key={conversation.id}>
            <ListItem 
              alignItems="flex-start" 
              button
              onClick={() => navigate(`/chat/conversation/${conversation.id}`)}
              sx={{ py: 2 }}
              secondaryAction={
                conversation.status === 'pending' ? (
                  <Box sx={{ display: 'flex' }}>
                    <IconButton 
                      edge="end" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAcceptRequest(conversation);
                      }}
                      color="success"
                      aria-label="accept request"
                      title="Accept"
                    >
                      <AcceptIcon />
                    </IconButton>
                    <IconButton 
                      edge="end" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeclineRequest(conversation);
                      }}
                      color="error"
                      aria-label="decline request"
                      title="Decline"
                    >
                      <DeclineIcon />
                    </IconButton>
                  </Box>
                ) : (
                  <IconButton 
                    edge="end" 
                    onClick={(e) => handleMenuOpen(e, conversation)}
                    aria-label="more options"
                  >
                    <MoreVertIcon />
                  </IconButton>
                )
              }
            >
              <ListItemAvatar>
                <Badge
                  color="primary"
                  badgeContent={typeof conversation.unreadCount === 'number' ? conversation.unreadCount : 0}
                  invisible={!conversation.unreadCount}
                >
                  <Avatar 
                    alt={conversation.displayName || 'User'} 
                    src={conversation.photoURL || undefined}
                    sx={{ 
                      width: 40, 
                      height: 40,
                      bgcolor: !conversation.photoURL ? 'primary.main' : undefined
                    }}
                  >
                    {!conversation.photoURL && conversation.displayName?.charAt(0).toUpperCase()}
                  </Avatar>
                </Badge>
              </ListItemAvatar>
              <ListItemText
                primary={conversation.displayName}
                secondary={
                  <React.Fragment>
                    <Typography
                      component="span"
                      variant="body2"
                      color="text.primary"
                      sx={{ 
                        display: 'inline',
                        fontWeight: conversation.unreadCount ? 'bold' : 'normal',
                      }}
                    >
                      {conversation.lastMessage?.text || 'Start a conversation'}
                    </Typography>
                    {conversation.lastMessage?.timestamp && (
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mt: 0.5 }}
                      >
                        {formatTimestamp(conversation.lastMessage.timestamp)}
                      </Typography>
                    )}
                  </React.Fragment>
                }
              />
            </ListItem>
            {index < conversationList.length - 1 && <Divider component="li" />}
          </React.Fragment>
        ))}
      </List>
    );
  };

  return (
    <Container maxWidth="md" sx={{ mt: 2, mb: 8 }}>
      <Paper elevation={0} sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h5" fontWeight="bold">Messages</Typography>
          <IconButton onClick={() => setShowNewChatDialog(true)} color="primary">
            <EditIcon />
          </IconButton>
        </Box>
        
        <TextField
          fullWidth
          placeholder="Search conversations..."
          variant="outlined"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchQuery('')}>
                  <ArrowBackIcon />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{ mb: 2 }}
        />
        
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            aria-label="message tabs"
            variant="fullWidth"
          >
            <Tab 
              label="Inbox" 
              id="messages-tab-0" 
              aria-controls="messages-tabpanel-0"
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <span>Message Requests</span>
                  {pendingRequests.length > 0 && (
                    <Badge 
                      color="error" 
                      badgeContent={pendingRequests.length} 
                      sx={{ ml: 1 }}
                    />
                  )}
                </Box>
              } 
              id="messages-tab-1" 
              aria-controls="messages-tabpanel-1"
              icon={pendingRequests.length > 0 ? <RequestsIcon fontSize="small" /> : undefined}
              iconPosition="end"
            />
          </Tabs>
        </Box>
      </Paper>
      
      {loading && conversations.length === 0 && pendingRequests.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <TabPanel value={tabValue} index={0}>
            {renderConversationList(conversations)}
          </TabPanel>
          <TabPanel value={tabValue} index={1}>
            {pendingRequests.length > 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                These are message requests from people you don't follow. Accept to start chatting or decline to remove.
              </Alert>
            )}
            {renderConversationList(pendingRequests)}
          </TabPanel>
        </>
      )}
      
      {/* Dropdown menu for conversation options */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleDeleteConversation} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          Delete conversation
        </MenuItem>
      </Menu>
      
      {/* New Chat Dialog */}
      <Dialog
        open={showNewChatDialog}
        onClose={() => setShowNewChatDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Start a new conversation</Typography>
            <IconButton 
              edge="end" 
              color="inherit" 
              onClick={() => setShowNewChatDialog(false)}
              aria-label="close"
            >
              <ArrowBackIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            fullWidth
            label="Search for a user"
            variant="outlined"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleSearch}>
                    <SearchIcon />
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{ mb: 2 }}
          />
          
          {searchResults.length > 0 && (
            <List>
              {searchResults.map((user) => (
                <ListItem
                  key={user.id}
                  button
                  onClick={() => startNewChat(user.id)}
                  disabled={creatingChat}
                >
                  <ListItemAvatar>
                    <Avatar src={user.profilePic} alt={user.username || user.name} />
                  </ListItemAvatar>
                  <ListItemText
                    primary={user.name || user.username}
                    secondary={`@${user.username}`}
                  />
                </ListItem>
              ))}
            </List>
          )}
          
          {searchQuery && searchResults.length === 0 && !loading && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography variant="body2" color="text.secondary">
                No users found for "{searchQuery}"
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Try using a different search term
              </Typography>
            </Box>
          )}
          
          {loading && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={32} sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Searching for users...
              </Typography>
            </Box>
          )}
          
          {!searchQuery && !loading && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Enter a username or name to search
              </Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Snackbar for feedback messages */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        message={snackbarMessage}
      />
    </Container>
  );
};

export default Messages; 