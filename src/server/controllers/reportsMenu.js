const { buttonsConfig } = require('../modules/keyboard')
const globalBuffer = require('../globalBuffer')
const { createReport } = require('../db/tgReportsService')

module.exports.reports = async function (bot, msg) {
  const checkChoices = await checkSelectedGroupsAndPeriod(bot, msg)
  let title = 'Оберіть, будь ласка, параметри для формування звіту:'
  if (checkChoices) {
    title = '📊'
  } else {
    if (globalBuffer[msg.chat.id]?.groupCounter === 1 || globalBuffer[msg.chat.id]?.periodCounter === 1) {
      if (globalBuffer[msg.chat.id]?.groupCounter === 1 && globalBuffer[msg.chat.id]?.periodCounter === 1) {
        title = '🥎 Оберіть: Отримати звіт з виконання заявок'
      } else if (globalBuffer[msg.chat.id]?.groupCounter === 1) {
        title = '🥎 Оберіть: Оберіть групу(и)'
      } else if (globalBuffer[msg.chat.id]?.periodCounter === 1) {
        title = '🥎 Оберіть: Оберіть період звіту'
      }
    } else {
      title = buttonsConfig.chooseReportSettings.title
    }
  }

  await bot.sendMessage(msg.chat.id, title, {
    reply_markup: {
      keyboard: buttonsConfig.chooseReportSettings.buttons,
      resize_keyboard: true
    }
  })
}

module.exports.getReport = async function (bot, msg) {

  const checkChoices = await checkSelectedGroupsAndPeriod(bot, msg)
  if (checkChoices) {
    await createReport(bot, msg)
    globalBuffer[msg.chat.id] = {}
  }
}

async function checkSelectedGroupsAndPeriod(bot, msg) {
  const chatId = msg.chat.id
  try {
    console.log(`2_selectedGroups for  ${chatId} is ${globalBuffer[chatId]?.selectedGroups}`)
    if (!globalBuffer[chatId]?.selectedGroups || globalBuffer[chatId]?.selectedGroups?.length === 0) {
      await bot.sendMessage(chatId, 'Ви не обрали жодної групи')
      return false
    }

    if (globalBuffer[chatId]?.selectedPeriod === undefined) {
      await bot.sendMessage(chatId, 'Ви не обрали період')
      return false
    }
    return true
  } catch (e) {
    console.log(e)
    return false
  }
}