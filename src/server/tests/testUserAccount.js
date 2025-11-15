const { execPgQuery } = require('../db/common')
const { findUserById } = require('../db/tgUsersService')

/**
 * Test to check user account existence and status
 * Usage: node testUserAccount.js [userId]
 * Example: node testUserAccount.js 701079281
 */

async function testUserAccount() {
  try {
    // Get userId from command line arguments or use default
    const userId = process.argv[2] || '701079281'

    console.log(`🔍 Testing user account: ${userId}`)
    console.log('='.repeat(80))

    // 1) Direct database query to check user existence
    console.log('📋 Step 1: Direct database check...')

    // Check by login (for long IDs like Telegram chat IDs)
    const userByLogin = await execPgQuery(
      'SELECT id, login, email, firstname, lastname, active, created_at, updated_at FROM users WHERE login = $1',
      [userId],
      false,
      true
    )

    console.log(`📊 User by login (${userId}):`)
    if (userByLogin && userByLogin.length > 0) {
      userByLogin.forEach((user, index) => {
        console.log(`   ${index + 1}. ID: ${user.id}`)
        console.log(`      Login: ${user.login}`)
        console.log(`      Email: ${user.email}`)
        console.log(`      Name: ${user.firstname} ${user.lastname}`)
        console.log(`      Active: ${user.active}`)
        console.log(`      Created: ${new Date(user.created_at).toLocaleString('uk-UA')}`)
        console.log(`      Updated: ${new Date(user.updated_at).toLocaleString('uk-UA')}`)
        console.log('')
      })
    } else {
      console.log('   ❌ No user found by login')
    }    // Check by ID (for short numeric IDs)
    if (userId.length < 7) {
      const userById = await execPgQuery(
        'SELECT id, login, email, firstname, lastname, active, created_at, updated_at FROM users WHERE id = $1',
        [parseInt(userId)],
        false,
        true
      )

      console.log(`📊 User by ID (${userId}):`)
      if (userById && userById.length > 0) {
        userById.forEach((user, index) => {
          console.log(`   ${index + 1}. ID: ${user.id}`)
          console.log(`      Login: ${user.login}`)
          console.log(`      Email: ${user.email}`)
          console.log(`      Name: ${user.firstname} ${user.lastname}`)
          console.log(`      Active: ${user.active}`)
          console.log('')
        })
      } else {
        console.log('   ❌ No user found by ID')
      }
    }

    console.log('-'.repeat(80))

    // 2) Test using the application's findUserById function
    console.log('📋 Step 2: Testing application findUserById function...')

    try {
      const appUser = await findUserById(userId)
      console.log(`📊 Application findUserById result:`)

      if (appUser && Array.isArray(appUser) && appUser.length > 0) {
        const user = appUser[0]
        console.log(`   ✅ User found:`)
        console.log(`      ID: ${user.id}`)
        console.log(`      Login: ${user.login}`)
        console.log(`      Email: ${user.email}`)
        console.log(`      Name: ${user.firstname} ${user.lastname}`)
        console.log(`      Active: ${user.active}`)
      } else {
        console.log(`   ❌ findUserById returned: ${appUser}`)
        console.log(`   🔍 This explains the "Cannot read properties of null" error`)
      }
    } catch (error) {
      console.log(`   ❌ Error in findUserById: ${error.message}`)
    }

    console.log('-'.repeat(80))

    // 3) Check for similar users (in case of typos)
    console.log('📋 Step 3: Looking for similar users...')

    const similarUsers = await execPgQuery(
      `SELECT id, login, email, firstname, lastname, active 
       FROM users 
       WHERE login LIKE $1 OR email LIKE $2 
       ORDER BY updated_at DESC 
       LIMIT 10`,
      [`%${userId}%`, `%${userId}%`],
      false,
      true
    )

    // Also search by email pattern like 's.kr%go%' 
    const emailPatternUsers = await execPgQuery(
      `SELECT id, login, email, firstname, lastname, active, created_at
       FROM users 
       WHERE email LIKE '%s.kr%go%' OR email LIKE '%krugovykh%'
       ORDER BY updated_at DESC 
       LIMIT 5`,
      [],
      false,
      true
    )

    if (similarUsers && similarUsers.length > 0) {
      console.log(`📊 Found ${similarUsers.length} similar user(s):`)
      similarUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ID: ${user.id} | Login: ${user.login} | Email: ${user.email} | Active: ${user.active}`)
      })
    } else {
      console.log('   ℹ️ No similar users found')
    }

    console.log('='.repeat(80))

    // 4) Recommendations
    console.log('📋 Step 4: Recommendations...')

    if (!userByLogin || userByLogin.length === 0) {
      console.log('🔧 RECOMMENDATION: User account needs to be created')
      console.log('   Options:')
      console.log('   1. Create user manually in Zammad admin panel')
      console.log('   2. Create user via Zammad API')
      console.log('   3. Check if user should have different login/email')
      console.log('')
      console.log('📝 Suggested user data:')
      console.log(`   Login: ${userId}`)
      console.log(`   Email: telegram_${userId}@lotok.in.ua`)
      console.log(`   Firstname: Telegram`)
      console.log(`   Lastname: User`)
      console.log(`   Active: true`)
    } else if (userByLogin[0].active === false) {
      console.log('🔧 RECOMMENDATION: User exists but is inactive')
      console.log('   Need to activate the user account')
    } else {
      console.log('✅ User account exists and is active')
      console.log('   The error might be in the application logic')
    }

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
testUserAccount()