/**
 * popup.js — AegisGuard.AI Chrome Extension UI Logic
 * AUTO-SCAN: Triggers scan immediately when popup opens on any page.
 */

// ── DOM References ────────────────────────────────────────────────────
const urlInput        = document.getElementById('url-input');
const scanBtn         = document.getElementById('scan-btn');
const btnText         = document.getElementById('btn-text');
const btnSpinner      = document.getElementById('btn-spinner');
const resultSection   = document.getElementById('result-section');
const errorBox        = document.getElementById('error-box');
const errorMsg        = document.getElementById('error-msg');
const currentTabEl    = document.getElementById('current-tab-url');
const useServerToggle = document.getElementById('use-server');
const autoScanStatus  = document.getElementById('auto-scan-status');
const scanOverlay     = document.getElementById('scan-overlay');
const overlayStatus   = document.getElementById('overlay-status');

// Result elements
const gaugeEl       = document.getElementById('gauge');
const gaugeText     = document.getElementById('gauge-text');
const verdictBadge  = document.getElementById('verdict-badge');
const verdictLabel  = document.getElementById('verdict-label');
const attackTypeEl  = document.getElementById('attack-type');
const dataRiskEl    = document.getElementById('data-risk');
const reasonsList   = document.getElementById('reasons-list');
const scannedUrlEl  = document.getElementById('scanned-url');
const useModeEl     = document.getElementById('use-mode');

// ── Skippable URL prefixes (don't auto-scan internal Chrome pages) ───
const SKIP_PREFIXES = ['chrome://', 'chrome-extension://', 'about:', 'file://'];

// ── Overlay helpers ──────────────────────────────────────────────────
function showOverlay(msg) {
  if (overlayStatus) overlayStatus.textContent = msg || 'Running security checks...';
  scanOverlay.classList.remove('hidden');
}
function hideOverlay() {
  scanOverlay.classList.add('hidden');
}

// ── Load saved server preference (default OFF) ───────────────────────
chrome.storage.local.get(['useServer'], (result) => {
  // Default to OFF — JS engine works offline and gives same results
  useServerToggle.checked = result.useServer === true;

  // After preference is loaded, get the active tab and AUTO-SCAN
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs && tabs[0] && tabs[0].url) {
      const tabUrl = tabs[0].url;

      // Fill input field
      urlInput.value = tabUrl;

      // Show truncated URL in tab strip
      const short = tabUrl.length > 48 ? tabUrl.slice(0, 45) + '…' : tabUrl;
      currentTabEl.textContent = short;
      currentTabEl.title = tabUrl;

      // Check if this is a scannable URL (not chrome:// etc)
      const isSkippable = SKIP_PREFIXES.some(p => tabUrl.startsWith(p));

      if (isSkippable) {
        autoScanStatus.textContent = '⚠️ Cannot scan internal browser pages.';
        autoScanStatus.style.color = '#f59e0b';
      } else {
        // ✅ AUTO-SCAN: Trigger scan immediately
        autoScanStatus.textContent = '⚡ Scanning current page...';
        autoScanStatus.style.color = '#00f5ff';
        runScan(tabUrl);
      }
    } else {
      autoScanStatus.textContent = '⚠️ Could not detect current page URL.';
      autoScanStatus.style.color = '#f59e0b';
    }
  });
});

// ── Server toggle — save preference ──────────────────────────────────
useServerToggle.addEventListener('change', () => {
  chrome.storage.local.set({ useServer: useServerToggle.checked });
});

// ── Manual scan button ───────────────────────────────────────────────
scanBtn.addEventListener('click', () => {
  const url = urlInput.value.trim();
  if (!url) { showError('Please enter a URL to scan.'); return; }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    showError('URL must start with http:// or https://');
    return;
  }
  runScan(url);
});

// ── Core scan function ────────────────────────────────────────────────
async function runScan(url) {
  // Reset UI
  hideError();
  resultSection.classList.add('hidden');
  scanBtn.disabled = true;
  btnText.classList.add('hidden');
  btnSpinner.classList.remove('hidden');

  // Show scanning overlay with animated rings
  showOverlay('Running 15 security checks...');

  try {
    let result;
    const useServer = useServerToggle.checked;

    if (useServer) {
      overlayStatus.textContent = 'Connecting to AegisGuard server...';
      result = await callFlaskAPI(url);
      if (result._fallback) {
        overlayStatus.textContent = 'Server unavailable — using offline engine...';
        await new Promise(r => setTimeout(r, 300));
      }
    } else {
      overlayStatus.textContent = 'Analysing URL structure...';
      await new Promise(r => setTimeout(r, 150));
      overlayStatus.textContent = 'Checking against threat database...';
      await new Promise(r => setTimeout(r, 150));
      overlayStatus.textContent = 'Evaluating OAuth scopes...';
      await new Promise(r => setTimeout(r, 150));
      result = analyzeURL(url); // from scanner.js
    }

    // Update status bar
    autoScanStatus.textContent = '✅ Scan complete — click icon anytime to re-scan.';
    autoScanStatus.style.color = '#10b981';

    displayResults(
      result,
      url,
      result._fallback
        ? 'Offline Engine (server unreachable)'
        : useServer
        ? 'AegisGuard Server'
        : 'Offline Heuristic Engine'
    );

    updateBadge(result.verdict);

  } catch (err) {
    autoScanStatus.textContent = '❌ Scan error.';
    autoScanStatus.style.color = '#ef4444';
    showError(`Error: ${err.message}`);
  } finally {
    hideOverlay();
    scanBtn.disabled = false;
    btnText.classList.remove('hidden');
    btnSpinner.classList.add('hidden');
  }
}

// ── Update toolbar badge colour based on verdict ─────────────────────
function updateBadge(verdict) {
  const colours = { Green: '#10b981', Yellow: '#f59e0b', Orange: '#f97316', Red: '#ef4444' };
  const labels  = { Green: 'OK', Yellow: '!', Orange: '!!', Red: '🚨' };
  chrome.action.setBadgeBackgroundColor({ color: colours[verdict] || '#64748b' });
  chrome.action.setBadgeText({ text: labels[verdict] || '?' });
}

// ── Call local Flask API — always falls back to JS on network error ──
async function callFlaskAPI(url) {
  try {
    const response = await fetch('http://127.0.0.1:5001/api/ext-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_url: url })
    });

    if (!response.ok) {
      // HTTP error — fall back to JS heuristics silently
      const jsResult = analyzeURL(url);
      jsResult._fallback = true;
      return jsResult;
    }

    const data = await response.json();
    // Map Python verdicts to extension verdicts
    const verdictMap = { 'Green': 'Green', 'Yellow': 'Yellow', 'Orange': 'Orange', 'Red': 'Red' };
    return {
      prob: data.probability,
      score: data.score,
      verdict: verdictMap[data.verdict_code] || data.verdict_code,
      reasons: data.reasons || [],
      attackType: data.attack_type || 'Unknown',
      compromisedData: data.compromised_data || ['Unknown'],
      domain: new URL(url).hostname
    };
  } catch (networkErr) {
    // Network error (server not running) — fall back to JS silently, no error shown
    const jsResult = analyzeURL(url);
    jsResult._fallback = true;
    return jsResult;
  }
}

// ── Render results ────────────────────────────────────────────────────
function displayResults(result, url, mode) {
  const { prob, score, verdict, reasons, attackType, compromisedData } = result;
  // Use score (0-100) if available, else convert prob
  const pct = score !== undefined ? Math.round(score) : Math.round((prob || 0) * 100);

  // Scanned URL
  const short = url.length > 55 ? url.slice(0, 52) + '…' : url;
  scannedUrlEl.textContent = short;
  scannedUrlEl.title = url;
  useModeEl.textContent = mode + (result._fallback ? ' (offline fallback)' : '');

  // Gauge
  gaugeText.textContent = pct + '%';

  // Theme colours based on verdict
  let ringColor, glowColor, badgeBg, badgeText, badgeBorder, labelText, labelIcon;
  if (verdict === 'Green') {
    ringColor = '#10b981'; glowColor = 'rgba(16,185,129,0.5)';
    badgeBg = 'rgba(16,185,129,0.15)'; badgeText = '#6ee7b7';
    badgeBorder = 'rgba(16,185,129,0.4)';
    labelText = 'SAFE — No Significant Threat'; labelIcon = '✅';
  } else if (verdict === 'Yellow') {
    ringColor = '#f59e0b'; glowColor = 'rgba(245,158,11,0.5)';
    badgeBg = 'rgba(245,158,11,0.15)'; badgeText = '#fcd34d';
    badgeBorder = 'rgba(245,158,11,0.4)';
    labelText = 'LOW RISK — Double-check the domain'; labelIcon = '⚠️';
  } else if (verdict === 'Orange') {
    ringColor = '#f97316'; glowColor = 'rgba(249,115,22,0.5)';
    badgeBg = 'rgba(249,115,22,0.15)'; badgeText = '#fdba74';
    badgeBorder = 'rgba(249,115,22,0.4)';
    labelText = 'SUSPICIOUS — Do NOT enter personal data'; labelIcon = '⚠️';
  } else {
    ringColor = '#ef4444'; glowColor = 'rgba(239,68,68,0.5)';
    badgeBg = 'rgba(239,68,68,0.15)'; badgeText = '#fca5a5';
    badgeBorder = 'rgba(239,68,68,0.4)';
    labelText = 'HIGH RISK — Likely Phishing!'; labelIcon = '🚨';
  }

  gaugeEl.style.borderColor = ringColor;
  gaugeEl.style.boxShadow = `0 0 30px ${glowColor}, inset 0 0 20px rgba(0,0,0,0.5)`;
  gaugeText.style.color = ringColor;

  verdictBadge.textContent = verdict.toUpperCase();
  verdictBadge.style.background = badgeBg;
  verdictBadge.style.color = badgeText;
  verdictBadge.style.borderColor = badgeBorder;

  verdictLabel.textContent = `${labelIcon} ${labelText}`;
  verdictLabel.style.color = badgeText;

  attackTypeEl.textContent = attackType;
  dataRiskEl.textContent = Array.isArray(compromisedData)
    ? compromisedData.join(' | ')
    : compromisedData;

  // Reasons list
  reasonsList.innerHTML = '';
  reasons.forEach(r => {
    const li = document.createElement('li');
    li.className = 'reason-item';
    li.textContent = r;
    reasonsList.appendChild(li);
  });

  resultSection.classList.remove('hidden');
}

// ── Helpers ──────────────────────────────────────────────────────────
function showError(msg) {
  errorMsg.textContent = msg;
  errorBox.classList.remove('hidden');
}
function hideError() {
  errorBox.classList.add('hidden');
}

// Enter key on textarea = manual scan
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    scanBtn.click();
  }
});
