import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Mail, Lock, User, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal({ onClose }) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');

    if (tab === 'login') {
      const r = await login(form.email, form.password);
      if (r.ok) { onClose(); }
      else setError(r.error);
    } else {
      if (!form.name) { setError('Name is required'); setLoading(false); return; }
      const r = await register(form.name, form.email, form.password);
      if (r.ok) {
        setSuccess('Account created! Logging you in…');
        const r2 = await login(form.email, form.password);
        if (r2.ok) onClose();
        else { setTab('login'); setSuccess(''); }
      } else setError(r.error);
    }
    setLoading(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(7,12,24,0.85)', backdropFilter: 'blur(8px)' }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="glass w-full max-w-md relative"
        >
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-10">
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="p-8 pb-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-neonCyan/10 border border-neonCyan/30 flex items-center justify-center">
                <Shield className="w-4 h-4 text-neonCyan" />
              </div>
              <span className="font-display font-bold text-lg">AegisGuard<span className="text-neonPurple">.AI</span></span>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 p-1 glass-subtle rounded-xl mb-6">
              {['login', 'register'].map(t => (
                <button key={t} onClick={() => { setTab(t); setError(''); setSuccess(''); }}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                    tab === t ? 'bg-neonCyan text-darkBg shadow-md' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>

            <h2 className="text-xl font-display font-bold text-white mb-1">
              {tab === 'login' ? 'Welcome back' : 'Join AegisGuard'}
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              {tab === 'login'
                ? 'Sign in to access the extension and save your scan history.'
                : 'Create a free account to install the browser extension and track threats.'}
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {tab === 'register' && (
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                  <input
                    type="text" placeholder="Full name" required value={form.name}
                    onChange={e => update('name', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 outline-none focus:border-neonCyan/50 focus:bg-neonCyan/5 transition-all"
                  />
                </div>
              )}
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <input
                  type="email" placeholder="Email address" required value={form.email}
                  onChange={e => update('email', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 outline-none focus:border-neonCyan/50 focus:bg-neonCyan/5 transition-all"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <input
                  type={showPw ? 'text' : 'password'} placeholder="Password" required value={form.password}
                  onChange={e => update('password', e.target.value)} minLength={6}
                  className="w-full pl-10 pr-11 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 outline-none focus:border-neonCyan/50 focus:bg-neonCyan/5 transition-all"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2.5 rounded-xl text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}
              {success && (
                <div className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5 rounded-xl text-sm">
                  {success}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <p className="text-xs text-gray-500 text-center mt-4">
              By continuing you agree to our Terms of Service. Your data is never sold.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
