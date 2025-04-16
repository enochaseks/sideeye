import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Typography,
  Box,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon
} from '@mui/icons-material';
import { doc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, Firestore } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { SideRoom, RoomMember } from '../types/index';

interface RoomMemberManagementProps {
  open: boolean;
  onClose: () => void;
  room: SideRoom;
  onUpdate: (members: RoomMember[]) => void;
}

const RoomMemberManagement: React.FC<RoomMemberManagementProps> = ({
  open,
  onClose,
  room,
  onUpdate
}) => {
  const { currentUser } = useAuth();
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedMember, setSelectedMember] = useState<RoomMember | null>(null);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const membersQuery = query(
        collection(db as Firestore, 'rooms', room.id, 'members')
      );
      const querySnapshot = await getDocs(membersQuery);
      const membersList = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          userId: doc.id,
          username: data.username || '',
          avatar: data.avatar || '',
          role: data.role || 'member',
          joinedAt: data.joinedAt?.toDate() || new Date()
        } as RoomMember;
      });

      setMembers(membersList);
    } catch (error) {
      console.error('Error fetching members:', error);
      setError('Failed to fetch members');
    } finally {
      setLoading(false);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, member: RoomMember) => {
    setAnchorEl(event.currentTarget);
    setSelectedMember(member);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedMember(null);
  };

  const handleRoleChange = async (newRole: 'admin' | 'moderator' | 'member') => {
    if (!currentUser || !selectedMember || loading) return;

    try {
      setLoading(true);
      setError(null);

      const roomRef = doc(db as Firestore, 'rooms', room.id);
      const updatedMembers = members.map(member => {
        if (member.userId === selectedMember.userId) {
          return { ...member, role: newRole };
        }
        return member;
      });

      await updateDoc(roomRef, {
        members: updatedMembers
      });

      setMembers(updatedMembers);
      onUpdate(updatedMembers);
      handleMenuClose();
    } catch (error) {
      console.error('Error updating member role:', error);
      setError('Failed to update member role');
    } finally {
      setLoading(false);
    }
  };

  const handleKickMember = async () => {
    if (!currentUser || !selectedMember || loading) return;

    try {
      setLoading(true);
      setError(null);

      const roomRef = doc(db as Firestore, 'rooms', room.id);
      const updatedMembers = members.filter(
        member => member.userId !== selectedMember.userId
      );

      await updateDoc(roomRef, {
        members: updatedMembers,
        memberCount: updatedMembers.length
      });

      setMembers(updatedMembers);
      onUpdate(updatedMembers);
      handleMenuClose();
    } catch (error) {
      console.error('Error kicking member:', error);
      setError('Failed to kick member');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLive = async (member: RoomMember) => {
    if (!db || !currentUser) return;

    try {
      setLoading(true);
      setError(null);

      const roomRef = doc(db as Firestore, 'rooms', room.id);
      const isLive = room.liveParticipants.includes(member.userId);

      await updateDoc(roomRef, {
        liveParticipants: isLive
          ? arrayRemove(member.userId)
          : arrayUnion(member.userId)
      });

      onUpdate(members);
    } catch (error) {
      console.error('Error toggling live status:', error);
      setError('Failed to toggle live status');
    } finally {
      setLoading(false);
    }
  };

  const canManageMember = (member: RoomMember) => {
    if (!currentUser) return false;
    const currentUserRole = members.find(m => m.userId === currentUser.uid)?.role;
    const targetRole = member.role;

    if (currentUserRole === 'owner') return true;
    if (currentUserRole === 'admin' && targetRole !== 'owner' && targetRole !== 'admin') return true;
    if (currentUserRole === 'moderator' && targetRole === 'member') return true;
    return false;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Room Members</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        <List>
          {members.map((member) => (
            <ListItem key={member.userId}>
              <Avatar src={member.avatar} sx={{ mr: 2 }}>
                {member.username.charAt(0)}
              </Avatar>
              <ListItemText
                primary={member.username}
                secondary={`Role: ${member.role}`}
              />
              <ListItemSecondaryAction>
                <IconButton
                  onClick={() => handleToggleLive(member)}
                  disabled={loading}
                >
                  {room.liveParticipants.includes(member.userId) ? (
                    <MicIcon color="primary" />
                  ) : (
                    <MicOffIcon />
                  )}
                </IconButton>
                {canManageMember(member) && (
                  <IconButton
                    onClick={(e) => handleMenuOpen(e, member)}
                    disabled={loading}
                  >
                    <MoreVertIcon />
                  </IconButton>
                )}
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          {selectedMember?.role !== 'admin' && (
            <MenuItem onClick={() => handleRoleChange('admin')}>
              Make Admin
            </MenuItem>
          )}
          {selectedMember?.role !== 'moderator' && (
            <MenuItem onClick={() => handleRoleChange('moderator')}>
              Make Moderator
            </MenuItem>
          )}
          {selectedMember?.role !== 'member' && (
            <MenuItem onClick={() => handleRoleChange('member')}>
              Make Member
            </MenuItem>
          )}
          <MenuItem onClick={handleKickMember} sx={{ color: 'error.main' }}>
            Kick Member
          </MenuItem>
        </Menu>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default RoomMemberManagement; 