const axios = require('axios')
const https = require('https')
const fs = require('fs')
const { execPgQuery } = require('../db/common')
const { buttonsConfig } = require('../modules/keyboard')
const { bot } = require('../globalBuffer')
const { findUserById } = require('../db/tgUsersService')
const { getTicketData } = require('../modules/common')
const { getTicketArticles } = require('../modules/notifications')
require('dotenv').config()

module.exports.newRecord = async function (body) {
  try {
    const { ticket_id, article_id, sender_id, state_id, login, message_in, urls_in } = body
    const urls_in_string = urls_in.join(',')
    const data = await execPgQuery(`SELECT * FROM ticket_updates WHERE state_id=100 AND ticket_id=$1 ORDER BY updated_at DESC LIMIT 1`, [ticket_id], false)
    let query = '', values = []
    if (data?.id) {
      query = `UPDATE ticket_updates SET state_id=$1, ticket_id=$2, sender_id=$3, login=$4, message_in=$5, urls_in=$6 WHERE id=$7 AND state_id=100`
      values = [state_id, ticket_id, sender_id, login, message_in, urls_in_string, data.id]
    } else {
      query = `INSERT INTO ticket_updates(state_id, ticket_id, sender_id, login, message_in, urls_in) VALUES($1, $2, $3, $4, $5, $6)`
      values = [state_id, ticket_id, sender_id, login, message_in, urls_in_string]
    }
    await execPgQuery(query, values, true)
    const data_body = { chatId: login, ticket_id, article_id, message_in, urls_in, urls_in_string }
    await callFeedBackMenu(data_body)
    return true
  } catch (error) {
    console.error('Error executing commands:', error.message)
    return false
  }
}

module.exports.newRequest = async function (body) {
  try {
    const { currentPageURL } = body
    const psrts = currentPageURL.split('/')
    const ticket_id = psrts[psrts.length - 1]
    if (!(ticket_id > 0)) return false
    const ticket = await getTicketData(ticket_id)
    if (!ticket) return null
    const user_data = await findUserById(ticket.customer_id)
    const article = await getTicketArticles(ticket_id)
    if (!article) return false
    const article_body = (article ? article?.body : '').replace(/<[^>]*>/g, '')
    if (article_body.includes('Отримана відповідь від Замовника')) return false
    const message_in = article_body ? `: ${article_body}` : 'Додатковий запит відсутній'
    const article_id = article?.id
    const attachmentIds = await getAttachmentIds(article_id)
    const urls_in = [`(*) Запит надіслано від: ${article?.from}`]
    attachmentIds.forEach(async (attachId) => {
      urls_in.push(attachId)
    })
    const data_body = {
      login: user_data.login,
      ticket_id,
      article_id,
      state_id: 111,
      message_in,
      sender_id: ticket.customer_id,
      urls_in
    }
    await module.exports.newRecord(data_body)
    return true
  } catch (error) {
    console.error('Error executing commands:', error.message)
    return false
  }
}


async function getAttachmentIds(article_id) {
  const headers = { Authorization: process.env.ZAMMAD_API_TOKEN, "Content-Type": "application/json" }
  const httpsAgent = new https.Agent({ rejectUnauthorized: false })
  const url = `${process.env.ZAMMAD_API_URL}/ticket_articles/${article_id}`
  try {
    const response = await axios.get(url, { headers, httpsAgent })
    const article = response.data
    if (!article?.attachments) return []
    const articleIds = article.attachments.map(attachment => ({ id: attachment.id, fileName: attachment.filename }))
    return articleIds
  } catch (err) {
    console.log(err)
    return []
  }
}

async function getAndSendAttachmentUrlById(data, attachmentId) {
  const headers = { Authorization: process.env.ZAMMAD_API_TOKEN }
  const httpsAgent = new https.Agent({ rejectUnauthorized: false })
  const url = `${process.env.ZAMMAD_API_URL}/ticket_attachment/${data.ticket_id}/${data.article_id}/${attachmentId.id}`
  try {
    const response = await axios.get(url, { headers, httpsAgent, responseType: 'stream' })
    if (!response.data) return

    const TEMP_CATALOG = process.env.TEMP_CATALOG
    if (!fs.existsSync(TEMP_CATALOG)) fs.mkdirSync(TEMP_CATALOG, { recursive: true })
    const fileFullName = `${TEMP_CATALOG}${attachmentId.fileName}`

    const stream = fs.createWriteStream(fileFullName)
    response.data.pipe(stream)
    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    })
    console.log(`File ${fileFullName} saved`)
    await bot.sendDocument(data.chatId, fileFullName, { filename: attachmentId.fileName, caption: attachmentId.fileName })
    fs.unlinkSync(fileFullName)
    return true
  } catch (err) {
    console.log(err)
  }
}

async function oldVersionOfnewRequest(ticket_id) {
  try {
    const query = `INSERT INTO ticket_updates(state_id, ticket_id) VALUES($1, $2)`
    const values = [100, ticket_id]
    await execPgQuery(query, values, true)
    const user_data = await findUserById(ticket.owner_id)
    await callRequestDataMenu(user_data.login, ticket_id)
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

async function callFeedBackMenu(data) {
  try {
    const { chatId, ticket_id, message_in, urls_in } = data
    const ticket_data = await getTicketData(ticket_id)
    const { title } = ticket_data
    await bot.sendMessage(chatId, `⚠️ Увага! Аби ми мали можливість оперативно допомогти із заявкою № ${ticket_id} на тему ${title}, необхідно надати <b>${message_in}</b> ⚠️`, { parse_mode: 'HTML' })
    for (const url_in of urls_in) {
      if (typeof url_in === 'string') {
        await bot.sendMessage(chatId, url_in)
      } else if (typeof url_in === 'object') {
        await getAndSendAttachmentUrlById(data, url_in)
      }
    }
    const add = ticket_id ? ` №_${ticket_id}` : ''
    const buttons = buttonsConfig["callTicketUpdate"].buttons
    for (const button of buttons) {
      if (button[0].callback_data === '3_3') break
      button[0].text = `☎︎ ${add}. Відповісти на додатковий запит`
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


async function callRequestDataMenu(login, ticket_id) {
  try {
    const chatId = Number(login)
    if (!(chatId > 0)) return
    await bot.sendMessage(chatId, `⚠️⚠️⚠️ Увага! Сформуйте запит за заявкою № ${ticket_id} ⚠️⚠️⚠️`)
    const add = ticket_id ? ` №_${ticket_id}` : ''
    const buttons = buttonsConfig["callTicketUpdate"].buttons
    for (const button of buttons) {
      if (button[0].callback_data === '3_3') break
      button[0].text = `🖐 ${add}. Сформувати запит користувачу за заявкою № ${ticket_id}`
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
      await callFeedBackMenu(data)
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
    const ticketData = await getTicketData(ticketID)
    const { title, owner_id } = ticketData
    const user = await findUserById(owner_id)
    if (user) {
      const chatId = Number(user.login)
      if (chatId > 0) {
        await bot.sendMessage(chatId, `⚠️ Увага! Вам надійшла відповідь користувача за заявкою № ${ticketID} на тему ${title} Відповідь: <b>${message_out}</b> ⚠️`, { parse_mode: 'HTML' })
        await getAndSendAttachmentToPerformer(chatId, ticketID, urls_out)
      }
      return true
    }
  } catch (error) {
    console.error('Error executing commands:', error.message)
    return false
  }
}


async function getAndSendAttachmentToPerformer(chatId, ticketId, urls_out) {
  try {
    const slash = process.env.SLASH
    for (const url_out of urls_out) {
      const Catalog = `${process.env.DOWNLOAD_APP_PATH}${ticketId}`
      const filePath = `${Catalog}${slash}${url_out}`
      const filePathWithSingleSlash = filePath.replace(/\/\//g, '/')
      console.log('getAndSendAttachmentToPerformer', filePathWithSingleSlash)
      if (fs.existsSync(filePathWithSingleSlash)) {
        await bot.sendDocument(chatId, filePathWithSingleSlash, { caption: url_out })
      }
    }
    return true
  } catch (err) {
    console.log(err)
  }
}