import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Home, Search, PuzzleIcon, LogIn, LogOut, User, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';

const NAV = [
  { to: '/',         label: 'Home',      icon: Home },
  { to: '/scanner',  label: 'URL Scanner', icon: Search },
  { to: '/extension',label: 'Extension',  icon: PuzzleIcon },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showAuth, setShowAuth] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <>
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4"
        style={{ background: 'rgba(7,12,24,0.8)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(30,58,95,0.4)' }}
      >
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2.5 group">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-neonCyan/10 border border-neonCyan/30 flex items-center justify-center group-hover:bg-neonCyan/20 transition-colors">
              <Shield className="w-4 h-4 text-neonCyan" />
            </div>
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-neonGreen rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-neonGreen rounded-full" />
          </div>
          <div className="leading-none">
            <p className="text-sm font-display font-bold tracking-wide">
              AegisGuard<span className="text-neonPurple">.AI</span>
            </p>
            <p className="text-[9px] text-gray-500 uppercase tracking-[2px]">Threat Intelligence</p>
          </div>
        </NavLink>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-neonCyan/10 text-neonCyan border border-neonCyan/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </NavLink>
          ))}
        </div>

        {/* Auth */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass-subtle text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-neonPurple/20 border border-neonPurple/30 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-neonPurple" />
                </div>
                <span className="hidden sm:block">{user.name?.split(' ')[0] || 'User'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-44 glass rounded-xl overflow-hidden shadow-xl"
                  >
                    <div className="px-4 py-3 border-b border-white/5">
                      <p className="text-xs font-semibold text-white">{user.name}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => { logout(); setShowUserMenu(false); navigate('/'); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Sign Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button onClick={() => setShowAuth(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-neonCyan/10 border border-neonCyan/25 text-neonCyan hover:bg-neonCyan/20 transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>

        {/* Mobile nav */}
        <div className="flex md:hidden gap-1 ml-2">
          {NAV.map(({ to, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                `p-2 rounded-lg transition-colors ${isActive ? 'text-neonCyan bg-neonCyan/10' : 'text-gray-500 hover:text-white'}`
              }
            >
              <Icon className="w-4 h-4" />
            </NavLink>
          ))}
        </div>
      </motion.nav>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
