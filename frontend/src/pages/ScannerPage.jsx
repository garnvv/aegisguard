import React, { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Globe, AlertTriangle, CheckCircle, XCircle, Info, Shield,
  Zap, Activity, Fingerprint, Network, ChevronDown, ChevronUp
} from 'lucide-react';

// ── Risk Gauge ───────────────────────────────────────────────────────────────
function RiskGauge({ score, verdictCode }) {
  const color = verdictCode === 'Green' ? '#10b981'
    : verdictCode === 'Yellow' ? '#f59e0b'
    : verdictCode === 'Orange' ? '#f97316' : '#ef4444';
  const r = 52, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
  return (
    <div className="relative flex items-center justify-center w-40 h-40">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
        <motion.circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="9"
          strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <motion.div className="relative text-center" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: 'spring', stiffness: 250 }}>
        <div className="text-3xl font-bold font-mono" style={{ color }}>{score}%</div>
        <div className="text-[10px] text-gray-400 uppercase tracking-widest">Risk</div>
      </motion.div>
    </div>
  );
}

// ── Finding Card ─────────────────────────────────────────────────────────────
const SEV = {
  danger:  { bg: 'bg-red-500/8',    border: 'border-red-500/25',    Icon: XCircle,     cls: 'text-red-400' },
  warning: { bg: 'bg-amber-500/8',  border: 'border-amber-500/25',  Icon: AlertTriangle,cls: 'text-amber-400' },
  info:    { bg: 'bg-blue-500/8',   border: 'border-blue-500/25',   Icon: Info,         cls: 'text-blue-400' },
  safe:    { bg: 'bg-emerald-500/8',border: 'border-emerald-500/25',Icon: CheckCircle,  cls: 'text-emerald-400' },
};
function FindingCard({ f, i }) {
  const [open, setOpen] = useState(false);
  const s = SEV[f.severity] || SEV.info;
  return (
    <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
      className={`border rounded-xl overflow-hidden transition-colors ${s.bg} ${s.border}`}
    >
      <button className="w-full flex items-center gap-3 p-3 text-left" onClick={() => setOpen(!open)}>
        <s.Icon className={`w-4 h-4 shrink-0 ${s.cls}`} />
        <span className="text-sm font-semibold text-white flex-1">{f.label}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden' }}>
            <p className="px-10 pb-3 text-xs text-gray-400 leading-relaxed">{f.detail}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Results Panel ─────────────────────────────────────────────────────────────
const VC = {
  Green:  { text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  Yellow: { text: 'text-amber-400',   bg: 'bg-amber-500/15',   border: 'border-amber-500/30'  },
  Orange: { text: 'text-orange-400',  bg: 'bg-orange-500/15',  border: 'border-orange-500/30' },
  Red:    { text: 'text-red-400',     bg: 'bg-red-500/15',     border: 'border-red-500/30'    },
};
function ResultsPanel({ result }) {
  const vc = VC[result.verdict_code] || VC.Yellow;
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 100 }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gauge */}
        <div className="glass p-5 flex flex-col items-center justify-center gap-3">
          <RiskGauge score={result.score} verdictCode={result.verdict_code} />
          <span className={`px-4 py-1 rounded-full border text-sm font-bold uppercase tracking-wider ${vc.text} ${vc.bg} ${vc.border}`}>
            {result.verdict}
          </span>
          <p className="text-xs text-gray-500 font-mono text-center break-all">{result.domain}</p>
        </div>

        {/* Summary */}
        <div className="md:col-span-2 glass p-5 flex flex-col gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[3px] text-gray-500 mb-2">What This Means</p>
            <p className="text-white text-base leading-relaxed">{result.summary}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-subtle p-3 rounded-xl">
              <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Attack Pattern</p>
              <p className="text-sm font-semibold text-neonCyan">{result.attack_type}</p>
            </div>
            <div className="glass-subtle p-3 rounded-xl">
              <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Redirect</p>
              <p className={`text-sm font-semibold ${result.has_redirect ? 'text-amber-400' : 'text-emerald-400'}`}>
                {result.has_redirect ? '⚠️ Present' : '✅ None'}
              </p>
            </div>
          </div>
          {result.at_risk?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[3px] text-gray-500 mb-2">Data Potentially at Risk</p>
              <div className="flex flex-wrap gap-2">
                {result.at_risk.map((item, i) => (
                  <span key={i} className="px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-300 text-xs rounded-full">{item}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Findings */}
      {result.findings?.length > 0 && (
        <div className="glass p-5">
          <h3 className="text-sm font-display font-semibold text-neonCyan mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" /> Security Check Details ({result.findings.length} checks run)
          </h3>
          <p className="text-xs text-gray-500 mb-3">Click any item to see a plain-English explanation.</p>
          <div className="space-y-2">
            {result.findings.map((f, i) => <FindingCard key={i} f={f} i={i} />)}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Scanner Page ──────────────────────────────────────────────────────────────
const EXAMPLES = [
  'https://google.com',
  'https://paypa1-secure-login.tk/update?redirect=https://steal.ru',
  'https://accounts.google.com/oauth2/auth?scope=mail.read&redirect_uri=https://evil.com',
];

export default function ScannerPage() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const scan = async (targetUrl) => {
    const u = (targetUrl || url).trim();
    if (!u) return;
    setUrl(u);
    setLoading(true); setError(''); setResult(null);
    try {
      const { data } = await axios.post('/api/ext-scan', { target_url: u });
      setResult(data);
    } catch (e) {
      setError(e.response?.data?.error || 'Cannot reach backend. Make sure python app.py is running on port 5001.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen pt-24 pb-16 px-4 sm:px-6">
      <div className="fixed top-20 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-neonCyan/4 rounded-full blur-[100px] pointer-events-none" />
      <div className="relative z-10 max-w-3xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-neonCyan/20 bg-neonCyan/8 text-neonCyan text-xs font-medium mb-5">
            <Activity className="w-3 h-3" /> Live URL Scanner
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-white mb-3">URL Threat Scanner</h1>
          <p className="text-gray-400 text-sm leading-relaxed max-w-lg mx-auto">
            Paste any URL below. We run 13 security checks instantly and explain exactly what we found — no jargon.
          </p>
        </motion.div>

        {/* Search bar */}
        <motion.form onSubmit={e => { e.preventDefault(); scan(); }}
          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
          className="glass p-2 flex flex-col sm:flex-row gap-2 mb-4"
        >
          <div className="relative flex-1 flex items-center">
            <Globe className="absolute left-4 w-4 h-4 text-neonCyan/40 pointer-events-none" />
            <input
              type="text" value={url} onChange={e => setUrl(e.target.value)}
              placeholder="Paste any URL to scan…"
              className="w-full bg-transparent outline-none pl-11 pr-4 py-3 text-white placeholder-gray-600 font-mono text-sm"
            />
            {url && (
              <button type="button" onClick={() => { setUrl(''); setResult(null); }}
                className="absolute right-3 text-gray-600 hover:text-gray-400 text-xs px-1.5 py-0.5 rounded border border-gray-700 transition-colors"
              >
                ✕
              </button>
            )}
          </div>
          <motion.button type="submit" disabled={loading || !url.trim()}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            className="btn-primary flex items-center gap-2 justify-center px-7 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading
              ? <><span className="w-4 h-4 border-2 border-darkBg/40 border-t-darkBg rounded-full animate-spin" />Analysing…</>
              : <><Search className="w-4 h-4" />Scan URL</>
            }
          </motion.button>
        </motion.form>

        {/* Examples */}
        <div className="flex flex-wrap gap-2 mb-8">
          <span className="text-xs text-gray-600 self-center">Try:</span>
          {EXAMPLES.map((ex, i) => (
            <button key={i} onClick={() => scan(ex)}
              className="text-xs px-3 py-1.5 rounded-lg glass-subtle text-gray-400 hover:text-neonCyan hover:border-neonCyan/30 transition-all truncate max-w-[200px]"
            >
              {ex.replace('https://', '').substring(0, 40)}{ex.length > 48 ? '…' : ''}
            </button>
          ))}
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm mb-6"
            >
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence mode="wait">
          {result && <ResultsPanel key={result.url} result={result} />}
        </AnimatePresence>

        {/* Empty state */}
        {!result && !loading && !error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="glass p-10 text-center mt-4"
          >
            <Shield className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 text-sm">Your scan results will appear here.</p>
            <p className="text-gray-600 text-xs mt-1">We check 13 security signals for every URL you scan.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
