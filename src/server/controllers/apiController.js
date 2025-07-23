const { checkUserByTelegramId } = require('../services/users-api')
const { createTicket } = require('../services/tickets-api')

async function checkUser(req, res) {
  try {
    const { telegram_id } = req.body

    if (!telegram_id) {
      return res.status(400).json({
        success: false,
        message: 'telegram_id is required'
      })
    }

    const result = await checkUserByTelegramId(telegram_id)

    return res.json({
      success: true,
      exists: result.exists,
      user: result.user
    })

  } catch (error) {
    console.error('Error in checkUser controller:', error)
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
}

async function createNewTicket(req, res) {
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
    } = req.body

    if (!title || !body || !customer_id) {
      return res.status(400).json({
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

    const ticket = await createTicket(ticketData)

    return res.json({
      success: true,
      ticket: ticket
    })

  } catch (error) {
    console.error('Error in createNewTicket controller:', error)
    return res.status(500).json({
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