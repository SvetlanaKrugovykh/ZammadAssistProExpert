const buttonsConfig = {
  guestStartButtons: {
    title: 'Оберіть, будь ласка, дію',
    options: [{ resize_keyboard: true }],
    buttons: [
      [{ text: 'Надіслати повідомлення', callback_data: '0_2' }],
      [{ text: 'Зареєструватися', callback_data: '0_3' }],
      [{ text: '🏠', callback_data: '0_4' }]
    ]
  },

  standardStartButtons: {
    title: 'Оберіть, будь ласка, дію',
    options: [{ resize_keyboard: true }],
    buttons: [
      [{ text: '➕ Створити нову заявку', callback_data: '2_1' }],
      [{ text: '📘 Переглянути відкриті заявки', callback_data: '2_2' }],
      [{ text: '✔️ Переглянути заявки, що вже є виконаними', callback_data: '2_3' }],
      [{ text: '🏠', callback_data: '0_4' }]
    ]
  },

  clientAdminStarterButtons: {
    title: 'Оберіть, будь ласка, дію',
    options: [{ resize_keyboard: true }],
    buttons: [
      [{ text: 'Отримати інформацію про користувача', callback_data: '3_1' }],
      [{ text: 'Надіслати відповідь на звернення', callback_data: '3_2' }],
      [{ text: '🏠', callback_data: '3_3' }]
    ]
  }
}

module.exports = { buttonsConfig }


