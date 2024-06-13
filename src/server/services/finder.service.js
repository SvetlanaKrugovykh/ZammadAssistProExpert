const { inputLineScene } = require('../controllers/inputLine')
const { execPgQuery } = require('../db/common')
const { globalBuffer } = require('../globalBuffer')

module.exports.findCustomers = async function (bot, msg) {
  try {
    const inputLength = 2
    const txtForSeek = await inputLineScene(bot, msg)
    if (txtForSeek.length < inputLength) return
    const data = await execPgQuery(`SELECT * FROM users WHERE firstname ILIKE $1 OR lastname ILIKE  $1`, [`%${txtForSeek}%`], false, true)
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

module.exports.createListOfCustomers = async function (bot, msg, action = '') {
  try {
    const selectedSubdivisions = globalBuffer[msg.chat.id]?.selectedSubdivisions
    if (!Array.isArray(selectedSubdivisions) || selectedSubdivisions.length === 0) return
    const modifiedSubdivisions = selectedSubdivisions.map(subdivision => subdivision.replace('63_', ''))

    const data = await execPgQuery(`SELECT * FROM users WHERE departments = ANY($1)`, [modifiedSubdivisions], false, true) || []
    let data_shops = [];
    if (selectedSubdivisions.includes("63_28")) {
      data_shops = await execPgQuery(`SELECT * FROM users WHERE email LIKE $1`, ['lotok%.uprav@lotok.in.ua'], false, true)
    }

    const combinedData = data.concat(data_shops);
    combinedData.sort((a, b) => a.firstname > b.firstname ? 1 : -1)

    if (!Array.isArray(combinedData) || combinedData.length === 0) {
      await bot.sendMessage(msg.chat.id, 'Користувачів не знайдено')
      return
    }

    // if (action === 'selection') globalBuffer[msg.chat.id].selectedUsers = combinedData  //TODO
    // if (action === 'finilize') globalBuffer[msg.chat.id].selectedUsers = []             //TODO

    const customerButtons = {
      title: 'Обрано співробітників :',
      options: [{ resize_keyboard: true }],
      buttons: combinedData.map(customer => [
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