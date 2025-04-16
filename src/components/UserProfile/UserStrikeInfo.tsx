import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip,
  LinearProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Block as BlockIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  VerifiedUser as VerifiedUserIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { getUserStrikeInfo } from '../../services/contentModeration';
import { formatDistanceToNow } from 'date-fns';

interface UserStrikeInfoProps {
  userId: string;
}

interface StrikeHistoryItem {
  timestamp: string;
  count: number;
  violations: string[];
  content: string;
}

interface WarningHistoryItem {
  timestamp: string;
  level: 'none' | 'low' | 'medium' | 'high';
  content: string;
  violations: string[];
}

interface UserStrikeData {
  strikes: number;
  suspended: boolean;
  restricted: boolean;
  strikeHistory: StrikeHistoryItem[];
  warningHistory: WarningHistoryItem[];
  lastActionTaken: 'warning' | 'restriction' | 'suspension' | 'none';
  lastActionDate: string | null;
}

const UserStrikeInfo: React.FC<UserStrikeInfoProps> = ({ userId }) => {
  const [strikeData, setStrikeData] = useState<UserStrikeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStrikeInfo = async () => {
      try {
        const data = await getUserStrikeInfo(userId);
        setStrikeData(data);
      } catch (err) {
        setError('Failed to load strike information');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStrikeInfo();
  }, [userId]);

  const getStrikeLevel = (strikes: number) => {
    if (strikes >= 9) return 'Critical';
    if (strikes >= 6) return 'Serious';
    if (strikes >= 3) return 'Warning';
    return 'Good Standing';
  };

  const getStrikeLevelColor = (strikes: number) => {
    if (strikes >= 9) return 'error';
    if (strikes >= 6) return 'warning';
    if (strikes >= 3) return 'info';
    return 'success';
  };

  const getActionStatus = (data: UserStrikeData) => {
    if (data.suspended) {
      return {
        text: 'Account Suspended',
        icon: <BlockIcon color="error" />,
        color: 'error.main',
        description: 'Your account is currently suspended due to multiple community guidelines violations.',
      };
    }
    if (data.restricted) {
      return {
        text: 'Features Restricted',
        icon: <WarningIcon color="warning" />,
        color: 'warning.main',
        description: 'Some features are temporarily restricted due to community guidelines violations.',
      };
    }
    if (data.lastActionTaken === 'warning') {
      return {
        text: 'Warning Issued',
        icon: <InfoIcon color="info" />,
        color: 'info.main',
        description: 'You have received a warning for violating our community guidelines.',
      };
    }
    return {
      text: 'Good Standing',
      icon: <VerifiedUserIcon color="success" />,
      color: 'success.main',
      description: 'Your account is in good standing.',
    };
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading strike information...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!strikeData) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">No strike information available</Alert>
      </Box>
    );
  }

  const actionStatus = getActionStatus(strikeData);

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningIcon /> Community Guidelines Status
      </Typography>
      
      <Divider sx={{ my: 2 }} />
      
      <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ mr: 2 }}>
            Status:
          </Typography>
          <Chip
            icon={actionStatus.icon}
            label={actionStatus.text}
            sx={{ 
              bgcolor: `${getStrikeLevelColor(strikeData.strikes)}.light`,
              color: `${getStrikeLevelColor(strikeData.strikes)}.dark`,
              fontWeight: 'bold'
            }}
          />
        </Box>
        
        <Alert severity={getStrikeLevelColor(strikeData.strikes) as 'error' | 'warning' | 'info' | 'success'}>
          {actionStatus.description}
          {strikeData.lastActionDate && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Last action taken: {formatDistanceToNow(new Date(strikeData.lastActionDate))} ago
            </Typography>
          )}
        </Alert>
      </Box>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Strike Points:
        </Typography>
        <LinearProgress
          variant="determinate"
          value={Math.min((strikeData.strikes / 12) * 100, 100)}
          color={getStrikeLevelColor(strikeData.strikes) as 'error' | 'warning' | 'info' | 'success'}
          sx={{ height: 10, borderRadius: 5, mb: 1 }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2">{strikeData.strikes} / 12 points</Typography>
          <Typography variant="body2" sx={{ fontWeight: 'bold', color: `${getStrikeLevelColor(strikeData.strikes)}.main` }}>
            {getStrikeLevel(strikeData.strikes)}
          </Typography>
        </Box>
      </Box>
      
      <Divider sx={{ my: 3 }} />
      
      <Box>
        <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon /> Strike & Warning History
        </Typography>
        
        {strikeData.strikeHistory.length === 0 && strikeData.warningHistory.length === 0 ? (
          <Alert severity="success" sx={{ mt: 2 }}>
            No strikes or warnings have been issued to this account.
          </Alert>
        ) : (
          <>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>
                  Strikes ({strikeData.strikeHistory.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {strikeData.strikeHistory.length === 0 ? (
                  <Typography>No strikes on record</Typography>
                ) : (
                  <List>
                    {strikeData.strikeHistory
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .map((strike, index) => (
                        <ListItem key={index} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                          <ListItemText
                            primary={`Strike: ${strike.count} points - ${formatDistanceToNow(new Date(strike.timestamp))} ago`}
                            secondary={
                              <Box sx={{ mt: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                  Violations:
                                </Typography>
                                <ul>
                                  {strike.violations.map((violation, i) => (
                                    <li key={i}><Typography variant="body2">{violation}</Typography></li>
                                  ))}
                                </ul>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                  Content: <i>"{strike.content.substring(0, 100)}..."</i>
                                </Typography>
                              </Box>
                            }
                          />
                          {index < strikeData.strikeHistory.length - 1 && <Divider sx={{ width: '100%', my: 1 }} />}
                        </ListItem>
                      ))}
                  </List>
                )}
              </AccordionDetails>
            </Accordion>
            
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>
                  Warnings ({strikeData.warningHistory.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {strikeData.warningHistory.length === 0 ? (
                  <Typography>No warnings on record</Typography>
                ) : (
                  <List>
                    {strikeData.warningHistory
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .map((warning, index) => (
                        <ListItem key={index} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                          <ListItemText
                            primary={`Warning Level: ${warning.level.toUpperCase()} - ${formatDistanceToNow(new Date(warning.timestamp))} ago`}
                            secondary={
                              <Box sx={{ mt: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                  Violations:
                                </Typography>
                                <ul>
                                  {warning.violations.map((violation, i) => (
                                    <li key={i}><Typography variant="body2">{violation}</Typography></li>
                                  ))}
                                </ul>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                  Content: <i>"{warning.content.substring(0, 100)}..."</i>
                                </Typography>
                              </Box>
                            }
                          />
                          {index < strikeData.warningHistory.length - 1 && <Divider sx={{ width: '100%', my: 1 }} />}
                        </ListItem>
                      ))}
                  </List>
                )}
              </AccordionDetails>
            </Accordion>
          </>
        )}
      </Box>
      
      <Box sx={{ mt: 3 }}>
        <Alert severity="info" icon={<InfoIcon />}>
          <Typography variant="body2">
            If you believe any strikes or warnings were issued in error, you can appeal through your account 
            settings or by contacting support@sideeye.com with details about the situation.
          </Typography>
        </Alert>
      </Box>
    </Paper>
  );
};

export default UserStrikeInfo; 