const { Pool } = require('pg')

const pool = new Pool({
  user: process.env.ZAMMAD_DB_USER,
  host: process.env.ZAMMAD_DB_HOST,
  database: process.env.ZAMMAD_DB_NAME,
  password: process.env.ZAMMAD_DB_PASSWORD,
  port: Number(process.env.ZAMMAD_DB_PORT) || 5432,
})

async function execPgQuery(query, values, commit = false) {
  let client
  try {
    client = await pool.connect()
    const data = await client.query(query, values)
    if (commit) await client.query('COMMIT')
    if (data.rows.length === 0) return null
    return data.rows[0]
  } catch (error) {
    console.error(`Error in execQuery ${query},${values.toString()}:`, error)
    if (commit) await client.query('ROLLBACK')
    return null
  } finally {
    if (client) client.release()
  }
}

async function findUserById(user_id) {
  try {
    if (!/^\d{7,12}$/.test(user_id)) return null
    const data = await execPgQuery('SELECT * FROM users WHERE login = $1', [user_id])
    return data
  } catch (error) {
    console.error('Error in findUserById:', error)
    return null
  }
}

async function createUserInBotDb(chatId, user_info) {
  try {
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
    return data[0]
  } catch (error) {
    console.error('Error of record new user data into the bot-database:', error)
  }
}

module.exports = { findUserById, createUserInBotDb }
