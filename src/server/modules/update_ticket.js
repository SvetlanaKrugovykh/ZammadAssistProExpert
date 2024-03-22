const https = require('https')
require('dotenv').config()
const fs = require('fs')
const axios = require('axios')
const path = require('path')

async function checkNewCatalogPath(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
    console.log(`Directory ${dirPath} created successfully`)
  }
}

module.exports.update_ticket = async function (ticketId, body, fileNames, override = false, chatID = '') {

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

  if (chatID) {
    let bodyWithAttachments_ = await moveFiles(newCatalog, ticketId, chatID, bodyWithAttachments)
    if (bodyWithAttachments_) bodyWithAttachments = bodyWithAttachments_
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

async function moveFiles(newCatalog, ticketId, chatID, bodyWithAttachments = '') {
  try {
    const directoryPath = process.env.DOWNLOAD_APP_PATH
    const files = await fs.promises.readdir(directoryPath)
    const filesToMove = files.filter(file => file.includes(`_${chatID.toString()}_`))

    for (const file of filesToMove) {
      const oldFilePath = path.join(directoryPath, file)
      const newFilePath = path.join(newCatalog, file)

      try {
        await fs.promises.rename(oldFilePath, newFilePath)
        console.log(`File ${file} moved ADDITIONALY to ${newFilePath}`)
        const file_name = file.replace(process.env.DOWNLOAD_APP_PATH, '')
        const fileUrl = `${process.env.DOWNLOAD_URL}${ticketId}/${file_name}`
        bodyWithAttachments += `\n${fileUrl}`
      } catch (err) {
        console.error(`Error moving ADDITIONALY file ${file}:`, err)
        return null
      }
    }
    return bodyWithAttachments
  } catch (err) {
    console.error('Error:', err)
    return null
  }
}