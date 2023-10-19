const execPgQuery = require('./common').execPgQuery
require('dotenv').config()

async function findUserById(tg_id) {
  try {
    if (!/^\d{1,12}$/.test(tg_id)) return null
    let data = null
    data = await execPgQuery('SELECT * FROM users WHERE login = $1', [tg_id.toString()])
    if (!data) data = await execPgQuery('SELECT * FROM users WHERE id = $1', [tg_id])
    return data
  } catch (error) {
    console.error('Error in findUserById:', error)
    return null
  }
}

async function findOwnerById(owner_id) {
  try {
    if (!/^\d{1,12}$/.test(owner_id)) return null
    let data = null
    data = await execPgQuery('SELECT * FROM users WHERE id = $1', [owner_id])
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
    const DEBUG_LEVEL = Number(process.env.DEBUG_LEVEL) || 0
    const email_ = user_info.email
    const [lastName, firstName] = user_info.PIB.split(' ')

    if (!/^[^\s@]+@(lotok\.in\.ua|ito\.in\.ua)$/.test(email_)) {
      console.log(`Error in createOrUpdateUserIntoDb: email ${email_} is not valid`)
      return 'wrong email'
    }
    let existingUser = await findUserById(chatId)
    if (DEBUG_LEVEL > 0) console.log(`existingUser: ${JSON.stringify(existingUser)}`)
    if (!existingUser) existingUser = await findUserByEmail(user_info.email.replace(/\s+/g, ''))
    if (DEBUG_LEVEL > 0) console.log(`existingUser: ${JSON.stringify(existingUser)}`)
    if (existingUser) {
      const query = 'UPDATE users SET updated_at = $1, login = $2, phone = $3, firstname = $4, lastname = $5, email = $6, source = $7 WHERE login = $8 OR email = $9 RETURNING *'
      const values = [
        new Date(),
        chatId,
        user_info.phoneNumber,
        firstName,
        lastName,
        user_info.email,
        user_info?.address,
        chatId,
        user_info.email
      ]
      const data = await execPgQuery(query, values, true)
      if (DEBUG_LEVEL > 0) console.log(`createOrUpdateUserIntoDb: ${JSON.stringify(data)}`)
      return data
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
        firstName,
        lastName,
        user_info.email,
        user_info?.address,
        false
      ]
      const data = await execPgQuery(query, values, true)
      if (DEBUG_LEVEL > 0) console.log(`createOrUpdateUserIntoDb: ${JSON.stringify(data)}`)
      return data
    }
  } catch (error) {
    console.error('Error of record new user data into the bot-database:', error)
  }
}

module.exports = { findUserById, findOwnerById, createOrUpdateUserIntoDb }
