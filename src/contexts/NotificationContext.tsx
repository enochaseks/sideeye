import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc, addDoc, serverTimestamp, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext';

// Define the structure of a notification
export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'tag' | 'room_invite' | 'room_created' | 'room_announcement' | 'room_poll' | 'user_went_live' | 'live_stream' | 'message' | string; // Allow custom types
  senderId: string;
  senderName?: string; // Optional: Store sender's name directly
  senderAvatar?: string; // Optional: Store sender's avatar URL directly
  recipientId: string;
  content: string; // e.g., "User X liked your post", "User Y commented: ..."
  postId?: string; // Link to the relevant post/vibit
  commentId?: string; // Link to the relevant comment
  roomId?: string; // Link to the relevant side-room
  roomName?: string; // Name of the room (for room notifications)
  isRead: boolean;
  createdAt: Date; // Use Firestore Timestamp, convert on fetch
}

// Define the context type
interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: (userId: string) => Promise<(() => void) | undefined>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => Promise<void>;
}

// Create the context
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Create the provider component
export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true); // Internal loading state
  const [initialLoadComplete, setInitialLoadComplete] = useState<boolean>(false);


  const fetchNotifications = useCallback(async (userId: string) => {
    if (!userId) return;
    setLoading(true);

    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('recipientId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50) // Limit the number of notifications fetched initially
    );

    // Use onSnapshot for real-time updates
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotifications = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(), // Convert Timestamp to Date
        } as Notification;
      });

      setNotifications(fetchedNotifications);

      // Calculate unread count after fetching/updating
      const unread = fetchedNotifications.filter(n => !n.isRead).length;
      setUnreadCount(unread);

      if (!initialLoadComplete) {
          setInitialLoadComplete(true);
      }
      setLoading(false);

    }, (error) => {
      console.error("Error fetching notifications: ", error);
      setLoading(false); // Stop loading even if there's an error
    });

    // Return the unsubscribe function to be called on cleanup
    return unsubscribe;
  }, [initialLoadComplete]); // Add initialLoadComplete dependency

  // Effect to fetch notifications when user logs in or fetch function changes
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (currentUser?.uid) {
       // Directly call fetchNotifications and store the unsubscribe function
       const promise = fetchNotifications(currentUser.uid);
       promise.then(unsub => {
           if (unsub) {
               unsubscribe = unsub;
           }
       }).catch(err => {
           console.error("Failed to setup notification listener:", err);
       });
    } else {
      // Clear notifications and reset state if user logs out
      setNotifications([]);
      setUnreadCount(0);
      setLoading(true);
      setInitialLoadComplete(false);
    }

    // Cleanup function to unsubscribe when component unmounts or user changes
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser, fetchNotifications]); // Depend on currentUser and fetchNotifications

  // Function to mark a single notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, { isRead: true });
      // No need to manually update state here, onSnapshot will handle it
    } catch (error) {
      console.error("Error marking notification as read: ", error);
    }
  };

  // Function to mark all notifications as read for a user
  const markAllAsRead = async (userId: string) => {
     if (!userId) return;
     setLoading(true); // Indicate loading state
     try {
       const notificationsRef = collection(db, 'notifications');
       const q = query(notificationsRef, where('recipientId', '==', userId), where('isRead', '==', false));
       const snapshot = await getDocs(q);
       // Use batch updates for efficiency if supported/needed, or loop
       const updates = snapshot.docs.map(docSnapshot => updateDoc(doc(db, 'notifications', docSnapshot.id), { isRead: true }));
       await Promise.all(updates);
       // State update will be handled by onSnapshot
     } catch (error) {
       console.error("Error marking all notifications as read: ", error);
     } finally {
         // setLoading(false); // Let onSnapshot handle final loading state
     }
   };


  // Function to delete a notification
  const deleteNotification = async (notificationId: string) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await deleteDoc(notificationRef);
      // State update will be handled by onSnapshot
    } catch (error) {
      console.error("Error deleting notification: ", error);
    }
  };

  // Function to add a new notification
  const addNotification = async (notificationData: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => {
     try {
       console.log("Creating notification with data:", notificationData);
       const notificationRef = await addDoc(collection(db, 'notifications'), {
         ...notificationData,
         isRead: false,
         createdAt: serverTimestamp(), // Use server timestamp
       });
       console.log("Successfully created notification with ID:", notificationRef.id);
       // Optionally trigger a re-fetch or rely on onSnapshot if listening
     } catch (error) {
       console.error("Error adding notification:", error);
       throw error; // Re-throw to allow handling in the calling component
     }
   };

  // The value provided by the context
  const value = {
    notifications,
    unreadCount,
    loading, // <-- Include loading state in the provided value
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    addNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// Custom hook to use the notification context
export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}; 