const { execPgQuery } = require('../db/common')
const { update_ticket } = require('../controllers/tgTickets')
const { findUserById, findOwnerById } = require('../db/tgUsersService')
const { ticketApprovalScene, getTicketData, getArticleData, cleanTicketsFromMenu } = require('../modules/common')
const { fDateTime, pendingTimeInDaysSec, _dayEndTimeInDaysSec } = require('../services/various')
require('dotenv').config()


async function checkAndReplaceTicketsStatuses(bot) {
  try {
    const DELTA_RUBY_TIME_ZONE_MINUTES = Number(process.env.DELTA_RUBY_TIME_ZONE_MINUTES) || 0
    const TICKET_AUTO_CLOSE_DAYS = Number(process.env.TICKET_AUTO_CLOSE_DAYS) || 3
    let INTERVAL_MINUTES = Number(process.env.CLOSED_TICKET_SCAN_INTERVAL_MINUTES_FOR_DB) || 11
    if (process.env.ZAMMAD_USER_TEST_MODE === 'true') INTERVAL_MINUTES = Number(process.env.CLOSED_TICKET_SCAN_INTERVAL_MINUTES_FOR_TEST) || 10

    const DELTA = (DELTA_RUBY_TIME_ZONE_MINUTES + INTERVAL_MINUTES) * 60000
    const nowMinusInterval = new Date(Date.now() - DELTA)
    const query = `SELECT * FROM tickets WHERE state_id = 4 AND pending_time IS NULL AND updated_at > $1 LIMIT 50`

    if (process.env.DEBUG_LEVEL === '7') {
      console.log('checkAndReplaceTicketsStatuses query', query)
      console.log('checkAndReplaceTicketsStatuses INTERVAL_MINUTES', INTERVAL_MINUTES)
      console.log('checkAndReplaceTicketsStatuses start', new Date())
    }
    const data = await execPgQuery(query, [nowMinusInterval], false, true)
    if (process.env.DEBUG_LEVEL === '7') console.log('tickets', data)
    if (!data) return null
    const customerData = {}
    for (const ticket of data) {
      const ticketID = ticket.id
      const customer_id = ticket.customer_id
      const ticketSubj = await getTicketData(ticketID, 'title')
      if (process.env.DEBUG_LEVEL === '7') console.log('ticketSubj', ticketSubj)
      if (!ticketSubj) continue
      const lastarticle = await getArticleData(ticketID, `Заявку автоматично переведено в статус 'Очікує закриття'`)
      if (lastarticle) {
        console.log(`last article into the same period - Заявка №${ticketID}`)
        continue
      }
      const ticketSubject = `Заявка №${ticketID} на тему ${ticketSubj} від ${fDateTime('uk-UA', ticket.created_at)} виконана.\n` +
        `Вам необхідно затвердити виконання заявки або надіслати на доопрацювання.\n` +
        `Наразі відсутності відповіді, заявка буде автоматично завершена ` +
        `через ${TICKET_AUTO_CLOSE_DAYS} дні`
      if (process.env.DEBUG_LEVEL === '7') console.log('ticketSubject', ticketSubject)
      await changeStatusFromCloseToPendingClose(ticketID, ticket)
      if (!customerData[customer_id]) {
        customerData[customer_id] = {
          tickets: [],
          subjects: [],
        }
      }
      customerData[customer_id].subjects.push(ticketSubject)
      customerData[customer_id].tickets.push(ticket)
    }
    for (const customer_id in customerData) {
      const customerTickets = customerData[customer_id].tickets
      let i = 0
      await cleanTicketsFromMenu()
      for (const ticket of customerTickets) {
        await ticketApprovalScene(ticket.id, bot, customerData[customer_id].subjects[i], null, ticket)
        i++
      }
    }
  } catch (err) {
    console.log(err)
  }
}

async function autoCloseTicketsWithoutCustomerFeedback(bot) {
  try {
    const now = _dayEndTimeInDaysSec()
    const TICKET_AUTO_CLOSE_DAYS = Number(process.env.TICKET_AUTO_CLOSE_DAYS) || 3
    console.log('autoCloseTicketsWithoutCustomerFeedback now is: ', now)
    const query = `SELECT * FROM tickets WHERE state_id = 7 AND pending_time = $1`

    const data = await execPgQuery(query, [now], false, true)
    if (!data || data.length === 0) return null

    for (const ticket of data) {
      const ticketID = ticket.id
      const customer_id = ticket.customer_id
      if (!ticketID || !customer_id) return null
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
      console.log(`autoCloseTicketsWithoutCustomerFeedback to ${chatId} ticketID: ${ticketID} ticketSubject: ${ticketSubject}`)
      await bot.sendMessage(chatId, ticketSubject)
    }
  } catch (err) {
    console.log(err)
  }
}

async function changeStatusFromCloseToPendingClose(ticketID, ticket_body) {
  try {
    const pending_time = pendingTimeInDaysSec()
    console.log('changeStatusFromCloseToPendingClose pending_time', pending_time)
    const owner = await findOwnerById(ticket_body.owner_id)
    let owner_PIB = owner ? `${owner.firstname} ${owner.lastname}` : ticket_body.owner_id.toString()
    const closeTimeString = fDateTime('uk-UA')
    const closeInfo = `Заявку було закрито у ${closeTimeString}. Виконавець: ${owner_PIB}.`
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
    if (updatedTicket) console.log(`Update ticket to PendingClose: ${ticketID} pending_time: ${newTicketBody.pending_time}`)
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

    const { title, group_id, priority_id, state_id, pending_time, customer_id } = ticket_body
    const newTicketBody = { title, group_id, priority_id, state_id, pending_time, customer_id, article }

    newTicketBody.state_id = 4
    newTicketBody.article = article
    newTicketBody.pending_time = null

    const updatedTicket = await update_ticket(ticketID, newTicketBody, [], true)
    if (updatedTicket) console.log(`AvtoUpdate ticket Auto Close form PendingClose to close: ${ticketID} pending_time: ${newTicketBody.pending_time}`)
  } catch (err) {
    console.log(err)
  }
}


async function saveChangesToTicket(ticketID, ticket_body, closeAction) {
  try {
    const closeInfo = `Заявку було ${closeAction} замовником у ${fDateTime('uk-UA')}. Код виконавця ${ticket_body?.owner_id.toString()}.`
    const article = {
      "subject": `Заявку ${closeAction} замовником.'`,
      "body": `Заявку ${closeAction} замовником.\n${closeInfo}`,
      "type": "note",
      "internal": false
    }
    const { title, group_id, priority_id, pending_time, state_id, customer_id } = ticket_body
    const newTicketBody = { title, group_id, priority_id, pending_time, state_id, customer_id, article }

    newTicketBody.article = article
    if (newTicketBody.state_id === 2) {
      newTicketBody.pending_time = null
    } else {
      const p_time = pendingTimeInDaysSec()
      newTicketBody.pending_time = p_time
    }

    const updatedTicket = await update_ticket(ticketID, newTicketBody, [], true)
    if (updatedTicket) console.log(`Update (save) ticket ${closeAction}: ${ticketID} pending_time: ${newTicketBody.pending_time}`)
  } catch (err) {
    console.log(err)
  }
}

module.exports = { checkAndReplaceTicketsStatuses, autoCloseTicketsWithoutCustomerFeedback, saveChangesToTicket }
