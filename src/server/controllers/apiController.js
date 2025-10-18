const { checkUserByTelegramId } = require('../services/users-api')
const { createTicket } = require('../services/tickets-api')
const { checkStoreInternetStatus, getStoreNumberByCustomerID } = require('../db/monitoring-notifications')

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
  createNewTicket
}