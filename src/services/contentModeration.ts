import { doc, updateDoc, getDoc, arrayUnion, Firestore, increment, getFirestore } from 'firebase/firestore';
import { getApp } from 'firebase/app';

// Get existing Firebase app instance
const db = getFirestore(getApp());

interface ModerationResult {
  isApproved: boolean;
  violations: string[];
  warningLevel: 'none' | 'low' | 'medium' | 'high';
  strikeAdded: boolean;
  totalStrikes?: number;
  actionTaken?: 'warning' | 'restriction' | 'suspension' | 'none';
}

// Expanded patterns for harmful content
const HARMFUL_PATTERNS = [
  /kill\s+yourself/i,
  /you\s+should\s+die/i,
  /go\s+die/i,
  /i\s+hate\s+you/i,
  /you're\s+ugly/i,
  /you're\s+stupid/i,
  /you're\s+worthless/i,
  /nobody\s+loves\s+you/i,
  /you're\s+pathetic/i,
  /you're\s+a\s+loser/i,
];

// Expanded warning words
const WARNING_WORDS = [
  'hate', 'kill', 'die', 'stupid', 'ugly', 'worthless', 'pathetic', 'loser', 'idiot', 'moron',
];

// New patterns for misinformation detection
const MISINFORMATION_PATTERNS = [
  /covid\s+vaccine\s+causes\s+(autism|cancer)/i,
  /5g\s+causes\s+(cancer|covid)/i,
  /flat\s+earth/i,
  /moon\s+landing\s+hoax/i,
  /climate\s+change\s+hoax/i,
  /vaccines\s+cause\s+autism/i,
  /government\s+cover\s+up/i,
  /secret\s+society/i,
  /illuminati/i,
  /deep\s+state/i,
];

// Patterns for fraudulent activities
const FRAUD_PATTERNS = [
  /send\s+money/i,
  /bitcoin\s+investment/i,
  /crypto\s+investment/i,
  /get\s+rich\s+quick/i,
  /earn\s+money\s+fast/i,
  /work\s+from\s+home\s+scam/i,
  /lottery\s+winner/i,
  /inheritance\s+scam/i,
  /prince\s+scam/i,
  /bank\s+account\s+details/i,
  /credit\s+card\s+number/i,
  /social\s+security\s+number/i,
];

// Patterns for cybercrime
const CYBERCRIME_PATTERNS = [
  /hack\s+account/i,
  /password\s+stealing/i,
  /phishing\s+link/i,
  /malware/i,
  /ransomware/i,
  /ddos\s+attack/i,
  /botnet/i,
  /exploit/i,
  /bypass\s+security/i,
  /crack\s+password/i,
];

// New patterns for adult content & exploitation
const ADULT_CONTENT_PATTERNS = [
  /explicit\s+content/i,
  /pornographic/i,
  /nude\s+image/i,
  /sexual\s+act/i,
  /child\s+exploitation/i,
  /revenge\s+porn/i,
  /non-consensual\s+intimate/i,
];

// New patterns for violence & gore
const VIOLENCE_PATTERNS = [
  /self\s+harm/i,
  /suicide\s+method/i,
  /eating\s+disorder\s+promotion/i,
  /violent\s+act/i,
  /graphic\s+injury/i,
  /torture/i,
  /mutilation/i,
];

// Determine strike weight based on violation type
const getStrikeWeight = (violation: string): number => {
  if (violation.includes('Harmful content') || 
      violation.includes('cybercrime') || 
      violation.includes('Adult Content')) {
    return 2; // Severe violations
  } else if (violation.includes('fraudulent') || 
             violation.includes('Violence') || 
             violation.includes('misinformation')) {
    return 1.5; // Serious violations
  } else {
    return 1; // Standard violations
  }
};

export const moderateContent = async (
  content: string,
  userId: string
): Promise<ModerationResult> => {
  const violations: string[] = [];
  let warningLevel: 'none' | 'low' | 'medium' | 'high' = 'none';
  let strikeAdded = false;
  let totalStrikes = 0;
  let actionTaken: 'warning' | 'restriction' | 'suspension' | 'none' = 'none';

  // Check for harmful patterns
  for (const pattern of HARMFUL_PATTERNS) {
    if (pattern.test(content)) {
      violations.push('Harmful content detected');
      warningLevel = 'high';
    }
  }

  // Check for misinformation
  for (const pattern of MISINFORMATION_PATTERNS) {
    if (pattern.test(content)) {
      violations.push('Potential misinformation detected');
      warningLevel = warningLevel === 'high' ? 'high' : 'medium';
    }
  }

  // Check for fraudulent activities
  for (const pattern of FRAUD_PATTERNS) {
    if (pattern.test(content)) {
      violations.push('Potential fraudulent activity detected');
      warningLevel = 'high';
    }
  }

  // Check for cybercrime
  for (const pattern of CYBERCRIME_PATTERNS) {
    if (pattern.test(content)) {
      violations.push('Potential cybercrime detected');
      warningLevel = 'high';
    }
  }

  // Check for adult content
  for (const pattern of ADULT_CONTENT_PATTERNS) {
    if (pattern.test(content)) {
      violations.push('Adult content or exploitation detected');
      warningLevel = 'high';
    }
  }

  // Check for violence
  for (const pattern of VIOLENCE_PATTERNS) {
    if (pattern.test(content)) {
      violations.push('Violence or harmful content detected');
      warningLevel = 'high';
    }
  }

  // Check for warning words
  const warningWordCount = WARNING_WORDS.filter(word => 
    content.toLowerCase().includes(word)
  ).length;

  if (warningWordCount > 0) {
    violations.push(`Contains ${warningWordCount} potentially harmful words`);
    if (warningWordCount >= 3) {
      warningLevel = warningLevel === 'high' ? 'high' : 'medium';
    } else if (warningWordCount > 0) {
      warningLevel = warningLevel === 'high' || warningLevel === 'medium' ? warningLevel : 'low';
    }
  }

  // Check user's warning history and strike count
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    const userData = userDoc.data();
    const warningHistory = userData.warningHistory || [];
    totalStrikes = userData.strikes || 0;
    
    if (warningHistory.length >= 3) {
      warningLevel = 'high';
      violations.push('User has multiple previous warnings');
    }
  }

  // Determine if a strike should be added based on the warning level
  if (warningLevel === 'high') {
    strikeAdded = true;
    
    // Calculate strike weight based on violations
    let strikeWeight = violations.reduce((weight, violation) => {
      return weight + getStrikeWeight(violation);
    }, 0);
    
    // Cap strike weight at 3 for a single violation
    strikeWeight = Math.min(strikeWeight, 3);
    
    // Update user's strikes
    const newTotalStrikes = totalStrikes + strikeWeight;
    
    // Determine action based on total strikes
    if (newTotalStrikes >= 9) {
      actionTaken = 'suspension';
    } else if (newTotalStrikes >= 6) {
      actionTaken = 'restriction';
    } else if (newTotalStrikes >= 3) {
      actionTaken = 'warning';
    }
    
    // Get current user data or default values
    const userSuspended = userDoc.exists() ? userDoc.data().suspended || false : false;
    const userRestricted = userDoc.exists() ? userDoc.data().restricted || false : false;
    
    // Update user document with new strike count and suspension status if needed
    await updateDoc(userRef, {
      strikes: newTotalStrikes,
      strikeHistory: arrayUnion({
        timestamp: new Date().toISOString(),
        count: strikeWeight,
        violations: violations,
        content: content
      }),
      warningHistory: arrayUnion({
        timestamp: new Date().toISOString(),
        level: warningLevel,
        content: content,
        violations: violations
      }),
      suspended: actionTaken === 'suspension' ? true : userSuspended,
      restricted: actionTaken === 'restriction' ? true : userRestricted,
      lastActionTaken: actionTaken,
      lastActionDate: new Date().toISOString()
    });
    
    totalStrikes = newTotalStrikes;
  } else if (warningLevel !== 'none') {
    // Just update warning history without adding a strike
    await updateDoc(userRef, {
      warningHistory: arrayUnion({
        timestamp: new Date().toISOString(),
        level: warningLevel,
        content: content,
        violations: violations
      })
    });
  }

  return {
    isApproved: warningLevel !== 'high',
    violations,
    warningLevel,
    strikeAdded,
    totalStrikes,
    actionTaken
  };
};

export const getModerationGuidelines = () => ({
  title: 'Community Guidelines',
  rules: [
    'Be respectful and kind to others',
    'No hate speech or harassment',
    'No threats or violent content',
    'No spreading of misinformation',
    'No fraudulent activities or scams',
    'No cybercrime or hacking attempts',
    'No adult content or exploitation',
    'No violence or gore',
    'Keep it fun and lighthearted',
    'Report inappropriate content',
    'Respect different opinions',
    'No personal attacks',
    'Use shade and sarcasm responsibly'
  ],
  consequences: [
    'First strike (3 points): Warning and educational resources',
    'Second strike (6 points): Temporary feature restrictions for 3 days',
    'Third strike (9 points): Account suspension for 7 days',
    'Fourth strike (12 points): Permanent account suspension'
  ],
  strikeSystem: {
    description: 'SideEye uses an AI-powered moderation system that automatically scans all content against our community guidelines.',
    weights: [
      'Standard violations: 1 strike point',
      'Serious violations (misinformation, fraud, violence): 1.5 strike points',
      'Severe violations (harmful content, cybercrime, exploitation): 2 strike points'
    ],
    accumulation: 'Strike points accumulate on your account and determine the level of action taken.',
    expiration: 'Strike points remain on your account for 6 months before beginning to expire.',
    appeal: 'You can appeal strikes through your account settings or by contacting support@sideeye.com'
  }
});

export const checkUserWarnings = async (db: Firestore, userId: string): Promise<boolean> => {
  // Check user's warning history and strike count
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    const userData = userDoc.data();
    const strikes = userData.strikes || 0;
    
    if (strikes >= 9) {
      return true; // User should be suspended
    }
  }

  return false;
};

// New function to get user's strike information
export const getUserStrikeInfo = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.warn(`User document not found for ID: ${userId}`);
      return {
        strikes: 0,
        suspended: false,
        restricted: false,
        strikeHistory: [],
        warningHistory: [],
        lastActionTaken: 'none',
        lastActionDate: null
      };
    }
    
    const userData = userDoc.data();
    return {
      strikes: userData.strikes || 0,
      suspended: userData.suspended || false,
      restricted: userData.restricted || false,
      strikeHistory: userData.strikeHistory || [],
      warningHistory: userData.warningHistory || [],
      lastActionTaken: userData.lastActionTaken || 'none',
      lastActionDate: userData.lastActionDate || null
    };
  } catch (error) {
    console.error('Error fetching user strike info:', error);
    throw error;
  }
};

// New function to reset restrictions after time period has elapsed
export const checkAndResetRestrictions = async (userId: string) => {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    const userData = userDoc.data();
    
    if (userData.lastActionDate) {
      const lastActionDate = new Date(userData.lastActionDate);
      const currentDate = new Date();
      const daysSinceAction = Math.floor((currentDate.getTime() - lastActionDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Reset restrictions after 3 days
      if (userData.restricted && daysSinceAction > 3) {
        await updateDoc(userRef, {
          restricted: false
        });
      }
      
      // Reset suspension after 7 days
      if (userData.suspended && daysSinceAction > 7) {
        await updateDoc(userRef, {
          suspended: false
        });
      }
    }
  }
}; 