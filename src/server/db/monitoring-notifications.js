const { execPgQuery } = require('../db/common')
const { bot } = require('../globalBuffer') // Убираем globalBuffer из импорта
require('dotenv').config()

const monitoringNotifications = {
  sentNotifications: new Map(), // telegramId -> Set of ticketIds
  lastCleanup: Date.now()
}

// Configuration for different monitoring types
const MONITORING_TYPES = {
  INTERNET: {
    title_pattern: 'Недоступний Інтернет%M%',
    group_id: 7,
    messages: {
      down: '🔴 Недоступний Інтернет в магазині',
      up: '🟢 Інтернет відновлено в магазині'
    }
  },
  VIDEO_SERVER: {
    title_pattern: 'Недоступний відеосервер%',
    group_id: 8, // Example group ID
    messages: {
      down: '🔴 Недоступний відеосервер в магазині',
      up: '🟢 Відеосервер відновлено в магазині'
    }
  }
}

// State definitions
const TICKET_STATES = {
  PROBLEM_ACTIVE: 2,    // Problem is active
  PROBLEM_RESOLVED: 4   // Problem is resolved
}

/**
 * Initialize notification buffer for user if not exists
 * @param {string} telegramId - Telegram user ID
 */
function initializeUserNotifications(telegramId) {
  if (!monitoringNotifications.sentNotifications.has(telegramId)) {
    monitoringNotifications.sentNotifications.set(telegramId, new Set())
  }
}

/**
 * Check if notification was already sent
 * @param {string} telegramId - Telegram user ID
 * @param {number} ticketId - Ticket ID
 * @returns {boolean}
 */
function wasNotificationSent(telegramId, ticketId) {
  initializeUserNotifications(telegramId)
  return monitoringNotifications.sentNotifications.get(telegramId).has(ticketId)
}

/**
 * Mark notification as sent
 * @param {string} telegramId - Telegram user ID
 * @param {number} ticketId - Ticket ID
 */
function markNotificationSent(telegramId, ticketId) {
  initializeUserNotifications(telegramId)
  monitoringNotifications.sentNotifications.get(telegramId).add(ticketId)
}

/**
 * Extract store number from ticket title
 * @param {string} title - Ticket title like "Недоступний Інтернет на хосте m321"
 * @returns {string|null} - Store number like "321" or null if not found
 */
function extractStoreNumber(title) {
  const match = title.match(/\bm(\d+)\b/i)
  return match ? match[1] : null
}

/**
 * Get user email and telegram ID by store number
 * @param {string} storeNumber - Store number like "321"
 * @returns {Object|null} - User data or null
 */
async function getUserByStoreNumber(storeNumber) {
  try {
    const paddedStore = storeNumber.padStart(3, '0') // "321" -> "321", "6" -> "006"
    const email = `lotok${paddedStore}.uprav@lotok.in.ua`

    const query = `
      SELECT id, login, email, firstname, lastname 
      FROM users 
      WHERE email = $1 AND active = true
    `

    const result = await execPgQuery(query, [email], false, true)
    return result && result.length > 0 ? result[0] : null
  } catch (error) {
    console.error(`❌ Error getting user for store ${storeNumber}: ${error.message || 'Unknown error'}`)
    return null
  }
}

/**
 * Get store number by customer ID (login from users table)
 * @param {number} customer_id - Customer ID (equals to user login)
 * @returns {string|null} - Store number like "321" or null if not found
 */
async function getStoreNumberByCustomerID(customer_id) {
  try {
    const query = `
      SELECT email 
      FROM users 
      WHERE login = $1 AND active = true
    `

    const result = await execPgQuery(query, [customer_id], false, true)
    if (!result || result.length === 0) {
      return null
    }

    const email = result[0].email
    const match = email.match(/lotok(\d+)\.uprav@lotok\.in\.ua/)
    return match ? match[1] : null
  } catch (error) {
    console.error(`❌ Error getting store number for customer_id ${customer_id}: ${error.message || 'Unknown error'}`)
    return null
  }
}

/**
 * Get monitoring tickets from database using time deltas
 * @param {number} startDeltaSeconds - Seconds to subtract from current time for start (e.g., 300 for 5 minutes ago)
 * @param {number} endDeltaSeconds - Seconds to subtract from current time for end (e.g., 0 for now)
 * @param {string} monitoringType - Type from MONITORING_TYPES
 * @returns {Array} - Array of tickets
 */
async function getMonitoringTickets(startDeltaSeconds, endDeltaSeconds, monitoringType) {
  try {
    const config = MONITORING_TYPES[monitoringType]
    if (!config) {
      throw new Error(`Unknown monitoring type: ${monitoringType}`)
    }

    // Use pure database NOW() without any timezone adjustments
    const query = `
      SELECT id, title, created_at, close_at, state_id,
        DATE_TRUNC('day', created_at) as start_of_day_created_at, 
        NOW() as current_time_db, 
        ROUND((EXTRACT(EPOCH FROM (NOW() - created_at))/3600)::numeric, 1) as duration_hours
      FROM tickets 
      WHERE (
          (created_at >= NOW() - INTERVAL '${startDeltaSeconds} seconds' AND created_at <= NOW() - INTERVAL '${endDeltaSeconds} seconds')
        OR
          (close_at IS NOT NULL AND close_at >= NOW() - INTERVAL '${startDeltaSeconds} seconds' AND close_at <= NOW() - INTERVAL '${endDeltaSeconds} seconds' AND state_id = 4)
      )
        AND group_id = $1 
        AND title ILIKE $2 
      ORDER BY created_at DESC
    `

    const result = await execPgQuery(query, [
      config.group_id,
      config.title_pattern
    ], false, true)

    return result || []
  } catch (error) {
    console.error(`❌ Error getting ${monitoringType} tickets: ${error.message || 'Unknown error'}`)
    return []
  }
}

/**
 * Send debug notification to admin
 * @param {string} debugMessage - Debug message to send
 * @param {string} originalTelegramId - Original recipient ID
 * @param {boolean} wasSuccessful - Whether original send was successful
 */
async function sendDebugNotification(debugMessage, originalTelegramId, wasSuccessful) {
  const debugTelegramEnabled = process.env.DEBUG_TELEGRAM === 'true'
  const debugTelegramId = process.env.DEBUG_TELEGRAM_ID

  if (!debugTelegramEnabled || !debugTelegramId || !bot) {
    return
  }

  try {
    // Add 2 second delay to avoid Telegram rate limits for debug messages
    await new Promise(resolve => setTimeout(resolve, 2000))

    const status = wasSuccessful ? '✅ SENT' : '❌ FAILED'
    const fullDebugMessage = `🐛 DEBUG MONITORING:\n${status} to ${originalTelegramId}\n\n${debugMessage}`

    await bot.sendMessage(debugTelegramId, fullDebugMessage, { parse_mode: 'HTML' })
  } catch (error) {
    console.error(`❌ Failed to send debug notification: ${error.message}`)
  }
}

/**
 * Apply timezone offset to date for display
 * @param {Date|string} date - Date to adjust
 * @returns {string} - Formatted date string with timezone offset applied
 */
function formatDateWithTimezone(date) {
  try {
    const dateObj = new Date(date)
    const offsetMinutes = parseInt(process.env.TIMEZONE_OFFSET_MINUTES) || 0
    const adjustedDate = new Date(dateObj.getTime() + (offsetMinutes * 60 * 1000))
    return adjustedDate.toLocaleString('uk-UA')
  } catch (error) {
    console.error(`❌ Error formatting date with timezone: ${error.message}`)
    return new Date(date).toLocaleString('uk-UA')
  }
}

/**
 * Format duration from hours to readable format
 * @param {number} durationHours - Duration in hours (can be decimal)
 * @returns {string} - Formatted duration like "4г 25хв" or "45хв"
 */
function formatDuration(durationHours) {
  try {
    const totalMinutes = Math.round(durationHours * 60)

    if (totalMinutes < 60) {
      return `${totalMinutes}хв`
    }

    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    if (minutes === 0) {
      return `${hours}г`
    }

    return `${hours}г ${minutes}хв`
  } catch (error) {
    console.error(`❌ Error formatting duration: ${error.message}`)
    return `${Math.round(durationHours || 0)}г`
  }
}

/**
 * Send notification to user
 * @param {string} telegramId - Telegram user ID
 * @param {string} message - Message to send
 * @param {Object} ticketData - Ticket data for context
 * @returns {boolean} - Success status
 */
async function sendNotification(telegramId, message, ticketData) {
  try {
    if (!telegramId || !bot) {
      console.error('❌ Missing telegram ID or bot instance')
      await sendDebugNotification(message, telegramId || 'UNKNOWN', false)
      return false
    }

    await bot.sendMessage(telegramId, message, { parse_mode: 'HTML' })
    console.log(`✅ Notification sent to ${telegramId}`)

    // Send debug copy
    await sendDebugNotification(message, telegramId, true)
    return true
  } catch (error) {
    console.error(`❌ Failed to send to ${telegramId}: ${error.message || 'Unknown error'}`)

    // Send debug notification about failure
    await sendDebugNotification(message, telegramId, false)
    return false
  }
}

/**
 * Process monitoring tickets and send notifications using time deltas
 * @param {number} startDeltaSeconds - Seconds to subtract from current time for start
 * @param {number} endDeltaSeconds - Seconds to subtract from current time for end  
 * @param {string} monitoringType - Type from MONITORING_TYPES
 * @returns {Object} - Processing results
 */
async function processMonitoringNotifications(startDeltaSeconds, endDeltaSeconds, monitoringType = 'INTERNET') {
  try {
    const config = MONITORING_TYPES[monitoringType]
    const tickets = await getMonitoringTickets(startDeltaSeconds, endDeltaSeconds, monitoringType)

    // Only log if there are tickets to process
    if (tickets.length > 0) {
      console.log(`Processing ${monitoringType} notifications: looking ${startDeltaSeconds}s to ${endDeltaSeconds}s ago, found ${tickets.length} tickets`)
    }

    // Debug variables for later use
    const debugTelegramEnabled = process.env.DEBUG_TELEGRAM === 'true'
    const debugTelegramId = process.env.DEBUG_TELEGRAM_ID

    const results = {
      processed: 0,
      sent: 0,
      skipped: 0,
      errors: 0,
      timeRange: `${startDeltaSeconds}s to ${endDeltaSeconds}s ago`
    }

    for (const ticket of tickets) {
      results.processed++

      const storeNumber = extractStoreNumber(ticket.title)
      if (!storeNumber) {
        console.warn(`Cannot extract store number from title: ${ticket.title}`)

        // Send debug notification about parsing error
        if (debugTelegramEnabled && debugTelegramId && bot) {
          try {
            await bot.sendMessage(debugTelegramId,
              `🐛 DEBUG: PARSE ERROR\n` +
              `Cannot extract store number\n` +
              `Ticket ID: ${ticket.id}\n` +
              `Title: ${ticket.title}`,
              { parse_mode: 'HTML' })
          } catch (err) {
            console.error('Failed to send debug parse error:', err.message)
          }
        }

        results.errors++
        continue
      }

      const user = await getUserByStoreNumber(storeNumber)
      if (!user || !user.login) {
        console.warn(`User not found for store ${storeNumber}`)

        // Send debug notification about user not found
        if (debugTelegramEnabled && debugTelegramId && bot) {
          try {
            await bot.sendMessage(debugTelegramId,
              `🐛 DEBUG: USER NOT FOUND\n` +
              `Store: ${storeNumber}\n` +
              `Ticket ID: ${ticket.id}\n` +
              `Expected email: lotok${storeNumber.padStart(3, '0')}.uprav@lotok.in.ua`,
              { parse_mode: 'HTML' })
          } catch (err) {
            console.error('Failed to send debug user error:', err.message)
          }
        }

        results.errors++
        continue
      }

      // Check if notification already sent
      if (wasNotificationSent(user.login, ticket.id)) {
        console.log(`Notification already sent for ticket ${ticket.id} to ${user.login}`)

        // Skip debug notification for already sent tickets (no spam)

        results.skipped++
        continue
      }

      // Format message based on ticket state
      let message
      if (ticket.state_id === TICKET_STATES.PROBLEM_RESOLVED) {
        const duration = ticket.duration_hours || 0
        const durationMinutes = Math.round(duration * 60)

        // Skip notifications for outages shorter than 2 minutes
        if (durationMinutes < 2) {
          console.log(`Skipping notification for ${storeNumber}: outage too short (${durationMinutes} minutes)`)
          results.skipped++
          continue
        }

        message = `${config.messages.up} ${storeNumber}\n` +
          `⏰ Тривалість: ${formatDuration(duration)}\n` +
          `🕐 Відновлено: ${formatDateWithTimezone(ticket.close_at)}`
      } else {
        message = `${config.messages.down} ${storeNumber}\n` +
          `🕐 Початок: ${formatDateWithTimezone(ticket.created_at)}\n` +
          `📋 Ticket ID: ${ticket.id}`
      }

      // Send notification with detailed logging
      console.log(`Attempting to send notification to ${user.login} for store ${storeNumber}, ticket ${ticket.id}`)
      const sent = await sendNotification(user.login, message, ticket)
      if (sent) {
        markNotificationSent(user.login, ticket.id)
        results.sent++
        console.log(`✅ Successfully sent and marked notification for ${user.login}`)
      } else {
        results.errors++
        console.error(`❌ Failed to send notification to ${user.login} for ticket ${ticket.id}`)
      }

      // 2 second delay between notifications to avoid Telegram rate limits
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    // Only log if notifications were sent or there were errors
    if (results.sent > 0 || results.errors > 0) {
      console.log(`Monitoring notifications processed:`, results)
    }

    return results
  } catch (error) {
    console.error(`❌ Error processing ${monitoringType} notifications: ${error.message || 'Unknown error'}`)
    return { processed: 0, sent: 0, skipped: 0, errors: 1, timeRange: 'error' }
  }
}

/**
 * Check if internet is currently available in store
 * @param {string} storeNumber - Store number like "321"
 * @returns {Object} - Status information
 */
/**
 * Check internet status for specific store using database-relative time
 * @param {string} storeNumber - Store number (e.g., '001', '125')
 * @param {number} lookbackDeltaSeconds - Seconds to look back for recent tickets (default: 1 hour)
 */
async function checkStoreInternetStatus(storeNumber, lookbackDeltaSeconds = 3600) {
  try {
    const config = MONITORING_TYPES.INTERNET

    const query = `
      SELECT id, title, created_at, close_at, state_id, 
        ROUND((EXTRACT(EPOCH FROM (NOW() - created_at))/3600)::numeric, 1) as duration_hours
      FROM tickets 
      WHERE group_id = $1 
        AND title ILIKE $2
        AND title ILIKE $3
        AND (
          created_at >= NOW() - INTERVAL '${lookbackDeltaSeconds} seconds'
          OR (close_at IS NOT NULL AND close_at >= NOW() - INTERVAL '${lookbackDeltaSeconds} seconds' AND state_id = 4)
        )
      ORDER BY 
        COALESCE(close_at, created_at) DESC 
      LIMIT 1
    `

    const result = await execPgQuery(query, [
      config.group_id,
      config.title_pattern,
      `%M${storeNumber}%`
    ], false, true)

    if (!result || result.length === 0) {
      return {
        storeNumber,
        status: 'online',
        message: `📶 Інтернет доступний`,
        lastUpdate: null,
        ticketId: null
      }
    }

    const ticket = result[0]
    const isResolved = ticket.state_id === TICKET_STATES.PROBLEM_RESOLVED
    const durationMinutes = (ticket.duration_hours || 0) * 60

    // If internet was down for less than 2 minutes, consider it online
    if (!isResolved && durationMinutes < 2) {
      return {
        storeNumber,
        status: 'online',
        message: `📶 Інтернет доступний`,
        lastUpdate: null,
        ticketId: null
      }
    }

    return {
      storeNumber,
      status: isResolved ? 'restored' : 'down',
      message: isResolved ?
        `✅ Інтернет відновлено (тривалість збою: ${formatDuration(ticket.duration_hours || 0)})` :
        `🔴 Інтернет недоступний (${formatDuration(ticket.duration_hours || 0)})`,
      lastUpdate: ticket.created_at,
      ticketId: ticket.id
    }
  } catch (error) {
    console.error(`❌ Error checking store ${storeNumber} status: ${error.message || 'Unknown error'}`)
    return {
      storeNumber,
      status: 'error',
      message: 'Помилка перевірки статусу',
      lastUpdate: null,
      ticketId: null
    }
  }
}

/**
 * Clean old notifications from buffer (daily cleanup)
 * @param {number} daysToKeep - Number of days to keep notifications
 */
function cleanupOldNotifications(daysToKeep = 1) {
  try {
    // Clear all notifications (we don't track timestamps per notification for simplicity)
    monitoringNotifications.sentNotifications.clear()
    monitoringNotifications.lastCleanup = Date.now()

    console.log('✅ Cleaned up old monitoring notifications')
  } catch (error) {
    console.error(`❌ Error cleaning notifications: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Get current monitoring notifications stats
 * @returns {Object} - Stats about monitoring notifications
 */
function getMonitoringStats() {
  return {
    usersWithNotifications: monitoringNotifications.sentNotifications.size,
    totalNotifications: Array.from(monitoringNotifications.sentNotifications.values())
      .reduce((total, userSet) => total + userSet.size, 0),
    lastCleanup: new Date(monitoringNotifications.lastCleanup).toISOString()
  }
}

/**
 * Start monitoring notifications for recent time period
 * @param {number} checkIntervalMinutes - How many minutes back to check (default: 5)
 * @param {string} monitoringType - Type from MONITORING_TYPES (default: 'INTERNET')
 */
async function startMonitoringCheck(checkIntervalMinutes = 15, monitoringType = 'INTERNET') {
  const deltaSeconds = checkIntervalMinutes * 60

  try {
    return await processMonitoringNotifications(deltaSeconds, 0, monitoringType)
  } catch (error) {
    console.error(`❌ Error in startMonitoringCheck: ${error.message || 'Unknown error'}`)
    return { processed: 0, sent: 0, skipped: 0, errors: 1, timeRange: 'error' }
  }
}

module.exports = {
  processMonitoringNotifications,
  getMonitoringTickets,
  checkStoreInternetStatus,
  startMonitoringCheck,
  cleanupOldNotifications,
  getMonitoringStats,
  extractStoreNumber,
  getUserByStoreNumber,
  getStoreNumberByCustomerID,
  formatDuration,
  formatDateWithTimezone,
  MONITORING_TYPES,
  TICKET_STATES
}
