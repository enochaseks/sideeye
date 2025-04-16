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
  Box
} from '@mui/material';
import type { SideRoom } from '../../types/index';

interface RoomFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (roomData: Partial<SideRoom>) => Promise<void>;
  initialData?: Partial<SideRoom>;
  title: string;
  submitButtonText: string;
  isProcessing?: boolean;
}

const RoomForm: React.FC<RoomFormProps> = ({
  open,
  onClose,
  onSubmit,
  initialData,
  title,
  submitButtonText,
  isProcessing = false
}) => {
  const [formData, setFormData] = useState<Partial<SideRoom>>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    isPrivate: initialData?.isPrivate || false,
    password: initialData?.password || '',
    category: initialData?.category || '',
    tags: initialData?.tags || []
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              autoFocus
              required
              label="Room Name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              multiline
              rows={4}
              fullWidth
            />
            <TextField
              label="Category"
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Tags (comma separated)"
              value={formData.tags?.join(', ')}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
              }))}
              fullWidth
              helperText="Enter tags separated by commas"
            />
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
                required
                label="Password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                fullWidth
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isProcessing}>
            {submitButtonText}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default RoomForm; 