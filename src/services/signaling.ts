import { rtdb } from './firebase';
import { ref, set, onValue, off } from 'firebase/database';

interface SignalingData {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
  senderId: string;
}

export const createSignalingChannel = (roomId: string) => {
  const channelRef = ref(rtdb, `signaling/${roomId}`);

  const sendOffer = async (offer: RTCSessionDescriptionInit, senderId: string) => {
    await set(ref(rtdb, `signaling/${roomId}/offer`), {
      type: 'offer',
      data: offer,
      senderId
    });
  };

  const sendAnswer = async (answer: RTCSessionDescriptionInit, senderId: string) => {
    await set(ref(rtdb, `signaling/${roomId}/answer`), {
      type: 'answer',
      data: answer,
      senderId
    });
  };

  const sendIceCandidate = async (candidate: RTCIceCandidate, senderId: string) => {
    await set(ref(rtdb, `signaling/${roomId}/ice-candidate`), {
      type: 'ice-candidate',
      data: candidate,
      senderId
    });
  };

  const listenForOffer = (callback: (data: SignalingData) => void) => {
    const offerRef = ref(rtdb, `signaling/${roomId}/offer`);
    return onValue(offerRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val());
      }
    });
  };

  const listenForAnswer = (callback: (data: SignalingData) => void) => {
    const answerRef = ref(rtdb, `signaling/${roomId}/answer`);
    return onValue(answerRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val());
      }
    });
  };

  const listenForIceCandidate = (callback: (data: SignalingData) => void) => {
    const iceRef = ref(rtdb, `signaling/${roomId}/ice-candidate`);
    return onValue(iceRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val());
      }
    });
  };

  const cleanup = () => {
    off(ref(rtdb, `signaling/${roomId}`));
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