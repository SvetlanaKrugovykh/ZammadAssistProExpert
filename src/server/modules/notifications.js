const { buttonsConfig } = require('./keyboard')


async function ticketApprovalScene(ticketID, bot, chatId) {
  try {
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

async function ticketApprove(bot, msg) {
}

async function ticketReturn(bot, msg) {
}


module.exports = { ticketApprovalScene, ticketApprove, ticketReturn }