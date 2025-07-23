const { execPgQuery } = require('../db/common')

async function checkUserByTelegramId(telegramId) {
  try {
    const query = `
      SELECT id, login, firstname, lastname, email, active, verified
      FROM users 
      WHERE login = $1 AND active = true AND verified = true
    `

    const result = await execPgQuery(query, [telegramId], false, true)

    if (result && result.length > 0) {
      return {
        exists: true,
        user: result[0]
      }
    }

    return {
      exists: false,
      user: null
    }
  } catch (error) {
    console.error('Error checking user by telegram ID:', error)
    throw error
  }
}

module.exports = {
  checkUserByTelegramId
}