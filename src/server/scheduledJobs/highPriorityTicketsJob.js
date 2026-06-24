const { execPgQuery } = require("../db/common")
const {
	wasNotificationSent,
	saveNotification,
	notifyAboutHighPriorityTicket,
} = require("../services/emailTicketsNotification")

const FIRST_LINE_GROUP_ID = 1
const MONTAGE_GROUP_ID = 10
const BILIAYEV_USER_ID = 452

async function checkHighPriorityTickets() {
	try {
		console.log("[highPriorityTicketsJob] Start check")

		const tickets = await execPgQuery(
			`SELECT * FROM tickets
       WHERE state_id < 4
         AND priority_id = 3
         AND created_at >= NOW() - INTERVAL '60 days'`,
			[],
			false,
			true,
		)

		for (const ticket of tickets) {
			await processTicket(ticket)
		}

		console.log("[highPriorityTicketsJob] Done")
	} catch (e) {
		console.error("[highPriorityTicketsJob] Error:", e)
	}
}

async function processTicket(ticket) {
	if (ticket.owner_id) {
		await processOwnerTicket(ticket)
	} else if (ticket.group_id) {
		await processGroupTicket(ticket)
	}
	// якщо немає ні owner, ні group — ігноруємо
}

async function processOwnerTicket(ticket) {
	const snapshot = await execPgQuery(
		`SELECT owner_id FROM ticket_owner_snapshots WHERE ticket_id = $1`,
		[ticket.id],
		false,
		true,
	)

	const prevOwnerId = snapshot.length > 0 ? snapshot[0].owner_id : null
	const isNewAssignment = prevOwnerId !== ticket.owner_id

	if (!isNewAssignment) return

	const users = await execPgQuery(
		`SELECT * FROM users WHERE id = $1 AND active = true`,
		[ticket.owner_id],
		false,
		true,
	)

	for (const user of users) {
		const eventType = `assigned_to_${ticket.owner_id}`
		const alreadySent = await wasNotificationSent(ticket.id, user.id, eventType)
		if (alreadySent) continue

		await notifyAboutHighPriorityTicket(ticket, [user], user)
		await saveNotification(ticket.id, user.id, eventType)
		console.log(
			`[highPriorityTicketsJob] Notified owner user ${user.id} for ticket ${ticket.id}`,
		)
	}

	// Оновлюємо snapshot тільки після успішної відправки
	await execPgQuery(
		`INSERT INTO ticket_owner_snapshots (ticket_id, owner_id, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (ticket_id) DO UPDATE SET owner_id = $2, updated_at = NOW()`,
		[ticket.id, ticket.owner_id],
		false,
		true,
	)
}

async function processGroupTicket(ticket) {
	// Перша лінія підтримки — не сповіщаємо
	if (ticket.group_id === FIRST_LINE_GROUP_ID) return

	let notifyUsers = []

	if (ticket.group_id === MONTAGE_GROUP_ID) {
		// Відділ монтажників — тільки Біляєв
		notifyUsers = await execPgQuery(
			`SELECT * FROM users WHERE id = $1`,
			[BILIAYEV_USER_ID],
			false,
			true,
		)
	} else {
		// Всі активні в групі
		notifyUsers = await execPgQuery(
			`SELECT u.* FROM groups_users gu
       JOIN users u ON gu.user_id = u.id
       WHERE gu.group_id = $1 AND u.active = true`,
			[ticket.group_id],
			false,
			true,
		)
	}

	const eventType = "group_created"

	for (const user of notifyUsers) {
		const alreadySent = await wasNotificationSent(ticket.id, user.id, eventType)
		if (alreadySent) continue

		await notifyAboutHighPriorityTicket(ticket, [user], user)
		await saveNotification(ticket.id, user.id, eventType)
		console.log(
			`[highPriorityTicketsJob] Notified group user ${user.id} for ticket ${ticket.id}`,
		)
	}
}

module.exports = { checkHighPriorityTickets }
