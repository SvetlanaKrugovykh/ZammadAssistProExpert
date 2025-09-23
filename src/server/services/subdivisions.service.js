const axios = require('axios')
const https = require('https')
const fs = require('fs')
const { execPgQuery } = require('../db/common')
require('dotenv').config()

module.exports.UpdateSubdivisions = async function (body) {
  try {
    const { subdivisions_array } = body
    for (const subdivision of subdivisions_array) {
      console.log(subdivision);
      const data = await execPgQuery(`SELECT * FROM subdivisions WHERE id=$1 LIMIT 1`, [subdivision.id], false)
      let query = '', values = []
      if (data?.id) {
        query = `UPDATE subdivisions SET id=$1, subdivision_name=$2 WHERE id=$1`
        values = [subdivision.id, subdivision.subdivision_name]
      } else {
        query = `INSERT INTO subdivisions(id, subdivision_name) VALUES($1, $2)`
        values = [subdivision.id, subdivision.subdivision_name]
      }
      await execPgQuery(query, values, true)
    }
    return true
  } catch (error) {
    console.error('Error executing commands:', error.message)
    return false
  }
}

module.exports.AssignSubdivisions = async function (body) {
  try {
    const { users_array } = body
    for (const user_ of users_array) {
      console.log(user_);
      const data = await execPgQuery(`SELECT * FROM users WHERE active=true AND id=$1 LIMIT 1`, [user_.id], false)
      let query = '', values = []
      if (data?.id) {
        query = `UPDATE users SET id=$1, departments=$2 WHERE id=$1`
        values = [user_.id, user_.subdivision_id]
      } else {
        console.log('User not found', user_);
      }
      await execPgQuery(query, values, true)
    }
    return true
  } catch (error) {
    console.error('Error executing commands:', error.message)
    return false
  }
}
