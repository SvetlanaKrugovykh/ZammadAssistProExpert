const { inputLineScene } = require('../controllers/inputLine')
const { execPgQuery } = require('../db/common')
const { globalBuffer } = require('../globalBuffer')
const { getCombinedData } = require('./getCombinedData.service')

module.exports.findCustomers = async function (bot, msg) {
  try {
    const chatId = msg.chat.id
    const selectedSubdivisions = globalBuffer[chatId]?.selectedSubdivisions
    const modifiedSubdivisions = selectedSubdivisions.map(subdivision => subdivision.replace('63_', ''))
    if (globalBuffer[chatId]?.selectedCustomers === undefined
      || globalBuffer[chatId]?.selectedCustomers.length === 0) {
      if (Array.isArray(selectedSubdivisions) && selectedSubdivisions.length > 0) {
        let combinedData = await getCombinedData(chatId, modifiedSubdivisions, selectedSubdivisions, 'finalize')
        if (Array.isArray(combinedData) && combinedData.length > 0) {
          for (const subDivCustomer of combinedData) {
            globalBuffer[chatId]?.selectedCustomers.push(`73_${subDivCustomer.id}`)
            console.log(`[${chatId}-${msg.message_id}]. Додано(findCustomers): 73_${subDivCustomer.id}`)
          }
        }
      }
    }

    const inputLength = 2
    const txtForSeek = await inputLineScene(bot, msg)
    if (txtForSeek.length < inputLength) return

    const data = await execPgQuery(`SELECT * FROM users WHERE active=true AND (firstname ILIKE $1 OR lastname ILIKE  $1)`, [`%${txtForSeek}%`], false, true)
    if (!Array.isArray(data) || data.length === 0) {
      await bot.sendMessage(chatId, 'Користувачів не знайдено')
      return
    }

    // Ensure selectedCustomers is initialized
    if (!Array.isArray(globalBuffer[chatId].selectedCustomers)) {
      globalBuffer[chatId].selectedCustomers = []
    }
    // Add found customers to selectedCustomers as '73_id'
    for (const customer of data) {
      const customerKey = `73_${customer.id}`
      if (!globalBuffer[chatId].selectedCustomers.includes(customerKey)) {
        globalBuffer[chatId].selectedCustomers.push(customerKey)
      }
    }
    globalBuffer[chatId].selectedCustomers = [...new Set(globalBuffer[chatId].selectedCustomers)]

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
    const selectedCustomers = globalBuffer[chatId]?.selectedCustomers
    const selectedSubdivisions = globalBuffer[chatId]?.selectedSubdivisions
    const noCustomers = !Array.isArray(selectedCustomers) || selectedCustomers.length === 0
    const noSubdivisions = !Array.isArray(selectedSubdivisions) || selectedSubdivisions.length === 0
    if (noCustomers && noSubdivisions) {
      await bot.sendMessage(chatId, 'Отримувачів не обрано.')
      return
    }
    const modifiedSubdivisions = Array.isArray(selectedSubdivisions) ? selectedSubdivisions.map(subdivision => subdivision.replace('63_', '')) : []

    let combinedData = await getCombinedData(chatId, modifiedSubdivisions, selectedSubdivisions, action)

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