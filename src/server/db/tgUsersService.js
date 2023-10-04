const { Client } = require('pg')
const client = new Client({
  user: process.env.ZAMMAD_DB_USER,
  host: process.env.ZAMMAD_DB_HOST,
  database: process.env.ZAMMAD_DB_NAME,
  password: process.env.ZAMMAD_DB_PASSWORD,
  port: process.env.ZAMMAD_DB_PORT.toString(),
})

async function findUserById(user_id) {
  try {
    await client.connect()

    const query = 'SELECT * FROM users WHERE user_id = $1'
    const result = await client.query(query, [user_id])

    if (result.rows.length > 0) {
      const user_info = result.rows[0]
      const user_info_dict = {
        'user_id': user_info.user_id,
        'phone_number': user_info.phone_number,
        'first_name': user_info.first_name,
        'last_name': user_info.last_name,
        'email': user_info.email,
        'zammad_user_id': user_info.zammad_user_id
      }
      return user_info_dict
    } else {
      return null
    }
  } catch (error) {
    console.error('Error in findUserById:', error)
    return null
  } finally {
    await client.end()
  }
}

async function createUserInBotDb(user_info) {
  try {
    await client.connect()

    //return (text + '#' + data?.email + '#' + data?.phoneNumber + '#' + data?.password + '#' + data?.PIB + '#' + data?.contract + '#' + data?.address + '#' + //text)
    const query = `
      INSERT INTO users (user_id, phone_number, first_name, last_name, email, zammad_user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `
    const values = [
      user_info.user_id,
      user_info.phone,
      user_info.first_name,
      user_info.last_name,
      user_info.email,
      user_info.zammad_user_id
    ]

    await client.query(query, values)
    await client.query('COMMIT')
  } catch (error) {
    console.error('Ошибка при создании записи в базе данных бота:', error)
    await client.query('ROLLBACK')
  } finally {
    await client.end()
  }
}

module.exports = { findUserById, createUserInBotDb }
