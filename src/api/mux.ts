const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const createLiveStream = async () => {
  try {
    const response = await fetch(`${API_URL}/api/create-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to create stream');
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating live stream:', error);
    throw error;
  }
};

export const deleteLiveStream = async (streamId: string) => {
  try {
    const response = await fetch(`${API_URL}/api/streams/${streamId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Failed to delete stream');
    }
  } catch (error) {
    console.error('Error deleting live stream:', error);
    throw error;
  }
}; 