const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TelegramBot = require('node-telegram-bot-api')

const globalBuffer = {}
const selectedByUser = {}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true })

module.exports = { bot, globalBuffer, selectedByUser }