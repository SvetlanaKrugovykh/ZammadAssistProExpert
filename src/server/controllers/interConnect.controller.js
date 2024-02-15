const interConnectService = require('../services/interConnect.service')

module.exports.newRecord = async function (request, _reply) {
  const { abonentId, ipAddress, vlanId } = request.body  //TODO
  const message = await interConnectService.newRecord(abonentId, ipAddress, vlanId) //TODO

  if (!message) {
    throw new HttpError[501]('Command execution failed')
  }

  return {
    message: `done `
  }
}