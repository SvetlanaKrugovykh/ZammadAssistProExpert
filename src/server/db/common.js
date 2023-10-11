const { Pool } = require('pg')

const pool = new Pool({
  user: process.env.ZAMMAD_DB_USER,
  host: process.env.ZAMMAD_DB_HOST,
  database: process.env.ZAMMAD_DB_NAME,
  password: process.env.ZAMMAD_DB_PASSWORD,
  port: Number(process.env.ZAMMAD_DB_PORT) || 5432,
})


async function execPgQuery(query, values, commit = false, all = false) {
  let client
  try {
    client = await pool.connect()
    const data = await client.query(query, values)
    if (commit) await client.query('COMMIT')
    if (data.rows.length === 0) return null
    if (all) return data.rows
    return data.rows[0]
  } catch (error) {
    console.error(`Error in execQuery ${query},${values.toString()}:`, error)
    if (commit) await client.query('ROLLBACK')
    return null
  } finally {
    if (client) client.release()
  }
}

module.exports = { execPgQuery }