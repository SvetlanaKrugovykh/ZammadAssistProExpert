require('dotenv').config()
const { app, assistApiServer } = require('./index')
const HOST = process.env.HOST || '127.0.0.1'

app.listen({ port: process.env.PORT || 7999, host: HOST }, (err, address) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }

  console.log(`${new Date()}:[API] Service listening on ${address}`)
})

assistApiServer.listen({ port: process.env.PORT_FOR_assist_API || 8002, host: HOST }, (err, address) => {
  if (err) {
    assistApiServer.log.error(err)
    console.error(err)
  }
  console.log(`${new Date()}:[assist API] Service listening on ${address}`)
})
