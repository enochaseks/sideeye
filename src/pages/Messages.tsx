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
  ListItemIcon
} from '@mui/material';
import { 
  Search as SearchIcon,
  Add as AddIcon,
  Edit as EditIcon,
  ArrowBack as ArrowBackIcon,
  Send as SendIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, getDocs, collection, query, where, orderBy, limit, onSnapshot, setDoc, serverTimestamp, deleteDoc, writeBatch } from 'firebase/firestore';
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
  [key: string]: any;
}

const Messages: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  useEffect(() => {
    if (!currentUser?.uid) return;

    // Listen to user's conversations
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', currentUser.uid),
      orderBy('lastUpdated', 'desc')
      );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const conversationsData: Conversation[] = [];
      
      const conversationPromises = snapshot.docs.map(async (docSnapshot) => {
        const data = docSnapshot.data();
        const otherParticipantId = data.participants.find((id: string) => id !== currentUser.uid);
        
        if (otherParticipantId) {
          // Fetch complete user data for the conversation partner
          const userDocRef = doc(db, 'users', otherParticipantId);
          const userDoc = await getDoc(userDocRef);
          const userData = userDoc.data() as UserData || {};
          
          // Try multiple profile pic fields in case different fields are used
          const profilePic = userData?.profilePic || userData?.photoURL || userData?.avatarUrl || undefined;
          
          console.log('Chat partner data:', userData); // Debug log to inspect profile data
          console.log('Profile pic field options:', {
            profilePic: userData?.profilePic,
            photoURL: userData?.photoURL,
            avatarUrl: userData?.avatarUrl,
            finalChoice: profilePic
          });
          
          return {
            id: docSnapshot.id,
            participants: data.participants,
            lastMessage: data.lastMessage,
            unreadCount: data.unreadCount?.[currentUser.uid] || 0,
            displayName: userData?.name || userData?.username || 'Unknown User',
            photoURL: profilePic
          };
        }
        return null;
      });
      
      const resolvedConversations = await Promise.all(conversationPromises);
      conversationsData.push(...resolvedConversations.filter(Boolean) as Conversation[]);
      
      setConversations(conversationsData);
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
      
      // Create new conversation
      const newConversationRef = doc(collection(db, 'conversations'));
      await setDoc(newConversationRef, {
        participants: [currentUser.uid, userId],
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        unreadCount: {
          [currentUser.uid]: 0,
          [userId]: 0
        }
      });
      
      navigate(`/chat/conversation/${newConversationRef.id}`);
    } catch (error) {
      console.error('Error creating conversation:', error);
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
      setConversations(prev => 
        prev.filter(conv => conv.id !== selectedConversation.id)
      );
      
      toast.success('Conversation deleted');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Failed to delete conversation');
    } finally {
      setLoading(false);
      handleMenuClose();
  }
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
      </Paper>
      
      {loading && conversations.length === 0 ? (
        <Box sx={{ textAlign: 'center', mt: 4, p: 3 }}>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            New messages will be displayed here
          </Typography>
        </Box>
      ) : loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : conversations.length === 0 ? (
        <Box sx={{ textAlign: 'center', mt: 4, p: 3 }}>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            You haven't started any conversations yet
          </Typography>
        <Button
          variant="contained"
            startIcon={<EditIcon />}
            onClick={() => setShowNewChatDialog(true)}
            sx={{ mt: 2 }}
        >
            Start a new chat
        </Button>
      </Box>
      ) : (
        <List sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
          {conversations.map((conversation, index) => (
            <React.Fragment key={conversation.id}>
              <ListItem 
                alignItems="flex-start" 
                button
                onClick={() => navigate(`/chat/conversation/${conversation.id}`)}
                sx={{ py: 2 }}
                secondaryAction={
                  <IconButton 
                    edge="end" 
                    onClick={(e) => handleMenuOpen(e, conversation)}
                    aria-label="more options"
                  >
                    <MoreVertIcon />
                  </IconButton>
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
              {index < conversations.length - 1 && <Divider component="li" />}
          </React.Fragment>
        ))}
        </List>
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
    </Container>
  );
};

export default Messages; 