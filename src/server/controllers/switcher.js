const { buttonsConfig } = require('../modules/keyboard')
const { clientsAdminGetInfo, clientsAdminResponseToRequest } = require('./clientsAdmin')
const supportScene = require('./support')
const { ticketCreateScene, ticketsTextInput, askForAttachment, ticketRegistration, checkUserTickets } = require('./tgTickets')
const { signUpForm, signUpOldForm, usersTextInput, usersRegistration } = require('./signUp')
const { ticketApprove, ticketReturn } = require('../modules/notifications')
const { findUserById } = require('../db/tgUsersService')
const { users } = require('../users/users.model')

const selectedByUser = {}

//#region staticKeyboad
function getCallbackData(text) {
  for (const buttonSet of Object.values(buttonsConfig)) {
    for (const buttonRow of buttonSet.buttons) {
      for (const button of buttonRow) {
        if (button.text === text) {
          return button.callback_data
        }
      }
    }
  }
  return null
}

async function handler(bot, msg, webAppUrl) {
  const data = getCallbackData(msg.text)
  const chatId = msg.chat.id
  if (!selectedByUser[chatId]) selectedByUser[chatId] = {}
  console.log('The choise is:', data)
  switch (data) {
    case '0_2':
      await supportScene(bot, msg, false)
      break
    case '0_3':
      await signUpForm(bot, msg, webAppUrl)
      break
    case '0_5':
      selectedByUser[msg.chat.id] = {}
      await signUpOldForm(bot, msg)
      break
    case '0_10':
      selectedByUser[chatId] = await usersTextInput(bot, msg, data, selectedByUser[chatId])
      break
    case '0_11':
      selectedByUser[chatId] = await usersTextInput(bot, msg, data, selectedByUser[chatId])
      break
    case '0_12':
      selectedByUser[chatId] = await usersTextInput(bot, msg, data, selectedByUser[chatId])
      break
    case '0_13':
      await usersRegistration(bot, msg, selectedByUser[chatId])
      break
    case '0_4':
      const adminUser = users.find(user => user.id === msg.chat.id)
      if (adminUser) {
        await await clientAdminMenuStarter(bot, msg, buttonsConfig["clientAdminStarterButtons"])
      } else {
        await usersStarterMenu(bot, msg)
      }
      break
    case '2_1':
      selectedByUser[msg.chat.id] = {}
      await ticketCreateScene(bot, msg)
      break
    case '2_2':
      await checkUserTickets(bot, msg, data)
      break
    case '2_3':
      await checkUserTickets(bot, msg, data)
      break
    case '2_4':
      await checkUserTickets(bot, msg, data)
      break
    case '3_1':
      await clientsAdminGetInfo(bot, msg)
      break
    case '3_2':
      await clientsAdminResponseToRequest(bot, msg)
      break
    case '3_3':
      await registeredUserMenu(bot, msg, buttonsConfig["standardStartButtons"])
      break
    case '5_1':
      selectedByUser[chatId] = await ticketsTextInput(bot, msg, data, selectedByUser[chatId])
      break
    case '5_2':
      selectedByUser[chatId] = await ticketsTextInput(bot, msg, data, selectedByUser[chatId])
      break
    case '5_3':
      selectedByUser[chatId] = await askForAttachment(bot, msg, selectedByUser[chatId])
      break
    case '5_4':
      await ticketRegistration(bot, msg, selectedByUser[chatId])
      break
    case '7_1':
      await ticketApprove(bot, msg)
      break
    case '7_2':
      await ticketReturn(bot, msg)
      break
    default:
      console.log(`default: ${msg.text}`)
      switchDynamicSceenes(bot, msg)
      break
  }
}
//#endregion

//#region dynamicKeyboads
async function switchDynamicSceenes(bot, msg) {
  try {
    if (/[🏠🟣🔵🧷📌✔️📘➕📗💹❌]/.test(msg.text)) {
      goBack(bot, msg)
      return
    }
    // if (msg.text.includes('🕒')) {
    //   //await schedullerScene(bot, msg)
    //   return
    // }
  } catch (error) { console.log(error) }
}

async function goBack(bot, msg) {
  try {
    if (msg.text.includes('🏠')) {
      const adminUser = users.find(user => user.id === msg.chat.id)
      if (adminUser) {
        await clientAdminMenuStarter(bot, msg, buttonsConfig["clientAdminStarterButtons"])
      } else {
        await usersStarterMenu(bot, msg)
      }
    } else if (msg.text.includes('↩️')) {
      await registeredUserMenu(bot, msg, buttonsConfig["standardStartButtons"])
    }
  } catch (error) { console.log(error) }
}

//#endregion

async function usersStarterMenu(bot, msg) {
  const registeredUser = await findUserById(msg.chat.id)
  if (registeredUser === null) {
    try {
      await guestMenu(bot, msg, buttonsConfig["guestStartButtons"])
    } catch (err) {
      console.log(err)
    }
  } else {
    try {
      await registeredUserMenu(bot, msg, buttonsConfig["standardStartButtons"])
    } catch (err) {
      console.log(err)
    }
  }
}
//#region mainScrnes
async function guestMenu(bot, msg, guestStartButtons) {
  await bot.sendMessage(msg.chat.id, `Чат-бот <b>${process.env.BRAND_NAME}</b> вітає Вас, <b>${msg.chat.first_name} ${msg.chat.last_name}</b>!`, { parse_mode: "HTML" })
  await bot.sendMessage(msg.chat.id, buttonsConfig["guestStartButtons"].title, {
    reply_markup: {
      keyboard: buttonsConfig["guestStartButtons"].buttons,
      resize_keyboard: true
    }
  })
}

async function registeredUserMenu(bot, msg, standardStartButtons) {
  await bot.sendMessage(msg.chat.id, `Вітаю та бажаю приємного спілкування!, ${msg.chat.first_name} ${msg.chat.last_name}!`)
  await bot.sendMessage(msg.chat.id, buttonsConfig["standardStartButtons"].title, {
    reply_markup: {
      keyboard: buttonsConfig["standardStartButtons"].buttons,
      resize_keyboard: true
    }
  })
}
//#endregion

module.exports = { handler, guestMenu, registeredUserMenu, usersStarterMenu }