const { buttonsConfig } = require('../modules/keyboard')
const inputLineScene = require('./inputLine')
const { createOrUpdateUserIntoDb } = require('../db/tgUsersService')
const GROUP_ID = Number(process.env.GROUP_ID)
const SENDER = process.env.SENDER

async function signUpForm(bot, msg, webAppUrl) {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, 'Нижче з`явиться кнопка, заповніть форму', {
    reply_markup: {
      keyboard: [
        // [{ text: 'Заповнити форму', web_app: { url: webAppUrl + '/form' } }]
        [{ text: 'Заповнити форму', web_app: { url: webAppUrl + '/reg-form-tg-bot' } }],
        [{ text: '🏠', callback_data: '0_4' }]
      ],
      resize_keyboard: true
    }
  })
}

async function singUpDataSave(bot, chatId, data) {
  console.log(chatId, data);
  const signUpRezult = await createOrUpdateUserIntoDb(chatId, data)
  console.log(signUpRezult)
  const message = {
    from: SENDER,
    to: SENDER,
    subject: 'Registration event from tg-bot',
    text: 'chatId:' + chatId,
    html: 'data:' + JSON.stringify(data),
  }
  try {
    await bot.sendMessage(GROUP_ID, `Заповнена нова реєстраційна форма. Контент: ${JSON.stringify(data)},chatId=${chatId}  \n`, { parse_mode: "HTML" })
    console.log('Registration message sent', message);
  }
  catch (err) {
    console.log(err);
  }
}

async function signUpOldForm(bot, msg) {
  try {
    const chatId = msg.chat.id
    await bot.sendMessage(chatId, buttonsConfig["userCreateButtons"].title, {
      reply_markup: {
        keyboard: buttonsConfig["userCreateButtons"].buttons,
        resize_keyboard: true,
        one_time_keyboard: false
      }
    })
  } catch (err) {
    userCreateButtonsconsole.log(err)
  }
}

async function usersTextInput(bot, msg, menuItem, selectedByUser) {
  try {
    const txtCommand = await inputLineScene(bot, msg)
    if (menuItem === '0_10') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(txtCommand)) {
        await bot.sendMessage(msg.chat.id, 'Незрозуміле введення <b>email</b>. Операцію скасовано\n', { parse_mode: 'HTML' })
        return selectedByUser
      }
      bot.sendMessage(msg.chat.id, 'Поверніться до меню та оберіть <b>Ввести Прізвище та ім`я</b>\n', { parse_mode: 'HTML' })
      selectedByUser = { ...selectedByUser, userEmail: txtCommand }
    } else if (menuItem === '0_11') {
      if (txtCommand.length < 5) {
        await bot.sendMessage(msg.chat.id, 'Незрозуміле введення <b>Прізвища та ім`я</b>. Операцію скасовано\n', { parse_mode: 'HTML' })
        return selectedByUser
      }
      await bot.sendMessage(msg.chat.id, 'Поверніться до меню та оберіть <b>Ввести номер телефону</b>\n', { parse_mode: 'HTML' })
      selectedByUser = { ...selectedByUser, userPIB: txtCommand }
    } else if (menuItem === '0_12') {
      const newtxtCommand = txtCommand.replace(/\D/g, '')
      if (/^\d{7,12}$/.test(newtxtCommand)) {
        await bot.sendMessage(msg.chat.id, 'Незрозуміле введення <b>Номеру телефону</b>. Операцію скасовано\n', { parse_mode: 'HTML' })
        return selectedByUser
      }
      await bot.sendMessage(msg.chat.id, 'Поверніться до меню та оберіть <b>Зареєструвати користувача</b>\n', { parse_mode: 'HTML' })
      selectedByUser = { ...selectedByUser, userPhoneNumber: newtxtCommand }
    }
    return selectedByUser
  } catch (err) {
    console.log(err)
    return selectedByUser
  }
}

async function usersRegistration(bot, msg, selectedByUser) {
  try {
    if (!selectedByUser?.userEmail) {
      await bot.sendMessage(msg.chat.id, 'Не заповнен Email. Операцію скасовано\n', { parse_mode: 'HTML' })
      return
    }
    if (!selectedByUser?.userPIB) {
      await bot.sendMessage(msg.chat.id, 'Не заповнені прізвище та ім`я. Операцію скасовано\n', { parse_mode: 'HTML' })
      return
    }
    if (!selectedByUser?.userPhoneNumber) {
      await bot.sendMessage(msg.chat.id, 'Не заповнен ермер телефону. Операцію скасовано\n', { parse_mode: 'HTML' })
      return
    }

    const data = {
      email: selectedByUser?.userEmail,
      PIB: selectedByUser?.userPIB,
      phoneNumber: selectedByUser?.userPhoneNumber,
      contract: '',
      address: '',
    }

    console.log(data)
    await singUpDataSave(bot, msg.chat.id, data)
    await bot.sendMessage(msg.chat.id, 'Дякую, Реєстрація пройшла успішно!')
    await bot.sendMessage(msg.chat.id, 'Ваш emal: ' + data?.email)
    await bot.sendMessage(msg.chat.id, 'Ваші прізвище та ім`я: ' + data?.PIB)
    await bot.sendMessage(msg.chat.id, 'Ваш номер телефону: ' + data?.phoneNumber)
    await bot.sendMessage(msg.chat.id, 'Всю необхідну інформацію Ви можете отримувати в цьому чаті. Якщо у Вас виникли питання, звертайтесь через меню /"Надіслати повідомлення/". Зараз для переходу в головне меню натисніть /start')
  } catch (err) {
    console.log(err)
  }
}

module.exports = { signUpForm, singUpDataSave, signUpOldForm, usersTextInput, usersRegistration }


