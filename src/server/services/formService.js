const axios = require('axios')

const processFormData = async function (phoneNumber, name) {
  const message = `New form submission from website = call request:\nName: ${name}\nPhone: ${phoneNumber}`
  const chatId = process.env.GROUP_ID
  const apiKey = process.env.TELEGRAM_BOT_TOKEN

  try {
    const response = await axios.post(`https://api.telegram.org/bot${apiKey}/sendMessage`, {
      chat_id: chatId,
      text: message,
    })

    if (response.status === 200) {
      console.log('Message sent to the Telegram group successfully!')
    } else {
      console.error('Error sending message to the Telegram group:', response.statusText)
    }
  } catch (error) {
    console.error('Error sending message to the Telegram group:', error.message)
  }
}

module.exports = {
  processFormData,
}
