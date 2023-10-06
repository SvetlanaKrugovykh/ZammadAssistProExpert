const Fastify = require('fastify')
const TelegramBot = require('node-telegram-bot-api')
require('dotenv').config()

const { buttonsConfig } = require('./modules/keyboard')
const { users } = require('./users/users.model')
const { handler, guestMenu, registeredUserMenu } = require('./controllers/switcher')
const singUpDataSave = require('./controllers/signUp').singUpDataSave
const formController = require('./controllers/formController')

const { findUserById } = require('./db/tgUsersService')

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const webAppUrl = 'https://' + process.env.WEB_APP_URL

const app = Fastify({
  trustProxy: true
})

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true })

app.register(require('@fastify/cors'), {})

bot.on('message', async (msg) => {

  const chatId = msg.chat.id
  const text = msg.text
  const ctx = msg

  if (text === '/start') {
    console.log(new Date())
    console.log(ctx.chat)
    const adminUser = users.find(user => user.id === ctx.chat.id)  //TODO
    const registeredUser = await findUserById(msg.chat.id)

    if (registeredUser === null) {
      try {
        await guestMenu(bot, msg, buttonsConfig["guestStartButtons"])
      } catch (err) {
        console.log(err)
      }
    } else {
      try {
        await registeredUserMenu(bot, msg, buttonsConfig["standardStartButtons"])
      } catch (err) {
        console.log(err)
      }
    }
  } else {
    await handler(bot, msg, webAppUrl)
  }

  if (msg?.web_app_data?.data) {
    try {
      const data = JSON.parse(msg?.web_app_data?.data)
      console.log(data)
      await bot.sendMessage(chatId, 'Дякуємо за зворотній зв`язок!')
      await bot.sendMessage(chatId, 'Ваш emal: ' + data?.email)
      await bot.sendMessage(chatId, 'Ваш договір: ' + data?.contract)
      await bot.sendMessage(chatId, 'Всю необхідну інформацію Ви можете отримувати в цьому чаті. Якщо у Вас виникли питання, звертайтесь через меню /"Надіслати повідомлення/". Зараз для переходу в головне меню натисніть /start')
      await singUpDataSave(bot, chatId, data)
      return
    } catch (e) {
      console.log(e)
    }
  }

})


app.post('/submit-form', formController.handleFormSubmit)

const assistApiServer = Fastify({
  trustProxy: true,
})

module.exports = { app, assistApiServer }
