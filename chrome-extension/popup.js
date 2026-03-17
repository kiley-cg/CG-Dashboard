'use strict';

document.getElementById('btn-settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

const info = document.getElementById('order-info');
info.textContent = 'Loading...';

// lastFocusedWindow gets the browser window (not the popup window)
chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
  if (chrome.runtime.lastError) {
    info.textContent = 'Error: ' + chrome.runtime.lastError.message;
    return;
  }

  const url = tabs[0]?.url || '';
  info.textContent = 'URL: ' + (url || '(empty)');

  const m = url.match(/\/SalesOrder\/Details\/([A-Za-z0-9\-]+)/)
    || url.match(/\/orders\/sales-orders\/([A-Za-z0-9\-]+)/)
    || url.match(/salesorder[^/]*\/([A-Za-z0-9\-]+)/i)
    || url.match(/\/jobs\/([A-Za-z0-9\-]+)/);

  if (m) {
    info.innerHTML = `Order detected: <span id="order-num">${m[1]}</span>`;
  } else if (url.includes('syncore.app') || url.includes('ateasesystems.net')) {
    info.textContent = 'On Syncore — no order ID in URL: ' + url;
  }
});
