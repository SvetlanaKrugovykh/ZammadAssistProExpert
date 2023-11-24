const execPgQuery = require('./common').execPgQuery
const https = require('https')
const axios = require('axios')
require('dotenv').config()

async function findUserById(ID) {
  try {
    if (typeof ID !== 'string') {
      ID = ID.toString(); // Convert ID to a string if it's not already
    }
    if (!/^\d{1,12}$/.test(ID)) return null
    let data = null
    let cleanedId = ID.replace(/\D/g, '')
    if (cleanedId < -2147483648) {
      console.log(`Error findUserById: ${cleanedId} is belong ti the groupID`)
      return null
    }
    if (ID.length < 7) {
      data = await execPgQuery('SELECT * FROM users WHERE id = $1', [cleanedId])
      console.log(`findUserById: ${data?.id}`)
    } else {
      data = await execPgQuery('SELECT * FROM users WHERE login = $1', [cleanedId])
      console.log(`findUserByLogin: ${data?.login}`)
    }
    if (!data || data.length === 0) return null
    return data
  } catch (error) {
    console.error('Error in findUserById:', error)
    return null
  }
}

async function findOwnerById(owner_id) {
  try {
    if (!/^\d{1,12}$/.test(owner_id)) return null
    let cleanedId = owner_id.replace(/\D/g, '')
    const data = await execPgQuery('SELECT * FROM users WHERE id = $1', [cleanedId])
    return data
  } catch (error) {
    console.error('Error in findUserById:', error)
    return null
  }
}


async function findUserByEmail(email) {
  try {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
    const data = await execPgQuery('SELECT * FROM users WHERE email = $1', [email.toLowerCase()])
    return data
  } catch (error) {
    console.error('Error in findUserById:', error)
    return null
  }
}

async function userVerification(id, verified) {
  const headers = { Authorization: process.env.ZAMMAD_API_TOKEN, "Content-Type": "application/json" }
  const httpsAgent = new https.Agent({ rejectUnauthorized: false })
  const url = `${process.env.ZAMMAD_API_URL}/users`
  const updUserData = {
    "verified": verified,
  }
  try {
    const updResponse = await axios.put(`${url}/${id}`, updUserData, { headers, httpsAgent })
    const updUser = updResponse.data
    console.log(`Update user: ${updUser.id}`)
    return updUser
  } catch (err) {
    console.log(err)
    return null
  }
}

async function createOrUpdateUserIntoDb(chatId, user_info) {
  try {
    const DEBUG_LEVEL = Number(process.env.DEBUG_LEVEL) || 0
    const email_ = user_info.email.toLowerCase()
    const [lastName, firstName] = user_info.PIB.split(' ')
    const headers = { Authorization: process.env.ZAMMAD_API_TOKEN, "Content-Type": "application/json" }

    if (!/^[^\s@]+@(lotok\.in\.ua|ito\.in\.ua)$/.test(email_)) {
      console.log(`Error in createOrUpdateUserIntoDb: email ${email_} is not valid`)
      return 'wrong email'
    }

    const httpsAgent = new https.Agent({ rejectUnauthorized: false })
    const url = `${process.env.ZAMMAD_API_URL}/users`

    let existingUser = await findUserById(chatId)
    if (DEBUG_LEVEL > 0) console.log(`existingUser: ${JSON.stringify(existingUser)}`)
    if (!existingUser) existingUser = await findUserByEmail(email_.replace(/\s+/g, ''))
    if (DEBUG_LEVEL > 0) console.log(`existingUser: ${JSON.stringify(existingUser)}`)
    if (existingUser) {
      const updUserData = {
        "login": chatId,
        "phone": user_info.phoneNumber,
        "firstname": firstName,
        "lastname": lastName,
        "email": email_,
        "verified": false,
        "active": true,
      }
      try {
        const updResponse = await axios.put(`${url}/${existingUser.id}`, updUserData, { headers, httpsAgent })
        const updUser = updResponse.data
        console.log(`Update user: ${updUser.id}`)
        if (DEBUG_LEVEL > 0) console.log(`createUserIntoZammad: ${JSON.stringify(updUser)}`)

        const query = `UPDATE users SET login = $1, phone = $2, firstname = $3, lastname = $4, email = $5, source = $6 WHERE id = ${existingUser.id} RETURNING *`
        const values = [
          chatId,
          user_info.phoneNumber,
          firstName,
          lastName,
          email_,
          user_info?.address
        ]
        const data = await execPgQuery(query, values, true)
        return data
      } catch (err) {
        console.log(err)
        return null
      }
    } else {
      const newUserData = {
        "created_by_id": 1,
        "organization_id": 1,
        "updated_by_id": 1,
        "login": chatId,
        "phone": user_info.phoneNumber,
        "firstname": firstName,
        "lastname": lastName,
        "email": email_,
        "verified": false,
        "active": true,
        "roles": [
          "Customer"
        ]
      }
      try {
        const response = await axios.post(url, newUserData, { headers, httpsAgent })
        const user = response.data
        console.log(`Crete user: ${user.id}`)
        if (DEBUG_LEVEL > 0) console.log(`createUserIntoZammad: ${JSON.stringify(user)}`)
        return user
      } catch (err) {
        console.log(err)
        return null
      }
    }
  } catch (error) {
    console.error('Error of record new user data into the bot-database:', error)
  }
}

module.exports = { findUserById, findOwnerById, createOrUpdateUserIntoDb, userVerification }
