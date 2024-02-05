require('dotenv').config()

function fDateTime(local, time = new Date(), isDelta = false, deltaSummerTime = false) {
  const DELTA_RUBY_TIME_FOR_MESSAGE_MINUTES = Number(process.env.DELTA_RUBY_TIME_FOR_MESSAGE_MINUTES) * 60000 || 0
  const DELTA_ADD = isDelta ? Number(process.env.DELTA_ADD) * 60000 : 0
  const DELTA_SUMMER_TIME = deltaSummerTime ? Number(process.env.DELTA_SUMMER_TIME) * 60000 : 0
  let adjustedTime = new Date(time)

  if (isNaN(adjustedTime)) {
    adjustedTime = new Date()
  }
  adjustedTime = new Date(adjustedTime.getTime() - DELTA_RUBY_TIME_FOR_MESSAGE_MINUTES + DELTA_ADD + DELTA_SUMMER_TIME)

  const currentTime = adjustedTime.toLocaleString(local, { dateStyle: 'medium', timeStyle: 'short' })
  return currentTime
}

function _dayStart(_dateTime) {
  const DELTA_RUBY_TIME_ZONE = Number(process.env.DELTA_RUBY_TIME_ZONE_MINUTES) * 60000 || 0
  const DELTA_SUMMER_TIME = Number(process.env.DELTA_SUMMER_TIME) * 60000 || 0
  const adjusted_time = new Date(_dateTime - DELTA_RUBY_TIME_ZONE - DELTA_SUMMER_TIME)
  return adjusted_time
}

function _dayEnd(_dateTime) {
  const DELTA_RUBY_TIME_ZONE = Number(process.env.DELTA_RUBY_TIME_ZONE_MINUTES) * 60000 || 0
  const DELTA_SUMMER_TIME = Number(process.env.DELTA_SUMMER_TIME) * 60000 || 0
  const adjusted_time = new Date(_dateTime - DELTA_RUBY_TIME_ZONE - DELTA_SUMMER_TIME)
  return adjusted_time
}

function pendingTimeInDaysSec() {
  const INTERVAL_DAYS = Number(process.env.TICKET_AUTO_CLOSE_DAYS) || 3
  const DELTA_RUBY_TIME_ZONE_MINUTES = Number(process.env.DELTA_RUBY_TIME_ZONE_MINUTES) || 0
  const DELTA = ((INTERVAL_DAYS * 24 * 60) - DELTA_RUBY_TIME_ZONE_MINUTES) * 60000
  const pending_time = new Date(Date.now() + DELTA)
  pending_time.setHours(23, 59, 59, 999)
  return pending_time
}


function _dayEndTimeInDaysSec(deltaMSec = 0) {
  const DELTA_RUBY_TIME_ZONE = Number(process.env.DELTA_RUBY_TIME_ZONE_MINUTES) * 60000 || 0
  const DELTA_SUMMER_TIME = Number(process.env.DELTA_SUMMER_TIME) * 60000 || 0
  const _dayEnd = new Date(Date.now() - deltaMSec)
  const pending_time = new Date(_dayEnd.getFullYear(), _dayEnd.getMonth(), _dayEnd.getDate(), 23, 59, 59, 999)
  const adjusted_time = new Date(pending_time - DELTA_RUBY_TIME_ZONE - DELTA_SUMMER_TIME - 999)
  adjusted_time.setSeconds(0)
  return adjusted_time
}


function pendingTimeInIntervalMin() {
  let INTERVAL_MINUTES = Number(process.env.CLOSED_TICKET_SCAN_INTERVAL_MINUTES_FOR_DB) || 11
  const DELTA = INTERVAL_MINUTES * 60000
  const pending_time = new Date(Date.now() + DELTA)
  return pending_time
}

module.exports = { fDateTime, pendingTimeInDaysSec, pendingTimeInIntervalMin, _dayEndTimeInDaysSec, _dayStart, _dayEnd }