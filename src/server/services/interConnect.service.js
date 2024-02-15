
const { execPgQuery } = require('../db/common')

module.exports.newRecord = async function (body) {
  try {
    const { ticket_id, sender_id, state_id, login, message_in, urls_in } = body
    const urls_in_string = urls_in.join(',')
    const query = `INSERT INTO ticket_updates(state_id, ticket_id, sender_id, login, message_in, urls_in) VALUES($1, $2, $3, $4, $5, $6)`
    const values = [state_id, ticket_id, sender_id, login, message_in, urls_in_string]
    await execPgQuery(query, values, true)
    return true
  } catch (error) {
    console.error('Error executing commands:', error.message)
    return false
  }
}