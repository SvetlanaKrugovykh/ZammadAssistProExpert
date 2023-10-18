const axios = require('axios')
const https = require('https')
const { buttonsConfig } = require('../modules/keyboard')
const { findUserById } = require('../db/tgUsersService')

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
    if (process.env.DEBUG_LEVEL === '7') console.log('getChatIdByTicketID ticket', ticket)
    const customer_id = ticket.customer_id
    if (process.env.DEBUG_LEVEL === '7') console.log('getChatIdByTicketID customer_id', customer_id)
    const user_data = await findUserById(customer_id)
    if (process.env.DEBUG_LEVEL === '7') console.log('getChatIdByTicketID user_data', user_data)
    if (!user_data) return null
    const chatId = user_data?.login
    return chatId
  } catch (err) {
    console.log(err)
  }
}

async function ticketApprovalScene(ticketID, bot, ticketSubject, msg = null, ticket = null) {
  const source = {}
  source.dataFilled = false
  if (process.env.DEBUG_LEVEL === '7') console.log('ticketApprovalScene ticketID', ticketID)
  try {
    if (ticketSubject === '') {
      source.chatId = msg.chat.id
      source.ticketID = msg.text.match(/\d+/)?.[0]
      source.ticketSubject = msg.text
      source.checkUserID = false
    } else {
      source.chatId = await getChatIdByTicketID(ticketID)
      const user = await findUserById(ticket.customer_id)
      if (user?.id === ticket.customer_id)
        source.userIDeqCustomerId = true
      else source.userIDeqCustomerId = false
      source.ticketID = ticketID
      source.ticketSubject = ticketSubject
      source.checkUserID = true
    }
    console.log(`ticketApprovalScene chatId: ${source.chatId}`)
    buttonsConfig["ticketApproval"].title = source.ticketSubject
    const buttons = buttonsConfig["ticketApproval"].buttons
    for (const button of buttons) {
      if (button[0].callback_data === '3_3') break
      if (!button[0].text.includes(`№_${source.ticketID.toString()}`))
        if (!source.checkUserID || source?.userIDeqCustomerId)
          source.dataFilled = true
      button[0].text = button[0].text + ' №_' + source.ticketID.toString()
    }
    if (source.dataFilled) {
      await bot.sendMessage(source.chatId, buttonsConfig["ticketApproval"].title, {
        reply_markup: {
          keyboard: buttonsConfig["ticketApproval"].buttons,
          resize_keyboard: true,
          one_time_keyboard: false
        }
      })
    }
  } catch (err) {
    console.log(err)
  }
}

module.exports = { getTicketData, ticketApprovalScene }
