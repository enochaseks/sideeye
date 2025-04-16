import React from 'react';
import { ThemeProvider as MUIThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Create a theme instance with custom class name handling
const theme = createTheme({
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          // Use a simpler class name structure
          '&.MuiButton-root': {
            // Your button styles here
          }
        }
      }
    },
    MuiButtonBase: {
      styleOverrides: {
        root: {
          // Use a simpler class name structure
          '&.MuiButtonBase-root': {
            // Your button base styles here
          }
        }
      }
    }
  },
  // Add any other theme customizations here
});

// Custom class name generator to prevent long class names
const generateClassName = (rule: any, styleSheet: any) => {
  const prefix = styleSheet.options.classNamePrefix;
  const name = rule.key;
  return `${prefix}-${name}`;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  return (
    <MUIThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MUIThemeProvider>
  );
};

export default ThemeProvider; 