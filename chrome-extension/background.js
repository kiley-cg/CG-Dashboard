'use strict';

// Open the side panel when the user clicks the extension icon (direct user gesture)
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Receive order number from content script → store it in session storage
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== 'ORDER_DETECTED') return;

  const tabId = sender.tab?.id;
  if (!tabId) return;

  chrome.storage.session.set({ orderNumber: msg.orderNumber, tabId });
});
