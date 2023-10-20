function fDateTime(local, time = new Date()) {
  const currentTime = new Date(time).toLocaleString(local, { dateStyle: 'medium', timeStyle: 'short' })
  return currentTime
}


module.exports = { fDateTime }