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

const tableNames = ['ticket_updates', 'subdivisions'];

const tableQueries = {
  'ticket_updates': `
    CREATE TABLE ticket_updates (
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
  'subdivisions': `
    CREATE TABLE subdivisions (
      id SERIAL PRIMARY KEY,
      subdivision_name VARCHAR,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
}


module.exports.updateTables = function () {
  const promises = tableNames.map(tableName => new Promise((resolve, reject) => {
    pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = $1
      )`,
      [tableName],
      (err, res) => {
        if (err) {
          console.error(`Error checking if table ${tableName} exists:`, err)
          reject(err)
          return
        }
        const tableExists = res.rows[0].exists
        if (!tableExists) {
          createTable(tableName).then(resolve).catch(reject)
        } else {
          console.log(`Table ${tableName} already exists.`)
          resolve()
        }
      }
    )
  }))

  Promise.all(promises).then(() => pool.end()).catch(err => {
    console.error('Error updating tables:', err)
    pool.end()
  })
}

function createTable(tableName) {
  return new Promise((resolve, reject) => {
    const query = tableQueries[tableName]
    if (!query) {
      console.error(`No query found for table ${tableName}`)
      reject(new Error(`No query found for table ${tableName}`))
      return
    }

    pool.query(query, (err, res) => {
      if (err) {
        console.error(`Error creating table ${tableName}:`, err)
        reject(err)
      } else {
        console.log(`Table ${tableName} created successfully.`)
        resolve()
      }
    })
  })
}