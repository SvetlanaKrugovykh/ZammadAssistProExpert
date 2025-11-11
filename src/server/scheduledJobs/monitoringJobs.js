const monitoringService = require('../db/monitoring-notifications')

// Check every 5 minutes for new internet outages
module.exports.checkInternetOutages = async function checkInternetOutages() {
  try {
    const results = await monitoringService.startMonitoringCheck(15, 'INTERNET')

    // Safety check - ensure results is a valid object
    if (!results || typeof results !== 'object') {
      console.warn('Invalid results from startMonitoringCheck:', results)
      return { processed: 0, sent: 0, skipped: 0, errors: 1, timeRange: 'error' }
    }

    // Only log if there was some activity
    if (results.processed > 0 || results.errors > 0) {
      console.log('Scheduled check: Internet outages')
      console.log('Internet check results:', results)
    }
    return results
  } catch (error) {
    console.error('Error in scheduled internet check:', error)
    return { processed: 0, sent: 0, skipped: 0, errors: 1, timeRange: 'error' }
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



