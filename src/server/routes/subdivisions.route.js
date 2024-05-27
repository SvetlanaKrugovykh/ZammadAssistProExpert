const subdivisionsController = require('../controllers/subdivisions.controller')

module.exports = (fastify, _opts, done) => {
  fastify.route({
    method: 'POST',
    url: '/subdivisions/update/',
    handler: subdivisionsController.UpdateSubdivisions,
    preHandler: [],
  })

  done()
}