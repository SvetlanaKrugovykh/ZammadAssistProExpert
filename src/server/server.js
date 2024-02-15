require('dotenv').config()
const { app, assistApiServer, interConnectApp } = require('./index')
const HOST = process.env.HOST || '127.0.0.1'
const updateTables = require('./db/tablesUpdate').updateTables

updateTables()

app.listen({ port: process.env.PORT || 7999, host: HOST }, (err, address) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }

  console.log(`${new Date()}:[API] Service listening on ${address}`)
})

assistApiServer.listen({ port: process.env.PORT_FOR_ASSIST_API || 8002, host: HOST }, (err, address) => {
  if (err) {
    assistApiServer.log.error(err)
    console.error(err)
  }
  console.log(`${new Date()}:[assist API] Service listening on ${address}`)
})


interConnectApp.listen({ port: process.env.PORT_FOR_CONNECT || 8003, host: HOST }, (err, address) => {
  if (err) {
    interConnectApp.log.error(err)
    console.error(err)
  }
  console.log(`${new Date()}:[inter-connect app] Service listening on ${address}`)
})
