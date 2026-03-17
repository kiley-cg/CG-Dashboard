'use strict';

// When the extension is installed/updated, configure the side panel to open on icon click
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// Receive order number from content script → store it + open the side panel
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== 'ORDER_DETECTED') return;

  const tabId = sender.tab?.id;
  if (!tabId) return;

  chrome.storage.session.set({ orderNumber: msg.orderNumber, tabId });
  chrome.sidePanel.open({ tabId });
});
