import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PuzzleIcon, Shield, Download, LogIn, CheckCircle, FolderOpen,
  ToggleRight, Puzzle, Globe2, Lock, Zap, AlertCircle, Copy, Check,
  ArrowRight, Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthModal from '../components/AuthModal';

// ── Copyable Chrome URL ───────────────────────────────────────────────────────
function CopyableLink({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  return (
    <div className="inline-flex items-center gap-2 bg-darkBg border border-neonCyan/30 rounded-lg px-3 py-2 mt-2">
      <code className="text-neonCyan text-xs font-mono">{text}</code>
      <button onClick={copy} className="text-gray-500 hover:text-neonCyan transition-colors ml-1" title="Copy to clipboard">
        {copied ? <Check className="w-3.5 h-3.5 text-neonGreen" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      {copied && <span className="text-[10px] text-neonGreen">Copied!</span>}
    </div>
  );
}

// ── Step data ────────────────────────────────────────────────────────────────
const STEPS = [
  {
    num: 1,
    icon: Download,
    color: 'text-neonCyan',
    iconBg: 'bg-neonCyan/10 border-neonCyan/25',
    title: 'Download the Extension',
    desc: 'Click the Download button above to save the AegisGuard extension package to your computer.',
    tip: 'It saves as aegisguard_extension.zip in your Downloads folder.',
    extra: null,
  },
  {
    num: 2,
    icon: FolderOpen,
    color: 'text-amber-400',
    iconBg: 'bg-amber-400/10 border-amber-400/25',
    title: 'Unzip the Downloaded File',
    desc: 'Go to your Downloads folder. Right-click the .zip file and extract/unzip it.',
    tip: 'Mac: double-click the .zip  ·  Windows: right-click → Extract All',
    extra: null,
  },
  {
    num: 3,
    icon: Globe2,
    color: 'text-neonPurple',
    iconBg: 'bg-neonPurple/10 border-neonPurple/25',
    title: 'Open Chrome Extensions Page',
    desc: 'In Chrome, copy the address below and paste it in your address bar, then press Enter:',
    tip: 'Works on Chrome, Edge, and Brave browsers.',
    extra: <CopyableLink text="chrome://extensions" />,
  },
  {
    num: 4,
    icon: ToggleRight,
    color: 'text-neonGreen',
    iconBg: 'bg-neonGreen/10 border-neonGreen/25',
    title: 'Turn On Developer Mode',
    desc: 'On the Extensions page, find the "Developer mode" toggle in the TOP RIGHT corner and switch it ON.',
    tip: 'This allows you to install extensions not from the Chrome Web Store.',
    extra: null,
  },
  {
    num: 5,
    icon: Puzzle,
    color: 'text-rose-400',
    iconBg: 'bg-rose-400/10 border-rose-400/25',
    title: 'Click "Load unpacked"',
    desc: 'A new button appears — click "Load unpacked". Then select the unzipped aegisguard_extension folder.',
    tip: '✅ Done! The AegisGuard icon will appear in your Chrome toolbar immediately.',
    extra: null,
  },
];

const BENEFITS = [
  { icon: Zap, label: 'One-Click Scanning', sub: 'Scan any page from your toolbar' },
  { icon: Shield, label: 'Always On Guard', sub: 'Instant analysis, no copy-paste' },
  { icon: Lock, label: 'Private by Design', sub: 'Only scans URLs you choose' },
];

// ── Why not Web Store? ────────────────────────────────────────────────────────
function WhyNotWebStore() {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass-subtle rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/3 transition-colors"
      >
        <Info className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-sm text-gray-300 font-medium flex-1">
          Why can&apos;t the extension install automatically like Volume Booster?
        </span>
        <ArrowRight className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden' }}>
            <div className="px-4 pb-4 space-y-3 text-xs text-gray-400 leading-relaxed border-t border-white/5 pt-3">
              <p>
                Extensions like <strong className="text-white">Volume Booster</strong> and{' '}
                <strong className="text-white">Parakeet AI</strong> install with one click because they are
                published on the <strong className="text-white">Chrome Web Store</strong>. Chrome has a special
                API that only works for Web Store extensions.
              </p>
              <p>
                Since Chrome <strong className="text-white">2018</strong>, any website trying to silently install
                an extension gets <strong className="text-amber-400">blocked by Chrome</strong> as a security
                protection — even if the extension is completely safe.
              </p>
              <p>
                AegisGuard is an <strong className="text-white">independent open-source project</strong> and is not yet
                on the Chrome Web Store (the review takes weeks). The manual install via Developer Mode is{' '}
                <strong className="text-neonGreen">completely safe</strong> — you can inspect every file yourself.
                It takes under 2 minutes.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ExtensionPage() {
  const { user } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [dlState, setDlState] = useState('idle'); // idle | loading | done
  const [currentStep, setCurrentStep] = useState(0);

  const handleDownload = () => {
    if (!user) { setShowAuth(true); return; }
    setDlState('loading');
    // /api/download-extension is same-origin (Vite proxies it to Flask).
    // Same-origin anchor + download attribute = browser uses our filename.
    // Flask also sends Content-Disposition: attachment; filename=aegisguard_extension.zip
    const a = document.createElement('a');
    a.href = '/api/download-extension';
    a.download = 'aegisguard_extension.zip';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      setDlState('done');
      setCurrentStep(1);
    }, 800);
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07 } }),
  };

  return (
    <div className="relative min-h-screen pt-24 pb-20 px-4 sm:px-6">
      {/* Gradient glow */}
      <div className="fixed top-20 right-0 w-[500px] h-[500px] bg-neonPurple/4 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-neonPurple/25 bg-neonPurple/8 text-neonPurple text-xs font-medium mb-5">
            <PuzzleIcon className="w-3.5 h-3.5" /> Chrome Extension — Free
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-white mb-3">
            Add AegisGuard to Chrome
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed max-w-lg mx-auto">
            Scan any webpage&apos;s URL with one click from your browser toolbar — no copy-pasting needed.
          </p>
        </motion.div>

        {/* ── Benefits bar ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="grid grid-cols-3 gap-3 mb-8"
        >
          {BENEFITS.map((b, i) => (
            <div key={i} className="glass p-3 text-center">
              <b.icon className="w-5 h-5 text-neonPurple mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-white">{b.label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{b.sub}</p>
            </div>
          ))}
        </motion.div>

        {/* ── Download card (auth gated) ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className={`glass p-6 mb-8 text-center border ${dlState === 'done' ? 'border-neonGreen/30' : 'border-neonCyan/20'}`}
        >
          {!user ? (
            <>
              <div className="w-12 h-12 rounded-xl bg-neonCyan/10 border border-neonCyan/25 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-6 h-6 text-neonCyan" />
              </div>
              <h3 className="text-white font-semibold mb-1">Sign in to download</h3>
              <p className="text-gray-400 text-sm mb-5">
                Create a free account to download the AegisGuard Chrome extension.
              </p>
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => setShowAuth(true)}
                className="btn-primary inline-flex items-center gap-2"
              >
                <LogIn className="w-4 h-4" /> Sign In / Create Account
              </motion.button>
              <p className="text-[10px] text-gray-600 mt-3">Free forever · No credit card</p>
            </>
          ) : dlState === 'done' ? (
            <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <div className="w-14 h-14 rounded-full bg-neonGreen/15 border border-neonGreen/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-neonGreen" />
              </div>
              <h3 className="text-neonGreen font-bold text-lg mb-1">Extension Downloaded!</h3>
              <p className="text-gray-400 text-sm">
                Check your <strong className="text-white">Downloads folder</strong> for{' '}
                <code className="text-neonCyan bg-neonCyan/10 px-1.5 py-0.5 rounded text-xs">aegisguard_extension.zip</code>
              </p>
              <p className="text-gray-500 text-xs mt-3">
                Now follow the 5 steps below to add it to Chrome.
              </p>
            </motion.div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl bg-neonPurple/10 border border-neonPurple/25 flex items-center justify-center mx-auto mb-4">
                <Download className="w-6 h-6 text-neonPurple" />
              </div>
              <p className="text-white font-semibold mb-1">
                Welcome, {user.name?.split(' ')[0] || 'there'} 👋
              </p>
              <p className="text-gray-400 text-sm mb-5">
                Click below to download the extension. Then follow the 5 steps to install it.
              </p>
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={handleDownload}
                disabled={dlState === 'loading'}
                className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
              >
                {dlState === 'loading' ? (
                  <><span className="w-4 h-4 border-2 border-darkBg/40 border-t-darkBg rounded-full animate-spin" /> Downloading…</>
                ) : (
                  <><Download className="w-4 h-4" /> Download Extension (.zip)</>
                )}
              </motion.button>
            </>
          )}
        </motion.div>

        {/* ── Step-by-step guide ── */}
        <div className="mb-8">
          <h2 className="text-base font-display font-bold text-white mb-4 flex items-center gap-2">
            <PuzzleIcon className="w-4 h-4 text-neonPurple" />
            Installation Steps
            <span className="text-xs text-gray-500 font-normal ml-1">(takes ~2 minutes)</span>
          </h2>

          <div className="space-y-3">
            {STEPS.map((s, i) => {
              const isActive = i + 1 === currentStep;
              const isDone = i + 1 < currentStep;
              return (
                <motion.div
                  key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                  onClick={() => setCurrentStep(i + 1)}
                  className={`glass p-4 flex gap-4 items-start cursor-pointer transition-all duration-200 ${
                    isActive ? 'border-neonCyan/40 bg-neonCyan/3' :
                    isDone ? 'border-neonGreen/20 opacity-70' : 'hover:border-white/10'
                  }`}
                >
                  {/* Step number / check */}
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-all ${
                    isDone ? 'bg-neonGreen/10 border-neonGreen/30' :
                    isActive ? s.iconBg + ' scale-110' : s.iconBg
                  }`}>
                    {isDone
                      ? <CheckCircle className="w-5 h-5 text-neonGreen" />
                      : <s.icon className={`w-5 h-5 ${s.color}`} />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-gray-600">0{s.num}</span>
                      <h3 className="text-sm font-display font-bold text-white">{s.title}</h3>
                      {isDone && <span className="ml-auto text-[10px] text-neonGreen font-medium">Done ✓</span>}
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{s.desc}</p>
                    {s.extra && <div className="mt-2">{s.extra}</div>}
                    <div className="flex items-start gap-1.5 mt-2">
                      <AlertCircle className="w-3 h-3 text-gray-600 shrink-0 mt-0.5" />
                      <span className="text-[10px] text-gray-500">{s.tip}</span>
                    </div>
                  </div>

                  <div className="text-5xl font-display font-black text-white/4 select-none shrink-0">
                    {s.num}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── Mark all done ── */}
        {currentStep > 0 && currentStep <= 5 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center mb-8"
          >
            <button onClick={() => setCurrentStep(6)}
              className="text-xs text-gray-500 hover:text-neonGreen transition-colors underline underline-offset-2"
            >
              I completed all steps — mark as done ✓
            </button>
          </motion.div>
        )}

        {currentStep >= 6 && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="glass p-6 text-center border-neonGreen/30 mb-8"
          >
            <span className="text-4xl mb-3 block">🎉</span>
            <h3 className="text-neonGreen font-bold text-lg mb-1">AegisGuard is Installed!</h3>
            <p className="text-gray-400 text-sm">
              Click the puzzle icon (🧩) in your Chrome toolbar and pin AegisGuard to use it anytime.
            </p>
          </motion.div>
        )}

        {/* ── Why not Web Store? ── */}
        <WhyNotWebStore />

      </div>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
