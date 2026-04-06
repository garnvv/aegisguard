from flask_sqlalchemy import SQLAlchemy
from flask_dance.consumer.storage.sqla import OAuthConsumerMixin
from datetime import datetime
import uuid

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=True)  # nullable for social-only users
    security_key = db.Column(db.String(36), default=lambda: str(uuid.uuid4()))
    is_admin = db.Column(db.Boolean, default=False)
    provider = db.Column(db.String(20), default='local')  # 'local', 'google', 'github'

    # Relationships
    scans = db.relationship('ScanHistory', backref='user', lazy=True)
    otp_tokens = db.relationship('OTPToken', backref='user', lazy=True)

class OAuth(OAuthConsumerMixin, db.Model):
    __tablename__ = 'oauth_tokens'
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    user = db.relationship('User')

class OTPToken(db.Model):
    __tablename__ = 'otp_tokens'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    token = db.Column(db.String(6), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_used = db.Column(db.Boolean, default=False)

    def is_expired(self):
        """OTP expires after 10 minutes."""
        delta = datetime.utcnow() - self.created_at
        return delta.total_seconds() > 600  # 10 minutes

class ScanHistory(db.Model):
    __tablename__ = 'scan_history'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    url_scanned = db.Column(db.Text, nullable=False)
    risk_score = db.Column(db.Float, nullable=False)  # 0.0 to 1.0 probability of phishing
    verdict = db.Column(db.String(50), nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow)
