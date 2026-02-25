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

async function blockUser(request, reply) {
	try {
    
		const result = await findUserByOneOfFirstNameOrLastNameOrPhone(request.body)
    const { firstname, lastname, phone } = request.body

    if (result?.user) {
      await execPgQuery("UPDATE users SET verified =false, active=false WHERE id=$1", [
				result.user.id,
			])      
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
    await bot.telegram.sendMessage(groupChatId, message)

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
      const { rows } = await execPgQuery(queryZip, [cleanZip])
      if (rows && rows.length > 0 && rows[0].zip) {
        return { exists: true, user: rows[0] }
      }
    }

    if (phone) {
      let phoneDigits = phone.replace(/\D/g, '')
      if (phoneDigits.length > 10) {
        phoneDigits = phoneDigits.slice(-10)
      }
      const queryPhone = "SELECT * FROM users WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = $1 LIMIT 1"
      const { rows } = await execPgQuery(queryPhone, [phoneDigits])
      if (rows && rows.length > 0 && rows[0].phone) {
        return { exists: true, user: rows[0] }
      }
    }

    if (firstname && lastname) {
      const cleanFirstName = firstname.replace(/\s+/g, '').toLowerCase()
      const cleanLastName = lastname.replace(/\s+/g, '').toLowerCase()
      const queryName = "SELECT * FROM users WHERE REPLACE(LOWER(firstname), ' ', '') ILIKE $1 AND REPLACE(LOWER(lastname), ' ', '') ILIKE $2 LIMIT 1"
      const { rows } = await execPgQuery(queryName, [`%${cleanFirstName}%`, `%${cleanLastName}%`])
      if (rows && rows.length > 0) {
        return { exists: true, user: rows[0] }
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
  createNewTicket,
  goToApiControllerForCheck
}