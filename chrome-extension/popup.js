'use strict';

let cachedTabId = null;

document.getElementById('btn-settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('btn-open-panel').addEventListener('click', () => {
  if (cachedTabId) chrome.sidePanel.open({ tabId: cachedTabId });
});

// Pre-load tabId and order number so they're ready on button click (no async in handler)
chrome.storage.session.get(['orderNumber', 'tabId'], ({ orderNumber, tabId }) => {
  cachedTabId = tabId || null;
  const info = document.getElementById('order-info');
  if (orderNumber) {
    info.innerHTML = `Order: <span id="order-num">${orderNumber}</span>`;
  }
});
