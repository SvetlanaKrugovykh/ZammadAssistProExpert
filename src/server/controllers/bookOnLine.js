
const sendReqToDB = require('../modules/tlg_to_DB')
const { buttonsConfig } = require('../modules/keyboard')
const inputLineScene = require('./inputLine')

//#region staticKeyboad
async function bookOnLineScene(bot, msg) {
  try {
    const chatId = msg.chat.id
    await bot.sendMessage(chatId, buttonsConfig["locationsButtons"].title, {
      reply_markup: {
        keyboard: buttonsConfig["locationsButtons"].buttons,
        resize_keyboard: true
      }
    })
  } catch (err) {
    console.log(err)
  }
}

async function masterOrServiceOrAnyScene(bot, msg) {
  try {
    const chatId = msg.chat.id
    await bot.sendMessage(chatId, buttonsConfig["masterOrServiceButtons"].title, {
      reply_markup: {
        keyboard: buttonsConfig["masterOrServiceButtons"].buttons,
        resize_keyboard: true
      }
    })

  } catch (err) {
    console.log(err)
  }
}
//#endregion

async function bookMasterScene(bot, msg, selectedByUser) {
  try {
    const chatId = msg.chat.id
    if (selectedByUser === undefined || !selectedByUser[chatId]?.location_id) {
      await bot.sendMessage(chatId, 'Оберіть будь ласка локацію')
      return
    }
    const location_id = selectedByUser[chatId].location_id
    const data = await sendReqToDB('__GetMasters__', msg.chat, location_id)
    const parsedData = JSON.parse(data).ResponseArray
    if (parsedData.length !== 0 && parsedData[0] !== null && parsedData[0] !== 'nothing found') {
      const mastersButtons = {
        title: 'Оберіть будь ласка майстра',
        options: [{ resize_keyboard: true }],
        buttons: parsedData.map(master => [
          { text: `${master.name} #${master.jobTitle} `, callback_data: `33_${master.id}` }
        ])
      }
      mastersButtons.buttons.push([{ text: '↖️', callback_data: '0_1' }])
      await bot.sendMessage(chatId, mastersButtons.title, {
        reply_markup: {
          keyboard: mastersButtons.buttons,
          resize_keyboard: true
        }
      })
    } else {
      if (location_id) {
        await bot.sendMessage(chatId, 'На жаль, на даний момент немає доступних майстрів. Спробуйте пізніше.')
      } else {
        await bot.sendMessage(chatId, 'Оберіть будь ласка локацію')
      }
    }
  } catch (err) {
    console.log(err)
  }
}

async function bookServiceScene(bot, msg, selectedByUser) {
  try {
    const chatId = msg.chat.id
    if (selectedByUser === undefined || !selectedByUser[chatId]?.location_id) {
      await bot.sendMessage(chatId, 'Оберіть будь ласка локацію')
      return
    }
    const location_id = selectedByUser[chatId].location_id
    const data = await sendReqToDB('__GetServices__', msg.chat, location_id)
    const parsedData = JSON.parse(data).ResponseArray
    if (parsedData.length !== 0 && parsedData[0] !== null && parsedData[0] !== 'nothing found') {
      const servicesButtons = {
        title: 'Оберіть будь ласка послугу',
        options: [{ resize_keyboard: true }],
        buttons: parsedData.map(service => [
          { text: `○ ${service.name} `, callback_data: `43_${service.id}` }
        ])
      }
      servicesButtons.buttons.push([{ text: '↖️', callback_data: '0_1' }])
      await bot.sendMessage(chatId, servicesButtons.title, {
        reply_markup: {
          //inline_keyboard: servicesButtons.buttons,
          keyboard: servicesButtons.buttons,
          resize_keyboard: true
        }
      })
    } else {
      await bot.sendMessage(chatId, 'На жаль, на даний момент немає доступних послуг. Спробуйте пізніше.')
    }

  } catch (err) {
    console.log(err)
  }
}

async function bookAnyScene(bot, msg, selectedByUser) {
  try {
    const chatId = msg.chat.id
    if (selectedByUser === undefined || !selectedByUser[chatId]?.location_id) {
      await bot.sendMessage(chatId, 'Оберіть будь ласка локацію')
      return
    }
    await bot.sendMessage(msg.chat.id, buttonsConfig["anyChoiceButtons"].title, {
      reply_markup: {
        keyboard: buttonsConfig["anyChoiceButtons"].buttons,
        resize_keyboard: true
      }
    })

  } catch (err) {
    console.log(err)
  }
}

async function bookTimeScene(bot, msg, selectedByUser) {
  try {
    const chatId = msg.chat.id
  } catch (err) {
    console.log(err)
  }
}

module.exports = { bookOnLineScene, bookMasterScene, bookServiceScene, bookAnyScene, bookTimeScene, masterOrServiceOrAnyScene }