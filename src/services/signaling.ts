import { rtdb } from './firebase';
import { ref, set, onValue, off, push, child, remove } from 'firebase/database';

interface SignalingData {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
  senderId: string;
  recipientId: string;
  timestamp: number;
}

export const createSignalingChannel = (roomId: string) => {
  const channelRef = ref(rtdb, `signaling/${roomId}`);

  const sendOffer = async (offer: RTCSessionDescriptionInit, recipientId: string, senderId: string) => {
    console.log('[Signaling] Sending offer:', { recipientId, senderId });
    const signalRef = push(child(channelRef, 'offers'));
    await set(signalRef, {
      type: 'offer',
      data: offer,
      senderId,
      recipientId,
      timestamp: Date.now()
    });
    // Clean up old offers after 30 seconds
    setTimeout(() => remove(signalRef), 30000);
  };

  const sendAnswer = async (answer: RTCSessionDescriptionInit, recipientId: string, senderId: string) => {
    console.log('[Signaling] Sending answer:', { recipientId, senderId });
    const signalRef = push(child(channelRef, 'answers'));
    await set(signalRef, {
      type: 'answer',
      data: answer,
      senderId,
      recipientId,
      timestamp: Date.now()
    });
    // Clean up old answers after 30 seconds
    setTimeout(() => remove(signalRef), 30000);
  };

  const sendIceCandidate = async (candidate: RTCIceCandidate, recipientId: string, senderId: string) => {
    console.log('[Signaling] Sending ICE candidate:', { recipientId, senderId });
    const signalRef = push(child(channelRef, 'ice-candidates'));
    await set(signalRef, {
      type: 'ice-candidate',
      data: candidate,
      senderId,
      recipientId,
      timestamp: Date.now()
    });
    // Clean up old candidates after 30 seconds
    setTimeout(() => remove(signalRef), 30000);
  };

  const listenForOffer = (callback: (data: SignalingData) => void) => {
    const offerRef = child(channelRef, 'offers');
    onValue(offerRef, (snapshot) => {
      if (snapshot.exists()) {
        const offers = snapshot.val();
        Object.entries(offers).forEach(([key, value]) => {
          const offer = value as SignalingData;
          console.log('[Signaling] Received offer:', {
            from: offer.senderId,
            to: offer.recipientId,
            age: Date.now() - offer.timestamp
          });
          // Only process offers less than 30 seconds old
          if (Date.now() - offer.timestamp < 30000) {
            callback(offer);
          } else {
            // Clean up old offer
            remove(child(offerRef, key));
          }
        });
      }
    });
    return () => off(offerRef);
  };

  const listenForAnswer = (callback: (data: SignalingData) => void) => {
    const answerRef = child(channelRef, 'answers');
    onValue(answerRef, (snapshot) => {
      if (snapshot.exists()) {
        const answers = snapshot.val();
        Object.entries(answers).forEach(([key, value]) => {
          const answer = value as SignalingData;
          console.log('[Signaling] Received answer:', {
            from: answer.senderId,
            to: answer.recipientId,
            age: Date.now() - answer.timestamp
          });
          // Only process answers less than 30 seconds old
          if (Date.now() - answer.timestamp < 30000) {
            callback(answer);
          } else {
            // Clean up old answer
            remove(child(answerRef, key));
          }
        });
      }
    });
    return () => off(answerRef);
  };

  const listenForIceCandidate = (callback: (data: SignalingData) => void) => {
    const iceRef = child(channelRef, 'ice-candidates');
    onValue(iceRef, (snapshot) => {
      if (snapshot.exists()) {
        const candidates = snapshot.val();
        Object.entries(candidates).forEach(([key, value]) => {
          const candidate = value as SignalingData;
          console.log('[Signaling] Received ICE candidate:', {
            from: candidate.senderId,
            to: candidate.recipientId,
            age: Date.now() - candidate.timestamp
          });
          // Only process candidates less than 30 seconds old
          if (Date.now() - candidate.timestamp < 30000) {
            callback(candidate);
          } else {
            // Clean up old candidate
            remove(child(iceRef, key));
          }
        });
      }
    });
    return () => off(iceRef);
  };

  const cleanup = () => {
    console.log('[Signaling] Cleaning up signaling channel');
    off(channelRef);
  };

  return {
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    listenForOffer,
    listenForAnswer,
    listenForIceCandidate,
    cleanup
  };
}; 