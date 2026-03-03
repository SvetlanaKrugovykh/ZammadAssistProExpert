'use strict'

const fs = require('fs')
const path = require('path')
const logger = require('../utils/logger')

// ── Stop words (UA + RU) — never used as keyword triggers ──────────────────
const STOP_WORDS = new Set([
  // Ukrainian
  'на', 'до', 'не', 'та', 'чи', 'що', 'як', 'в', 'з', 'і', 'по', 'за', 'від',
  'при', 'а', 'або', 'але', 'для', 'без', 'між', 'про', 'через', 'над', 'під',
  'перед', 'після', 'це', 'той', 'ця', 'те', 'ці', 'ті', 'він', 'вона', 'воно',
  'вони', 'ми', 'ви', 'я', 'ти', 'бо', 'же', 'би', 'б', 'хоч', 'хай',
  'й', 'у', 'із', 'зі',
  // Russian
  'и', 'с', 'к', 'о', 'об', 'от', 'из', 'из-за',
  'или', 'но', 'если', 'то', 'что', 'как', 'при', 'через',
  'над', 'под', 'после', 'между', 'это', 'тот', 'этот',
  'он', 'она', 'оно', 'они', 'мы', 'вы', 'ты', 'бы', 'уже'
])

// ── Separator regexp for tokenisation ──────────────────────────────────────
const TOKEN_SEP = /[\s,.:;!?()\[\]{}\-\/\\«»\u2018\u2019\u201c\u201d]+/

// ── Generic (fallback) topic names — not reported as a match ───────────────
const GENERIC_TOPICS = new Set([
  'Загальні проблеми',
  'Технічна несправність',
  'Технічна підтримка'
])

// ── Cache ───────────────────────────────────────────────────────────────────
let _properNounsMap = null   // Map<alias_lc → topicName>
let _triggersArr   = null   // Array<{topic, triggers: string[]}>

// ── Paths ────────────────────────────────────────────────────────────────────
const DATA_DIR         = path.join(__dirname, '..', 'data')
const PROPER_NOUNS_PATH = path.join(DATA_DIR, 'PROPER_NOUNS.json')
const TRIGGERS_PATH     = path.join(DATA_DIR, 'TRIGGERS.csv')

// ── Loaders ──────────────────────────────────────────────────────────────────

/**
 * Load PROPER_NOUNS.json and build alias→topic map (cached).
 * File format: { "Topic Name": { "aliases": ["alias1", "alias2", ...] }, ... }
 * All aliases are stored lower-cased; order of topics = lookup priority.
 * @returns {Map<string, string>}
 */
function loadProperNouns() {
  if (_properNounsMap) return _properNounsMap
  _properNounsMap = new Map()

  try {
    const raw  = fs.readFileSync(PROPER_NOUNS_PATH, 'utf8')
    const data = JSON.parse(raw)

    // Object.entries preserves insertion order (ES2015+)
    for (const [topicName, entry] of Object.entries(data)) {
      if (topicName.startsWith('_')) continue   // skip meta/comment keys
      if (!entry || !Array.isArray(entry.aliases)) continue
      for (const alias of entry.aliases) {
        const norm = alias.toLowerCase().trim()
        if (norm && !_properNounsMap.has(norm)) {
          _properNounsMap.set(norm, topicName)
        }
      }
    }
    logger.debug(`topicDetector: loaded ${_properNounsMap.size} proper-noun aliases`)
  } catch (e) {
    logger.error('topicDetector: cannot read PROPER_NOUNS.json:', e.message)
  }

  return _properNounsMap
}

/**
 * Load TRIGGERS.csv and build topic array (cached).
 * CSV format: TopicName,kw1,kw2,...
 * Order of lines = priority (earlier = higher).
 * @returns {Array<{topic: string, triggers: string[]}>}
 */
function loadTriggers() {
  if (_triggersArr) return _triggersArr
  _triggersArr = []

  try {
    const content = fs.readFileSync(TRIGGERS_PATH, 'utf8')
    const lines   = content.split('\n').filter(l => l.trim())

    for (const line of lines) {
      const parts = line.split(',')
      _triggersArr.push({
        topic:    parts[0].trim(),
        triggers: parts.slice(1).map(t => t.trim().toLowerCase()).filter(Boolean)
      })
    }
    logger.debug(`topicDetector: loaded ${_triggersArr.length} trigger topics`)
  } catch (e) {
    logger.error('topicDetector: cannot read TRIGGERS.csv:', e.message)
  }

  return _triggersArr
}

// ── Detection passes ─────────────────────────────────────────────────────────

/**
 * PASS 1 — Proper nouns / abbreviations (exact token match).
 * Text is split into tokens; each token is looked up in the alias map.
 * Multi-word aliases are matched as substrings.
 * @param {string} lowerText
 * @returns {string|null}
 */
function detectByProperNouns(lowerText) {
  const map = loadProperNouns()
  if (!map.size) return null

  const tokens = lowerText.split(TOKEN_SEP).filter(Boolean)

  for (const token of tokens) {
    if (map.has(token)) {
      const topic = map.get(token)
      logger.debug(`topicDetector: proper-noun match token="${token}" → "${topic}"`)
      return topic
    }
  }

  // Phrase aliases (contain space or hyphen) — substring search
  for (const [alias, topic] of map.entries()) {
    if ((alias.includes(' ') || alias.includes('-')) && lowerText.includes(alias)) {
      logger.debug(`topicDetector: phrase match alias="${alias}" → "${topic}"`)
      return topic
    }
  }

  return null
}

/**
 * PASS 2 — TRIGGERS.csv keyword search (first matching topic wins).
 * Stop words are skipped; earlier topics have higher priority.
 * @param {string} lowerText
 * @returns {string|null}
 */
function detectByTriggers(lowerText) {
  const topics = loadTriggers()

  for (const entry of topics) {
    for (const trigger of entry.triggers) {
      if (!trigger || STOP_WORDS.has(trigger)) continue
      if (lowerText.includes(trigger)) {
        logger.debug(`topicDetector: trigger match trigger="${trigger}" → "${entry.topic}"`)
        return entry.topic
      }
    }
  }

  return null
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Detect topic from raw user text.
 * Order: PROPER_NOUNS (pass 1) → TRIGGERS.csv (pass 2) → fallback patterns.
 *
 * @param {string} text - raw user text (any case, any language)
 * @returns {string}    - topic name; never null
 */
function detectTopic(text) {
  if (!text || typeof text !== 'string') return 'Загальні проблеми'

  const lower = text.toLowerCase().replace(/\s+/g, ' ').trim()

  const byProperNoun = detectByProperNouns(lower)
  if (byProperNoun) return byProperNoun

  const byTrigger = detectByTriggers(lower)
  if (byTrigger) return byTrigger

  // Generic fallback patterns
  if (/не працює|не работает|сломал|поломал|не включается|не вмикається/.test(lower)) {
    return 'Технічна несправність'
  }
  if (/проблем|помог|допомог|треба|нужн/.test(lower)) {
    return 'Технічна підтримка'
  }

  return 'Загальні проблеми'
}

/**
 * Returns true if the detected topic is a real specific topic
 * and not a generic fallback.
 * @param {string} topic
 * @returns {boolean}
 */
function isSpecificTopic(topic) {
  return !!topic && !GENERIC_TOPICS.has(topic)
}

/**
 * Invalidate caches (useful after hot-reload of data files).
 */
function invalidateCache() {
  _properNounsMap = null
  _triggersArr    = null
  logger.debug('topicDetector: cache invalidated')
}

module.exports = { detectTopic, isSpecificTopic, invalidateCache }
