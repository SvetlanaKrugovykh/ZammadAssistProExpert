const interConnectService = require('../services/interConnect.service')

module.exports.newRecord = async function (request, _reply) {
  try {
    const body = request.body
    const message = await interConnectService.newRecord(body)
    if (!message) {
      throw new HttpError[501]('Command execution failed')
    }
    return {
      message: `done `
    }
  } catch (error) {
    throw new HttpError[500](error.message)
  }
}

module.exports.newRequest = async function (request, _reply) {
  try {
    console.log('newRequest', request?.body)
    const body = request.body
    const message = await interConnectService.newRequest(body)
    if (!message) {
      throw new HttpError[501]('Command execution failed')
    }
    return {
      message: `done `
    }
  } catch (error) {
    throw new HttpError[500](error.message)
  }
}