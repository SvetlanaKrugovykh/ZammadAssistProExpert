async function inputLineScene(bot, msg, templateString = '') {
  const chatId = msg.chat.id
  const promise = new Promise(resolve => {
    if (templateString.length > 0) {
      //bot.sendMessage(msg.chat.id, templateString)
    }
    const messageHandler = (message) => {
      if (message.chat.id === chatId) { // Проверяем, что сообщение пришло из того же чата
        const inputLine = message.text
        console.log('Received input Line:', inputLine)
        bot.removeListener('message', messageHandler) // Удаляем обработчик после получения нужного сообщения
        resolve(inputLine)
      }
    }

    bot.on('message', messageHandler)
  })
  const userInput = await promise
  return userInput
}

module.exports = inputLineScene
