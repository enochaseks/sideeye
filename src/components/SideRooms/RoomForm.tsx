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
import { SideRoom } from '../../types';

interface RoomFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<SideRoom>) => void;
  initialData?: Partial<SideRoom>;
  title?: string;
  submitButtonText?: string;
}

const RoomForm: React.FC<RoomFormProps> = ({
  open,
  onClose,
  onSubmit,
  initialData,
  title = 'Create Room',
  submitButtonText = 'Create'
}) => {
  const [formData, setFormData] = useState<Partial<SideRoom>>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    isPrivate: initialData?.isPrivate || false,
    password: initialData?.password || '',
    tags: initialData?.tags || []
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              multiline
              rows={3}
              fullWidth
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
                label="Password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                required={formData.isPrivate}
                fullWidth
              />
            )}
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" color="primary">
            {submitButtonText}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default RoomForm; 