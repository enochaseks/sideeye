import React, { useState } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';

const APP_ID = 'eb21ad9cb5574991af1e8ba5dc712fb8'; // <-- Replace with your Agora App ID
const TOKEN = null; // Use null for testing, or your token if you have one
const CHANNEL = 'test-room'; // You can change this to any string

export default function AgoraAudioDemo() {
  const [joined, setJoined] = useState(false);
  const [client] = useState(() => AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }));
  const [localAudioTrack, setLocalAudioTrack] = useState(null);

  const join = async () => {
    await client.join(APP_ID, CHANNEL, TOKEN, null);
    const track = await AgoraRTC.createMicrophoneAudioTrack();
    await client.publish([track]);
    setLocalAudioTrack(track);
    setJoined(true);
  };

  const leave = async () => {
    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack.close();
    }
    await client.leave();
    setJoined(false);
  };

  return (
    <div>
      <h2>Agora Audio Demo</h2>
      {joined ? (
        <button onClick={leave}>Leave Channel</button>
      ) : (
        <button onClick={join}>Join Channel</button>
      )}
    </div>
  );
} 