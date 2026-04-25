// src/services/emailTicketsNotification.js
const { sendMail } = require('../modules/sendMail')
const { execPgQuery } = require('../db/common')

/**
 * Проверяет, были ли уже отправлены уведомления по тикету
 */
async function wasNotificationSent(ticket_id, notification_type = 'newPriorityTask') {
  const res = await execPgQuery(
    'SELECT 1 FROM ticket_email_notifications WHERE ticket_id = $1 AND notification_type = $2',
    [ticket_id, notification_type],
    false,
    true
  )
  return res && res.length > 0
}

/**
 * Сохраняет факт отправки уведомления
 */
async function saveNotification(ticket_id, notification_type = 'newPriorityTask') {
  await execPgQuery(
    'INSERT INTO ticket_email_notifications (ticket_id, notification_type, sent_at) VALUES ($1, $2, NOW())',
    [ticket_id, notification_type],
    false,
    true
  )
}

/**
 * Отправляет email всем участникам группы о новом тикете с высоким приоритетом
 */
async function notifyAboutHighPriorityTicket(ticket, groupUsers) {
  const ticketUrl = `https://service-desk.lotok.ua/#ticket/zoom/${ticket.id}`
  const subject = 'Важливе завдання з максимальним пріоритетом!'
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; background: #f7f7f7; padding: 32px;">
      <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #eee; padding: 24px;">
        <h2 style="color: #e22a2a;">Важливе завдання з максимальним пріоритетом!</h2>
        <p style="font-size: 18px; color: #222;">Шановний колего!</p>
        <div style="margin: 24px 0; padding: 16px; background: #f0f4fa; border-radius: 6px;">
          <div style="font-size: 16px; color: #333;">
            У системі Service Desk з'явилося нове завдання з максимальним пріоритетом.<br>
            <b>Будь ласка, зверніть увагу та розпочніть виконання якнайшвидше!</b><br><br>
            <a href='${ticketUrl}' style='color:#2a7ae2; font-weight:bold;'>Перейти до завдання №${ticket.id}</a>
          </div>
        </div>
        <p style="font-size: 15px; color: #444;">
          З повагою,<br>Service Desk LotOk bot
        </p>
      </div>
    </div>
  `
  for (const user of groupUsers) {
    if (!user.email) continue
    try {
      await sendMail(user.email, htmlBody, user)
      console.log(`[emailTicketsNotification] Email sent to ${user.email} for ticket ${ticket.id}`)
    } catch (e) {
      console.log(`[emailTicketsNotification] Error sending email to ${user.email}:`, e)
    }
  }
}

module.exports = {
  wasNotificationSent,
  saveNotification,
  notifyAboutHighPriorityTicket
}
