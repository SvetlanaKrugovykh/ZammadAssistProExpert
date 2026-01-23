const { handleVoiceMessage } = require('../handlers/messageHandler')

async function inputLineScene(bot, msg, templateString = "") {
	const chatId = msg.chat.id
  let inputLine = ''

	const promise = new Promise((resolve) => {
		if (templateString.length > 0) {
			//bot.sendMessage(msg.chat.id, templateString)
		}
		const messageHandler = async (message) => {
			if (message.chat.id === chatId) {
				if (message.text) {
					inputLine = message.text
					console.log("Received input Line (text):", inputLine)
					bot.removeListener("message", messageHandler)
					resolve(inputLine)
				} else if (message.voice) {
					console.log("Received input Line (voice message)")
					const result = await handleVoiceMessage(bot, message)
          inputLine = result?.ticket?.description || ''
          console.log("Transcribed voice message to text:", inputLine)
					bot.removeListener("message", messageHandler)
					resolve(inputLine)
				}
			}
		}

		bot.on("message", messageHandler)
		if (templateString.length > 0) {
			bot.sendMessage(msg.chat.id, templateString)
		}
	})
	const userInput = await promise
	return userInput
}

async function inputLineAdminScene(
	bot,
	msg,
	templateString = "",
	timeout = 25000,
) {
	const chatId = msg.chat.id

	return new Promise((resolve, reject) => {
		let timer
		const messageHandler = (message) => {
			if (message.chat.id === chatId) {
				const inputLine = message.text
				console.log("Received input Line:", inputLine)
				clearTimeout(timer)
				bot.removeListener("message", messageHandler)
				resolve(inputLine)
			}
		}

		bot.on("message", messageHandler)

		if (templateString.length > 0) {
			bot.sendMessage(msg.chat.id, templateString)
		}

		timer = setTimeout(() => {
			bot.removeListener("message", messageHandler)
			resolve("не вказано")
		}, timeout)
	})
}

module.exports = { inputLineScene, inputLineAdminScene }
