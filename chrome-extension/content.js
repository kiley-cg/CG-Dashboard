/**
 * Content script — injected into Syncore sales order pages.
 * Detects the order number and notifies the background worker to open the side panel.
 */

(function () {
  'use strict';

  // --- Order ID detection ---

  function detectOrderNumber() {
    const url = window.location.href;

    // Pattern: /SalesOrder/Details/12345 (ateasesystems.net)
    let m = url.match(/\/SalesOrder\/Details\/([A-Za-z0-9\-]+)/);
    if (m) return m[1];

    // Pattern: /orders/sales-orders/12345
    m = url.match(/\/orders\/sales-orders\/([A-Za-z0-9\-]+)/);
    if (m) return m[1];

    // Pattern: /jobs/12345
    m = url.match(/\/jobs\/([A-Za-z0-9\-]+)/);
    if (m) return m[1];

    // Query params: ?soId=12345 or ?jobId=12345 or ?orderId=12345
    const params = new URLSearchParams(window.location.search);
    for (const key of ['soId', 'jobId', 'orderId', 'so_id', 'job_id', 'order_id', 'id']) {
      if (params.get(key)) return params.get(key);
    }

    // DOM fallback: look for order number in page headings or title
    const selectors = ['[data-order-id]', '[data-so-id]', '[data-job-id]'];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const val = el.getAttribute('data-order-id') || el.getAttribute('data-so-id') || el.getAttribute('data-job-id');
        if (val) return val;
      }
    }

    // Title / heading text patterns like "SO-12345" or "Job #89"
    const text = document.title + ' ' + (document.querySelector('h1')?.textContent || '');
    const textMatch = text.match(/\bSO[-#]?\s*(\d+)\b/i) || text.match(/\bJob\s*#?\s*(\d+)\b/i);
    if (textMatch) return textMatch[1];

    return null;
  }

  // --- Notify background worker ---

  function notifyOrderDetected(orderNumber) {
    chrome.runtime.sendMessage({ type: 'ORDER_DETECTED', orderNumber });
  }

  // --- Init ---

  const orderNumber = detectOrderNumber();
  if (orderNumber) {
    notifyOrderDetected(orderNumber);
  }

  // Watch for SPA navigation (URL changes without page reload)
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      const newOrder = detectOrderNumber();
      if (newOrder) notifyOrderDetected(newOrder);
    }
  }).observe(document.body, { subtree: true, childList: true });

})();
