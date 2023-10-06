
const { buttonsConfig } = require('../modules/keyboard')
const inputLineScene = require('./inputLine')
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { findUserById, getTickets } = require('../db/tgUsersService')
const { get } = require('https')


//#region staticKeyboad
async function ticketCreateScene(bot, msg) {
  try {
    const chatId = msg.chat.id
    await bot.sendMessage(chatId, buttonsConfig["ticketCreate"].title, {
      reply_markup: {
        keyboard: buttonsConfig["ticketCreate"].buttons,
        resize_keyboard: true
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
    const filePath = path.join(process.env.TEMP_CATALOG, fileName)
    const file = fs.createWriteStream(filePath)
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
    if (!selectedByUser?.ticketTitle || !selectedByUser?.ticketBody) {
      await bot.sendMessage(msg.chat.id, 'Не заповнені всі поля. Операцію скасовано\n', { parse_mode: 'HTML' })
      return
    }
    let attachmnts = ''
    const user = await findUserById(msg.chat.id)
    const subject = selectedByUser.ticketTitle
    if (Array.isArray(selectedByUser?.ticketAttacmentFileNames)) {
      attachmnts = 'Attachments: ' + selectedByUser.ticketAttacmentFileNames.join('\n')
    }
    const body = selectedByUser.ticketBody + '\n\n' + attachmnts
    const ticket = await create_ticket(user, subject, body)
    await bot.sendMessage(msg.chat.id, `Дякую, Ваша заявка зареєстрована. Номер заявки: ${ticket.number}`)
  } catch (err) {
    console.log(err)
  }
}

async function create_ticket(user, subject, body) {
  const headers = {
    Authorization: `Bearer ${process.env.ZAMMAD_API_TOKEN}`, 'Content-Type': 'application/json'
  }
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
  const url = `${process.env.ZAMMAD_API_URL}/tickets`
  const response = await axios.post(url, data, { headers })

  const ticket = response.data
  console.log(`Crete ticket number: ${ticket}`)
  return ticket
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
        state_id = 4
        break
      case '2_4':
        statusIcon = '🟩'
        state_id = 6
        break
      default:
        break
    }

    const data = await getTickets(chatId, state_id, customer_id)
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
          { text: `${statusIcon} №${ticket.number}: ${ticket.title} `, callback_data: `43_${ticket.id}` }
        ])
      }
      ticketsButtons.buttons.push([{ text: '↖️', callback_data: '0_1' }])
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

module.exports = { ticketCreateScene, ticketsTextInput, askForAttachment, ticketRegistration, checkUserTickets }