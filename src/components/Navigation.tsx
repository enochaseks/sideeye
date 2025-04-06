import React from 'react';
import { Link } from 'react-router-dom';
import { ListItem, ListItemIcon, ListItemText } from '@mui/material';
import { AccountCircle, Delete } from '@mui/icons-material';
import { 
  Home as HomeIcon,
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  Mail as MailIcon,
  Person as PersonIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { Button } from '@mui/material';

const Navigation: React.FC = () => {
  return (
    <div>
      <Button 
        component={Link} 
        to="/profile" 
        startIcon={<PersonIcon />}
        sx={{ 
          color: 'text.primary',
          '&:hover': { backgroundColor: 'action.hover' }
        }}
      >
        Profile
      </Button>
      <Button 
        component={Link} 
        to="/profile?tab=trash" 
        startIcon={<DeleteIcon />}
        sx={{ 
          color: 'text.primary',
          '&:hover': { backgroundColor: 'action.hover' }
        }}
      >
        Trash
      </Button>
    </div>
  );
};

export default Navigation; 