import { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

interface UsePresenceReturn {
  isUserOnline: (userId: string) => boolean;
  onlineUsers: Set<string>;
}

export const usePresence = (): UsePresenceReturn => {
  const { currentUser } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUser?.uid) return;

    // Update current user's last seen timestamp every 30 seconds
    const updatePresence = async () => {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          lastSeen: serverTimestamp(),
          isOnline: true
        });
      } catch (error) {
        console.error('Error updating presence:', error);
      }
    };

    // Update presence immediately
    updatePresence();

    // Set up interval to update presence every 30 seconds
    const presenceInterval = setInterval(updatePresence, 30000);

    // Set user offline when they leave
    const handleBeforeUnload = async () => {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          isOnline: false,
          lastSeen: serverTimestamp()
        });
      } catch (error) {
        console.error('Error setting offline status:', error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Listen to users collection to track online status
    const usersRef = collection(db, 'users');
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const newOnlineUsers = new Set<string>();
      const now = new Date();
      
      snapshot.docs.forEach(doc => {
        const userData = doc.data();
        const userId = doc.id;
        
        // Consider user online if:
        // 1. isOnline is true, OR
        // 2. lastSeen is within the last 2 minutes
        if (userData.isOnline) {
          newOnlineUsers.add(userId);
        } else if (userData.lastSeen) {
          const lastSeen = userData.lastSeen.toDate ? userData.lastSeen.toDate() : new Date(userData.lastSeen);
          const timeDiff = now.getTime() - lastSeen.getTime();
          const minutesDiff = timeDiff / (1000 * 60);
          
          if (minutesDiff < 2) { // Consider online if active within last 2 minutes
            newOnlineUsers.add(userId);
          }
        }
      });
      
      setOnlineUsers(newOnlineUsers);
    });

    return () => {
      clearInterval(presenceInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      unsubscribe();
      
      // Set offline status on cleanup
      handleBeforeUnload();
    };
  }, [currentUser?.uid]);

  const isUserOnline = (userId: string): boolean => {
    return onlineUsers.has(userId);
  };

  return { isUserOnline, onlineUsers };
}; 