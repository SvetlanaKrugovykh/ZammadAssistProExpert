const subdivisionsService = require('../services/subdivisions.service')

module.exports.UpdateSubdivisions = async function (request, _reply) {
  try {
    const body = request.body
    const message = await subdivisionsService.UpdateSubdivisions(body)
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

