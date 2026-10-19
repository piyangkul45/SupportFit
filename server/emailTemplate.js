// เทมเพลตอีเมล OTP ของ SupportFit (dark mode)
// ใช้ table + inline style ทั้งหมด เพราะ Gmail/Outlook ตัด <style> และไม่รองรับ flex/grid

const COLORS = {
  page: '#020617', // slate-950
  card: '#0f172a', // slate-900
  panel: '#111c33',
  border: '#1e293b', // slate-800
  text: '#e2e8f0', // slate-200
  muted: '#94a3b8', // slate-400
  faint: '#64748b', // slate-500
  accent: '#a3e635', // lime-400
  accentSoft: '#ecfccb', // lime-100
  warnBg: '#2a1f0a',
  warnBorder: '#854d0e',
  warnText: '#fde68a',
}

const FONT = "'Segoe UI', 'Noto Sans Thai', 'Sarabun', Roboto, Helvetica, Arial, sans-serif"

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])

// copy = ข้อความทั้งหมดในภาษาของผู้รับ (otpAuth.js สร้างจาก i18n.js)
// { lang, subject, heading, intro, preheader, codeLabel, codeLine, expiry (HTML), expiryText, securityNote, ignoreNote, sentTo }
function renderOtpEmail({ code, copy }) {
  const digits = String(code)
    .split('')
    .map(
      (digit) => `
        <td style="padding:0 4px">
          <div style="width:44px;height:56px;line-height:56px;border-radius:12px;background:${COLORS.page};border:1px solid #3f6212;color:${COLORS.accent};font-family:'SFMono-Regular',Consolas,'Courier New',monospace;font-size:30px;font-weight:700;text-align:center">${digit}</div>
        </td>`
    )
    .join('')

  return `<!doctype html>
<html lang="${copy.lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${escapeHtml(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};-webkit-text-size-adjust:100%">
  <!-- preheader: ข้อความสั้นที่แสดงในรายการอีเมล -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">
    ${escapeHtml(copy.preheader)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.page}" style="background:${COLORS.page}">
    <tr>
      <td align="center" style="padding:40px 16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px">

          <!-- Brand -->
          <tr>
            <td align="center" style="padding-bottom:24px">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:40px;height:40px;border-radius:12px;background:${COLORS.card};border:1px solid #365314;text-align:center;vertical-align:middle;font-size:20px;line-height:40px">🏋️</td>
                  <td style="padding-left:12px;font-family:${FONT};font-size:22px;font-weight:800;letter-spacing:-0.3px;color:#ffffff">
                    Support<span style="color:${COLORS.accent}">Fit</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td bgcolor="${COLORS.card}" style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:20px;overflow:hidden">
              <!-- accent line -->
              <div style="height:4px;background:${COLORS.accent};background-image:linear-gradient(90deg,#bef264,#10b981)"></div>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:36px 32px 8px;font-family:${FONT}">
                    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.35;font-weight:700;color:#ffffff">${escapeHtml(copy.heading)}</h1>
                    <p style="margin:0;font-size:15px;line-height:1.7;color:${COLORS.muted}">${escapeHtml(copy.intro)}</p>
                  </td>
                </tr>

                <!-- OTP display card -->
                <tr>
                  <td style="padding:24px 32px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.panel}" style="background:${COLORS.panel};border:1px solid #365314;border-radius:16px">
                      <tr>
                        <td align="center" style="padding:22px 12px 8px;font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${COLORS.faint}">
                          ${escapeHtml(copy.codeLabel)}
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding:6px 8px 24px">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${digits}</tr></table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Expiry warning -->
                <tr>
                  <td style="padding:0 32px 28px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.warnBg}" style="background:${COLORS.warnBg};border:1px solid ${COLORS.warnBorder};border-radius:12px">
                      <tr>
                        <td style="padding:12px 16px;font-family:${FONT};font-size:13px;line-height:1.6;color:${COLORS.warnText}">
                          ⏱ ${copy.expiry}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 32px 32px;font-family:${FONT};font-size:13px;line-height:1.7;color:${COLORS.faint};border-top:1px solid ${COLORS.border}">
                    <p style="margin:20px 0 0">
                      🔒 ${escapeHtml(copy.securityNote)}<br>
                      ${escapeHtml(copy.ignoreNote)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 16px 0;font-family:${FONT};font-size:12px;line-height:1.7;color:${COLORS.faint}">
              ${escapeHtml(copy.sentTo)}<br>
              <span style="color:${COLORS.accentSoft};opacity:0.6">SupportFit · Voice-to-Data Gym Log &amp; Macro Assistant</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function renderOtpText({ copy }) {
  return [
    'SupportFit',
    '',
    copy.heading,
    copy.intro,
    '',
    copy.codeLine,
    copy.expiryText,
    '',
    copy.securityNote,
    copy.ignoreNote,
  ].join('\n')
}

module.exports = { renderOtpEmail, renderOtpText }
