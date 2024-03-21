
const fs = require('fs')
const path = require('path')
const util = require('util')
const pipeline = util.promisify(require('stream').pipeline)


module.exports.askForAttachment = async function (bot, msg, selectedByUser) {
  try {
    await bot.sendMessage(msg.chat.id, 'Будь ласка, відправте файл:')

    const attachmentMsg = await new Promise((resolve, reject) => {
      const handleMessage = (message) => {
        if (message?.document || message?.photo) {
          if (message.photo) {
            const largestPhoto = message.photo.reduce((prev, current) => {
              return (prev.width * prev.height > current.width * current.height) ? prev : current
            })
            message = { ...message, photo: largestPhoto }
          }
          bot.off('message', handleMessage)
          resolve(message)
        }
      }
      bot.on('message', handleMessage)
    })

    const selectedByUser_ = await addTicketAttachment(bot, attachmentMsg, selectedByUser)
    return selectedByUser_
  } catch (err) {
    console.log(err)
    return selectedByUser
  }
}


module.exports.askForPicture = async function (bot, msg, selectedByUser) {
  try {
    await bot.sendMessage(msg.chat.id, 'Будь ласка, вставте картинку:')

    const dirPath = process.env.DOWNLOAD_APP_PATH
    await checkDirPath(dirPath)

    const pictureMsg = await new Promise((resolve, reject) => {
      bot.once('photo', (photoMsg) => {
        if (photoMsg && photoMsg.photo) {
          resolve(photoMsg)
        } else {
          reject(new Error('No photo found in message'))
        }
      })
    })

    if (!pictureMsg.photo || pictureMsg.photo.length === 0) {
      console.log('No photo found in message')
      return selectedByUser
    }

    const pictureFileId = pictureMsg.photo[pictureMsg.photo.length - 1].file_id
    const pictureFileName = `photo_${msg.chat.id.toString()}_${Date.now()}.jpg`
    const pictureFilePath = path.join(dirPath, pictureFileName).replace(/\/\//g, '/')

    const fileStream = await bot.getFileStream(pictureFileId)
    const file = fs.createWriteStream(pictureFilePath)

    fileStream.on('error', (err) => {
      console.error('Error receiving file stream:', err)
      file.close()
      fs.unlinkSync(pictureFilePath)
    })

    await new Promise((resolve, reject) => {
      fileStream.pipe(file)
      file.on('finish', resolve)
      file.on('error', (err) => {
        console.error('Error writing file:', err)
        fs.unlinkSync(pictureFilePath)
        reject(err)
      })
    })

    const fileNames = selectedByUser.ticketAttachmentFileNames || []
    const selectedByUser_ = { ...selectedByUser, ticketAttachmentFileNames: [...fileNames, pictureFileName] }
    console.log(`added TicketPicture: `, pictureFileName)
    return selectedByUser_
  } catch (err) {
    console.log(err)
    return selectedByUser
  }
}

async function addTicketAttachment(bot, msg, selectedByUser) {
  try {
    const dirPath = process.env.DOWNLOAD_APP_PATH
    await checkDirPath(dirPath)

    let fileId, fileName
    if (msg?.document) {
      fileId = msg.document.file_id
      fileName = msg.document.file_name
      const fileExtension = path.extname(fileName) || '.unknown'
      fileName = `file_${msg.chat.id.toString()}_${Date.now()}${fileExtension}`
    } else if (msg && msg.photo) {
      fileId = msg.photo.file_id
      fileName = `photo_${msg.chat.id.toString()}_${Date.now()}.jpg`
    } else {
      console.log('Invalid file attachment input')
      return selectedByUser
    }

    const filePath = path.join(dirPath, fileName).replace(/\/\//g, '/')
    const fileStream = await bot.getFileStream(fileId)
    const file = fs.createWriteStream(filePath)

    await pipeline(fileStream, file)
    const fileNames = selectedByUser.ticketAttachmentFileNames || []
    const newSelectedByUser = { ...selectedByUser, ticketAttachmentFileNames: [...fileNames, fileName] }

    console.log(`added TicketAttachment: `, fileName)
    return newSelectedByUser
  } catch (err) {
    console.error('Error adding ticket attachment:', err)
    return selectedByUser
  }
}

async function checkDirPath(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
    console.log(`Directory ${dirPath} created successfully`)
  }
}
