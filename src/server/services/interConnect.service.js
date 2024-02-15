
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

module.exports.userReplyRecord = async function (body) {
  try {
    const { ticket_id, sender_id, state_id, login, message_out, urls_out, id } = body
    const urls_out_string = urls_out.join(',')
    const query = `UPDATE ticket_updates SET state_id=$1, ticket_id=$2, sender_id=$3, login=$4, message_out=$5, urls_out=$6 WHERE id=$7`
    const values = [state_id, ticket_id, sender_id, login, message_out, urls_out_string, id]
    await execPgQuery(query, values, true)
    return true
  } catch (error) {
    console.error('Error executing commands:', error.message)
    return false
  }
}