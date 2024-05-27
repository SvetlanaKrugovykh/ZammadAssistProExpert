const { buttonsConfig } = require('../modules/keyboard')
const { globalBuffer } = require('../globalBuffer')

module.exports.msgSenderMenu = async function (bot, msg) {
  const checkChoices = await checkSelectedPeoplesAndSubdivisions(bot, msg, false)
  const chatId = msg.chat.id
  let title = '📧'
  if (!globalBuffer[chatId]?.selectedGroups && !globalBuffer[chatId]?.selectedPeriod) title = buttonsConfig.chooseReportSettings.title
  if (checkChoices) title = '📧'
  await bot.sendMessage(msg.chat.id, title, {
    reply_markup: {
      keyboard: buttonsConfig.chooseReportSettings.buttons,
      resize_keyboard: true
    }
  })
}

module.exports.msgSend = async function (bot, msg) {

  const checkChoices = await checkSelectedGroupsAndPeriod(bot, msg, true)
  if (checkChoices) {
    await createReport(bot, msg)
    globalBuffer[msg.chat.id] = {}
  }
}

async function checkSelectedPeoplesAndSubdivisions(bot, msg, isMessage) {
  const chatId = msg.chat.id
  let result = true
  try {
    console.log(`2_selectedGroups for  ${chatId} is ${globalBuffer[chatId]?.selectedGroups}`)
    if (!globalBuffer[chatId]?.selectedGroups || globalBuffer[chatId]?.selectedGroups?.length === 0) {
      if (isMessage) await bot.sendMessage(chatId, 'Ви не обрали жодної групи')
      result = false
    }

    if (globalBuffer[chatId]?.selectedPeriod === undefined) {
      if (isMessage) await bot.sendMessage(chatId, 'Ви не обрали період')
      result = false
    }
    return result
  } catch (e) {
    console.log(e)
    return false
  }
}