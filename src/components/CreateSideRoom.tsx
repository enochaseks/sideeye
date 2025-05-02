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
  FormHelperText,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { collection, addDoc, serverTimestamp, Firestore, Timestamp, getDoc, doc, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';
import { storage } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { SideRoom, RoomMember } from '../types/index';
import { toast } from 'react-hot-toast';
import RoomForm from './SideRooms/RoomForm';

interface CreateSideRoomProps {
  open: boolean;
  onClose: () => void;
}

interface FormData {
  name: string;
  description: string;
  isPrivate: boolean;
  password: string;
  category: string;
  tags: string[];
}

const CreateSideRoom: React.FC<CreateSideRoomProps> = ({ open, onClose }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    isPrivate: false,
    password: '',
    category: '',
    tags: []
  });
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [category, setCategory] = useState('');
  const [rules, setRules] = useState<string[]>([]);
  const [newRule, setNewRule] = useState('');
  const [enableLiveSessions, setEnableLiveSessions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !db) return;

    // Validate required fields
    if (!formData.name.trim()) {
      toast.error('Room name is required');
      return;
    }
    if (!formData.description.trim()) {
      toast.error('Description is required');
      return;
    }
    if (!formData.category) {
      toast.error('Category is required');
      return;
    }
    if (formData.isPrivate && !formData.password.trim()) {
      toast.error('Password is required for private rooms');
      return;
    }

    try {
      setIsSubmitting(true);
      const roomData = {
        name: formData.name,
        description: formData.description,
        ownerId: currentUser.uid,
        viewers: [{
          userId: currentUser.uid,
          username: currentUser.displayName || 'Anonymous',
          avatar: currentUser.photoURL || '',
          role: 'owner',
          joinedAt: serverTimestamp()
        }],
        viewerCount: 1,
        createdAt: serverTimestamp(),
        isPrivate: formData.isPrivate,
        password: formData.isPrivate ? formData.password : '',
        category: formData.category,
        tags: formData.tags,
        lastActive: serverTimestamp(),
        isLive: false,
        liveParticipants: [],
        activeUsers: 0
      };

      const roomRef = await addDoc(collection(db, 'sideRooms'), roomData);

      // Add room to user's rooms collection
      await setDoc(doc(db, 'users', currentUser.uid, 'sideRooms', roomRef.id), {
        name: formData.name,
        description: formData.description,
        role: 'owner',
        joinedAt: serverTimestamp(),
        lastActive: serverTimestamp()
      });

      // --- Thumbnail Upload Logic ---
      if (thumbnailFile) {
        toast.loading('Uploading thumbnail...', { id: 'thumbnail-upload' });
        try {
          const storageRef = ref(storage, `sideRoomThumbnails/${roomRef.id}/${thumbnailFile.name}`);
          const snapshot = await uploadBytes(storageRef, thumbnailFile);
          const thumbnailUrl = await getDownloadURL(snapshot.ref);
          // Update the Firestore document with the URL
          await updateDoc(roomRef, { thumbnailUrl: thumbnailUrl });
          toast.dismiss('thumbnail-upload');
          toast.success('Thumbnail uploaded!');
        } catch (uploadError) {
          console.error("Error uploading thumbnail:", uploadError);
          toast.dismiss('thumbnail-upload');
          toast.error("Failed to upload thumbnail, but room created.");
          // Continue without thumbnail
        }
      }
      // --- End Thumbnail Upload Logic ---

      toast.success('Room created successfully!');
      onClose();
      navigate(`/side-room/${roomRef.id}`);
    } catch (error) {
      console.error('Error creating room:', error);
      toast.error('Failed to create room');
    } finally {
      setIsSubmitting(false);
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setThumbnailFile(event.target.files[0]);
    } else {
      setThumbnailFile(null);
    }
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
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          required
          error={!formData.name.trim()}
          helperText={!formData.name.trim() ? "Room name is required" : ""}
        />
        
        <TextField
          margin="dense"
          label="Description"
          type="text"
          fullWidth
          multiline
          rows={3}
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          required
          error={!formData.description.trim()}
          helperText={!formData.description.trim() ? "Description is required" : ""}
        />

        <FormControl fullWidth margin="dense" required error={!formData.category}>
          <InputLabel>Category</InputLabel>
          <Select
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
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
          {!formData.category && <FormHelperText>Category is required</FormHelperText>}
        </FormControl>

        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2">Tags (Optional)</Typography>
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
          <Typography variant="subtitle2">Rules (Optional)</Typography>
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
              checked={formData.isPrivate}
              onChange={(e) => setFormData(prev => ({ ...prev, isPrivate: e.target.checked }))}
            />
          }
          label="Private Room"
        />

        {formData.isPrivate && (
          <TextField
            margin="dense"
            label="Password"
            type="password"
            fullWidth
            value={formData.password}
            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
            required
            error={!formData.password.trim()}
            helperText={!formData.password.trim() ? "Password is required for private rooms" : ""}
          />
        )}

        {/* File Input for Thumbnail */}
        <Box sx={{ mt: 2, mb: 1 }}>
          <Button
            variant="outlined"
            component="label"
            fullWidth
          >
            Upload Thumbnail (Optional)
            <input
              type="file"
              hidden
              accept="image/*" // Accept only images
              onChange={handleFileChange}
            />
          </Button>
          {thumbnailFile && (
            <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
              Selected: {thumbnailFile.name}
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create Room'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateSideRoom; 