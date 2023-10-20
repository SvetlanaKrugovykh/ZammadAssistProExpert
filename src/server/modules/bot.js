
async function isBotBlocked(bot, chatId) {
  try {
    await bot.sendMessage(chatId, '')
    return false
  } catch (err) {
    console.log(`${chatId} is blocked for bot`)
    return true
  }
}

async function isThisGroupId(bot, chatId) {
  try {
    const chat = await bot.getChat(chatId)
    return chat.type === 'group' || chat.type === 'supergroup';
  } catch (err) {
    return false
  }
}

module.exports = { isBotBlocked, isThisGroupId }