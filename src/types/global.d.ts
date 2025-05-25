declare global {
  interface Window {
    openCreateRoomDialog?: () => void;
    openProfileSetupDialog?: () => void;
  }
}

export {}; 