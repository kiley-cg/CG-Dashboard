/**
 * HTML email template for the daily Graphics Queue report.
 * Uses Color Graphics brand colors and Effra font (with system-sans fallback).
 *
 * Brand colors:
 *   Black    #1A1A1A
 *   CG Red   #E01B2B  (PMS 200)
 *   Teal     #00A8B0  (PMS 320)
 *   White    #FFFFFF
 *   MD Gray  #B1B3B6  (PMS 4282)
 */

import type { QueueDiff, StatusChange } from './diff'
import type { GraphicsJob } from '@/lib/syncore/graphics-queue'

// ── Section header background colors (matching Excel screenshots) ──
const COLORS = {
  summary: '#003087',
  completed: '#2E7D32',
  statusChange: '#1565C0',
  newJobs: '#E65100',
  unchanged: '#616161',
  cgRed: '#E01B2B',
  teal: '#00A8B0',
  black: '#1A1A1A',
  white: '#FFFFFF',
  lightGray: '#F5F5F5',
  headerText: '#FFFFFF',
}

const FONT = `'Effra', 'Arial', 'Helvetica Neue', sans-serif`

// ── Base table styles ──
const tableStyle = `width:100%;border-collapse:collapse;font-family:${FONT};font-size:13px;`
const thStyle = (bg: string) =>
  `background-color:${bg};color:${COLORS.white};padding:8px 10px;text-align:left;font-weight:700;font-size:12px;letter-spacing:0.5px;text-transform:uppercase;`
const tdStyle = `padding:7px 10px;border-bottom:1px solid #E0E0E0;vertical-align:top;`
const tdAlt = `padding:7px 10px;border-bottom:1px solid #E0E0E0;vertical-align:top;background-color:${COLORS.lightGray};`

function daysCell(days: number): string {
  const color = days >= 14 ? COLORS.cgRed : COLORS.black
  const weight = days >= 14 ? '700' : '400'
  return `<td style="${tdStyle}color:${color};font-weight:${weight};">${days}</td>`
}

function sectionHeader(label: string, count: number, bg: string): string {
  return `
  <tr>
    <td colspan="10" style="padding:0;">
      <table style="${tableStyle}margin-top:20px;">
        <tr>
          <td style="${thStyle(bg)}">
            ${label} (${count})
          </td>
        </tr>
      </table>
    </td>
  </tr>`
}

// ── Individual section renderers ──

function renderSummary(diff: QueueDiff, date: string): string {
  const rows = [
    ['Total Jobs (Start of Day)', diff.summary.morningTotal],
    ['Total Jobs (End of Day)', diff.summary.eveningTotal],
    ['Jobs Completed / Removed', diff.summary.completed],
    ['New Jobs Added', diff.summary.newJobs],
    ['Status Changes', diff.summary.statusChanges],
    ['Jobs Unchanged', diff.summary.unchanged],
  ]

  return `
  <table style="${tableStyle}margin-top:24px;">
    <tr>
      <td colspan="2" style="${thStyle(COLORS.summary)}font-size:14px;">
        SUMMARY &mdash; ${date}
      </td>
    </tr>
    ${rows.map(([label, val], i) => `
    <tr>
      <td style="${i % 2 === 0 ? tdStyle : tdAlt}font-weight:600;width:260px;">${label}</td>
      <td style="${i % 2 === 0 ? tdStyle : tdAlt}font-weight:700;">${val}</td>
    </tr>`).join('')}
  </table>`
}

function renderCompleted(jobs: GraphicsJob[]): string {
  if (jobs.length === 0) return ''
  return `
  <table style="${tableStyle}margin-top:24px;">
    <tr>
      <td colspan="5" style="${thStyle(COLORS.completed)}">
        ✓ Jobs Completed / Removed from Board (${jobs.length})
      </td>
    </tr>
    <tr>
      <th style="${thStyle('#388E3C')}width:90px;">Job #</th>
      <th style="${thStyle('#388E3C')}">PM Status</th>
      <th style="${thStyle('#388E3C')}">Client</th>
      <th style="${thStyle('#388E3C')}">Description</th>
      <th style="${thStyle('#388E3C')}width:110px;">Days in Queue</th>
    </tr>
    ${jobs.map((j, i) => `
    <tr>
      <td style="${i % 2 === 0 ? tdStyle : tdAlt}">${j.jobNumber}</td>
      <td style="${i % 2 === 0 ? tdStyle : tdAlt}">${j.status}</td>
      <td style="${i % 2 === 0 ? tdStyle : tdAlt}">${j.client}</td>
      <td style="${i % 2 === 0 ? tdStyle : tdAlt}">${j.description}</td>
      ${daysCell(j.daysInQueue)}
    </tr>`).join('')}
  </table>`
}

function renderStatusChanges(changes: StatusChange[]): string {
  if (changes.length === 0) return ''
  return `
  <table style="${tableStyle}margin-top:24px;">
    <tr>
      <td colspan="6" style="${thStyle(COLORS.statusChange)}">
        ⇄ Status Changes (${changes.length})
      </td>
    </tr>
    <tr>
      <th style="${thStyle('#1976D2')}width:90px;">Job #</th>
      <th style="${thStyle('#1976D2')}">AM Status</th>
      <th style="${thStyle('#1976D2')}">PM Status</th>
      <th style="${thStyle('#1976D2')}">Client</th>
      <th style="${thStyle('#1976D2')}">Description</th>
      <th style="${thStyle('#1976D2')}width:110px;">Days in Queue</th>
    </tr>
    ${changes.map(({ job, previousStatus, newStatus }, i) => `
    <tr>
      <td style="${i % 2 === 0 ? tdStyle : tdAlt}">${job.jobNumber}</td>
      <td style="${i % 2 === 0 ? tdStyle : tdAlt}color:#888;">${previousStatus}</td>
      <td style="${i % 2 === 0 ? tdStyle : tdAlt}font-weight:600;">${newStatus}</td>
      <td style="${i % 2 === 0 ? tdStyle : tdAlt}">${job.client}</td>
      <td style="${i % 2 === 0 ? tdStyle : tdAlt}">${job.description}</td>
      ${daysCell(job.daysInQueue)}
    </tr>`).join('')}
  </table>`
}

function renderNewJobs(jobs: GraphicsJob[]): string {
  if (jobs.length === 0) return ''
  return `
  <table style="${tableStyle}margin-top:24px;">
    <tr>
      <td colspan="7" style="${thStyle(COLORS.newJobs)}">
        ＋ New Jobs Added (${jobs.length})
      </td>
    </tr>
    <tr>
      <th style="${thStyle('#F57C00')}width:90px;">Job #</th>
      <th style="${thStyle('#F57C00')}">Status</th>
      <th style="${thStyle('#F57C00')}">Designer</th>
      <th style="${thStyle('#F57C00')}">Client</th>
      <th style="${thStyle('#F57C00')}">Description</th>
      <th style="${thStyle('#F57C00')}width:90px;">Priority</th>
      <th style="${thStyle('#F57C00')}width:110px;">Days in Queue</th>
    </tr>
    ${jobs.map((j, i) => {
      const isCritical = j.priority?.toUpperCase() === 'CRITICAL'
      return `
    <tr>
      <td style="${i % 2 === 0 ? tdStyle : tdAlt}">${j.jobNumber}</td>
      <td style="${i % 2 === 0 ? tdStyle : tdAlt}">${j.status}</td>
      <td style="${i % 2 === 0 ? tdStyle : tdAlt}${!j.designer ? 'color:#E01B2B;font-weight:600;' : ''}">${j.designer || 'Unassigned'}</td>
      <td style="${i % 2 === 0 ? tdStyle : tdAlt}">${j.client}</td>
      <td style="${i % 2 === 0 ? tdStyle : tdAlt}">${j.description}</td>
      <td style="${i % 2 === 0 ? tdStyle : tdAlt}${isCritical ? 'color:#E01B2B;font-weight:700;' : ''}">${j.priority || 'Standard'}</td>
      ${daysCell(j.daysInQueue)}
    </tr>`}).join('')}
  </table>`
}

function renderUnchanged(jobs: GraphicsJob[]): string {
  if (jobs.length === 0) return ''
  return `
  <table style="${tableStyle}margin-top:24px;">
    <tr>
      <td colspan="5" style="${thStyle(COLORS.unchanged)}">
        Jobs Unchanged (${jobs.length})
      </td>
    </tr>
    <tr>
      <th style="${thStyle('#757575')}width:90px;">Job #</th>
      <th style="${thStyle('#757575')}">Status</th>
      <th style="${thStyle('#757575')}">Client</th>
      <th style="${thStyle('#757575')}">Description</th>
      <th style="${thStyle('#757575')}width:110px;">Days in Queue</th>
    </tr>
    ${jobs.map((j, i) => `
    <tr>
      <td style="${i % 2 === 0 ? tdStyle : tdAlt}">${j.jobNumber}</td>
      <td style="${i % 2 === 0 ? tdStyle : tdAlt}">${j.status}</td>
      <td style="${i % 2 === 0 ? tdStyle : tdAlt}">${j.client}</td>
      <td style="${i % 2 === 0 ? tdStyle : tdAlt}">${j.description}</td>
      ${daysCell(j.daysInQueue)}
    </tr>`).join('')}
  </table>`
}

// ── Main template export ──

export function buildEmailHtml(diff: QueueDiff, reportDate: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Graphics Queue — ${reportDate}</title>
  <link href="https://fonts.googleapis.com/css2?family=Effra:wght@400;500;700&display=swap" rel="stylesheet" />
  <style>
    body { margin:0; padding:0; background:#F0F0F0; font-family:${FONT}; }
    a { color:${COLORS.teal}; }
  </style>
</head>
<body>
  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F0F0;padding:20px 0;">
    <tr>
      <td align="center">
        <!-- Email card -->
        <table width="720" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:4px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.12);">

          <!-- ── Header ── -->
          <tr>
            <td style="background:${COLORS.black};padding:20px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-family:${FONT};font-size:22px;font-weight:700;color:${COLORS.white};letter-spacing:1px;">
                      COLOR GRAPHICS
                    </span>
                    <br/>
                    <span style="font-family:${FONT};font-size:11px;font-weight:400;color:${COLORS.teal};letter-spacing:2px;text-transform:uppercase;">
                      An Alaska Native-Owned Company
                    </span>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="font-family:${FONT};font-size:13px;color:#999;font-weight:400;">
                      Graphics Queue Report
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Red accent bar ── -->
          <tr>
            <td style="background:${COLORS.cgRed};height:4px;line-height:4px;font-size:4px;">&nbsp;</td>
          </tr>

          <!-- ── Subheader ── -->
          <tr>
            <td style="background:#222;padding:10px 28px;">
              <span style="font-family:${FONT};font-size:15px;font-weight:600;color:${COLORS.white};">
                Graphics Tracker &mdash; ${reportDate}
              </span>
              <span style="font-family:${FONT};font-size:12px;color:#AAAAAA;margin-left:12px;">
                Daily Summary (AM to PM)
              </span>
            </td>
          </tr>

          <!-- ── Body content ── -->
          <tr>
            <td style="padding:20px 28px 32px;">

              ${renderSummary(diff, reportDate)}
              ${renderCompleted(diff.completed)}
              ${renderStatusChanges(diff.statusChanged)}
              ${renderNewJobs(diff.newJobs)}
              ${renderUnchanged(diff.unchanged)}

              <!-- Days legend -->
              <p style="margin-top:24px;font-size:11px;color:#999;font-family:${FONT};">
                <span style="color:${COLORS.cgRed};font-weight:700;">Red days</span> indicate jobs with 14+ days in queue.
                Unassigned designers shown in <span style="color:${COLORS.cgRed};font-weight:700;">red</span>.
              </p>

            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="background:${COLORS.black};padding:16px 28px;border-top:3px solid ${COLORS.cgRed};">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-family:${FONT};font-size:12px;color:#999;">
                      Color Graphics &bull; An Alaska Native-Owned Company<br/>
                      <a href="https://colorgraphicswa.com" style="color:${COLORS.teal};text-decoration:none;">colorgraphicswa.com</a>
                    </span>
                  </td>
                  <td align="right">
                    <span style="font-family:${FONT};font-size:11px;color:#555;">
                      Automated report &bull; Do not reply
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildEmailSubject(reportDate: string): string {
  return `Graphics Queue — Daily Summary — ${reportDate}`
}
