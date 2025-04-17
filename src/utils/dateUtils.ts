import { formatDistanceToNow as formatDistance } from 'date-fns';

// Helper function to convert timestamp to Date
export const convertTimestampToDate = (timestamp: any): Date => {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  if (timestamp.toDate) return timestamp.toDate();
  if (typeof timestamp === 'number') return new Date(timestamp);
  if (typeof timestamp === 'string') return new Date(timestamp);
  return new Date();
};

// Helper function to format date
export const formatDate = (timestamp: any): string => {
  try {
    const date = convertTimestampToDate(timestamp);
    if (isNaN(date.getTime())) {
      console.error('Invalid date:', timestamp);
      return 'Just now';
    }
    return formatDistance(date, { addSuffix: true });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Just now';
  }
};

// Helper function to safely compare timestamps
export const compareTimestamps = (timestamp1: any, timestamp2: any): boolean => {
  try {
    const date1 = convertTimestampToDate(timestamp1);
    const date2 = convertTimestampToDate(timestamp2);
    return date1.getTime() === date2.getTime();
  } catch (error) {
    console.error('Error comparing timestamps:', error);
    return false;
  }
};

export const formatDistanceToNow = (date: Date | number): string => {
  try {
    return formatDistance(date);
  } catch (error) {
    // Fallback formatting if date-fns fails
    if (date instanceof Date) {
      return date.toLocaleString();
    }
    return new Date(date).toLocaleString();
  }
};

export const formatTimestamp = (timestamp: any): string => {
  if (!timestamp) return '';
  
  try {
    // Handle Firebase Timestamp
    if (timestamp.toDate) {
      return formatDistanceToNow(timestamp.toDate());
    }
    // Handle Date object
    if (timestamp instanceof Date) {
      return formatDistanceToNow(timestamp);
    }
    // Handle numeric timestamp
    return formatDistanceToNow(new Date(timestamp));
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return '';
  }
}; 