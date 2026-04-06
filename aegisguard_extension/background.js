// background.js — AegisGuard.AI Service Worker
// Runs in background; handles badge updates

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: '#00F5FF' });
  chrome.action.setTitle({ title: 'AegisGuard.AI — Click to Scan' });
});
