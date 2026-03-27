/**
 * Content script — injected into Syncore sales order pages.
 * Detects the order number and notifies the background worker to open the side panel.
 */

(function () {
  'use strict';

  // --- Order ID detection ---

  function detectOrderNumber() {
    const url = window.location.href;

    // --- 1. URL query params (unambiguous — identifies this specific page) ---
    const params = new URLSearchParams(window.location.search);
    for (const key of ['soId', 'salesOrderId', 'jobId', 'orderId', 'so_id', 'job_id', 'order_id', 'id']) {
      if (params.get(key)) return params.get(key);
    }

    // --- 2. URL path patterns ---
    const pathMatch = url.match(/\/SalesOrder\/Details\/([A-Za-z0-9\-]+)/i)
      || url.match(/\/sales-orders\/(?:view\/|edit\/|details\/)?([A-Za-z0-9\-]+)/i)
      || url.match(/\/orders\/sales-orders\/([A-Za-z0-9\-]+)/i)
      || url.match(/\/jobs\/([A-Za-z0-9\-]+)/i);
    if (pathMatch) return pathMatch[1];

    // --- 3. DOM-based: extract the human-readable SO# ---
    // Matches "SO # 31954-1", "SO #31954-1", "SO# 31954-1", "SalesOrder #31954-1"
    const soPattern = /\bSO\s*#\s*([\d]+-[\d]+|[\d]+)/i;
    const breadcrumbPattern = /SalesOrder\s*#([\d]+-[\d]+|[\d]+)/i;

    // Check headings first (page title area — most specific to current page)
    const headings = Array.from(document.querySelectorAll(
      'h1, h2, h3, [class*="title"], [class*="header"], [class*="heading"], [class*="page-title"]'
    )).map(el => el.textContent.trim()).filter(t => t.length < 100);

    for (const t of headings) {
      const m = t.match(breadcrumbPattern) || t.match(soPattern);
      if (m) return m[1];
    }

    // Check breadcrumb navigation
    const breadcrumbs = Array.from(document.querySelectorAll(
      '.breadcrumb, [class*="breadcrumb"], nav a, [aria-label*="breadcrumb"] a, [aria-label*="Breadcrumb"] a'
    )).map(el => el.textContent.trim()).filter(t => t.length < 80);

    for (const t of breadcrumbs) {
      const m = t.match(breadcrumbPattern) || t.match(soPattern);
      if (m) return m[1];
    }

    // Check other nav/link/span elements (but NOT td — too broad, would match table rows)
    const navTexts = Array.from(document.querySelectorAll('a, li, span'))
      .map(el => el.textContent.trim())
      .filter(t => t.length < 80);

    for (const t of navTexts) {
      const m = t.match(breadcrumbPattern) || t.match(soPattern);
      if (m) return m[1];
    }

    // --- 4. Full body text (last resort) ---
    const bodyText = document.body?.innerText || '';
    const bodyMatch = bodyText.match(soPattern);
    if (bodyMatch) return bodyMatch[1];

    // --- 5. Data attributes ---
    const selectors = ['[data-order-id]', '[data-so-id]', '[data-job-id]'];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const val = el.getAttribute('data-order-id') || el.getAttribute('data-so-id') || el.getAttribute('data-job-id');
        if (val) return val;
      }
    }

    return null;
  }

  // --- Notify background worker ---

  function notifyOrderDetected(orderNumber) {
    chrome.runtime.sendMessage({ type: 'ORDER_DETECTED', orderNumber });
  }

  function notifyOrderCleared() {
    chrome.runtime.sendMessage({ type: 'ORDER_CLEARED' });
  }

  // --- Init ---

  const orderNumber = detectOrderNumber();
  if (orderNumber) {
    notifyOrderDetected(orderNumber);
  } else {
    // Clear any stale order from a previous page visit
    notifyOrderCleared();
  }

  // Watch for SPA navigation (URL changes without page reload)
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      const newOrder = detectOrderNumber();
      if (newOrder) {
        notifyOrderDetected(newOrder);
      } else {
        notifyOrderCleared();
      }
    }
  }).observe(document.body, { subtree: true, childList: true });

})();
