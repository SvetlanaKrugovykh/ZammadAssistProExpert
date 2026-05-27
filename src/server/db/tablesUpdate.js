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

const tableNames = ['ticket_updates', 'subdivisions', 'ticket_notifications', 'ticket_email_notifications']

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
    )`,
  'ticket_notifications': `
    CREATE TABLE ticket_notifications (
      id SERIAL PRIMARY KEY,
      ticket_id INT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      notification_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  'ticket_email_notifications': `
    CREATE TABLE ticket_email_notifications (
      id SERIAL PRIMARY KEY,
      notification_type VARCHAR(64) NOT NULL,
      ticket_id INT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
}



module.exports.updateTables = function () {
  const promises = tableNames.map(tableName => new Promise((resolve, reject) => {
    pool.query(
      `SELECT EXISTS(
    SELECT FROM information_schema.tables
        WHERE table_name = $1
      )`,
      [tableName],
      (err, res) => {
        if (err) {
          console.error(`Error checking if table ${tableName} exists: `, err)
          reject(err)
          return
        }
        const tableExists = res.rows[0].exists
        if (!tableExists) {
          createTable(tableName).then(resolve).catch(reject)
        } else {
          // Миграции для ticket_email_notifications
          if (tableName === 'ticket_email_notifications') {
            console.log('[MIGRATION] Проверка/добавление user_id...')
            const p1 = new Promise((res, rej) => {
              pool.query(`ALTER TABLE ticket_email_notifications ADD COLUMN IF NOT EXISTS user_id INT`, err => {
                if (err) {
                  console.error('[MIGRATION] add user_id failed', err)
                  rej(err)
                } else {
                  console.log('[MIGRATION] user_id: OK')
                  res()
                }
              })
            })
            console.log('[MIGRATION] Проверка/добавление event_type...')
            const p2 = new Promise((res, rej) => {
              pool.query(`ALTER TABLE ticket_email_notifications ADD COLUMN IF NOT EXISTS event_type VARCHAR(32)`, err => {
                if (err) {
                  console.error('[MIGRATION] add event_type failed', err)
                  rej(err)
                } else {
                  console.log('[MIGRATION] event_type: OK')
                  res()
                }
              })
            })
            console.log('[MIGRATION] Проверка/создание уникального индекса...')
            const p3 = new Promise((res, rej) => {
              pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_email_notifications_unique ON ticket_email_notifications (ticket_id, user_id, event_type)`, err => {
                if (err) {
                  console.error('[MIGRATION] add unique index failed', err)
                  rej(err)
                } else {
                  console.log('[MIGRATION] unique index: OK')
                  res()
                }
              })
            })
            Promise.all([p1, p2, p3]).then(() => {
              console.log(`Table ${tableName} already exists and migrations applied.`)
              resolve()
            }).catch(reject)
          } else {
            console.log(`Table ${tableName} already exists.`)
            resolve()
          }
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
        console.error(`Error creating table ${tableName}: `, err)
        reject(err)
      } else {
        console.log(`Table ${tableName} created successfully.`)
        resolve()
      }
    })
  })
}