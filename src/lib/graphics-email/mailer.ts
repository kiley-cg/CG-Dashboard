/**
 * Gmail sender for the daily graphics queue email.
 *
 * Uses nodemailer with a Gmail App Password.
 *
 * Required environment variables:
 *   EMAIL_USER          — sending address: kiley@colorgraphicswa.com
 *   EMAIL_APP_PASSWORD  — Gmail App Password (16-char, no spaces)
 *                         Generate at: https://myaccount.google.com/apppasswords
 *   EMAIL_TO            — recipient(s): sales@colorgraphicswa.com
 *                         Comma-separate multiple addresses if needed.
 */

import nodemailer from 'nodemailer'

function createTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER!,
      pass: process.env.EMAIL_APP_PASSWORD!
    }
  })
}

export async function sendGraphicsEmail(options: {
  subject: string
  html: string
}): Promise<void> {
  const transporter = createTransport()

  const to = process.env.EMAIL_TO || 'sales@colorgraphicswa.com'
  const from = `"Color Graphics" <${process.env.EMAIL_USER || 'kiley@colorgraphicswa.com'}>`

  await transporter.sendMail({
    from,
    to,
    subject: options.subject,
    html: options.html
  })
}
