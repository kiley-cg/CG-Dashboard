'use strict';

const urlInput = document.getElementById('dashboardUrl');
const keyInput = document.getElementById('apiKey');
const status = document.getElementById('status');

// Load saved settings
chrome.storage.local.get(['dashboardUrl', 'apiKey'], (stored) => {
  if (stored.dashboardUrl) urlInput.value = stored.dashboardUrl;
  if (stored.apiKey) keyInput.value = stored.apiKey;
});

document.getElementById('btn-save').addEventListener('click', () => {
  const url = urlInput.value.trim().replace(/\/$/, '');
  const key = keyInput.value.trim();

  if (!url) {
    status.style.color = '#fc8181';
    status.textContent = 'Dashboard URL is required.';
    return;
  }

  chrome.storage.local.set({ dashboardUrl: url, apiKey: key }, () => {
    status.style.color = '#68d391';
    status.textContent = 'Settings saved.';
    setTimeout(() => { status.textContent = ''; }, 2500);
  });
});
