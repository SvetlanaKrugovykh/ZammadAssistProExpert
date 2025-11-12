/**
 * Quick test to check the data types of timestamp fields in tickets table
 */

const { execPgQuery } = require('../db/common')

async function checkTicketsSchema() {
  console.log('🔍 Checking tickets table schema...\n')
  
  try {
    // Check column types in tickets table
    const schemaQuery = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'tickets' 
        AND column_name IN ('created_at', 'close_at', 'updated_at')
      ORDER BY column_name
    `
    
    const schema = await execPgQuery(schemaQuery, [], false, true)
    if (schema && schema.length > 0) {
      console.log('📊 Tickets table timestamp columns:')
      schema.forEach(col => {
        console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`)
      })
    }

    // Check actual timezone behavior with sample data
    const timezoneTestQuery = `
      SELECT 
        id,
        created_at,
        pg_typeof(created_at) as created_at_type,
        created_at AT TIME ZONE 'UTC' as created_at_utc_converted,
        pg_typeof(created_at AT TIME ZONE 'UTC') as created_at_utc_type,
        NOW() as db_now,
        pg_typeof(NOW()) as db_now_type,
        NOW() AT TIME ZONE 'UTC' as db_now_utc,
        pg_typeof(NOW() AT TIME ZONE 'UTC') as db_now_utc_type
      FROM tickets 
      WHERE group_id = 7 
        AND title ILIKE 'Недоступний Інтернет%M%'
      LIMIT 1
    `

    const tzTest = await execPgQuery(timezoneTestQuery, [], false, true)
    if (tzTest && tzTest.length > 0) {
      const t = tzTest[0]
      console.log('\n🕰️  Timezone conversion test:')
      console.log(`   created_at: ${t.created_at} (type: ${t.created_at_type})`)
      console.log(`   created_at AT TIME ZONE 'UTC': ${t.created_at_utc_converted} (type: ${t.created_at_utc_type})`)
      console.log(`   NOW(): ${t.db_now} (type: ${t.db_now_type})`)
      console.log(`   NOW() AT TIME ZONE 'UTC': ${t.db_now_utc} (type: ${t.db_now_utc_type})`)
    }

  } catch (error) {
    console.error('❌ Schema check failed:', error.message)
  }
}

checkTicketsSchema().catch(console.error)