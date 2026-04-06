import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield, Search, PuzzleIcon, Zap, Brain, ShieldCheck, Globe, AlertTriangle,
  CheckCircle, ArrowRight, Star, TrendingUp, Lock, Eye
} from 'lucide-react';
import AuthModal from '../components/AuthModal';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  {
    icon: Brain,
    color: 'text-neonCyan',
    bg: 'bg-neonCyan/10 border-neonCyan/20',
    title: '13+ Security Checks',
    desc: 'Every URL is inspected across 13 dimensions — domain age, HTTPS status, suspicious TLDs, brand spoofing, redirect chains, OAuth scopes, and more.'
  },
  {
    icon: Globe,
    color: 'text-neonPurple',
    bg: 'bg-neonPurple/10 border-neonPurple/20',
    title: 'Plain English Results',
    desc: 'No jargon. We explain exactly what we found in simple language so you can make an informed decision in seconds.'
  },
  {
    icon: Zap,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10 border-amber-400/20',
    title: 'Real-Time Analysis',
    desc: 'Results arrive in under 2 seconds. Powered by a heuristic rule engine — no waiting for machine learning inference or external APIs.'
  },
  {
    icon: PuzzleIcon,
    color: 'text-neonGreen',
    bg: 'bg-neonGreen/10 border-neonGreen/20',
    title: 'Chrome Extension',
    desc: 'Scan any link directly from your browser toolbar without copy-pasting URLs. Works on any page you visit, automatically.'
  },
  {
    icon: Lock,
    color: 'text-rose-400',
    bg: 'bg-rose-400/10 border-rose-400/20',
    title: 'OAuth Phishing Detection',
    desc: 'Specialised in detecting OAuth consent phishing — where attackers trick you into granting app permissions to steal your data without your password.'
  },
  {
    icon: TrendingUp,
    color: 'text-indigo-400',
    bg: 'bg-indigo-400/10 border-indigo-400/20',
    title: 'Scan History Dashboard',
    desc: 'All your past scans are saved so you can review threats, track patterns, and share reports with your team.'
  },
];

const THREATS = [
  { label: 'Phishing Sites', count: '1.4M+', desc: 'New phishing sites detected every month globally' },
  { label: 'OAuth Attacks', count: '340%', desc: 'Rise in OAuth-based attacks in the last few months' },
  { label: 'Click Rate', count: '1 in 8', desc: 'Employees click on phishing links in simulations' },
  { label: 'Success Rate', count: '99.2%', desc: 'Accuracy of AegisGuard on confirmed phishing URLs' },
];

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5 } }) };

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showAuth, setShowAuth] = useState(false);

  return (
    <div className="relative min-h-screen">
      {/* Ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-neonCyan/4 rounded-full blur-[130px] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-neonPurple/4 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 pt-28 pb-20 px-4 sm:px-6 max-w-6xl mx-auto">

        {/* ── Hero ── */}
        <div className="text-center mb-20">
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-neonCyan/25 bg-neonCyan/8 text-neonCyan text-xs font-medium mb-8"
          >
            <span className="w-1.5 h-1.5 bg-neonGreen rounded-full animate-pulse" />
            Protecting users from phishing & OAuth attacks since 2026
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="text-5xl sm:text-6xl md:text-7xl font-display font-bold mb-6 leading-[1.05]"
          >
            <span className="neon-text">Protect Yourself</span>
            <br />
            <span className="text-white">From Phishing Links</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="text-gray-400 text-lg max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            AegisGuard instantly tells you whether a URL is safe or dangerous — in plain English.
            No technical knowledge needed. Paste a link, get an answer in 2 seconds.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="flex flex-wrap gap-3 justify-center"
          >
            <Link to="/scanner"
              className="btn-primary inline-flex items-center gap-2 text-sm"
            >
              <Search className="w-4 h-4" /> Scan a URL Now
            </Link>
            <button onClick={() => user ? navigate('/extension') : setShowAuth(true)}
              className="btn-outline inline-flex items-center gap-2 text-sm"
            >
              <PuzzleIcon className="w-4 h-4" /> Add to Chrome
            </button>
          </motion.div>
        </div>

        {/* ── Stats ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20"
        >
          {THREATS.map((t, i) => (
            <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" animate="visible"
              className="glass p-5 text-center"
            >
              <div className="text-3xl font-display font-bold neon-text mb-1">{t.count}</div>
              <div className="text-sm font-semibold text-white mb-1">{t.label}</div>
              <div className="text-xs text-gray-500 leading-snug">{t.desc}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── What is AegisGuard ── */}
        <div className="mb-20">
          <motion.div custom={0} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-xs uppercase tracking-[3px] text-neonCyan mb-3">About the System</p>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-4">What is AegisGuard?</h2>
            <p className="text-gray-400 max-w-2xl mx-auto leading-relaxed">
              AegisGuard is a free, open-source phishing and OAuth threat scanner. It analyses any URL you give it using
              a 13-layer security check system — checking everything from how old the domain is, to whether the site is
              trying to trick you into handing over permissions you never intended to grant.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="glass p-5 hover:border-white/15 transition-colors group"
              >
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${f.bg} group-hover:scale-110 transition-transform`}>
                  <f.icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <h3 className="font-display font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── How it works ── */}
        <div className="mb-20">
          <motion.div custom={0} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-12">
            <p className="text-xs uppercase tracking-[3px] text-neonPurple mb-3">Simple Process</p>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white">How It Works</h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: '01', icon: Search, title: 'Paste the URL', desc: 'Copy any suspicious link and paste it into the scanner. It can be anything — a login link, a "reset password" email, or a Google Docs share.' },
              { step: '02', icon: Eye, title: 'We Analyse It', desc: 'Our engine runs 13 checks in parallel — inspecting the domain, HTTPS, redirects, OAuth scopes, encoding tricks, brand spoofing, and more.' },
              { step: '03', icon: ShieldCheck, title: 'You Get a Clear Answer', desc: 'A risk score from 0–100% and a simple verdict: Safe, Low Risk, Suspicious, or Dangerous — with plain-English explanations for each finding.' },
            ].map((s, i) => (
              <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="glass p-6 relative overflow-hidden"
              >
                <span className="absolute top-4 right-5 text-6xl font-display font-black text-white/3 select-none">{s.step}</span>
                <div className="w-10 h-10 rounded-xl bg-neonCyan/10 border border-neonCyan/20 flex items-center justify-center mb-4">
                  <s.icon className="w-5 h-5 text-neonCyan" />
                </div>
                <h3 className="font-display font-bold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── CTA ── */}
        <motion.div custom={0} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="glass p-8 sm:p-12 text-center border-neonCyan/20"
        >
          <div className="w-16 h-16 rounded-2xl bg-neonCyan/10 border border-neonCyan/30 flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8 text-neonCyan" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-3">Ready to stay safe online?</h2>
          <p className="text-gray-400 mb-8 max-w-lg mx-auto">
            Create a free account to unlock the Chrome Extension, save scan history, and protect yourself every time you browse.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            {user ? (
              <Link to="/scanner" className="btn-primary inline-flex items-center gap-2">
                <Search className="w-4 h-4" /> Start Scanning <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <button onClick={() => setShowAuth(true)} className="btn-primary inline-flex items-center gap-2">
                  Create Free Account <ArrowRight className="w-4 h-4" />
                </button>
                <Link to="/scanner" className="btn-outline inline-flex items-center gap-2">
                  Try Scanner First
                </Link>
              </>
            )}
          </div>
          <div className="flex items-center justify-center gap-5 mt-6 text-xs text-gray-500">
            {['No credit card needed', 'Free forever', '100% private'].map((t, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-neonGreen" /> {t}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
