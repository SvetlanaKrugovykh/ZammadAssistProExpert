const buttonsConfig = {
	guestStartButtons: {
		title: "Оберіть, будь ласка, дію",
		options: [{ resize_keyboard: true }],
		buttons: [
			[{ text: "Зареєструватися", callback_data: "0_3" }],
			[
				{
					text: "Зареєструватися (!для старих Windows | Unix)",
					callback_data: "0_5",
				},
			],
			[{ text: "Надіслати повідомлення", callback_data: "0_2" }],
			[{ text: "🏠", callback_data: "0_4" }],
		],
	},
	userApproveByAdmin: {
		title: "Оберіть, будь ласка, дію",
		options: [{ resize_keyboard: true }],
		buttons: [
			[{ text: "✅Активувати нового користувача", callback_data: "8_1" }],
			[{ text: "⛔Заблокувати користувача", callback_data: "8_2" }],
			[{ text: "⤴️", callback_data: "13_3" }],
		],
	},
	userCreateButtons: {
		title: "Оберіть, будь ласка, дію",
		options: [{ resize_keyboard: true }],
		buttons: [
			[{ text: "📧 Ввести email", callback_data: "0_10" }],
			[{ text: "🧑🏼 Ввести Прізвище та ім`я", callback_data: "0_11" }],
			[{ text: "📞 Ввести номер телефону", callback_data: "0_12" }],
			[{ text: "📌 Зареєструвати користувача", callback_data: "0_13" }],
			[{ text: "🏠", callback_data: "0_4" }],
		],
	},
	standardStartButtons: {
		title: "Оберіть, будь ласка, дію",
		options: [{ resize_keyboard: true }],
		buttons: [
			[
				{
					text: "➕ Створити нову заявку",
					callback_data: "5_2",
				},
			], //2_1
			[
				{
					text: "📕 Заявки, що потребують Вашого уточнення та доповнення",
					callback_data: "2_11",
				},
			],
			[{ text: "📒 Переглянути відкриті заявки", callback_data: "2_2" }],
			[
				{
					text: "📘 Заявки, що виконані та очікують Вашого затвердження",
					callback_data: "2_3",
				},
			],
			[
				{
					text: "📗 Переглянути заявки, що вже є виконаними",
					callback_data: "2_4",
				},
			],
			[{ text: "🏠", callback_data: "0_4" }],
		],
	},

	standardStartButtonsPlus: {
		title: "Оберіть, будь ласка, дію",
		options: [{ resize_keyboard: true }],
		buttons: [
			[
				{
					text: "➕ Створити нову заявку",
					callback_data: "5_2",
				},
			], //2_1
			[
				{
					text: "📕 Заявки, що потребують Вашого уточнення та доповнення",
					callback_data: "2_11",
				},
			],
			[{ text: "📒 Переглянути відкриті заявки", callback_data: "2_2" }],
			[
				{
					text: "📘 Заявки, що виконані та очікують Вашого затвердження",
					callback_data: "2_3",
				},
			],
			[
				{
					text: "📗 Переглянути заявки, що вже є виконаними",
					callback_data: "2_4",
				},
			],
			[{ text: "📊 Звітність", callback_data: "2_5" }],
			[{ text: "📧 Відправка повідомлень", callback_data: "2_7" }],
			[{ text: "🏠", callback_data: "0_4" }],
		],
	},

	ticketCreate: {
		title: "Оберіть, будь ласка, дію",
		options: [{ resize_keyboard: true }],
		buttons: [
			//      [{ text: '🟣 Ввести змістовну тему заявки (не < ніж 7 символів)', callback_data: '5_1' }],
			//      [{ text: '🔵 Описати проблему (текстом або голосом) (так, щоб не перепитувати про що йдеться)', callback_data: '5_2' }],
			//      [{ text: '🏢 Додати картинку до заявки (1 клік = 1 картинка!)', callback_data: '5_5' }],
			[{ text: "📌 Зареєструвати заявку", callback_data: "5_4" }],
			[{ text: "🧷 Додати файл до заявки", callback_data: "5_3" }],
			[{ text: "🏷 Змінити тему (опціонально)", callback_data: "5_6" }],
			[{ text: "↩️", callback_data: "3_3" }],
		],
	},

	messageCreate: {
		title: "Оберіть, будь ласка, дію",
		options: [{ resize_keyboard: true }],
		buttons: [
			[{ text: "🔵 Ввести текст відправлення", callback_data: "5_2" }],
			// [{ text: '🏢 Додати картинку до відправлення (1 клік = 1 картинка!)', callback_data: '5_5' }],
			[{ text: "🧷 Додати файл до відправлення", callback_data: "5_3" }],
			[{ text: "✉  Відправити повідомлення", callback_data: "15_4" }],
			[{ text: "↩️", callback_data: "3_3" }],
		],
	},

	ticketUpate: {
		title: "Оберіть, будь ласка, дію",
		options: [{ resize_keyboard: true }],
		buttons: [
			[{ text: "🔵 Ввести коментар до заявки", callback_data: "5_2" }],
			//      [{ text: '🏢 Додати картинку до заявки (1 клік = 1 картинка!)', callback_data: '5_5' }],
			[{ text: "🧷 Додати файл до заявки", callback_data: "5_3" }],
			[{ text: "📌 Оновити заявку", callback_data: "5_14" }],
			[{ text: "↩️", callback_data: "3_3" }],
		],
	},

	callTicketUpdate: {
		title: "Оберіть, будь ласка, дію:",
		options: [{ resize_keyboard: true }],
		buttons: [
			[{ text: "☎︎ Відповідсти на додатковий запит", callback_data: "5_17" }],
			[{ text: "↩️", callback_data: "3_3" }],
		],
	},

	ticketApproval: {
		title: "Оберіть, будь ласка, дію",
		options: [{ resize_keyboard: true }],
		buttons: [
			[{ text: "💹Затвердити виконання заявки", callback_data: "7_1" }],
			[{ text: "⭕Повернути заявку на доопрацювання", callback_data: "7_2" }],
			[{ text: "↩️", callback_data: "3_3" }],
		],
	},
	clientAdminStarterButtons: {
		title: "Оберіть, будь ласка, дію",
		options: [{ resize_keyboard: true }],
		buttons: [
			[{ text: "Отримати інформацію про користувача", callback_data: "3_1" }],
			[{ text: "Надіслати відповідь на звернення", callback_data: "3_2" }],
			[{ text: "🏠", callback_data: "0_4" }],
		],
	},

	chooseReportSettings: {
		title:
			"Оберіть, будь ласка, групу, період і натисніть Отримати звіт з виконання заявок:",
		options: [{ resize_keyboard: true }],
		buttons: [
			[{ text: "👨‍👨‍👦 Обрати групу(и)", callback_data: "9_1" }],
			[{ text: "📆 Обрати період", callback_data: "9_2" }],
			[{ text: "📉 Отримати звіт з виконання заявок", callback_data: "9_3" }],
			[
				{
					text: "❌ Отримати звіт з недоступності сервісів",
					callback_data: "9_4",
				},
			],
			[{ text: "↩️", callback_data: "3_3" }],
		],
	},

	chooseSenMessageSettings: {
		title: "Оберіть, будь ласка, отримувачів повідомлення:",
		options: [{ resize_keyboard: true }],
		buttons: [
			[{ text: "🤽‍♂️ Обрати підрозділ(и) зі списку", callback_data: "19_1" }],
			[
				{
					text: "🤽‍♀️ Обрати користувачів зі списку в підрозділах",
					callback_data: "19_2",
				},
			],
			[{ text: "👦🏼 Знайти користувача", callback_data: "19_3" }],
			[
				{
					text: "🤽‍♀️ Показати список отримувачів (тут обрати - це видалити)",
					callback_data: "19_5",
				},
			],
			[
				{
					text: "📧 Сформувати та надіслати повідомлення",
					callback_data: "19_4",
				},
			],
			[{ text: "↩️", callback_data: "3_3" }],
		],
	},
	chooseTypeOfPeriod: {
		title: "Оберіть, будь ласка, період формування звіту:",
		options: [{ resize_keyboard: true }],
		buttons: [
			[
				{
					text: "🌗 Останній місяць (останні 30 днів)",
					callback_data: "last_month",
				},
				{
					text: "🌔 Останній тиждень (останні 7 днів)",
					callback_data: "last_week",
				},
			],
			[
				{ text: "🌛🌜 Довільний період", callback_data: "any_period" },
				{
					text: "🌕 Останній рік (останні 365 днів)",
					callback_data: "last_year",
				},
			],
			[
				{ text: "🌙 Сьогодні", callback_data: "today" },
				{ text: "↖️", callback_data: "x_x" },
			],
		],
	},

	choiceTypeOfPeriodInReport: {
		title: "Оберіть, будь ласка, тривалість сумування періодів простою:",
		options: [{ resize_keyboard: true }],
		buttons: [
			[{ text: "🌙 Щоденний звіт", callback_data: "11_1" }],
			[{ text: "🌕 Щотижневий звіт", callback_data: "11_2" }],
			[{ text: "↩️", callback_data: "3_3" }],
		],
	},
}

module.exports = { buttonsConfig }
