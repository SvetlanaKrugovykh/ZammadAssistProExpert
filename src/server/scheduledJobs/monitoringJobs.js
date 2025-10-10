const monitoringService = require('../db/monitoring-notifications')

// Check every 5 minutes for new internet outages
module.exports.checkInternetOutages = async function checkInternetOutages() {
  try {
    console.log('Scheduled check: Internet outages')
    const results = await monitoringService.startMonitoringCheck(5, 'INTERNET')
    console.log('Internet check results:', results)
    return results
  } catch (error) {
    console.error('Error in scheduled internet check:', error)
  }
}

// Check every 10 minutes for video server issues
module.exports.checkVideoServerIssues = async function checkVideoServerIssues() {
  try {
    console.log('Scheduled check: Video server issues')
    const results = await monitoringService.startMonitoringCheck(10, 'VIDEO')
    console.log('Video server check results:', results)
    return results
  } catch (error) {
    console.error('Error in scheduled video check:', error)
  }
}

// Daily cleanup of old notifications
module.exports.dailyCleanup = async function dailyCleanup() {
  try {
    console.log('Scheduled cleanup: Old notifications')
    monitoringService.cleanupOldNotifications(1) // Keep 1 day
    const stats = monitoringService.getMonitoringStats()
    console.log('After cleanup stats:', stats)
  } catch (error) {
    console.error('Error in scheduled cleanup:', error)
  }
}

// Hourly status summary for critical stores
module.exports.hourlySummary = async function hourlySummary() {
  try {
    const criticalStores = ['001', '002', '125', '150'] // Add your critical stores
    const deltaSeconds = 3600 // 1 hour

    console.log('Hourly summary for critical stores:')
    const summaryResults = []

    for (const storeNumber of criticalStores) {
      const status = await monitoringService.checkStoreInternetStatus(storeNumber, deltaSeconds)
      summaryResults.push(status)
      console.log(`Store ${storeNumber}: ${status.status} - ${status.message}`)
    }

    return summaryResults
  } catch (error) {
    console.error('Error in hourly summary:', error)
  }
}

