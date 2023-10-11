const { ticketApprovalScene, getTicketData } = require('../modules/notifications')
const { execPgQuery } = require('../db/common')
const { update_ticket } = require('../controllers/tgTickets')

async function checkAndReplaceTicketsStatuses(bot) {
  try {
    const TICKET_AUTO_CLOSE_DAYS = Number(process.env.TICKET_AUTO_CLOSE_DAYS) || 3
    let INTERVAL_MINUTES = Number(process.env.CLOSED_TICKET_SCAN_INTERVAL_MINUTES) || 10
    if (process.env.ZAMMAD_USER_TEST_MODE === 'true') INTERVAL_MINUTES = Number(process.env.CLOSED_TICKET_SCAN_INTERVAL_MINUTES_FOR_TEST) || 10

    const query = `SELECT * FROM tickets WHERE state_id = 4 AND pending_time = null AND updated_at < NOW() - INTERVAL '${INTERVAL_MINUTES} minutes'`
    const data = await execPgQuery(query)
    if (!data || data.length === 0) return null

    for (const ticket of data) {
      const ticketID = ticket.id
      const customer_id = ticket.customer_id
      if (!ticketSubj || !customer_id) return null
      const ticketSubj = await getTicketData(ticketID, 'title')
      const ticketSubject = `Заявка №${ticketID} на тему ${ticketSubj} виконана.\n` +
        `Вам необхідно завтвердити виконання заявки або надіслати на доопрацювання.\n` +
        `Наразі відсутній відповідь, заявка буде автоматично завершена ` +
        `через ${TICKET_AUTO_CLOSE_DAYS} дні`
      await changeStatusFromCloseToPendingClose(ticketID)
      await ticketApprovalScene(ticketID, bot, customer_id, ticketSubject)
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
      await changeStatusFromPendingCloseToClose(ticketID)
      await bot.sendMessage(customer_id, ticketSubject)
    }
  } catch (err) {
    console.log(err)
  }
}

async function changeStatusFromCloseToPendingClose(ticketID) {
  try {
    const currentDate = new Date()
    currentDate.setSeconds(currentDate.getSeconds() + 3600)
    const pending_time = currentDate.toISOString()
    const article = {
      "subject": "Автоматичний перевод заявки в статус 'Очікує закриття'",
      "body": "Заявку автоматично переведено в статус 'Очікує закриття' - заявка в очікуванні підтвердження замовником.",
      "type": "note",
      "internal": false
    }
    const updatedTicket = await update_ticket(ticketID, { state_id: 7, pending_time: pending_time, article }, [])
    if (updatedTicket) console.log(`Update ticket to PendingClose: ${ticketID}`)
  } catch (err) {
    console.log(err)
  }
}

async function changeStatusFromPendingCloseToClose(ticketID) {
  try {
    const INTERVAL_DAYS = process.env.CLOSED_TICKET_SCAN_INTERVAL_DAYS || 3
    const article = {
      "subject": "Автоматичний перевод заявки в статус 'Закрита'",
      "body": `Заявку автоматично переведено в статус 'Закрита' - Підтвердження або скасування замовником не відбулось протягом ${INTERVAL_DAYS} днів.`,
      "type": "note",
      "internal": false
    }
    const updatedTicket = await update_ticket(ticketID, { state_id: 4, article }, [])
    if (updatedTicket) console.log(`Update ticket to PendingClose: ${ticketID}`)
  } catch (err) {
    console.log(err)
  }
}

module.exports = { checkAndReplaceTicketsStatuses, autoCloseTicketsWithoutCustomerFeedback }
