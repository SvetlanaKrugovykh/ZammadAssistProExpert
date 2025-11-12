const { execPgQuery } = require('../db/common')

/**
 * Test checkStoreInternetStatus query with timezone-safe EPOCH approach
 * This test verifies that the query works correctly with mixed timestamp types:
 * - created_at: timestamp without time zone
 * - close_at: timestamp with time zone (on PROD)
 */
async function testCheckStoreStatusQuery() {
  console.log('🧪 Testing checkStoreInternetStatus query...')
  
  try {
    const lookbackDeltaSeconds = 3600 // 1 hour
    const storeNumber = '001' // Test with store 001
    
    const query = `
      SELECT id, title, created_at, close_at, state_id,
        DATE_TRUNC('day', created_at) as start_of_day_created_at, 
        NOW() as current_time_db, 
        ROUND(((EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM created_at))/3600)::numeric, 1) as duration_hours,
        -- Additional debug fields for timezone analysis
        pg_typeof(created_at) as created_at_type,
        pg_typeof(close_at) as close_at_type,
        EXTRACT(EPOCH FROM created_at) as created_at_epoch,
        EXTRACT(EPOCH FROM close_at) as close_at_epoch,
        EXTRACT(EPOCH FROM NOW()) as now_epoch,
        COALESCE(EXTRACT(EPOCH FROM close_at), EXTRACT(EPOCH FROM created_at)) as order_by_value
      FROM tickets 
      WHERE group_id = $1 
        AND title ILIKE $2
        AND title ILIKE $3
        AND (
          EXTRACT(EPOCH FROM created_at) >= EXTRACT(EPOCH FROM NOW()) - ${lookbackDeltaSeconds}
          OR (close_at IS NOT NULL 
              AND EXTRACT(EPOCH FROM close_at) >= EXTRACT(EPOCH FROM NOW()) - ${lookbackDeltaSeconds} 
              AND state_id = 4)
        )
      ORDER BY 
        COALESCE(EXTRACT(EPOCH FROM close_at), EXTRACT(EPOCH FROM created_at)) DESC 
      LIMIT 3
    `

    const result = await execPgQuery(query, [
      7, // group_id for internet tickets
      'Недоступний Інтернет%M%',
      `%M${storeNumber}%`
    ], false, true)

    console.log(`\n📊 Query results for store ${storeNumber}:`)
    
    if (!result || result.length === 0) {
      console.log('   ℹ️  No tickets found for this store in the last hour')
      return
    }

    result.forEach((ticket, index) => {
      console.log(`\n🎫 Ticket ${index + 1}:`)
      console.log(`   ID: ${ticket.id}`)
      console.log(`   Title: ${ticket.title}`)
      console.log(`   State: ${ticket.state_id}`)
      console.log(`   Created At: ${ticket.created_at} (type: ${ticket.created_at_type})`)
      console.log(`   Close At: ${ticket.close_at || 'NULL'} (type: ${ticket.close_at_type})`)
      console.log(`   Duration Hours: ${ticket.duration_hours}`)
      console.log(`   Current DB Time: ${ticket.current_time_db}`)
      console.log(`   Created At EPOCH: ${ticket.created_at_epoch}`)
      console.log(`   Close At EPOCH: ${ticket.close_at_epoch || 'NULL'}`)
      console.log(`   NOW() EPOCH: ${ticket.now_epoch}`)
      console.log(`   ORDER BY Value: ${ticket.order_by_value}`)
      
      // Check if duration calculation looks correct
      const expectedDurationHours = (ticket.now_epoch - ticket.created_at_epoch) / 3600
      const calculatedDuration = ticket.duration_hours
      const durationDiff = Math.abs(expectedDurationHours - calculatedDuration)
      
      if (durationDiff > 0.1) {
        console.log(`   ⚠️  POTENTIAL ISSUE: Expected duration ${expectedDurationHours.toFixed(1)}h, got ${calculatedDuration}h`)
      } else {
        console.log(`   ✅ Duration calculation looks correct`)
      }
    })

    console.log(`\n🔍 Analysis:`)
    console.log(`   - Found ${result.length} tickets`)
    console.log(`   - Lookback period: ${lookbackDeltaSeconds} seconds (${lookbackDeltaSeconds/3600} hours)`)
    console.log(`   - Query uses EPOCH approach for timezone-safe calculations`)
    console.log(`   - ORDER BY uses COALESCE with EPOCH values to avoid timestamp type mixing`)

  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`)
    console.error('Stack trace:', error.stack)
  }
}

/**
 * Test comparison between old approach and new EPOCH approach
 */
async function testTimezoneComparison() {
  console.log('\n🔄 Testing timezone calculation comparison...')
  
  try {
    const query = `
      SELECT 
        id, 
        created_at,
        close_at,
        pg_typeof(created_at) as created_at_type,
        pg_typeof(close_at) as close_at_type,
        -- Old approach (potentially problematic)
        ROUND(((NOW() - created_at) * 24)::numeric, 2) as old_duration_hours,
        -- New EPOCH approach (timezone-safe)
        ROUND(((EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM created_at))/3600)::numeric, 2) as new_duration_hours,
        -- Difference between approaches
        ROUND((((EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM created_at))/3600) - ((NOW() - created_at) * 24))::numeric, 2) as duration_diff
      FROM tickets 
      WHERE group_id = 7 
        AND title ILIKE 'Недоступний Інтернет%M%'
        AND created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 5
    `

    const result = await execPgQuery(query, [], false, true)

    console.log('\n📊 Timezone calculation comparison:')
    
    if (!result || result.length === 0) {
      console.log('   ℹ️  No recent tickets found for comparison')
      return
    }

    result.forEach((ticket, index) => {
      console.log(`\n🎫 Ticket ${index + 1} (ID: ${ticket.id}):`)
      console.log(`   Created At: ${ticket.created_at} (${ticket.created_at_type})`)
      console.log(`   Close At: ${ticket.close_at || 'NULL'} (${ticket.close_at_type})`)
      console.log(`   Old Duration: ${ticket.old_duration_hours}h`)
      console.log(`   New Duration: ${ticket.new_duration_hours}h`)
      console.log(`   Difference: ${ticket.duration_diff}h`)
      
      if (Math.abs(ticket.duration_diff) > 0.1) {
        console.log(`   ⚠️  SIGNIFICANT DIFFERENCE DETECTED!`)
      } else {
        console.log(`   ✅ Both methods give similar results`)
      }
    })

  } catch (error) {
    console.error(`❌ Comparison test failed: ${error.message}`)
  }
}

// Run the tests
async function runAllTests() {
  console.log('🚀 Starting checkStoreInternetStatus tests...\n')
  
  await testCheckStoreStatusQuery()
  await testTimezoneComparison()
  
  console.log('\n✨ All tests completed!')
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch(console.error)
}

module.exports = {
  testCheckStoreStatusQuery,
  testTimezoneComparison,
  runAllTests
}