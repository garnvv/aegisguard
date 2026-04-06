import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// Helper: post JSON and return data (handles 4xx gracefully)
async function postJSON(url, body) {
  try {
    const res = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/json' },
      withCredentials: true,
    });
    return res.data;
  } catch (err) {
    const data = err.response?.data;
    if (data) return data;
    return { success: false, error: 'Network error. Is the backend running?' };
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use sessionStorage so login clears when tab/window is closed
    // (localStorage persists forever — sessionStorage is tab-scoped)
    const saved = sessionStorage.getItem('aegis_user');
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch {}
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const data = await postJSON('/auth/login-api', { email, password });
    if (data.success) {
      setUser(data.user);
      // sessionStorage — automatically cleared when browser tab/window closes
      sessionStorage.setItem('aegis_user', JSON.stringify(data.user));
      return { ok: true };
    }
    return { ok: false, error: data.error || 'Login failed. Please try again.' };
  };

  const register = async (name, email, password) => {
    const data = await postJSON('/auth/register-api', { name, email, password });
    if (data.success) return { ok: true };
    return { ok: false, error: data.error || 'Registration failed. Please try again.' };
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('aegis_user');
    axios.get('/logout', { withCredentials: true }).catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
