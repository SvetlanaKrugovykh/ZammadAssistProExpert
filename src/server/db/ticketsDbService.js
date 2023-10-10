const execPgQuery = require('./common').execPgQuery

async function getTickets(user, state_id, customer_id) {
  try {
    const query = 'SELECT * FROM tickets WHERE customer_id = $1' // AND status = $2
    const values = [customer_id]   //, state_id]
    const data = await execPgQuery(query, values)
    return data
  } catch (error) {
    console.error('Error of record new user data into the bot-database:', error)
  }
}

module.exports = { getTickets }