const fs = require('fs')
const util = require('util')
const execPgQuery = require('./common').execPgQuery
const moment = require('moment')
const globalBuffer = require('../globalBuffer')

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
    const data = await execPgQuery('SELECT * FROM groups WHERE active', [], false, true)
    if (data === null) return null
    return data
  } catch (error) {
    console.error('Error in function getGroups:', error)
    return null
  }
}

async function getGroupsFilter(chatId) {
  const groups_filter = []
  try {
    for (const groupId of globalBuffer[chatId].selectedGroups) {
      groups_filter.push(groupId.replace('53_', ''))
    }
    return [...new Set(groups_filter)]
  } catch (error) {
    console.error('Error in function getGroupsFilter:', error)
    return null
  }
}


async function createReportHtml(data, period, chatId) {
  try {
    const REPORTS_CATALOG = process.env.REPORTS_CATALOG || 'reports/'
    const groups_filter = await getGroupsFilter(chatId)
    const groups = await execPgQuery(`SELECT * FROM groups WHERE active`, [], false, true)
    let groupName = ''
    let total = 0
    let quantityOfNew = 0
    let groupsNames = ''
    const content = []

    for (const entry of data) {
      if (groups_filter.length > 0 && !groups_filter.includes(entry.group_id.toString())) continue
      total += Number(entry.quantity) || 0
    }

    for (const group_id of groups_filter) {
      const group = groups.find(g => g.id === Number(group_id))
      groupName = group ? group.name : group_id
      groupsNames += `${groupName}[${group_id}], `
    }
    if (groupsNames.endsWith(', ')) groupsNames = groupsNames.slice(0, -2)


    content.push(
      { text: `Звіт за період: ${moment(period.start).format('DD-MM-YYYY')} - ${moment(period.end).format('DD-MM-YYYY')}`, style: 'header', fontSize: '18px' },
      { text: `Кількість заявок: ${total}`, style: 'subheader', fontSize: '16px' },
      { text: `Обрані групи: ${groupsNames}`, style: 'subheader', fontSize: '18px' },
      { text: 'Заявки:', style: 'regular', fontSize: '14px}' }
    )

    for (const entry of data) {
      if (groups_filter.length > 0 && !groups_filter.includes(entry.group_id.toString())) continue
      const statusName = getStatusName(entry.state_id)
      const group = groups.find(g => g.id === entry.group_id)
      groupName = group ? group.name : entry.group_id

      if (entry.state_id === 1) {
        quantityOfNew = Number(entry.quantity)
      } else {
        const quantity = (Number(entry.quantity) || 0) + quantityOfNew
        quantityOfNew = 0
        const groupText = `⏺ Група: ${groupName}[${entry.group_id}] - Статус: ${statusName}: ${quantity}`
        content.push({ text: groupText, style: 'defaultStyle', fontSize: '14px' })
      }
    }

    const htmlContent = createHtmlContent(content)
    await writeHtmlToFile(htmlContent, `${REPORTS_CATALOG}${chatId}.html`)
    return true
  } catch (error) {
    console.error('Error in function createReportHtml:', error)
    return null
  }
}

function getStatusName(stateId) {
  switch (stateId) {
    case 1:
    case 2:
      return 'Відкрита (В роботі)'
    case 4:
      return 'Закрита'
    default:
      return 'Очікує закриття'
  }
}

function createHtmlContent(content) {
  let htmlContent = '<html><head>'
  htmlContent += '<style>'
  htmlContent += '@font-face { font-family: "Roboto"; src: url("/src/server/db/fonts/Roboto/Roboto-Regular.ttf") format("truetype"); }'
  htmlContent += 'body { font-family: "Roboto", Arial, sans-serif; margin: 20px; }'
  htmlContent += 'h1 { font-weight: bold; font-size: 18px; text-align: center; }'
  htmlContent += 'h2 { font-weight: bold; font-size: 16px; }'
  htmlContent += 'p { font-size: 14px; }'
  htmlContent += 'ul { list-style-type: none; padding-left: 0; }'
  htmlContent += 'ul li { font-weight: normal; }'
  htmlContent += '</style>'
  htmlContent += '</head><body>'

  for (const item of content) {
    if (item.ul) {
      htmlContent += '<ul>';
      for (const listItem of item.ul) {
        htmlContent += `<li>${listItem}</li>`
      }
      htmlContent += '</ul>'
    } else {
      const elementTag = item.style === 'header' ? 'h1' : 'h2'
      htmlContent += `<${elementTag}>${item.text}</${elementTag}>`
    }
  }

  htmlContent += '</body></html>'
  return htmlContent
}

async function writeHtmlToFile(htmlContent, filePath) {
  try {
    await util.promisify(fs.writeFile)(filePath, htmlContent, 'utf-8')
    console.log(`HTML successfully written to ${filePath}`)
  } catch (error) {
    console.error('Error writing HTML to file:', error)
  }
}

module.exports.createReport = async function (bot, msg) {
  try {
    const periodName = globalBuffer[msg.chat.id].selectedPeriod.periodName
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
        period = globalBuffer[msg.chat.id].selectedPeriod
        break
      default:
        return null
    }

    const data = await execPgQuery('SELECT group_id, state_id, COUNT(*) as quantity FROM tickets WHERE created_at > $1 AND created_at < $2 AND state_id <> 7 GROUP BY group_id, state_id ORDER BY group_id, state_id;', [period.start, period.end], false, true)
    if (data === null) {
      await bot.sendMessage(msg.chat.id, 'Намає даних для формування звіту за обраний період')
      return null
    }
    await createReportHtml(data, period, msg.chat.id)
    const REPORTS_CATALOG = process.env.REPORTS_CATALOG || 'reports/'
    const filePath = `${REPORTS_CATALOG}${chatId}.html`
    if (fs.existsSync(filePath)) {
      try {
        await bot.sendDocument(msg.chat.id, fs.createReadStream(filePath), {
          caption: `Звіт за період: ${moment(period.start).format('DD-MM-YYYY')} - ${moment(period.end).format('DD-MM-YYYY')}`,
          contentType: 'application/octet-stream',
        })
      } catch (error) {
        console.error('Error sending document:', error);
      }
    } else {
      console.log(`File not found: ${filePath}`)
    }

    return data
  } catch (error) {
    console.error('Error in function createReport:', error)
    return null
  }
}
