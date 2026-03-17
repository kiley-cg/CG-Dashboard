/**
 * Content script — injected into Syncore sales order pages.
 * Detects the order number and injects the floating overlay iframe.
 */

(function () {
  'use strict';

  // Avoid double-injection
  if (document.getElementById('cg-pricing-overlay-container')) return;

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
    const selectors = [
      '[data-order-id]',
      '[data-so-id]',
      '[data-job-id]',
    ];
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

  // --- Overlay injection ---

  function injectOverlay(orderNumber) {
    const extUrl = chrome.runtime.getURL('overlay.html');

    const container = document.createElement('div');
    container.id = 'cg-pricing-overlay-container';
    container.style.cssText = [
      'position: fixed',
      'bottom: 24px',
      'right: 24px',
      'width: 580px',
      'height: 480px',
      'z-index: 2147483647',
      'box-shadow: 0 8px 32px rgba(0,0,0,0.28)',
      'border-radius: 10px',
      'overflow: hidden',
      'resize: both',
    ].join(';');

    const iframe = document.createElement('iframe');
    iframe.src = extUrl;
    iframe.id = 'cg-pricing-overlay-frame';
    iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;';
    iframe.setAttribute('allowtransparency', 'true');

    container.appendChild(iframe);
    document.body.appendChild(container);

    // Send order number once iframe is ready
    iframe.addEventListener('load', () => {
      iframe.contentWindow.postMessage({ type: 'INIT', orderNumber }, '*');
    });

    // Listen for close/minimize messages from overlay
    window.addEventListener('message', (e) => {
      if (e.source !== iframe.contentWindow) return;
      if (e.data?.type === 'CLOSE') container.remove();
      if (e.data?.type === 'MINIMIZE') {
        container.style.height = container.style.height === '40px' ? '480px' : '40px';
      }
    });

    makeDraggable(container);
  }

  // --- Drag support ---

  function makeDraggable(el) {
    let startX, startY, startLeft, startBottom;
    let dragging = false;

    // Dragging is handled via messages from the overlay's drag handle
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'DRAG_START') {
        dragging = true;
        startX = e.data.clientX;
        startY = e.data.clientY;
        const rect = el.getBoundingClientRect();
        startLeft = rect.left;
        startBottom = window.innerHeight - rect.bottom;
        el.style.right = 'auto';
        el.style.left = startLeft + 'px';
        el.style.bottom = startBottom + 'px';
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      el.style.left = Math.max(0, startLeft + dx) + 'px';
      el.style.bottom = Math.max(0, startBottom - dy) + 'px';
    });

    document.addEventListener('mouseup', () => { dragging = false; });
  }

  // --- Init ---

  const orderNumber = detectOrderNumber();
  if (orderNumber) {
    injectOverlay(orderNumber);
  }

  // Also watch for SPA navigation (URL changes without page reload)
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      const existing = document.getElementById('cg-pricing-overlay-container');
      if (existing) existing.remove();
      const newOrder = detectOrderNumber();
      if (newOrder) injectOverlay(newOrder);
    }
  }).observe(document.body, { subtree: true, childList: true });

})();
