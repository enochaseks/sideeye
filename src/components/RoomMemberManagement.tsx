import React, { useState } from 'react';
import {
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Box
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  PersonRemove as PersonRemoveIcon
} from '@mui/icons-material';
import { doc, updateDoc, Firestore } from 'firebase/firestore';
import { db } from '../services/firebase';
import { RoomMember, SideRoom } from '../types';
import { toast } from 'react-hot-toast';

interface RoomMemberManagementProps {
  members: RoomMember[];
  room: SideRoom;
  currentUserRole?: 'owner' | 'viewer' | 'guest';
  onUpdate: (updatedMembers: RoomMember[]) => void;
}

const RoomMemberManagement: React.FC<RoomMemberManagementProps> = ({
  members,
  room,
  currentUserRole,
  onUpdate
}) => {
  const [selectedMember, setSelectedMember] = useState<RoomMember | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [loading, setLoading] = useState(false);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, member: RoomMember) => {
    setAnchorEl(event.currentTarget);
    setSelectedMember(member);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedMember(null);
  };

  const handleRemoveMember = async (member: RoomMember) => {
    if (!room || loading) return;
    
    try {
      setLoading(true);
      
      // Update the members list
      const updatedMembers = members.filter(m => m.userId !== member.userId);
      
      // Update in Firestore
      const roomRef = doc(db as Firestore, 'sideRooms', room.id);
      await updateDoc(roomRef, {
        viewers: updatedMembers
      });
      
      onUpdate(updatedMembers);
      toast.success('Member removed successfully');
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    } finally {
      setLoading(false);
      handleMenuClose();
    }
  };

  const handleToggleMute = async (member: RoomMember) => {
    if (!room || loading) return;
    
    try {
      setLoading(true);
      
      const presenceRef = doc(db as Firestore, 'sideRooms', room.id, 'presence', member.userId);
      await updateDoc(presenceRef, {
        isMuted: !member.isMuted
      });
      
      toast.success(`User ${member.isMuted ? 'unmuted' : 'muted'} successfully`);
    } catch (error) {
      console.error('Error toggling mute:', error);
      toast.error('Failed to toggle mute status');
    } finally {
      setLoading(false);
    }
  };

  const canManageMember = (targetRole: 'owner' | 'viewer' | 'guest'): boolean => {
    if (!currentUserRole) return false;
    // Owners can manage viewers and guests.
    // Owners cannot manage themselves or other potential owners via this UI (usually only one owner).
    if (currentUserRole === 'owner') {
      return targetRole === 'viewer' || targetRole === 'guest';
    }
    // Viewers and Guests cannot manage anyone.
    return false;
  };

  return (
    <List>
      {members.map((member) => (
        <ListItem
          key={member.userId}
          secondaryAction={
            canManageMember(member.role) && (
              <>
                <IconButton
                  edge="end"
                  aria-label="toggle mute"
                  onClick={() => handleToggleMute(member)}
                  disabled={loading}
                >
                  {member.isMuted ? <MicOffIcon /> : <MicIcon color="primary" />}
                </IconButton>
                <IconButton
                  edge="end"
                  aria-label="more"
                  onClick={(e) => handleMenuClick(e, member)}
                  disabled={loading || member.role === 'owner'}
                >
                  <MoreVertIcon />
                </IconButton>
              </>
            )
          }
        >
          <ListItemAvatar>
            <Avatar src={member.avatar} alt={member.username}>
              {member.username[0]}
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography>{member.username}</Typography>
                {member.role === 'owner' && (
                  <Typography variant="caption" color="primary">
                    (Owner)
                  </Typography>
                )}
              </Box>
            }
          />
        </ListItem>
      ))}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {selectedMember && selectedMember.role !== 'owner' && (
          <MenuItem 
            onClick={() => selectedMember && handleRemoveMember(selectedMember)}
            disabled={loading}
          >
            <PersonRemoveIcon sx={{ mr: 1 }} />
            Remove from Room
          </MenuItem>
        )}
      </Menu>
    </List>
  );
};

export default RoomMemberManagement; 