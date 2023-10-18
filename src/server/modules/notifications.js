const { buttonsConfig } = require('./keyboard')
const axios = require('axios')
const https = require('https')
const { update_ticket } = require('../controllers/tgTickets')
const { findUserById } = require('../db/tgUsersService')
const { saveChangesToTicket } = require('../services/scheduledTasks')
const { execPgQuery } = require('../db/common')
const { getTicketData } = require('../modules/common')


async function showTicketInfo(bot, msg) {
  try {
    const ticketID = msg.text.match(/\d+/)?.[0]
    if (!ticketID) return null
    const ticket = await getTicketData(ticketID)
    if (!ticket) return null
    const { id, title, number, created_at, updated_at } = ticket
    const owner = await findUserById(ticket.owner_id)
    const article = await getTicketArticles(ticketID)
    const article_body = article ? article?.body : ''
    let owner_PIB = owner ? `${owner.first_name} ${owner.last_name}` : ticket.owner_id.toString()
    if (ticket.state_id === 1) owner_PIB = 'Відсутній'
    const created_at_formatted = new Date(created_at).toLocaleString('uk-UA', { dateStyle: 'medium', timeStyle: 'short' })
    const updated_at_formatted = new Date(updated_at).toLocaleString('uk-UA', { dateStyle: 'medium', timeStyle: 'short' })
    await bot.sendMessage(msg.chat.id, `№_${id}: ${title}\nНомер заявки: ${number}\nВиконавець: ${owner_PIB}\nДата створення: ${created_at_formatted}\nДата останнього оновлення: ${updated_at_formatted}\n Зміст: \n${article_body.toString()}`)
  } catch (err) {
    console.log(err)
  }
}

async function getTicketArticles(ticketID) {
  try {
    const query = 'SELECT * FROM ticket_articles WHERE ticket_id = $1 ORDER BY updated_at DESC LIMIT 1'
    const values = [ticketID]
    const data = await execPgQuery(query, values, false, true)
    return data[0]
  } catch (error) {
    console.error('Error of record new user data into the bot-database:', error)
  }
}

async function ticketApprove(bot, msg) {
  const msgText = msg.text
  const regex = /№_(\d+)/g
  const ticketIDs = []
  let match

  while ((match = regex.exec(msgText)) !== null) {
    ticketIDs.push(match[1])
  }

  for (const ticketID of ticketIDs) {
    let body = await getTicketData(ticketID)
    if (!body) {
      console.log(`ticketApprove: ticketID ${ticketID} not found`)
      continue
    }
    const article = {
      "subject": "Кінцеве затверження замовником заявки",
      "body": "Заявку затверджено замовником. Заявка закрита.",
      "type": "note",
      "internal": false
    }
    const { title, group_id, priority_id, state_id, customer_id } = body
    const newTicketBody = { title, group_id, priority_id, state_id, customer_id, article }
    newTicketBody.state_id = 4
    newTicketBody.article = article

    const updatedTicket = await update_ticket(ticketID, newTicketBody, [], true)
    if (updatedTicket) console.log(`Update ticket to ApprovedClose: ${ticketID}`)
    const ticket_body = await getTicketData(ticketID)
    saveChangesToTicket(ticketID, ticket_body, 'затверджено')
    await bot.sendMessage(msg.chat.id, `Дякую! Ви затвердили заявку №_${ticketID}.`)
  }
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
  const { title, group_id, priority_id, state_id, customer_id } = body
  const newTicketBody = { title, group_id, priority_id, state_id, customer_id, article }
  newTicketBody.state_id = 2
  newTicketBody.article = article
  newTicketBody.pending_time = null

  const updatedTicket = await update_ticket(ticketID, newTicketBody, [], true)
  if (updatedTicket) console.log(`Update ticket to ticketReturn: ${ticketID}`)
  const ticket_body = await getTicketData(ticketID)
  saveChangesToTicket(ticketID, ticket_body, 'повернуто')
  await bot.sendMessage(msg.chat.id, `Прийнято! Заявку повернуто в роботу №_${ticketID}.`)
}

module.exports = { ticketApprove, ticketReturn, showTicketInfo }