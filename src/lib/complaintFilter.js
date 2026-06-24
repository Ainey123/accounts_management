const COMPLAINT_KEYWORDS = [
  'complaint',
  'complain',
  'issue',
  'problem',
  'fault',
  'not working',
  'breakdown',
  'malfunction',
  'defect',
  'repair',
  'urgent',
  'emergency',
  'outage',
  'failure',
  'trouble',
  'concern',
  'dissatisfied',
  'poor service',
  'error',
  'faulty',
  'damage',
  'leak',
  'short circuit',
  'power failure',
  'no electricity',
  'no light',
  'tripping',
  'sparking',
  'overheating',
  'burning smell',
  'smoke',
  'shock',
  'hazard',
  'unsafe',
  'dangerous',
  'maintenance required',
  'service required',
  'follow up',
  'follow-up',
  'reminder',
  'escalate',
  'escalation',
  'ticket',
  'work order',
  'service request',
  'assistance',
  'help needed',
];

const EXCLUDED_SENDER_PATTERNS = [
  'linkedin.com',
  'google.com',
  'googlesecurity',
  'security@google',
  'noreply@google',
  'no-reply@google',
  'accounts.google',
  'mail-noreply@linkedin',
  'messages-noreply@linkedin',
  'notifications@github',
  'noreply@github',
  'newsletter',
  'promo',
  'marketing',
  'advertisement',
];

const EXCLUDED_SUBJECT_PATTERNS = [
  'security alert',
  'security notification',
  'new sign-in',
  'new login',
  'password changed',
  'account activity',
  'verify your account',
  'confirm your account',
  'welcome to',
  'get started',
  'turn on',
  'connecting you',
  'someone viewed your profile',
  'jobs for you',
  'trending now',
  'weekly digest',
  'daily digest',
];

function matchesPattern(text, patterns) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return patterns.some((pattern) => lower.includes(pattern));
}

function isExcludedSender(sender) {
  if (!sender) return false;
  const lower = sender.toLowerCase();
  return EXCLUDED_SENDER_PATTERNS.some((pattern) => lower.includes(pattern));
}

function isExcludedSubject(subject) {
  if (!subject) return false;
  const lower = subject.toLowerCase();
  return EXCLUDED_SUBJECT_PATTERNS.some((pattern) => lower.includes(pattern));
}

export function isComplaintEmail({ subject = '', sender = '', body = '' } = {}) {
  const text = `${subject} ${sender} ${body}`.toLowerCase();

  if (isExcludedSender(sender)) return false;
  if (isExcludedSubject(subject)) return false;

  const matchedKeyword = COMPLAINT_KEYWORDS.some((kw) => text.includes(kw));
  return matchedKeyword;
}

export function filterComplaintEmails(emails) {
  if (!Array.isArray(emails)) return [];
  return emails.filter((email) => isComplaintEmail(email));
}

export function getExcludedPatterns() {
  return {
    senderPatterns: EXCLUDED_SENDER_PATTERNS,
    subjectPatterns: EXCLUDED_SUBJECT_PATTERNS,
    complaintKeywords: COMPLAINT_KEYWORDS,
  };
}
