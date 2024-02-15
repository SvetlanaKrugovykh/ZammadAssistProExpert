const execPgQuery = require('./common').execPgQuery

async function getTickets(state_id, customer_id, chatId) {
  let values = [customer_id, state_id]
  let query = ''
  try {
    if (state_id === 333) {
      query = `SELECT t.* FROM tickets t JOIN(SELECT ticket_id FROM ticket_updates WHERE login = '${chatId.toString()}' AND state_id = 111) tu ON t.id = tu.ticket_id ORDER BY created_at DESC LIMIT 10`
      values = []
    } else {
      query = 'SELECT * FROM tickets WHERE customer_id = $1 AND state_id = $2 ORDER BY created_at DESC LIMIT 10'
      if (state_id === 2) {
        query = query.replace('state_id = $2', 'state_id IN (1, $2)')
      }
    }
    const data = await execPgQuery(query, values, false, true)
    return data
  } catch (error) {
    console.error('Error of record new user data into the bot-database:', error)
  }
}

module.exports = { getTickets }