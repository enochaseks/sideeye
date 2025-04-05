import { doc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';

interface ModerationResult {
  isApproved: boolean;
  violations: string[];
  warningLevel: 'none' | 'low' | 'medium' | 'high';
}

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

const WARNING_WORDS = [
  'hate',
  'kill',
  'die',
  'stupid',
  'ugly',
  'worthless',
  'pathetic',
  'loser',
  'idiot',
  'moron',
];

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
  const userRef = doc(db, 'users', userId);
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