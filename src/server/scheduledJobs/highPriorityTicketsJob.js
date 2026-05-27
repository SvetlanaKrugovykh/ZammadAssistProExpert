// src/server/scheduledJobs/highPriorityTicketsJob.js
const { execPgQuery } = require('../db/common')
const { wasNotificationSent, saveNotification, notifyAboutHighPriorityTicket } = require('../services/emailTicketsNotification')

/**
 * Проверяет новые тикеты с максимальным приоритетом и рассылает уведомления
 */
async function checkHighPriorityTickets() {
  try {
    console.log('[highPriorityTicketsJob] Start check')
    // Найти все открытые тикеты с максимальным приоритетом, по которым не отправлено уведомление
    const tickets = await execPgQuery(
      `SELECT * FROM tickets WHERE state_id < 4 AND priority_id = 3 AND created_at >= NOW() - INTERVAL '60 days'`,
      [], false, true
    )
    for (const ticket of tickets) {
      // Определяем получателей (owner или группа)
      let notifyUsers = []
      let eventType = 'created'
      if (ticket.owner_id) {
        notifyUsers = await execPgQuery(
          `SELECT * FROM users WHERE id = $1 AND active = true`,
          [ticket.owner_id], false, true
        )
      } else if (ticket.group_id === 10) {
        // Исключение для отдела монтажников: если нет owner, отправлять Дмитру Біляєву (id=452)
        notifyUsers = await execPgQuery(
          `SELECT * FROM users WHERE id = $1`,
          [452], false, true
        )
      } else {
        notifyUsers = await execPgQuery(
          `SELECT u.* FROM groups_users gu
           JOIN users u ON gu.user_id = u.id
           WHERE gu.group_id = $1 AND u.active = true`,
          [ticket.group_id], false, true
        )
      }
      // Для каждого пользователя — индивидуальная проверка и отправка
      for (const user of notifyUsers) {
        const alreadySent = await wasNotificationSent(ticket.id, user.id, eventType)
        if (alreadySent) continue
        await notifyAboutHighPriorityTicket(ticket, [user], user)
        await saveNotification(ticket.id, user.id, eventType)
        console.log(`[highPriorityTicketsJob] Notification sent for ticket ${ticket.id} to user ${user.id}`)
      }
    }
    console.log('[highPriorityTicketsJob] Done')
  } catch (e) {
    console.log('[highPriorityTicketsJob] Error:', e)
  }
}

module.exports = { checkHighPriorityTickets }
