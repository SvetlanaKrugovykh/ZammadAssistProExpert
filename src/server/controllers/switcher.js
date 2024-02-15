const { buttonsConfig } = require('../modules/keyboard')
const { clientsAdminGetInfo, clientsAdminResponseToRequest, userApproveOrDecline } = require('./clientsAdmin')
const supportScene = require('./support')
const { ticketCreateScene, ticketUpdateScene, ticketsTextInput, askForAttachment, ticketRegistration, ticketUpdates, checkUserTickets, askForPicture } = require('./tgTickets')
const { signUpForm, signUpOldForm, usersTextInput, usersRegistration } = require('./signUp')
const { chooseData, selectPeriod, chooseGroups, chooseTypeOfPeriod, checkReadyForReport } = require('./reportsController')
const { reports, getReport } = require('./reportsMenu')
const { ticketApprove, ticketReturn } = require('../modules/notifications')
const { users } = require('../users/users.model')
const { ticketApprovalScene, usersStarterMenu, registeredUserMenu } = require('../modules/common')
const { showTicketInfo } = require('../modules/notifications')
const { isThisGroupId } = require('../modules/bot')
const globalBuffer = require('../globalBuffer')

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
  const adminUser = users.find(user => user.id === msg.chat.id)
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
    case '0_11':
    case '0_12':
      selectedByUser[chatId] = await usersTextInput(bot, msg, data, selectedByUser[chatId])
      break
    case '0_13':
      await usersRegistration(bot, msg, selectedByUser[chatId])
      break
    case '0_4':
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
    case '2_3':
    case '2_11':
    case '2_4':
      await checkUserTickets(bot, msg, data)
      break
    case '2_5':
      globalBuffer[msg.chat.id] = {}
      await reports(bot, msg)
      break
    case '3_1':
      await clientsAdminGetInfo(bot, msg)
      break
    case '3_2':
      await clientsAdminResponseToRequest(bot, msg)
      break
    case '3_3':
      await registeredUserMenu(bot, msg)
      break
    case '13_3':
      await bot.sendMessage(msg.chat.id, `Ok!\n`, {
        reply_markup: {
          remove_keyboard: true
        }
      })
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
    case '5_14':
      await ticketUpdates(bot, msg, selectedByUser[chatId])
      break
    case '5_5':
      selectedByUser[chatId] = await askForPicture(bot, msg, selectedByUser[chatId])
      break
    case '7_1':
      await ticketApprove(bot, msg)
      break
    case '7_2':
      await ticketReturn(bot, msg)
      break
    case '8_1':
      await userApproveOrDecline(bot, msg, true)
      break
    case '8_2':
      await userApproveOrDecline(bot, msg, false)
      break
    case '9_1':
      await chooseGroups(bot, msg)
      await checkReadyForReport(bot, msg)
      break
    case '9_2':
      await chooseTypeOfPeriod(bot, msg)
      break
    case '9_3':
      await getReport(bot, msg)
      break
    case 'any_period':
      await chooseData(bot, msg, 'початкову')
      await chooseData(bot, msg, 'кінцеву')
      break
    default:
      if (msg.text === undefined) return
      if (await isThisGroupId(bot, msg.chat.id, msg)) return
      console.log(`default: ${msg.text}`)
      switchDynamicSceenes(bot, msg)
      break
  }
}
//#endregion

async function blockMenu(bot, msg) {
  await bot.sendMessage(msg.chat.id, 'Вибачте, але Ви не можете використовувати цей бот')
  await bot.sendMessage(msg.chat.id, 'Для повторного використання натисніть /start')
}

//#region dynamicKeyboads
async function switchDynamicSceenes(bot, msg) {
  const timeSymbols = ['🌗', '🌔', '🌛', '🌜', '🌕', '🌙'];
  try {
    if (msg.text.includes('🟦')) {
      await ticketApprovalScene('', bot, '', msg, null, true)
      return
    }
    if (msg.text.includes('📕')) {
      await showTicketInfo(bot, msg)
      selectedByUser[msg.chat.id] = {}
      const ticketID = msg.text.match(/\d+/)?.[0]
      if (!ticketID) return null
      selectedByUser[msg.chat.id].updatedTicketId = ticketID
      await ticketUpdateScene(bot, msg)
      return
    }
    if (msg.text.includes('🟨') || msg.text.includes('🟩')) {
      await showTicketInfo(bot, msg)
      return
    }
    if (msg.text.includes('💹')) {
      await ticketApprove(bot, msg)
      return
    }
    if (msg.text.includes('⭕')) {
      await ticketReturn(bot, msg)
      return
    }
    if (msg.text.includes('✅')) {
      await userApproveOrDecline(bot, msg, true)
      return
    }
    if (msg.text.includes('⛔')) {
      await userApproveOrDecline(bot, msg, false)
      return
    }
    if (timeSymbols.some(symbol => msg.text.includes(symbol))) {
      await selectPeriod(bot, msg)
      await checkReadyForReport(bot, msg)
      return
    }
    if (msg.text.includes('↖️')) {
      await reports(bot, msg)
      return
    }
    if (/[🏠🟣🔵🧷📌✔️➕📕📒📗📊📘💹]/.test(msg.text)) {
      goBack(bot, msg)
      return
    }
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
      await registeredUserMenu(bot, msg)
    }
  } catch (error) { console.log(error) }
}

//#endregion

module.exports = { handler, blockMenu }