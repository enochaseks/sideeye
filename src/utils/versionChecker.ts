// Version checking utilities

// Default check interval - 1 hour (in milliseconds)
export const CHECK_INTERVAL = 60 * 60 * 1000;

// Local storage keys
export const VERSION_KEY = 'side_eye_app_version';
export const LAST_CHECK_KEY = 'side_eye_last_update_check';
export const SKIP_VERSION_KEY = 'side_eye_skip_version';

// Type for the version info returned from server
export interface VersionInfo {
  version: string;
  buildTimestamp: number;
  requiredUpdate: boolean;
  releaseNotes?: string;
}

/**
 * Gets the current version stored in the app
 */
export const getCurrentVersion = (): string | null => {
  return localStorage.getItem(VERSION_KEY);
};

/**
 * Saves a new version to localStorage
 */
export const saveCurrentVersion = (version: string): void => {
  localStorage.setItem(VERSION_KEY, version);
};

/**
 * Get the latest version from the server
 * This fetches the version.json file that would be updated with each deployment
 */
export const fetchLatestVersion = async (): Promise<VersionInfo> => {
  try {
    // Add a cache-busting parameter to ensure we get the latest version
    const response = await fetch('/version.json?cachebust=' + Date.now());
    
    // If the fetch succeeds, parse and return the data
    if (response.ok) {
      const data = await response.json();
      return data as VersionInfo;
    }
    
    // If fetch fails (e.g., file not found), fall back to the mock version
    console.warn('Failed to fetch version.json, using mock version');
    
    // Create a mock version based on current date (only as fallback)
    const mockVersion = `${new Date().getFullYear()}.${new Date().getMonth() + 1}.${new Date().getDate()}-${Math.floor(Math.random() * 100)}`;
    
    return {
      version: mockVersion,
      buildTimestamp: Date.now(),
      requiredUpdate: false,
      releaseNotes: 'This is a simulated update with new features and bug fixes.'
    };
  } catch (error) {
    console.error('Error fetching latest version:', error);
    
    // On error, create a mock version as fallback
    const mockVersion = `${new Date().getFullYear()}.${new Date().getMonth() + 1}.${new Date().getDate()}-${Math.floor(Math.random() * 100)}`;
    
    return {
      version: mockVersion,
      buildTimestamp: Date.now(),
      requiredUpdate: false,
      releaseNotes: 'Error fetching version info. This is a simulated update.'
    };
  }
};

/**
 * Checks if an update is available
 * Returns an object with update status and version info
 */
export const checkForUpdate = async (): Promise<{ 
  updateAvailable: boolean; 
  newVersion?: VersionInfo;
  currentVersion?: string | null;
}> => {
  try {
    // Only check if enough time has passed since last check
    const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
    const now = Date.now();
    
    if (lastCheck && (now - parseInt(lastCheck)) < CHECK_INTERVAL) {
      return { updateAvailable: false };
    }
    
    // Update last check time
    localStorage.setItem(LAST_CHECK_KEY, now.toString());
    
    // Get current version from localStorage
    const currentVersion = getCurrentVersion();
    
    // Get latest version from server
    const latestVersion = await fetchLatestVersion();
    
    // Get skipped version (if any)
    const skippedVersion = localStorage.getItem(SKIP_VERSION_KEY);
    
    // Determine if update is available
    const updateAvailable = currentVersion !== latestVersion.version && 
                           latestVersion.version !== skippedVersion;
    
    if (updateAvailable) {
      return {
        updateAvailable: true,
        newVersion: latestVersion,
        currentVersion
      };
    }
    
    // No update or same as skipped version
    return { updateAvailable: false, currentVersion };
  } catch (error) {
    console.error('Error checking for update:', error);
    return { updateAvailable: false };
  }
};

/**
 * Skip this version (don't prompt again)
 */
export const skipVersion = (version: string): void => {
  localStorage.setItem(SKIP_VERSION_KEY, version);
};

/**
 * Apply the update by saving the new version and reloading the page
 */
export const applyUpdate = (version: string): void => {
  // Remove any skipped version record
  localStorage.removeItem(SKIP_VERSION_KEY);
  
  // Save the new version
  saveCurrentVersion(version);
  
  // Reload the page to apply the update
  window.location.reload();
}; 