/**
 * Side panel logic.
 * Runs as a privileged extension page — direct access to chrome.storage and fetch.
 */

'use strict';

let orderNumber = null;
let proposal = null;
let dashboardUrl = 'https://syncore-pricing--syncoreai-8aa40.us-central1.hosted.app';
let apiKey = '';

const ALL_STATES = ['waiting', 'idle', 'thinking', 'proposal', 'applying', 'done', 'error'];

// --- State display ---

function showState(name) {
  ALL_STATES.forEach(s => {
    document.getElementById('state-' + s).classList.toggle('hidden', s !== name);
  });
}

// --- Init: load settings + current order from session storage ---

async function init() {
  const [session, local] = await Promise.all([
    chrome.storage.session.get(['orderNumber']),
    chrome.storage.local.get(['dashboardUrl', 'apiKey']),
  ]);

  dashboardUrl = local.dashboardUrl || 'http://localhost:3000';
  apiKey = local.apiKey || '';

  if (session.orderNumber) {
    activateOrder(session.orderNumber);
  } else {
    showState('waiting');
  }
}

function activateOrder(num) {
  orderNumber = num;
  proposal = null;

  document.getElementById('order-display').textContent = num;
  document.getElementById('order-badge').textContent = 'SO: ' + num;
  document.getElementById('order-badge').classList.remove('hidden');
  document.getElementById('btn-run').disabled = false;

  if (!apiKey) {
    document.getElementById('config-warning').classList.remove('hidden');
  } else {
    document.getElementById('config-warning').classList.add('hidden');
  }

  showState('idle');
}

// React when content script detects a new order (SPA navigation)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && changes.orderNumber) {
    const newOrder = changes.orderNumber.newValue;
    if (newOrder && newOrder !== orderNumber) {
      activateOrder(newOrder);
    }
  }
  if (area === 'local' && (changes.dashboardUrl || changes.apiKey)) {
    dashboardUrl = changes.dashboardUrl?.newValue || dashboardUrl;
    apiKey = changes.apiKey?.newValue || apiKey;
  }
});

// --- Header buttons ---

document.getElementById('btn-settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('open-options').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// --- Run Pricing ---

document.getElementById('btn-run').addEventListener('click', () => runPropose());

async function runPropose() {
  if (!orderNumber) return;
  showState('thinking');
  const log = document.getElementById('thinking-log');
  log.innerHTML = '';
  proposal = null;

  if (!apiKey) {
    showError('API key not set. Open Settings to configure your Extension API Key.');
    return;
  }
  if (!dashboardUrl || dashboardUrl === 'http://localhost:3000') {
    showError('Dashboard URL not configured. Open Settings and enter your hosted dashboard URL.');
    return;
  }

  try {
    await streamAgent('propose', null, (event) => {
      if (event.type === 'reasoning') {
        appendLog(log, event.text, 'reasoning');
      } else if (event.type === 'tool_call') {
        appendLog(log, '⚙ ' + event.name, 'tool');
      } else if (event.type === 'proposal') {
        proposal = event.lines;
      } else if (event.type === 'complete') {
        if (!proposal) appendLog(log, event.summary, 'reasoning');
      } else if (event.type === 'error') {
        throw new Error(event.message);
      }
    });

    if (proposal && proposal.length > 0) {
      renderProposal(proposal);
      showState('proposal');
    } else {
      showError('No pricing proposal was returned. Check the Full UI for details.');
    }
  } catch (err) {
    showError(err.message);
  }
}

// --- Approve & Apply ---

document.getElementById('btn-approve').addEventListener('click', () => runApply());

async function runApply() {
  if (!proposal) return;
  showState('applying');
  const log = document.getElementById('apply-log');
  log.innerHTML = '';

  try {
    await streamAgent('apply', proposal, (event) => {
      if (event.type === 'reasoning') {
        appendLog(log, event.text, 'reasoning');
      } else if (event.type === 'tool_call') {
        appendLog(log, '✎ ' + event.name, 'tool');
      } else if (event.type === 'tool_result') {
        const ok = event.result?.success !== false;
        appendLog(log, ok ? '✓ Price written' : '✗ ' + (event.result?.error || 'failed'), ok ? 'success' : 'error-line');
      } else if (event.type === 'error') {
        throw new Error(event.message);
      }
    });

    showState('done');
  } catch (err) {
    showError(err.message);
  }
}

// --- Reject / Reset / Retry ---

document.getElementById('btn-reject').addEventListener('click', () => {
  proposal = null;
  showState('idle');
});

document.getElementById('btn-reset').addEventListener('click', () => {
  proposal = null;
  showState('idle');
});

document.getElementById('btn-retry').addEventListener('click', () => runPropose());

// --- Open Full UI ---

document.getElementById('btn-open-full').addEventListener('click', () => {
  const url = dashboardUrl + '/pricing' + (orderNumber ? '?order=' + encodeURIComponent(orderNumber) : '');
  chrome.tabs.create({ url });
});

// --- SSE streaming helper ---

async function streamAgent(mode, approvedProposal, onEvent) {
  const body = {
    task: 'pricing',
    mode,
    input: {
      orderNumber,
      ...(approvedProposal ? { proposal: approvedProposal } : {}),
    },
  };

  const response = await fetch(dashboardUrl + '/api/agent/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-extension-api-key': apiKey } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`API error ${response.status}: ${text}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const json = line.slice(6).trim();
      if (!json) continue;
      let parsed;
      try { parsed = JSON.parse(json); } catch { continue; } // skip malformed JSON only
      onEvent(parsed); // let callback errors propagate so error events surface
    }
  }
}

// --- Proposal table renderer ---

function renderProposal(lines) {
  const tbody = document.getElementById('proposal-tbody');
  tbody.innerHTML = '';

  for (const line of lines) {
    if (line.skip) {
      const tr = document.createElement('tr');
      tr.className = 'skipped';
      tr.innerHTML = `<td colspan="4"><span class="skip-reason">⚠ ${escHtml(line.description || line.sku || 'Unknown')} — skipped: ${escHtml(line.skipReason || 'unknown reason')}</span></td>`;
      tbody.appendChild(tr);
      continue;
    }

    const current = typeof line.currentPrice === 'number' ? '$' + line.currentPrice.toFixed(2) : '—';
    const proposed = typeof line.calculatedPrice === 'number' ? '$' + line.calculatedPrice.toFixed(2) : '—';
    const diff = (typeof line.currentPrice === 'number' && typeof line.calculatedPrice === 'number' && line.currentPrice > 0)
      ? Math.round((line.calculatedPrice - line.currentPrice) / line.currentPrice * 100)
      : null;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="line-desc">${escHtml(line.description || line.sku || '')}</div>
        ${line.breakdown ? `<div class="line-breakdown">${escHtml(line.breakdown)}</div>` : ''}
      </td>
      <td class="num">${line.quantity ?? '—'}</td>
      <td class="num">${current}</td>
      <td class="num highlight">
        ${proposed}
        ${diff !== null ? `<span class="diff ${diff >= 0 ? 'diff-up' : 'diff-down'}">${diff >= 0 ? '+' : ''}${diff}%</span>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  }
}

// --- Helpers ---

function appendLog(container, text, type) {
  const div = document.createElement('div');
  div.className = 'log-line log-' + type;
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showError(msg) {
  document.getElementById('error-msg').textContent = msg;
  showState('error');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- Start ---
init();
