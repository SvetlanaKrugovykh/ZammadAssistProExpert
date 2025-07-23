const https = require('https')
const axios = require('axios')
require('dotenv').config()

async function createTicket(ticketData) {
  try {
    const headers = {
      Authorization: `Bearer ${process.env.ZAMMAD_API_TOKEN}`,
      "Content-Type": "application/json"
    }

    const data = {
      title: ticketData.title,
      group_id: ticketData.group_id || 1,
      customer_id: ticketData.customer_id,
      priority_id: ticketData.priority_id || 2,
      state_id: ticketData.state_id || 1,
      article: {
        subject: ticketData.title,
        body: ticketData.body,
        type: ticketData.article_type || 'note',
        internal: ticketData.internal || false
      }
    }

    if (ticketData.owner_id) {
      data.owner_id = ticketData.owner_id
    }

    console.log('Creating ticket with data:', JSON.stringify(data, null, 2))

    const httpsAgent = new https.Agent({ rejectUnauthorized: false })
    const url = `${process.env.ZAMMAD_API_URL}/tickets`

    const response = await axios.post(url, data, { headers, httpsAgent })
    const ticket = response.data

    console.log(`Ticket created successfully: ${ticket.id}`)
    return ticket

  } catch (error) {
    console.error('Error creating ticket:', error)
    if (error.response) {
      console.error('Error response data:', error.response.data)
      console.error('Error response status:', error.response.status)
    }
    throw error
  }
}

module.exports = {
  createTicket
}