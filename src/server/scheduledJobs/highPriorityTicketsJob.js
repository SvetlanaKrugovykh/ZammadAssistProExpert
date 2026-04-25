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
      const alreadySent = await wasNotificationSent(ticket.id, 'newPriorityTask')
      if (alreadySent) continue
      // Получить пользователей группы
      const groupUsers = await execPgQuery(
        `SELECT u.* FROM groups_users gu
         JOIN users u ON gu.user_id = u.id
         WHERE gu.group_id = $1 AND u.active = true`,
        [ticket.group_id], false, true
      )
      await notifyAboutHighPriorityTicket(ticket, groupUsers)
      await saveNotification(ticket.id, 'newPriorityTask')
      console.log(`[highPriorityTicketsJob] Notification sent for ticket ${ticket.id}`)
    }
    console.log('[highPriorityTicketsJob] Done')
  } catch (e) {
    console.log('[highPriorityTicketsJob] Error:', e)
  }
}

module.exports = { checkHighPriorityTickets }
