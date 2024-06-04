const { inputLineScene } = require('../controllers/inputLine')
const { execPgQuery } = require('../db/common')

module.exports.findCustomers = async function (bot, msg) {
  try {
    const inputLength = 2
    const txtForSeek = await inputLineScene(bot, msg)
    if (txtForSeek.length < inputLength) return
    const data = await execPgQuery(`SELECT * FROM users WHERE firstname LIKE $1`, [`%${txtForSeek}%`], false, true)
    if (!Array.isArray(data)) {
      await bot.sendMessage(msg.chat.id, 'Користувачів не знайдено')
      return
    }

    const customerButtons = {
      title: 'Оберіть, будь ласка, співробітника:',
      options: [{ resize_keyboard: true }],
      buttons: data.map(customer => [
        { text: `👦🏼 ${customer.firstname} ${customer.lastname}`, callback_data: `73_${customer.id}` }
      ])
    }
    await bot.sendMessage(msg.chat.id, "Знайдені користувачі", {
      reply_markup: {
        inline_keyboard: customerButtons.buttons,
        resize_keyboard: true
      }
    })

  } catch (error) { console.log(error) }
}