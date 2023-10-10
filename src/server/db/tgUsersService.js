const execPgQuery = require('./common').execPgQuery

async function findUserById(tg_id) {
  try {
    if (!/^\d{7,12}$/.test(tg_id)) return null
    const data = await execPgQuery('SELECT * FROM users WHERE login = $1', [tg_id.toString()])
    return data
  } catch (error) {
    console.error('Error in findUserById:', error)
    return null
  }
}

async function findUserByEmail(email) {
  try {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
    const data = await execPgQuery('SELECT * FROM users WHERE email = $1', [email])
    return data
  } catch (error) {
    console.error('Error in findUserById:', error)
    return null
  }
}

async function createOrUpdateUserIntoDb(chatId, user_info) {
  try {
    let existingUser = await findUserById(chatId)
    if (!existingUser) existingUser = await findUserByEmail(user_info.email.replace(/\s+/g, ''))
    if (existingUser) {
      const query = 'UPDATE users SET updated_at = $1, phone = $2, firstname = $3, lastname = $4, email = $5, source = $6 WHERE login = $7'
      const values = [
        new Date(),
        user_info.phoneNumber,
        user_info?.PIB,
        user_info?.contract,
        user_info.email,
        user_info?.address,
        chatId
      ]
      const data = await execPgQuery(query, values, true)
      return data[0]
    } else {
      const query = 'INSERT INTO users (created_at, updated_at, created_by_id, organization_id, updated_by_id, login, phone, firstname, lastname, email, source, verified) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)'
      const values = [
        new Date(),
        new Date(),
        1,
        1,
        1,
        chatId,
        user_info.phoneNumber,
        user_info?.PIB,
        user_info?.contract,
        user_info.email,
        user_info?.address,
        false
      ]
      const data = await execPgQuery(query, values, true)
      return data
    }
  } catch (error) {
    console.error('Error of record new user data into the bot-database:', error)
  }
}

module.exports = { findUserById, createOrUpdateUserIntoDb }
