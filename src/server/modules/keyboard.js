const buttonsConfig = {
  guestStartButtons: {
    title: 'Оберіть, будь ласка, дію',
    options: [{ resize_keyboard: true }],
    buttons: [
      [{ text: 'Зареєструватися', callback_data: '0_3' }],
      [{ text: 'Зареєструватися (!для старих Windows | Unix)', callback_data: '0_5' }],
      [{ text: 'Надіслати повідомлення', callback_data: '0_2' }],
      [{ text: '🏠', callback_data: '0_4' }]
    ]
  },
  userApproveByAdmin: {
    title: 'Оберіть, будь ласка, дію',
    options: [{ resize_keyboard: true }],
    buttons: [
      [{ text: '✅Активувати нового користувача', callback_data: '8_1' }],
      [{ text: '⛔Заблокувати користувача', callback_data: '8_2' }],
      [{ text: '⤴️', callback_data: '13_3' }]
    ]
  },
  userCreateButtons: {
    title: 'Оберіть, будь ласка, дію',
    options: [{ resize_keyboard: true }],
    buttons: [
      [{ text: '📧 Ввести email', callback_data: '0_10' }],
      [{ text: '🧑🏼 Ввести Прізвище та ім`я', callback_data: '0_11' }],
      [{ text: '📞 Ввести номер телефону', callback_data: '0_12' }],
      [{ text: '📌 Зареєструвати користувача', callback_data: '0_13' }],
      [{ text: '🏠', callback_data: '0_4' }]
    ]
  },
  standardStartButtons: {
    title: 'Оберіть, будь ласка, дію',
    options: [{ resize_keyboard: true }],
    buttons: [
      [{ text: '➕ Створити нову заявку', callback_data: '2_1' }],
      [{ text: '📒 Переглянути відкриті заявки', callback_data: '2_2' }],
      [{ text: '📘 Заявки, що виконані та очікують Вашого затвердження', callback_data: '2_3' }],
      [{ text: '📗 Переглянути заявки, що вже є виконаними', callback_data: '2_4' }],
      [{ text: '📊 Звітність', callback_data: '2_5' }],
      [{ text: '🏠', callback_data: '0_4' }]
    ]
  },
  ticketCreate: {
    title: 'Оберіть, будь ласка, дію',
    options: [{ resize_keyboard: true }],
    buttons: [
      [{ text: '🟣 Ввести змістовну тему заявки (не < ніж 7 символів)', callback_data: '5_1' }],
      [{ text: '🔵 Ввести зміст (такий, щоб не перепитувати про що йдеться)', callback_data: '5_2' }],
      [{ text: '🏢 Додати картинку до заявки (1 клік = 1 картинка!)', callback_data: '5_5' }],
      [{ text: '🧷 Додати файл-вкладення до заявки (1 клік = 1 файл!)', callback_data: '5_3' }],
      [{ text: '📌 Зареєструвати заявку', callback_data: '5_4' }],
      [{ text: '↩️', callback_data: '3_3' }]
    ]
  },

  ticketApproval: {
    title: 'Оберіть, будь ласка, дію',
    options: [{ resize_keyboard: true }],
    buttons: [
      [{ text: '💹Затвердити виконання заявки', callback_data: '7_1' }],
      [{ text: '⭕Повернути заявку на доопрацювання', callback_data: '7_2' }],
      [{ text: '↩️', callback_data: '3_3' }]
    ]
  },

  clientAdminStarterButtons: {
    title: 'Оберіть, будь ласка, дію',
    options: [{ resize_keyboard: true }],
    buttons: [
      [{ text: 'Отримати інформацію про користувача', callback_data: '3_1' }],
      [{ text: 'Надіслати відповідь на звернення', callback_data: '3_2' }],
      [{ text: '🏠', callback_data: '0_4' }]
    ]
  },

  chooseReportSettings: {
    title: 'Оберіть, будь ласка, період формування звіту:',
    options: [{ resize_keyboard: true }],
    buttons: [
      [{ text: '👨‍👨‍👦 Обрати підрозділ(и)', callback_data: '9_1' }],
      [{ text: '📆 Обрати період', callback_data: '9_2' }],
      [{ text: '📉 Отримати звіт', callback_data: '9_3' }],
      [{ text: '↩️', callback_data: '3_3' }]
    ]
  },

  chooseTypeOfPeriod: {
    title: 'Оберіть, будь ласка, період формування звіту:',
    options: [{ resize_keyboard: true }],
    buttons: [
      [{ text: '🌙Сьогодні', callback_data: 'today' }],
      [{ text: '🌔Останній тиждень', callback_data: 'last_week' }],
      [{ text: '🌗 Останній місяць', callback_data: 'last_month' }],
      [{ text: '🌕 Останній рік', callback_data: 'last_year' }],
      [{ text: '🌛🌜Інший період', callback_data: 'any_period' }],
      [{ text: '↖️', callback_data: 'x_x' }]
    ]
  },

}

module.exports = { buttonsConfig }
