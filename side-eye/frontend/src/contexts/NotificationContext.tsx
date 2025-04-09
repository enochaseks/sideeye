import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy, Timestamp, Firestore } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { getDb } from '../services/firebase';

export interface Notification {
  id: string;
  type: 'follow' | 'like' | 'comment' | 'tag' | 'mention' | 'room_invite';
  senderId: string;
  senderName: string;
  senderAvatar: string;
  recipientId: string;
  read: boolean;
  timestamp: Timestamp;
  content: string;
  link: string;
  relatedId?: string; // ID of related post, comment, room, etc.
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
  const [db, setDb] = useState<Firestore | null>(null);

  // Initialize Firestore
  useEffect(() => {
    const initializeDb = async () => {
      try {
        const firestore = await getDb();
        setDb(firestore);
      } catch (err) {
        console.error('Error initializing Firestore:', err);
      }
    };

    initializeDb();
  }, []);

  // Set up notifications listener
  useEffect(() => {
    if (!currentUser || !db) return;

    let unsubscribe: (() => void) | undefined;

    try {
      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef,
        where('recipientId', '==', currentUser.uid),
        orderBy('timestamp', 'desc')
      );

      unsubscribe = onSnapshot(q, 
        (snapshot) => {
          const newNotifications: Notification[] = [];
          let newUnreadCount = 0;

          snapshot.forEach((doc) => {
            const notification = { id: doc.id, ...doc.data() } as Notification;
            newNotifications.push(notification);
            if (!notification.read) {
              newUnreadCount++;
            }
          });

          setNotifications(newNotifications);
          setUnreadCount(newUnreadCount);
        },
        (error) => {
          console.error('Error in notifications listener:', error);
        }
      );
    } catch (error) {
      console.error('Error setting up notifications listener:', error);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser, db]);

  const markAsRead = async (notificationId: string) => {
    if (!db || !currentUser) return;

    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, { read: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!db || !currentUser) return;

    try {
      const promises = notifications
        .filter(n => !n.read)
        .map(n => updateDoc(doc(db, 'notifications', n.id), { read: true }));

      await Promise.all(promises);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!db || !currentUser) return;

    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, { deleted: true });
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