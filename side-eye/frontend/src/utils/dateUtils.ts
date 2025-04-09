import { formatDistanceToNow } from 'date-fns';

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
    return formatDistanceToNow(date, { addSuffix: true });
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