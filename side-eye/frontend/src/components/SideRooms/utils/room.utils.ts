import { Timestamp } from 'firebase/firestore';
import { SideRoom, RoomMember, Message, PresenceData } from '../types/room.types';

export const isRoomOwner = (room: SideRoom, userId: string): boolean => {
  return room.ownerId === userId;
};

export const isRoomMember = (room: SideRoom, userId: string): boolean => {
  return room.members.some(member => member.userId === userId);
};

export const isRoomViewer = (room: SideRoom, userId: string): boolean => {
  return room.viewers.some(viewer => viewer.userId === userId);
};

export const hasRoomAccess = (room: SideRoom, userId: string): boolean => {
  return isRoomOwner(room, userId) || isRoomMember(room, userId) || isRoomViewer(room, userId);
};

export const canSendMessages = (room: SideRoom, userId: string): boolean => {
  return isRoomOwner(room, userId) || isRoomMember(room, userId);
};

export const canManageRoom = (room: SideRoom, userId: string): boolean => {
  return isRoomOwner(room, userId);
};

export const formatTimestamp = (timestamp: Timestamp): string => {
  const date = timestamp.toDate();
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const formatDate = (timestamp: Timestamp): string => {
  const date = timestamp.toDate();
  return date.toLocaleDateString();
};

export const getMemberRole = (room: SideRoom, userId: string): 'owner' | 'member' | 'viewer' | null => {
  if (isRoomOwner(room, userId)) return 'owner';
  if (isRoomMember(room, userId)) return 'member';
  if (isRoomViewer(room, userId)) return 'viewer';
  return null;
};

export const getOnlineUsers = (presenceData: PresenceData[]): PresenceData[] => {
  return presenceData.filter(user => user.isOnline);
};

export const sortMessagesByTimestamp = (messages: Message[]): Message[] => {
  return [...messages].sort((a, b) => 
    a.timestamp.toMillis() - b.timestamp.toMillis()
  );
};

export const sortMembersByRole = (members: RoomMember[]): RoomMember[] => {
  return [...members].sort((a, b) => {
    const roleOrder = { owner: 0, member: 1, viewer: 2 };
    return roleOrder[a.role] - roleOrder[b.role];
  });
};

export const validateRoomName = (name: string): string | null => {
  if (!name.trim()) return 'Room name is required';
  if (name.length < 3) return 'Room name must be at least 3 characters';
  if (name.length > 50) return 'Room name must be less than 50 characters';
  return null;
};

export const validateRoomPassword = (password: string): string | null => {
  if (!password) return null;
  if (password.length < 4) return 'Password must be at least 4 characters';
  if (password.length > 20) return 'Password must be less than 20 characters';
  return null;
}; 