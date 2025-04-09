import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Chip,
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Alert,
  Divider,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { collection, addDoc, serverTimestamp, Firestore, Timestamp, getDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { SideRoom, RoomMember } from '../types/index';

interface CreateSideRoomProps {
  open: boolean;
  onClose: () => void;
}

const CreateSideRoom: React.FC<CreateSideRoomProps> = ({ open, onClose }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [category, setCategory] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(50);
  const [rules, setRules] = useState<string[]>([]);
  const [newRule, setNewRule] = useState('');
  const [enableLiveSessions, setEnableLiveSessions] = useState(false);
  const [maxLiveParticipants, setMaxLiveParticipants] = useState(4);
  const [allowGuestSpeakers, setAllowGuestSpeakers] = useState(false);
  const [guestSpeakerLimit, setGuestSpeakerLimit] = useState(2);

  const handleCreateRoom = async () => {
    if (!currentUser || !db) return;

    if (!name.trim()) {
      setError('Room name is required');
      return;
    }

    if (isPrivate && !password.trim()) {
      setError('Password is required for private rooms');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get current user's data from Firestore
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (!userDoc.exists()) {
        throw new Error('User data not found');
      }
      const userData = userDoc.data();

      const ownerData = {
        userId: currentUser.uid,
        username: userData.username || currentUser.displayName || 'Unknown User',
        displayName: userData.displayName || userData.username || currentUser.displayName || 'Unknown User',
        avatar: userData.avatar || userData.photoURL || currentUser.photoURL || ''
      };

      const currentDate = new Date();

      const roomData = {
        name: name.trim(),
        description: description.trim(),
        ownerId: currentUser.uid,
        owner: ownerData,
        members: [{
          ...ownerData,
          role: 'owner',
          joinedAt: currentDate
        }],
        memberCount: 1,
        createdAt: currentDate,
        isPrivate,
        password: isPrivate ? password.trim() : null,
        tags,
        category,
        maxParticipants,
        rules,
        isLive: false,
        liveParticipants: [],
        activeUsers: 0,
        bannedUsers: [],
        enableLiveSessions,
        maxLiveParticipants,
        allowGuestSpeakers,
        guestSpeakerLimit,
        liveSettings: {
          audioEnabled: true,
          videoEnabled: false,
          screenSharingEnabled: false,
          raiseHandEnabled: true,
          chatEnabled: true,
          reactionsEnabled: true
        }
      };

      const docRef = await addDoc(collection(db, 'sideRooms'), roomData);

      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        sideRooms: arrayUnion(docRef.id)
      });

      onClose();
      navigate(`/side-room/${docRef.id}`);
    } catch (err) {
      console.error('Error creating room:', err);
      setError('Failed to create room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleAddRule = () => {
    if (newRule.trim() && !rules.includes(newRule.trim())) {
      setRules([...rules, newRule.trim()]);
      setNewRule('');
    }
  };

  const handleRemoveRule = (ruleToRemove: string) => {
    setRules(rules.filter(rule => rule !== ruleToRemove));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Side Room</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        <TextField
          autoFocus
          margin="dense"
          label="Room Name"
          type="text"
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        
        <TextField
          margin="dense"
          label="Description"
          type="text"
          fullWidth
          multiline
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <FormControl fullWidth margin="dense">
          <InputLabel>Category</InputLabel>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
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
            {tags.map((tag) => (
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
              <AddIcon />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2">Rules</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            {rules.map((rule) => (
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
              <AddIcon />
            </IconButton>
          </Box>
        </Box>

        <FormControlLabel
          control={
            <Switch
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
            />
          }
          label="Private Room"
        />

        {isPrivate && (
          <TextField
            margin="dense"
            label="Password"
            type="password"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        )}

        <TextField
          margin="dense"
          label="Maximum Participants"
          type="number"
          fullWidth
          value={maxParticipants}
          onChange={(e) => setMaxParticipants(Number(e.target.value))}
          inputProps={{ min: 2, max: 100 }}
        />

        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" sx={{ mb: 2 }}>Live Session Settings</Typography>

        <FormControlLabel
          control={
            <Switch
              checked={enableLiveSessions}
              onChange={(e) => setEnableLiveSessions(e.target.checked)}
            />
          }
          label="Enable Live Sessions"
        />

        {enableLiveSessions && (
          <>
            <TextField
              margin="dense"
              label="Maximum Live Participants"
              type="number"
              fullWidth
              value={maxLiveParticipants}
              onChange={(e) => setMaxLiveParticipants(Number(e.target.value))}
              inputProps={{ min: 1, max: 10 }}
              helperText="Maximum number of people who can join the live session"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={allowGuestSpeakers}
                  onChange={(e) => setAllowGuestSpeakers(e.target.checked)}
                />
              }
              label="Allow Guest Speakers"
            />

            {allowGuestSpeakers && (
              <TextField
                margin="dense"
                label="Guest Speaker Limit"
                type="number"
                fullWidth
                value={guestSpeakerLimit}
                onChange={(e) => setGuestSpeakerLimit(Number(e.target.value))}
                inputProps={{ min: 1, max: 5 }}
                helperText="Maximum number of guest speakers allowed in a session"
              />
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleCreateRoom}
          variant="contained"
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Create Room'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateSideRoom; 