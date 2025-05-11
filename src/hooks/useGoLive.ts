import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useFirestore } from '../context/FirestoreContext';
import { 
  doc, 
  updateDoc, 
  serverTimestamp, 
  query, 
  collection, 
  where, 
  getDocs,
  writeBatch,
  getDoc
} from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../services/firebase';

// Hook for handling when a user goes live
export const useGoLive = (roomId: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const { currentUser } = useAuth();
  const { db } = useFirestore();
  const { addNotification } = useNotifications();
  const functions = getFunctions(app);

  // Function to notify followers when user goes live
  const notifyFollowers = useCallback(async () => {
    if (!currentUser?.uid || !db) return;
    
    try {
      // Get all followers
      const followersRef = collection(db, 'users', currentUser.uid, 'followers');
      const followersSnapshot = await getDocs(followersRef);
      
      if (followersSnapshot.empty) {
        console.log('No followers to notify');
        return;
      }
      
      // Create batch for efficiency
      const batch = writeBatch(db);
      const followers = followersSnapshot.docs.map(doc => doc.id);
      
      console.log(`Notifying ${followers.length} followers about going live`);
      
      // Get user profile for notification data
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data() || {};
      
      // For each follower, create a notification
      for (const followerId of followers) {
        // Add notification
        await addNotification({
          type: 'live_stream',
          senderId: currentUser.uid,
          senderName: userData.name || userData.username || 'Someone you follow',
          senderAvatar: userData.profilePic,
          recipientId: followerId,
          content: `${userData.name || userData.username || 'Someone you follow'} just went live! Join now to watch.`,
          roomId: roomId
        });
      }
      
      // Send email notifications using Cloud Function
      const sendEmailNotifications = httpsCallable(functions, 'sendLiveNotificationEmails');
      await sendEmailNotifications({ 
        roomId, 
        userId: currentUser.uid,
        userName: userData.name || userData.username || 'Someone you follow'
      });
      
      console.log('Successfully notified followers');
    } catch (error) {
      console.error('Error notifying followers:', error);
      toast.error('Failed to notify followers');
    }
  }, [currentUser, db, roomId, addNotification, functions]);

  // Function to go live
  const goLive = useCallback(async () => {
    if (!currentUser?.uid || !db || !roomId) {
      toast.error('Cannot go live. Please try again.');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Update room status
      const roomRef = doc(db, 'sideRooms', roomId);
      await updateDoc(roomRef, {
        isLive: true,
        lastActive: serverTimestamp(),
      });
      
      // Notify followers about going live
      await notifyFollowers();
      
      toast.success('You are now live!');
    } catch (error) {
      console.error('Error going live:', error);
      toast.error('Failed to go live');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, db, roomId, notifyFollowers]);

  // Function to end live
  const endLive = useCallback(async () => {
    if (!currentUser?.uid || !db || !roomId) {
      toast.error('Cannot end live. Please try again.');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Update room status
      const roomRef = doc(db, 'sideRooms', roomId);
      await updateDoc(roomRef, {
        isLive: false,
        lastActive: serverTimestamp(),
      });
      
      toast.success('Stream ended');
    } catch (error) {
      console.error('Error ending live:', error);
      toast.error('Failed to end live');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, db, roomId]);

  return {
    goLive,
    endLive,
    isLoading
  };
}; 