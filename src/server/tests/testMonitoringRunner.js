#!/usr/bin/env node

/**
 * Simple test runner for monitoring queries
 * Usage: node testMonitoringRunner.js [test-name]
 * 
 * Available tests:
 *   timezone - Check database and JS timezone settings
 *   intervals - Test INTERVAL queries with different time ranges  
 *   tickets - Analyze recent tickets
 *   all - Run all tests (default)
 */

const tests = require('./testMonitoringQueries')

async function main() {
  const testName = process.argv[2] || 'all'
  
  console.log(`🧪 Running test: ${testName}\n`)
  
  try {
    switch (testName.toLowerCase()) {
      case 'timezone':
        await tests.testTimeZoneAnalysis()
        break
        
      case 'intervals':
        await tests.testIntervalQueries()
        break
        
      case 'tickets':
        await tests.testSpecificTickets()
        break
        
      case 'all':
      default:
        await tests.runAllTests()
        break
    }
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}