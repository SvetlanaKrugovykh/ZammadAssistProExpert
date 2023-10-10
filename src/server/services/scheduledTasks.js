const { ticketApprovalScene, ticketApprove, ticketReturn } = require('../modules/notifications')
const { execPgQuery } = require('../db/common')


function checkAndReplaceTicketsStatuses(bot) {
  const ticketSubject = 'Test ticket subject 1'
  // await execPgQuery('SELECT title FROM tickets WHERE id = $1', [ticketID])
  ticketApprovalScene(593, bot, 701079281, ticketSubject)
}


module.exports = { checkAndReplaceTicketsStatuses }
