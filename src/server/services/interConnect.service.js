module.exports.newRecord = async function () {
  try {
    return true
  } catch (error) {
    console.error('Error executing commands:', error.message)
    return false
  }
}