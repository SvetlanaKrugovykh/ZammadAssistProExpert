const interConnectController = require('../controllers/interConnect.controller')

module.exports = (fastify, _opts, done) => {
  fastify.route({
    method: 'POST',
    url: '/tickets/update/',
    handler: interConnectController.newRecord,
    preHandler: [],
  })

  fastify.route({
    method: 'POST',
    url: '/tickets/data-request/',
    handler: interConnectController.newRequest,
    preHandler: [],
  })

  done()
}