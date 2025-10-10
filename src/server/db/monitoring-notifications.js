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
    title_pattern: 'Недоступний Інтернет%',
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
    console.error('Error getting user by store number:', error)
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
      WHERE created_at >= NOW() - INTERVAL '${startDeltaSeconds} seconds'
        AND created_at <= NOW() - INTERVAL '${endDeltaSeconds} seconds'
        AND group_id = $1 
        AND title LIKE $2 
      ORDER BY created_at DESC
    `

    const result = await execPgQuery(query, [
      config.group_id,
      config.title_pattern
    ], false, true)

    return result || []
  } catch (error) {
    console.error('Error getting monitoring tickets:', error)
    return []
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
      console.error('Missing telegram ID or bot instance')
      return false
    }

    await bot.sendMessage(telegramId, message, { parse_mode: 'HTML' })
    console.log(`✅ Notification sent to ${telegramId}: ${message}`)
    return true
  } catch (error) {
    console.error(`❌ Failed to send notification to ${telegramId}:`, error.message)
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
    console.log(`Processing ${monitoringType} notifications: looking ${startDeltaSeconds}s to ${endDeltaSeconds}s ago`)

    const config = MONITORING_TYPES[monitoringType]
    const tickets = await getMonitoringTickets(startDeltaSeconds, endDeltaSeconds, monitoringType)

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
        results.errors++
        continue
      }

      const user = await getUserByStoreNumber(storeNumber)
      if (!user || !user.login) {
        console.warn(`User not found for store ${storeNumber}`)
        results.errors++
        continue
      }

      // Check if notification already sent
      if (wasNotificationSent(user.login, ticket.id)) {
        console.log(`Notification already sent for ticket ${ticket.id} to ${user.login}`)
        results.skipped++
        continue
      }

      // Format message based on ticket state
      let message
      if (ticket.state_id === TICKET_STATES.PROBLEM_RESOLVED) {
        const duration = ticket.duration_hours || 0
        message = `${config.messages.up} ${storeNumber}\n` +
          `⏰ Тривалість: ${duration} год.\n` +
          `🕐 Відновлено: ${new Date(ticket.close_at).toLocaleString('uk-UA')}`
      } else {
        message = `${config.messages.down} ${storeNumber}\n` +
          `🕐 Початок: ${new Date(ticket.created_at).toLocaleString('uk-UA')}\n` +
          `📋 Ticket ID: ${ticket.id}`
      }

      // Send notification
      const sent = await sendNotification(user.login, message, ticket)
      if (sent) {
        markNotificationSent(user.login, ticket.id)
        results.sent++
      } else {
        results.errors++
      }

      // Small delay between notifications
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log(`Monitoring notifications processed:`, results)
    return results
  } catch (error) {
    console.error('Error processing monitoring notifications:', error)
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

    // Query uses database NOW() for consistency
    const query = `
      SELECT id, title, created_at, close_at, state_id, 
        ROUND((EXTRACT(EPOCH FROM (NOW() - created_at))/3600)::numeric, 1) as duration_hours
      FROM tickets 
      WHERE group_id = $1 
        AND title LIKE $2 
        AND title LIKE $3
        AND created_at >= NOW() - INTERVAL '${lookbackDeltaSeconds} seconds'
      ORDER BY created_at DESC 
      LIMIT 1
    `

    const result = await execPgQuery(query, [
      config.group_id,
      config.title_pattern,
      `%m${storeNumber}%`
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

    return {
      storeNumber,
      status: isResolved ? 'restored' : 'down',
      message: isResolved ?
        `✅ Інтернет відновлено (тривалість збою: ${ticket.duration_hours || 0} год.)` :
        `🔴 Інтернет недоступний (${ticket.duration_hours || 0} год.)`,
      lastUpdate: ticket.created_at,
      ticketId: ticket.id
    }
  } catch (error) {
    console.error('Error checking store internet status:', error)
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

    console.log('Cleaned up old monitoring notifications')
  } catch (error) {
    console.error('Error cleaning up notifications:', error)
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
async function startMonitoringCheck(checkIntervalMinutes = 5, monitoringType = 'INTERNET') {
  const deltaSeconds = checkIntervalMinutes * 60
  console.log(`Starting monitoring check for last ${checkIntervalMinutes} minutes (${deltaSeconds} seconds)`)

  return await processMonitoringNotifications(deltaSeconds, 0, monitoringType)
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
  MONITORING_TYPES,
  TICKET_STATES
}
