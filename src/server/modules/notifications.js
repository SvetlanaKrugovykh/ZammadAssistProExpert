const { buttonsConfig } = require('./keyboard')

async function ticketApprovalScene(ticketID, bot, chatId, ticketSubject) {
  try {
    buttonsConfig["ticketApproval"].title = ticketSubject
    const buttons = buttonsConfig["ticketApproval"].buttons
    for (const button of buttons) {
      if (button.callback_data === '3_3') break
      button.text = buttons.text + '№_' + ticketID.toString()
    }
    await bot.sendMessage(chatId, buttonsConfig["ticketApproval"].title, {
      reply_markup: {
        keyboard: buttonsConfig["ticketApproval"].buttons,
        resize_keyboard: true,
        one_time_keyboard: false
      }
    })
  } catch (err) {
    console.log(err)
  }
}

async function ticketApprove(ticketID, bot, msg) {
  if (!(ticketID > 0)) return null

  // Code to approve the ticket with the given ID
  // ...

  // Send a message to the user indicating that the ticket has been approved
  await bot.sendMessage(msg.chat.id, `Ticket ${ticketID} has been approved.`)
}

async function ticketReturn(ticketID, bot, msg) {
  if (!(ticketID > 0)) return null

  // Code to return the ticket with the given ID
  // ...

  // Send a message to the user indicating that the ticket has been returned
  await bot.sendMessage(msg.chat.id, `Ticket ${ticketID} has been returned.`)
}

module.exports = { ticketApprovalScene, ticketApprove, ticketReturn }