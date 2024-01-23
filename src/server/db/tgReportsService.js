const fs = require('fs')
const { create } = require('pdf-creator-node')
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


async function createReportPDF(data, period, chatId) {
  try {
    const REPORTS_CATALOG = process.env.REPORTS_CATALOG || 'reports/'
    const groups_filter = await getGroupsFilter(chatId)
    const groups = await execPgQuery(`SELECT * FROM groups WHERE active`, [], false, true)
    let groupName = ''
    let total = 0
    let quantityOfNew = 0
    const content = []

    for (const dataString of data) {
      if (groups_filter.length > 0 && !groups_filter.includes(dataString.group_id.toString())) continue
      total += Number(dataString.quantity) || 0
    }

    content.push(
      { text: `Звіт за період: ${moment(period.start).format('DD-MM-YYYY')} - ${moment(period.end).format('DD-MM-YYYY')}`, style: 'header', fontSize: '18px' },
      { text: `Кількість заявок: ${total}`, style: 'subheader', fontSize: '16px' },
      { text: `Обрані групи: ${groups_filter.join(', ')}`, style: 'subheader', fontSize: '18px' },
      { text: 'Заявки:', style: 'header' },
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
        const groupText = `Група: ${groupName}[${entry.group_id}] - Статус: ${statusName}: ${quantity}`
        content.push({ text: groupText, style: 'defaultStyle', fontSize: '14px' })
      }
    }

    const document = {
      html: createHtmlContent(content),
      path: `${REPORTS_CATALOG}${chatId}.pdf`,
      footer: {
        height: '14mm',
        contents: {
          default: '<span style="color: #444;">{{page}}</span>/<span>{{pages}}</span>',
        },
      },
      paperSize: {
        format: 'A4',
        orientation: 'portrait',
      },
      encoding: "utf-8",
    }

    await create(document)
    return true
  } catch (error) {
    console.error('Error in function createReportPDF:', error)
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
  htmlContent += '@font-face { font-family: "Roboto Regular"; src: url("/src/server/db/fonts/Roboto/Roboto-Regular.ttf") format("truetype"); }'
  htmlContent += '@font-face { font-family: "Roboto Bold"; src: url("/src/server/db/fonts/Roboto/Roboto-Bold.ttf") format("truetype"); }'
  htmlContent += 'body { font-family: "Roboto Regular", Arial, sans-serif; }'
  htmlContent += '</style>'
  htmlContent += '</head><body style="margin: 20px;">'

  for (const item of content) {
    if (item.ul) {
      htmlContent += '<ul>'
      for (const listItem of item.ul) {
        htmlContent += `<li>${listItem}</li>`
      }
      htmlContent += '</ul>'
    } else {
      const fontWeight = item.fontWeight || 'normal';
      const fontSize = item.fontSize || '18px';
      const fontFamily = fontWeight === 'bold' ? 'Roboto Bold' : 'Roboto Regular';

      htmlContent += `<p style="font-weight: ${fontWeight}; font-size: ${fontSize}; font-family: ${fontFamily}">${item.text}</p>`
    }
  }

  htmlContent += '</body></html>'
  return htmlContent;
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
    await createReportPDF(data, period, msg.chat.id)
    const REPORTS_CATALOG = process.env.REPORTS_CATALOG || 'reports/'
    const filePath = `${REPORTS_CATALOG}${msg.chat.id}.pdf`
    if (fs.existsSync(filePath)) {
      await bot.sendDocument(msg.chat.id, fs.readFileSync(filePath)).catch(function (error) { сonsole.log('sending') })
    } else {
      console.log(`File not found: ${filePath}`)
    }

    return data
  } catch (error) {
    console.error('Error in function createReport:', error)
    return null
  }
}
