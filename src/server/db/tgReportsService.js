const fs = require('fs')
const PDFDocument = require('pdfkit')
const execPgQuery = require('./common').execPgQuery

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

module.exports.createReport = async function (bot, msg, periodName) {
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
        return null
      default:
        return null
    }

    const data = await execPgQuery('SELECT user_id, login FROM roles_users JOIN users ON roles_users.user_id = users.id WHERE role_id=5', []) //ВРЕМЕННО
    if (data === null) return null
    await createReportPDF(data, period)
    return data
  } catch (error) {
    console.error('Error in function createReport:', error)
    return null
  }
}

async function createReportPDF(data, period) {
  try {
    const doc = new PDFDocument
    doc.pipe(fs.createWriteStream(`123123.pdf`))
    doc.fontSize(25)
    doc.text(`Звіт за період: ${period.start} - ${period.end}`, 100, 100)
    doc.fontSize(15)
    doc.text(`Кількість заявок: ${data.length}`, 100, 150)
    doc.fontSize(10)
    doc.text(`Заявки:`, 100, 170)
    doc.text(`ID`, 100, 190)
    doc.text(`Тема`, 200, 190)
    doc.text(`Статус`, 400, 190)
    doc.text(`Дата створення`, 500, 190)
    doc.text(`Дата закриття`, 600, 190)
    doc.text(`Виконавець`, 700, 190)
    for (let i = 0; i < data.length; i++) {
      doc.text(`${data[i].id}`, 100, 210 + i * 20)
      doc.text(`${data[i].title}`, 200, 210 + i * 20)
      doc.text(`${data[i].status}`, 400, 210 + i * 20)
      doc.text(`${data[i].created_at}`, 500, 210 + i * 20)
      doc.text(`${data[i].closed_at}`, 600, 210 + i * 20)
      doc.text(`${data[i].executor}`, 700, 210 + i * 20)
    }
    doc.end()
    return true
  } catch (error) {
    console.error('Error in function createReportPDF:', error)
    return null
  }
}