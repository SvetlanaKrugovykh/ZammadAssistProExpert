const axios = require('axios')
require('dotenv').config()

/**
 * Script to create or fix user account via Zammad API
 * Usage: node fixUserAccount.js [userId] [email] [firstname] [lastname]
 * Example: node fixUserAccount.js 701079281 telegram_701079281@lotok.in.ua Telegram User
 */

async function fixUserAccount() {
  try {
    // Get parameters from command line
    const userId = process.argv[2] || '701079281'
    const email = process.argv[3] || `telegram_${userId}@lotok.in.ua`
    const firstname = process.argv[4] || 'Telegram'
    const lastname = process.argv[5] || 'User'
    
    console.log(`🔧 Fixing user account via Zammad API...`)
    console.log(`   User ID: ${userId}`)
    console.log(`   Email: ${email}`)
    console.log(`   Name: ${firstname} ${lastname}`)
    console.log('='.repeat(80))

    const apiUrl = process.env.ZAMMAD_API_URL
    const apiToken = process.env.ZAMMAD_API_TOKEN
    
    if (!apiUrl || !apiToken) {
      throw new Error('ZAMMAD_API_URL or ZAMMAD_API_TOKEN not configured in .env')
    }

    const headers = {
      'Authorization': apiToken,
      'Content-Type': 'application/json'
    }

    // 1) Check if user already exists
    console.log('📋 Step 1: Checking if user exists...')
    
    try {
      const searchResponse = await axios.get(`${apiUrl}/users/search`, {
        headers,
        params: { query: userId }
      })
      
      if (searchResponse.data && searchResponse.data.length > 0) {
        console.log(`📊 Found ${searchResponse.data.length} existing user(s):`)
        searchResponse.data.forEach((user, index) => {
          console.log(`   ${index + 1}. ID: ${user.id} | Login: ${user.login} | Email: ${user.email} | Active: ${user.active}`)
        })
        
        // Check if exact match exists
        const exactMatch = searchResponse.data.find(u => u.login === userId)
        if (exactMatch) {
          console.log(`✅ Exact match found for login ${userId}`)
          
          if (!exactMatch.active) {
            console.log('🔧 User exists but is inactive, activating...')
            
            const updateResponse = await axios.put(`${apiUrl}/users/${exactMatch.id}`, {
              active: true
            }, { headers })
            
            if (updateResponse.status === 200) {
              console.log('✅ User successfully activated')
            } else {
              console.log('❌ Failed to activate user')
            }
          } else {
            console.log('✅ User is already active')
          }
          
          console.log('✅ Fix completed - user should work now')
          return
        }
      } else {
        console.log('ℹ️ No existing users found')
      }
    } catch (searchError) {
      console.log(`⚠️ Search failed: ${searchError.message}`)
      console.log('Proceeding to create new user...')
    }

    console.log('-'.repeat(80))

    // 2) Create new user
    console.log('📋 Step 2: Creating new user...')
    
    const newUserData = {
      login: userId,
      email: email,
      firstname: firstname,
      lastname: lastname,
      active: true,
      verified: true,
      roles: ['Customer'] // Default role for customers
    }

    console.log('📝 Creating user with data:')
    console.log(JSON.stringify(newUserData, null, 2))

    try {
      const createResponse = await axios.post(`${apiUrl}/users`, newUserData, { headers })
      
      if (createResponse.status === 201) {
        const createdUser = createResponse.data
        console.log('✅ User successfully created:')
        console.log(`   ID: ${createdUser.id}`)
        console.log(`   Login: ${createdUser.login}`)  
        console.log(`   Email: ${createdUser.email}`)
        console.log(`   Name: ${createdUser.firstname} ${createdUser.lastname}`)
        console.log(`   Active: ${createdUser.active}`)
        console.log('')
        console.log('✅ User account is now ready for ticket creation')
      } else {
        console.log(`❌ Unexpected response status: ${createResponse.status}`)
        console.log(createResponse.data)
      }
    } catch (createError) {
      console.error('❌ Failed to create user:')
      
      if (createError.response) {
        console.error(`   Status: ${createError.response.status}`)
        console.error(`   Error: ${JSON.stringify(createError.response.data, null, 2)}`)
        
        if (createError.response.status === 422) {
          console.log('')
          console.log('💡 Possible reasons:')
          console.log('   - Email already exists')
          console.log('   - Login already exists')
          console.log('   - Invalid email format')
          console.log('   - Missing required fields')
        }
      } else {
        console.error(`   Error: ${createError.message}`)
      }
      
      throw createError
    }

    console.log('='.repeat(80))
    console.log('✅ Fix completed successfully')
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message)
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2))
    }
  } finally {
    process.exit(0)
  }
}

// Run the fix
fixUserAccount()