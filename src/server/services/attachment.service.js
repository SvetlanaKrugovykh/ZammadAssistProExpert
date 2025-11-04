
const fs = require('fs')
const path = require('path')
const util = require('util')
const pipeline = util.promisify(require('stream').pipeline)


module.exports.askForAttachment = async function (bot, msg, selectedByUser) {
  try {
    await bot.sendMessage(msg.chat.id, 'Будь ласка, відправте файл:')

    const attachmentMsg = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        bot.removeListener('document', handleDocument)
        bot.removeListener('photo', handlePhoto)
        bot.removeListener('text', handleText)
        reject(new Error('Timeout waiting for attachment'))
      }, 60000) // 60 seconds timeout

      const handleDocument = (docMsg) => {
        clearTimeout(timeout)
        bot.removeListener('photo', handlePhoto)
        bot.removeListener('text', handleText)
        resolve(docMsg)
      }

      const handlePhoto = (photoMsg) => {
        clearTimeout(timeout)
        bot.removeListener('document', handleDocument)
        bot.removeListener('text', handleText)
        resolve(photoMsg)
      }

      const handleText = (textMsg) => {
        clearTimeout(timeout)
        bot.removeListener('document', handleDocument)
        bot.removeListener('photo', handlePhoto)
        resolve(null)
      }

      bot.once('document', handleDocument)
      bot.once('photo', handlePhoto)
      bot.once('text', handleText)
    })

    if (!attachmentMsg) {
      console.log('User sent text instead of attachment, skipping')
      return null
    }

    const selectedByUser_ = await addTicketAttachment(bot, attachmentMsg, selectedByUser)
    return selectedByUser_
  } catch (err) {
    console.error('Error in askForAttachment:', err)
    return null
  }
}


module.exports.askForPicture = async function (bot, msg, selectedByUser) {
  try {
    await bot.sendMessage(msg.chat.id, 'Будь ласка, вставте картинку:')
    console.log(`askForPicture started:`)

    const dirPath = process.env.DOWNLOAD_APP_PATH
    await checkDirPath(dirPath)

    const pictureMsg = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        bot.removeListener('photo', handlePhoto)
        reject(new Error('Timeout waiting for photo'))
      }, 60000) // 60 seconds timeout

      const handlePhoto = (photoMsg) => {
        clearTimeout(timeout)
        if (photoMsg?.photo && Array.isArray(photoMsg.photo) && photoMsg.photo.length > 0) {
          resolve(photoMsg)
        } else {
          reject(new Error('No photo found in message'))
        }
      }

      bot.once('photo', handlePhoto)
    })

    if (!pictureMsg?.photo || !Array.isArray(pictureMsg.photo) || pictureMsg.photo.length === 0) {
      console.log('No photo found in message')
      return null
    }

    const pictureFileId = pictureMsg.photo[pictureMsg.photo.length - 1]?.file_id
    if (!pictureFileId) {
      console.log('No file_id found in photo')
      return null
    }
    const pictureFileName = `photo_${msg.chat.id.toString()}_${Date.now()}.jpg`
    const pictureFilePath = path.join(dirPath, pictureFileName).replace(/\/\//g, '/')

    const fileStream = await bot.getFileStream(pictureFileId)
    const file = fs.createWriteStream(pictureFilePath)

    fileStream.on('error', (err) => {
      console.error('Error receiving file stream:', err)
      file.close()
      fs.unlinkSync(pictureFilePath)
      return null
    })

    await new Promise((resolve, reject) => {
      fileStream.pipe(file)
      file.on('finish', resolve)
      file.on('error', (err) => {
        console.error('Error writing file:', err)
        fs.unlinkSync(pictureFilePath)
        reject(err)
        return null
      })
    })

    const fileNames = selectedByUser.ticketAttachmentFileNames || []
    const selectedByUser_ = { ...selectedByUser, ticketAttachmentFileNames: [...fileNames, pictureFileName] }
    console.log(`added TicketPicture: `, pictureFileName)
    return selectedByUser_
  } catch (err) {
    console.log(err)
    return null
  }
}

async function addTicketAttachment(bot, msg, selectedByUser) {
  try {
    const dirPath = process.env.DOWNLOAD_APP_PATH
    await checkDirPath(dirPath)
    console.log(`addTicketAttachment started: ${msg?.document?.file_name}`)

    let fileId, fileName
    if (msg?.document?.file_id) {
      fileId = msg.document.file_id
      fileName = msg.document.file_name
      const fileExtension = path.extname(fileName) || '.unknown'
      fileName = `file_${msg.chat.id.toString()}_${Date.now()}${fileExtension}`
    } else if (msg?.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
      const lastPhoto = msg.photo[msg.photo.length - 1]
      if (!lastPhoto?.file_id) {
        console.log('No file_id found in photo array')
        return null
      }
      fileId = lastPhoto.file_id
      fileName = `photo_${msg.chat.id.toString()}_${Date.now()}.jpg`
    } else {
      console.log('Invalid file attachment input')
      return null
    }

    const filePath = path.join(dirPath, fileName).replace(/\/\//g, '/')
    const fileStream = await bot.getFileStream(fileId)
    const file = fs.createWriteStream(filePath)

    await new Promise((resolve, reject) => {
      fileStream.pipe(file)
      file.on('finish', resolve)
      file.on('error', (err) => {
        console.error('Error writing file:', err)
        fs.unlinkSync(filePath)
        reject(err)
        return null
      })
    })

    const fileNames = selectedByUser?.ticketAttachmentFileNames || []
    const newSelectedByUser = { ...selectedByUser, ticketAttachmentFileNames: [...fileNames, fileName] }
    console.log(`addTicketAttachment fileNames: +${fileName} `, fileNames)

    console.log(`added TicketAttachment: `, fileName)
    return newSelectedByUser
  } catch (err) {
    console.error('Error adding ticket attachment:', err)
    return null
  }
}

async function checkDirPath(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
    console.log(`Directory ${dirPath} created successfully`)
  }
}
