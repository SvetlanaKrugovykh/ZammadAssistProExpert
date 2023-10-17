const execPgQuery = require('./common').execPgQuery

async function getTickets(state_id, customer_id) {
  try {
    let query = 'SELECT * FROM tickets WHERE customer_id = $1 AND state_id = $2 ORDER BY created_at DESC LIMIT 10'
    if (state_id === 2) {
      query = query.replace('state_id = $2', 'state_id IN (1, $2)')
    }
    const values = [customer_id, state_id]
    const data = await execPgQuery(query, values, false, true)
    return data
  } catch (error) {
    console.error('Error of record new user data into the bot-database:', error)
  }
}

module.exports = { getTickets }