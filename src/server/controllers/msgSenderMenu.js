const { buttonsConfig } = require('../modules/keyboard')
const { globalBuffer } = require('../globalBuffer')
const { execPgQuery } = require('../db/common')
const { findUserById } = require('../db/tgUsersService')
const fs = require('fs')
require('dotenv').config()

module.exports.msgSenderMenu = async function (bot, msg) {
  const checkChoices = await checkSelectedPeoplesAndSubdivisions(bot, msg, false)
  const chatId = msg.chat.id
  let title = '📧'
  if (!globalBuffer[chatId]?.selectedGroups && !globalBuffer[chatId]?.selectedPeriod) title = buttonsConfig.chooseReportSettings.title
  if (checkChoices) title = '📧'
  await bot.sendMessage(msg.chat.id, title, {
    reply_markup: {
      keyboard: buttonsConfig.chooseSenMessageSettings.buttons,
      resize_keyboard: true
    }
  })
}

module.exports.chooseSubdivisionsFromList = async function (bot, msg) {
  const data = await getSubdivisions()
  const chatId = msg.chat.id

  if (!data && data.length === 0) {
    await bot.sendMessage(msg.chat.id, 'На жаль, на даний момент немає доступних підрозділів.')
    return
  }

  if (globalBuffer[chatId] === undefined) globalBuffer[chatId] = {}
  globalBuffer[chatId].availableSubdivisions = data
  globalBuffer[chatId].selectedSubdivisions = []
  globalBuffer[msg.chat.id].SubdivisionsCounter = 0

  const subdivisionsButtons = {
    title: 'Оберіть, будь ласка, підрозділ(и):',
    options: [{ resize_keyboard: true }],
    buttons: data.map(subdivision => [
      { text: `🤽🏿‍♂️ ${subdivision.subdivision_name} `, callback_data: `63_${subdivision.id}` }
    ])
  }
  await bot.sendMessage(msg.chat.id, subdivisionsButtons.title, {
    reply_markup: {
      inline_keyboard: subdivisionsButtons.buttons,
      resize_keyboard: true
    }
  })
}
module.exports.messageCreateScene = async function (bot, msg) {
  try {
    const chatId = msg.chat.id
    await bot.sendMessage(chatId, buttonsConfig["messageCreate"].title, {
      reply_markup: {
        keyboard: buttonsConfig["messageCreate"].buttons,
        resize_keyboard: true,
        one_time_keyboard: false
      }
    })
  } catch (err) {
    console.log(err)
  }
}

module.exports.messageSender = async function (bot, msg, selectedByUser) {
  try {
    if (globalBuffer[msg.chat.id].selectedCustomers.length === 0) {
      if (!selectedByUser?.ticketBody || selectedByUser?.ticketBody.includes('🔵 Ввести текст відправлення')) {
        await bot.sendMessage(msg.chat.id, 'Не заповнен текст відправлення. Операцію скасовано\n', { parse_mode: 'HTML' })
        return
      }
    } else {
      const dirPath = process.env.DOWNLOAD_APP_PATH
      globalBuffer[msg.chat.id].msgSent = false
      for (const selectedCustomer of globalBuffer[msg.chat.id].selectedCustomers) {
        const user = await findUserById(Number(selectedCustomer.replace('73_', '')))
        console.log(user)
        if (user) {
          await bot.sendMessage(user.login, selectedByUser?.ticketBody || '🔵 Відправлення:', { parse_mode: 'HTML' })
          for (const attachmentFileName of selectedByUser?.ticketAttachmentFileNames) {
            const fileFullName = `${dirPath}${attachmentFileName}`
            await bot.sendDocument(user.login, fileFullName, { filename: attachmentFileName, caption: attachmentFileName })
            fs.unlinkSync(fileFullName)
          }
        }
      }
      globalBuffer[msg.chat.id].selectedCustomers = []
      globalBuffer[msg.chat.id].msgSent = true
    }
    await bot.sendMessage(msg.chat.id, `Повідомлення відправлено.`)
  } catch (err) {
    console.log(err)
  }
}

async function getSubdivisions() {
  try {
    const data = await execPgQuery('SELECT * FROM subdivisions ORDER BY subdivision_name ASC', [], false, true)
    if (data === null) return null
    return data
  } catch (error) {
    console.error('Error in function getSubdivisions:', error)
    return null
  }
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