const https = require('https')
require('dotenv').config()
const fs = require('fs')
const axios = require('axios')

async function checkNewCatalogPath(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
    console.log(`Directory ${dirPath} created successfully`)
  }
}

module.exports.update_ticket = async function (ticketId, body, fileNames, override = false) {

  const headers = { Authorization: process.env.ZAMMAD_API_TOKEN, "Content-Type": "application/json" }
  let bodyWithAttachments = body
  const slash = process.env.SLASH
  const newCatalog = `${process.env.DOWNLOAD_APP_PATH}${ticketId}`
  await checkNewCatalogPath(newCatalog)
  console.log(`start of update: ${ticketId}`)
  console.log(`fileNames: ${fileNames}`)

  for (const element of fileNames) {
    console.log(`file element: ${element}`)
    const file_name = element.replace(process.env.DOWNLOAD_APP_PATH, '')
    const old_file_name = `${process.env.DOWNLOAD_APP_PATH}${file_name}`.replace(/\/\//g, '/')
    const newFilePath = `${newCatalog}${slash}${file_name}`.replace(/\/\//g, '/')
    try {
      await fs.promises.access(old_file_name, fs.constants.F_OK)
      await fs.promises.rename(old_file_name, newFilePath)
      console.log(`File ${element} moved to ${newFilePath}`)
      const fileUrl = `${process.env.DOWNLOAD_URL}${ticketId}/${file_name}`
      bodyWithAttachments += `\n${fileUrl}`
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log(`File ${old_file_name} does not exist`)
      } else {
        console.log(err)
      }
      continue
    }
  }

  let data = {
    'article': {
      'body': bodyWithAttachments || body,
    }
  }
  if (override) data = body
  let updated_at = ''

  const httpsAgent = new https.Agent({ rejectUnauthorized: false })
  const url = `${process.env.ZAMMAD_API_URL}/tickets/${ticketId}`
  try {
    const response = await axios.put(url, data, { headers, httpsAgent })
    const ticket = response.data
    updated_at = ticket.updated_at
    console.log(`update ticket: ${ticketId} updated_at: ${updated_at}`)
    return ticket
  } catch (err) {
    console.log(`ERROR of update ticket: ${ticketId} updated_at: ${updated_at}`)
    console.log(`url: ${url}, data: ${JSON.stringify(data)}, headers: ${JSON.stringify(headers)}`)
    return null
  }
}