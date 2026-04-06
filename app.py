from flask import Flask, render_template, request, redirect, url_for, session, flash, g, jsonify, send_file
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, User, OAuth, OTPToken, ScanHistory
from utils import predict_phishing, perform_domain_recon, perform_email_lookup
from dotenv import load_dotenv
from flask_mail import Mail, Message
import uuid
import os
import random
import string
from datetime import datetime

# Load .env credentials
load_dotenv()

# Flask-Dance imports
from flask_dance.contrib.google import make_google_blueprint, google
from flask_dance.contrib.github import make_github_blueprint, github
from flask_dance.consumer import oauth_authorized
from flask_dance.consumer.storage.sqla import SQLAlchemyStorage
from sqlalchemy.orm.exc import NoResultFound

app = Flask(__name__)
# Use a strong random secret key from env in production
# Fallback only for local development — NEVER deploy without setting SECRET_KEY
app.secret_key = os.getenv('SECRET_KEY', 'super_secret_cyber_key_random_bits_dev_only')

# Allow OAuth over HTTP only in local dev (never in production)
if os.getenv('FLASK_ENV') == 'development' or os.getenv('OAUTHLIB_INSECURE_TRANSPORT') == '1':
    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

# Database Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///database.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# ─────────────────────────────────────────────
#  Flask-Mail Configuration (SMTP for OTP)
# ─────────────────────────────────────────────
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'True').lower() == 'true'
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME', '')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD', '')
app.config['MAIL_DEFAULT_SENDER'] = ('AegisGuard.AI', os.getenv('MAIL_USERNAME', ''))

db.init_app(app)
mail = Mail(app)

# ─────────────────────────────────────────────
#  Google OAuth Blueprint
# ─────────────────────────────────────────────
google_bp = make_google_blueprint(
    client_id=os.getenv('GOOGLE_CLIENT_ID'),
    client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
    scope=['openid', 'https://www.googleapis.com/auth/userinfo.email',
           'https://www.googleapis.com/auth/userinfo.profile'],
    storage=SQLAlchemyStorage(OAuth, db.session, user=lambda: g.user, user_required=False),
    redirect_url='/social/google/complete'
)
app.register_blueprint(google_bp, url_prefix='/login')

# ─────────────────────────────────────────────
#  GitHub OAuth Blueprint
# ─────────────────────────────────────────────
github_bp = make_github_blueprint(
    client_id=os.getenv('GITHUB_CLIENT_ID'),
    client_secret=os.getenv('GITHUB_CLIENT_SECRET'),
    scope='user:email',
    storage=SQLAlchemyStorage(OAuth, db.session, user=lambda: g.user, user_required=False),
    redirect_url='/social/github/complete'
)
app.register_blueprint(github_bp, url_prefix='/login')


# ─────────────────────────────────────────────
#  Cache Control
# ─────────────────────────────────────────────
@app.after_request
def add_header(response):
    # Prevent ALL caching including browser back-forward cache (bfcache)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, private, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    response.headers["Vary"] = "Cookie"
    return response


# ─────────────────────────────────────────────
#  Session Security Middleware
# ─────────────────────────────────────────────
@app.before_request
def check_security_key():
    g.user = None
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        if user and 'security_key' in session and user.security_key == session['security_key']:
            g.user = user
        else:
            session.clear()


# ─────────────────────────────────────────────
#  Helper: log user in via session
# ─────────────────────────────────────────────
def _login_user(user):
    user.security_key = str(uuid.uuid4())
    db.session.commit()
    session['user_id'] = user.id
    session['security_key'] = user.security_key


# ─────────────────────────────────────────────
#  OTP Helpers
# ─────────────────────────────────────────────
def _generate_otp():
    """Generate a cryptographically random 6-digit OTP."""
    return ''.join(random.choices(string.digits, k=6))


def _create_and_send_otp(user):
    """
    Invalidate any old OTPs for this user, create a fresh one,
    save to DB, and email it. Returns the OTPToken object.
    Raises on mail send failure.
    """
    # Invalidate prior unused OTPs
    OTPToken.query.filter_by(user_id=user.id, is_used=False).update({'is_used': True})
    db.session.commit()

    code = _generate_otp()
    otp = OTPToken(user_id=user.id, token=code)
    db.session.add(otp)
    db.session.commit()

    # Build and send the email
    msg = Message(
        subject="🔐 AegisGuard.AI — Your One-Time Access Code",
        recipients=[user.email]
    )
    msg.html = f"""
    <div style="font-family: 'Courier New', monospace; background: #0a0f1e; color: #e2e8f0;
                padding: 40px; border-radius: 12px; max-width: 520px; margin: auto;
                border: 1px solid #1e3a5f;">
        <div style="text-align:center; margin-bottom: 32px;">
            <h1 style="color:#00f5ff; font-size:24px; letter-spacing:4px; margin:0;">
                AegisGuard<span style="color:#a78bfa">.AI</span>
            </h1>
            <p style="color:#64748b; font-size:11px; letter-spacing:3px; text-transform:uppercase; margin-top:4px;">
                Secure Access Protocol
            </p>
        </div>
        <p style="color:#94a3b8; font-size:14px; text-align:center; margin-bottom:24px;">
            Hello <strong style="color:#e2e8f0;">{user.name}</strong>, your one-time access code is:
        </p>
        <div style="background:#0d1a2e; border:2px solid #00f5ff; border-radius:12px;
                    text-align:center; padding: 28px 0; margin:0 auto 24px auto;">
            <span style="font-size:48px; font-weight:900; letter-spacing:18px;
                         color:#00f5ff; text-shadow:0 0 20px rgba(0,245,255,0.7);">
                {code}
            </span>
        </div>
        <p style="color:#64748b; font-size:12px; text-align:center; margin-bottom:0;">
            ⏱ This code expires in <strong style="color:#f59e0b;">10 minutes</strong>.<br>
            If you did not attempt to login, ignore this email and your account remains secure.
        </p>
        <hr style="border:none; border-top:1px solid #1e3a5f; margin:28px 0;">
        <p style="color:#334155; font-size:10px; text-align:center; letter-spacing:2px;">
            AegisGuard.AI — NEXT-GEN THREAT INTELLIGENCE
        </p>
    </div>
    """
    mail.send(msg)
    return otp


def _mask_email(email):
    """Returns masked email like 'us****@gmail.com' for display."""
    local, domain = email.split('@', 1)
    visible = local[:2] if len(local) > 2 else local[0]
    masked = visible + '*' * max(2, len(local) - 2)
    return f"{masked}@{domain}"


# ─────────────────────────────────────────────
#  Google OAuth Callback
# ─────────────────────────────────────────────
@app.route('/social/google/complete')
def google_complete():
    if not google.authorized:
        flash("Google authorization was denied or failed.", "error")
        return redirect(url_for('login'))

    resp = google.get('/oauth2/v2/userinfo')
    if not resp.ok:
        flash("Failed to fetch your Google profile. Try again.", "error")
        return redirect(url_for('login'))

    info = resp.json()
    email = info.get('email')
    name = info.get('name', email.split('@')[0])

    if not email:
        flash("Could not retrieve your email from Google.", "error")
        return redirect(url_for('login'))

    # Find or create user
    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(name=name, email=email, provider='google')
        db.session.add(user)
        db.session.commit()
        flash(f"Welcome, {name}! Your AegisGuard account has been created via Google.", "success")
    else:
        flash(f"Welcome back, {user.name}!", "success")

    _login_user(user)
    return redirect(url_for('dashboard'))


# ─────────────────────────────────────────────
#  GitHub OAuth Callback
# ─────────────────────────────────────────────
@app.route('/social/github/complete')
def github_complete():
    if not github.authorized:
        flash("GitHub authorization was denied or failed.", "error")
        return redirect(url_for('login'))

    resp = github.get('/user')
    if not resp.ok:
        flash("Failed to fetch your GitHub profile. Try again.", "error")
        return redirect(url_for('login'))

    info = resp.json()
    github_login = info.get('login', '')
    name = info.get('name') or github_login

    # GitHub may not expose email publicly — fetch separately
    email = info.get('email')
    if not email:
        emails_resp = github.get('/user/emails')
        if emails_resp.ok:
            emails = emails_resp.json()
            primary = next((e['email'] for e in emails if e.get('primary') and e.get('verified')), None)
            email = primary or (emails[0]['email'] if emails else None)

    if not email:
        # Fallback: generate synthetic email from GitHub username
        email = f"{github_login}@github.noreply.com"

    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(name=name, email=email, provider='github')
        db.session.add(user)
        db.session.commit()
        flash(f"Welcome, {name}! Your AegisGuard account was created via GitHub.", "success")
    else:
        flash(f"Welcome back, {user.name}!", "success")

    _login_user(user)
    return redirect(url_for('dashboard'))


# ─────────────────────────────────────────────
#  Standard Auth Routes
# ─────────────────────────────────────────────
@app.route('/')
@app.route('/login', methods=['GET', 'POST'])
def login():
    if g.user:
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']

        user = User.query.filter_by(email=email).first()
        if user and user.password_hash and check_password_hash(user.password_hash, password):
            # ── OTP FLOW: generate & email OTP ──
            mail_configured = bool(app.config.get('MAIL_USERNAME') and
                                   app.config['MAIL_USERNAME'] != 'YOUR_GMAIL_ADDRESS@gmail.com')
            if mail_configured:
                try:
                    _create_and_send_otp(user)
                    session['pre_auth_user_id'] = user.id
                    flash(f"A 6-digit code has been sent to {_mask_email(user.email)}. Please enter it below.", "info")
                    return redirect(url_for('verify_otp'))
                except Exception as e:
                    # Fallback: if mail fails, log the user in directly
                    app.logger.error(f"OTP email failed: {e}")
                    flash("Could not send OTP email — logging you in directly. Configure MAIL settings in .env to enable OTP.", "warning")
                    _login_user(user)
                    return redirect(url_for('dashboard'))
            else:
                # Mail not configured — skip OTP, login directly (dev mode)
                _login_user(user)
                flash(f"Welcome back, {user.name}! (OTP disabled — configure MAIL settings in .env to enable it)", "success")
                return redirect(url_for('dashboard'))

        elif user and not user.password_hash:
            flash(f"This account was created via {user.provider.capitalize()}. Please use that login method.", "warning")
        else:
            flash("Invalid email or password.", "error")

    return render_template('login.html', type='login', is_auth_page=True)


@app.route('/verify-otp', methods=['GET', 'POST'])
def verify_otp():
    # Must have a pending pre-auth session
    if g.user:
        return redirect(url_for('dashboard'))

    pre_auth_id = session.get('pre_auth_user_id')
    if not pre_auth_id:
        flash("Session expired. Please login again.", "warning")
        return redirect(url_for('login'))

    user = User.query.get(pre_auth_id)
    if not user:
        session.pop('pre_auth_user_id', None)
        return redirect(url_for('login'))

    if request.method == 'POST':
        # Combine 6 individual digit fields or accept a single 'otp_code' field
        if 'otp_code' in request.form:
            entered_code = request.form['otp_code'].strip()
        else:
            digits = [request.form.get(f'd{i}', '') for i in range(1, 7)]
            entered_code = ''.join(digits).strip()

        # Find the latest valid (unused) OTP for this user
        otp = OTPToken.query.filter_by(
            user_id=user.id,
            is_used=False
        ).order_by(OTPToken.created_at.desc()).first()

        if not otp:
            flash("No active OTP found. Please request a new code.", "error")
            return render_template('otp.html', masked_email=_mask_email(user.email), is_auth_page=True)

        if otp.is_expired():
            otp.is_used = True
            db.session.commit()
            flash("Your code has expired. Please request a new one.", "error")
            return render_template('otp.html', masked_email=_mask_email(user.email), is_auth_page=True)

        if otp.token != entered_code:
            flash("Incorrect code. Please try again.", "error")
            return render_template('otp.html', masked_email=_mask_email(user.email), is_auth_page=True)

        # ✅ OTP is valid
        otp.is_used = True
        db.session.commit()
        session.pop('pre_auth_user_id', None)
        _login_user(user)
        flash(f"Identity verified. Welcome back, {user.name}!", "success")
        return redirect(url_for('dashboard'))

    return render_template('otp.html', masked_email=_mask_email(user.email), is_auth_page=True)


@app.route('/resend-otp', methods=['POST'])
def resend_otp():
    """Resend a fresh OTP to the pre-authenticated user."""
    pre_auth_id = session.get('pre_auth_user_id')
    if not pre_auth_id:
        return jsonify({'error': 'No pending authentication session.'}), 400

    user = User.query.get(pre_auth_id)
    if not user:
        return jsonify({'error': 'User not found.'}), 400

    try:
        _create_and_send_otp(user)
        return jsonify({'success': True, 'message': f'A new code has been sent to {_mask_email(user.email)}.'})
    except Exception as e:
        app.logger.error(f"Resend OTP failed: {e}")
        return jsonify({'error': 'Failed to send email. Check MAIL settings in .env.'}), 500


@app.route('/register', methods=['GET', 'POST'])
def register():
    if g.user:
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        name = request.form['name']
        email = request.form['email']
        password = request.form['password']

        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            flash("Email is already registered. Please login.", "warning")
            return redirect(url_for('login'))

        hashed_pw = generate_password_hash(password)
        new_user = User(name=name, email=email, password_hash=hashed_pw)
        if 'admin' in email.lower():
            new_user.is_admin = True

        db.session.add(new_user)
        db.session.commit()

        flash("Registration successful. Proceed to login.", "success")
        return redirect(url_for('login'))

    return render_template('login.html', type='register', is_auth_page=True)


@app.route('/logout')
def logout():
    if g.user:
        g.user.security_key = str(uuid.uuid4())
        db.session.commit()
    session.clear()
    return redirect(url_for('login'))


# ─────────────────────────────────────────────────────────────────
#  JSON API Auth Endpoints (consumed by React SPA)
# ─────────────────────────────────────────────────────────────────
@app.route('/auth/login-api', methods=['POST'])
def login_api():
    """JSON login for the React frontend. Accepts both JSON and FormData."""
    # Accept JSON (Axios default) or FormData
    data = request.get_json(silent=True) or {}
    email    = (data.get('email')    or request.form.get('email',    '')).strip()
    password = (data.get('password') or request.form.get('password', '')).strip()

    if not email or not password:
        return jsonify({'success': False, 'error': 'Email and password are required.'}), 400

    user = User.query.filter_by(email=email).first()
    if user and user.password_hash and check_password_hash(user.password_hash, password):
        _login_user(user)
        return jsonify({
            'success': True,
            'user': {'id': user.id, 'name': user.name, 'email': user.email, 'is_admin': getattr(user, 'is_admin', False)}
        })
    elif user and not user.password_hash:
        provider = getattr(user, 'provider', 'OAuth')
        return jsonify({'success': False, 'error': f'This account uses {provider.capitalize()} sign-in. Please use that login method.'}), 400
    return jsonify({'success': False, 'error': 'Incorrect email or password. Please check your credentials.'}), 401


@app.route('/auth/register-api', methods=['POST'])
def register_api():
    """JSON registration for the React frontend. Accepts both JSON and FormData."""
    data = request.get_json(silent=True) or {}
    name     = (data.get('name')     or request.form.get('name',     '')).strip()
    email    = (data.get('email')    or request.form.get('email',    '')).strip()
    password = (data.get('password') or request.form.get('password', '')).strip()

    if not name or not email or not password:
        return jsonify({'success': False, 'error': 'All fields are required.'}), 400
    if len(password) < 6:
        return jsonify({'success': False, 'error': 'Password must be at least 6 characters.'}), 400
    if '@' not in email:
        return jsonify({'success': False, 'error': 'Please enter a valid email address.'}), 400

    existing = User.query.filter_by(email=email).first()
    if existing:
        return jsonify({'success': False, 'error': 'An account with this email already exists. Please sign in instead.'}), 409

    hashed_pw = generate_password_hash(password)
    new_user = User(name=name, email=email, password_hash=hashed_pw)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Account created successfully.'})


# ─────────────────────────────────────────────
#  Dashboard + API Routes
# ─────────────────────────────────────────────
@app.route('/dashboard', methods=['GET', 'POST'])
def dashboard():
    if not g.user:
        if request.method == 'POST':
            return jsonify({'error': 'Unauthorized'}), 401
        return redirect(url_for('login'))

    if request.method == 'POST':
        data = request.get_json() or request.form
        target_url = data.get('target_url')

        prob, verdict, reasons, is_masked_redirect, compromised_data, attack_type, raw_features = predict_phishing(target_url)

        new_scan = ScanHistory(
            user_id=g.user.id,
            url_scanned=target_url,
            risk_score=prob,
            verdict=verdict
        )
        db.session.add(new_scan)
        db.session.commit()

        return jsonify({
            'url': target_url,
            'probability': prob,
            'probability_pct': int(prob * 100),
            'verdict': verdict,
            'reasons': reasons,
            'is_masked_redirect': is_masked_redirect,
            'compromised_data': compromised_data,
            'attack_type': attack_type,
            'raw_features': raw_features
        })

    recent_scans = ScanHistory.query.filter_by(user_id=g.user.id).order_by(ScanHistory.date.desc()).limit(50).all()
    return render_template('dashboard.html', user=g.user, scans=recent_scans, active_page='dashboard')


@app.route('/api/domain-recon', methods=['POST'])
def domain_recon():
    if not g.user:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.get_json() or request.form
    domain = data.get('domain', '').strip()
    if not domain:
        return jsonify({'error': 'No domain provided'}), 400
    result = perform_domain_recon(domain)
    return jsonify(result)


@app.route('/api/email-intel', methods=['POST'])
def email_intel():
    if not g.user:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.get_json() or request.form
    email = data.get('email', '').strip()
    if not email:
        return jsonify({'error': 'No email provided'}), 400
    result = perform_email_lookup(email)
    return jsonify(result)


@app.route('/admin')
def admin():
    if not g.user:
        return redirect(url_for('login'))
    if not g.user.is_admin:
        flash("Unauthorized. Admin privileges required.", "error")
        return redirect(url_for('dashboard'))
    all_scans = ScanHistory.query.order_by(ScanHistory.date.desc()).limit(50).all()
    return render_template('admin.html', user=g.user, scans=all_scans)



# ─────────────────────────────────────────────
#  Chrome Extension API Endpoint
# ─────────────────────────────────────────────
@app.route('/api/ext-scan', methods=['POST'])
def ext_scan():
    """
    Public endpoint for the AegisGuard Chrome Extension AND the React SPA.
    Returns a fully structured analysis result with plain-English findings.
    """
    data = request.get_json() or {}
    target_url = data.get('target_url', '').strip()

    if not target_url:
        return jsonify({'error': 'No URL provided'}), 400

    try:
        from utils import analyze_url
        result = analyze_url(target_url)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/download-extension')
def download_extension():
    """
    Serves the Chrome extension zip with the correct filename.
    Using send_file with as_attachment ensures the browser uses
    'aegisguard_extension.zip' regardless of CORS or origin.
    """
    zip_path = os.path.join(os.path.dirname(__file__), 'static', 'aegisguard_extension.zip')
    if not os.path.exists(zip_path):
        return jsonify({'error': 'Extension package not found.'}), 404
    return send_file(
        zip_path,
        as_attachment=True,
        download_name='aegisguard_extension.zip',
        mimetype='application/zip'
    )


def init_db():
    """
    Initialize the database schema.
    - In production (Vercel/Neon): just runs create_all() — model .pkl files are bundled in repo.
    - In local dev: also trains the ML model if .pkl is missing.
    Safe to call multiple times (idempotent).
    """
    # Only train model locally if pkl is missing (not needed on Vercel — pkl is in repo)
    if not os.path.exists(os.path.join(os.path.dirname(__file__), "phishing_rf_model.pkl")):
        if os.getenv('FLASK_ENV') == 'development' or os.getenv('VERCEL') is None:
            from utils import train_and_save_model
            train_and_save_model()
    # create_all() is idempotent — safe to call on every cold start
    db.create_all()
    print("[AegisGuard] Database schema ready.")


if __name__ == '__main__':
    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
    with app.app_context():
        init_db()
    app.run(debug=True, port=5001)

