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
    cert: cert.cert,
    ca: cert.ca
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
interConnectApp.register(require('@fastify/cors'), { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] })
interConnectApp.register(require('./routes/interConnect.route'), { prefix: '/inter-connect' })
interConnectApp.register(require('./routes/subdivisions.route'), { prefix: '/assist-api' })

bot.on('callback_query', async (callbackQuery) => {
  try {
    const chatId = callbackQuery.message.chat.id
    const messageId = callbackQuery.message.message_id

    if (globalBuffer[chatId] === undefined) globalBuffer[chatId] = {}
    const selectedGroups = globalBuffer[chatId].selectedGroups || []
    const selectedSubdivisions = globalBuffer[chatId].selectedSubdivisions || []
    const selectedCustomers = globalBuffer[chatId].selectedCustomers || []

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
    if (callbackQuery.data.startsWith('63_')) {
      globalBuffer[chatId].selectionFlag = false
      const selectedSubdivision = callbackQuery.data
      selectedSubdivisions.push(selectedSubdivision)
      globalBuffer[chatId].selectedSubdivisions = selectedSubdivisions
      console.log(`1_selectedSubdivisions for  ${chatId} is ${globalBuffer[chatId]?.selectedSubdivisions}`)
      const Subdivisions = await execPgQuery(`SELECT * FROM subdivisions`, [], false, true)
      const Subdivision = Subdivisions.find(g => g.id === Number(selectedSubdivision.replace('63_', '')))
      console.log(`[${chatId}-${messageId}].Обрано: ${selectedSubdivision}`)
      let SubdivisionName = Subdivision ? Subdivision.subdivision_name : id
      await bot.sendMessage(chatId, `Обрано: ${SubdivisionName}`)
    }

    if (callbackQuery.data.startsWith('73_')) {
      let title = 'Додано:'
      const selectedCustomer = callbackQuery.data
      if (globalBuffer[chatId]?.selectAction === 'selection') {
        console.log('selection', selectedCustomer)
        globalBuffer[chatId].selectionFlag = true
      }
      if (globalBuffer[chatId]?.selectAction === 'finalize') {
        console.log('finalize', selectedCustomer)
        globalBuffer[chatId].selectionFlag = true
        globalBuffer[chatId].selectionSubdivisionFlag = true
        title = 'Видалено:'
        const index = selectedCustomers.indexOf(selectedCustomer);
        if (index !== -1) {
          selectedCustomers.splice(index, 1)
        }
      } else {
        selectedCustomers.push(selectedCustomer)
      }
      globalBuffer[chatId].selectedCustomers = selectedCustomers
      console.log(`1_selectedCustomers for  ${chatId} is ${globalBuffer[chatId]?.selectedCustomers}`)
      const Customers = await execPgQuery(`SELECT * FROM users WHERE id=$1`, [Number(selectedCustomer.replace('73_', ''))], false, true)
      const Customer = Customers.find(g => g.id === Number(selectedCustomer.replace('73_', '')))
      console.log(`[${chatId}-${messageId}]. ${title} ${selectedCustomer}`)
      let CustomerName = Customer ? Customer.firstname + ' ' + Customer.lastname : id
      await bot.sendMessage(chatId, `${title} ${CustomerName}`)
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
