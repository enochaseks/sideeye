import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy, Timestamp, Firestore, limit, deleteDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { db } from '../services/firebase';

export interface Notification {
  id: string;
  type: 'follow' | 'like' | 'comment' | 'tag' | 'mention' | 'room_invite';
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  recipientId: string;
  postId?: string;
  commentId?: string;
  roomId?: string;
  content?: string;
  createdAt: Date;
  isRead: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser && db) {
      setLoading(true);
      const notificationsRef = collection(db, 'users', currentUser.uid, 'notifications');
      const q = query(notificationsRef, orderBy('createdAt', 'desc'), limit(50));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedNotifications = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: (data.createdAt as Timestamp).toDate(),
            type: data.type as Notification['type'],
            senderId: data.senderId as string,
            recipientId: data.recipientId as string,
            isRead: data.isRead as boolean,
            senderName: data.senderName as string | undefined,
            senderAvatar: data.senderAvatar as string | undefined,
            postId: data.postId as string | undefined,
            commentId: data.commentId as string | undefined,
            roomId: data.roomId as string | undefined,
            content: data.content as string | undefined,
          } as Notification;
        });
        setNotifications(fetchedNotifications);
        setUnreadCount(fetchedNotifications.filter(n => !n.isRead).length);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching notifications: ", error);
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
    }
  }, [currentUser]);

  const markAsRead = async (notificationId: string) => {
    if (!db || !currentUser) return;

    try {
      const notificationRef = doc(db, 'users', currentUser.uid, 'notifications', notificationId);
      await updateDoc(notificationRef, { isRead: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!db || !currentUser) return;

    try {
      const promises = notifications
        .filter(n => !n.isRead)
        .map(n => updateDoc(doc(db, 'users', currentUser.uid, 'notifications', n.id), { isRead: true }));

      await Promise.all(promises);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!db || !currentUser) return;

    try {
      const notificationRef = doc(db, 'users', currentUser.uid, 'notifications', notificationId);
      await deleteDoc(notificationRef);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      deleteNotification
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}; 