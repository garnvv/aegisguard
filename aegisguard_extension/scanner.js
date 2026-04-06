/**
 * scanner.js — AegisGuard.AI v2 (JavaScript Heuristic Engine)
 *
 * A complete port of the Python utils.py heuristic engine.
 * Runs 100% offline — no server required.
 * Scores 0–100 based on 14 independent checks (same logic as backend).
 */

// ── Trusted domain list (mirrors Python GOLDEN_WHITELIST) ────────────────────
const TRUSTED_DOMAINS = [
  // Google
  'google.com', 'accounts.google.com', 'gmail.com', 'youtube.com',
  'drive.google.com', 'docs.google.com', 'meet.google.com',
  // Microsoft
  'microsoft.com', 'login.microsoftonline.com', 'live.com', 'outlook.com',
  'office.com', 'teams.microsoft.com', 'azure.com',
  // Meta
  'facebook.com', 'instagram.com', 'whatsapp.com', 'messenger.com', 'meta.com',
  // Apple
  'apple.com', 'appleid.apple.com', 'icloud.com',
  // Amazon / AWS
  'amazon.com', 'aws.amazon.com', 'amazonaws.com',
  // AI platforms
  'chatgpt.com', 'openai.com', 'chat.openai.com', 'claude.ai', 'anthropic.com',
  'gemini.google.com', 'copilot.microsoft.com', 'huggingface.co',
  'perplexity.ai', 'mistral.ai', 'cohere.com',
  // Developer
  'github.com', 'gitlab.com', 'stackoverflow.com', 'npmjs.com', 'pypi.org',
  'vercel.com', 'netlify.com', 'cloudflare.com',
  // Social
  'twitter.com', 'x.com', 'linkedin.com', 'reddit.com', 'discord.com',
  'telegram.org', 't.me', 'slack.com', 'zoom.us',
  // Entertainment
  'netflix.com', 'spotify.com', 'twitch.tv', 'tiktok.com',
  // Finance / E-commerce
  'paypal.com', 'stripe.com', 'shopify.com', 'ebay.com',
  'flipkart.com', 'razorpay.com', 'paytm.com',
  // Productivity
  'notion.so', 'dropbox.com', 'figma.com', 'canva.com',
  // Knowledge
  'wikipedia.org', 'stackoverflow.com',
  // Auth providers
  'auth0.com', 'okta.com', 'login.yahoo.com', 'login.live.com',
  'salesforce.com', 'box.com',
];

// ── Bad TLDs ─────────────────────────────────────────────────────────────────
const SUSPICIOUS_TLDS = [
  '.tk', '.ml', '.ga', '.cf', '.gq',
  '.xyz', '.top', '.club', '.work', '.click',
  '.link', '.download', '.zip', '.review',
  '.country', '.kim', '.stream', '.gdn',
  '.racing', '.loan', '.win', '.bid', '.trade',
  '.party', '.science', '.accountant', '.faith',
  '.men', '.date', '.cricket', '.info',
];

// ── Brand letter-swap spoofs ──────────────────────────────────────────────────
const BRAND_SPOOF_KEYWORDS = [
  'paypa1', 'g00gle', 'g0ogle', 'g00gl3', 'micros0ft', 'microsooft',
  'arnazon', 'arnaz0n', 'faceb00k', 'facebok', 'netfl1x', 'netfliix',
  'app1e', 'appl3', 'twltter', 'twiter',
  'apple-id', 'apple-support', 'secure-login', 'secure-signin',
  'account-verify', 'account-update', 'account-suspended',
  'update-billing', 'update-payment', 'password-reset',
  'confirm-identity', 'verify-identity', 'login-secure', 'signin-secure',
  'free-gift', 'click-reward', 'winner-claim', 'prize-claim',
];

// ── Brand names used in fake domain check ────────────────────────────────────
const BRAND_NAMES = [
  'paypal', 'apple', 'google', 'microsoft', 'amazon', 'facebook',
  'instagram', 'netflix', 'spotify', 'twitter', 'linkedin', 'whatsapp',
  'dropbox', 'icloud', 'outlook', 'onedrive', 'office', 'yahoo',
  'ebay', 'chase', 'wellsfargo', 'bankofamerica', 'citibank',
  'sbi', 'hdfc', 'icici', 'axis', 'paytm', 'razorpay',
];

// ── Suspicious path keywords ─────────────────────────────────────────────────
const SUSPICIOUS_PATHS = [
  'phish', 'hack', 'credential', 'steal', 'fake',
  'verify-account', 'secure-update', 'confirm-account',
  'update-info', 'signin-verify', 'account-suspended',
  'unusual-activity', 'billing-update', 'payment-failed',
  'reset-now', 'action-required', 'urgent-verify',
];

// ── Sensitive OAuth scopes ────────────────────────────────────────────────────
const SENSITIVE_SCOPES_MAP = {
  'mail.read': 15, 'mail.readwrite': 20, 'mail.send': 18,
  'files.read': 12, 'files.readwrite': 18, 'drive': 18,
  'contacts': 12, 'contacts.read': 12, 'calendars': 10, 'calendar': 10,
  'user.read.all': 15, 'offline_access': 14, 'admin': 25,
};

// ── Helper: is this domain (or its parent) trusted? ──────────────────────────
function isTrustedDomain(domain) {
  if (TRUSTED_DOMAINS.includes(domain)) return true;
  const parts = domain.split('.');
  if (parts.length >= 2) {
    const parent = parts.slice(-2).join('.');
    if (TRUSTED_DOMAINS.includes(parent)) return true;
  }
  if (parts.length >= 3) {
    const grand = parts.slice(-3).join('.');
    if (TRUSTED_DOMAINS.includes(grand)) return true;
  }
  return false;
}

/**
 * Main analysis function.
 * Returns { prob, verdict, score, reasons, attackType, compromisedData, domain }
 * prob  = 0.0–1.0 (for backward compat)
 * score = 0–100   (integer, same as Python backend)
 */
function analyzeURL(url) {
  const reasons = [];
  let score = 0;

  // ── Parse URL ─────────────────────────────────────────────────────────────
  let parsed;
  try {
    parsed = new URL(url.includes('://') ? url : 'https://' + url);
  } catch (e) {
    return {
      prob: 0.05, score: 5, verdict: 'Green',
      reasons: ['⚠️ Could not fully parse URL structure — treating as minimal risk.'],
      attackType: 'Parse Warning', compromisedData: ['Unknown'], domain: url,
    };
  }

  const domain   = parsed.hostname.toLowerCase();
  const path     = (parsed.pathname || '').toLowerCase();
  const queryStr = (parsed.search || '').toLowerCase();
  const fullUrl  = url.toLowerCase();
  const baseDomain = domain.split('.').slice(-2).join('.');
  const whitelisted = isTrustedDomain(domain);

  // ── CHECK 1: Trusted domain bonus ─────────────────────────────────────────
  if (whitelisted) {
    score -= 20;
    reasons.push(`✅ Verified & Trusted Domain — "${domain}" is a recognised, safe website.`);
  }

  // ── CHECK 2: Raw IP address ───────────────────────────────────────────────
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(domain)) {
    score += 45;
    reasons.push(`🚨 Raw IP Address — No domain name used. Hides the server's real identity.`);
  }

  // ── CHECK 3: Suspicious TLD ───────────────────────────────────────────────
  const badTld = SUSPICIOUS_TLDS.find(t => domain.endsWith(t));
  if (badTld && !whitelisted) {
    score += 25;
    reasons.push(`⚠️ High-Risk Domain Extension (.${badTld.replace('.','')}) — heavily used by phishing sites.`);
  }

  // ── CHECK 4: Letter-swap brand spoof ─────────────────────────────────────
  const spoofHit = BRAND_SPOOF_KEYWORDS.find(s => domain.includes(s));
  if (spoofHit) {
    score += 40;
    reasons.push(`🎭 Brand Impersonation — domain contains "${spoofHit}", a known phishing pattern.`);
  }

  // ── CHECK 5: Brand name inside unrelated domain ───────────────────────────
  if (!whitelisted && !spoofHit) {
    for (const brand of BRAND_NAMES) {
      if (domain.includes(brand) && !baseDomain.includes(brand)) {
        score += 35;
        reasons.push(`🎭 Fake "${brand[0].toUpperCase() + brand.slice(1)}" Site — uses brand name but is NOT the real site.`);
        break;
      }
    }
  }

  // ── CHECK 6: Excessive subdomains ─────────────────────────────────────────
  const subdomainCount = domain.split('.').length - 2;
  if (subdomainCount >= 3 && !whitelisted) {
    const delta = Math.min(20, subdomainCount * 5);
    score += delta;
    reasons.push(`⚠️ Deep Subdomains (${subdomainCount} levels) — used to disguise the real domain.`);
  }

  // ── CHECK 7: @ symbol in URL ──────────────────────────────────────────────
  if (url.includes('@')) {
    score += 50;
    reasons.push(`🚨 "@" Symbol in URL — hides the true destination. Everything before "@" is ignored.`);
  }

  // ── CHECK 8: URL length ───────────────────────────────────────────────────
  const urlLen = url.length;
  if (urlLen > 200) {
    score += 18;
    reasons.push(`⚠️ Very Long URL (${urlLen} chars) — phishing links are often padded with noise.`);
  } else if (urlLen > 120) {
    score += 6;
    reasons.push(`ℹ️ Long URL (${urlLen} chars) — slightly above average length.`);
  }

  // ── CHECK 9: Multi-hop redirect ───────────────────────────────────────────
  const redirectCount = (fullUrl.match(/redirect|return_to|next=|goto=/g) || []).length;
  if (redirectCount >= 2) {
    score += 40;
    reasons.push(`🚨 Chained Redirects (${redirectCount} redirect params) — sends you to a different site silently.`);
  }

  // ── CHECK 10: Suspicious path keywords ───────────────────────────────────
  const pathHit = SUSPICIOUS_PATHS.find(kw => path.includes(kw) || queryStr.includes(kw));
  if (pathHit) {
    score += 20;
    reasons.push(`⚠️ Suspicious Page Keyword ("${pathHit}") — common on fake login/verification pages.`);
  }

  // ── CHECK 11: Redirect destination analysis ───────────────────────────────
  const redirectMatch = queryStr.match(/redirect_uri=([^&]*)/i);
  if (redirectMatch) {
    try {
      const dest = decodeURIComponent(redirectMatch[1]);
      const destDomain = new URL(dest).hostname.toLowerCase();
      if (destDomain && destDomain !== domain) {
        if (isTrustedDomain(destDomain)) {
          reasons.push(`✅ Redirect goes to trusted site "${destDomain}".`);
        } else {
          score += 35;
          reasons.push(`🚨 Redirects to Unknown Site "${destDomain}" — classic data-theft technique.`);
        }
      }
    } catch (_) {}
  }

  // ── CHECK 12: Sensitive OAuth scopes ─────────────────────────────────────
  const scopeMatch = queryStr.match(/[?&]scope=([^&]*)/i);
  let scopeStr = '';
  let scopeDelta = 0;
  const scopeDescriptions = [];
  if (scopeMatch) {
    scopeStr = decodeURIComponent(scopeMatch[1]).toLowerCase();
    for (const [key, pts] of Object.entries(SENSITIVE_SCOPES_MAP)) {
      if (scopeStr.includes(key)) {
        scopeDelta += pts;
        scopeDescriptions.push(key);
      }
    }
    if (scopeDelta > 0) {
      score += scopeDelta;
      reasons.push(`⚠️ Dangerous OAuth Permissions: ${scopeDescriptions.join(', ')} — grants access to your private data.`);
    }
  }

  // ── CHECK 13: HTTPS vs HTTP ───────────────────────────────────────────────
  if (parsed.protocol === 'http:') {
    score += 18;
    reasons.push(`⚠️ No HTTPS Encryption — data you enter can be intercepted on the network.`);
  } else {
    reasons.push(`✅ HTTPS Enabled — connection is encrypted.`);
  }

  // ── CHECK 14: Punycode / homograph attack ─────────────────────────────────
  if (domain.includes('xn--')) {
    score += 40;
    reasons.push(`🚨 Internationalised Domain (Punycode) — uses look-alike characters to impersonate real sites.`);
  }

  // ── CHECK 15: Heavy URL encoding ─────────────────────────────────────────
  const pctCount = (url.match(/%/g) || []).length;
  if (pctCount > 8) {
    score += 15;
    reasons.push(`⚠️ Heavy URL Encoding (${pctCount} encoded chars) — used to disguise malicious URLs.`);
  }

  // ── Finalise ──────────────────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, score));
  const prob = score / 100;

  let verdict;
  if (score < 15) verdict = 'Green';
  else if (score < 40) verdict = 'Yellow';
  else if (score < 65) verdict = 'Orange';
  else verdict = 'Red';

  // Attack type
  let attackType;
  if (url.includes('@'))        attackType = 'Identity Spoofing';
  else if (redirectCount >= 2)  attackType = 'Chained Redirect Attack';
  else if (verdict === 'Red')   attackType = 'Phishing / Scam Site';
  else if (verdict === 'Orange')attackType = 'Suspicious Authorization Request';
  else if (verdict === 'Yellow')attackType = 'Minor Concerns';
  else                          attackType = 'Appears Safe';

  // Data at risk
  const compromisedData = [];
  if (scopeStr.includes('mail'))    compromisedData.push('Your Emails');
  if (scopeStr.includes('contact')) compromisedData.push('Your Contacts');
  if (scopeStr.includes('drive') || scopeStr.includes('files')) compromisedData.push('Your Files');
  if (scopeStr.includes('calendar'))compromisedData.push('Your Calendar');
  if (compromisedData.length === 0 && score >= 40) compromisedData.push('Your Password', 'Personal Information');
  if (compromisedData.length === 0) compromisedData.push('No specific data at risk');

  return { prob, score, verdict, reasons, attackType, compromisedData, domain };
}
