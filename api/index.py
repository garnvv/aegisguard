"""
Vercel Python Serverless Function adapter.

Vercel's @vercel/python runtime looks for a file at api/index.py
and expects it to export a WSGI-compatible application named `app`.
We simply import the Flask app from the project root.
"""
import sys
import os

# Add the project root to the Python path so we can import app.py and its siblings
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import and initialize the Flask app
from app import app, init_db

# Initialize the database schema on first cold start.
# Vercel serverless functions start fresh on each invocation (cold start),
# so create_all() is safe to call — it's idempotent.
with app.app_context():
    try:
        init_db()
    except Exception as e:
        print(f"[AegisGuard] DB init warning: {e}")

# Vercel expects the WSGI app to be named `app` at module level
# This is already the case — nothing more needed.
