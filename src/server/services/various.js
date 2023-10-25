require('dotenv').config()

function fDateTime(local, time = new Date(), isDelta = false) {
  const DELTA_RUBY_TIME_FOR_MESSAGE_MINUTES = Number(process.env.DELTA_RUBY_TIME_FOR_MESSAGE_MINUTES) * 60000 || 0
  const DELTA_ADD = isDelta ? Number(process.env.DELTA_ADD) * 60000 : 0
  let adjustedTime = new Date(time)

  if (isNaN(adjustedTime)) {
    adjustedTime = new Date()
  }
  adjustedTime = new Date(adjustedTime.getTime() - DELTA_RUBY_TIME_FOR_MESSAGE_MINUTES + DELTA_ADD)

  const currentTime = adjustedTime.toLocaleString(local, { dateStyle: 'medium', timeStyle: 'short' })
  return currentTime
}



module.exports = { fDateTime }