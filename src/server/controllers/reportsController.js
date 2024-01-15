const Calendar = require('telegram-inline-calendar')
const { buttonsConfig } = require('../modules/keyboard')
const { createReport, getGroups } = require('../db/tgReportsService')

module.exports.reports = async function (bot, msg) {

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

module.exports.chooseData = async function (bot, msg) {
  const calendar = new Calendar(bot, {
    date_format: 'DD-MM-YYYY',
    language: 'ru'
  })
  calendar.startNavCalendar(msg)
}