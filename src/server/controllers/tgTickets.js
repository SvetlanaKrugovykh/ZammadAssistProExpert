
const { buttonsConfig } = require('../modules/keyboard')
const { inputLineScene } = require('../controllers/inputLine')
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { getTickets } = require('../db/ticketsDbService')
const { findUserById } = require('../db/tgUsersService')
const https = require('https')
const { fDateTime } = require('../services/various')
const { userReplyRecord } = require('../services/interConnect.service')
const { getTicketData } = require('../modules/common')
const { execPgQuery } = require('../db/common')

//#region staticKeyboad
async function ticketCreateScene(bot, msg) {
  try {
    const chatId = msg.chat.id
    await bot.sendMessage(chatId, buttonsConfig["ticketCreate"].title, {
      reply_markup: {
        keyboard: buttonsConfig["ticketCreate"].buttons,
        resize_keyboard: true,
        one_time_keyboard: false
      }
    })
  } catch (err) {
    console.log(err)
  }
}

async function ticketUpdateScene(bot, msg, ticketID = '') {
  try {
    const chatId = msg.chat.id
    const add = ' щодо заявки №_' + ticketID.toString()
    await bot.sendMessage(chatId, buttonsConfig["ticketUpate"].title + add, {
      reply_markup: {
        keyboard: buttonsConfig["ticketUpate"].buttons,
        resize_keyboard: true,
        one_time_keyboard: false
      }
    })
  } catch (err) {
    console.log(err)
  }
}
//#endregion

async function ticketsTextInput(bot, msg, menuItem, selectedByUser) {
  try {
    const txtCommand = await inputLineScene(bot, msg)
    if (txtCommand.length < 7) {
      await bot.sendMessage(msg.chat.id, 'Незрозуміле введення. Операцію скасовано\n', { parse_mode: 'HTML' })
      return selectedByUser
    }
    if (menuItem === '5_1') {
      selectedByUser = { ...selectedByUser, ticketTitle: txtCommand }
    } else if (menuItem === '5_2') {
      selectedByUser = { ...selectedByUser, ticketBody: txtCommand }
    }
    return selectedByUser
  } catch (err) {
    console.log(err)
    return selectedByUser
  }
}

async function askForPicture(bot, msg, selectedByUser) {
  try {
    await bot.sendMessage(msg.chat.id, 'Будь ласка, вставте картинку:')
    const pictureMsg = await new Promise((resolve, reject) => {
      bot.once('photo', resolve)
      bot.once('text', () => reject(new Error('Invalid input')))
    })
    const pictureFileId = pictureMsg.photo[pictureMsg.photo.length - 1].file_id
    const pictureFilePath = await bot.downloadFile(pictureFileId, process.env.DOWNLOAD_APP_PATH)
    const pictureFileName = path.basename(pictureFilePath) + '.jpg'
    const pictureFullPath = path.join(process.env.DOWNLOAD_APP_PATH, pictureFileName)
    fs.renameSync(pictureFilePath, pictureFullPath)
    const fileNames = selectedByUser.ticketAttacmentFileNames || []
    const selectedByUser_ = { ...selectedByUser, ticketAttacmentFileNames: [...fileNames, pictureFileName] }
    return selectedByUser_
  } catch (err) {
    console.log(err)
    return {}
  }
}

async function askForAttachment(bot, msg, selectedByUser) {
  try {
    await bot.sendMessage(msg.chat.id, 'Будь ласка, відправте файл:')
    const attachmentMsg = await new Promise((resolve, reject) => {
      bot.once('document', resolve)
      bot.once('text', () => reject(new Error('Invalid input')))
    })
    const selectedByUser_ = await addTicketAttachment(bot, attachmentMsg, selectedByUser)
    return selectedByUser_
  } catch (err) {
    console.log(err)
    return {}
  }
}

async function addTicketAttachment(bot, msg, selectedByUser) {
  try {
    const fileId = msg.document.file_id
    const fileExtension = path.extname(msg.document.file_name)
    const fileName = `attachment_${msg.chat.id.toString()}_${Date.now()}${fileExtension}`
    const filePath = path.join(process.env.DOWNLOAD_APP_PATH, fileName)
    const filePathWithSingleSlash = filePath.replace(/\/\//g, '/')
    const file = fs.createWriteStream(filePathWithSingleSlash)
    const fileStream = await bot.getFileStream(fileId)
    fileStream.pipe(file)
    await new Promise((resolve, reject) => {
      file.on('finish', resolve)
      file.on('error', reject)
    })
    const fileNames = selectedByUser.ticketAttacmentFileNames || []
    const newSelectedByUser = { ...selectedByUser, ticketAttacmentFileNames: [...fileNames, fileName] }
    return newSelectedByUser
  } catch (err) {
    console.log(err)
    return selectedByUser
  }
}

async function ticketRegistration(bot, msg, selectedByUser) {
  try {
    if (!selectedByUser?.ticketTitle) {
      await bot.sendMessage(msg.chat.id, 'Не заповнена тема заявки. Операцію скасовано\n', { parse_mode: 'HTML' })
      return
    }
    if (!selectedByUser?.ticketBody) {
      await bot.sendMessage(msg.chat.id, 'Не заповнен зміст заявки. Операцію скасовано\n', { parse_mode: 'HTML' })
      return
    }
    const user = await findUserById(msg.chat.id)
    const subject = selectedByUser.ticketTitle
    const body = selectedByUser.ticketBody
    const ticket = await create_ticket(user, subject, body)
    if (ticket === null) {
      await bot.sendMessage(msg.chat.id, 'Під час реєстрації заявки виникла помилка. Операцію скасовано\n', { parse_mode: 'HTML' })
      return null
    }
    if (Array.isArray(selectedByUser?.ticketAttacmentFileNames)) {
      const updatedTicket = await update_ticket(ticket.id, body, selectedByUser.ticketAttacmentFileNames)
      if (updatedTicket === null) {
        await bot.sendMessage(msg.chat.id, 'Під час додавання вкладень виникла помилка. Операцію скасовано\n', { parse_mode: 'HTML' })
        return null
      }
    }

    await bot.sendMessage(msg.chat.id, `Дякую, Ваша заявка на тему ${subject} зареєстрована. Номер заявки в системі: ${ticket.id}. Номер для користувача: ${ticket.number}`)
  } catch (err) {
    console.log(err)
  }
}

async function ticketUpdates(bot, msg, selectedByUser) {
  try {
    if (!selectedByUser?.updatedTicketId) {
      await bot.sendMessage(msg.chat.id, 'Немає обраної заявки для оновлення\n', { parse_mode: 'HTML' })
      return
    }
    if (!selectedByUser?.ticketBody) {
      await bot.sendMessage(msg.chat.id, 'Не заповнен коментар. Операцію скасовано\n', { parse_mode: 'HTML' })
      return
    }
    const ticketID = selectedByUser.updatedTicketId
    const ticketData = await getTicketData(ticketID)
    const timestamp = fDateTime('uk-UA', new Date(), true, true)
    const comment = `Отримана відповідь від Замовника ${timestamp}: ${selectedByUser.ticketBody}`
    const { title, group_id, priority_id, state_id, pending_time, customer_id, article } = ticketData
    const newTicketBody = { title, group_id, priority_id, state_id, pending_time, customer_id, article }
    newTicketBody.article = { 'subject': comment }

    const updatedTicket = await update_ticket(ticketID, JSON.stringify(newTicketBody), selectedByUser?.ticketAttacmentFileNames || [], false)
    if (updatedTicket === null) {
      await bot.sendMessage(msg.chat.id, 'Під час додавання вкладень виникла помилка. Операцію скасовано\n', { parse_mode: 'HTML' })
      return null
    }
    await bot.sendMessage(msg.chat.id, `Дякую, зміни до Вашої заявки ${ticketID} внесено.`)

    const ticket_update_data = await execPgQuery(`SELECT * FROM ticket_updates WHERE state_id=111 AND ticket_id=$1 ORDER BY updated_at DESC LIMIT 1`, [ticketID], true)
    ticket_update_data.sender_id = customer_id
    ticket_update_data.state_id = 222
    ticket_update_data.message_out = selectedByUser.ticketBody
    ticket_update_data.urls_out = selectedByUser?.ticketAttacmentFileNames || []
    userReplyRecord(ticket_update_data)

  } catch (err) {
    console.log(err)
  }
}


async function create_ticket(user, subject, body) {
  const headers = { Authorization: process.env.ZAMMAD_API_TOKEN, "Content-Type": "application/json" }
  let customer_id = user['id']
  if (process.env.ZAMMAD_USER_TEST_MODE === 'true') customer_id = Number(process.env.ZAMMAD_USER_TEST_ID)
  const data = {
    'title': subject,
    'group_id': 1,
    'customer_id': customer_id,
    'article': {
      'subject': subject,
      'body': body,
      'type': 'note',
      'internal': false
    }
  }
  const httpsAgent = new https.Agent({ rejectUnauthorized: false })
  const url = `${process.env.ZAMMAD_API_URL}/tickets`
  try {
    const response = await axios.post(url, data, { headers, httpsAgent })
    const ticket = response.data
    console.log(`Crete ticket: ${ticket.id}`)
    return ticket
  } catch (err) {
    console.log(err)
    return null
  }
}

async function update_ticket(ticketId, body, fileNames, override = false) {

  const headers = { Authorization: process.env.ZAMMAD_API_TOKEN, "Content-Type": "application/json" }
  let bodyWithAttachments = body
  const slash = process.env.SLASH

  for (const element of fileNames) {
    const file_name = element.replace(process.env.DOWNLOAD_APP_PATH, '')
    const old_file_name = `${process.env.DOWNLOAD_APP_PATH}${slash}${file_name}`
    const newCatalog = `${process.env.DOWNLOAD_APP_PATH}${ticketId}`
    const newFilePath = `${newCatalog}${slash}${file_name}`

    try {
      await fs.promises.mkdir(newCatalog, { recursive: true })
      await fs.promises.rename(old_file_name, newFilePath)
      console.log(`File ${element} moved to ${newFilePath}`)
    } catch (err) {
      console.log(err)
      continue
    }
    const fileUrl = `${process.env.DOWNLOAD_URL}${ticketId}/${file_name}`
    bodyWithAttachments += `\n${fileUrl}`
  }

  let data = {
    'article': {
      'body': bodyWithAttachments || body,
    }
  }
  if (override) data = body
  let updated_at = ''

  const httpsAgent = new https.Agent({ rejectUnauthorized: false })
  const url = `${process.env.ZAMMAD_API_URL}/tickets/${ticketId}`
  try {
    const response = await axios.put(url, data, { headers, httpsAgent })
    const ticket = response.data
    updated_at = ticket.updated_at
    console.log(`update ticket: ${ticketId} updated_at: ${updated_at}`)
    return ticket
  } catch (err) {
    console.log(`ERROR of update ticket: ${ticketId} updated_at: ${updated_at}`)
    console.log(`url: ${url}, data: ${JSON.stringify(data)}, headers: ${JSON.stringify(headers)}`)
    return null
  }
}


async function checkUserTickets(bot, msg, menuItem) {
  try {
    const chatId = msg.chat.id
    const user = await findUserById(msg.chat.id)
    if (user === null) return null
    let customer_id = user['id']
    if (process.env.ZAMMAD_USER_TEST_MODE === 'true') customer_id = Number(process.env.ZAMMAD_USER_TEST_ID)

    let statusIcon = ''
    let state_id = 0
    switch (menuItem) {
      case '2_2':
        statusIcon = '🟨'
        state_id = 2
        break
      case '2_3':
        statusIcon = '🟦'
        state_id = 7
        break
      case '2_4':
        statusIcon = '🟩'
        state_id = 4
        break
      case '2_11':
        statusIcon = '📕'
        state_id = 333
        break
      default:
        break
    }

    const data = await getTickets(state_id, customer_id, chatId)
    let parsedData
    if (Array.isArray(data) && typeof data[0] === 'object') {
      parsedData = data
    } else {
      parsedData = [data]
    }
    if (parsedData.length !== 0 && parsedData[0] !== null) {
      const ticketsButtons = {
        title: 'Оберіть будь ласка заявку',
        options: [{ resize_keyboard: true }],
        buttons: parsedData.map(ticket => [
          { text: `${statusIcon} №${ticket.id}: ${ticket.title} | ${ticket.number} від ${fDateTime('uk-UA', ticket.created_at, true, true)}`, callback_data: `43_${ticket.id}` }
        ])
      }
      ticketsButtons.buttons.push([{ text: '↩️', callback_data: '0_1' }])
      await bot.sendMessage(chatId, ticketsButtons.title, {
        reply_markup: {
          keyboard: ticketsButtons.buttons,
          resize_keyboard: true
        }
      })
    } else {
      await bot.sendMessage(chatId, 'На даний момент немає заявок з обраним статусом.')
    }

  } catch (err) {
    console.log(err)
  }
}

module.exports = { ticketCreateScene, ticketUpdateScene, ticketsTextInput, askForAttachment, ticketRegistration, ticketUpdates, checkUserTickets, update_ticket, askForPicture }