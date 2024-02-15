// src/db/tablesUpdate.js

const { Pool } = require('pg')
const dotenv = require('dotenv')

dotenv.config()

const pool = new Pool({
  user: process.env.ZAMMAD_DB_USER,
  host: process.env.ZAMMAD_DB_HOST,
  database: process.env.ZAMMAD_DB_NAME,
  password: process.env.ZAMMAD_DB_PASSWORD,
  port: process.env.ZAMMAD_DB_PORT,
})

module.exports.updateTables = function () {
  pool.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = 'ticket_updates'
    )`,
    (err, res) => {
      if (err) {
        console.error('Error checking if table exists:', err)
        pool.end()
        return
      }
      const tableExists = res.rows[0].exists
      if (!tableExists) {
        createTable()
      } else {
        console.log('Table ticket_updates already exists.')
        pool.end()
      }
    }
  )
}

function createTable() {
  pool.query(
    `CREATE TABLE ticket_updates (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER,
      sender_id INTEGER,
      state_id INTEGER,
      login VARCHAR,
      subject VARCHAR,
      message_in VARCHAR,
      message_out VARCHAR,
      urls_in VARCHAR,
      urls_out VARCHAR,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    (err, res) => {
      if (err) {
        console.error('Error creating table:', err)
      } else {
        console.log('Table ticket_updates created successfully.')
      }
      pool.end()
    }
  )
}


