const { buttonsConfig } = require('./keyboard')
const axios = require('axios')
const https = require('https')
const { update_ticket } = require('../controllers/tgTickets')

async function ticketApprovalScene(ticketID, bot, ticketSubject) {
  try {
    const chatId = await getChatIdByTicketID(ticketID)
    console.log(`ticketApprovalScene chatId: ${chatId}`)
    buttonsConfig["ticketApproval"].title = ticketSubject
    const buttons = buttonsConfig["ticketApproval"].buttons
    for (const button of buttons) {
      if (button[0].callback_data === '3_3') break
      button[0].text = button[0].text + ' №_' + ticketID.toString()
    }
    await bot.sendMessage(chatId, buttonsConfig["ticketApproval"].title, {
      reply_markup: {
        keyboard: buttonsConfig["ticketApproval"].buttons,
        resize_keyboard: true,
        one_time_keyboard: false
      }
    })
  } catch (err) {
    console.log(err)
  }
}

async function getChatIdByTicketID(ticketID) {
  try {
    const ticket = await getTicketData(ticketID)
    if (!ticket) return null
    const customer_id = ticket.customer_id
    const user_data = await findUserById(customer_id)
    if (!user_data) return null
    const chatId = user_data?.login
    return chatId
  } catch (err) {
    console.log(err)
  }
}

async function getTicketData(ticketID, field = '') {
  const headers = { Authorization: process.env.ZAMMAD_API_TOKEN, "Content-Type": "application/json" }
  const httpsAgent = new https.Agent({ rejectUnauthorized: false })
  const url = `${process.env.ZAMMAD_API_URL}/tickets/${ticketID}`
  try {
    const response = await axios.get(url, { headers, httpsAgent })
    const ticket = response.data
    if (field === '') return ticket
    else return ticket[field]
  } catch (err) {
    console.log(err)
    return null
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
    await bot.sendMessage(msg.chat.id, `Дякую! Ви затвердили заявку №_${ticketID}.`)
  }
}

async function ticketReturn(bot, msg) {
  const match = msg.text.match(/№_(\d+)/)
  const ticketID = match[1]
  let body = await getTicketData(ticketID)
  const article = {
    "subject": "Заявку повернуто на доопрацювання",
    "body": "Повернення заявки на доопрацювання. Заявка перевідена в статус 'Відкрита'",
    "type": "note",
    "internal": false
  }
  const { title, group_id, priority_id, state_id, customer_id } = body
  const newTicketBody = { title, group_id, priority_id, state_id, customer_id, article }
  newTicketBody.state_id = 2
  newTicketBody.article = article

  const updatedTicket = await update_ticket(ticketID, newTicketBody, [], true)
  if (updatedTicket) console.log(`Update ticket to ticketReturn: ${ticketID}`)
  await bot.sendMessage(msg.chat.id, `Прийнято! Заявку повернуто в роботу №_${ticketID}.`)
}

module.exports = { ticketApprovalScene, ticketApprove, ticketReturn, getTicketData }