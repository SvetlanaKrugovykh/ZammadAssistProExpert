const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Send beautiful HTML email in Ukrainian for users without Telegram ID
 * @param {string} to - Recipient email
 * @param {string} messageBody - Main message body (plain text)
 * @param {object} user - User object (for name)
 * @returns {Promise<void>}
 */
async function sendMail(to, messageBody, user = {}) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const html = `
    <div style="font-family: Arial, sans-serif; background: #f7f7f7; padding: 32px;">
      <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #eee; padding: 24px;">
        <h2 style="color: #2a7ae2;">Відправлено від <a href='https://t.me/sddlotok_bot' style='color:#2a7ae2;'>Service Desk LotOk bot</a></h2>
        <p style="font-size: 18px; color: #222;">Вітаємо${user.firstname ? ', ' + user.firstname : ''}!</p>
        <div style="margin: 24px 0; padding: 16px; background: #f0f4fa; border-radius: 6px;">
          <div style="font-size: 16px; color: #333;">${messageBody}</div>
        </div>
        <p style="font-size: 15px; color: #444;">За логікою боту, краще отримувати мої повідомлення в Telegram, а не на email.<br>
        <b>Прохання</b>: зареєструйте у базі даних свій Telegram ID, або продовжуйте отримувати email, якщо Вам так зручніше.<br>
        <br>З повагою,<br>Service Desk LotOk bot</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Service Desk LotOk bot: Повідомлення',
    html
  });
}

module.exports = { sendMail };
