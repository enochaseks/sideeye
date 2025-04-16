const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const fetchWithCORS = async (url: string, options: RequestInit = {}) => {
  const defaultOptions: RequestInit = {
    mode: 'cors',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  };

  // Merge default options with provided options
  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  };

  console.log('Fetching URL:', url);
  console.log('With options:', finalOptions);

  try {
    const response = await fetch(url, finalOptions);
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('Error response:', errorData);
      throw new Error(errorData?.error || `HTTP error! status: ${response.status}`);
    }

    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};

export const createLiveStream = async (roomId: string, userId: string) => {
  try {
    console.log('Creating live stream for room:', roomId, 'user:', userId);
    
    const response = await fetchWithCORS(`${API_URL}/api/create-stream`, {
      method: 'POST',
      body: JSON.stringify({ roomId, userId })
    });

    const data = await response.json();
    console.log('Stream created successfully:', data);
    return data;
  } catch (error) {
    console.error('Error creating live stream:', error);
    throw error;
  }
};

export const deleteLiveStream = async (streamId: string) => {
  try {
    console.log('Deleting stream:', streamId);
    
    const response = await fetchWithCORS(`${API_URL}/api/delete-stream`, {
      method: 'POST',
      body: JSON.stringify({ streamId })
    });

    console.log('Stream deleted successfully');
    return response.json();
  } catch (error) {
    console.error('Error deleting live stream:', error);
    throw error;
  }
};

// Test CORS configuration
export const testCORS = async () => {
  try {
    const response = await fetchWithCORS(`${API_URL}/api/test`);
    return response.json();
  } catch (error) {
    console.error('CORS test failed:', error);
    throw error;
  }
}; 