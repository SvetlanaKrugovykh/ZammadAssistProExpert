const { inputLineScene } = require('../controllers/inputLine')
const { execPgQuery } = require('../db/common')
const { globalBuffer } = require('../globalBuffer')
const { getCombinedData } = require('./getCombinedData.service')

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