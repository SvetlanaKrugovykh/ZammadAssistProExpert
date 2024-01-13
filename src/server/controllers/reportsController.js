const { Calendar } = require('node-telegram-keyboard-wrapper')
const { buttonsConfig } = require('../modules/keyboard')

module.exports.reports = async function (bot, msg) {

  await bot.sendMessage(msg.chat.id, buttonsConfig.chooseTypeOfPeriod.title, {
    reply_markup: {
      keyboard: buttonsConfig.chooseTypeOfPeriod.buttons,
      resize_keyboard: true
    }
  })

}

module.exports.getReport = async function (bot, msg, period) {
  await bot.sendMessage(msg.chat.id, `Ви обрали період: ${period}`)
  if (period == 'any_period') {
    //await chooseData(bot, msg)
    console.log('any_period')
  }
}

module.exports.chooseData = async function (bot, msg) {
  const calendar = 123; //new Calendar(bot)
  // calendar
  //   .setMinDate(new Date('2000-01-01'))
  //   .setMaxDate(new Date())
  //   .setCallback((date) => {
  //     console.log('Selected date:', date)
  //     bot.sendMessage(chatId, `Ви вибрали дату: ${date}`)
  //   })

  //await calendar.open(query.message.chat.id)
}