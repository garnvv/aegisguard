import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ParticleCanvas from './components/ParticleCanvas';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import ScannerPage from './pages/ScannerPage';
import ExtensionPage from './pages/ExtensionPage';
import './index.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-darkBg text-white relative">
          <ParticleCanvas />
          <Navbar />
          <Routes>
            <Route path="/"          element={<HomePage />} />
            <Route path="/scanner"   element={<ScannerPage />} />
            <Route path="/extension" element={<ExtensionPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
