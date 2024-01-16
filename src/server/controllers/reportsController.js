const { buttonsConfig } = require('../modules/keyboard')
const { createReport, getGroups } = require('../db/tgReportsService')
const Calendar = require('telegram-inline-calendar')

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

  if (data && data.length > 0) {
    const groupsButtons = {
      title: 'Оберіть будь ласка підрозділ(и):',
      options: [{ resize_keyboard: true }],
      buttons: data.map(group => [
        { text: `○ ${group.name} `, callback_data: `43_${group.id}` }
      ])
    }
    groupsButtons.buttons.push([{ text: '↖️', callback_data: '0_1' }])
    await bot.sendMessage(msg.chat.id, groupsButtons.title, {
      reply_markup: {
        inline_keyboard: groupsButtons.buttons,
        resize_keyboard: true
      }
    })
  } else {
    await bot.sendMessage(msg.chat.id, 'На жаль, на даний момент немає доступних послуг. Спробуйте пізніше.')
  }
}

module.exports.getReport = async function (bot, msg, period) {
  await bot.sendMessage(msg.chat.id, `Ви обрали період: ${period}`)

  if (period == 'any_period') {
    //await chooseData(bot, msg)
    console.log('any_period')
  } else {
    await createReport(bot, msg, period)
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