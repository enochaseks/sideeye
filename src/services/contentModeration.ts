import { doc, updateDoc, getDoc, arrayUnion, Firestore } from 'firebase/firestore';
import { getDb } from './firebase';

interface ModerationResult {
  isApproved: boolean;
  violations: string[];
  warningLevel: 'none' | 'low' | 'medium' | 'high';
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

const db = getDb();

export const moderateContent = async (
  content: string,
  userId: string
): Promise<ModerationResult> => {
  const violations: string[] = [];
  let warningLevel: 'none' | 'low' | 'medium' | 'high' = 'none';

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
      warningLevel = 'medium';
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

  // Check for warning words
  const warningWordCount = WARNING_WORDS.filter(word => 
    content.toLowerCase().includes(word)
  ).length;

  if (warningWordCount > 0) {
    violations.push(`Contains ${warningWordCount} potentially harmful words`);
    if (warningWordCount >= 3) {
      warningLevel = 'medium';
    } else if (warningWordCount > 0) {
      warningLevel = 'low';
    }
  }

  // Check user's warning history
  const firestore = await db;
  const userRef = doc(firestore, 'users', userId);
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    const userData = userDoc.data();
    const warningHistory = userData.warningHistory || [];
    
    if (warningHistory.length >= 3) {
      warningLevel = 'high';
      violations.push('User has multiple previous warnings');
    }
  }

  // Update user's warning history if needed
  if (warningLevel !== 'none') {
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
    warningLevel
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
    'Keep it fun and lighthearted',
    'Report inappropriate content',
    'Respect different opinions',
    'No personal attacks',
    'Use shade and sarcasm responsibly'
  ],
  consequences: [
    'First violation: Warning',
    'Second violation: Temporary mute',
    'Third violation: Account suspension',
    'Severe violations: Permanent ban'
  ]
});

export const checkUserWarnings = async (db: Firestore, userId: string): Promise<boolean> => {
  // Check user's warning history
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    const userData = userDoc.data();
    const warningHistory = userData.warningHistory || [];
    
    if (warningHistory.length >= 3) {
      return true;
    }
  }

  return false;
}; 