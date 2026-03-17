/**
 * Content script — injected into Syncore sales order pages.
 * Detects the order number and notifies the background worker to open the side panel.
 */

(function () {
  'use strict';

  // --- Order ID detection ---

  function detectOrderNumber() {
    const url = window.location.href;

    // --- DOM-first: extract the human-readable SO# from the page ---
    // Matches "SO # 31954-1", "SO #31954-1", "SO# 31954-1", "SalesOrder #31954-1"
    const soPattern = /\bSO\s*#\s*([\d]+-[\d]+|[\d]+)/i;
    const breadcrumbPattern = /SalesOrder\s*#([\d]+-[\d]+|[\d]+)/i;

    // Check breadcrumb / nav links first (most reliable on ateasesystems.net)
    const navTexts = Array.from(document.querySelectorAll('a, li, span, td, h1, h2, h3, .breadcrumb, [class*="breadcrumb"]'))
      .map(el => el.textContent.trim())
      .filter(t => t.length < 80);

    for (const t of navTexts) {
      let m = t.match(breadcrumbPattern) || t.match(soPattern);
      if (m) return m[1];
    }

    // Check full page body text for "SO # XXXXX" pattern
    const bodyText = document.body?.innerText || '';
    const bodyMatch = bodyText.match(soPattern);
    if (bodyMatch) return bodyMatch[1];

    // Check data attributes
    const selectors = ['[data-order-id]', '[data-so-id]', '[data-job-id]'];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const val = el.getAttribute('data-order-id') || el.getAttribute('data-so-id') || el.getAttribute('data-job-id');
        if (val) return val;
      }
    }

    // --- URL fallback (returns internal DB id, not SO#, but better than nothing) ---

    // Query params: ?soId=12345 or ?jobId=12345 or ?orderId=12345
    const params = new URLSearchParams(window.location.search);
    for (const key of ['soId', 'jobId', 'orderId', 'so_id', 'job_id', 'order_id', 'id']) {
      if (params.get(key)) return params.get(key);
    }

    // Pattern: /SalesOrder/Details/12345 or /orders/sales-orders/12345 or /jobs/12345
    let m = url.match(/\/SalesOrder\/Details\/([A-Za-z0-9\-]+)/)
      || url.match(/\/orders\/sales-orders\/([A-Za-z0-9\-]+)/)
      || url.match(/\/jobs\/([A-Za-z0-9\-]+)/);
    if (m) return m[1];

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
