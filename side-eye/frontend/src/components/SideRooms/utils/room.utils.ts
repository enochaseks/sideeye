import { SideRoom, RoomMember, User } from '../types/room.types';

export const isRoomViewer = (room: SideRoom, user: User): boolean => {
  return room.viewers.some((member: RoomMember) => member.userId === user.id);
};

export const isRoomOwner = (room: SideRoom, user: User): boolean => {
  return room.ownerId === user.id;
};

export const hasRoomAccess = (room: SideRoom, user: User): boolean => {
  return isRoomOwner(room, user) || isRoomViewer(room, user);
}; 