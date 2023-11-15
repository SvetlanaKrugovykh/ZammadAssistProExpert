async function inputLineScene(bot, msg, templateString = '', timeout = 30000) {
  const chatId = msg.chat.id

  return new Promise((resolve, reject) => {
    let timer
    const messageHandler = (message) => {
      if (message.chat.id === chatId) {
        const inputLine = message.text
        console.log('Received input Line:', inputLine)
        clearTimeout(timer)
        bot.removeListener('message', messageHandler)
        resolve(inputLine)
      }
    }

    bot.on('message', messageHandler)

    if (templateString.length > 0) {
      bot.sendMessage(msg.chat.id, templateString)
    }

    timer = setTimeout(() => {
      bot.removeListener('message', messageHandler)
      resolve('не вказано')
    }, timeout)
  })
}


module.exports = inputLineScene
