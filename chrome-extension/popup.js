'use strict';

document.getElementById('btn-settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Try to detect order number from the active tab's URL
chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
  const url = tabs[0]?.url || '';
  const info = document.getElementById('order-info');

  // DEBUG: show raw URL
  info.textContent = 'URL: ' + (url || '(empty)');

  const m = url.match(/\/SalesOrder\/Details\/([A-Za-z0-9\-]+)/)
    || url.match(/\/orders\/sales-orders\/([A-Za-z0-9\-]+)/)
    || url.match(/\/jobs\/([A-Za-z0-9\-]+)/);

  if (m) {
    info.innerHTML = `Order detected: <span id="order-num">${m[1]}</span>`;
  } else if (url.includes('syncore.app') || url.includes('ateasesystems.net')) {
    info.textContent = 'On Syncore — no order ID found in URL.';
  }
});
