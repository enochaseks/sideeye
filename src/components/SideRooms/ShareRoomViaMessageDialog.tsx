import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  CircularProgress,
  Typography,
  Box,
  Divider,
  Chip,
} from '@mui/material';
import { collection, query, where, getDocs, limit, DocumentData, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { toast } from 'react-hot-toast';

// Define the shape of user data from Firestore
interface FirestoreUser extends DocumentData {
  username: string;
  displayName?: string;
  photoURL?: string;
  profilePic?: string;  // Add this as some users might have profilePic instead of photoURL
  email?: string;
}

interface UserProfile {
  id: string;
  username: string;
  displayName?: string;
  photoURL?: string;
  email?: string;
}

interface ServerChatRoom {
  id: string;
  name: string;
}

interface ShareRoomViaMessageDialogProps {
  open: boolean;
  onClose: () => void;
  roomName: string | undefined;
  roomLink: string;
  onSend: (recipientId: string, message: string) => Promise<void>;
  currentUserId: string | undefined;
}

const ShareRoomViaMessageDialog: React.FC<ShareRoomViaMessageDialogProps> = ({
  open,
  onClose,
  roomName,
  roomLink,
  onSend,
  currentUserId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [serverChatRooms, setServerChatRooms] = useState<ServerChatRoom[]>([]);
  const [loadingServerChats, setLoadingServerChats] = useState(false);

  // Fetch server chat rooms
  const fetchServerChatRooms = useCallback(async () => {
    if (!currentUserId || !db) return;

    setLoadingServerChats(true);
    try {
      // Query for all rooms where the user is a member
      const roomsRef = collection(db, 'rooms');
      const q = query(
        roomsRef,
        where('members', 'array-contains', currentUserId)
      );

      const roomsSnapshot = await getDocs(q);
      const rooms: ServerChatRoom[] = [];

      roomsSnapshot.forEach((doc) => {
        const data = doc.data();
        rooms.push({
          id: doc.id,
          name: data.name || 'Chat Room'
        });
      });

      setServerChatRooms(rooms);
    } catch (error) {
      console.error('Error fetching server chat rooms:', error);
      toast.error('Failed to load server chat rooms');
    } finally {
      setLoadingServerChats(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (open) {
      fetchServerChatRooms();
    }
  }, [open, fetchServerChatRooms]);

  // Search users in Firestore
  const searchUsers = useCallback(async (searchInput: string) => {
    if (!searchInput.trim() || searchInput.length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const usersRef = collection(db, 'users');
      
      // Get all users and filter client-side for case-insensitive search
      const firestoreQuery = query(
        usersRef,
        limit(50)  // Increased limit since we'll filter client-side
      );

      const querySnapshot = await getDocs(firestoreQuery);
      const users: UserProfile[] = [];
      const searchTermLower = searchInput.toLowerCase();

      querySnapshot.forEach((doc) => {
        // Don't include current user in results
        if (doc.id !== currentUserId) {
          const userData = doc.data() as FirestoreUser;
          // Case-insensitive search on username
          if (userData.username?.toLowerCase().includes(searchTermLower)) {
            users.push({
              id: doc.id,
              username: userData.username || '',
              displayName: userData.displayName,
              photoURL: userData.photoURL || userData.profilePic, // Try photoURL first, fall back to profilePic
              email: userData.email
            });
          }
        }
      });

      setSearchResults(users);
    } catch (error) {
      console.error('Error searching users:', error);
      toast.error('Failed to search users');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  const handleUserSelect = (user: UserProfile) => {
    setSelectedUser(user);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSend = async () => {
    if (!selectedUser) {
      toast.error('Please select a user first');
      return;
    }

    try {
      const message = `Check out this room${roomName ? `: ${roomName}` : ''}! ${roomLink}`;
      await onSend(selectedUser.id, message);
      toast.success(`Message sent to ${selectedUser.username}`);
      onClose();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleSendToServerChat = async (roomId: string, roomName: string) => {
    try {
      // Check if the room exists first
      const roomRef = doc(db, 'rooms', roomId);
      const roomDoc = await getDoc(roomRef);
      
      if (!roomDoc.exists()) {
        toast.error('Room not found');
        return;
      }

      const message = `Check out this room${roomName ? `: ${roomName}` : ''}! ${roomLink}`;
      await onSend(roomId, message);
      toast.success(`Message sent to ${roomName}`);
      onClose();
    } catch (error) {
      console.error('Error sending message to server chat:', error);
      toast.error('Failed to send message to server chat');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Share Room via Message</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="Search Users"
            variant="outlined"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type username to search..."
            disabled={!!selectedUser}
          />

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}

          {!loading && searchResults.length > 0 && !selectedUser && (
            <List sx={{ mt: 2, maxHeight: 300, overflow: 'auto' }}>
              {searchResults.map((user) => (
                <ListItem
                  key={user.id}
                  button
                  onClick={() => handleUserSelect(user)}
                >
                  <ListItemAvatar>
                    <Avatar 
                      src={user.photoURL || undefined} 
                      alt={user.username}
                      sx={{ width: 40, height: 40 }}  // Make avatar slightly larger
                    >
                      {user.username[0]?.toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText 
                    primary={user.username}
                    secondary={user.displayName || user.email}
                  />
                </ListItem>
              ))}
            </List>
          )}

          {selectedUser && (
            <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Typography variant="subtitle2">Selected User:</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Avatar 
                  src={selectedUser.photoURL || undefined} 
                  alt={selectedUser.username}
                  sx={{ width: 40, height: 40 }}  // Make avatar slightly larger
                >
                  {selectedUser.username[0]?.toUpperCase()}
                </Avatar>
                <Typography sx={{ ml: 1 }}>{selectedUser.username}</Typography>
                <Button 
                  size="small" 
                  onClick={() => setSelectedUser(null)} 
                  sx={{ ml: 'auto' }}
                >
                  Change
                </Button>
              </Box>
            </Box>
          )}

          {!loading && searchQuery.length >= 2 && searchResults.length === 0 && (
            <Typography color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
              No users found
            </Typography>
          )}

          {/* Room + Server Chat Section */}
          <Divider sx={{ mt: 3, mb: 2 }}>
            <Chip label="Room + Server Chat" />
          </Divider>

          {loadingServerChats ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : serverChatRooms.length > 0 ? (
            <List sx={{ mt: 2 }}>
              {serverChatRooms.map((room) => (
                <ListItem
                  key={room.id}
                  button
                  onClick={() => handleSendToServerChat(room.id, room.name)}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                    '&:hover': {
                      backgroundColor: 'action.hover'
                    }
                  }}
                >
                  <ListItemText
                    primary={room.name}
                    secondary="Room + Server Chat"
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
              No Room + Server Chats available
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleSend}
          disabled={!selectedUser}
        >
          Send
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShareRoomViaMessageDialog; 