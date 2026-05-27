// src/services/emailTicketsNotification.js
const { sendMail } = require('../modules/sendMail')
const { execPgQuery } = require('../db/common')

/**
 * Проверяет, были ли уже отправлены уведомления по тикету
 */

/**
 * Проверяет, было ли уже отправлено уведомление по тикету, пользователю и событию
 */
async function wasNotificationSent(ticket_id, user_id, event_type = 'created') {
  const res = await execPgQuery(
    'SELECT 1 FROM ticket_email_notifications WHERE ticket_id = $1 AND user_id = $2 AND event_type = $3',
    [ticket_id, user_id, event_type],
    false,
    true
  )
  return res && res.length > 0
}

/**
 * Сохраняет факт отправки уведомления
 */

/**
 * Сохраняет факт отправки уведомления по тикету, пользователю и событию
 */
async function saveNotification(ticket_id, user_id, event_type = 'created') {
  // notification_type = event_type (или 'created' по умолчанию)
  await execPgQuery(
    'INSERT INTO ticket_email_notifications (ticket_id, user_id, event_type, notification_type, sent_at) VALUES ($1, $2, $3, $4, NOW())',
    [ticket_id, user_id, event_type, event_type],
    false,
    true
  )
}

/**
 * Отправляет email всем участникам группы о новом тикете с высоким приоритетом
 */
/**
 * Универсальная функция уведомления: email и Telegram owner'у (если есть), иначе всем из отдела
 * @param {object} ticket - тикет
 * @param {object[]} groupUsers - пользователи отдела
 * @param {object|null} owner - объект пользователя-владельца или null
 */
async function notifyAboutHighPriorityTicket(ticket, groupUsers, owner) {
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
    const tgText = `Важливе завдання з максимальним пріоритетом!
  Заявка №${ticket.id}
  ${ticket.title ? 'Тема: ' + ticket.title + '\n' : ''}Посилання: ${ticketUrl}`

    // Кого уведомлять: owner или всех из отдела
    let notifyUsers = []
    if (owner && owner.id) {
      notifyUsers = [owner]
    } else {
      notifyUsers = groupUsers
    }

    for (const user of notifyUsers) {
      // Email
      if (user.email) {
        try {
          await sendMail(user.email, htmlBody, user)
          console.log(`[emailTicketsNotification] Email sent to ${user.email} for ticket ${ticket.id}`)
        } catch (e) {
          console.log(`[emailTicketsNotification] Error sending email to ${user.email}:`, e)
        }
      }
      // Telegram
      if (user.login && /^\d+$/.test(user.login)) {
        try {
          await bot.sendMessage(user.login, tgText)
          console.log(`[emailTicketsNotification] Telegram sent to ${user.login} for ticket ${ticket.id}`)
        } catch (e) {
          console.log(`[emailTicketsNotification] Error sending Telegram to ${user.login}:`, e)
        }
      }
    }

}

// Получить Telegram bot
const { bot } = require('../globalBuffer')

module.exports = {
  wasNotificationSent,
  saveNotification,
  notifyAboutHighPriorityTicket
}
