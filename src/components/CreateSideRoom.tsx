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
  Drawer,
  useMediaQuery,
  useTheme,
  AppBar,
  Toolbar,
  Container,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Close as CloseIcon } from '@mui/icons-material';
import { collection, addDoc, serverTimestamp, Firestore, Timestamp, getDoc, doc, updateDoc, arrayUnion, setDoc, deleteDoc } from 'firebase/firestore';
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
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

      // Fetch the creator's UserProfile from Firestore
      const userProfileRef = doc(db, 'users', currentUser.uid);
      const userProfileSnap = await getDoc(userProfileRef);

      let creatorDisplayName = 'Anonymous';
      let creatorUsername = 'anonymous_user';
      let creatorAvatar = '';

      if (userProfileSnap.exists()) {
        const userProfileData = userProfileSnap.data();
        // Assuming UserProfile has 'name' for displayName, 'username', and 'profilePic'
        creatorDisplayName = userProfileData.name || userProfileData.username || currentUser.displayName || 'Anonymous';
        creatorUsername = userProfileData.username || currentUser.displayName?.split(' ')[0].toLowerCase() || 'anonymous_user';
        creatorAvatar = userProfileData.profilePic || currentUser.photoURL || '';
      } else {
        // Fallback to Auth info if Firestore profile doesn't exist for some reason
        creatorDisplayName = currentUser.displayName || 'Anonymous';
        creatorUsername = currentUser.displayName?.split(' ')[0].toLowerCase() || 'anonymous_user';
        creatorAvatar = currentUser.photoURL || '';
        console.warn(`UserProfile not found for UID: ${currentUser.uid}. Using Auth display name.`);
      }

      const roomData = {
        name: formData.name,
        description: formData.description,
        ownerId: currentUser.uid,
        viewers: [],
        memberCount: 0,
        createdAt: serverTimestamp(),
        isPrivate: formData.isPrivate,
        password: formData.isPrivate ? formData.password : '',
        category: formData.category,
        tags: Array.from(new Set([...tags, formData.category])),
        lastActive: serverTimestamp(),
        isLive: false,
        activeUsers: 0,
        deleted: false,
        heartCount: 0
      };

      const roomRef = await addDoc(collection(db, 'sideRooms'), roomData);

      const ownerViewerObject = {
        userId: currentUser.uid,
        displayName: creatorDisplayName,
        username: creatorUsername,
        avatar: creatorAvatar,
        role: 'owner',
        joinedAt: Timestamp.now()
      } as RoomMember;

      await updateDoc(roomRef, {
        viewers: arrayUnion(ownerViewerObject),
        memberCount: 1
      });

      await setDoc(doc(db, 'users', currentUser.uid, 'sideRooms', roomRef.id), {
        roomId: roomRef.id,
        name: formData.name,
        role: 'owner',
        joinedAt: Timestamp.now(),
        lastActive: serverTimestamp()
      });

      if (thumbnailFile) {
        toast.loading('Uploading thumbnail...', { id: 'thumbnail-upload' });
        try {
          const storageRef = ref(storage, `sideRoomThumbnails/${roomRef.id}/${thumbnailFile.name}`);
          const snapshot = await uploadBytes(storageRef, thumbnailFile);
          const thumbnailUrl = await getDownloadURL(snapshot.ref);
          await updateDoc(roomRef, { thumbnailUrl: thumbnailUrl });
          toast.dismiss('thumbnail-upload');
          toast.success('Thumbnail uploaded!');
        } catch (uploadError) {
          console.error("Error uploading thumbnail:", uploadError);
          toast.dismiss('thumbnail-upload');
          toast.error("Failed to upload thumbnail, but room created.");
        }
      }

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

  // Form content to be used in both Dialog and Drawer
  const formContent = (
    <>
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
          <MenuItem value="Just Chatting">Just Chatting</MenuItem>
          <MenuItem value="Music">Music</MenuItem>
          <MenuItem value="Gossip">Gossip</MenuItem>
          <MenuItem value="Podcasts">Podcasts</MenuItem>
          <MenuItem value="Shows">Shows</MenuItem>
          <MenuItem value="Social">Social</MenuItem>
          <MenuItem value="ASMR">ASMR</MenuItem>
          <MenuItem value="Other">Other</MenuItem>
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
            accept="image/*"
            onChange={handleFileChange}
          />
        </Button>
        {thumbnailFile && (
          <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
            Selected: {thumbnailFile.name}
          </Typography>
        )}
      </Box>
    </>
  );

  // Use Drawer for mobile, Dialog for desktop
  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            maxHeight: '90vh',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            px: 2,
            pb: 2
          }
        }}
      >
        <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>Create Room</Typography>
            <IconButton edge="end" color="inherit" onClick={onClose} aria-label="close">
              <CloseIcon />
            </IconButton>
          </Toolbar>
        </AppBar>
        
        <Box sx={{ p: 2, pt: 0 }}>
          {formContent}
          
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={onClose} variant="outlined">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Room'}
            </Button>
          </Box>
        </Box>
      </Drawer>
    );
  }

  // Desktop dialog
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Side Room</DialogTitle>
      <DialogContent>
        {formContent}
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