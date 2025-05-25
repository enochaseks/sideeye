import React from 'react';
import { Container, Typography, Box, Paper, Alert, Button, Divider } from '@mui/material';
import { 
  Security as SecurityIcon,
  CreditCard as CreditCardIcon,
  Shield as ShieldIcon,
  Lock as LockIcon,
  Verified as VerifiedIcon,
  Payment as PaymentIcon,
  AccountBalanceWallet as WalletIcon,
  CardGiftcard as GiftIcon
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

const GiftPurchasing: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Gift Purchasing & Payment Security - SideEye</title>
        <meta name="description" content="Learn about secure gift purchasing, payment methods, and data protection on SideEye" />
      </Helmet>

      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <GiftIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h4" component="h1" gutterBottom>
              Gift Purchasing & Payment Security
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Everything you need to know about buying gifts safely on SideEye
            </Typography>
          </Box>

          <Alert severity="success" sx={{ mb: 4 }}>
            <Typography variant="body2">
              <strong>🔒 Your Payment Data is Safe:</strong> We don't store any payment card details, CVV codes, or sensitive payment information on our platform. 
              All transactions are processed securely through certified, PCI-compliant payment providers including Stripe.
            </Typography>
          </Alert>

          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PaymentIcon color="primary" />
              How Gift Purchasing Works
            </Typography>
            <Typography variant="body1" paragraph>
              When you want to send a gift to a host during their live stream, you'll pay real money using secure payment methods. 
              The host receives SideCoins (our platform currency) that they can withdraw as real money monthly.
            </Typography>

            <Box sx={{ pl: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>Gift Prices:</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2">• ❤️ Heart Gift: £0.50</Typography>
                <Typography variant="body2">• 👀 Side Eye Gift: £0.75</Typography>
                <Typography variant="body2">• 🎉 Confetti Gift: £1.00</Typography>
                <Typography variant="body2">• 👑 Crown Gift: £2.00</Typography>
              </Box>
            </Box>

            <Typography variant="body1" paragraph>
              <strong>What happens when you purchase:</strong>
            </Typography>
            <Box sx={{ pl: 2, mb: 3 }}>
              <Typography variant="body2">1. You pay the gift price using your chosen payment method (card, Apple Pay, Google Pay)</Typography>
              <Typography variant="body2">2. Payment is processed securely through our certified payment providers</Typography>
              <Typography variant="body2">3. The host receives 80% of the gift value as SideCoins (withdrawable as real money)</Typography>
              <Typography variant="body2">4. We retain 10% as a platform fee for service provision and payment processing</Typography>
              <Typography variant="body2">5. Your gift animation plays in the live room for all participants to see</Typography>
              <Typography variant="body2">6. You receive an automated email receipt via our secure email service</Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 4 }} />

          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CreditCardIcon color="primary" />
              Supported Payment Methods
            </Typography>
            <Typography variant="body1" paragraph>
              We support multiple secure payment methods to make purchasing gifts convenient and safe:
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>💳 Credit & Debit Cards</Typography>
                <Typography variant="body2" color="text.secondary">
                  Visa, Mastercard, American Express, and other major cards accepted
                </Typography>
              </Paper>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>📱 Apple Pay</Typography>
                <Typography variant="body2" color="text.secondary">
                  Quick and secure payments using Touch ID or Face ID
                </Typography>
              </Paper>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>🔍 Google Pay</Typography>
                <Typography variant="body2" color="text.secondary">
                  Fast checkout with your saved Google payment methods
                </Typography>
              </Paper>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>🌍 International Cards</Typography>
                <Typography variant="body2" color="text.secondary">
                  We accept cards from most countries worldwide
                </Typography>
              </Paper>
            </Box>
          </Box>

          <Divider sx={{ my: 4 }} />

          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SecurityIcon color="primary" />
              Payment Security & Data Protection
            </Typography>
            
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Important:</strong> SideEye does not store, process, or have access to your payment card details on our servers. 
                All payment processing is handled by certified, PCI-compliant payment providers including Stripe with bank-level encryption.
              </Typography>
            </Alert>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <ShieldIcon color="success" />
                <Box>
                  <Typography variant="h6" gutterBottom>Bank-Level Security</Typography>
                  <Typography variant="body2" color="text.secondary">
                    All transactions are encrypted using the same security standards as online banking. 
                    Your payment data is transmitted directly to our payment processors without passing through our servers.
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <LockIcon color="success" />
                <Box>
                  <Typography variant="h6" gutterBottom>No Card Storage</Typography>
                  <Typography variant="body2" color="text.secondary">
                    We never store your credit card numbers, CVV codes, or other sensitive payment information on our servers. 
                    Each transaction is processed in real-time through secure payment providers without retaining your payment details.
                    Payment forms support secure browser autofill without compromising your data security.
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <VerifiedIcon color="success" />
                <Box>
                  <Typography variant="h6" gutterBottom>PCI Compliance</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Our payment partners are PCI DSS compliant, meeting the highest standards for 
                    payment card data security in the industry.
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>

          <Divider sx={{ my: 4 }} />

          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" gutterBottom>
              What We Do Store
            </Typography>
            <Typography variant="body1" paragraph>
              While we don't store your payment details, we do keep some information for legitimate business purposes:
            </Typography>
            <Box sx={{ pl: 2, mb: 3 }}>
              <Typography variant="body2">• Transaction receipts and gift purchase history for customer support</Typography>
              <Typography variant="body2">• Your email address (for sending automated receipts via Mailgun)</Typography>
              <Typography variant="body2">• Gift details (which gift was sent to which host and when)</Typography>
              <Typography variant="body2">• Transaction IDs and payment confirmation details</Typography>
              <Typography variant="body2">• Platform fee records (10% of each transaction) for accounting</Typography>
              <Typography variant="body2">• Host earnings data (80% of gift value converted to SideCoins)</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              This information helps us provide customer support, process refunds within 24 hours if needed, calculate host earnings, 
              and maintain accurate records for tax and legal compliance. All data is stored securely with access limited to authorized personnel.
            </Typography>
          </Box>

          <Divider sx={{ my: 4 }} />

          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" gutterBottom>
              Refunds & Customer Support
            </Typography>
            <Typography variant="body1" paragraph>
              If you experience any issues with your gift purchase:
            </Typography>
            <Box sx={{ pl: 2, mb: 3 }}>
              <Typography variant="body2">• Contact us at support@sideeye.uk within 24 hours</Typography>
              <Typography variant="body2">• Include your transaction ID from the email receipt</Typography>
              <Typography variant="body2">• Describe the issue you experienced</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              We'll investigate and process eligible refunds within 5-7 business days.
            </Typography>
          </Box>

          <Divider sx={{ my: 4 }} />

          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" gutterBottom>
              Browser Autofill & Saved Cards
            </Typography>
            <Typography variant="body1" paragraph>
              For your convenience, our payment forms support:
            </Typography>
            <Box sx={{ pl: 2, mb: 3 }}>
              <Typography variant="body2">• Browser autofill for saved payment methods</Typography>
              <Typography variant="body2">• Apple Pay and Google Pay for quick checkout</Typography>
              <Typography variant="body2">• Secure form fields that protect your input</Typography>
            </Box>
            <Alert severity="warning" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Note:</strong> Browser autofill features only work on secure HTTPS connections for security reasons. 
                If you're testing locally (localhost), you may need to manually enter payment details. 
                In production, all autofill features work normally on our secure domain.
              </Typography>
            </Alert>
          </Box>

          <Box sx={{ 
            mt: 4, 
            p: 3, 
            bgcolor: 'primary.main', 
            color: 'primary.contrastText', 
            borderRadius: 2,
            textAlign: 'center'
          }}>
            <Typography variant="h6" gutterBottom>
              Ready to Send Your First Gift?
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Join a live room and show your appreciation to hosts with secure, real-money gifts!
            </Typography>
            <Button 
              variant="contained" 
              color="secondary"
              component={Link} 
              to="/discover"
              startIcon={<WalletIcon />}
              sx={{ mr: 2 }}
            >
              Find Live Rooms
            </Button>
            <Button 
              variant="outlined" 
              component={Link} 
              to="/wallet"
              startIcon={<WalletIcon />}
              sx={{ 
                color: 'primary.contrastText', 
                borderColor: 'primary.contrastText',
                '&:hover': {
                  borderColor: 'primary.contrastText',
                  bgcolor: 'rgba(255,255,255,0.1)'
                }
              }}
            >
              View Wallet
            </Button>
          </Box>

          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Have questions about gift purchasing? Contact us at{' '}
              <a href="mailto:support@sideeye.uk" style={{ color: 'inherit' }}>
                support@sideeye.uk
              </a>
            </Typography>
          </Box>
        </Paper>
      </Container>
    </>
  );
};

export default GiftPurchasing; 