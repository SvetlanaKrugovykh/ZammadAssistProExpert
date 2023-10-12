const Fastify = require('fastify')
const fastifyStatic = require('@fastify/static')
const cron = require('node-cron')
const TelegramBot = require('node-telegram-bot-api')
require('dotenv').config()
const { buttonsConfig } = require('./modules/keyboard')
const { users } = require('./users/users.model')
const { handler, usersStarterMenu } = require('./controllers/switcher')
const { clientAdminMenuStarter } = require('./controllers/clientsAdmin')
const { checkAndReplaceTicketsStatuses, autoCloseTicketsWithoutCustomerFeedback } = require('./services/scheduledTasks')
const singUpDataSave = require('./controllers/signUp').singUpDataSave
const formController = require('./controllers/formController')
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const webAppUrl = 'https://' + process.env.WEB_APP_URL

const app = Fastify({
  trustProxy: true
})

const downloadApp = Fastify({
  trustProxy: true
})

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true })

const CLOSED_TICKET_SCAN_INTERVAL_MINUTES = Number(process.env.CLOSED_TICKET_SCAN_INTERVAL_MINUTES) || 10

const TICKET_AUTO_CLOSE_DAYS = Number(process.env.TICKET_AUTO_CLOSE_DAYS) || 3

cron.schedule(`*/${CLOSED_TICKET_SCAN_INTERVAL_MINUTES} 7-23 * * *`, () => {
  const currentTime = new Date().toLocaleString()
  console.log(`Running cron checkAndReplaceTicketsStatuses job...... Current time: ${currentTime}`)
  checkAndReplaceTicketsStatuses(bot)
})

cron.schedule('0 3 * * *', () => {
  const currentTime = new Date().toLocaleString()
  console.log(`Running cron autoCloseTicketsWithoutCustomerFeedback job...... Current time: ${currentTime}`)
  autoCloseTicketsWithoutCustomerFeedback()
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

module.exports = { app, assistApiServer, downloadApp, bot }
