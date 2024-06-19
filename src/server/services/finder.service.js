const { inputLineScene } = require('../controllers/inputLine')
const { execPgQuery } = require('../db/common')
const { globalBuffer } = require('../globalBuffer')

module.exports.findCustomers = async function (bot, msg) {
  try {
    const chatId = msg.chat.id
    const inputLength = 2
    const txtForSeek = await inputLineScene(bot, msg)
    if (txtForSeek.length < inputLength) return
    const data = await execPgQuery(`SELECT * FROM users WHERE firstname ILIKE $1 OR lastname ILIKE  $1`, [`%${txtForSeek}%`], false, true)
    if (!Array.isArray(data)) {
      await bot.sendMessage(chatId, 'Користувачів не знайдено')
      return
    }

    globalBuffer[chatId].selectAction = 'selection'
    const customerButtons = {
      title: 'Оберіть, будь ласка, співробітника:',
      options: [{ resize_keyboard: true }],
      buttons: data.map(customer => [
        { text: `👦🏼 ${customer.firstname} ${customer.lastname}`, callback_data: `73_${customer.id}` }
      ])
    }
    await bot.sendMessage(chatId, "Знайдені користувачі", {
      reply_markup: {
        inline_keyboard: customerButtons.buttons,
        resize_keyboard: true
      }
    })

  } catch (error) { console.log(error) }
}

module.exports.createListOfCustomers = async function (bot, msg, action = '') {
  try {
    const chatId = msg.chat.id
    const selectedSubdivisions = globalBuffer[chatId]?.selectedSubdivisions
    if (!Array.isArray(selectedSubdivisions) || selectedSubdivisions.length === 0) {
      await bot.sendMessage(chatId, 'Отримувачів не обрано.')
      return
    }
    const modifiedSubdivisions = selectedSubdivisions.map(subdivision => subdivision.replace('63_', ''))

    let data = []
    let data_shops = []
    if (!globalBuffer[chatId]?.selectedCustomers) globalBuffer[chatId].selectedCustomers = []

    if (!globalBuffer[chatId]?.selectionSubdivisionFlag) {
      data = await execPgQuery(`SELECT * FROM users WHERE departments = ANY($1)`, [modifiedSubdivisions], false, true) || []
      if (selectedSubdivisions.includes("63_28"))
        data_shops = await execPgQuery(`SELECT * FROM users WHERE email LIKE $1`, ['lotok%.uprav@lotok.in.ua'], false, true)
    }

    if (action === 'selection') {
      globalBuffer[chatId].selectionSubdivisionFlag = true
    }

    let combinedData = data.concat(data_shops)
    let addedCustomers = []

    if (action === 'finalize') {
      if (!globalBuffer[chatId]?.selectionFlag) {
        for (const subDivCustomer of combinedData) {
          globalBuffer[chatId]?.selectedCustomers.push(`73_${subDivCustomer.id}`)
        }
      }
      if (Array.isArray(globalBuffer[chatId]?.selectedCustomers) && globalBuffer[chatId]?.selectedCustomers.length > 0) {
        const addedCustomersIds = globalBuffer[chatId].selectedCustomers.map(customer => customer.replace('73_', ''))
        addedCustomers = await execPgQuery(`SELECT * FROM users WHERE id = ANY($1)`, [addedCustomersIds], false, true) || []
      }
      combinedData = combinedData.concat(addedCustomers)
    }

    combinedData = Array.from(new Set(combinedData.map(JSON.stringify))).map(JSON.parse)
    combinedData.sort((a, b) => a.firstname > b.firstname ? 1 : -1)

    if (!Array.isArray(combinedData) || combinedData.length === 0) {
      await bot.sendMessage(chatId, 'Користувачів не знайдено')
      return
    }

    if (action !== '') globalBuffer[chatId].selectAction = action

    const customerButtons = {
      title: 'Обрано співробітників :',
      options: [{ resize_keyboard: true }],
      buttons: combinedData.map(customer => [
        { text: `👦🏼 ${customer.firstname} ${customer.lastname}`, callback_data: `73_${customer.id}` }
      ])
    }
    await bot.sendMessage(chatId, "Знайдені користувачі", {
      reply_markup: {
        inline_keyboard: customerButtons.buttons,
        resize_keyboard: true
      }
    })

  } catch (error) { console.log(error) }
}