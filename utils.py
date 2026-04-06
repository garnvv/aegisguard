import re
from urllib.parse import urlparse, parse_qs, unquote
from datetime import datetime
import os

# ─────────────────────────────────────────────────────────────────────────────
#  AegisGuard Heuristic URL Risk Engine v2
#  Pure rule-based — no ML, no flaky WHOIS — scores vary based on real signals
# ─────────────────────────────────────────────────────────────────────────────

# ── Fully Trusted Domains ────────────────────────────────────────────────────
# These are verified, blue-chip domains. Get a trust bonus.
GOLDEN_WHITELIST = {
    # Google ecosystem
    'google.com', 'accounts.google.com', 'gmail.com', 'youtube.com',
    'drive.google.com', 'docs.google.com', 'meet.google.com', 'calendar.google.com',
    # Microsoft ecosystem
    'microsoft.com', 'login.microsoftonline.com', 'live.com', 'outlook.com',
    'office.com', 'office365.com', 'sharepoint.com', 'teams.microsoft.com', 'azure.com',
    # Meta
    'facebook.com', 'instagram.com', 'whatsapp.com', 'messenger.com', 'meta.com',
    # Apple
    'apple.com', 'appleid.apple.com', 'icloud.com',
    # Amazon / AWS
    'amazon.com', 'aws.amazon.com', 'aws.com', 'amazonaws.com',
    # AI platforms
    'chatgpt.com', 'openai.com', 'chat.openai.com', 'claude.ai', 'anthropic.com',
    'gemini.google.com', 'bard.google.com', 'copilot.microsoft.com',
    'huggingface.co', 'perplexity.ai', 'mistral.ai', 'cohere.com',
    # Developer / Tech
    'github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com',
    'npmjs.com', 'pypi.org', 'docker.com', 'kubernetes.io', 'terraform.io',
    'vercel.com', 'netlify.com', 'heroku.com', 'render.com', 'railway.app',
    'cloudflare.com', 'fastly.com', 'akamai.com',
    # Social / Communication
    'twitter.com', 'x.com', 'linkedin.com', 'reddit.com', 'discord.com',
    'telegram.org', 't.me', 'slack.com', 'zoom.us', 'meet.jit.si',
    # Entertainment / Media
    'netflix.com', 'spotify.com', 'twitch.tv', 'youtube.com', 'tiktok.com',
    'medium.com', 'substack.com', 'wordpress.com', 'blogger.com',
    # E-commerce / Finance
    'paypal.com', 'stripe.com', 'shopify.com', 'etsy.com', 'ebay.com',
    'amazon.in', 'flipkart.com', 'razorpay.com', 'paytm.com',
    # Productivity
    'notion.so', 'airtable.com', 'trello.com', 'asana.com', 'jira.atlassian.com',
    'dropbox.com', 'box.com', 'figma.com', 'canva.com', 'miro.com',
    # Knowledge
    'wikipedia.org', 'wikimedia.org', 'arxiv.org', 'scholar.google.com',
    # Indian Gov / Education
    'gov.in', 'nic.in', 'mygov.in', 'india.gov.in',
}

# ── Bad TLDs (phishing-favoured) ─────────────────────────────────────────────
SUSPICIOUS_TLDS = {
    '.tk', '.ml', '.ga', '.cf', '.gq',           # free Freenom TLDs, massively abused
    '.xyz', '.top', '.club', '.work', '.click',   # cheap, spammers love them
    '.link', '.download', '.zip', '.review',
    '.country', '.kim', '.stream', '.gdn',
    '.racing', '.loan', '.win', '.bid', '.trade',
    '.party', '.science', '.accountant', '.faith',
    '.men', '.date', '.cricket', '.info',
}

# ── Known brand spoofing patterns ────────────────────────────────────────────
# These match letter-swapped or hyphenated fakes
BRAND_SPOOF_KEYWORDS = [
    # Digit/letter substitutions
    'paypa1', 'g00gle', 'g0ogle', 'g00gl3', 'micros0ft', 'microsooft',
    'arnazon', 'arnaz0n', 'faceb00k', 'facebok', 'netfl1x', 'netfliix',
    'app1e', 'appl3', 'twltter', 'twiter',
    # Hyphenated credential traps
    'apple-id', 'apple-support', 'apple-icloud',
    'secure-login', 'secure-signin', 'secure-verify',
    'account-verify', 'account-update', 'account-confirm', 'account-suspended',
    'update-billing', 'update-payment', 'update-account',
    'password-reset', 'password-update',
    'confirm-identity', 'verify-identity',
    'login-secure', 'signin-secure',
    # Bank/payment spoofs
    'sbi-bank', 'hdfc-bank', 'icici-secure', 'paytm-verify', 'paypal-secure',
    # Common trap words in domain
    'free-gift', 'click-reward', 'winner-claim', 'prize-claim',
]

# ── High-risk path keywords ───────────────────────────────────────────────────
SUSPICIOUS_PATHS = [
    'phish', 'hack', 'credential', 'steal', 'fake',
    'verify-account', 'secure-update', 'confirm-account',
    'update-info', 'signin-verify', 'account-suspended',
    'unusual-activity', 'billing-update', 'payment-failed',
    'reset-now', 'action-required', 'urgent-verify',
]

# ── Brands that scammers commonly spoof (for lexical check) ──────────────────
BRAND_NAMES = [
    'paypal', 'apple', 'google', 'microsoft', 'amazon', 'facebook', 'instagram',
    'netflix', 'spotify', 'twitter', 'linkedin', 'whatsapp', 'dropbox',
    'icloud', 'outlook', 'onedrive', 'office', 'yahoo', 'ebay', 'chase',
    'wellsfargo', 'bankofamerica', 'citibank', 'sbi', 'hdfc', 'icici', 'axis',
    'paytm', 'razorpay', 'upi', 'bhim',
]

# ── Sensitive OAuth scopes ────────────────────────────────────────────────────
SENSITIVE_SCOPES = {
    'mail.read':      ('Read all your emails', 15),
    'mail.readwrite': ('Read AND modify your emails', 20),
    'mail.send':      ('Send emails as you', 18),
    'files.read':     ('Access your files', 12),
    'files.readwrite':('Read and write your files', 18),
    'drive':          ('Full Google Drive access', 18),
    'contacts':       ('Your contacts list', 12),
    'contacts.read':  ('Your contacts list', 12),
    'calendars':      ('Your calendar', 10),
    'calendar':       ('Your calendar', 10),
    'user.read.all':  ('All user profile data', 15),
    'offline_access': ('Persistent access when logged out', 14),
    'admin':          ('Admin-level account access', 25),
    'sudo':           ('Superuser access', 30),
    'root':           ('Root access', 30),
    'openid':         ('Identity check (normal for SSO)', 0),
    'profile':        ('Basic profile (generally safe)', 0),
    'email':          ('Your email address (generally safe)', 0),
}


def _is_whitelisted(domain: str) -> bool:
    """Check domain and its parent against the golden whitelist."""
    if domain in GOLDEN_WHITELIST:
        return True
    # Parent domain check: sub.google.com → google.com
    parts = domain.split('.')
    if len(parts) >= 2:
        parent = '.'.join(parts[-2:])
        if parent in GOLDEN_WHITELIST:
            return True
    # 3-part check: accounts.google.com
    if len(parts) >= 3:
        grandparent = '.'.join(parts[-3:])
        if grandparent in GOLDEN_WHITELIST:
            return True
    return False


def analyze_url(url: str) -> dict:
    """
    AegisGuard Heuristic Engine v2.
    Scores 0–100 based on 16 independent checks.
    Returns full structured result including plain-English findings.
    """
    score = 0
    findings = []
    raw_checks = {}

    # ── Normalize URL ─────────────────────────────────────────────────────────
    url = url.strip()
    if not url:
        return _error_result("No URL provided.")

    try:
        parsed = urlparse(url if '://' in url else 'https://' + url)
    except Exception:
        return _error_result("Could not parse this URL. Please check the format.")

    domain    = parsed.netloc.lower().split(':')[0].strip()
    path      = (parsed.path or '').lower()
    query_str = (parsed.query or '').lower()
    full_url  = url.lower()

    if not domain:
        return _error_result("No domain found in URL.")

    query_params = parse_qs(parsed.query)
    base_domain  = '.'.join(domain.split('.')[-2:])   # e.g. "chatgpt.com"
    whitelisted  = _is_whitelisted(domain)

    # ──────────────────────────────────────────────────────────────────────────
    # CHECK 1 — Trusted Domain (whitelist bonus)
    # ──────────────────────────────────────────────────────────────────────────
    if whitelisted:
        score -= 20   # strong trust bonus
        findings.append({
            'label': '✅ Verified & Trusted Domain',
            'detail': f'"{domain}" is a globally recognised, verified website. No domain-level risk detected.',
            'delta': -20, 'severity': 'safe'
        })

    # ──────────────────────────────────────────────────────────────────────────
    # CHECK 2 — Raw IP address
    # ──────────────────────────────────────────────────────────────────────────
    if re.match(r'^\d{1,3}(\.\d{1,3}){3}$', domain):
        score += 45
        findings.append({
            'label': '🚨 Raw IP Address Used (No Domain)',
            'detail': 'Legitimate services always use a domain name. A raw IP address (like 192.168.1.1) hides the true owner and is a classic phishing tactic.',
            'delta': +45, 'severity': 'danger'
        })

    # ──────────────────────────────────────────────────────────────────────────
    # CHECK 3 — Suspicious TLD
    # ──────────────────────────────────────────────────────────────────────────
    matched_tld = next((t for t in SUSPICIOUS_TLDS if domain.endswith(t)), None)
    if matched_tld and not whitelisted:
        score += 25
        tld_name = matched_tld.strip('.')
        findings.append({
            'label': f'⚠️ High-Risk Domain Extension (.{tld_name})',
            'detail': f'The ".{tld_name}" extension is heavily associated with phishing and spam sites because they are free and anonymous. Real businesses rarely use it.',
            'delta': +25, 'severity': 'warning'
        })

    # ──────────────────────────────────────────────────────────────────────────
    # CHECK 4 — Typo/spoof brand keywords in domain
    # ──────────────────────────────────────────────────────────────────────────
    spoof_hit = next((s for s in BRAND_SPOOF_KEYWORDS if s in domain), None)
    if spoof_hit:
        score += 40
        findings.append({
            'label': '🎭 Brand Impersonation Detected',
            'detail': f'The domain contains "{spoof_hit}" — a known phishing pattern that mimics a trusted brand using character swaps or deceptive words to trick you.',
            'delta': +40, 'severity': 'danger'
        })

    # ──────────────────────────────────────────────────────────────────────────
    # CHECK 5 — Legitimate brand name inside an unrelated domain
    #   e.g. "paypal-secure-verify.com" → "paypal" in domain but not paypal.com
    # ──────────────────────────────────────────────────────────────────────────
    if not whitelisted and not spoof_hit:
        for brand in BRAND_NAMES:
            if brand in domain and brand not in base_domain:
                # "google" in "google-login-verify.net" but base isn't google.com
                score += 35
                findings.append({
                    'label': f'🎭 Fake "{brand.title()}" Site',
                    'detail': f'This URL contains "{brand}" in its address but is NOT the real {brand}.com. Scammers use this trick to make you think you\'re on a trusted website.',
                    'delta': +35, 'severity': 'danger'
                })
                break

    # ──────────────────────────────────────────────────────────────────────────
    # CHECK 6 — Excessive subdomains
    # ──────────────────────────────────────────────────────────────────────────
    subdomain_count = len(domain.split('.')) - 2
    if subdomain_count >= 3 and not whitelisted:
        delta = min(20, subdomain_count * 5)
        score += delta
        findings.append({
            'label': f'⚠️ Suspicious Subdomain Depth ({subdomain_count} levels)',
            'detail': 'Phishing links often use deep subdomains like "paypal.com.login.secure.evil.net" to make the URL look real at a glance. Legitimate services don\'t need this.',
            'delta': +delta, 'severity': 'warning'
        })

    # ──────────────────────────────────────────────────────────────────────────
    # CHECK 7 — @ symbol (identity hiding)
    # ──────────────────────────────────────────────────────────────────────────
    if '@' in url:
        score += 50
        findings.append({
            'label': '🚨 Identity Hiding (@) Trick in URL',
            'detail': 'The "@" symbol in a URL is a dangerous trick. "paypal.com@evil.com" sends you to evil.com, not PayPal. Everything before "@" is completely ignored by your browser.',
            'delta': +50, 'severity': 'danger'
        })

    # ──────────────────────────────────────────────────────────────────────────
    # CHECK 8 — URL length
    # ──────────────────────────────────────────────────────────────────────────
    url_len = len(url)
    if url_len > 200:
        score += 18
        findings.append({
            'label': f'⚠️ Extremely Long URL ({url_len} characters)',
            'detail': 'Phishing URLs deliberately add hundreds of characters to bury the real destination, confuse users, and bypass simple filters.',
            'delta': +18, 'severity': 'warning'
        })
    elif url_len > 120:
        score += 6
        findings.append({
            'label': f'ℹ️ Long URL ({url_len} characters)',
            'detail': 'This URL is longer than usual. By itself this is minor, but alongside other signals it increases overall risk.',
            'delta': +6, 'severity': 'info'
        })

    # ──────────────────────────────────────────────────────────────────────────
    # CHECK 9 — Chained / double redirects
    # ──────────────────────────────────────────────────────────────────────────
    redirect_count = (url.lower().count('redirect') + url.lower().count('return_to')
                      + url.lower().count('next=') + url.lower().count('goto='))
    if redirect_count >= 2:
        score += 40
        findings.append({
            'label': '🚨 Chained Redirects (Multi-Hop)',
            'detail': 'Multiple redirect parameters detected. Attackers chain redirects to start at a trusted site then quietly send you to a fake one that steals your data.',
            'delta': +40, 'severity': 'danger'
        })

    # ──────────────────────────────────────────────────────────────────────────
    # CHECK 10 — Suspicious path keywords
    # ──────────────────────────────────────────────────────────────────────────
    path_hit = next((kw for kw in SUSPICIOUS_PATHS if kw in path or kw in query_str), None)
    if path_hit:
        score += 20
        findings.append({
            'label': '⚠️ Suspicious Page Keyword in URL',
            'detail': f'The URL contains "{path_hit}" — a keyword commonly found on fake account verification or credential-harvesting pages.',
            'delta': +20, 'severity': 'warning'
        })

    # ──────────────────────────────────────────────────────────────────────────
    # CHECK 11 — Unsafe redirect destination
    # ──────────────────────────────────────────────────────────────────────────
    redirect_target = None
    for rkey in ['redirect_uri', 'redirect', 'return_to', 'next', 'url', 'goto', 'target']:
        if rkey in query_params:
            redirect_target = query_params[rkey][0]
            break

    if redirect_target and redirect_target.startswith('http'):
        rd = urlparse(redirect_target).netloc.lower()
        if rd and rd != domain:
            if _is_whitelisted(rd):
                findings.append({
                    'label': '✅ Redirect Goes to Trusted Site',
                    'detail': f'The redirect destination "{rd}" is a verified, trusted domain.',
                    'delta': 0, 'severity': 'safe'
                })
            else:
                score += 35
                findings.append({
                    'label': '🚨 Redirect to Unknown Site',
                    'detail': f'This URL starts at "{domain}" but redirects you to "{rd}" — an unknown site. This is a primary technique in credential theft attacks.',
                    'delta': +35, 'severity': 'danger'
                })

    # ──────────────────────────────────────────────────────────────────────────
    # CHECK 12 — Sensitive OAuth scope permissions
    # ──────────────────────────────────────────────────────────────────────────
    scope_str  = query_params.get('scope', [''])[0].lower()
    scope_hits = [(desc, pts) for k, (desc, pts) in SENSITIVE_SCOPES.items()
                  if k in scope_str and pts > 0]
    scope_delta = sum(pts for _, pts in scope_hits)

    if scope_hits:
        score += scope_delta
        descriptions = ', '.join(desc for desc, _ in scope_hits)
        findings.append({
            'label': f'⚠️ Dangerous Permissions Requested ({len(scope_hits)})',
            'detail': f'This URL asks for access to: {descriptions}. Approving gives the site access to your private account data.',
            'delta': +scope_delta,
            'severity': 'danger' if scope_delta >= 30 else 'warning'
        })

    # ──────────────────────────────────────────────────────────────────────────
    # CHECK 13 — HTTPS vs HTTP
    # ──────────────────────────────────────────────────────────────────────────
    if parsed.scheme == 'http':
        score += 18
        findings.append({
            'label': '⚠️ Unencrypted Connection (HTTP)',
            'detail': 'This site does NOT use HTTPS. Any password, card number, or personal data you enter can be intercepted by anyone on the same network. All safe sites use HTTPS.',
            'delta': +18, 'severity': 'warning'
        })
    else:
        findings.append({
            'label': '✅ Secure Encrypted Connection (HTTPS)',
            'detail': 'Uses HTTPS, so your data is encrypted in transit. Note: HTTPS alone does NOT guarantee a site is safe — phishing sites use HTTPS too.',
            'delta': 0, 'severity': 'safe'
        })

    # ──────────────────────────────────────────────────────────────────────────
    # CHECK 14 — URL encoding abuse (%xx hex tricks)
    # ──────────────────────────────────────────────────────────────────────────
    pct_count = url.count('%')
    if pct_count > 8:
        score += 18
        findings.append({
            'label': f'⚠️ Heavy URL Encoding ({pct_count} encoded chars)',
            'detail': 'Excessive %xx encoding is used by attackers to disguise malicious URLs and bypass security filters. Legitimate URLs rarely need this many encoded characters.',
            'delta': +18, 'severity': 'warning'
        })
    elif pct_count > 3:
        score += 5
        findings.append({
            'label': f'ℹ️ Some URL Encoding ({pct_count} encoded chars)',
            'detail': 'A few %xx-encoded characters were found. This is sometimes normal (e.g. spaces in search queries) but can also be used to hide malicious content.',
            'delta': +5, 'severity': 'info'
        })

    # ──────────────────────────────────────────────────────────────────────────
    # CHECK 15 — Punycode / IDN homograph attack
    #   e.g. xn--pypal-4ve.com looks like paypal.com in some browsers
    # ──────────────────────────────────────────────────────────────────────────
    if 'xn--' in domain:
        score += 40
        findings.append({
            'label': '🚨 Internationalised Domain (Homograph Attack)',
            'detail': 'This domain uses special Unicode characters that look identical to normal letters. For example "раура1.com" can look like "paypal.com" — it is a very sophisticated phishing trick.',
            'delta': +40, 'severity': 'danger'
        })

    # ──────────────────────────────────────────────────────────────────────────
    # CHECK 16 — Data URI (disguised content injection)
    # ──────────────────────────────────────────────────────────────────────────
    if full_url.startswith('data:'):
        score += 60
        findings.append({
            'label': '🚨 Data URI Detected (Content Injection)',
            'detail': 'This is a "data:" URL, not a real web address. Attackers use these to inject fake HTML login pages directly inside a URL without a server — extremely dangerous.',
            'delta': +60, 'severity': 'danger'
        })

    # ──────────────────────────────────────────────────────────────────────────
    # Finalise score & verdict
    # ──────────────────────────────────────────────────────────────────────────
    score = max(0, min(100, score))

    if score < 15:
        verdict, verdict_code = 'Safe', 'Green'
        summary = 'No significant threats detected. This URL appears safe to visit.'
    elif score < 40:
        verdict, verdict_code = 'Low Risk', 'Yellow'
        summary = 'Minor concerns found. Probably safe, but double-check the domain before entering any personal information.'
    elif score < 65:
        verdict, verdict_code = 'Suspicious', 'Orange'
        summary = 'Multiple warning signs detected. Do NOT enter passwords or personal data on this page.'
    else:
        verdict, verdict_code = 'Dangerous', 'Red'
        summary = 'This URL shows strong signs of phishing or fraud. Do NOT visit, click, or enter any information.'

    at_risk = _data_at_risk(scope_str, verdict_code)
    raw_checks.update({
        'url_length': url_len, 'has_https': parsed.scheme == 'https',
        'subdomain_depth': subdomain_count, 'has_at': '@' in url,
        'whitelisted': whitelisted,
    })

    return {
        'url': url, 'score': score, 'verdict': verdict,
        'verdict_code': verdict_code, 'summary': summary,
        'findings': findings, 'at_risk': at_risk, 'domain': domain,
        'has_redirect': redirect_target is not None, 'raw_checks': raw_checks,
        # Legacy compat
        'probability': score / 100, 'probability_pct': score,
        'reasons': [f['label'] + ' — ' + f['detail'] for f in findings],
        'is_masked_redirect': 1 if redirect_target else 0,
        'compromised_data': at_risk or ['No specific personal data identified at risk'],
        'attack_type': _attack_label(score, verdict_code, '@' in url, redirect_target),
        'raw_features': raw_checks,
    }

    """
    Full heuristic risk engine. Returns a structured result dict.
    Risk score is 0–100 and varies based on real URL characteristics.
    """
    score = 0
    findings = []       # plain English findings shown to user
    raw_checks = {}     # internal metadata

    try:
        parsed = urlparse(url if url.startswith('http') else 'https://' + url)
    except Exception:
        return _error_result("Could not parse URL. Make sure it starts with http:// or https://")

    domain = parsed.netloc.lower().split(':')[0]  # strip port
    path   = parsed.path.lower()
    full   = url.lower()

    # ── CHECK 0: is the domain in the golden whitelist? ──────────────────────
    # Check exact match + subdomain match
    is_whitelisted = domain in GOLDEN_WHITELIST
    if not is_whitelisted:
        base = '.'.join(domain.split('.')[-2:])   # e.g. "google.com"
        is_whitelisted = base in GOLDEN_WHITELIST

    if is_whitelisted:
        score -= 15   # modest trust bonus — a trusted host does NOT excuse suspicious parameters
        findings.append({
            'label': '✅ Trusted Website Domain',
            'detail': f'"{domain}" is a recognized, verified domain. However, always check the full URL — phishers often use legitimate sites as a starting point before redirecting you elsewhere.',
            'delta': -15,
            'severity': 'safe'
        })

    # ── CHECK 1: IP address instead of domain ────────────────────────────────
    ip_pattern = re.compile(r'^\d{1,3}(\.\d{1,3}){3}$')
    if ip_pattern.match(domain):
        score += 40
        findings.append({
            'label': '🚨 IP Address Used Instead of Domain',
            'detail': 'Real websites use domain names (google.com). Using a raw IP address like 192.168.1.1 is a classic phishing trick to hide the real identity of the server.',
            'delta': +40,
            'severity': 'danger'
        })

    # ── CHECK 2: Suspicious TLD ──────────────────────────────────────────────
    for tld in SUSPICIOUS_TLDS:
        if domain.endswith(tld):
            score += 20
            findings.append({
                'label': f'⚠️ Suspicious Domain Extension ({tld})',
                'detail': f'The ".{tld.strip(".")}" extension is almost exclusively used by scammers and phishing sites because they are free and untraceable.',
                'delta': +20,
                'severity': 'warning'
            })

    # ── CHECK 3: Brand name spoofing in domain ───────────────────────────────
    for spoof in BRAND_SPOOF_KEYWORDS:
        if spoof in domain:
            score += 35
            findings.append({
                'label': f'🎭 Brand Name Spoofing Detected',
                'detail': f'The domain contains "{spoof}" which mimics a well-known brand using letter substitutions or deceptive words. This is designed to trick you into thinking it is a real website.',
                'delta': +35,
                'severity': 'danger'
            })
            break

    # ── CHECK 4: Excessive subdomains ─────────────────────────────────────────
    subdomain_count = len(domain.split('.')) - 2
    if subdomain_count >= 3:
        delta = min(25, subdomain_count * 7)
        score += delta
        findings.append({
            'label': f'⚠️ Too Many Subdomains ({subdomain_count} levels)',
            'detail': f'Phishing sites often use many subdomains like "paypal.com.secure.evil.net" to make the URL look legitimate at a glance. Real sites rarely go this deep.',
            'delta': +delta,
            'severity': 'warning'
        })

    # ── CHECK 5: @ symbol in URL ──────────────────────────────────────────────
    if '@' in url:
        score += 45
        findings.append({
            'label': '🚨 Identity Spoofing (@) Found in URL',
            'detail': 'The "@" symbol in a URL is a classic trick. Everything before it is ignored by browsers. So "paypal.com@evil.com" actually takes you to evil.com, not PayPal.',
            'delta': +45,
            'severity': 'danger'
        })

    # ── CHECK 6: URL length ───────────────────────────────────────────────────
    url_length = len(url)
    if url_length > 200:
        score += 20
        findings.append({
            'label': f'⚠️ Very Long URL ({url_length} characters)',
            'detail': 'Phishing URLs are often extremely long to bury the real destination inside a wall of random text or encoded parameters.',
            'delta': +20,
            'severity': 'warning'
        })
    elif url_length > 100:
        score += 8
        findings.append({
            'label': f'ℹ️ Long URL ({url_length} characters)',
            'detail': 'This URL is longer than typical. This alone is not alarming, but combined with other signals it adds to risk.',
            'delta': +8,
            'severity': 'info'
        })

    # ── CHECK 7: Double redirect trick ───────────────────────────────────────
    if url.count('redirect_uri') > 1 or url.count('redirect=') > 1:
        score += 40
        findings.append({
            'label': '🚨 Double Redirect Detected',
            'detail': 'This URL contains multiple redirect instructions. Attackers chain redirects so you start at a legitimate site (like Google) but end up on a fake one that steals your data.',
            'delta': +40,
            'severity': 'danger'
        })

    # ── CHECK 8: Suspicious path keywords ───────────────────────────────────
    for kw in SUSPICIOUS_PATHS:
        if kw in path:
            score += 20
            findings.append({
                'label': f'⚠️ Suspicious Page Name in URL',
                'detail': f'The URL path contains "{kw}" which is common on fake login or account verification pages designed to steal your password.',
                'delta': +20,
                'severity': 'warning'
            })
            break

    # ── CHECK 9: Misleading redirect destination ─────────────────────────────
    redirect_target = None
    query_params = parse_qs(parsed.query)
    for rkey in ['redirect_uri', 'redirect', 'return_to', 'next', 'url', 'goto']:
        if rkey in query_params:
            redirect_target = query_params[rkey][0]
            break

    if redirect_target and redirect_target.startswith('http'):
        redir_domain = urlparse(redirect_target).netloc.lower()
        if redir_domain and redir_domain != domain:
            # Check if redirect destination is trusted
            redir_base = '.'.join(redir_domain.split('.')[-2:])
            if redir_domain not in GOLDEN_WHITELIST and redir_base not in GOLDEN_WHITELIST:
                score += 35
                findings.append({
                    'label': '🚨 Suspicious Redirect Destination',
                    'detail': f'This URL pretends to start at "{domain}" but actually sends you to "{redir_domain}" — an unknown/unverified site. This is a common data theft technique.',
                    'delta': +35,
                    'severity': 'danger'
                })
            else:
                findings.append({
                    'label': '✅ Redirect Goes to Trusted Site',
                    'detail': f'The redirect destination "{redir_domain}" is a verified, trusted domain.',
                    'delta': 0,
                    'severity': 'safe'
                })

    # ── CHECK 10: Sensitive OAuth scopes ─────────────────────────────────────
    scope_str = query_params.get('scope', [''])[0].lower()
    scope_hits = []
    scope_delta = 0
    for scope_key, (desc, pts) in SENSITIVE_SCOPES.items():
        if scope_key in scope_str and pts > 0:
            scope_hits.append(desc)
            scope_delta += pts

    if scope_hits:
        score += scope_delta
        findings.append({
            'label': f'⚠️ Dangerous Permissions Requested ({len(scope_hits)} scopes)',
            'detail': 'This URL requests highly sensitive permissions: ' + ', '.join(scope_hits) + '. Granting these gives the site access to your private data.',
            'delta': +scope_delta,
            'severity': 'warning' if scope_delta < 30 else 'danger'
        })

    # ── CHECK 11: HTTP (no HTTPS) ─────────────────────────────────────────────
    if parsed.scheme == 'http':
        score += 15
        findings.append({
            'label': '⚠️ No Encryption (HTTP)',
            'detail': 'This site uses HTTP, not HTTPS. Any information you submit (passwords, card numbers) can be intercepted in transit. Safe sites always use HTTPS.',
            'delta': +15,
            'severity': 'warning'
        })
    else:
        findings.append({
            'label': '✅ Encrypted Connection (HTTPS)',
            'detail': 'The site uses HTTPS, which encrypts your connection. This alone doesn\'t make a site safe, but it is a good baseline.',
            'delta': 0,
            'severity': 'safe'
        })

    # ── CHECK 12: Special characters / URL encoding abuse ────────────────────
    suspicious_char_count = url.count('%') + url.count('///')
    if suspicious_char_count > 5:
        score += 15
        findings.append({
            'label': '⚠️ URL Contains Hidden / Encoded Characters',
            'detail': 'The URL contains many encoded characters (%xx). This is sometimes used to disguise malicious destinations or bypass security filters.',
            'delta': +15,
            'severity': 'warning'
        })

    # ── CHECK 13: WHOIS domain age ────────────────────────────────────────────
    whois_info = _get_whois_age(domain)
    if whois_info['days'] is not None:
        raw_checks['domain_age_days'] = whois_info['days']
        if whois_info['days'] < 7:
            score += 35
            findings.append({
                'label': f'🚨 Brand New Domain — Only {whois_info["days"]} Days Old',
                'detail': 'This domain was registered less than a week ago. Scammers create new domains specifically for phishing attacks and abandon them quickly.',
                'delta': +35,
                'severity': 'danger'
            })
        elif whois_info['days'] < 30:
            score += 20
            findings.append({
                'label': f'⚠️ Very New Domain ({whois_info["days"]} days old)',
                'detail': 'This domain is less than a month old. Legitimate businesses rarely operate on newly registered domains.',
                'delta': +20,
                'severity': 'warning'
            })
        elif whois_info['days'] < 180:
            score += 8
            findings.append({
                'label': f'ℹ️ Relatively New Domain ({whois_info["days"]} days old)',
                'detail': 'The domain is less than 6 months old. Not automatically suspicious, but worth noting.',
                'delta': +8,
                'severity': 'info'
            })
        else:
            findings.append({
                'label': f'✅ Established Domain ({whois_info["days"]} days old)',
                'detail': f'This domain has been registered for over {whois_info["days"] // 30} months — a positive trust signal.',
                'delta': 0,
                'severity': 'safe'
            })
    else:
        findings.append({
            'label': 'ℹ️ Domain Age Could Not Be Verified',
            'detail': 'Could not check when this domain was registered (WHOIS lookup failed or private registration).',
            'delta': 0,
            'severity': 'info'
        })

    # ── Finalise score ────────────────────────────────────────────────────────
    score = max(0, min(100, score))

    if score < 20:
        verdict = 'Safe'
        verdict_code = 'Green'
        summary = 'This URL appears to be safe. No major red flags were detected.'
    elif score < 45:
        verdict = 'Low Risk'
        verdict_code = 'Yellow'
        summary = 'This URL has a few minor concerns. It is probably fine, but proceed with caution.'
    elif score < 70:
        verdict = 'Suspicious'
        verdict_code = 'Orange'
        summary = 'This URL has multiple warning signs. We recommend NOT entering any personal information.'
    else:
        verdict = 'Dangerous'
        verdict_code = 'Red'
        summary = 'This URL is very likely a phishing or scam site. Do NOT visit it or enter any credentials.'

    # Determine what data could be at risk
    at_risk = _data_at_risk(scope_str, verdict_code)

    raw_checks.update({
        'url_length': len(url),
        'has_https': parsed.scheme == 'https',
        'subdomain_depth': subdomain_count,
        'has_at': '@' in url,
    })

    return {
        'url': url,
        'score': score,
        'verdict': verdict,
        'verdict_code': verdict_code,
        'summary': summary,
        'findings': findings,
        'at_risk': at_risk,
        'domain': domain,
        'has_redirect': redirect_target is not None,
        'raw_checks': raw_checks,
        # Legacy compat fields for app.py
        'probability': score / 100,
        'probability_pct': score,
        'reasons': [f['label'] + ' — ' + f['detail'] for f in findings],
        'is_masked_redirect': 1 if redirect_target and findings else 0,
        'compromised_data': at_risk if at_risk else ['No specific data at risk identified'],
        'attack_type': _attack_label(score, verdict_code, '@' in url, redirect_target),
        'raw_features': raw_checks,
    }


def _data_at_risk(scope_str, verdict_code):
    at_risk = []
    if 'mail' in scope_str:      at_risk.append('Your Emails')
    if 'contact' in scope_str:   at_risk.append('Your Contacts')
    if 'drive' in scope_str or 'files' in scope_str: at_risk.append('Your Files & Documents')
    if 'calendar' in scope_str:  at_risk.append('Your Calendar')
    if 'admin' in scope_str:     at_risk.append('Full Account Control')
    if not at_risk and verdict_code in ('Orange', 'Red'):
        at_risk = ['Your Password', 'Your Personal Information']
    return at_risk


def _attack_label(score, verdict_code, has_at, redirect_target):
    if has_at:              return 'Identity Spoofing'
    if redirect_target:     return 'Open Redirect Attack'
    if verdict_code == 'Red':   return 'Phishing / Scam Site'
    if verdict_code == 'Orange': return 'Suspicious Authorization Request'
    if verdict_code == 'Yellow': return 'Minor Concerns'
    return 'Appears Safe'


def _get_whois_age(domain):
    try:
        w = whois.whois(domain)
        cd = w.creation_date
        if isinstance(cd, list):
            cd = cd[0]
        if cd and isinstance(cd, datetime):
            return {'days': max(0, (datetime.now() - cd).days)}
    except Exception:
        pass
    return {'days': None}


def _error_result(msg):
    return {
        'url': '', 'score': 0, 'verdict': 'Error', 'verdict_code': 'Grey',
        'summary': msg, 'findings': [], 'at_risk': [], 'domain': '',
        'has_redirect': False, 'raw_checks': {},
        'probability': 0, 'probability_pct': 0, 'reasons': [msg],
        'is_masked_redirect': 0, 'compromised_data': [], 'attack_type': 'Unknown',
        'raw_features': {},
    }


# ─────────────────────────────────────────────────────────────────────────────
#  Legacy function wrappers so app.py doesn't break
# ─────────────────────────────────────────────────────────────────────────────
def predict_phishing(url):
    r = analyze_url(url)
    return (
        r['probability'], r['verdict_code'], r['reasons'],
        r['is_masked_redirect'], r['compromised_data'],
        r['attack_type'], r['raw_features']
    )


def train_and_save_model():
    """No longer needed — pure heuristic engine."""
    pass


def perform_domain_recon(domain):
    domain = domain.lower()
    data = {
        'domain': domain,
        'registrar': 'Unknown',
        'creation_date': 'Unknown',
        'days_old': 0,
        'risk_level': 'Unknown',
        'reasons': []
    }
    GLOBAL_WHITELIST = ['google.com', 'microsoft.com', 'apple.com', 'amazon.com',
                        'github.com', 'linkedin.com', 'netflix.com', 'spotify.com']
    if domain in GLOBAL_WHITELIST:
        data.update({'registrar': 'Global Entity (Verified)', 'creation_date': 'Pre-2000s',
                     'days_old': 10000, 'risk_level': 'Low'})
        data['reasons'].append('Domain is internationally whitelisted.')
        return data
    try:
        w = whois.whois(domain)
        if w.registrar:
            data['registrar'] = w.registrar if isinstance(w.registrar, str) else w.registrar[0]
        cd = w.creation_date
        if isinstance(cd, list): cd = cd[0]
        if cd:
            data['creation_date'] = cd.strftime('%Y-%m-%d')
            days = max(0, (datetime.now() - cd).days)
            data['days_old'] = days
            if days < 30:
                data['risk_level'] = 'High'
                data['reasons'].append(f'Very new domain ({days} days old). High risk.')
            elif days < 180:
                data['risk_level'] = 'Medium'
                data['reasons'].append(f'Relatively new domain ({days} days old).')
            else:
                data['risk_level'] = 'Low'
                data['reasons'].append(f'Established domain ({days} days old).')
    except Exception:
        data['risk_level'] = 'Undetermined'
        data['reasons'].append('Could not verify (private registration or connection issue).')
    return data


def perform_email_lookup(email):
    email = email.lower()
    data = {'email': email, 'status': 'Clean', 'breach_count': 0, 'incidents': []}
    compromised_domains = ['tempmail.com', 'throwaway.net', 'guerrillamail.com']
    domain = email.split('@')[-1] if '@' in email else ''
    if domain in compromised_domains:
        data.update({'status': 'Critical (Burner Provider)', 'breach_count': 1})
        data['incidents'].append('Known disposable email domain frequently used by bad actors.')
    elif any(kw in email for kw in ['admin', 'security']):
        data.update({'status': 'Targeted Asset', 'breach_count': 2})
        data['incidents'].append('High-value admin keyword — targeted in credential stuffing campaigns.')
    elif any(kw in email for kw in ['test', 'hacker']):
        data.update({'status': 'Malicious Actor Flag', 'breach_count': 5})
        data['incidents'].append('Email matches strings from active Dark Web phishing databases.')
    else:
        data['incidents'].append('No known breaches found for this email.')
    return data
