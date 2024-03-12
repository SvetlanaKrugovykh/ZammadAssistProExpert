const { update_ticket } = require('../modules/update_ticket')
const { findOwnerById } = require('../db/tgUsersService')
const { saveChangesToTicket } = require('../services/scheduledTasks')
const { execPgQuery } = require('../db/common')
const { getTicketData, ticketRemoveFromMenu, usersStarterMenu } = require('../modules/common')
const { fDateTime, pendingTimeInIntervalMin } = require('../services/various')

async function showTicketInfo(bot, msg, isRequest = false) {
  try {
    const ticketID = msg.text.match(/\d+/)?.[0]
    const articleID = msg.text.match(/Код запиту:(\d+)/)?.[1]
    if (!ticketID) return null
    const ticket = await getTicketData(ticketID)
    if (!ticket) return null
    const { id, title, number, created_at, updated_at } = ticket
    const owner = await findOwnerById(ticket.owner_id)
    const article = await getTicketArticles(ticketID, articleID)
    const article_body = (article ? article?.body : '').replace(/<[^>]*>/g, '')
    const content = isRequest ? `Коментар Виконавця ${article?.from}` : 'Зміст'
    let owner_PIB = owner ? `${owner.firstname} ${owner.lastname}` : ticket.owner_id.toString()
    if (ticket.state_id === 1) owner_PIB = 'Відсутній'
    await bot.sendMessage(msg.chat.id, `№_${id}: ${title}\nНомер заявки: ${number}\nВиконавець: ${owner_PIB}\nДата створення: ${fDateTime('uk-UA', created_at)}\nДата останнього оновлення: ${fDateTime('uk-UA', updated_at)}\n <b>${content}</b>: \n${article_body.toString()}`, { parse_mode: 'HTML' })
  } catch (err) {
    console.log(err)
  }
}

async function getTicketArticles(ticketID, articleID = '') {
  try {
    let query = ''
    let values = []

    if (Number(articleID) > 0) {
      query = 'SELECT * FROM ticket_articles WHERE id = $1 ORDER BY updated_at DESC LIMIT 1'
      values = [articleID]
    } else {
      query = 'SELECT * FROM ticket_articles WHERE ticket_id = $1 ORDER BY updated_at DESC LIMIT 1'
      values = [ticketID]
    }
    const data = await execPgQuery(query, values, false, true)
    if (!data) return null
    const article = data.length > 0 ? data[0] : null
    return article
  } catch (error) {
    console.error('Error of record new user data into the bot-database:', error)
  }
}

async function ticketApprove(bot, msg) {
  const match = msg.text.match(/№_(\d+)/)
  const ticketID = match[1]
  let body = await getTicketData(ticketID)
  if (!body) {
    console.log(`ticketReturn: ticketID ${ticketID} not found`)
    return null
  }

  const article = {
    "subject": "Кінцеве затверження замовником заявки",
    "body": "Заявку затверджено замовником. Заявка закрита.",
    "type": "note",
    "internal": false
  }
  const { title, group_id, priority_id, state_id, pending_time, customer_id } = body
  const newTicketBody = { title, group_id, priority_id, state_id, pending_time, customer_id, article }
  newTicketBody.state_id = 4
  newTicketBody.article = article
  const p_time = pendingTimeInIntervalMin()
  newTicketBody.pending_time = p_time

  const updatedTicket = await update_ticket(ticketID, newTicketBody, [], true)
  if (updatedTicket) console.log(`Update ticket to ApprovedClose: ${ticketID}`)
  const ticket_body = await getTicketData(ticketID)
  saveChangesToTicket(ticketID, ticket_body, 'затверджено')
  ticketRemoveFromMenu(ticketID)
  await bot.sendMessage(msg.chat.id, `Дякую! Ви затвердили заявку №_${ticketID}.\n${newTicketBody.title}`, {
    reply_markup: {
      remove_keyboard: true
    }
  })
  await usersStarterMenu(bot, msg)
}

async function ticketReturn(bot, msg) {
  const match = msg.text.match(/№_(\d+)/)
  const ticketID = match[1]
  let body = await getTicketData(ticketID)
  if (!body) {
    console.log(`ticketReturn: ticketID ${ticketID} not found`)
    return null
  }
  const article = {
    "subject": "Заявку повернуто на доопрацювання",
    "body": "Повернення заявки на доопрацювання. Заявка переведена в статус 'Відкрита'",
    "type": "note",
    "internal": false
  }
  const { title, group_id, priority_id, state_id, pending_time, customer_id } = body
  const newTicketBody = { title, group_id, priority_id, state_id, pending_time, customer_id, article }
  newTicketBody.state_id = 2
  newTicketBody.article = article
  newTicketBody.pending_time = null

  const updatedTicket = await update_ticket(ticketID, newTicketBody, [], true)
  if (updatedTicket) console.log(`Update ticket to ticketReturn: ${ticketID}`)
  const ticket_body = await getTicketData(ticketID)
  saveChangesToTicket(ticketID, ticket_body, 'повернуто')
  ticketRemoveFromMenu(ticketID)
  await bot.sendMessage(msg.chat.id, `Прийнято! Заявку повернуто в роботу №_${ticketID}..\n${newTicketBody.title}`, {
    reply_markup: {
      remove_keyboard: true
    }
  })
  await usersStarterMenu(bot, msg)
}

module.exports = { ticketApprove, ticketReturn, showTicketInfo, getTicketArticles }