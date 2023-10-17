const { ticketApprovalScene, getTicketData } = require('../modules/notifications')
const { execPgQuery } = require('../db/common')
const { update_ticket } = require('../controllers/tgTickets')
const { findUserById } = require('../db/tgUsersService')

async function checkAndReplaceTicketsStatuses(bot) {
  try {
    const TICKET_AUTO_CLOSE_DAYS = Number(process.env.TICKET_AUTO_CLOSE_DAYS) || 3
    let INTERVAL_MINUTES = Number(process.env.CLOSED_TICKET_SCAN_INTERVAL_MINUTES_FOR_DB) || 11
    if (process.env.ZAMMAD_USER_TEST_MODE === 'true') INTERVAL_MINUTES = Number(process.env.CLOSED_TICKET_SCAN_INTERVAL_MINUTES_FOR_TEST) || 10

    const query = `SELECT * FROM tickets WHERE state_id = 4 AND pending_time IS NULL AND updated_at > NOW() - INTERVAL '${INTERVAL_MINUTES} minutes' LIMIT 50`
    console.log('checkAndReplaceTicketsStatuses start', new Date())
    const data = await execPgQuery(query, [], false, true)
    if (!data) return null

    for (const ticket of data) {
      const ticketID = ticket.id
      const customer_id = ticket.customer_id
      const ticketSubj = await getTicketData(ticketID, 'title')
      if (!ticketSubj || !customer_id) return null
      const ticketSubject = `Заявка №${ticketID} на тему ${ticketSubj} виконана.\n` +
        `Вам необхідно завтвердити виконання заявки або надіслати на доопрацювання.\n` +
        `Наразі відсутності відповіді, заявка буде автоматично завершена ` +
        `через ${TICKET_AUTO_CLOSE_DAYS} дні`
      await changeStatusFromCloseToPendingClose(ticketID, ticket)
      await ticketApprovalScene(ticketID, bot, ticketSubject)
    }
  } catch (err) {
    console.log(err)
  }
}

async function autoCloseTicketsWithoutCustomerFeedback() {
  try {
    let INTERVAL_DAYS = Number(process.env.TICKET_AUTO_CLOSE_DAYS) || 3
    const query = `SELECT * FROM tickets WHERE state_id = 7 AND pending_time  < NOW() - INTERVAL '${INTERVAL_DAYS} days'`

    const data = await execPgQuery(query)
    if (!data || data.length === 0) return null

    for (const ticket of data) {
      const ticketID = ticket.id
      const customer_id = ticket.customer_id
      if (!ticketSubj || !customer_id) return null
      const ticketSubj = await getTicketData(ticketID, 'title')
      const ticketSubject = `Заявка №${ticketID} на тему ${ticketSubj} автоматично закрита.\n` +
        `Від Вас не надійшло ані підтвердження ані повернення заявки в роботу .\n` +
        `Тому заявку автоматично закрито протягом ${TICKET_AUTO_CLOSE_DAYS} днів`
      await changeStatusFromPendingCloseToClose(ticketID, ticket)
      const user_data = await findUserById(customer_id)
      let chatId = 0
      if (process.env.ZAMMAD_USER_TEST_MODE === 'true')
        chatId = Number(process.env.TEST_USER_TELEGRAM_CHAT_ID)
      else {
        if (!user_data) return null
        chatId = user_data?.login
      }
      await bot.sendMessage(customer_id, ticketSubject)
    }
  } catch (err) {
    console.log(err)
  }
}

async function changeStatusFromCloseToPendingClose(ticketID, ticket_body) {
  try {
    const currentDate = new Date()
    currentDate.setSeconds(currentDate.getSeconds() + 3600)
    const pending_time = currentDate.toISOString()
    const closeTimeString = ticket_body?.updated_at.toISOString()
    const closeInfo = `Заявку було закрито у ${closeTimeString}. Код виконавця ${ticket_body?.owner_id.toString()}.`
    const article = {
      "subject": `Автоматичний перевод заявки в статус 'Очікує закриття'`,
      "body": `Заявку автоматично переведено в статус 'Очікує закриття' - заявка в очікуванні підтвердження замовником..\n${closeInfo}`,
      "type": "note",
      "internal": false
    }
    const { title, group_id, priority_id, state_id, customer_id } = ticket_body
    const newTicketBody = { title, group_id, priority_id, state_id, pending_time, customer_id, article }

    newTicketBody.state_id = 7
    newTicketBody.pending_time = pending_time
    newTicketBody.article = article

    const updatedTicket = await update_ticket(ticketID, newTicketBody, [], true)
    if (updatedTicket) console.log(`Update ticket to PendingClose: ${ticketID}`)
  } catch (err) {
    console.log(err)
  }
}

async function changeStatusFromPendingCloseToClose(ticketID, ticket_body) {
  try {
    const INTERVAL_DAYS = Number(process.env.TICKET_AUTO_CLOSE_DAYS) || 3
    const article = {
      "subject": "Автоматичний перевод заявки в статус 'Закрита'",
      "body": `Заявку автоматично переведено в статус 'Закрита' - Підтвердження або скасування замовником не відбулось протягом ${INTERVAL_DAYS} днів.`,
      "type": "note",
      "internal": false
    }

    const { title, group_id, priority_id, state_id, customer_id } = ticket_body
    const newTicketBody = { title, group_id, priority_id, state_id, customer_id, article }

    newTicketBody.state_id = 4
    newTicketBody.article = article

    const updatedTicket = await update_ticket(ticketID, newTicketBody, [], true)
    if (updatedTicket) console.log(`Update ticket to PendingClose: ${ticketID}`)
  } catch (err) {
    console.log(err)
  }
}

module.exports = { checkAndReplaceTicketsStatuses, autoCloseTicketsWithoutCustomerFeedback }
