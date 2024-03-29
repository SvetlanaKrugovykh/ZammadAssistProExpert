const axios = require('axios')
const https = require('https')
const { buttonsConfig } = require('../modules/keyboard')
const { findUserById } = require('../db/tgUsersService')
const { isBotBlocked } = require('../modules/bot')
const { isUsersHaveReportsRole } = require('../db/tgReportsService')
const { execPgQuery } = require('../db/common')
require('dotenv').config()
//#region mainScrnes

async function usersStarterMenu(bot, msg) {
  const registeredUser = await findUserById(msg.chat.id)
  if (registeredUser === null || registeredUser?.verified !== true) {
    try {
      await guestMenu(bot, msg, buttonsConfig["guestStartButtons"])
    } catch (err) {
      console.log(err)
    }
  } else {
    try {
      await registeredUserMenu(bot, msg)
    } catch (err) {
      console.log(err)
    }
  }
}

async function guestMenu(bot, msg, guestStartButtons) {
  await bot.sendMessage(msg.chat.id, `Чат-бот <b>${process.env.BRAND_NAME}</b> вітає Вас, <b>${msg.chat.first_name} ${msg.chat.last_name}</b>!`, { parse_mode: "HTML" })
  await bot.sendMessage(msg.chat.id, buttonsConfig["guestStartButtons"].title, {
    reply_markup: {
      keyboard: buttonsConfig["guestStartButtons"].buttons,
      resize_keyboard: true
    }
  })
}

async function registeredUserMenu(bot, msg, isStart = true) {
  const isReports = await isUsersHaveReportsRole(msg.chat.id)

  if (isStart) await bot.sendMessage(msg.chat.id, `Вітаю та бажаю приємного спілкування!, ${msg.chat.first_name} ${msg.chat.last_name}!`)
  let menuName = "standardStartButtons"
  if (isReports) menuName = "standardStartButtonsPlus"

  await bot.sendMessage(msg.chat.id, buttonsConfig[menuName].title, {
    reply_markup: {
      keyboard: buttonsConfig[menuName].buttons,
      resize_keyboard: true
    }
  })
}
//#endregion


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

async function getArticleData(ticketID, text) {
  const headers = { Authorization: process.env.ZAMMAD_API_TOKEN, "Content-Type": "application/json" }
  const httpsAgent = new https.Agent({ rejectUnauthorized: false })
  const url = `${process.env.ZAMMAD_API_URL}/ticket_articles/by_ticket/${ticketID}`
  try {
    const response = await axios.get(url, { headers, httpsAgent })
    const articles = response.data
    for (const article of articles) {
      if (article.body.includes(text) && compareTimeInMin(article.updated_at)) return true
    }
    return false
  } catch (err) {
    console.log(err)
    return null
  }
}


function compareTimeInMin(updated_at) {
  let INTERVAL_MINUTES = Number(process.env.CLOSED_TICKET_SCAN_INTERVAL_MINUTES_FOR_DB) || 11
  const DELTA = INTERVAL_MINUTES * 60000
  const time_min = new Date(Date.now() - DELTA)
  const time_max = new Date(Date.now() + DELTA)
  return (time_min <= updated_at && updated_at <= time_max)
}

async function getChatIdByTicketID(ticketID) {
  try {
    const ticket = await getTicketData(ticketID)
    if (!ticket) {
      console.log(`getChatIdByTicketID: ticketID ${ticketID} not found`)
      return null
    }
    console.log('getChatIdByTicketID ticket', ticketID)
    const customer_id = ticket.customer_id
    console.log('getChatIdByTicketID customer_id', customer_id)
    const user_data = await findUserById(customer_id)
    if (process.env.DEBUG_LEVEL === '7') console.log('getChatIdByTicketID user_data', user_data)
    if (!user_data) return null
    const chatId = user_data?.login
    return chatId
  } catch (err) {
    console.log(err)
  }
}

async function ticketApprovalScene(ticketID, bot, ticketSubject, msg = null, ticket = null, manual = false) {
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
    if (typeof source.chatId === 'string' && source.chatId.includes('@'))
      return
    const isBlocked = await isBotBlocked(bot, source.chatId, msg)
    if (isBlocked) return
    console.log(`ticketApprovalScene chatId=${source.chatId}`)
    if (manual) await cleanTicketsFromMenu()
    buttonsConfig["ticketApproval"].title = source.ticketSubject
    const buttons = buttonsConfig["ticketApproval"].buttons
    for (const button of buttons) {
      if (button[0].callback_data === '3_3') break
      if (!button[0].text.includes(`№_${source.ticketID.toString()}`))
        if (!source.checkUserID || source?.userIDeqCustomerId) {
          source.dataFilled = true
          button[0].text = button[0].text + ' №_' + source.ticketID.toString()
        }
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

async function ticketRemoveFromMenu(ticketID) {
  try {
    const buttons = buttonsConfig["ticketApproval"].buttons
    for (const button of buttons) {
      if (button[0].callback_data === '3_3') break
      button[0].text = button[0].text.replace(` №_${ticketID.toString()}`, '')
    }
  } catch (err) {
    console.log(err)
  }
}

async function cleanTicketsFromMenu() {
  try {
    const buttons = buttonsConfig["ticketApproval"].buttons;
    for (const button of buttons) {
      if (button[0].callback_data === '3_3') break;
      const indexOfTicketID = button[0].text.indexOf(" №_");
      if (indexOfTicketID !== -1) {
        button[0].text = button[0].text.substring(0, indexOfTicketID)
      }
    }
  } catch (err) {
    console.log(err);
  }
}




module.exports = {
  getTicketData, getArticleData, ticketApprovalScene, ticketRemoveFromMenu, cleanTicketsFromMenu,
  usersStarterMenu, registeredUserMenu
}
