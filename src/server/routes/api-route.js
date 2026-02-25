const {
	checkUser, 	blockUser,	createUser, createNewTicket } = require("../controllers/apiController")

module.exports = (fastify, _opts, done) => {
  fastify.route({
    method: 'POST',
    url: '/check-user',
    handler: checkUser
  })

  fastify.route({
		method: "POST",
		url: "/block-user",
		handler: blockUser,
	})

  fastify.route({
		method: "POST",
		url: "/create-user",
		handler: createUser,
	})

  fastify.route({
    method: 'POST',
    url: '/create-ticket',
    handler: createNewTicket
  })

  done()
}