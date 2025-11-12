const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({
  user: process.env.ZAMMAD_DB_USER,
  host: process.env.ZAMMAD_DB_HOST,
  database: process.env.ZAMMAD_DB_NAME,
  password: process.env.ZAMMAD_DB_PASSWORD,
  port: Number(process.env.ZAMMAD_DB_PORT) || 5432,
})

async function execPgQuery(query, values, commit = false, all = false) {
  const DEBUG_LEVEL = Number(process.env.DEBUG_LEVEL) || 0
  let client
  let result

  try {
    client = await pool.connect()

    result = await client.query(query, values)
  } catch (error) {
    console.error(`Error in execQuery ${query},${values}:`, error)
    result = null
  } finally {
    if (client) {
      client.release()
    }
  }

  if (result && result.rows.length > 0) {
    return all ? result.rows : result.rows[0]
  }

  return null
}


module.exports = { execPgQuery }