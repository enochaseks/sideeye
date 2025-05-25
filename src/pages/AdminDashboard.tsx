import React, { useState, useEffect } from 'react';
import {
    Container,
    Typography,
    Box,
    Paper,
    Grid,
    Card,
    CardContent,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Alert,
    CircularProgress,
    Tabs,
    Tab,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    IconButton,
    Tooltip
} from '@mui/material';
import {
    AccountBalance as BankIcon,
    MonetizationOn as MoneyIcon,
    TrendingUp as TrendingUpIcon,
    Visibility as ViewIcon,
    Check as ApproveIcon,
    Close as RejectIcon,
    Download as DownloadIcon,
    Refresh as RefreshIcon,
    Check
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { Helmet } from 'react-helmet-async';

interface WithdrawalRequest {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    amount: number; // in SC
    moneyAmount: number; // in GBP after fees
    platformFee: number; // in GBP
    grossAmount: number; // in GBP before fees
    status: 'pending' | 'approved' | 'rejected' | 'completed';
    requestDate: Date;
    processedDate?: Date;
    bankDetails?: {
        accountName: string;
        accountNumber: string;
        sortCode: string;
        bankName: string;
    };
    adminNotes?: string;
    bankTransactionId?: string;
}

interface PlatformFee {
    id: string;
    amount: number;
    currency: string;
    giftId: string;
    paymentId: string;
    senderId: string;
    receiverId: string;
    roomId: string;
    timestamp: Date;
    transferStatus: 'pending' | 'completed' | 'failed';
    transferId?: string;
}

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`admin-tabpanel-${index}`}
            aria-labelledby={`admin-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
}

const AdminDashboard: React.FC = () => {
    const { currentUser } = useAuth();
    const [tabValue, setTabValue] = useState(0);
    const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
    const [platformFees, setPlatformFees] = useState<PlatformFee[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null);
    const [showWithdrawalDialog, setShowWithdrawalDialog] = useState(false);
    const [adminNotes, setAdminNotes] = useState('');
    const [bankTransactionId, setBankTransactionId] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [analytics, setAnalytics] = useState({
        totalWithdrawals: 0,
        totalPlatformFees: 0,
        pendingWithdrawals: 0,
        completedWithdrawals: 0,
        totalUsers: 0
    });

    // Check if user is admin - only contact@sideeye.uk and enochaseks@yahoo.co.uk can access
    const isAdmin = currentUser?.email === 'contact@sideeye.uk' || currentUser?.email === 'enochaseks@yahoo.co.uk';

    useEffect(() => {
        if (!isAdmin) {
            toast.error('Access denied. Admin privileges required.');
            return;
        }
        loadData();
    }, [isAdmin]);

    const loadData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                loadWithdrawals(),
                loadPlatformFees(),
                loadAnalytics()
            ]);
        } catch (error) {
            console.error('Error loading admin data:', error);
            toast.error('Failed to load admin data');
        } finally {
            setLoading(false);
        }
    };

    const loadWithdrawals = async () => {
        try {
            const token = await currentUser?.getIdToken();
            const response = await fetch('/api/admin/withdrawal-requests?limit=100', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            
            if (data.success) {
                setWithdrawals(data.withdrawals.map((w: any) => ({
                    ...w,
                    requestDate: new Date(w.requestDate),
                    processedDate: w.processedDate ? new Date(w.processedDate) : undefined
                })));
            }
        } catch (error) {
            console.error('Error loading withdrawals:', error);
        }
    };

    const loadPlatformFees = async () => {
        try {
            const token = await currentUser?.getIdToken();
            const response = await fetch('/api/admin/platform-fees?limit=100', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            
            if (data.fees) {
                setPlatformFees(data.fees.map((f: any) => ({
                    ...f,
                    timestamp: new Date(f.timestamp)
                })));
                
                setAnalytics(prev => ({
                    ...prev,
                    totalPlatformFees: parseFloat(data.analytics.totalFees)
                }));
            }
        } catch (error) {
            console.error('Error loading platform fees:', error);
        }
    };

    const loadAnalytics = async () => {
        try {
            // Calculate analytics from loaded data
            const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.moneyAmount, 0);
            const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending').length;
            const completedWithdrawals = withdrawals.filter(w => w.status === 'completed').length;
            
            setAnalytics(prev => ({
                ...prev,
                totalWithdrawals,
                pendingWithdrawals,
                completedWithdrawals,
                totalUsers: new Set(withdrawals.map(w => w.userId)).size
            }));
        } catch (error) {
            console.error('Error calculating analytics:', error);
        }
    };

    const handleWithdrawalAction = async (withdrawalId: string, action: 'approve' | 'reject' | 'complete') => {
        setIsProcessing(true);
        try {
            const token = await currentUser?.getIdToken();
            const response = await fetch(`/api/admin/withdrawal-requests/${withdrawalId}/update-status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'completed',
                    adminNotes,
                    bankTransactionId: action === 'complete' ? bankTransactionId : undefined
                })
            });

            const data = await response.json();
            
            if (data.success) {
                toast.success(`Withdrawal ${action}d successfully`);
                setShowWithdrawalDialog(false);
                setAdminNotes('');
                setBankTransactionId('');
                loadWithdrawals(); // Reload data
            } else {
                toast.error(data.error || `Failed to ${action} withdrawal`);
            }
        } catch (error) {
            console.error(`Error ${action}ing withdrawal:`, error);
            toast.error(`Failed to ${action} withdrawal`);
        } finally {
            setIsProcessing(false);
        }
    };

    const openWithdrawalDialog = (withdrawal: WithdrawalRequest) => {
        setSelectedWithdrawal(withdrawal);
        setAdminNotes(withdrawal.adminNotes || '');
        setBankTransactionId(withdrawal.bankTransactionId || '');
        setShowWithdrawalDialog(true);
    };

    const exportData = (type: 'withdrawals' | 'fees') => {
        const data = type === 'withdrawals' ? withdrawals : platformFees;
        const csv = type === 'withdrawals' 
            ? 'ID,User,Email,Amount SC,Amount GBP,Platform Fee,Status,Request Date,Processed Date\n' +
              withdrawals.map(w => 
                `${w.id},${w.userName},${w.userEmail},${w.amount},${w.moneyAmount},${w.platformFee},${w.status},${w.requestDate.toISOString()},${w.processedDate?.toISOString() || ''}`
              ).join('\n')
            : 'ID,Amount,Currency,Gift ID,Payment ID,Status,Timestamp\n' +
              platformFees.map(f => 
                `${f.id},${f.amount},${f.currency},${f.giftId},${f.paymentId},${f.transferStatus},${f.timestamp.toISOString()}`
              ).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const filteredWithdrawals = statusFilter === 'all' 
        ? withdrawals 
        : withdrawals.filter(w => w.status === statusFilter);

    if (!isAdmin) {
        return (
            <Container maxWidth="md" sx={{ py: 4 }}>
                <Alert severity="error">
                    Access denied. Admin privileges required to view this page.
                </Alert>
            </Container>
        );
    }

    if (loading) {
        return (
            <Container maxWidth="lg" sx={{ py: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                    <CircularProgress />
                </Box>
            </Container>
        );
    }

    return (
        <>
            <Helmet>
                <title>Admin Dashboard - SideEye</title>
                <meta name="description" content="Admin dashboard for managing withdrawals and platform fees" />
            </Helmet>

            <Container maxWidth="lg" sx={{ py: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                    <Typography variant="h4" component="h1">
                        Admin Dashboard
                    </Typography>
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={loadData}
                    >
                        Refresh Data
                    </Button>
                </Box>

                {/* Analytics Cards */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <MoneyIcon color="primary" />
                                    <Box>
                                        <Typography variant="h4" fontWeight="bold">
                                            £{analytics.totalPlatformFees.toFixed(2)}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Total Platform Fees
                                        </Typography>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <BankIcon color="success" />
                                    <Box>
                                        <Typography variant="h4" fontWeight="bold">
                                            £{analytics.totalWithdrawals.toFixed(2)}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Total Withdrawals
                                        </Typography>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <TrendingUpIcon color="warning" />
                                    <Box>
                                        <Typography variant="h4" fontWeight="bold">
                                            {analytics.pendingWithdrawals}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Pending Withdrawals
                                        </Typography>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <ViewIcon color="info" />
                                    <Box>
                                        <Typography variant="h4" fontWeight="bold">
                                            {analytics.totalUsers}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Active Users
                                        </Typography>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Tabs */}
                <Paper sx={{ mb: 3 }}>
                    <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
                        <Tab label="Withdrawal Requests" />
                        <Tab label="Platform Fees" />
                    </Tabs>
                </Paper>

                {/* Withdrawal Requests Tab */}
                <TabPanel value={tabValue} index={0}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Typography variant="h5">Withdrawal Requests</Typography>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <FormControl size="small" sx={{ minWidth: 120 }}>
                                <InputLabel>Status</InputLabel>
                                <Select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    label="Status"
                                >
                                    <MenuItem value="all">All</MenuItem>
                                    <MenuItem value="pending">Pending</MenuItem>
                                    <MenuItem value="approved">Approved</MenuItem>
                                    <MenuItem value="completed">Completed</MenuItem>
                                    <MenuItem value="rejected">Rejected</MenuItem>
                                </Select>
                            </FormControl>
                            <Button
                                variant="outlined"
                                startIcon={<DownloadIcon />}
                                onClick={() => exportData('withdrawals')}
                            >
                                Export CSV
                            </Button>
                        </Box>
                    </Box>

                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>User</TableCell>
                                    <TableCell>Amount</TableCell>
                                    <TableCell>Platform Fee</TableCell>
                                    <TableCell>Net Amount</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Request Date</TableCell>
                                    <TableCell>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredWithdrawals.map((withdrawal) => (
                                    <TableRow key={withdrawal.id}>
                                        <TableCell>
                                            <Box>
                                                <Typography variant="body2" fontWeight="bold">
                                                    {withdrawal.userName}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {withdrawal.userEmail}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell>{withdrawal.amount} SC</TableCell>
                                        <TableCell>£{withdrawal.platformFee.toFixed(2)}</TableCell>
                                        <TableCell>£{withdrawal.moneyAmount.toFixed(2)}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={withdrawal.status.toUpperCase()}
                                                color={
                                                    withdrawal.status === 'completed' ? 'success' :
                                                    withdrawal.status === 'approved' ? 'info' :
                                                    withdrawal.status === 'rejected' ? 'error' : 'default'
                                                }
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {withdrawal.requestDate.toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            <Tooltip title="View Details">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => openWithdrawalDialog(withdrawal)}
                                                >
                                                    <ViewIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </TabPanel>

                {/* Platform Fees Tab */}
                <TabPanel value={tabValue} index={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Typography variant="h5">Platform Fees</Typography>
                        <Button
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            onClick={() => exportData('fees')}
                        >
                            Export CSV
                        </Button>
                    </Box>

                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Amount</TableCell>
                                    <TableCell>Gift ID</TableCell>
                                    <TableCell>Payment ID</TableCell>
                                    <TableCell>Transfer Status</TableCell>
                                    <TableCell>Date</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {platformFees.map((fee) => (
                                    <TableRow key={fee.id}>
                                        <TableCell>£{fee.amount.toFixed(2)}</TableCell>
                                        <TableCell>{fee.giftId}</TableCell>
                                        <TableCell>
                                            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                                {fee.paymentId}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={fee.transferStatus.toUpperCase()}
                                                color={
                                                    fee.transferStatus === 'completed' ? 'success' :
                                                    fee.transferStatus === 'failed' ? 'error' : 'default'
                                                }
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {fee.timestamp.toLocaleDateString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </TabPanel>

                {/* Withdrawal Details Dialog */}
                <Dialog open={showWithdrawalDialog} onClose={() => setShowWithdrawalDialog(false)} maxWidth="md" fullWidth>
                    <DialogTitle>
                        Withdrawal Request Details
                    </DialogTitle>
                    <DialogContent>
                        {selectedWithdrawal && (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {/* User Information */}
                                <Paper elevation={1} sx={{ p: 2 }}>
                                    <Typography variant="h6" gutterBottom>User Information</Typography>
                                    <Grid container spacing={2}>
                                        <Grid item xs={6}>
                                            <Typography variant="body2" color="text.secondary">Name</Typography>
                                            <Typography variant="body1">{selectedWithdrawal.userName}</Typography>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Typography variant="body2" color="text.secondary">Email</Typography>
                                            <Typography variant="body1">{selectedWithdrawal.userEmail}</Typography>
                                        </Grid>
                                    </Grid>
                                </Paper>

                                {/* Withdrawal Details */}
                                <Paper elevation={1} sx={{ p: 2 }}>
                                    <Typography variant="h6" gutterBottom>Withdrawal Details</Typography>
                                    <Grid container spacing={2}>
                                        <Grid item xs={6}>
                                            <Typography variant="body2" color="text.secondary">Amount (SC)</Typography>
                                            <Typography variant="body1">{selectedWithdrawal.amount} SC</Typography>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Typography variant="body2" color="text.secondary">Gross Amount</Typography>
                                            <Typography variant="body1">£{selectedWithdrawal.grossAmount.toFixed(2)}</Typography>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Typography variant="body2" color="text.secondary">Platform Fee (10%)</Typography>
                                            <Typography variant="body1">£{selectedWithdrawal.platformFee.toFixed(2)}</Typography>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Typography variant="body2" color="text.secondary">Net Amount</Typography>
                                            <Typography variant="body1" fontWeight="bold">£{selectedWithdrawal.moneyAmount.toFixed(2)}</Typography>
                                        </Grid>
                                    </Grid>
                                </Paper>

                                {/* Bank Details */}
                                {selectedWithdrawal.bankDetails && (
                                    <Paper elevation={1} sx={{ p: 2 }}>
                                        <Typography variant="h6" gutterBottom>Bank Details</Typography>
                                        <Grid container spacing={2}>
                                            <Grid item xs={6}>
                                                <Typography variant="body2" color="text.secondary">Account Name</Typography>
                                                <Typography variant="body1">{selectedWithdrawal.bankDetails.accountName}</Typography>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <Typography variant="body2" color="text.secondary">Bank Name</Typography>
                                                <Typography variant="body1">{selectedWithdrawal.bankDetails.bankName}</Typography>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <Typography variant="body2" color="text.secondary">Account Number</Typography>
                                                <Typography variant="body1">{selectedWithdrawal.bankDetails.accountNumber}</Typography>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <Typography variant="body2" color="text.secondary">Sort Code</Typography>
                                                <Typography variant="body1">{selectedWithdrawal.bankDetails.sortCode}</Typography>
                                            </Grid>
                                        </Grid>
                                    </Paper>
                                )}

                                {/* Admin Actions */}
                                <Paper elevation={1} sx={{ p: 2 }}>
                                    <Typography variant="h6" gutterBottom>Admin Actions</Typography>
                                    
                                    <TextField
                                        fullWidth
                                        label="Admin Notes"
                                        multiline
                                        rows={3}
                                        value={adminNotes}
                                        onChange={(e) => setAdminNotes(e.target.value)}
                                        sx={{ mb: 2 }}
                                    />

                                    {selectedWithdrawal.status === 'approved' && (
                                        <TextField
                                            fullWidth
                                            label="Bank Transaction ID"
                                            value={bankTransactionId}
                                            onChange={(e) => setBankTransactionId(e.target.value)}
                                            sx={{ mb: 2 }}
                                            placeholder="Enter bank transaction reference"
                                        />
                                    )}
                                </Paper>
                            </Box>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setShowWithdrawalDialog(false)}>
                            Close
                        </Button>
                        {selectedWithdrawal?.status === 'pending' && (
                            <>
                                <Button
                                    color="error"
                                    startIcon={<RejectIcon />}
                                    onClick={() => handleWithdrawalAction(selectedWithdrawal.id, 'reject')}
                                    disabled={isProcessing}
                                >
                                    Reject
                                </Button>
                                <Button
                                    color="success"
                                    startIcon={<ApproveIcon />}
                                    onClick={() => handleWithdrawalAction(selectedWithdrawal.id, 'approve')}
                                    disabled={isProcessing}
                                >
                                    Approve
                                </Button>
                            </>
                        )}
                        {selectedWithdrawal?.status === 'approved' && (
                            <Button
                                color="primary"
                                startIcon={<Check />}
                                onClick={() => handleWithdrawalAction(selectedWithdrawal.id, 'complete')}
                                disabled={isProcessing || !bankTransactionId}
                            >
                                Mark as Completed
                            </Button>
                        )}
                    </DialogActions>
                </Dialog>
            </Container>
        </>
    );
};

export default AdminDashboard; 