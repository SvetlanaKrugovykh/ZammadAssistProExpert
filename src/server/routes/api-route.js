const { checkUser, createNewTicket } = require('../controllers/apiController')

module.exports = (fastify, _opts, done) => {
  fastify.route({
    method: 'POST',
    url: '/check-user',
    handler: checkUser
  })

  fastify.route({
    method: 'POST',
    url: '/create-ticket',
    handler: createNewTicket
  })

  done()
}