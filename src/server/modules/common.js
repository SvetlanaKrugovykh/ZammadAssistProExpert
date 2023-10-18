const axios = require('axios')
const https = require('https')
const { buttonsConfig } = require('./keyboard')

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

async function getChatIdByTicketID(ticketID) {
  try {
    const ticket = await getTicketData(ticketID)
    if (!ticket) {
      console.log(`getChatIdByTicketID: ticketID ${ticketID} not found`)
      return null
    }
    const customer_id = ticket.customer_id
    const user_data = await findUserById(customer_id)
    if (!user_data) return null
    const chatId = user_data?.login
    return chatId
  } catch (err) {
    console.log(err)
  }
}

async function ticketApprovalScene(ticketID, bot, ticketSubject, msg = null) {
  const source = {}
  try {
    if (ticketSubject === '') {
      source.chatId = msg.chat.id
      source.ticketID = msg.text.match(/\d+/)?.[0]
      source.ticketSubject = msg.text
    } else {
      source.chatId = await getChatIdByTicketID(ticketID)
      source.ticketID = ticketID
      source.ticketSubject = ticketSubject
    }
    console.log(`ticketApprovalScene chatId: ${source.chatId}`)
    buttonsConfig["ticketApproval"].title = source.ticketSubject
    const buttons = buttonsConfig["ticketApproval"].buttons
    for (const button of buttons) {
      if (button[0].callback_data === '3_3') break
      if (!button[0].text.includes(`№_${source.ticketID.toString()}`))
        button[0].text = button[0].text + ' №_' + source.ticketID.toString()
    }
    await bot.sendMessage(source.chatId, buttonsConfig["ticketApproval"].title, {
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

module.exports = { getTicketData, ticketApprovalScene }
