/**
 * Quick test to verify UTC timezone fix
 * Run this to check if duration calculations are now correct
 */

const { execPgQuery } = require('../db/common')

async function testUTCFix() {
  console.log('🧪 Testing UTC timezone fix...\n')

  try {
    // Compare old vs new timezone calculations
    const testQuery = `
      SELECT 
        'OLD_WAY' as method,
        NOW() as db_now_local,
        ROUND((EXTRACT(EPOCH FROM (NOW() - NOW() - INTERVAL '1 hour'))/3600)::numeric, 1) as duration_old
      UNION ALL
      SELECT 
        'NEW_UTC' as method,
        NOW() AT TIME ZONE 'UTC' as db_now_utc,
        ROUND((EXTRACT(EPOCH FROM (NOW() AT TIME ZONE 'UTC' - (NOW() AT TIME ZONE 'UTC' - INTERVAL '1 hour')))/3600)::numeric, 1) as duration_new
    `

    const result = await execPgQuery(testQuery, [], false, true)
    if (result) {
      console.log('⏰ Time calculation comparison:')
      result.forEach(row => {
        console.log(\`   \${row.method}: DB Time = \${row.db_now_local || row.db_now_utc}, Duration = \${row.duration_old || row.duration_new}h\`)
      })
    }

    // Test actual recent tickets with UTC
    const recentQuery = \`
      SELECT 
        id, title, created_at, 
        NOW() as db_now_local,
        NOW() AT TIME ZONE 'UTC' as db_now_utc,
        ROUND((EXTRACT(EPOCH FROM (NOW() - created_at))/3600)::numeric, 1) as duration_old_way,
        ROUND((EXTRACT(EPOCH FROM (NOW() AT TIME ZONE 'UTC' - created_at AT TIME ZONE 'UTC'))/3600)::numeric, 1) as duration_utc_way
      FROM tickets 
      WHERE group_id = 7 
        AND title ILIKE 'Недоступний Інтернет%M%'
        AND created_at >= NOW() - INTERVAL '6 hours'
      ORDER BY created_at DESC 
      LIMIT 3
    \`

    const tickets = await execPgQuery(recentQuery, [], false, true)
    if (tickets && tickets.length > 0) {
      console.log('\\n📋 Recent tickets duration comparison:')
      tickets.forEach((ticket, i) => {
        const storeMatch = ticket.title.match(/\\bm(\\d+)\\b/i)
        const store = storeMatch ? storeMatch[1] : 'unknown'
        
        console.log(\`   \${i+1}. Store \${store} (ID: \${ticket.id})\`)
        console.log(\`      Created: \${ticket.created_at}\`)
        console.log(\`      OLD duration: \${ticket.duration_old_way}h\`)
        console.log(\`      NEW duration: \${ticket.duration_utc_way}h\`)
        console.log(\`      Difference: \${(ticket.duration_utc_way - ticket.duration_old_way).toFixed(1)}h\`)
        console.log('')
      })
    } else {
      console.log('\\n📭 No recent tickets found for comparison')
    }

  } catch (error) {
    console.error('❌ UTC test failed:', error.message)
  }
}

// Run the test
testUTCFix().catch(console.error)