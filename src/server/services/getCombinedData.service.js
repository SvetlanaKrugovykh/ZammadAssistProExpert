const { globalBuffer } = require('../globalBuffer')
const { execPgQuery } = require('../db/common')

module.exports.getCombinedData = async function (chatId, modifiedSubdivisions, selectedSubdivisions, action = '') {
  let data = []
  let data_shops = []
  if (!globalBuffer[chatId]?.selectedCustomers) globalBuffer[chatId].selectedCustomers = []

  if (!globalBuffer[chatId]?.selectionSubdivisionFlag) {
    data = await execPgQuery(`SELECT * FROM users WHERE active=true AND departments = ANY($1)`, [modifiedSubdivisions], false, true) || []
    if (selectedSubdivisions.includes("63_28"))
      data_shops = await execPgQuery(`SELECT * FROM users WHERE active=true AND email LIKE $1`, ['lotok%.uprav@lotok.in.ua'], false, true)
  }

  if (action === 'selection') {
    globalBuffer[chatId].selectionSubdivisionFlag = true
  }

  let combinedData = data.concat(data_shops)
  let addedCustomers = []

  if (action === 'finalize') {
    if (!globalBuffer[chatId]?.selectionFlag) {
      for (const subDivCustomer of combinedData) {
        globalBuffer[chatId]?.selectedCustomers.push(`73_${subDivCustomer.id}`)
      }
    }
    if (Array.isArray(globalBuffer[chatId]?.selectedCustomers) && globalBuffer[chatId]?.selectedCustomers.length > 0) {
      const addedCustomersIds = globalBuffer[chatId].selectedCustomers.map(customer => customer.replace('73_', ''))
      addedCustomers = await execPgQuery(`SELECT * FROM users WHERE active=true AND id = ANY($1)`, [addedCustomersIds], false, true) || []
    }
    combinedData = combinedData.concat(addedCustomers)
  }

  combinedData = Array.from(new Set(combinedData.map(JSON.stringify))).map(JSON.parse)
  combinedData.sort((a, b) => a.firstname > b.firstname ? 1 : -1)

  return combinedData
}