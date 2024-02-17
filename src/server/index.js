const Fastify = require('fastify')
const cron = require('node-cron')
require('dotenv').config()
const { buttonsConfig } = require('./modules/keyboard')
const { users } = require('./users/users.model')
const { handler } = require('./controllers/switcher')
const { clientAdminMenuStarter } = require('./controllers/clientsAdmin')
const { checkAndReplaceTicketsStatuses, autoCloseTicketsWithoutCustomerFeedback } = require('./services/scheduledTasks')
const singUpDataSave = require('./controllers/signUp').singUpDataSave
const formController = require('./controllers/formController')
const { usersStarterMenu } = require('./modules/common')
const { isThisGroupId } = require('./modules/bot')
const { execPgQuery } = require('./db/common')
const webAppUrl = 'https://' + process.env.WEB_APP_URL
const { bot, globalBuffer } = require('./globalBuffer')
const { checkReadyForReport } = require('./controllers/reportsController')
const { cert } = require('./data/consts')
const app = Fastify({
  trustProxy: true
})

const interConnectApp = Fastify({
  trustProxy: true,
  https: {
    key: cert.key,
    cert: cert.cert
  }
})

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

interConnectApp.register(require('./routes/interConnect.route'), { prefix: '/inter-connect' })

bot.on('callback_query', async (callbackQuery) => {
  try {
    const chatId = callbackQuery.message.chat.id
    const messageId = callbackQuery.message.message_id

    if (globalBuffer[chatId] === undefined) globalBuffer[chatId] = {}
    const selectedGroups = globalBuffer[chatId].selectedGroups || []

    if (callbackQuery.data.startsWith('53_')) {
      const selectedGroup = callbackQuery.data
      selectedGroups.push(selectedGroup)
      globalBuffer[chatId].selectedGroups = selectedGroups
      console.log(`1_selectedGroups for  ${chatId} is ${globalBuffer[chatId]?.selectedGroups}`)
      const groups = await execPgQuery(`SELECT * FROM groups WHERE active`, [], false, true)
      const group = groups.find(g => g.id === Number(selectedGroup.replace('53_', '')))
      console.log(`[${chatId}-${messageId}].Обрано: ${selectedGroup}`)
      let groupName = group ? group.name : group_id
      await bot.sendMessage(chatId, `Обрано: ${groupName}`)
    }
    await checkReadyForReport(bot, callbackQuery.message)
    return
  }
  catch (e) {
    console.log(e)
  }
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

module.exports = { app, assistApiServer, interConnectApp, bot }
