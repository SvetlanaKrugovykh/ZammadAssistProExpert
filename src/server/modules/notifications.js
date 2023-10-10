const { buttonsConfig } = require('./keyboard')
const axios = require('axios')
const https = require('https')
const { update_ticket } = require('../controllers/tgTickets')

async function ticketApprovalScene(ticketID, bot, chatId, ticketSubject) {
  try {
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
  const match = msg.text.match(/№_(\d+)/)
  const ticketID = match[1]
  let body = await getTicketData(ticketID)
  const currentDate = new Date()
  currentDate.setSeconds(currentDate.getSeconds() + 3600)
  const pending_time = currentDate.toISOString()
  body = { ...body, state_id: 7, pending_time: pending_time }
  const updatedTicket = await update_ticket(ticketID, body, [])

  // Send a message to the user indicating that the ticket has been approved
  await bot.sendMessage(msg.chat.id, `Дякую! Ви затвердили заявку №_${ticketID}.`)
}

async function ticketReturn(bot, msg) {
  if (!(ticketID > 0)) return null

  // Code to return the ticket with the given ID
  // ...

  // Send a message to the user indicating that the ticket has been returned
  await bot.sendMessage(msg.chat.id, `Ticket ${ticketID} has been returned.`)
}

module.exports = { ticketApprovalScene, ticketApprove, ticketReturn, getTicketData }