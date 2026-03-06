
const { buttonsConfig, standardStartButtons } = require('../modules/keyboard')
const { inputLineScene } = require('../controllers/inputLine')
const axios = require('axios')
const { getTickets } = require('../db/ticketsDbService')
const { findUserById, findUserByEmail } = require('../db/tgUsersService')
const https = require('https')
const { fDateTime } = require('../services/various')
const { userReplyRecord, sendReplyToCustomer } = require('../services/interConnect.service')
const { getTicketData } = require('../modules/common')
const { execPgQuery } = require('../db/common')
const interConnectService = require('../services/interConnect.service')
const { registeredUserMenu } = require('../modules/common')
const { update_ticket } = require('../modules/update_ticket')
const { globalBuffer } = require('../globalBuffer')
const { goToApiControllerForCheck } = require('./apiController')

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

async function ticketSubjectEditor(bot, msg, data, selectedByUser) {
  try {
        const chatId = msg.chat.id
        let selected_ = null
        const subj = selectedByUser?.ticketTitle || '> Введіть змістовну тему заявки'
			  const msg_text = `📌 Тема звернення:\n<b>${subj}</b> 💬 \n Введіть нову тему нижче:`
				await bot.sendMessage(msg.chat.id, msg_text, { parse_mode: "HTML" })
			  selected_ = await ticketsTextInput(bot, msg, '5_1', selectedByUser[chatId])
			  return selected_?.ticketTitle || null
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
    if (menuItem === '5_2') {
        bot.sendMessage(
          msg.chat.id,
          "🔖 Опишіть Вашу проблему текстом, або затисніть 🎙️(мікрофон) і надиктуйте голосом.",
          {
            parse_mode: "HTML",
            reply_markup: {
              keyboard: [[{ text: "↩️" }]],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          },
        )
    }
    let inputLenghth = 7
    if (msg?.text.includes('оментар')) inputLenghth = 2
    const txtCommand = await inputLineScene(bot, msg)

    if (!txtCommand || txtCommand.length < inputLenghth) {
      await bot.sendMessage(
				msg.chat.id,
				"📍Незрозуміле введення. Операцію скасовано\n",
				{ parse_mode: "HTML" },
			)
      selectedByUser = { ...selectedByUser, ticketBody: null }
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

async function ticketRegistration(bot, msg, selectedByUser,isFromSwitcher = false) {
  try {
    if (!selectedByUser?.ticketTitle || selectedByUser?.ticketTitle.includes('🟣 Ввести змістовну тему')) {
      await bot.sendMessage(msg.chat.id, 'Не заповнена тема заявки. Операцію скасовано\n', { parse_mode: 'HTML' })
      return
    }
    if (!selectedByUser?.ticketBody || 			selectedByUser?.ticketBody.includes("🔵 Ввести зміст (такий") ||
			selectedByUser?.ticketBody.includes("📌 Зареєструвати заявку")) {
			await bot.sendMessage(
				msg.chat.id,
				"Не заповнен зміст заявки. Операцію скасовано\n",
				{ parse_mode: "HTML" },
			)
			return
		}

    let user = null
    let owner = null
    if (isFromSwitcher) {
      const isOK = await goToApiControllerForCheck(bot, msg, selectedByUser)
      if (!isOK) {
        await bot.sendMessage(msg.chat.id, 'Заявку скасовано. Дубль реєстрації проблеми [\n', { parse_mode: 'HTML' })
        return
      }
    }  

    if (selectedByUser?.ticketBody.includes('@lotok.in.ua') || selectedByUser?.ticketBody.includes('@ito.in.ua')) {
      const emailMatch = selectedByUser.ticketBody.match(/\b[A-Za-z0-9._%+-]+@lotok\.in\.ua\b/)
        || selectedByUser.ticketBody.match(/\b[A-Za-z0-9._%+-]+@ito\.in\.ua\b/)
      if (emailMatch) {
        const email = emailMatch[0]
        try {
          user = await findUserByEmail(email)
          owner = await findUserById(msg.chat.id)
          if (!user) {
            console.log(`Email ${email} not found, using current user`)
            user = await findUserById(msg.chat.id)
          }
        } catch (err) {
          console.error('Email не знайдено в базі', email)
          user = await findUserById(msg.chat.id)
        }
      } else {
        console.error('Email не знайдено в змісті')
        user = await findUserById(msg.chat.id)
      }
    } else {
      user = await findUserById(msg.chat.id)
    }

    const subject = selectedByUser.ticketTitle
    const body = selectedByUser.ticketBody
    const ticket = await create_ticket(user, subject, body, owner)
    if (ticket === null) {
      await bot.sendMessage(msg.chat.id, 'Під час реєстрації заявки виникла помилка. Операцію скасовано\n', { parse_mode: 'HTML' })
      return null
    }
    if (Array.isArray(selectedByUser?.ticketAttachmentFileNames)) {
      const updatedTicket = await update_ticket(ticket.id, body, selectedByUser.ticketAttachmentFileNames, false, msg.chat.id)
      if (updatedTicket === null) {
        await bot.sendMessage(msg.chat.id, 'Під час додавання вкладень виникла помилка. Операцію скасовано\n', { parse_mode: 'HTML' })
        return null
      } else {
        console.log(`Ticket ${ticket.id} updated with attachments`)
        selectedByUser.ticketAttachmentFileNames = []
      }
    }

    await bot.sendMessage(msg.chat.id, `Дякую, Ваша заявка на тему ${subject} зареєстрована. Номер заявки в системі: ${ticket.id}. Номер для користувача: ${ticket.number}`)
    globalBuffer[msg.chat.id].ticketCreated = true
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
    if (!selectedByUser?.ticketBody || selectedByUser?.ticketBody.includes('🟣 Ввести змістовну тему')
      || selectedByUser?.ticketBody.includes('🔵 Ввести коментар')
      || selectedByUser?.ticketBody.includes('📌 Оновити заявку')) {
      await bot.sendMessage(msg.chat.id, 'Аби ми мали можливість оновити заявку, внесіть супроводжуючий коментар через відповідну кнопку меню.\n', { parse_mode: 'HTML' })
      return
    }
    const ticketID = selectedByUser.updatedTicketId
    const ticketData = await getTicketData(ticketID)
    const { customer_id, owner_id } = ticketData
    const ticketNumber = ticketData.number
    const timestamp = fDateTime('uk-UA', new Date())
    let comment = ''

    const user_data = await findUserById(owner_id)
    const owner_login = user_data && user_data.login ? user_data.login : msg.chat.id
    if (!user_data) console.log(`findUserById: owner_id ${owner_id} not found, using msg.chat.id`)

    const customer_data = await findUserById(customer_id);
    const login = customer_data && customer_data.login ? customer_data.login : msg.chat.id;
    if (!customer_data) console.log(`findUserById: customer_id ${customer_id} not found, using msg.chat.id`)

    if (Number(owner_login) === msg.chat.id && !selectedByUser?.customer_login) {
      comment = `Надіслан запит Замовнику ${timestamp}: ${selectedByUser.ticketBody}`
    } else {
      comment = `Отримана відповідь від Замовника ${timestamp}: ${selectedByUser.ticketBody}`
    }

    const updatedTicket = await update_ticket(ticketID, comment, selectedByUser?.ticketAttachmentFileNames || [], false, msg.chat.id)
    selectedByUser.updatedTicketId = null
    globalBuffer[msg.chat.id].TicketUpdated = true

    if (updatedTicket === null) {
      await bot.sendMessage(msg.chat.id, `Під час додавання вкладень до заявки №_${ticketID} виникла помилка. Операцію скасовано.\n`, { parse_mode: 'HTML' })
      registeredUserMenu(bot, msg, false)
      return
    } else {
      console.log(`Ticket ${ticketID} updated with attachments`)
    }

    await bot.sendMessage(msg.chat.id, `Дякую, зміни до заявки ${ticketID} внесено.`)
    registeredUserMenu(bot, msg, false)

    if (Number(owner_login) === msg.chat.id && !selectedByUser?.customer_login) {
      const msg_in = selectedByUser.ticketBody
      const urls_in = selectedByUser?.ticketAttachmentFileNames || []
      const body = {
        "login": login, "ticket_id": ticketID, "state_id": 111, "message_in": msg_in, "sender_id": owner_id, "urls_in": urls_in
      }
      await interConnectService.newRecord(body)
    } else {
      const ticket_update_data = await execPgQuery(`SELECT * FROM ticket_updates WHERE state_id=111 AND ticket_id=$1 ORDER BY updated_at DESC LIMIT 1`, [ticketID], true)
      if (!ticket_update_data?.id) {
        console.log(`Update ticket: ${ticketID} error: no data sting 202 interConnectService`)
        return
      }
      ticket_update_data.state_id = 222
      ticket_update_data.message_out = selectedByUser.ticketBody
      ticket_update_data.urls_out = selectedByUser?.ticketAttachmentFileNames || []
      await userReplyRecord(ticket_update_data)
      await sendReplyToCustomer(customer_data, ticketID, ticketNumber, ticket_update_data)
    }

    selectedByUser.ticketAttachmentFileNames = []

  } catch (err) {
    console.log(err)
  }
}


async function create_ticket(user, subject, body, owner = null) {
  const headers = { Authorization: process.env.ZAMMAD_API_TOKEN, "Content-Type": "application/json" }

  if (!user || !user.id) {
    console.error('create_ticket: user is null or missing id')
    return null
  }

  let customer_id = user['id']
  let owner_id = owner?.id || null

  console.log(`create_ticket customer_id: ${customer_id} owner_id: ${owner_id}`)
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

  if (owner_id !== null) {
    try {
      const checked_owner = await findUserById(owner_id)
      if (checked_owner !== null) data.owner_id = owner_id
    } catch (error) {
      console.error(`Error finding user by ID ${owner_id}:`, error)
    }
  }

  console.log('Data to be sent:', JSON.stringify(data, null, 2))

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
          buttons: parsedData.map(ticket => {
            let codeText = ticket?.article_id !== undefined && ticket?.article_id !== null ? ` | Код запиту:${ticket.article_id}` : '';
            return [
              { text: `${statusIcon} №${ticket.id}: ${ticket.title}${codeText} | ${ticket.number} від ${fDateTime('uk-UA', ticket.created_at, true, true)}`, callback_data: `43_${ticket.id}` }
            ];
          })
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

module.exports = { ticketCreateScene, ticketUpdateScene, ticketSubjectEditor, ticketsTextInput, ticketRegistration, ticketUpdates, checkUserTickets }