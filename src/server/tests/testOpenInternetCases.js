const { execPgQuery } = require('../db/common')
const { checkStoreInternetStatus, extractStoreNumber } = require('../db/monitoring-notifications')

/**
 * Test to check all open internet cases and their store status
 * Usage: node testOpenInternetCases.js [lookbackDeltaSeconds]
 * Example: node testOpenInternetCases.js 3600  (check last 1 hour)
 * Example: node testOpenInternetCases.js 86400 (check last 24 hours)
 */

async function testOpenInternetCases() {
  try {
    // Get lookbackDeltaSeconds from command line arguments
    const lookbackDeltaSeconds = process.argv[2] ? parseInt(process.argv[2]) : 86400 // Default 24 hours

    console.log(`🔍 Testing open internet cases with lookback: ${lookbackDeltaSeconds} seconds (${Math.round(lookbackDeltaSeconds / 3600)} hours)`)
    console.log('='.repeat(80))

    // 1) Get all open internet cases
    const query = `
      SELECT id, title, created_at, close_at, state_id,
        DATE_TRUNC('day', created_at) as start_of_day_created_at, 
        NOW() as current_time_db, 
        ROUND(((EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM created_at))/3600)::numeric, 1) as duration_hours
      FROM tickets 
      WHERE group_id = $1 
        AND title ILIKE $2
        AND state_id != 4
        AND (
          EXTRACT(EPOCH FROM created_at) >= EXTRACT(EPOCH FROM NOW()) - ${lookbackDeltaSeconds}
        )
      ORDER BY 
        COALESCE(EXTRACT(EPOCH FROM close_at), EXTRACT(EPOCH FROM created_at)) DESC
    `

    console.log('📋 Step 1: Getting all open internet cases...')
    const openCases = await execPgQuery(query, [7, 'Недоступний Інтернет%M%'], false, true)

    if (!openCases || openCases.length === 0) {
      console.log('✅ No open internet cases found in the specified time range')
      return
    }

    console.log(`📊 Found ${openCases.length} open internet case(s):`)
    console.log('-'.repeat(80))

    // Log all open cases
    openCases.forEach((ticket, index) => {
      const storeNumber = extractStoreNumber(ticket.title)
      console.log(`${index + 1}. Ticket ID: ${ticket.id}`)
      console.log(`   Title: ${ticket.title}`)
      console.log(`   Store: ${storeNumber || 'UNKNOWN'}`)
      console.log(`   Created: ${new Date(ticket.created_at).toLocaleString('uk-UA')}`)
      console.log(`   Duration: ${ticket.duration_hours || 0}h`)
      console.log(`   State ID: ${ticket.state_id}`)
      console.log('')
    })

    console.log('='.repeat(80))
    console.log('📋 Step 2: Checking store internet status for each case...')
    console.log('-'.repeat(80))

    // 2) Check status for each store from open cases
    for (let i = 0; i < openCases.length; i++) {
      const ticket = openCases[i]
      const storeNumber = extractStoreNumber(ticket.title)

      if (!storeNumber) {
        console.log(`❌ Case ${i + 1}: Cannot extract store number from "${ticket.title}"`)
        continue
      }

      console.log(`🔍 Case ${i + 1}: Checking status for store ${storeNumber}...`)

      try {
        const status = await checkStoreInternetStatus(storeNumber, lookbackDeltaSeconds)

        console.log(`📊 Store ${storeNumber} status result:`)
        console.log(`   Status: ${status.status}`)
        console.log(`   Message: ${status.message}`)
        console.log(`   Last Update: ${status.lastUpdate ? new Date(status.lastUpdate).toLocaleString('uk-UA') : 'N/A'}`)
        console.log(`   Ticket ID: ${status.ticketId || 'N/A'}`)

        // Compare with original ticket
        if (status.ticketId && status.ticketId !== ticket.id) {
          console.log(`⚠️  WARNING: Status check returned different ticket ID (${status.ticketId} vs ${ticket.id})`)
        }

        if (status.status === 'online' && ticket.state_id !== 4) {
          console.log(`⚠️  WARNING: Store shows online but ticket ${ticket.id} is still open (state: ${ticket.state_id})`)
        }

      } catch (error) {
        console.log(`❌ Error checking store ${storeNumber}: ${error.message}`)
      }

      console.log('')
    }

    console.log('='.repeat(80))
    console.log('✅ Test completed')

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error(error.stack)
  } finally {
    // Exit the process
    process.exit(0)
  }
}

// Run the test
testOpenInternetCases()