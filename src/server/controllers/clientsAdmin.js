require('dotenv').config()
const { inputLineScene, inputLineAdminScene } = require('../controllers/inputLine')
const { execPgQuery } = require('../db/common')
const { clientAdminStarterButtons } = require('../modules/keyboard')
const { findUserById, userVerification } = require('../db/tgUsersService')
const GROUP_ID = Number(process.env.GROUP_ID)
const { buttonsConfig } = require('../modules/keyboard')

async function userApproveOrDecline(bot, msg, approve) {
  const msgText = msg.text
  const regex = /№_(\d+)/g
  const user_tgIDs = []
  let match

  while ((match = regex.exec(msgText)) !== null) {
    user_tgIDs.push(match[1])
  }

  for (const user_tgID of user_tgIDs) {
    const newUserInfo = await updateUser(user_tgID, approve)
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
      console.log(`Введіть причину відмови для користувача: ${newUserInfo.email}`)
      const userInput = await inputLineAdminScene(bot, msg) || 'не вказано'
      await sendInfoAboutDeclineRegistration(bot, user_tgID, userInput)
    }
    await userRemoveFromMenu(user_tgID)
    await bot.sendMessage(msg.chat.id, `Дякую! Заявку оброблено №_${user_tgID}.\n`, {
      reply_markup: {
        remove_keyboard: true
      }
    })
  }
}

async function userRemoveFromMenu(user_tgID) {
  try {
    const buttons = buttonsConfig["userApproveByAdmin"].buttons;
    for (const button of buttons) {
      if (button[0].callback_data === '13_3') break;
      button[0].text = button[0].text.replace(` №_${user_tgID.toString()}`, '')
    }
  } catch (err) {
    console.log(err)
  }
}

async function sendInfoAboutApproveRegistration(bot, user_tgID) {
  try {
    await bot.sendMessage(user_tgID, 'Вітаю! Вашу заявку на реєстрацію в системі <b>Інтерактивний чат-бот</b> було затверджено. Ви можете почати користуватися системою. Для переходу в головне меню натисніть /start', { parse_mode: 'HTML' })
  } catch (err) {
    console.log(err)
  }
}

async function sendInfoAboutDeclineRegistration(bot, user_tgID, reason = 'не вказано') {
  try {
    await new Promise(resolve => setTimeout(resolve, 1000))
    await bot.sendMessage(user_tgID, `Вашу заявку на реєстрацію в системі <b>Інтерактивний чат-бот</b> було відхилено з причини ${reason}. Для отримання додаткової інформації зверніться до адміністратора системи.`, { parse_mode: 'HTML' })
  } catch (err) {
    console.log(err)
  }
}

async function updateUser(chatId, approve) {
  const verify = approve ? 'TRUE' : 'FALSE'
  const user = await findUserById(chatId)
  try {
    console.log(`chatId=${chatId}, email= ${user?.email}, verify=${verify}`)
    const email = user?.email
    const query = `UPDATE users SET verified = ${verify} WHERE email = '${email}'`
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
    await bot.sendMessage(
			msg.chat.id,
			"📍Незрозуміла відповідь. Операцію скасовано\n",
			{ parse_mode: "HTML" },
		)
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
