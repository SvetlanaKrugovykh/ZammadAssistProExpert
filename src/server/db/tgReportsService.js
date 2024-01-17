const fs = require('fs')
const PDFDocument = require('pdfkit')
const execPgQuery = require('./common').execPgQuery
const moment = require('moment')
const puppeteer = require('puppeteer')

module.exports.isUsersHaveReportsRole = async function (chatId) {
  try {
    const data = await execPgQuery('SELECT user_id, login FROM roles_users JOIN users ON roles_users.user_id = users.id WHERE users.login = $1 AND role_id=5', [chatId.toString()])
    if (data === null) return null
    return true
  } catch (error) {
    console.error('Error in function isUsersHaveReportsRole:', error)
    return null
  }
}

module.exports.getGroups = async function () {
  try {
    const data = await execPgQuery('SELECT * FROM groups', [], false, true)
    if (data === null) return null
    return data
  } catch (error) {
    console.error('Error in function getGroups:', error)
    return null
  }
}

module.exports.createReport = async function (bot, msg, periodName, otherPeriod = null, groups_filter = []) {
  try {
    let period = {}
    switch (periodName) {
      case 'today':
        period = {
          start: new Date(new Date().setHours(0, 0, 0, 0)),
          end: new Date(new Date().setHours(23, 59, 59, 999))
        }
        break
      case 'last_week':
        period = {
          start: new Date(new Date().setDate(new Date().getDate() - 7)),
          end: new Date()
        }
        break
      case 'last_month':
        period = {
          start: new Date(new Date().setDate(new Date().getDate() - 30)),
          end: new Date()
        }
        break
      case 'last_year':
        period = {
          start: new Date(new Date().setDate(new Date().getDate() - 365)),
          end: new Date()
        }
        break
      case 'any_period':
        period = otherPeriod
        break
      default:
        return null
    }

    const data = await execPgQuery('SELECT group_id, state_id, COUNT(*) as quantity FROM tickets WHERE created_at > $1 AND created_at < $2 AND group_id <> 7 GROUP BY group_id, state_id ORDER BY group_id, state_id;', [period.start, period.end], false, true)
    if (data === null) return null
    await createReportPDF(data, period, groups_filter)
    return data
  } catch (error) {
    console.error('Error in function createReport:', error)
    return null
  }
}

async function createReportPDF(data, period, groups_filter = []) {
  try {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()
    const groups = await execPgQuery('SELECT * FROM groups', [], false, true)
    let groupName = ''

    let total = 0
    for (const dataString of data) {
      total += Number(dataString.quantity) || 0
    }

    let content = `<style>
    body {
      padding-left: 50px; /* Increase the left padding */
    }
  </style>
  <h1>Звіт за період: ${moment(period.start).format('DD-MM-YYYY')} - ${moment(period.end).format('DD-MM-YYYY')}</h1>
  <h2>Кількість заявок: ${total}</h2>
  <h3>Заявки:</h3>
  <ul>
`
    for (const dataString of data) {
      let statusName = ''
      switch (dataString.state_id) {
        case 1:
          statusName = 'Нова'
          break
        case 2:
          statusName = 'Відкрита (В роботі)'
          break
        case 4:
          statusName = 'Закрита'
          break
        default:
          statusName = 'Очікує закриття'
          break
      }
      if (groups_filter.length > 0 && !groups_filter.includes(dataString.group_id)) continue
      const group = groups.find(g => g.id === dataString.group_id)
      if (group) groupName = group.name
      else groupName = dataString.group_id
      content += `<li>Група: ${groupName}[${dataString.group_id}] - ${statusName}: ${dataString.quantity} (${(dataString.quantity * 100 / total).toFixed(2)}%)</li>`
    }

    content += '</ul>'

    await page.setContent(content)
    await page.pdf({ path: '123123.pdf', format: 'A4' })

    await browser.close()
    return true
  } catch (error) {
    console.error('Error in function createReportPDF:', error)
    return null
  }
}