const authController = require('../controllers/authController')

module.exports = (fastify, _opts, done) => {
  fastify.route({
    method: 'POST',
    url: '/auth/generate-access-token/',
    handler: authController.createAccessToken,
    preHandler: [
      isAuthorizedGuard
    ]
  })

  fastify.route({
    method: 'POST',
    url: '/auth/check-access-token/',
    handler: authController.checkAccessToken,
    preHandler: [
      isAuthorizedGuard
    ]
  })

  done()
}

