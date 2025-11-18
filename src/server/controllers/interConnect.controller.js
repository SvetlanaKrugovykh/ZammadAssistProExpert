const interConnectService = require('../services/interConnect.service')
const HttpError = require('../modules/httpError')

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
    let url = request.body?.currentPageURL
    if (!url) {
      console.log('inter-connect: currentPageURL not provided')
      return
    }
    url = url.replace(/(zoom\/\d+)(\/\d+)?/, '$1')
    request.body.currentPageURL = url

    console.log('newRequest', request.body)
    const message = await interConnectService.newRequest(request.body)

    if (!message) {
      throw new HttpError[501]('Command execution failed')
    }
    return {
      message: `done `
    };
  } catch (error) {
    throw new HttpError[500](error.message)
  }
}
