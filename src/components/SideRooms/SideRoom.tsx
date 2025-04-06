import React, { useState, useEffect, useRef, ReactElement } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot, DocumentData, addDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import {
  Box,
  Typography,
  Button,
  Paper,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Menu,
  MenuItem,
  Badge,
  CircularProgress,
  Alert,
  FormControlLabel,
  Switch,
  Chip,
  Select,
  FormControl,
  InputLabel,
  Divider
} from '@mui/material';
import {
  Mic,
  MicOff,
  Headset,
  HeadsetOff,
  MoreVert,
  PersonAdd,
  Edit,
  Delete,
  Close,
  Add
} from '@mui/icons-material';
import RoomMemberManagement from '../RoomMemberManagement';
import { toast } from 'react-hot-toast';

interface UserData {
  username?: string;
  displayName?: string;
  avatar?: string;
  photoURL?: string;
}

interface RoomData {
  id: string;
  name: string;
  description: string;
  owner: {
    userId: string;
    username: string;
    displayName: string;
    avatar: string;
  };
  members: Array<{
    userId: string;
    username: string;
    displayName: string;
    avatar: string;
    role: string;
    joinedAt: Date;
  }>;
  memberCount: number;
  isPrivate: boolean;
  password?: string;
  tags: string[];
  category: string;
  rules: string[];
  createdAt: Date;
  isLive: boolean;
  liveParticipants: string[];
  maxParticipants: number;
  enableLiveSessions: boolean;
  maxLiveParticipants: number;
  allowGuestSpeakers: boolean;
  guestSpeakerLimit: number;
}

const SideRoom: React.FC = (): ReactElement => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showMemberManagement, setShowMemberManagement] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioDestination, setAudioDestination] = useState<MediaStreamAudioDestinationNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [editRules, setEditRules] = useState<string[]>([]);
  const [newRule, setNewRule] = useState('');
  const [editMaxParticipants, setEditMaxParticipants] = useState(50);
  const [editEnableLiveSessions, setEditEnableLiveSessions] = useState(false);
  const [editMaxLiveParticipants, setEditMaxLiveParticipants] = useState(4);
  const [editAllowGuestSpeakers, setEditAllowGuestSpeakers] = useState(false);
  const [editGuestSpeakerLimit, setEditGuestSpeakerLimit] = useState(2);
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [editPassword, setEditPassword] = useState('');
  const [messages, setMessages] = useState<Array<{
    id: string;
    userId: string;
    username: string;
    content: string;
    timestamp: Date;
  }>>([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    if (!roomId) {
      setError('Room ID is required');
      setLoading(false);
      return;
    }

    const roomRef = doc(db, 'sideRooms', roomId);
    const unsubscribe = onSnapshot(roomRef, async (snapshot) => {
      if (snapshot.exists()) {
        const roomData = snapshot.data() as DocumentData;
        
        // Always fetch owner data to ensure it's complete
        const ownerId = typeof roomData.owner === 'string' ? roomData.owner : roomData.owner?.userId;
        if (ownerId) {
          const ownerRef = doc(db, 'users', ownerId);
          const ownerSnapshot = await getDoc(ownerRef);
          if (ownerSnapshot.exists()) {
            const ownerData = ownerSnapshot.data() as UserData;
            roomData.owner = {
              userId: ownerSnapshot.id,
              username: ownerData.username || ownerData.displayName || ownerSnapshot.id,
              displayName: ownerData.displayName || ownerData.username || ownerSnapshot.id,
              avatar: ownerData.avatar || ownerData.photoURL || ''
            };
          }
        }

        // Fetch member data if not already included
        if (Array.isArray(roomData.members)) {
          const memberPromises = roomData.members.map(async (member: any) => {
            if (typeof member === 'string') {
              const memberRef = doc(db, 'users', member);
              const memberSnapshot = await getDoc(memberRef);
              if (memberSnapshot.exists()) {
                const memberData = memberSnapshot.data() as UserData;
                return {
                  userId: memberSnapshot.id,
                  username: memberData.username || memberData.displayName || memberSnapshot.id,
                  displayName: memberData.displayName || memberData.username || memberSnapshot.id,
                  avatar: memberData.avatar || memberData.photoURL || '',
                  role: 'member',
                  joinedAt: roomData.createdAt
                };
              }
            }
            return member;
          });
          roomData.members = await Promise.all(memberPromises);
        }

        const roomWithDefaults: RoomData = {
          id: snapshot.id,
          name: roomData.name || 'Unnamed Room',
          description: roomData.description || 'No description available',
          owner: roomData.owner || {
            userId: '',
            username: 'Unknown User',
            displayName: 'Unknown User',
            avatar: ''
          },
          members: roomData.members || [],
          memberCount: roomData.memberCount || 0,
          isPrivate: roomData.isPrivate || false,
          password: roomData.password,
          tags: roomData.tags || [],
          category: roomData.category || 'General',
          rules: roomData.rules || [],
          createdAt: roomData.createdAt || new Date(),
          isLive: roomData.isLive || false,
          liveParticipants: roomData.liveParticipants || [],
          maxParticipants: roomData.maxParticipants || 10,
          enableLiveSessions: roomData.enableLiveSessions || false,
          maxLiveParticipants: roomData.maxLiveParticipants || 4,
          allowGuestSpeakers: roomData.allowGuestSpeakers || false,
          guestSpeakerLimit: roomData.guestSpeakerLimit || 2
        };
        setRoom(roomWithDefaults);
      } else {
        setError('Room not found');
      }
      setLoading(false);
    }, (err) => {
      setError('Error loading room: ' + err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomId]);

  const setupAudio = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      
      const context = new AudioContext();
      setAudioContext(context);
      
      const destination = context.createMediaStreamDestination();
      setAudioDestination(destination);
      
      const source = context.createMediaStreamSource(stream);
      source.connect(destination);
      
      if (audioRef.current) {
        audioRef.current.srcObject = destination.stream;
        audioRef.current.play();
      }
    } catch (err) {
      setError('Error setting up audio: ' + (err as Error).message);
    }
  };

  const cleanupAudio = (): void => {
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      setAudioStream(null);
    }
    if (audioContext) {
      audioContext.close();
      setAudioContext(null);
    }
    if (audioDestination) {
      setAudioDestination(null);
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
  };

  const handleToggleMute = (): void => {
    if (!audioStream) return;
    
    const audioTrack = audioStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const handleToggleDeafen = (): void => {
    if (!audioRef.current) return;
    
    audioRef.current.muted = !audioRef.current.muted;
    setIsDeafened(audioRef.current.muted);
  };

  const handleJoinRoom = async (): Promise<void> => {
    if (!currentUser || !room) return;

    try {
      const isMember = room.members.some(m => m.userId === currentUser.uid);
      if (!isMember) {
        // Get current user's data from Firestore
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (!userDoc.exists()) {
          throw new Error('User data not found');
        }
        const userData = userDoc.data();
        
        const newMember = {
          userId: currentUser.uid,
          username: userData.username || currentUser.displayName || 'Unknown User',
          displayName: userData.displayName || userData.username || currentUser.displayName || 'Unknown User',
          avatar: userData.avatar || userData.photoURL || currentUser.photoURL || '',
          role: 'member',
          joinedAt: new Date()
        };

        await updateDoc(doc(db, 'sideRooms', room.id), {
          members: arrayUnion(newMember),
          memberCount: (room.memberCount || 0) + 1
        });
      }
    } catch (err) {
      setError('Error joining room: ' + (err as Error).message);
    }
  };

  const handleLeaveRoom = async (): Promise<void> => {
    if (!currentUser || !room) return;

    try {
      const member = room.members.find(m => m.userId === currentUser.uid);
      if (member) {
        await updateDoc(doc(db, 'sideRooms', room.id), {
          members: arrayRemove(member),
          memberCount: room.memberCount - 1
        });
        navigate('/side-rooms');
      }
    } catch (err) {
      setError('Error leaving room: ' + (err as Error).message);
    }
  };

  const handleToggleLive = async (): Promise<void> => {
    if (!currentUser || !room) return;

    try {
      if (room.isLive) {
        await updateDoc(doc(db, 'sideRooms', room.id), {
          isLive: false,
          liveParticipants: arrayRemove(currentUser.uid)
        });
        cleanupAudio();
      } else {
        await updateDoc(doc(db, 'sideRooms', room.id), {
          isLive: true,
          liveParticipants: arrayUnion(currentUser.uid)
        });
        await setupAudio();
      }
    } catch (err) {
      setError('Error toggling live status: ' + (err as Error).message);
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>): void => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = (): void => {
    setAnchorEl(null);
  };

  const formatDate = (date: Date | { toDate: () => Date } | undefined): string => {
    if (!date) return 'Unknown date';
    if (date instanceof Date) {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    if (typeof date === 'object' && 'toDate' in date) {
      return date.toDate().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return 'Invalid date';
  };

  const getUserDisplayName = (user: { username?: string; displayName?: string } | null | undefined): string => {
    if (!user) return 'Unknown User';
    return user.displayName || user.username || 'Unknown User';
  };

  const getUserAvatar = (user: { avatar?: string; photoURL?: string } | null | undefined): string => {
    if (!user) return '';
    return user.avatar || user.photoURL || '';
  };

  const handleEditRoom = (): void => {
    if (!room) return;
    setEditName(room.name);
    setEditDescription(room.description);
    setEditCategory(room.category);
    setEditTags(room.tags);
    setEditRules(room.rules);
    setEditMaxParticipants(room.maxParticipants);
    setEditEnableLiveSessions(room.enableLiveSessions);
    setEditMaxLiveParticipants(room.maxLiveParticipants);
    setEditAllowGuestSpeakers(room.allowGuestSpeakers);
    setEditGuestSpeakerLimit(room.guestSpeakerLimit);
    setEditIsPrivate(room.isPrivate);
    setEditPassword(room.password || '');
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async (): Promise<void> => {
    if (!room) return;
    try {
      const roomData = {
        name: editName.trim(),
        description: editDescription.trim(),
        category: editCategory,
        tags: editTags,
        rules: editRules,
        maxParticipants: editMaxParticipants,
        enableLiveSessions: editEnableLiveSessions,
        maxLiveParticipants: editMaxLiveParticipants,
        allowGuestSpeakers: editAllowGuestSpeakers,
        guestSpeakerLimit: editGuestSpeakerLimit,
        isPrivate: editIsPrivate,
        ...(editIsPrivate && { password: editPassword.trim() })
      };

      await updateDoc(doc(db, 'sideRooms', room.id), roomData);
      setEditDialogOpen(false);
    } catch (err) {
      setError('Error updating room: ' + (err as Error).message);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !editTags.includes(newTag.trim())) {
      setEditTags([...editTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditTags(editTags.filter(tag => tag !== tagToRemove));
  };

  const handleAddRule = () => {
    if (newRule.trim() && !editRules.includes(newRule.trim())) {
      setEditRules([...editRules, newRule.trim()]);
      setNewRule('');
    }
  };

  const handleRemoveRule = (ruleToRemove: string) => {
    setEditRules(editRules.filter(rule => rule !== ruleToRemove));
  };

  const handleDeleteRoom = async () => {
    if (!currentUser || !room) return;

    try {
      const roomRef = doc(db, 'sideRooms', room.id);
      const messagesRef = collection(db, 'sideRooms', room.id, 'messages');
      const trashRef = collection(db, 'trash');

      // Get all messages
      const messagesSnapshot = await getDocs(messagesRef);
      const messages = messagesSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        originalPath: `sideRooms/${room.id}/messages/${doc.id}`
      }));

      // Create a batch operation
      const batch = writeBatch(db);

      // Add room to trash with its messages
      const trashRoomRef = doc(trashRef, room.id);
      batch.set(trashRoomRef, {
        ...room,
        deletedAt: new Date(),
        deletedBy: currentUser.uid,
        originalPath: `sideRooms/${room.id}`,
        messages: messages
      });

      // Delete the original room and its messages
      batch.delete(roomRef);
      messagesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Commit the batch
      await batch.commit();

      toast.success('Room moved to trash successfully');
      navigate('/side-rooms');
    } catch (error) {
      console.error('Error moving room to trash:', error);
      toast.error('Failed to move room to trash');
    }
  };

  const handleSendMessage = async (): Promise<void> => {
    if (!currentUser || !room || !newMessage.trim()) return;

    try {
      const messageData = {
        userId: currentUser.uid,
        username: currentUser.displayName || 'Anonymous',
        content: newMessage.trim(),
        timestamp: new Date()
      };

      await addDoc(collection(db, 'sideRooms', room.id, 'messages'), messageData);
      setNewMessage('');
    } catch (err) {
      setError('Error sending message: ' + (err as Error).message);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !room) {
    return (
      <Box p={3}>
        <Alert severity="error">{error || 'Room not found'}</Alert>
      </Box>
    );
  }

  const isOwner = currentUser?.uid === room.owner?.userId;
  const isMember = room.members?.some(m => m.userId === currentUser?.uid) || false;
  const isLive = room.isLive && room.liveParticipants?.includes(currentUser?.uid || '');

  return (
    <Box p={3}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4">{room?.name || 'Unnamed Room'}</Typography>
            <Typography variant="subtitle1" color="text.secondary">
              {room?.description || 'No description available'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Created by {getUserDisplayName(room?.owner)} on {formatDate(room?.createdAt)}
            </Typography>
          </Box>
          <Box>
            {currentUser?.uid === room?.owner?.userId && (
              <>
                <IconButton onClick={handleMenuClick}>
                  <MoreVert />
                </IconButton>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleMenuClose}
                >
                  <MenuItem onClick={handleEditRoom}>
                    <Edit sx={{ mr: 1 }} />
                    Edit Room
                  </MenuItem>
                  <MenuItem onClick={handleDeleteRoom}>
                    <Delete sx={{ mr: 1 }} />
                    Delete Room
                  </MenuItem>
                </Menu>
              </>
            )}
            {isMember ? (
              <Button
                variant="contained"
                color="error"
                onClick={handleLeaveRoom}
                startIcon={<Close />}
              >
                Leave Room
              </Button>
            ) : (
              <Button
                variant="contained"
                color="primary"
                startIcon={<PersonAdd />}
                onClick={handleJoinRoom}
              >
                Join Room
              </Button>
            )}
          </Box>
        </Box>

        <Box display="flex" gap={2} mb={3}>
          {room.enableLiveSessions ? (
            <>
              <Button
                variant="contained"
                color={isLive ? "error" : "success"}
                startIcon={isLive ? <MicOff /> : <Mic />}
                onClick={handleToggleLive}
                disabled={!isMember}
              >
                {isLive ? "Stop Live" : "Go Live"}
              </Button>
              {isLive && (
                <>
                  <IconButton
                    color={isMuted ? "error" : "default"}
                    onClick={handleToggleMute}
                  >
                    <Badge color="error" variant="dot" invisible={!isMuted}>
                      <Mic />
                    </Badge>
                  </IconButton>
                  <IconButton
                    color={isDeafened ? "error" : "default"}
                    onClick={handleToggleDeafen}
                  >
                    <Badge color="error" variant="dot" invisible={!isDeafened}>
                      <Headset />
                    </Badge>
                  </IconButton>
                </>
              )}
            </>
          ) : (
            <Typography variant="body1" color="text.secondary">
              This is a chat room. Enable live sessions in room settings to start voice chat.
            </Typography>
          )}
        </Box>

        <Box display="flex" gap={3}>
          <Box flex={1}>
            <Typography variant="h6" gutterBottom>
              Members ({room?.memberCount || 0})
            </Typography>
            <List>
              <ListItem>
                <ListItemAvatar>
                  <Avatar src={getUserAvatar(room?.owner)} />
                </ListItemAvatar>
                <ListItemText
                  primary={`${getUserDisplayName(room?.owner)} (Owner)`}
                  secondary={`Joined ${formatDate(room?.createdAt)}`}
                />
                {room?.liveParticipants?.includes(room?.owner?.userId || '') && (
                  <Box sx={{ color: 'success.main' }}>
                    <Mic />
                  </Box>
                )}
              </ListItem>
              {room?.members
                ?.filter(member => member.userId !== room?.owner?.userId)
                .map((member) => (
                  <ListItem key={member.userId}>
                    <ListItemAvatar>
                      <Avatar src={getUserAvatar(member)} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={getUserDisplayName(member)}
                      secondary={`${member.role || 'member'} • Joined ${formatDate(member.joinedAt)}`}
                    />
                    {room?.liveParticipants?.includes(member.userId) && (
                      <Box sx={{ color: 'success.main' }}>
                        <Mic />
                      </Box>
                    )}
                  </ListItem>
                ))}
            </List>
          </Box>

          <Box flex={2}>
            <Paper elevation={1} sx={{ p: 2, height: '400px', display: 'flex', flexDirection: 'column' }}>
              <Box flex={1} sx={{ overflowY: 'auto', mb: 2 }}>
                {messages.map((message) => (
                  <Box key={message.id} sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" color="primary">
                      {message.username}
                    </Typography>
                    <Typography variant="body1">
                      {message.content}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button
                  variant="contained"
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                >
                  Send
                </Button>
              </Box>
            </Paper>
          </Box>

          <Box flex={1}>
            <Typography variant="h6" gutterBottom>
              Room Rules
            </Typography>
            <List>
              {room.rules.map((rule, index) => (
                <ListItem key={index}>
                  <ListItemText primary={rule} />
                </ListItem>
              ))}
            </List>
          </Box>
        </Box>
      </Paper>

      <Dialog
        open={showPasswordDialog}
        onClose={() => setShowPasswordDialog(false)}
      >
        <DialogTitle>Enter Room Password</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Password"
            type="password"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPasswordDialog(false)}>Cancel</Button>
          <Button
            onClick={() => {
              if (password === room.password) {
                handleJoinRoom();
                setShowPasswordDialog(false);
              } else {
                setError('Incorrect password');
              }
            }}
            color="primary"
          >
            Join
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Room</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          
          <TextField
            autoFocus
            margin="dense"
            label="Room Name"
            type="text"
            fullWidth
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />
          
          <TextField
            margin="dense"
            label="Description"
            type="text"
            fullWidth
            multiline
            rows={3}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
          />

          <FormControl fullWidth margin="dense">
            <InputLabel>Category</InputLabel>
            <Select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              label="Category"
            >
              <MenuItem value="general">General</MenuItem>
              <MenuItem value="gaming">Gaming</MenuItem>
              <MenuItem value="music">Music</MenuItem>
              <MenuItem value="movies">Movies & TV</MenuItem>
              <MenuItem value="sports">Sports</MenuItem>
              <MenuItem value="tech">Technology</MenuItem>
              <MenuItem value="art">Art & Design</MenuItem>
              <MenuItem value="education">Education</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2">Tags</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
              {editTags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  onDelete={() => handleRemoveTag(tag)}
                />
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add tag"
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
              />
              <IconButton onClick={handleAddTag} size="small">
                <Add />
              </IconButton>
            </Box>
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2">Rules</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
              {editRules.map((rule) => (
                <Chip
                  key={rule}
                  label={rule}
                  onDelete={() => handleRemoveRule(rule)}
                />
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                value={newRule}
                onChange={(e) => setNewRule(e.target.value)}
                placeholder="Add rule"
                onKeyPress={(e) => e.key === 'Enter' && handleAddRule()}
              />
              <IconButton onClick={handleAddRule} size="small">
                <Add />
              </IconButton>
            </Box>
          </Box>

          <TextField
            margin="dense"
            label="Maximum Participants"
            type="number"
            fullWidth
            value={editMaxParticipants}
            onChange={(e) => setEditMaxParticipants(Number(e.target.value))}
            inputProps={{ min: 2, max: 100 }}
          />

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" sx={{ mb: 2 }}>Privacy Settings</Typography>

          <FormControlLabel
            control={
              <Switch
                checked={editIsPrivate}
                onChange={(e) => setEditIsPrivate(e.target.checked)}
              />
            }
            label="Private Room"
          />

          {editIsPrivate && (
            <TextField
              margin="dense"
              label="Room Password"
              type="password"
              fullWidth
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              helperText="Set a password for the room"
            />
          )}

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" sx={{ mb: 2 }}>Room Type</Typography>

          <FormControlLabel
            control={
              <Switch
                checked={editEnableLiveSessions}
                onChange={(e) => setEditEnableLiveSessions(e.target.checked)}
              />
            }
            label="Enable Live Sessions"
          />

          {editEnableLiveSessions && (
            <>
              <TextField
                margin="dense"
                label="Maximum Live Participants"
                type="number"
                fullWidth
                value={editMaxLiveParticipants}
                onChange={(e) => setEditMaxLiveParticipants(Number(e.target.value))}
                inputProps={{ min: 1, max: 10 }}
                helperText="Maximum number of people who can join the live session"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={editAllowGuestSpeakers}
                    onChange={(e) => setEditAllowGuestSpeakers(e.target.checked)}
                  />
                }
                label="Allow Guest Speakers"
              />

              {editAllowGuestSpeakers && (
                <TextField
                  margin="dense"
                  label="Guest Speaker Limit"
                  type="number"
                  fullWidth
                  value={editGuestSpeakerLimit}
                  onChange={(e) => setEditGuestSpeakerLimit(Number(e.target.value))}
                  inputProps={{ min: 1, max: 5 }}
                  helperText="Maximum number of guest speakers allowed in a session"
                />
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained">Save Changes</Button>
        </DialogActions>
      </Dialog>

      <audio ref={audioRef} autoPlay />
    </Box>
  );
};

export default SideRoom; 