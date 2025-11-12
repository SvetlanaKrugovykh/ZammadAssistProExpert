/**
 * Test script for analyzing monitoring queries and timezone issues
 * Run this on the production server to debug time-related problems
 */

const monitoringService = require('../db/monitoring-notifications')
const { execPgQuery } = require('../db/common')

async function testTimeZoneAnalysis() {
  console.log('🕰️  === TIMEZONE ANALYSIS ===')

  try {
    // 1. Check database timezone and current time
    const timeQuery = `
      SELECT 
        NOW() as db_now_full,
        NOW()::timestamp as db_now_timestamp,
        EXTRACT(TIMEZONE FROM NOW()) as db_timezone_offset_seconds,
        pg_typeof(NOW()) as db_now_type,
        CURRENT_SETTING('timezone') as db_timezone_name
    `

    const timeResult = await execPgQuery(timeQuery, [], false, true)
    if (timeResult && timeResult[0]) {
      const tr = timeResult[0]
      console.log('📊 Database Time Info:')
      console.log(`   DB NOW(): ${tr.db_now_full}`)
      console.log(`   DB Timestamp: ${tr.db_now_timestamp}`)
      console.log(`   DB Timezone: ${tr.db_timezone_name}`)
      console.log(`   DB Offset: ${tr.db_timezone_offset_seconds} seconds`)
      console.log(`   DB Type: ${tr.db_now_type}`)
    }

    // 2. Show JavaScript time
    const jsNow = new Date()
    console.log('🖥️  JavaScript Time Info:')
    console.log(`   JS Date: ${jsNow.toISOString()}`)
    console.log(`   JS Local: ${jsNow.toString()}`)
    console.log(`   JS Offset: ${jsNow.getTimezoneOffset()} minutes`)

    console.log('')

  } catch (error) {
    console.error('❌ Error in timezone analysis:', error.message)
  }
}

async function testIntervalQueries() {
  console.log('📋 === INTERVAL QUERY TESTING ===')

  const testIntervals = [
    { name: 'Last 1 hour', seconds: 3600 },
    { name: 'Last 6 hours', seconds: 21600 },
    { name: 'Last 24 hours', seconds: 86400 }
  ]

  for (const interval of testIntervals) {
    console.log(`\n🔍 Testing: ${interval.name} (${interval.seconds} seconds)`)

    try {
      // Test the actual query with debug info
      const debugQuery = `
        SELECT 
          COUNT(*) as total_tickets,
          NOW() as current_db_time,
          NOW() - INTERVAL '${interval.seconds} seconds' as search_from_time,
          NOW() - INTERVAL '0 seconds' as search_to_time,
          MIN(created_at) as earliest_ticket,
          MAX(created_at) as latest_ticket,
          COUNT(CASE WHEN state_id = 2 THEN 1 END) as active_tickets,
          COUNT(CASE WHEN state_id = 4 THEN 1 END) as resolved_tickets
        FROM tickets 
        WHERE (
            (created_at >= NOW() - INTERVAL '${interval.seconds} seconds' AND created_at <= NOW() - INTERVAL '0 seconds')
          OR
            (close_at IS NOT NULL AND close_at >= NOW() - INTERVAL '${interval.seconds} seconds' AND close_at <= NOW() - INTERVAL '0 seconds' AND state_id = 4)
        )
          AND group_id = 7 
          AND title ILIKE 'Недоступний Інтернет%M%'
      `

      const result = await execPgQuery(debugQuery, [], false, true)
      if (result && result[0]) {
        const r = result[0]
        console.log(`   📊 Results for ${interval.name}:`)
        console.log(`      Total tickets: ${r.total_tickets}`)
        console.log(`      Active: ${r.active_tickets}, Resolved: ${r.resolved_tickets}`)
        console.log(`      Search range: ${r.search_from_time} TO ${r.search_to_time}`)
        console.log(`      Data range: ${r.earliest_ticket} TO ${r.latest_ticket}`)
      }

      // Test using the actual function
      const tickets = await monitoringService.getMonitoringTickets(interval.seconds, 0, 'INTERNET')
      console.log(`   🔧 Function returned: ${tickets.length} tickets`)

      if (tickets.length > 0) {
        console.log(`   📝 Sample tickets:`)
        tickets.slice(0, 3).forEach((ticket, i) => {
          console.log(`      ${i + 1}. ID:${ticket.id} State:${ticket.state_id} Created:${ticket.created_at} Duration:${ticket.duration_hours}h`)
        })
      }

    } catch (error) {
      console.error(`   ❌ Error testing ${interval.name}:`, error.message)
    }
  }
}

async function testSpecificTickets() {
  console.log('\n🎯 === RECENT TICKETS ANALYSIS ===')

  try {
    // Get some recent tickets to analyze
    const recentQuery = `
      SELECT 
        id, title, created_at, close_at, state_id,
        EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_ago,
        ROUND((EXTRACT(EPOCH FROM (NOW() - created_at))/3600)::numeric, 1) as duration_hours,
        CASE 
          WHEN close_at IS NOT NULL THEN EXTRACT(EPOCH FROM (close_at - created_at))/60
          ELSE NULL 
        END as actual_duration_minutes
      FROM tickets 
      WHERE group_id = 7 
        AND title ILIKE 'Недоступний Інтернет%M%'
        AND created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC 
      LIMIT 10
    `

    const tickets = await execPgQuery(recentQuery, [], false, true)
    if (tickets && tickets.length > 0) {
      console.log(`📋 Found ${tickets.length} recent tickets:`)
      tickets.forEach((ticket, i) => {
        const storeMatch = ticket.title.match(/\bm(\d+)\b/i)
        const store = storeMatch ? storeMatch[1] : 'unknown'

        console.log(`   ${i + 1}. Store: ${store} | ID: ${ticket.id} | State: ${ticket.state_id}`)
        console.log(`      Created: ${ticket.created_at} (${Math.round(ticket.minutes_ago)} min ago)`)
        if (ticket.close_at) {
          console.log(`      Closed: ${ticket.close_at} (Duration: ${Math.round(ticket.actual_duration_minutes || 0)} min)`)
        }
        console.log(`      Calculated duration: ${ticket.duration_hours}h`)
        console.log('')
      })
    } else {
      console.log('   📭 No recent tickets found')
    }

  } catch (error) {
    console.error('❌ Error analyzing recent tickets:', error.message)
  }
}

async function runAllTests() {
  console.log('🚀 Starting monitoring queries test...\n')

  await testTimeZoneAnalysis()
  await testIntervalQueries()
  await testSpecificTickets()

  console.log('\n✅ Test completed!')
  console.log('\n💡 Key points to check:')
  console.log('   1. Are DB and JS times in sync?')
  console.log('   2. Do INTERVAL calculations match expectations?')
  console.log('   3. Are ticket timestamps in expected timezone?')
  console.log('   4. Does duration calculation look correct?')
}

// Export functions for individual testing
module.exports = {
  testTimeZoneAnalysis,
  testIntervalQueries,
  testSpecificTickets,
  runAllTests
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch(console.error)
}