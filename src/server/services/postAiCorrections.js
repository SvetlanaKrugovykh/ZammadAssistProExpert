const logger = require('../utils/logger')
const { detectTopic } = require('./topicDetector')

class PostAiCorrections {
  constructor() {
    this.correctionRules = []
  }

  processResults(text, topic, originalText = '') {
    logger.debug(`PostAiCorrections: bypassed - returning original AI results`)
    return {
      text: text,
      topic: this.parseTopicFromText(text),
      appliedRules: [],
    }
  }

  /**
   * Delegate topic detection to the topicDetector service.
   * @param {string} text
   * @returns {string}
   */
  parseTopicFromText(text) {
    return detectTopic(text)
  }

  applyContextFixes(text, originalText) {
    return { text: text, changed: false }
  }

  addRule(rule) {
    logger.debug(`PostAiCorrections: ignoring rule "${rule.name}"`)
  }
}

module.exports = new PostAiCorrections()
