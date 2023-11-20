const { inputLineScene } = require('./inputLine')
require('dotenv').config()


async function supportScene(bot, msg, isAuthorized) {
  const GROUP_ID = process.env.GROUP_ID
  try {
    const chatId = msg.chat.id
    await bot.sendMessage(chatId, "<i>Залиште нижче текстове повідомлення для служби технічної підтримки.\n Прохання вказати номер телефону та як нам зручніше з Вами зв'язатись</i>", { parse_mode: "HTML" })
    let userInput = await inputLineScene(bot, msg)
    if (userInput.length < 5) {
      await bot.sendMessage(chatId, "Ви не залишили змістовного повідомлення. Повторіть спробу")
      return
    }
    console.log(userInput)
    await bot.sendMessage(GROUP_ID, `Звернення від ${msg.chat.first_name} ${msg.chat.last_name} id ${msg.chat.id} username ${msg.chat.username}` + `\n` + userInput, { parse_mode: "HTML" })
    await bot.sendMessage(
      chatId, `Дякую! Ваше повідомлення надіслано.\n Чекайте на відповідь протягом 30 хвилин`, { parse_mode: "HTML" })

  } catch (err) {
    console.log(err)
  }
}

module.exports = supportScene
