const fs = require('fs')
const PDFDocument = require('pdfkit')
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
    const REPORTS_CATALOG = process.env.REPORTS_CATALOG || 'reports/';
    const total = data.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);

    const pdfDoc = new PDFDocument();
    pdfDoc.pipe(fs.createWriteStream(`${REPORTS_CATALOG}${chatId}.pdf`));

    pdfDoc.fontSize(18).text(`Звіт за період: ${moment(period.start).format('DD-MM-YYYY')} - ${moment(period.end).format('DD-MM-YYYY')}`);
    pdfDoc.fontSize(16).text(`Кількість заявок: ${total}`);
    pdfDoc.fontSize(14).text('Заявки:');

    let yPosition = pdfDoc.y + 10;
    for (const entry of data) {
      pdfDoc.fontSize(12);
      pdfDoc.text(`Група: ${entry.group_id} - Статус: ${getStatusName(entry.state_id)}: ${entry.quantity}`, pdfDoc.x, yPosition);
      yPosition += 10;
    }

    pdfDoc.end();
    return true;
  } catch (error) {
    console.error('Error in function createReportPDF:', error);
    return null;
  }
}

function getStatusName(stateId) {
  switch (stateId) {
    case 1:
    case 2:
      return 'Відкрита (В роботі)';
    case 4:
      return 'Закрита';
    default:
      return 'Очікує закриття';
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

    const data = await execPgQuery('SELECT group_id, state_id, COUNT(*) as quantity FROM tickets WHERE created_at > $1 AND created_at < $2 AND group_id <> 7 GROUP BY group_id, state_id ORDER BY group_id, state_id;', [period.start, period.end], false, true)
    if (data === null) {
      await bot.sendMessage(msg.chat.id, 'Намає даних для формування звіту за обраний період')
      return null
    }
    await createReportPDF(data, period, msg.chat.id)
    const REPORTS_CATALOG = process.env.REPORTS_CATALOG || 'reports/'
    const filePath = `${REPORTS_CATALOG}${msg.chat.id}.pdf`;
    if (fs.existsSync(filePath)) {
      await bot.sendDocument(msg.chat.id, fs.readFileSync(filePath)).catch(function (error) { console.log(error) })
    } else {
      console.log(`File not found: ${filePath}`);
    }

    return data
  } catch (error) {
    console.error('Error in function createReport:', error)
    return null
  }
}
