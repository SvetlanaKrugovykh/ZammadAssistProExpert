
async function isBotBlocked(bot, chatId, msg) {
  try {
    if (/[✅⛔⤴️]/.test(msg.text)) return false
    await bot.sendMessage(chatId, '_')
    return false
  } catch (err) {
    console.log(`${chatId} is blocked for bot`)
    return false //true
  }
}

async function isThisGroupId(bot, chatId, msg) {
  try {
    if (/[✅⛔⤴️]/.test(msg.text)) return false
    const chat = await bot.getChat(chatId)
    return chat.type === 'group' || chat.type === 'supergroup';
  } catch (err) {
    return false
  }
}

module.exports = { isBotBlocked, isThisGroupId }