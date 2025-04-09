import React, { useState, useCallback, useRef } from 'react';
import { Alert, Snackbar } from '@mui/material';

interface RateLimiterProps {
  children: React.ReactNode;
  maxRequests?: number;
  timeWindow?: number;
}

interface RateLimitedComponentProps {
  checkRateLimit: () => boolean;
}

const RateLimiter: React.FC<RateLimiterProps> = ({
  children,
  maxRequests = 10,
  timeWindow = 60000 // 1 minute
}) => {
  const [error, setError] = useState<string | null>(null);
  const requestCount = useRef(0);
  const lastResetTime = useRef(Date.now());

  const checkRateLimit = useCallback(() => {
    const now = Date.now();
    if (now - lastResetTime.current >= timeWindow) {
      requestCount.current = 0;
      lastResetTime.current = now;
    }

    if (requestCount.current >= maxRequests) {
      setError(`Rate limit exceeded. Please try again in ${Math.ceil((timeWindow - (now - lastResetTime.current)) / 1000)} seconds.`);
      return false;
    }

    requestCount.current++;
    return true;
  }, [maxRequests, timeWindow]);

  const handleCloseError = () => {
    setError(null);
  };

  return (
    <>
      {React.Children.map(children, (child) => {
        if (React.isValidElement<RateLimitedComponentProps>(child)) {
          return React.cloneElement(child, {
            checkRateLimit
          });
        }
        return child;
      })}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
};

export default RateLimiter; 