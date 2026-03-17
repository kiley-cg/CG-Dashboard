'use strict';

document.getElementById('btn-settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('btn-open-panel').addEventListener('click', () => {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (tabId) chrome.sidePanel.open({ tabId });
  });
});

// Show current order if one is active
chrome.storage.session.get(['orderNumber'], ({ orderNumber }) => {
  const info = document.getElementById('order-info');
  if (orderNumber) {
    info.innerHTML = `Order: <span id="order-num">${orderNumber}</span>`;
  }
});
