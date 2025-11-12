/**
 * Comprehensive test to understand timezone issues and duration calculations
 * This will help us understand EXACTLY what's happening before making any changes
 */

const { execPgQuery } = require('../db/common')

async function testTimezoneIssues() {
  console.log('🔬 === COMPREHENSIVE TIMEZONE ANALYSIS ===\n')

  try {
    // 1. Test different timestamp functions and their types
    const timestampTestQuery = `
      SELECT 
        'NOW()' as function_name,
        NOW() as time_value,
        pg_typeof(NOW()) as data_type
      UNION ALL
      SELECT 
        'LOCALTIMESTAMP' as function_name,
        LOCALTIMESTAMP as time_value,
        pg_typeof(LOCALTIMESTAMP) as data_type
      UNION ALL
      SELECT 
        'CURRENT_TIMESTAMP' as function_name,
        CURRENT_TIMESTAMP as time_value,
        pg_typeof(CURRENT_TIMESTAMP) as data_type
    `

    const timestampResult = await execPgQuery(timestampTestQuery, [], false, true)
    if (timestampResult) {
      console.log('⏰ Timestamp functions comparison:')
      timestampResult.forEach(row => {
        console.log(`   ${row.function_name}: ${row.time_value} (${row.data_type})`)
      })
      console.log('')
    }

    // 2. Test duration calculations with different approaches
    const durationTestQuery = `
      WITH test_ticket AS (
        SELECT 
          id, title, created_at, close_at, state_id,
          pg_typeof(created_at) as created_at_type
        FROM tickets 
        WHERE group_id = 7 
          AND title ILIKE 'Недоступний Інтернет%M%'
          AND created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC 
        LIMIT 1
      )
      SELECT 
        id, title, created_at, created_at_type,
        
        -- Current approach (might be wrong) - using ::numeric cast
        ((EXTRACT(EPOCH FROM (NOW() - created_at))/3600)::numeric) as duration_now_approach,
        
        -- LOCALTIMESTAMP approach
        ((EXTRACT(EPOCH FROM (LOCALTIMESTAMP - created_at))/3600)::numeric) as duration_localtimestamp_approach,
        
        -- Pure EPOCH approach  
        ((EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM created_at))/3600) as duration_epoch_approach,
        
        -- Show the raw values for debugging
        EXTRACT(EPOCH FROM NOW()) as now_epoch,
        EXTRACT(EPOCH FROM created_at) as created_epoch,
        EXTRACT(EPOCH FROM LOCALTIMESTAMP) as local_epoch,
        
        -- Time differences in seconds
        EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM created_at) as seconds_diff_now,
        EXTRACT(EPOCH FROM LOCALTIMESTAMP) - EXTRACT(EPOCH FROM created_at) as seconds_diff_local
        
      FROM test_ticket
    `

    const durationResult = await execPgQuery(durationTestQuery, [], false, true)
    if (durationResult && durationResult.length > 0) {
      const t = durationResult[0]
      console.log('📊 Duration calculation analysis:')
      console.log(`   Ticket ID: ${t.id}`)
      console.log(`   Created: ${t.created_at} (type: ${t.created_at_type})`)
      console.log(`   Current approach (NOW): ${t.duration_now_approach}h`)
      console.log(`   LOCALTIMESTAMP approach: ${t.duration_localtimestamp_approach}h`)
      console.log(`   Pure EPOCH approach: ${t.duration_epoch_approach}h`)
      console.log(`   Raw epochs: NOW=${t.now_epoch}, LOCAL=${t.local_epoch}, CREATED=${t.created_epoch}`)
      console.log(`   Seconds diff: NOW=${t.seconds_diff_now}s, LOCAL=${t.seconds_diff_local}s`)

      // Convert to minutes for better understanding
      const minutesNow = Math.round(t.seconds_diff_now / 60)
      const minutesLocal = Math.round(t.seconds_diff_local / 60)
      console.log(`   In minutes: NOW=${minutesNow}min, LOCAL=${minutesLocal}min`)

      if (Math.abs(minutesNow - minutesLocal) > 60) {
        console.log(`   ⚠️  WARNING: ${Math.abs(minutesNow - minutesLocal)} minutes difference between approaches!`)
      }
      console.log('')
    }

    // 3. Test actual tickets with 0-duration issue
    const zeroTestQuery = `
      SELECT 
        id, title, created_at, close_at, state_id,
        ((EXTRACT(EPOCH FROM (NOW() - created_at))/3600)::numeric) as current_duration,
        ((EXTRACT(EPOCH FROM (LOCALTIMESTAMP - created_at))/3600)::numeric) as local_duration,
        
        CASE 
          WHEN close_at IS NOT NULL THEN 
            ((EXTRACT(EPOCH FROM close_at) - EXTRACT(EPOCH FROM created_at))/3600)
          ELSE NULL 
        END as actual_outage_duration,
        
        -- Check if this would trigger 0хв issue
        CASE 
          WHEN ((EXTRACT(EPOCH FROM (NOW() - created_at))/3600)::numeric) < 0.1 THEN 'YES'
          ELSE 'NO'
        END as would_show_zero
        
      FROM tickets 
      WHERE group_id = 7 
        AND title ILIKE 'Недоступний Інтернет%M%'
        AND created_at >= NOW() - INTERVAL '6 hours'
        AND state_id = 4  -- Only resolved tickets
      ORDER BY created_at DESC 
      LIMIT 5
    `

    const zeroResult = await execPgQuery(zeroTestQuery, [], false, true)
    if (zeroResult && zeroResult.length > 0) {
      console.log('🎯 Recent resolved tickets analysis (checking for 0хв issue):')
      zeroResult.forEach((ticket, i) => {
        const storeMatch = ticket.title.match(/\\bm(\\d+)\\b/i)
        const store = storeMatch ? storeMatch[1] : 'unknown'

        console.log(`   ${i + 1}. Store ${store} (ID: ${ticket.id})`)
        console.log(`      Created: ${ticket.created_at}`)
        console.log(`      Closed: ${ticket.close_at}`)
        console.log(`      Current duration calc: ${ticket.current_duration}h`)
        console.log(`      Local duration calc: ${ticket.local_duration}h`)
        console.log(`      Actual outage time: ${ticket.actual_outage_duration}h`)
        console.log(`      Would show 0хв?: ${ticket.would_show_zero}`)
        console.log('')
      })
    } else {
      console.log('📭 No recent resolved tickets found for analysis')
    }

  } catch (error) {
    console.error('❌ Timezone analysis failed:', error.message)
  }
}

async function runComprehensiveTest() {
  await testTimezoneIssues()

  console.log('💡 RECOMMENDATIONS based on analysis:')
  console.log('   1. Check which duration calculation gives most realistic results')
  console.log('   2. Look for tickets showing 0хв when they shouldnt')
  console.log('   3. Compare actual outage time vs calculated duration')
  console.log('   4. Decide on NOW() vs LOCALTIMESTAMP vs pure EPOCH approach')
}

if (require.main === module) {
  runComprehensiveTest().catch(console.error)
}

module.exports = { testTimezoneIssues, runComprehensiveTest }