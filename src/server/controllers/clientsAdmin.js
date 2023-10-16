require('dotenv').config()
const { execPgQuery } = require('../db/common')
const inputLineScene = require('./inputLine')
const { clientAdminStarterButtons } = require('../modules/keyboard')
const { findUserById } = require('../db/tgUsersService')
const GROUP_ID = Number(process.env.GROUP_ID)

async function userApproveOrDecline(bot, msg, approve) {
  const msgText = msg.text
  const regex = /№_(\d+)/g
  const user_tgIDs = []
  let match

  while ((match = regex.exec(msgText)) !== null) {
    user_tgIDs.push(match[1])
  }

  for (const user_tgID of user_tgIDs) {
    const newUserInfo = await udateUser(user_tgID, approve)
    if (newUserInfo === null) {
      await bot.sendMessage(GROUP_ID, `НЕ знайдено користувача з id: ${user_tgID}`)
      return null
    }
    if (approve && newUserInfo.verified) {
      console.log(`Update user to Approved: ${newUserInfo.email}`)
      await bot.sendMessage(GROUP_ID, `Дякую! Ви затвердили заявку для користувача: ${newUserInfo.email}.`)
      await sendInfoAboutApproveRegistration(bot, user_tgID)
    } else {
      console.log(`Update user NOT Approved: ${newUserInfo.email}`)
      await bot.sendMessage(GROUP_ID, `НЕ веріфіковано користувача: ${newUserInfo.email}`)
    }
  }
}

async function sendInfoAboutApproveRegistration(bot, user_tgID) {
  try {
    await bot.sendMessage(user_tgID, 'Вітаю! Вашу заявка на реєстрацію в системі <b>Інтерактивний чат-бот</b> була затверджено. Ви можете почати користуватися системою. Для переходу в головне меню натисніть /start', { parse_mode: 'HTML' })
  } catch (err) {
    console.log(err)
  }
}

async function udateUser(chatId, approve) {
  const verify = approve ? 'TRUE' : 'FALSE'
  const query = `UPDATE users SET verified = ${verify} WHERE login = '${chatId}'`

  try {
    await execPgQuery(query, [], true)
    const registeredUser = await findUserById(chatId)
    return registeredUser
  } catch (err) {
    console.log(err)
    return null
  }
}

async function actionsOnId(bot, msg, inputLine) {
  if (inputLine !== undefined) {
    if (inputLine.includes('id#')) {
      let id = inputLine.split('id#')[1]
      let msgtext = inputLine.split('id#')[2]
      console.log('id', id)
      console.log('msgtext', msgtext)
      try {
        await bot.sendMessage(id, `Дякуємо за звернення, відповідь: \n ${msgtext}`, { parse_mode: 'HTML' })
        await bot.sendMessage(msg.chat.id, `🥎🥎 id# request sent\n`, { parse_mode: 'HTML' })
      } catch (err) {
        console.log(err)
      }
    }
  }
}

async function clientsAdmin(bot, msg) {

  await clientAdminMenuStarter(bot, msg, clientAdminStarterButtons)

}

//#region clientAdminMenus
async function clientAdminMenuStarter(bot, msg, clientAdminStarterButtons) {
  await bot.sendMessage(msg.chat.id, clientAdminStarterButtons.title, {
    reply_markup: {
      keyboard: clientAdminStarterButtons.buttons,
      resize_keyboard: true
    }
  })

  console.log(((new Date()).toLocaleTimeString()))
}

//#endregion

//#region clientAdminSubMenus
async function clientsAdminResponseToRequest(bot, msg) {
  await bot.sendMessage(msg.chat.id, 'Введіть <i>id чата для відправки відповіді клієнту </i>\n', { parse_mode: 'HTML' })
  const codeChat = await inputLineScene(bot, msg)
  if (codeChat.length < 7) {
    await bot.sendMessage(msg.chat.id, 'Wrong id. Операцію скасовано\n', { parse_mode: 'HTML' })
    return null
  }
  const commandHtmlText = 'Введіть <i>text відповіді клієнту </i>\n'
  await bot.sendMessage(msg.chat.id, commandHtmlText, { parse_mode: 'HTML' })
  const txtCommand = await inputLineScene(bot, msg)
  if (txtCommand.length < 7) {
    await bot.sendMessage(msg.chat.id, 'Незрозуміла відповідь. Операцію скасовано\n', { parse_mode: 'HTML' })
    return null
  }
  const txtCommandForSend = 'id#' + codeChat + 'id#' + txtCommand
  await actionsOnId(bot, msg, txtCommandForSend)
}

//#endregion

module.exports = {
  clientsAdmin,
  clientsAdminResponseToRequest,
  userApproveOrDecline
}
