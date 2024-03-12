
const { buttonsConfig, standardStartButtons } = require('../modules/keyboard')
const { inputLineScene } = require('../controllers/inputLine')
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { getTickets } = require('../db/ticketsDbService')
const { findUserById } = require('../db/tgUsersService')
const https = require('https')
const { fDateTime } = require('../services/various')
const { userReplyRecord, sendReplyToCustomer } = require('../services/interConnect.service')
const { getTicketData } = require('../modules/common')
const { execPgQuery } = require('../db/common')
const interConnectService = require('../services/interConnect.service')
const { registeredUserMenu } = require('../modules/common')
const { update_ticket } = require('../modules/update_ticket')

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
    const pictureFileName = path.basename(pictureFilePath)
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
    await bot.sendMessage(msg.chat.id, 'Будь ласка, відправте файл или натисніть /cancel, щоб скасувати:')

    const attachmentMsg = await new Promise((resolve, reject) => {
      bot.once('message', (message) => {
        if (message.document) {
          resolve(message)
        } else if (message.text.toLowerCase() !== '/cancel') {
          reject(new Error('Invalid input'))
        }
      })

      bot.once('text', (cancelMessage) => {
        if (cancelMessage.text.toLowerCase() === '/cancel') {
          reject(new Error('Action canceled'))
        }
      })
    })

    const selectedByUser_ = await addTicketAttachment(bot, attachmentMsg, selectedByUser)
    return selectedByUser_
  } catch (err) {
    console.log(err)
    return selectedByUser
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
    console.log(`ticketUpdates selectedByUser.updatedTicketId`, selectedByUser?.updatedTicketId)
    console.log(`ticketUpdates selectedByUser.ticketBody`, selectedByUser?.ticketBody)

    if (!selectedByUser?.updatedTicketId) {
      await bot.sendMessage(msg.chat.id, 'Немає обраної заявки для оновлення\n', { parse_mode: 'HTML' })
      return
    }
    if (!selectedByUser?.ticketBody) {
      await bot.sendMessage(msg.chat.id, 'Ви не внесли дані, аби ми мали можливість оновити заявку.\n', { parse_mode: 'HTML' })
      return
    }
    const ticketID = selectedByUser.updatedTicketId
    const ticketData = await getTicketData(ticketID)
    const { customer_id, owner_id } = ticketData
    const timestamp = fDateTime('uk-UA', new Date())
    let comment = ''
    const user_data = await findUserById(owner_id)
    const owner_login = user_data.login
    const customer_data = await findUserById(customer_id)
    const login = customer_data.login

    if (Number(owner_login) === msg.chat.id && !selectedByUser?.customer_login) {
      comment = `Надіслан запит Замовнику ${timestamp}: ${selectedByUser.ticketBody}`
    } else {
      comment = `Отримана відповідь від Замовника ${timestamp}: ${selectedByUser.ticketBody}`
    }

    const updatedTicket = await update_ticket(ticketID, comment, selectedByUser?.ticketAttacmentFileNames || [], false)
    selectedByUser.updatedTicketId = null

    if (updatedTicket === null) {
      await bot.sendMessage(msg.chat.id, `Під час додавання вкладень до заявки №_${ticketID} виникла помилка. Операцію скасовано.\n`, { parse_mode: 'HTML' })
      registeredUserMenu(bot, msg, false)
    }

    await bot.sendMessage(msg.chat.id, `Дякую, зміни до заявки ${ticketID} внесено.`)
    registeredUserMenu(bot, msg, false)

    if (Number(owner_login) === msg.chat.id && !selectedByUser?.customer_login) {
      const msg_in = selectedByUser.ticketBody
      const urls_in = selectedByUser?.ticketAttacmentFileNames || []
      const body = {
        "login": login, "ticket_id": ticketID, "state_id": 111, "message_in": msg_in, "sender_id": owner_id, "urls_in": urls_in
      }
      await interConnectService.newRecord(body)
    } else {
      const ticket_update_data = await execPgQuery(`SELECT * FROM ticket_updates WHERE state_id=111 AND ticket_id=$1 ORDER BY updated_at DESC LIMIT 1`, [ticketID], true)
      if (!ticket_update_data?.id) {
        console.log(`Update ticket: ${ticketID} error: no data sting 202 interConnectService`)
        return null
      }
      ticket_update_data.state_id = 222
      ticket_update_data.message_out = selectedByUser.ticketBody
      ticket_update_data.urls_out = selectedByUser?.ticketAttacmentFileNames || []
      await userReplyRecord(ticket_update_data)
      await sendReplyToCustomer(customer_id, ticketID, ticket_update_data)
    }
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
          { text: `${statusIcon} №${ticket.id}: ${ticket.title} | Код запиту:${ticket?.article_id} | ${ticket.number} від ${fDateTime('uk-UA', ticket.created_at, true, true)}`, callback_data: `43_${ticket.id}` }
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
      await bot.sendMessage(chatId, 'На цей час немає заявок з обраним статусом.')
    }

  } catch (err) {
    console.log(err)
  }
}

module.exports = { ticketCreateScene, ticketUpdateScene, ticketsTextInput, askForAttachment, ticketRegistration, ticketUpdates, checkUserTickets, askForPicture }