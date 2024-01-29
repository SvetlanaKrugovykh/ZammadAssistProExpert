const { buttonsConfig } = require('../modules/keyboard')
const { createReport, getGroups } = require('../db/tgReportsService')
const Calendar = require('telegram-inline-calendar')
const globalBuffer = require('../globalBuffer')

module.exports.reports = async function (bot, msg) {
  const checkChoices = await checkSelectedGroupsAndPeriod(bot, msg)
  let title = ''
  if (checkChoices) {
    title = 'Натисніть: Отримати звіт з виконання заявок'
  } else {
    title = buttonsConfig.chooseReportSettings.title
  }

  await bot.sendMessage(msg.chat.id, title, {
    reply_markup: {
      keyboard: buttonsConfig.chooseReportSettings.buttons,
      resize_keyboard: true
    }
  })
}

module.exports.chooseTypeOfPeriod = async function (bot, msg) {
  chatId = msg.chat.id
  if (globalBuffer[chatId] === undefined) globalBuffer[chatId] = {}
  globalBuffer[chatId].selectedPeriod = undefined

  await bot.sendMessage(msg.chat.id, buttonsConfig.chooseTypeOfPeriod.title, {
    reply_markup: {
      keyboard: buttonsConfig.chooseTypeOfPeriod.buttons,
      resize_keyboard: true
    }
  })
}

module.exports.chooseGroups = async function (bot, msg) {
  const data = await getGroups()
  const chatId = msg.chat.id

  if (!data && data.length === 0) {
    await bot.sendMessage(msg.chat.id, 'На жаль, на даний момент немає доступних груп.')
    return
  }

  if (globalBuffer[chatId] === undefined) globalBuffer[chatId] = {}
  globalBuffer[chatId].availableGroups = data
  globalBuffer[chatId].selectedGroups = []

  const groupsButtons = {
    title: 'Оберіть будь ласка групу(и):',
    options: [{ resize_keyboard: true }],
    buttons: data.map(group => [
      { text: `👩‍👩‍👧‍👧 ${group.name} `, callback_data: `53_${group.id}` }
    ])
  }
  await bot.sendMessage(msg.chat.id, groupsButtons.title, {
    reply_markup: {
      inline_keyboard: groupsButtons.buttons,
      resize_keyboard: true
    }
  })
}



module.exports.getReport = async function (bot, msg) {

  const checkChoices = await checkSelectedGroupsAndPeriod(bot, msg)
  if (checkChoices) {
    await createReport(bot, msg)
    globalBuffer[chatId] = {}
  }
}

module.exports.selectPeriod = async function (bot, msg) {

  const periodDetails = {
    '🌗': { name: 'last_month', description: 'за останній місяць' },
    '🌔': { name: 'last_week', description: 'за останній тиждень' },
    '🌛': { name: 'any_period', description: 'за довільний період' },
    '🌕': { name: 'last_year', description: 'за останній рік' },
    '🌙': { name: 'today', description: 'сьогодні' },
  }

  try {
    const periodSign = msg.text.split(' ')[0]
    const periodInfo = periodDetails[periodSign]

    await bot.sendMessage(msg.chat.id, `Ви обрали період: ${periodInfo.description}`)
    try {
      if (globalBuffer[chatId] === undefined) globalBuffer[chatId] = {}
      let selectedPeriod = globalBuffer[chatId].selectedPeriod || {}
      selectedPeriod.periodName = periodInfo.name
      globalBuffer[chatId].selectedPeriod = selectedPeriod
    } catch (e) {
      console.log(e)
    }

  } catch (e) {
    console.log(e)
  }
}

async function checkSelectedGroupsAndPeriod(bot, msg) {
  const chatId = msg.chat.id
  try {
    console.log(`2_selectedGroups for  ${chatId} is ${globalBuffer[chatId]?.selectedGroups}`)
    if (!globalBuffer[chatId]?.selectedGroups || globalBuffer[chatId]?.selectedGroups?.length === 0) {
      await bot.sendMessage(chatId, 'Ви не обрали жодної групи')
      return false
    }
    if (globalBuffer[chatId]?.selectedPeriod === undefined) {
      await bot.sendMessage(chatId, 'Ви не обрали період')
      return false
    }
    return true
  } catch (e) {
    console.log(e)
    return false
  }
}

async function checkAndSetSelectedPeriod(_bot, msg, periodName = '', dataType = '') {
  const chatId = msg.chat.id
  if (globalBuffer[chatId] === undefined) globalBuffer[chatId] = {}
  let selectedPeriod = globalBuffer[chatId].selectedPeriod || {}
  selectedPeriod.periodName = periodName

  if (dataType === 'кінцеву' && selectedPeriod?.start === undefined) {
    try {
      await new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (globalBuffer[chatId].selectedPeriod?.start !== undefined) {
            clearInterval(checkInterval)
            clearTimeout(failureTimeout)
            resolve()
          }
        }, 1000)

        const failureTimeout = setTimeout(() => {
          clearInterval(checkInterval)
          reject(new Error('Timeout waiting for selectedPeriod.start to be filled'))
        }, 5 * 60 * 1000)
      })
    } catch (error) {
      console.error(error)
      return
    }
  }
  return selectedPeriod
}

module.exports.chooseData = async function (bot, msg, dataType = '') {
  const chatId = msg.chat.id
  let selectedPeriod = await checkAndSetSelectedPeriod(bot, msg, 'any_period', dataType)
  bot.sendMessage(chatId, `Натисніть на кнопку в календарі щоб обрати ${dataType} дату.`)
  const calendar = new Calendar(bot, {
    date_format: 'DD-MM-YYYY',
    language: process.env.CALENDAR_LANG || 'uk'
  })
  calendar.startNavCalendar(msg)
  bot.on("callback_query", (query) => {
    if (query.message.message_id == calendar.chats.get(query.message.chat.id)) {
      var res
      res = calendar.clickButtonCalendar(query)
      if (res !== -1) {
        bot.sendMessage(query.message.chat.id, `Ви обрали ${dataType} дату: ${res}`)
        try {
          let dateStr = res //'05-01-2024'
          let parts = dateStr.split('-')
          let date = new Date(Date.UTC(parts[2], parts[1] - 1, parts[0]))

          if (dataType === 'початкову') {
            selectedPeriod.start = date
            globalBuffer[chatId].selectedPeriod = selectedPeriod
          } else if (dataType === 'кінцеву') {
            globalBuffer[chatId].selectedPeriod.end = date
          }
        } catch (e) {
          console.log(e)
        }
      }
    }
  })
}