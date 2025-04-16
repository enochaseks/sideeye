import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, List, ListItem, ListItemText, Divider } from '@mui/material';

const Debug: React.FC = () => {
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [authState, setAuthState] = useState<any>(null);

  useEffect(() => {
    // Load error logs from localStorage
    try {
      const logs = JSON.parse(localStorage.getItem('errorLogs') || '[]');
      setErrorLogs(logs);
    } catch (e) {
      console.error('Failed to load error logs:', e);
    }

    // Get current auth state
    const auth = JSON.parse(localStorage.getItem('authState') || '{}');
    setAuthState(auth);
  }, []);

  const clearLogs = () => {
    localStorage.removeItem('errorLogs');
    setErrorLogs([]);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom>
        Debug Information
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Authentication State
        </Typography>
        <pre style={{ overflowX: 'auto' }}>
          {JSON.stringify(authState, null, 2)}
        </pre>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Error Logs
          </Typography>
          <Button variant="contained" color="secondary" onClick={clearLogs}>
            Clear Logs
          </Button>
        </Box>

        <List>
          {errorLogs.map((log, index) => (
            <React.Fragment key={index}>
              <ListItem alignItems="flex-start">
                <ListItemText
                  primary={
                    <Typography variant="subtitle1">
                      {new Date(log.timestamp).toLocaleString()}
                    </Typography>
                  }
                  secondary={
                    <>
                      <Typography component="span" variant="body2" color="text.primary">
                        Context: {log.context}
                      </Typography>
                      <br />
                      <Typography component="span" variant="body2">
                        Error: {log.error}
                      </Typography>
                      <br />
                      <Typography component="span" variant="body2" color="text.secondary">
                        URL: {log.url}
                      </Typography>
                    </>
                  }
                />
              </ListItem>
              {index < errorLogs.length - 1 && <Divider />}
            </React.Fragment>
          ))}
          {errorLogs.length === 0 && (
            <ListItem>
              <ListItemText primary="No errors logged" />
            </ListItem>
          )}
        </List>
      </Paper>
    </Box>
  );
};

export default Debug; 