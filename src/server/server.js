require('dotenv').config()
const { app, assistApiServer, downloadApp } = require('./index')
const HOST = process.env.HOST || '127.0.0.1'
const HOST_DOWNLOAD = process.env.HOST_DOWNLOAD || '127.0.0.1'
const START_DOWNLOAD_APP = process.env.START_DOWNLOAD_APP || 'false'

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


if (START_DOWNLOAD_APP === 'true') {
  downloadApp.listen({ port: process.env.PORT_FOR_DOWNLOAD_APP || 8003, host: HOST_DOWNLOAD }, (err, address) => {
    if (err) {
      downloadApp.log.error(err)
      console.error(err)
    }
    console.log(`${new Date()}:[download app] Service listening on ${address}`)
  })
}