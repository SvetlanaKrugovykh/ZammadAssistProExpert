const { checkUser, createNewTicket } = require('../controllers/apiController')

module.exports = (fastify, _opts, done) => {
  fastify.route({
    method: 'POST',
    url: '/api/check-user',
    handler: checkUser
  })

  fastify.route({
    method: 'POST',
    url: '/api/create-ticket',
    handler: createNewTicket
  })

  done()
}