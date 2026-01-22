const localAIService = require('../services/localAI')
const ticketParser = require('../services/ticketParser')
const logger = require('../utils/logger')
const messages = require('../data/messages')
const logMessages = require('../data/logMessages')
const fs = require('fs')
const path = require('path')

class MessageHandler {
  constructor() {
    this.authCache = new Map()
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true })
    }
  }

  
  /**
   * Confirm and send ticket to Service-Desk
   */
  async confirmTicket(bot, chatId, userId, ticketId) {
    try {
      const session = sessionService.getSession(userId)
      const pendingTicket = session.pendingTickets?.[ticketId]

      if (!pendingTicket) {
        await bot.sendMessage(chatId, messages.errors.ticketNotFound)
        return
      }

      // Show processing message
      await bot.sendChatAction(chatId, 'typing')
      await bot.sendMessage(chatId, messages.tickets.processingMessage)

      // Create ticket in Service Desk using ticketService
      const creationResult = await ticketService.createTicket({
        content: pendingTicket.content,
        telegramId: userId,
        userInfo: session.userInfo
      })

      if (creationResult.success) {
        // Success - send confirmation with ticket ID
        await bot.sendMessage(chatId, creationResult.message)

        // Mark the ticket as sent
        if (!session.sentTickets) {
          session.sentTickets = []
        }
        session.sentTickets.push(ticketId)

        // Remove from pending tickets
        if (session.pendingTickets) {
          delete session.pendingTickets[ticketId]
          sessionService.updateSession(userId, session)
        }

        logger.info(`Ticket successfully created: ${creationResult.ticketId} for user ${userId}`)

        // Remove the confirmation keyboard using stored message_id keyed by ticketId
        try {
          const messageId = session.messages?.[ticketId]
          if (messageId) {
            await bot.editMessageReplyMarkup(null, { chat_id: chatId, message_id: messageId })
            logger.info(`Inline keyboard removed for message ${messageId}`)

            // Clean up stored message_id
            delete session.messages[ticketId]
            sessionService.updateSession(userId, session)
          } else {
            logger.warn(`No stored message_id for ticket ${ticketId} of user ${userId}`)
          }
        } catch (error) {
          logger.error(`Failed to remove inline keyboard for ticket ${ticketId}:`, error)
        }

      } else {
        // Error - show concise error message and keep ticket pending
        await bot.sendMessage(chatId, creationResult.message)
        const shortErr = creationResult.error || 'unknown_error'
        logger.error(`Ticket creation failed for user ${userId}: ${shortErr}`)

        // In debug mode, still remove the ticket to avoid accumulation
        if (ticketService.getMode() === 'debug' && session.pendingTickets) {
          delete session.pendingTickets[ticketId]
          sessionService.updateSession(userId, session)
        }
      }

    } catch (error) {
      logger.error(logMessages.tickets.confirmError(userId, ticketId), error)
      await bot.sendMessage(chatId, messages.tickets.creationError)
    }
  }

  /**
   * Cancel ticket creation
   */
  async cancelTicket(bot, chatId, userId, ticketId) {
    try {
      const session = sessionService.getSession(userId)

      // Check if the ticket is already sent
      if (session.sentTickets && session.sentTickets.includes(ticketId)) {
        await bot.sendMessage(chatId, messages.errors.ticketAlreadySent)
        return
      }

      // Check if the ticket is already canceled
      if (session.canceledTickets && session.canceledTickets.includes(ticketId)) {
        await bot.sendMessage(chatId, messages.errors.ticketAlreadyCancelled)
        return
      }

      if (session.pendingTickets) {
        delete session.pendingTickets[ticketId]
      }

      // Mark the ticket as canceled
      if (!session.canceledTickets) {
        session.canceledTickets = []
      }
      session.canceledTickets.push(ticketId)
      sessionService.updateSession(userId, session)

      await bot.sendMessage(chatId, messages.success.ticketCancelled)
      logger.info(logMessages.tickets.cancelled(userId, ticketId))

      // Remove the confirmation keyboard after canceling
      const messageId = session.messages?.[ticketId]
      if (messageId) {
        try {
          await bot.editMessageReplyMarkup(
            { reply_markup: { inline_keyboard: [] } },
            { chat_id: chatId, message_id: messageId }
          )
          logger.info(`Inline keyboard removed for message ${messageId}`)

          // Clean up the saved message_id after removing the keyboard
          delete session.messages[ticketId]
          sessionService.updateSession(userId, session)
        } catch (error) {
          logger.error(`Failed to remove inline keyboard for message ${messageId}:`, error)
        }
      } else {
        logger.warn(`No message_id found for user ${userId} to remove inline keyboard.`)
      }
    } catch (error) {
      logger.error(logMessages.tickets.cancelError(userId, ticketId), error)
      // Avoid sending a generic error message if the issue is with keyboard removal
      if (error.code !== 'MESSAGE_ID_INVALID') {
        await bot.sendMessage(chatId, messages.errors.generalError)
      }
    }
  }


  /**
   * Handle voice messages
   */
  async handleVoiceMessage(bot, msg) {
    const chatId = msg.chat.id
    const userId = msg.from.id.toString()
    const tempDir = process.env.TEMP_CATALOG

    try {
      await bot.sendChatAction(chatId, 'typing')
      await bot.sendChatAction(chatId, 'typing')
      await bot.sendMessage(chatId, messages.processing.voiceProcessing)

      // Download voice file
      const fileId = msg.voice.file_id
      const file = await bot.getFile(fileId)
      const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`

      // Save voice file temporarily
      const tempFileName = `voice_${userId}_${Date.now()}.oga`
      const tempFilePath =  tempDir + tempFileName

      const response = await require('axios').get(fileUrl, { responseType: 'stream' })
      const writer = fs.createWriteStream(tempFilePath)
      response.data.pipe(writer)

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
      })

      const userVoiceFiles = fs.readdirSync(tempDir).filter(f => f.startsWith(`voice_${userId}_`))
      const segmentNumber = userVoiceFiles.length + 1

      let result = null
      try {
        if (process.env.ENABLE_SPEECH_TO_TEXT === 'true') {
          result = await localAIService.processVoiceMessage(tempFilePath, userId, segmentNumber, bot, chatId)
          await bot.sendMessage(chatId, `Результат обработки голосового сообщения: ${result}`)
        } else {
          logger.warn(logMessages.processing.speechToTextDisabled(userId))
          if (process.env.ENABLE_CHATGPT_FALLBACK === 'true') {
            await this.fallbackToChatGPT(bot, msg, '[Voice message - Speech-to-text disabled]', 'ENABLE_SPEECH_TO_TEXT is false')
          } else {
            await bot.sendMessage(chatId, messages.errors.voiceProcessingError)
          }
        }
      } catch (localError) {
        logger.warn(logMessages.processing.localAIFailed(userId, localError))
        if (localError.message && localError.message.startsWith('VALIDATION_FAILED:')) {
          const reason = localError.message.replace('VALIDATION_FAILED: ', '')
          await bot.sendMessage(chatId, `❌ **Заявку відхилено**\n\n${reason}\n\nБудь ласка, опишіть вашу проблему більш детально та конкретно.`, { parse_mode: 'Markdown' })
          return
        }
        if (process.env.ENABLE_CHATGPT_FALLBACK === 'true') {
          await this.fallbackToChatGPT(bot, msg, '[Voice message - local transcription failed, processing as general voice request]', localError.message)
        } else {
          await bot.sendMessage(chatId, messages.errors.voiceProcessingError)
        }
      }

      // Clean up temp file
      fs.unlink(tempFilePath, (err) => {
        if (err) logger.warn(logMessages.files.tempFileDeleteFailed, err)
      })

    } catch (error) {
      const errorInfo = error && (error.stack || error.message) ? (error.stack || error.message) : JSON.stringify(error)
      logger.error(logMessages.processing.voiceProcessingError(userId), errorInfo)
      await bot.sendMessage(chatId, messages.errors.voiceProcessingError)
    }
  }

  /**
   * Handle text messages
   */
  async handleTextMessage(bot, msg) {
    const chatId = msg.chat.id
    const userId = msg.from.id.toString()
    const messageText = msg.text

    try {
      // Check if user is in editing mode
      const session = sessionService.getSession(userId)
      if (session.editingTicket) {
        if (session.editingTicket.mode === 'text' || session.editingTicket.mode === 'full') {
          logger.info(`User ${userId} is in editing mode: ${session.editingTicket.mode}`)
          await this.processTicketEdit(bot, chatId, userId, messageText, session.editingTicket.mode)
          return
        } else if (session.editingTicket.mode.startsWith('field_')) {
          // User is editing a specific field
          const fieldName = session.editingTicket.fieldName
          await this.setFieldValue(bot, chatId, userId, session.editingTicket.ticketId, fieldName, messageText)
          return
        }
      }

      // Show processing indicator
      await bot.sendChatAction(chatId, 'typing')

      try {
        if (process.env.ENABLE_LOCAL_AI === 'true') {
          // Process text through local AI
          const result = await localAIService.processTextMessage(messageText, userId)

          // Save to history
          sessionService.addToHistory(userId, 'text_message', messageText)
          sessionService.addToHistory(userId, 'ai_response', result)

          // Create pending ticket for confirmation instead of sending directly
          await this.createPendingTicket(bot, chatId, userId, result, 'text')

        } else {
          // Local AI is disabled - skip to fallback
          logger.warn(logMessages.processing.localAIDisabled(userId))

          if (process.env.ENABLE_CHATGPT_FALLBACK === 'true') {
            await this.fallbackToChatGPT(bot, msg, messageText, 'ENABLE_LOCAL_AI is false')
          } else {
            await bot.sendMessage(chatId, messages.errors.textProcessingError)
          }
        }

      } catch (localError) {
        logger.warn(logMessages.processing.localAIFailed(userId, localError))

        // Check if this is a validation error
        if (localError.message && localError.message.startsWith('VALIDATION_FAILED:')) {
          const reason = localError.message.replace('VALIDATION_FAILED: ', '')
          await bot.sendMessage(chatId, `❌ **Заявку відхилено**\n\n${reason}\n\nБудь ласка, опишіть вашу проблему більш детально та конкретно.`, { parse_mode: 'Markdown' })
          return
        }

        // Check if ChatGPT fallback is enabled
        if (process.env.ENABLE_CHATGPT_FALLBACK === 'true') {
          // Fallback to ChatGPT if local services fail
          await this.fallbackToChatGPT(bot, msg, messageText, localError.message)
        } else {
          // Send error message without fallback
          await bot.sendMessage(chatId, messages.errors.textProcessingError)
        }
      }

    } catch (error) {
      logger.error(logMessages.processing.textProcessingError(userId), error)
      await bot.sendMessage(chatId, messages.errors.textProcessingError)
    }
  }


  /**
   * Show ticket with buttons to edit individual fields
   */
  async showTicketWithEditButtons(bot, chatId, userId, ticketId, pendingTicket) {
    // Parse current ticket fields
    const fields = this.parseTicketFields(pendingTicket.content)

    // Create ticket display with current values
    const ticketDisplay = `📋 **Редагування заявки по полях**\n\n` +
      `📝 **Заголовок:** ${fields.title || 'Не вказано'}\n` +
      `📄 **Опис:** ${fields.description || 'Не вказано'}\n` +
      `${this.getPriorityEmoji(fields.priority)} **Пріоритет:** ${fields.priority || 'Medium'}\n` +
      `📊 **Категорія:** ${fields.category || 'Не вказано'}\n\n` +
      `⬇️ **Оберіть поле для редагування:**`

    // Create keyboard with edit buttons for each field
    const editFieldsKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: messages.tickets.buttons.editTitle, callback_data: `editfield_title_${ticketId}` },
            { text: messages.tickets.buttons.editDescription, callback_data: `editfield_description_${ticketId}` }
          ],
          [
            { text: messages.tickets.buttons.save, callback_data: `confirm_${ticketId}` },
            { text: messages.tickets.buttons.cancel, callback_data: `cancel_${ticketId}` }
          ]
        ]
      }
    }

    await bot.sendMessage(chatId, ticketDisplay, editFieldsKeyboard)
  }

  /**
   * Parse ticket content to extract individual fields
   */
  parseTicketFields(content) {
    const fields = {}

    // Extract title
    const titleMatch = content.match(/📝\s*\*\*Заголовок:\*\*\s*(.+?)(?=\n|$)/i)
    fields.title = titleMatch ? titleMatch[1].trim() : ''

    // Extract description  
    const descMatch = content.match(/📄\s*\*\*Опис:\*\*\s*(.+?)(?=\n[🔴🟡🟢⚫]|\n📊|\n👤|$)/s)
    fields.description = descMatch ? descMatch[1].trim() : ''

    // Extract priority
    const priorityMatch = content.match(/[🔴🟡🟢⚫]\s*\*\*Пріоритет:\*\*\s*(.+?)(?=\n|$)/i)
    fields.priority = priorityMatch ? priorityMatch[1].trim() : 'Medium'

    // Extract category
    const categoryMatch = content.match(/📂\s*\*\*Категорія:\*\*\s*(.+?)(?=\n|$)/i)
    fields.category = categoryMatch ? categoryMatch[1].trim() : ''

    return fields
  }

  /**
   * Get priority emoji based on priority level
   */
  getPriorityEmoji(priority) {
    if (!priority) return '🟡'
    const p = priority.toLowerCase()
    if (p.includes('high') || p.includes('високий') || p.includes('высокий')) return '🔴'
    if (p.includes('low') || p.includes('низький') || p.includes('низкий')) return '🟢'
    if (p.includes('critical') || p.includes('критичний') || p.includes('критический')) return '⚫'
    return '🟡'
  }

  /**
   * Start editing a specific field
   */
  async startFieldEditing(bot, chatId, userId, ticketId, fieldName) {
    try {
      // Block editing of priority and category - system determines these automatically
      if (fieldName === 'priority' || fieldName === 'category') {
        await bot.sendMessage(chatId, '⚠️ **Це поле не редагується**\n\nПріоритет та категорія визначаються системою автоматично на основі змісту заявки.', { parse_mode: 'Markdown' })
        return
      }

      const session = sessionService.getSession(userId)

      if (!session.editingTicket) {
        session.editingTicket = {}
      }
      session.editingTicket.ticketId = ticketId
      session.editingTicket.mode = `field_${fieldName}`
      session.editingTicket.fieldName = fieldName
      sessionService.updateSession(userId, session)

      // Show appropriate input prompt based on field type
      const instruction = messages.tickets.fieldEditInstructions[fieldName]
      if (instruction) {
        await bot.sendMessage(chatId, instruction, { parse_mode: 'Markdown' })
      } else {
        await bot.sendMessage(chatId, `✏️ Введіть нове значення для поля "${fieldName}":`)
      }

    } catch (error) {
      logger.error(`Error starting field editing for ${fieldName}:`, error)
      await bot.sendMessage(chatId, messages.errors.generalError)
    }
  }

  /**
   * Set the value of a specific field and return to field editing view
   */
  async setFieldValue(bot, chatId, userId, ticketId, fieldName, newValue) {
    try {
      // Block editing of priority and category
      if (fieldName === 'priority' || fieldName === 'category') {
        await bot.sendMessage(chatId, '⚠️ **Це поле не редагується**\n\nПріоритет та категорія визначаються системою автоматично.', { parse_mode: 'Markdown' })
        return
      }

      const session = sessionService.getSession(userId)
      const pendingTicket = session.pendingTickets?.[ticketId]

      if (!pendingTicket) {
        await bot.sendMessage(chatId, messages.errors.ticketNotFound)
        return
      }

      // Update the specific field in ticket content
      const updatedContent = this.updateTicketField(pendingTicket.content, fieldName, newValue)

      // Update pending ticket
      pendingTicket.content = updatedContent
      pendingTicket.lastModified = new Date().toISOString()
      session.pendingTickets[ticketId] = pendingTicket

      // Reset editing mode to field selection
      session.editingTicket.mode = 'fields'
      sessionService.updateSession(userId, session)

      // Show success message
      await bot.sendMessage(chatId, `✅ Поле "${this.getFieldDisplayName(fieldName)}" оновлено!`)

      // Return to field editing view
      await this.showTicketWithEditButtons(bot, chatId, userId, ticketId, pendingTicket)

    } catch (error) {
      logger.error(`Error setting field ${fieldName}:`, error)
      await bot.sendMessage(chatId, messages.errors.generalError)
    }
  }

  /**
   * Update a specific field in ticket content
   */
  updateTicketField(content, fieldName, newValue) {
    switch (fieldName) {
      case 'title':
        return content.replace(/📝\s*\*\*Заголовок:\*\*\s*[^\n]+/i, `📝 **Заголовок:** ${newValue}`)

      case 'description':
        return content.replace(/📄\s*\*\*Опис:\*\*\s*(.+?)(?=\n[🔴🟡🟢⚫]|\n📊|\n👤|$)/s, `📄 **Опис:** ${newValue}`)

      case 'priority':
        const emoji = this.getPriorityEmoji(newValue)
        return content.replace(/[🔴🟡🟢⚫]\s*\*\*Пріоритет:\*\*\s*[^\n]+/i, `${emoji} **Пріоритет:** ${newValue}`)

      case 'category':
        return content.replace(/📂\s*\*\*Категорія:\*\*\s*[^\n]+/i, `📂 **Категорія:** ${newValue}`)

      default:
        return content
    }
  }

  /**
   * Get display name for field
   */
  getFieldDisplayName(fieldName) {
    const names = {
      title: 'Заголовок',
      description: 'Опис',
      priority: 'Пріоритет',
      category: 'Категорія'
    }
    return names[fieldName] || fieldName
  }

  /**
   * Convert ticket content from formatted display to editable plain text
   */
  convertToEditableFormat(content) {
    logger.info(`Converting to editable format: ${content.substring(0, 100)}...`)

    const result = content
      .replace(/📝\s*\*\*Заголовок:\*\*\s*/gi, 'Заголовок: ')
      .replace(/📄\s*\*\*Опис:\*\*\s*/gi, 'Опис: ')
      .replace(/[🔴🟡🟢⚫]\s*\*\*Пріоритет:\*\*\s*/gi, 'Пріоритет: ')
      .replace(/👤\s*\*\*Користувач:\*\*\s*/gi, 'Користувач: ')
      .replace(/📊\s*\*\*Категорія:\*\*\s*/gi, 'Категорія: ')
      .replace(/💻\s*\*\*Відділ:\*\*\s*/gi, 'Відділ: ')
      .replace(/📂\s*\*\*Категорія:\*\*\s*/gi, 'Категорія: ')
      .replace(/🌐\s*\*\*Мова:\*\*\s*/gi, 'Мова: ')
      .replace(/⏰\s*\*\*Створено:\*\*\s*/gi, 'Створено: ')
      .replace(/✅\s*\*\*Статус:\*\*\s*/gi, 'Статус: ')
      .replace(/📋\s*\*\*ID:\*\*\s*/gi, 'ID: ')
      .replace(/\*\*/g, '') // Remove all bold formatting
      .replace(/━+/g, '') // Remove separators
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('🎫') && !line.startsWith('⚠️'))
      .join('\n')
      .trim()

    logger.info(`Converted result: ${result}`)
    return result
  }

  /**
   * Convert editable plain text back to formatted ticket content
   */
  convertFromEditableFormat(editableText) {
    logger.info(`Converting from editable format: ${editableText}`)

    const lines = editableText.split('\n').map(line => line.trim()).filter(line => line)
    let content = ''

    // Keep the same structure as original ticket
    for (const line of lines) {
      const lowerLine = line.toLowerCase()

      if (lowerLine.startsWith('id:')) {
        const id = line.substring(3).trim()
        content += `📋 **ID:** ${id}\n`
      } else if (lowerLine.startsWith('відділ:')) {
        const dept = line.substring('відділ:'.length).trim()
        content += `� **Відділ:** ${dept}\n`
      } else if (lowerLine.startsWith('категорія:')) {
        const category = line.substring('категорія:'.length).trim()
        content += `� **Категорія:** ${category}\n`
      } else if (lowerLine.startsWith('пріоритет:')) {
        const priority = line.substring('пріоритет:'.length).trim()
        let emoji = '🟡' // Default Medium

        if (priority.toLowerCase().includes('high') || priority.toLowerCase().includes('високий') || priority.toLowerCase().includes('высокий')) {
          emoji = '🔴'
        } else if (priority.toLowerCase().includes('low') || priority.toLowerCase().includes('низький') || priority.toLowerCase().includes('низкий')) {
          emoji = '🟢'
        } else if (priority.toLowerCase().includes('critical') || priority.toLowerCase().includes('критичний') || priority.toLowerCase().includes('критический')) {
          emoji = '⚫'
        }

        content += `${emoji} **Пріоритет:** ${priority}\n`
      } else if (lowerLine.startsWith('заголовок:')) {
        const title = line.substring('заголовок:'.length).trim()
        content += `📝 **Заголовок:** ${title}\n`
      } else if (lowerLine.startsWith('опис:')) {
        const desc = line.substring('опис:'.length).trim()
        content += `� **Опис:** ${desc}\n`
      } else if (lowerLine.startsWith('мова:')) {
        const lang = line.substring('мова:'.length).trim()
        content += `🌐 **Мова:** ${lang}\n`
      } else if (lowerLine.startsWith('створено:')) {
        const created = line.substring('створено:'.length).trim()
        content += `⏰ **Створено:** ${created}\n`
      } else if (lowerLine.startsWith('статус:')) {
        const status = line.substring('статус:'.length).trim()
        content += `✅ **Статус:** ${status}\n`
      }
    }

    logger.info(`Converted back to formatted content: ${content}`)
    return content.trim()
  }

  /**
   * Start voice editing mode
   */
  async startVoiceEditing(bot, chatId, userId, ticketId) {
    try {
      const session = sessionService.getSession(userId)

      if (!session.editingTicket) {
        session.editingTicket = {}
      }
      session.editingTicket.ticketId = ticketId
      session.editingTicket.mode = 'voice'
      sessionService.updateSession(userId, session)

      await bot.sendMessage(chatId,
        messages.tickets.voiceEditInstruction,
        { parse_mode: 'Markdown' }
      )

    } catch (error) {
      logger.error(logMessages.tickets.editError(userId, ticketId), error)
      await bot.sendMessage(chatId, messages.errors.generalError)
    }
  }

  /**
   * Return to ticket preview
   */
  async backToTicketPreview(bot, chatId, userId, ticketId) {
    try {
      const session = sessionService.getSession(userId)
      const pendingTicket = session.pendingTickets?.[ticketId]

      if (!pendingTicket) {
        await bot.sendMessage(chatId, messages.errors.ticketNotFound)
        return
      }

      // Clear editing mode
      session.editingTicket = null
      sessionService.updateSession(userId, session)

      // Show ticket preview again
      const confirmationKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: messages.tickets.buttons.confirm, callback_data: `confirm_${ticketId}` },
              { text: messages.tickets.buttons.cancel, callback_data: `cancel_${ticketId}` }
            ],
            [
              { text: messages.tickets.buttons.edit, callback_data: `edit_${ticketId}` }
            ]
          ]
        }
      }

      const ticketPreview = messages.tickets.preview(pendingTicket.content)

      await bot.sendMessage(chatId, ticketPreview, {
        ...confirmationKeyboard,
        parse_mode: 'Markdown'
      })

    } catch (error) {
      logger.error(logMessages.tickets.editError(userId, ticketId), error)
      await bot.sendMessage(chatId, messages.errors.generalError)
    }
  }

  /**
   * Create pending ticket for user confirmation
   */
  async createPendingTicket(bot, chatId, userId, ticketContent, sourceType) {
    try {
      // Note: Ticket validation is now performed earlier in localAI.processText()
      // before this function is called, so no need to validate here

      // Generate unique ticket ID
      const ticketId = `TKT-${Date.now()}`

      // Get or initialize session
      const session = sessionService.getSession(userId)
      if (!session.pendingTickets) {
        session.pendingTickets = {}
      }

      // Store pending ticket
      session.pendingTickets[ticketId] = {
        id: ticketId,
        content: ticketContent,
        sourceType: sourceType,
        createdAt: new Date().toISOString(),
        userId: userId
      }
      sessionService.updateSession(userId, session)

      // Create confirmation keyboard
      const confirmationKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: messages.tickets.buttons.confirm, callback_data: `confirm_${ticketId}` },
              { text: messages.tickets.buttons.cancel, callback_data: `cancel_${ticketId}` }
            ],
            // [
            //   { text: messages.tickets.buttons.edit, callback_data: `edit_${ticketId}` }
            // ]
          ]
        }
      }

      // Send ticket preview with confirmation buttons
      const ticketPreview = messages.tickets.preview(ticketContent)

      const sentMessage = await bot.sendMessage(chatId, ticketPreview, {
        ...confirmationKeyboard,
        parse_mode: 'Markdown'
      })

      if (!session.messages) {
        session.messages = {}
      }

      session.messages[ticketId] = sentMessage.message_id
      sessionService.updateSession(userId, session)

      logger.info(`Message with keyboard sent. Saved message_id: ${sentMessage.message_id} for user ${userId}`)
      const updatedSession = sessionService.getSession(userId)
      logger.debug(`Retrieved session data after update for user ${userId}: ${JSON.stringify(updatedSession)}`)
    } catch (error) {
      logger.error(logMessages.tickets.createError(userId), error)
      await bot.sendMessage(chatId, messages.errors.ticketCreateError)
    }
  }

  async sendMessageWithKeyboard(bot, chatId, userId, text, keyboard) {
    try {
      const sentMessage = await bot.sendMessage(chatId, text, {
        reply_markup: { inline_keyboard: keyboard }
      })

      // Save the message_id in the session for this specific user and message
      const session = sessionService.getSession(userId) || {}
      if (!session.messages) {
        session.messages = {}
      }

      // Ensure unique association of message_id with the text
      session.messages[text] = sentMessage.message_id
      sessionService.updateSession(userId, session)

      logger.info(`Message with keyboard sent. Saved message_id: ${sentMessage.message_id} for user ${userId}`)
    } catch (error) {
      logger.error(`Failed to send message with keyboard:`, error)
    }
  }

  async removeKeyboard(bot, callbackQuery) {
    if (!(callbackQuery && callbackQuery.message)) {
      logger.warn('Callback query or message data is missing')
      return
    }

    const chatId = callbackQuery.message.chat.id
    const userId = callbackQuery.from.id.toString()
    const session = sessionService.getSession(userId)

    // Try to extract ticketId from callback data (format: action_ticketId or editfield_...)
    let ticketId = null
    if (callbackQuery.data) {
      const parts = callbackQuery.data.split('_')
      if (parts.length >= 2) {
        ticketId = parts.slice(1).join('_')
      }
    }

    let messageId = null
    if (ticketId && session && session.messages && session.messages[ticketId]) {
      messageId = session.messages[ticketId]
    } else if (session && session.messages && callbackQuery.message.text) {
      // Fallback for messages stored by full text
      messageId = session.messages[callbackQuery.message.text]
    }

    if (messageId) {
      try {
        await bot.editMessageReplyMarkup(
          null,
          { chat_id: chatId, message_id: messageId }
        )
        logger.info(`Inline keyboard removed for message ${messageId} of user ${userId}`)

        // Clean up the saved message_id after removing the keyboard
        if (ticketId && session && session.messages && session.messages[ticketId]) {
          delete session.messages[ticketId]
        } else if (callbackQuery.message.text && session && session.messages && session.messages[callbackQuery.message.text]) {
          delete session.messages[callbackQuery.message.text]
        }
        sessionService.updateSession(userId, session)
      } catch (error) {
        logger.error(`Failed to remove inline keyboard for message ${messageId} of user ${userId}:`, error)
      }
    } else {
      logger.warn(`No message_id found for user ${userId} to remove inline keyboard. Session messages: ${JSON.stringify(session?.messages)}`)
    }

    // Confirm the callback query to avoid hanging
    try {
      await bot.answerCallbackQuery(callbackQuery.id)
    } catch (error) {
      logger.error(`Failed to answer callback query for user ${userId}:`, error)
    }
  }
}

module.exports = new MessageHandler()
