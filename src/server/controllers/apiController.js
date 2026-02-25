const { checkUserByTelegramId } = require('../services/users-api')
const { createTicket } = require('../services/tickets-api')
const { checkStoreInternetStatus, getStoreNumberByCustomerID } = require('../db/monitoring-notifications')
const { execPgQuery } = require('../db/common')
const { bot } = require('../globalBuffer')
/**
 * Check if ticket is related to internet issues
 * @param {Object} ticketData - Ticket data with title and body
 * @returns {boolean} - true if ticket is about internet issues
 */
function isInternetRelatedTicket(ticketData) {
  const { title, body } = ticketData
  const text = `${title || ''} ${body || ''}`.toLowerCase()

  const internetKeywords = [
    'internet', 'intenet', 'intrenet', 'interent',
    'интернет', 'интернет', 'інтернет',
    'інтернет', 'інтернэт',
  ]

  return internetKeywords.some(keyword => text.includes(keyword))
}

async function goToApiControllerForCheck(bot, msg, selectedByUser) {
  const ticketData = {
      title: selectedByUser.ticketTitle,
      body: selectedByUser.ticketBody,
    }
    const chatId = msg.chat.id
  const isAlreadyRegistered = await checkAlreadyRegistered(ticketData, chatId)
    return !isAlreadyRegistered
  }


  async function checkAlreadyRegistered(ticketData, customer_id) {
  try {
    if (!isInternetRelatedTicket(ticketData)) {
      return false
    }

    const storeNumber = await getStoreNumberByCustomerID(customer_id)
    if (!storeNumber) {
      return false
    }

    const lookbackDeltaSeconds = 18 * 3600 // 18 hours

    const internetStatus = await checkStoreInternetStatus(storeNumber, lookbackDeltaSeconds)

    if (internetStatus && internetStatus.status === 'down') {
      return true
    }

    return false
  } catch (error) {
    console.error('Error in checkAlreadyRegistered:', error)
    return false
  }
}

async function checkInsufficientInfo(ticketData) {
  const { title, body, customer_id } = ticketData
  if (!title || title.trim().length < 5) {
    return true
  }
  if (!body || body.trim().length < 10) {
    return true
  }
  return false
}

async function checkUser(request, reply) {
  try {
    const { telegram_id } = request.body

    if (!telegram_id) {
      return reply.code(400).send({
        success: false,
        message: 'telegram_id is required'
      })
    }

    const result = await checkUserByTelegramId(telegram_id)

    return reply.send({
      success: true,
      exists: result.exists,
      user: result.user
    })

  } catch (error) {
    console.error('Error in checkUser controller:', error)
    return reply.code(500).send({
      success: false,
      message: 'Internal server error'
    })
  }
}

async function createUser(request, reply) {
	try {
		const result = await findUserByOneOfFirstNameOrLastNameOrPhone(request.body)
		const { firstname, lastname, phone, zip, organization_id } = request.body

    let phoneDigits = phone ? phone.replace(/\D/g, '') : null;
    if (phoneDigits && phoneDigits.length > 10) {
      phoneDigits = phoneDigits.slice(-10);
    }

    if (result?.user) {
      await execPgQuery(
        "UPDATE users SET firstname=$2, lastname=$3, phone=$4, zip=$5, organization_id=$6 WHERE id=$1",
        [result.user.id, firstname || null, lastname || null, phoneDigits || null, zip || null, organization_id || null],
      )
      const { firstname, lastname, phone } = result.user
      const msg = `🛂 Користувача оновлено:\nID: ${result.user.id}\nІм'я: ${firstname || "-"}\nПрізвище: ${lastname || "-"}\nТелефон: ${phone || "-"}\n`
      console.log(msg)
    } else {
      const insertQuery = `INSERT INTO users (firstname, lastname, phone, zip, organization_id, login, updated_by_id, created_by_id, created_at, updated_at, verified, active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), false, false) RETURNING *`
      const { rows } = await execPgQuery(insertQuery, [
        firstname || null,
        lastname || null,
        phoneDigits || null,
        zip || null,
        organization_id || null,
        phoneDigits || null,
        1, // updated_by_id
        1  // created_by_id
      ])
      const newUser = rows && rows[0] ? rows[0] : null
      const msg = `🛃 Увага! Створено нового користувача з причини прийняття на роботу:\nІм'я: ${firstname || "-"}\nПрізвище: ${lastname || "-"}\nТелефон: ${phone || "-"}\n\n⚠️ Не забудьте встановити email для цього користувача, інакше активація буде неможлива!`
      console.log(msg)
      await sendMessageToGroup(msg)
      result.user = newUser
      result.exists = false
    }

		return reply.send({
			success: true,
			exists: result.exists,
			user: result.user,
		})
	} catch (error) {
		console.error("Error in createUser controller:", error)
		return reply.code(500).send({
			success: false,
			message: "Internal server error",
		})
	}
}

async function blockUser(request, reply) {
	try {
    
		const result = await findUserByOneOfFirstNameOrLastNameOrPhone(request.body)
    const { firstname, lastname, phone, zip } = request.body

    if (result?.user) {
      await execPgQuery(
        "UPDATE users SET verified =false, active=false, firstname=$2, lastname=$3, phone=$4, zip=$5 WHERE id=$1",
        [
          result.user.id,
          firstname || null,
          lastname || null,
          phone || null,
          zip || null
        ]
      )
      const { firstname, lastname, phone } = result.user
      const msg = `🚷 Користувача заблоковано з причини звільнення:\nID: ${result.user.id}\nІм'я: ${firstname || "-"}\nПрізвище: ${lastname || "-"}\nТелефон: ${phone || "-"}\n`
      console.log(msg)
      await sendMessageToGroup(msg)
    } else {
      const msg = `📛 Не вдалося знайти користувача для блокування з причини звільнення за такими даними:\nІм'я: ${firstname || "-"}\nПрізвище: ${lastname || "-"}\nТелефон: ${phone || "-"}\n\nБудь ласка, знайдіть цього користувача вручну та вимкніть його з потребою.`
      console.warn(msg)
      await sendMessageToGroup(msg)
    }

		return reply.send({
			success: true,
			exists: result.exists,
			user: result.user,
		})

	} catch (error) {
		console.error("Error in blockUser controller:", error)
		return reply.code(500).send({
			success: false,
			message: "Internal server error",
		})
	}
}

async function sendMessageToGroup(message) {
  try {
    const groupChatId = process.env.GROUP_ID
    if (!groupChatId) {
      console.warn('TELEGRAM_GROUP_CHAT_ID is not set. Cannot send message to group.')
      return
    }
    if (bot) {
      await bot.sendMessage(groupChatId, message)
    } else {
      console.error('Telegram bot не инициализирован или sendMessage недоступен')
    }
  } catch (error) {
    console.error('Error in sendMessageToGroup:', error)
  }
}

async function findUserByOneOfFirstNameOrLastNameOrPhone( data ) {
  const { firstname, lastname, phone, zip } = data
  try {
    if (!firstname && !lastname && !phone && !zip) {
      return { exists: false, user: null }
    }

    if (zip) {
      const cleanZip = zip.replace(/\s+/g, '')
      const queryZip = "SELECT * FROM users WHERE REPLACE(zip, ' ', '') = $1 LIMIT 1"
      const result = await execPgQuery(queryZip, [cleanZip])
      if (result && result.rows && result.rows.length > 0 && result.rows[0].zip) {
        return { exists: true, user: result.rows[0] }
      }
    }

    if (phone) {
      let phoneDigits = phone.replace(/\D/g, '')
      if (phoneDigits.length > 10) {
        phoneDigits = phoneDigits.slice(-10)
      }
      const queryPhone = "SELECT * FROM users WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = $1 LIMIT 1"
      const result = await execPgQuery(queryPhone, [phoneDigits])
      if (result && result.rows && result.rows.length > 0 && result.rows[0].phone) {
        return { exists: true, user: result.rows[0] }
      }
    }

    if (firstname && lastname) {
      const cleanFirstName = firstname.replace(/\s+/g, '').toLowerCase()
      const cleanLastName = lastname.replace(/\s+/g, '').toLowerCase()
      const queryName = "SELECT * FROM users WHERE REPLACE(LOWER(firstname), ' ', '') ILIKE $1 AND REPLACE(LOWER(lastname), ' ', '') ILIKE $2 LIMIT 1"
      const result = await execPgQuery(queryName, [`%${cleanFirstName}%`, `%${cleanLastName}%`])
      if (result && result.rows && result.rows.length > 0) {
        return { exists: true, user: result.rows[0] }
      }
    }

    return { exists: false, user: null }
  } catch (error) {
    console.error("Error in findUserByOneOfFirstNameOrLastNameOrPhone:", error)
    return { exists: false, user: null }
  }
}

async function createNewTicket(request, reply) {
  try {
    const {
      title,
      body,
      customer_id,
      group_id,
      priority_id,
      state_id,
      owner_id,
      article_type,
      internal
    } = request.body

    if (!title || !body || !customer_id) {
      return reply.code(400).send({
        success: false,
        message: 'title, body, and customer_id are required'
      })
    }

    const ticketData = {
      title,
      body,
      customer_id,
      group_id,
      priority_id,
      state_id,
      owner_id,
      article_type,
      internal
    }

    const isAlreadyRegistered = await checkAlreadyRegistered(ticketData, customer_id)
    if (isAlreadyRegistered) {
      return reply.send({
        success: true,
        ticket: {
          id: 'already_registered'
        }
      })
    }

    const isInsufficientInfo = await checkInsufficientInfo(ticketData)
    if (isInsufficientInfo) {
      return reply.send({
        success: true,
        ticket: {
          id: 'insufficient_info'
        }
      })
    }

    const ticket = await createTicket(ticketData)

    return reply.send({
      success: true,
      ticket: ticket
    })

  } catch (error) {
    console.error('Error in createNewTicket controller:', error)
    return reply.code(500).send({
      success: false,
      message: 'Internal server error',
      error: error.message
    })
  }
}

module.exports = {
  checkUser,
  blockUser,
  createUser,
  createNewTicket,
  goToApiControllerForCheck
}