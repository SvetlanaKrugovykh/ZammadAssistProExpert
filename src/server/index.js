const Fastify = require('fastify')
const fastifyStatic = require('@fastify/static')
const cron = require('node-cron')
const TelegramBot = require('node-telegram-bot-api')
require('dotenv').config()
const { buttonsConfig } = require('./modules/keyboard')
const { cert } = require('./data/consts')
const { users } = require('./users/users.model')
const { handler } = require('./controllers/switcher')
const { clientAdminMenuStarter } = require('./controllers/clientsAdmin')
const { checkAndReplaceTicketsStatuses, autoCloseTicketsWithoutCustomerFeedback } = require('./services/scheduledTasks')
const singUpDataSave = require('./controllers/signUp').singUpDataSave
const formController = require('./controllers/formController')
const { usersStarterMenu } = require('./modules/common')
const { isThisGroupId } = require('./modules/bot')
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const webAppUrl = 'https://' + process.env.WEB_APP_URL

const app = Fastify({
  trustProxy: true
})

const downloadApp = Fastify({
  trustProxy: true,
  https: {
    key: cert.key,
    cert: cert.cert
  }
})

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true })

const CLOSED_TICKET_SCAN_INTERVAL_MINUTES = Number(process.env.CLOSED_TICKET_SCAN_INTERVAL_MINUTES) || 10

cron.schedule(`*/${CLOSED_TICKET_SCAN_INTERVAL_MINUTES} 7-23 * * *`, () => {
  const currentTime = new Date().toLocaleString()
  console.log(`Running cron checkAndReplaceTicketsStatuses job...... Current time: ${currentTime}`)
  checkAndReplaceTicketsStatuses(bot)
})

const TICKET_AUTO_CLOSE_SCHEDULLER_STRING = process.env.TICKET_AUTO_CLOSE_SCHEDULLER_STRING || '10 6 * * *'
cron.schedule(TICKET_AUTO_CLOSE_SCHEDULLER_STRING, () => {
  const currentTime = new Date().toLocaleString()
  console.log(`Running cron autoCloseTicketsWithoutCustomerFeedback job...... Current time: ${currentTime}`)
  autoCloseTicketsWithoutCustomerFeedback(bot)
})

app.register(require('@fastify/cors'), {})

const downloadPath = process.env.DOWNLOAD_APP_PATH || 'C:\\Temp\\attachments'
downloadApp.register(fastifyStatic, {
  root: downloadPath,
  prefix: `/`
})

bot.on('message', async (msg) => {

  const chatId = msg.chat.id
  const text = msg.text
  const ctx = msg
  if (await isThisGroupId(bot, chatId, msg)) return

  if (text === '/start') {
    console.log(new Date())
    console.log(ctx.chat)
    const adminUser = users.find(user => user.id === ctx.chat.id)  //TODO
    if (adminUser) {
      await await clientAdminMenuStarter(bot, msg, buttonsConfig["clientAdminStarterButtons"])
    } else {
      await usersStarterMenu(bot, msg)
    }
  } else {
    await handler(bot, msg, webAppUrl)
  }

  if (msg?.web_app_data?.data) {
    try {
      const data = JSON.parse(msg?.web_app_data?.data)
      console.log(data)
      await bot.sendMessage(chatId, 'Дякуємо за зворотній зв`язок!')
      await bot.sendMessage(chatId, 'Ваш email: ' + data?.email)
      await bot.sendMessage(chatId, 'Ваші прізвище та ім`я: ' + data?.PIB)
      await bot.sendMessage(chatId, 'Ваш номер телефону: ' + data?.phoneNumber)
      await bot.sendMessage(chatId, 'Запит на реєстрацію користувача відправлено службі технічної підтримки. Очікуйте підтвердження!')
      await bot.sendMessage(chatId, 'Зараз для переходу в головне меню натисніть /start')
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

module.exports = { app, assistApiServer, downloadApp, bot }
