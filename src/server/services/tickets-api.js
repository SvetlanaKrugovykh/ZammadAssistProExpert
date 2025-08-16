const https = require('https')
const axios = require('axios')
const { findUserById } = require('../db/tgUsersService')
require('dotenv').config()

async function createTicket(ticketData) {
  try {
    const user = await findUserById(ticketData.customer_id)
    const data = {
      title: ticketData.title,
      group_id: ticketData.group_id || 1,
      customer_id: user.id,
      priority_id: ticketData.priority_id || 2,
      state_id: ticketData.state_id || 1,
      article: {
        subject: ticketData.title,
        body: ticketData.body,
        type: ticketData?.article_type || 'note',
        internal: ticketData?.internal || false
      }
    }

    const ticket = await create_api_ticket(data)
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


async function create_api_ticket(data) {
  const headers = { Authorization: process.env.ZAMMAD_API_TOKEN, "Content-Type": "application/json" }
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


module.exports = {
  createTicket
}