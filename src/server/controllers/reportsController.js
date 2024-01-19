const { buttonsConfig } = require('../modules/keyboard')
const { createReport, getGroups } = require('../db/tgReportsService')
const Calendar = require('telegram-inline-calendar')
const globalBuffer = require('../globalBuffer')

module.exports.reports = async function (bot, msg) {
  await bot.sendMessage(msg.chat.id, buttonsConfig.chooseReportSettings.title, {
    reply_markup: {
      keyboard: buttonsConfig.chooseReportSettings.buttons,
      resize_keyboard: true
    }
  })
}

module.exports.chooseTypeOfPeriod = async function (bot, msg) {
  await bot.sendMessage(msg.chat.id, buttonsConfig.chooseTypeOfPeriod.title, {
    reply_markup: {
      keyboard: buttonsConfig.chooseTypeOfPeriod.buttons,
      resize_keyboard: true
    }
  })
}

module.exports.chooseGroups = async function (bot, msg) {
  const data = await getGroups()
  const chatId = msg.chat.id

  if (!data && data.length === 0) {
    await bot.sendMessage(msg.chat.id, 'На жаль, на даний момент немає доступних груп.')
    return
  }

  if (globalBuffer[chatId] === undefined) globalBuffer[chatId] = {}
  globalBuffer[chatId].availableGorups = data
  globalBuffer[chatId].selectedGroups = []

  const groupsButtons = {
    title: 'Оберіть будь ласка групу(и):',
    options: [{ resize_keyboard: true }],
    buttons: data.map(group => [
      { text: `👩‍👩‍👧‍👧 ${group.name} `, callback_data: `53_${group.id}` }
    ])
  }
  groupsButtons.buttons.push([{ text: '↖️', callback_data: '0_1' }])
  await bot.sendMessage(msg.chat.id, groupsButtons.title, {
    reply_markup: {
      inline_keyboard: groupsButtons.buttons,
      resize_keyboard: true
    }
  })
}



module.exports.getReport = async function (bot, msg, otherPeriod, groups_filter = []) {

  const periodDetails = {
    '🌗': { name: 'last_month', description: 'за останній місяць' },
    '🌔': { name: 'last_week', description: 'за останній тиждень' },
    '🌛': { name: 'any_period', description: 'за довільний період' },
    '🌕': { name: 'last_year', description: 'за останній рік' },
    '🌙': { name: 'today', description: 'сьогодні' },
  }
  try {
    const periodSign = msg.text.split(' ')[0]
    const periodInfo = periodDetails[periodSign]

    await bot.sendMessage(msg.chat.id, `Ви обрали період: ${periodInfo.description}`)

    if (periodInfo.name == 'any_period') {
      await createReport(bot, msg, periodInfo.name, otherPeriod, groups_filter)
    } else {
      await createReport(bot, msg, periodInfo.name, '', groups_filter)
    }
  } catch (e) {
    console.log(e)
  }
}

module.exports.chooseData = async function (bot, msg, dataType = '') {
  const calendar = new Calendar(bot, {
    date_format: 'DD-MM-YYYY',
    language: process.env.CALENDAR_LANG || 'uk'
  })
  calendar.startNavCalendar(msg)
  bot.on("callback_query", (query) => {
    if (query.message.message_id == calendar.chats.get(query.message.chat.id)) {
      var res
      res = calendar.clickButtonCalendar(query)
      if (res !== -1) {
        bot.sendMessage(query.message.chat.id, `Ви обрали ${dataType} дату: ${res}`)
      }
    }
  })
}