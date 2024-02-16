const { execPgQuery } = require('../db/common')
const { buttonsConfig } = require('../modules/keyboard')
const { bot } = require('../globalBuffer')

module.exports.newRecord = async function (body) {
  try {
    const { ticket_id, sender_id, state_id, login, message_in, urls_in } = body
    const urls_in_string = urls_in.join(',')
    const query = `INSERT INTO ticket_updates(state_id, ticket_id, sender_id, login, message_in, urls_in) VALUES($1, $2, $3, $4, $5, $6)`
    const values = [state_id, ticket_id, sender_id, login, message_in, urls_in_string]
    await execPgQuery(query, values, true)
    await callFeedBackMenu(login, ticket_id, message_in, urls_in_string)
    return true
  } catch (error) {
    console.error('Error executing commands:', error.message)
    return false
  }
}

module.exports.userReplyRecord = async function (body) {
  try {
    const { ticket_id, sender_id, state_id, login, message_out, urls_out, id } = body
    const urls_out_string = urls_out.join(',')
    const query = `UPDATE ticket_updates SET state_id=$1, ticket_id=$2, sender_id=$3, login=$4, message_out=$5, urls_out=$6 WHERE id=$7`
    const values = [state_id, ticket_id, sender_id, login, message_out, urls_out_string, id]
    await execPgQuery(query, values, true)
    return true
  } catch (error) {
    console.error('Error executing commands:', error.message)
    return false
  }
}

async function callFeedBackMenu(chatId, ticket_id, message_in, urls_in_string) {
  try {
    const urls = urls_in_string.split(',')
    await bot.sendMessage(chatId, `⚠️⚠️⚠️ Увага! Аби ми мали можливість оперативно допомогти із заявкою № ${ticket_id} Необхідно: ${message_in} ⚠️⚠️⚠️`)
    urls.forEach(async (url_in) => {
      await bot.sendMessage(chatId, url_in)
    })
    const add = ticket_id ? ` №_${ticket_id}` : ''
    const buttons = buttonsConfig["callTicketUpdate"].buttons
    for (const button of buttons) {
      if (button[0].callback_data === '3_3') break
      button[0].text = button[0].text.replace('Відповідсти на додатковй запит', `${add}. Відповідсти на додатковй запит`)
    }
    await bot.sendMessage(chatId, buttonsConfig["callTicketUpdate"].title, {
      reply_markup: {
        keyboard: buttons,
        resize_keyboard: true,
        one_time_keyboard: false
      }
    })
  } catch (error) {
    console.error('Error executing commands:', error.message)
    return false
  }
}

module.exports.getNewRecord = async function (ticket_id, callFeebBack = false) {
  try {
    const data = await execPgQuery(`SELECT * FROM ticket_updates WHERE state_id=111 AND ticket_id=$1 ORDER BY updated_at DESC LIMIT 1`, [ticket_id], false)
    if (callFeebBack) {
      callFeedBackMenu(data)
      return true
    }
    return data
  } catch (error) {
    console.error('Error executing commands:', error.message)
    return false
  }
}

module.exports.sendReplyToCustomer = async function (customer_id, ticketID, ticket_update_data) {
  const { message_out, urls_out } = ticket_update_data
  try {
    const user = await findUserById(customer_id)
    if (user) {
      const chatId = user.login
      const urls = urls_out.split(',')
      await bot.sendMessage(chatId, `⚠️⚠️⚠️ Увага! Вам надійшла відповідь користувача за заявкою № ${ticketID} Відповідь: ${message_out} ⚠️⚠️⚠️`)
      urls.forEach(async (url) => {
        await bot.sendMessage(chatId, url)
      })
      return true
    }
  } catch (error) {
    console.error('Error executing commands:', error.message)
    return false
  }
}
