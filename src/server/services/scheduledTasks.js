const { ticketApprovalScene, getTicketData } = require('../modules/notifications')
const { execPgQuery } = require('../db/common')


async function checkAndReplaceTicketsStatuses(bot) {
  try {
    const TICKET_AUTO_CLOSE_DAYS = process.env.TICKET_AUTO_CLOSE_DAYS || 3
    const ticketID = 593
    const ticketSubj = await getTicketData(ticketID, 'title')
    if (!ticketSubj) return null
    const ticketSubject = `Заявка №${ticketID} на тему ${ticketSubj} виконана.\n` +
      `Вам необхідно завтвердити виконання заявки або надіслати на доопрацювання.\n` +
      `Наразі відсутній відповідь, заявка буде автоматично завершена ` +
      `через ${TICKET_AUTO_CLOSE_DAYS} дні`
    await ticketApprovalScene(593, bot, 701079281, ticketSubject)
  } catch (err) {
    console.log(err)
  }
}


module.exports = { checkAndReplaceTicketsStatuses }
