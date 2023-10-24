require('dotenv').config()

function fDateTime(local, time = new Date()) {
  const DELTA_RUBY_TIME_ZONE_MINUTES = Number(process.env.DELTA_RUBY_TIME_ZONE_MINUTES) || 0
  let adjustedTime = new Date(time)

  if (isNaN(adjustedTime)) {
    adjustedTime = new Date()
  }
  adjustedTime = new Date(adjustedTime.getTime() - DELTA_RUBY_TIME_ZONE_MINUTES * 60000)

  const currentTime = adjustedTime.toLocaleString(local, { dateStyle: 'medium', timeStyle: 'short' })
  return currentTime
}



module.exports = { fDateTime }