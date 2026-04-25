const cron = require('node-cron')
const monitoringJobs = require('./monitoringJobs')
const { checkHighPriorityTickets } = require('./highPriorityTicketsJob')

cron.schedule('*/5 * * * *', monitoringJobs.checkInternetOutages)
cron.schedule('0 2 * * *', monitoringJobs.dailyCleanup)

// Проверка новых тикетов с максимальным приоритетом каждые 10 минут
cron.schedule('*/10 * * * *', checkHighPriorityTickets)