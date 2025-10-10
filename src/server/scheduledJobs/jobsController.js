const cron = require('node-cron')
const monitoringJobs = require('./monitoringJobs')

cron.schedule('*/5 * * * *', monitoringJobs.checkInternetOutages)
cron.schedule('*/10 * * * *', monitoringJobs.checkVideoServerIssues)
cron.schedule('0 * * * *', monitoringJobs.hourlySummary)
cron.schedule('0 2 * * *', monitoringJobs.dailyCleanup)