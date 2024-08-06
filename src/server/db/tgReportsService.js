const fs = require('fs')
const util = require('util')
const execPgQuery = require('./common').execPgQuery
const moment = require('moment')
const { globalBuffer } = require('../globalBuffer')
const { _dayStart, _dayEnd } = require('../services/various')
const { sklepy } = require('../data/sklepy')

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
  let groups_filter = []
  try {
    for (const groupId of globalBuffer[chatId].selectedGroups) {
      groups_filter.push(groupId.replace('53_', ''))
    }
    groups_filter.sort((a, b) => a - b)
    return [...new Set(groups_filter)]
  } catch (error) {
    console.error('Error in function getGroupsFilter:', error)
    return null
  }
}

async function createNetReportHtml(bot, chatId, data, period, dayOrWeek) {
  try {
    const REPORTS_CATALOG = process.env.REPORTS_CATALOG || 'reports/'
    const content = []
    content.push(
      { text: `Звіт за період: ${moment(period.start).format('DD-MM-YYYY')} - ${moment(period.end).format('DD-MM-YYYY')}`, style: 'header', fontSize: '18px' },
    )

    content.push({
      text: `
      <table>
        <tr>
          <th>№ ТП</th>
          <th>Адреса</th>
          <th>${dayOrWeek === 'week' ? 'Тиждень' : 'Дата'}</th>
          <th>Недоступність в годиннах на ${dayOrWeek === 'week' ? 'тиждень' : 'дату'}</th>
        </tr>
    `, style: 'defaultStyle', fontSize: '14px'
    });

    data.forEach(item => {
      let address = 'Address not found';

      if (Array.isArray(sklepy)) {
        const sklepItem = sklepy.find(sklep => sklep.sklep === item.title);
        if (sklepItem) {
          address = sklepItem.adress;
        }
      }

      const startDate = moment(item.start_of_close_at);
      const endDate = dayOrWeek === 'week' ? startDate.clone().endOf('week').format('DD-MM-YYYY') : '';

      content.push({
        text: `
        <tr>
          <td>${item.title}</td>
          <td>${address}</td>
          <td>${dayOrWeek === 'week' ? `${startDate.format('DD-MM-YYYY')} - ${endDate}` : startDate.format('DD-MM-YYYY')}</td>
          <td>${Number(item.total_interval).toFixed(1)}</td>
        </tr>
      `, style: 'defaultStyle', fontSize: '14px'
      });
    });

    content.push({ text: '</table>', style: 'defaultStyle', fontSize: '14px' });

    const htmlContent = createHtmlContent(content)
    await writeHtmlToFile(htmlContent, `${REPORTS_CATALOG}${chatId}.html`)
    return true
  } catch (error) {
    console.error('Error in function createNetReportHtml:', error)
    return null
  }
}

async function createReportHtml(bot, chatId, data, period) {
  try {
    const REPORTS_CATALOG = process.env.REPORTS_CATALOG || 'reports/'
    const groups_filter = await getGroupsFilter(chatId)
    const groups = await execPgQuery(`SELECT * FROM groups WHERE active`, [], false, true)
    let groupName = ''
    const total = {}
    let overallTotal = 0
    let quantityOfNew = 0
    let groupsNames = ''
    const content = []
    const statuses = ['Відкрита (В роботі)', 'Закрита', 'Очікує закриття']

    for (const entry of data) {
      if (groups_filter.length > 0 && !groups_filter.includes(entry.group_id.toString())) continue
      const groupId = entry.group_id
      const quantity = Number(entry.quantity) || 0
      total[groupId] = (total[groupId] || 0) + quantity
      overallTotal += quantity || 0
    }

    if (overallTotal === 0) {
      if (fs.existsSync(`${REPORTS_CATALOG}${chatId}.html`)) fs.unlinkSync(`${REPORTS_CATALOG}${chatId}.html`)
      await bot.sendMessage(chatId, 'Немає даних для формування звіту за обраний період для обраних груп')
      return null
    }

    for (const group_id of groups_filter) {
      const group = groups.find(g => g.id === Number(group_id))
      groupName = group ? group.name : group_id
      if (total[group_id] === undefined || total[group_id] === 0) {
        groupsNames += `<b>${groupName}</b>[${group_id}] заявок: <b>${0}</b>, `
      } else {
        groupsNames += `<b>${groupName}</b>[${group_id}] заявок: <b>${total[group_id]}</b>, `
      }
    }
    if (groupsNames.endsWith(', ')) groupsNames = groupsNames.slice(0, -2)


    content.push(
      { text: `Звіт за період: ${moment(period.start).format('DD-MM-YYYY')} - ${moment(period.end).format('DD-MM-YYYY')}`, style: 'header', fontSize: '18px' },
      { text: `Кількість заявок всього: <b>${overallTotal.toString()}</b>`, style: 'subheader', fontSize: '16px' },
      { text: `Обрані групи: ${groupsNames}`, style: 'subheader', fontSize: '18px' },
      { text: '<b>Заявки:</b>', style: 'regular', fontSize: '14px}' }
    )

    let dataExists = false
    let accumulatedPercentage = 0

    for (const group_id of groups_filter) {
      if (total[group_id] === 0) continue
      for (const statusName of statuses) {
        const group = groups.find(g => g.id === Number(group_id))
        groupName = group?.name || group_id
        dataExists = false
        accumulatedPercentage = 0
        for (const entry of data) {
          if (entry.group_id.toString() !== group_id) continue
          const statusName_ = getStatusName(entry.state_id)
          if (statusName_ !== statusName) continue
          if (entry.state_id === 1) {
            quantityOfNew = Number(entry.quantity)
          } else {
            const quantity = (Number(entry.quantity) || 0) + quantityOfNew
            quantityOfNew = 0
            let percentage = ((quantity / total[group_id]) * 100).toFixed(2)
            accumulatedPercentage += Number(percentage)
            if (Math.abs(100 - accumulatedPercentage) < 0.2) percentage = percentage + (100 - accumulatedPercentage)
            const groupText = `⏺ Група: ${groupName}[${entry.group_id}] - Статус: ${statusName_}: <b>${quantity}</b> (${percentage}%)`
            content.push({ text: groupText, style: 'defaultStyle', fontSize: '14px' })
            dataExists = true
          }
        }
        if (!dataExists) {
          const groupText = `⏺ Група: ${groupName}[${group_id}] - Статус: ${statusName}: <b>${0}</b> (${0}%)`
          content.push({ text: groupText, style: 'defaultStyle', fontSize: '14px' })
        }
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
  htmlContent += '<meta charset="utf-8">'
  htmlContent += '<meta name="viewport" content="width=device-width, initial-scale=1">'
  htmlContent += '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap">'
  htmlContent += '<style>'
  htmlContent += '@font-face { font-family: "Roboto"; src: url("/src/server/db/fonts/Roboto/Roboto-Regular.ttf") format("truetype"); }'
  htmlContent += 'body { font-family: "Roboto", sans-serif; margin: 20px; margin-left: 10mm; }'
  htmlContent += 'h1 { font-weight: bold; font-size: 18px; text-align: center; }'
  htmlContent += 'h2 { font-weight: normal; font-size: 16px; }'
  htmlContent += 'p { font-size: 14px; }'
  htmlContent += 'ul { list-style-type: none; padding-left: 0; }'
  htmlContent += 'table { width: 100%; border-collapse: collapse; }'
  htmlContent += 'th, td { border: 1px solid #ddd; padding: 8px; text-align: left; width: 25%; }'
  htmlContent += 'th { background-color: #4CAF50; color: white; }'
  htmlContent += '</style>'
  htmlContent += '</head><body>'

  for (const item of content) {
    if (item.ul) {
      htmlContent += '<ul>';
      for (const listItem of item.ul) {
        htmlContent += `<li>&nbsp&nbsp ${listItem}</li>`
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
    const REPORTS_CATALOG = process.env.REPORTS_CATALOG || 'reports/'
    const filePath = `${REPORTS_CATALOG}${msg.chat.id}.html`

    const period = definePeriod(periodName, msg)
    if (period === null) return 0

    const currentDate = new Date()
    if (period.start > currentDate) period.start = currentDate
    if (period.end > currentDate) period.end = currentDate

    const dayStart = _dayStart(new Date(period.start.getFullYear(), period.start.getMonth(), period.start.getDate(), 0, 0, 0))
    const dayEnd = _dayEnd(new Date(period.end.getFullYear(), period.end.getMonth(), period.end.getDate(), 23, 59, 59, 999))
    console.log('report dayStart:', dayStart)
    console.log('report dayEnd:', dayEnd)
    const dataOpen = await execPgQuery(`SELECT group_id, 2 as state_id, COUNT(*) as quantity FROM tickets WHERE created_at>=$1 AND created_at<$2 AND state_id < 4 GROUP BY group_id ORDER BY group_id;`, [dayStart, dayEnd], false, true) || []
    const dataClose = await execPgQuery(`SELECT group_id, 4 as state_id, COUNT(*) as quantity FROM tickets WHERE created_at>=$1 AND created_at<$2 AND state_id = 4 GROUP BY group_id ORDER BY group_id;`, [dayStart, dayEnd], false, true) || []
    const dataOther = await execPgQuery(`SELECT group_id, 5 as state_id, COUNT(*) as quantity FROM tickets WHERE created_at>=$1 AND created_at<$2 AND state_id > 4  GROUP BY group_id ORDER BY group_id;`, [dayStart, dayEnd], false, true) || []
    const data = [...dataOpen, ...dataClose, ...dataOther]
    data.sort((a, b) => {
      if (a.group_id < b.group_id) return -1
      if (a.group_id > b.group_id) return 1
      if (a.state_id < b.state_id) return -1
      if (a.state_id > b.state_id) return 1
      return 0
    })

    if (data === null) {
      await bot.sendMessage(msg.chat.id, 'Немає даних для формування звіту за обраний період')
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      return null
    }
    await createReportHtml(bot, msg.chat.id, data, period)
    globalBuffer[msg.chat.id] = {}

    if (fs.existsSync(filePath)) {
      try {
        await bot.sendDocument(msg.chat.id, fs.createReadStream(filePath), {
          caption: `Звіт за період: ${moment(period.start).format('DD-MM-YYYY')} - ${moment(period.end).format('DD-MM-YYYY')}`,
          contentType: 'application/octet-stream',
        })
      } catch (error) {
        console.error('Error sending document:', error)
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

function definePeriod(periodName, msg) {
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
      if (period.start > period.end) {
        const start = period.end
        const end = period.start
        period.start = start
        period.end = end
      }
      break
    default:
      return null
  }
  return period
}

function getWeekStartDate(dateString) {
  const date = new Date(dateString);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const weekStartDate = new Date(date.setDate(diff));
  return weekStartDate.toISOString().split('T')[0];
}

module.exports.createNetReport = async function (bot, msg, dayOrWeek) {
  try {
    const periodName = globalBuffer[msg.chat.id].selectedPeriod.periodName
    const REPORTS_CATALOG = process.env.REPORTS_CATALOG || 'reports/'
    const filePath = `${REPORTS_CATALOG}${msg.chat.id}.html`

    const period = definePeriod(periodName, msg)
    if (period === null) return 0

    const currentDate = new Date()
    if (period.start > currentDate) period.start = currentDate
    if (period.end > currentDate) period.end = currentDate

    const hoursToAdd = Number(process.env.HOURS_TO_ADD) || 0
    console.log('hoursToAdd:', hoursToAdd)

    const dayStart = new Date(period.start.getFullYear(), period.start.getMonth(), period.start.getDate(), 0, 0, 0)
    dayStart.setHours(dayStart.getHours() + hoursToAdd);
    const dayEnd = new Date(period.end.getFullYear(), period.end.getMonth(), period.end.getDate(), 23, 59, 59, 999)
    dayEnd.setHours(dayEnd.getHours() + hoursToAdd);

    console.log('Net report dayStart:', dayStart)
    console.log('Net report dayEnd:', dayEnd)

    const dataCloseDayInDay = await execPgQuery(`SELECT id, title, created_at, close_at, 
       DATE_TRUNC('day', created_at) as start_of_day_created_at, 
       DATE_TRUNC('day', close_at) as start_of_close_at, 
       ROUND((EXTRACT(EPOCH FROM (close_at - created_at))/3600)::numeric, 1) as interval
       FROM tickets 
       WHERE DATE_TRUNC('day', close_at)>=$1 AND DATE_TRUNC('day', close_at)<=$2 AND state_id = 4 AND group_id = 7 AND title LIKE $3 
       AND DATE_TRUNC('day', created_at) = DATE_TRUNC('day', close_at)
       ORDER BY created_at;`,
      [dayStart, dayEnd, 'Недоступний Інтернет%'], false, true) || []

    const dataOpenForCloseAnotherDay = await execPgQuery(`SELECT id, title, created_at, close_at, 
       DATE_TRUNC('day', created_at) as start_of_day_created_at, 
       DATE_TRUNC('day', created_at) as start_of_close_at, 
       ROUND((EXTRACT(EPOCH FROM ((DATE_TRUNC('day', created_at) + INTERVAL '1 day' - INTERVAL '1 second') - created_at))/3600)::numeric, 1) as interval       
       FROM tickets 
       WHERE DATE_TRUNC('day',created_at)>=$1 AND DATE_TRUNC('day',created_at)<=$2 AND state_id = 4 AND group_id = 7 AND title LIKE $3 
       AND DATE_TRUNC('day', created_at) <> DATE_TRUNC('day', close_at)
       ORDER BY created_at;`,
      [dayStart, dayEnd, 'Недоступний Інтернет%'], false, true) || []

    const dataCloseAnotherDay = await execPgQuery(`SELECT id, title, created_at, close_at, 
       DATE_TRUNC('day', close_at) as start_of_day_created_at, 
       DATE_TRUNC('day', close_at) as start_of_close_at, 
       ROUND(EXTRACT(EPOCH FROM (close_at - DATE_TRUNC('day', close_at))/3600)::numeric, 1) as interval
       FROM tickets 
       WHERE DATE_TRUNC('day',close_at)>=$1 AND DATE_TRUNC('day',close_at)<=$2 AND state_id = 4 AND group_id = 7 AND title LIKE $3 
       AND DATE_TRUNC('day', created_at) <> DATE_TRUNC('day', close_at)
       ORDER BY created_at;`,
      [dayStart, dayEnd, 'Недоступний Інтернет%'], false, true) || []

    const result = await execPgQuery(`SELECT NOW() as current_timestamp;`, [])
    console.log(result.current_timestamp)

    const dataOpen = await execPgQuery(`SELECT id, title, created_at, close_at, 
       DATE_TRUNC('day', created_at) as start_of_day_created_at, 
       (NOW() + INTERVAL '${hoursToAdd} hours') as start_of_close_at, 
       ROUND((EXTRACT(EPOCH FROM ((NOW() + INTERVAL '${hoursToAdd} hours') - created_at))/3600)::numeric, 1) as interval
       FROM tickets 
       WHERE DATE_TRUNC('day', created_at) = CURRENT_DATE 
       AND DATE_TRUNC('day',created_at)>=$1 AND DATE_TRUNC('day', created_at)<=$2 
       AND state_id <> 4 AND group_id = 7 AND title LIKE $3 
       ORDER BY created_at;`,
      [dayStart, dayEnd, 'Недоступний Інтернет%'], false, true) || []

    const data = [...dataOpen, ...dataCloseDayInDay, ...dataOpenForCloseAnotherDay, ...dataCloseAnotherDay]
    if (data === null) {
      await bot.sendMessage(msg.chat.id, 'Немає даних для формування звіту за обраний період')
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      return null
    }

    const preparedData = data.map(item => ({
      title: item.title.replace('Недоступний Інтернет на хосте ', '').toLowerCase(),
      start_of_close_at: item.start_of_close_at.toISOString().split('T')[0],
      interval: Number(item.interval)
    }))

    const groupedData = preparedData.reduce((acc, item) => {
      const key = dayOrWeek === 'week'
        ? item.title + getWeekStartDate(item.start_of_close_at)
        : item.title + item.start_of_close_at
      if (!acc[key]) {
        acc[key] = {
          title: item.title,
          start_of_close_at: dayOrWeek === 'week' ? getWeekStartDate(item.start_of_close_at) : item.start_of_close_at,
          total_interval: 0
        };
      }
      acc[key].total_interval += item.interval;
      return acc
    }, {})

    const resultData = Object.values(groupedData);
    const sortedData = resultData.sort((a, b) => {
      if (a.title < b.title) {
        return -1
      }
      if (a.title > b.title) {
        return 1
      }
      if (a.start_of_close_at < b.start_of_close_at) {
        return -1
      }
      if (a.start_of_close_at > b.start_of_close_at) {
        return 1
      }
      return 0
    })

    await createNetReportHtml(bot, msg.chat.id, sortedData, period, dayOrWeek)
    globalBuffer[msg.chat.id] = {}

    if (fs.existsSync(filePath)) {
      try {
        await bot.sendDocument(msg.chat.id, fs.createReadStream(filePath), {
          caption: `Звіт за період: ${moment(period.start).format('DD-MM-YYYY')} - ${moment(period.end).format('DD-MM-YYYY')}`,
          contentType: 'text/html',
        })
      } catch (error) {
        console.error('Error sending document:', error)
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