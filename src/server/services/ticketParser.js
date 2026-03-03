const logger = require('../utils/logger')
const logMessages = require('../data/logMessages')
const { detectTopic, isSpecificTopic } = require('./topicDetector')

class TicketParser {
  constructor() {
    // Department keywords for classification
    this.departmentKeywords = {
      IT: [
        // Ukrainian keywords for IT department
        'комп\'ютер', 'інтернет', 'пошта', 'принтер', 'програма', 'система',
        'мережа', 'сайт', 'сервер', 'база даних', 'пароль', 'доступ',
        'установка', 'налаштування', 'програмне забезпечення', 'антивірус',
        'резервне копіювання', 'відновлення', 'технічна підтримка',
        'оновлення', 'ліцензія', 'обладнання', 'монітор', 'клавіатура',
        'миша', 'звук', 'відео', 'камера', 'мікрофон', 'wi-fi', 'wifi',

        // Russian keywords for IT department
        'компьютер', 'интернет', 'почта', 'принтер', 'программа', 'система',
        'сеть', 'сайт', 'сервер', 'база данных', 'пароль', 'доступ',
        'установка', 'настройка', 'программное обеспечение', 'антивирус',
        'резервное копирование', 'восстановление', 'техническая поддержка',
        'обновление', 'лицензия', 'оборудование', 'монитор', 'клавиатура',
        'мышь', 'звук', 'видео', 'камера', 'микрофон', 'вай-фай',

        // Common IT terms
        'it', 'айти', 'email', 'е-мейл', 'windows', 'office', 'outlook',
        'excel', 'word', 'powerpoint', 'skype', 'teams', 'zoom',
        'vpn', 'ip', 'dns', 'tcp', 'http', 'https', 'ftp', 'sql'
      ],

      Legal: [
        // Ukrainian keywords for Legal department
        'юрист', 'юридичний', 'договір', 'контракт', 'угода', 'документ',
        'правовий', 'закон', 'законодавство', 'нормативний', 'акт',
        'реєстрація', 'ліцензування', 'дозвіл', 'сертифікат', 'патент',
        'торговельна марка', 'авторське право', 'інтелектуальна власність',
        'судовий', 'претензія', 'позов', 'арбітраж', 'медіація',
        'нотаріус', 'довіреність', 'заповіт', 'спадщина', 'податки',
        'відповідальність', 'штраф', 'санкції', 'компліанс',

        // Russian keywords for Legal department
        'юрист', 'юридический', 'договор', 'контракт', 'соглашение', 'документ',
        'правовой', 'закон', 'законодательство', 'нормативный', 'акт',
        'регистрация', 'лицензирование', 'разрешение', 'сертификат', 'патент',
        'торговая марка', 'авторское право', 'интеллектуальная собственность',
        'судебный', 'претензия', 'иск', 'арбитраж', 'медиация',
        'нотариус', 'доверенность', 'завещание', 'наследство', 'налоги',
        'ответственность', 'штраф', 'санкции', 'комплаенс'
      ],

      HR: [
        // Ukrainian keywords for HR department
        'кадри', 'персонал', 'співробітник', 'працівник', 'найм', 'звільнення',
        'відпустка', 'лікарняний', 'зарплата', 'премія', 'бонус', 'стажування',
        'навчання', 'тренінг', 'атестація', 'оцінка', 'посада', 'підвищення',
        'переведення', 'графік', 'робочий час', 'відгул', 'прогул',
        'дисципліна', 'мотивація', 'командировка', 'витрати', 'компенсація',
        'соціальний пакет', 'страхування', 'медичний огляд', 'профспілка',

        // Russian keywords for HR department
        'кадры', 'персонал', 'сотрудник', 'работник', 'найм', 'увольнение',
        'отпуск', 'больничный', 'зарплата', 'премия', 'бонус', 'стажировка',
        'обучение', 'тренинг', 'аттестация', 'оценка', 'должность', 'повышение',
        'перевод', 'график', 'рабочее время', 'отгул', 'прогул',
        'дисциплина', 'мотивация', 'командировка', 'расходы', 'компенсация',
        'социальный пакет', 'страхование', 'медосмотр', 'профсоюз',

        // Common HR terms
        'hr', 'эйчар', 'cv', 'резюме', 'собеседование', 'рекрутинг'
      ]
    }

    // Priority keywords
    this.priorityKeywords = {
      High: [
        'срочно', 'терміново', 'критично', 'критически', 'аварійно', 'аварийно',
        'негайно', 'немедленно', 'блокер', 'блокирует', 'не працює', 'не работает',
        'зламався', 'сломался', 'падає', 'падает', 'горить', 'горит'
      ],
      Medium: [
        'важливо', 'важно', 'потрібно', 'нужно', 'необхідно', 'необходимо',
        'слід', 'следует', 'варто', 'стоит', 'бажано', 'желательно'
      ],
      Low: [
        'коли буде час', 'когда будет время', 'не поспішаючи', 'не спеша',
        'коли зможете', 'когда сможете', 'на дозвіллі', 'на досуге'
      ]
    }
  }

  /**
   * Validate ticket content for meaningfulness
   * @param {string} text - input text to validate
   * @returns {Object} - validation result {isValid: boolean, reason: string}
   */
  validateTicketContent(text) {
    if (!text || typeof text !== 'string') {
      return { isValid: false, reason: 'Порожнє повідомлення' }
    }

    const cleanText = text.trim().toLowerCase()

    // Check minimum length
    if (cleanText.length < 5) {
      return { isValid: false, reason: 'Занадто коротке повідомлення (мінімум 5 символів)' }
    }

    // Check for repeated characters (like "aaaaaaa", "бла-бла-бла")
    const repeatedPattern = /(.)\1{4,}/g // 5 or more same characters in a row
    if (repeatedPattern.test(cleanText)) {
      return { isValid: false, reason: 'Повідомлення містить повторювані символи' }
    }

    // Check for repeated words like "бла бла бла"
    const wordsArray = cleanText.split(/\s+/)
    if (wordsArray.length >= 3) {
      const uniqueWords = new Set(wordsArray)
      if (uniqueWords.size === 1 && (uniqueWords.has('бла') || uniqueWords.has('blah') || uniqueWords.has('test'))) {
        return { isValid: false, reason: 'Безглузде повідомлення. Опишіть вашу проблему детальніше' }
      }
    }

    // Check for meaningless phrases
    const meaninglessPatterns = [
      /^(бла|бла-бла|blah|тест|test|проверка|check)$/i,
      /^(хм|хмм|эм|эмм|ну|well|hmm|uh|ah)$/i,
      /^(ничего|nothing|нічого|нет|no|да|yes|так)$/i,
      /^(да нет|нет да|не знаю|не знаю что|не пойму)$/i,
      /^(бла[\s\-]*){3,}[.?!]*$/i,  // Multiple "бла" with spaces/dashes like "бла-бла-бла-бла"
      /^(blah[\s\-]*){3,}[.?!]*$/i, // Multiple "blah" with spaces/dashes
      /^[.?!,\s]{3,}$/,  // Only punctuation and spaces
      /^[0-9]{3,}$/,      // Only numbers
      /^[a-zA-Z]{2}\1+$/i // Repeated pairs like "asasas"
    ]

    for (const pattern of meaninglessPatterns) {
      if (pattern.test(cleanText)) {
        return { isValid: false, reason: 'Безглузде повідомлення. Опишіть вашу проблему детальніше' }
      }
    }

    // Check for only interjections or filler words
    const fillerWords = ['хм', 'эм', 'ну', 'тобто', 'то есть', 'ага', 'угу', 'ок', 'ok', 'окей', 'okay']
    const words = cleanText.split(/\s+/).filter(word => word.length > 1)

    if (words.length === 0) {
      return { isValid: false, reason: 'Повідомлення не містить змістовних слів' }
    }

    // If all words are filler words
    const meaningfulWords = words.filter(word => !fillerWords.includes(word))
    if (meaningfulWords.length === 0) {
      return { isValid: false, reason: 'Повідомлення містить тільки службові слова' }
    }

    // Check for minimum meaningful content (at least 2 meaningful words)
    if (meaningfulWords.length < 2) {
      return { isValid: false, reason: 'Занадто мало змістовної інформації. Додайте більше деталей' }
    }

    // Check for gibberish patterns
    const gibberishPattern = /^[qwertyuiopasdfghjklzxcvbnm]{5,}$/i
    if (gibberishPattern.test(cleanText.replace(/\s/g, ''))) {
      return { isValid: false, reason: 'Схоже на випадковий набір символів' }
    }

    // All checks passed
    return { isValid: true, reason: '' }
  }

  /**
   * Parse transcribed text and create ticket structure
   * @param {string} text - transcribed text
   * @param {string} clientId - user ID
   * @returns {Object} - parsed ticket structure
   */
  parseTicket(text, subject, clientId) {
    try {
      logger.info(logMessages.processing.ticketParsing(clientId, text))

      const ticket = {
        ticket_id: this.generateTicketId(),
        department: this.determineDepartment(text),
        category: 'Request', // Default category
        priority: this.determinePriority(text),
        title: this.generateTitle(text, subject),
        description: text.trim(),
        requester: clientId,
        language: this.detectLanguage(text),
        created_at: new Date().toISOString(),
        status: 'Open'
      }

      logger.info(logMessages.processing.ticketCreated(clientId, ticket.ticket_id, ticket.department))

      return ticket
    } catch (error) {
      logger.error(logMessages.services.ticketParsingError, error)
      throw error
    }
  }

  /**
   * Generate unique ticket ID
   * @returns {string} - ticket ID
   */
  generateTicketId() {
    const now = new Date()
    const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14)
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `TKT-${timestamp}${random}`
  }

  /**
   * Determine department based on keywords in text
   * @param {string} text - text to analyze
   * @returns {string} - department name
   */
  determineDepartment(text) {
    const lowerText = text.toLowerCase()
    let maxScore = 0
    let bestDepartment = 'IT' // Default to IT

    for (const [dept, keywords] of Object.entries(this.departmentKeywords)) {
      let score = 0
      for (const keyword of keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          score += 1
          // Give more weight to exact matches
          if (lowerText.includes(` ${keyword.toLowerCase()} `)) {
            score += 0.5
          }
        }
      }

      if (score > maxScore) {
        maxScore = score
        bestDepartment = dept
      }
    }

    return bestDepartment
  }

  /**
   * Determine priority based on keywords in text
   * @param {string} text - text to analyze
   * @returns {string} - priority level
   */
  determinePriority(text) {
    const lowerText = text.toLowerCase()

    // Check for high priority keywords first
    for (const keyword of this.priorityKeywords.High) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return 'High'
      }
    }

    // Check for low priority keywords
    for (const keyword of this.priorityKeywords.Low) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return 'Low'
      }
    }

    // Check for medium priority keywords or default to medium
    for (const keyword of this.priorityKeywords.Medium) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return 'Medium'
      }
    }

    return 'Medium' // Default priority
  }

  /**
   * Generate ticket title using two-pass topic detection:
   *   PASS 1 — PROPER_NOUNS.json (abbreviations, brand names, narrow terms)
   *   PASS 2 — TRIGGERS.csv keyword scoring
   * Falls back to user-provided subject (if meaningful) or truncated text.
   * @param {string} text    - full body text (transcribed or typed)
   * @param {string} subject - optional subject line provided by user
   * @returns {string} - capitalised title
   */
  generateTitle(text, subject) {
    // Combine subject + body so topic detection uses full context
    const combined = [subject, text].filter(Boolean).join(' ').trim()

    // PASS 1 + 2: try to detect a specific topic
    const detectedTopic = detectTopic(combined)
    if (isSpecificTopic(detectedTopic)) {
      logger.debug(`generateTitle: detected topic="${detectedTopic}"`)
      return detectedTopic
    }

    // Fallback 1: use explicit subject if meaningful
    if (subject && subject.trim().length > 6) {
      const s = subject.trim()
      return s.charAt(0).toUpperCase() + s.slice(1)
    }

    // Fallback 2: truncate body text
    let title = text.trim()
    if (title.length > 50) {
      const sentenceEnd = title.search(/[.!?]\s/)
      if (sentenceEnd > 10 && sentenceEnd < 50) {
        title = title.substring(0, sentenceEnd + 1)
      } else {
        title = title.substring(0, 47) + '...'
      }
    }
    return title.charAt(0).toUpperCase() + title.slice(1)
  }

  /**
   * Detect language of the text
   * @param {string} text - text to analyze
   * @returns {string} - detected language
   */
  detectLanguage(text) {
    const lowerText = text.toLowerCase()

    // Ukrainian indicators
    const ukrainianChars = (lowerText.match(/[іїєґ]/g) || []).length
    const ukrainianWords = [
      'та', 'або', 'якщо', 'який', 'тому', 'треба', 'потрібно', 'можна',
      'буде', 'має', 'можуть', 'повинен', 'після', 'перед'
    ]
    let ukrainianScore = ukrainianChars * 2

    for (const word of ukrainianWords) {
      if (lowerText.includes(word)) {
        ukrainianScore += 1
      }
    }

    // Russian indicators
    const russianWords = [
      'что', 'или', 'если', 'который', 'поэтому', 'нужно', 'можно',
      'будет', 'имеет', 'могут', 'должен', 'после', 'перед'
    ]
    let russianScore = 0

    for (const word of russianWords) {
      if (lowerText.includes(word)) {
        russianScore += 1
      }
    }

    if (ukrainianScore > russianScore) {
      return ukrainianScore > 2 ? 'Ukrainian' : 'Mixed'
    } else if (russianScore > ukrainianScore) {
      return russianScore > 2 ? 'Russian' : 'Mixed'
    } else {
      return 'Mixed'
    }
  }

  /**
   * Format ticket for display
   * @param {Object} ticket - ticket object
   * @returns {string} - formatted ticket text
   */
  formatTicketForDisplay(ticket) {
    const departmentEmojis = {
      'IT': '💻',
      'Legal': '⚖️',
      'HR': '👥'
    }

    const priorityEmojis = {
      'High': '🔴',
      'Medium': '🟡',
      'Low': '🟢'
    }

    return `🎫 **Заявка:**
📋 **ID:** ${ticket.ticket_id}
${departmentEmojis[ticket.department] || '📁'} **Відділ:** ${ticket.department}
📂 **Категорія:** ${ticket.category}
${priorityEmojis[ticket.priority] || '⚪'} **Пріоритет:** ${ticket.priority}
📝 **Заголовок:** ${ticket.title}
📄 **Опис:** ${ticket.description}
🌐 **Мова:** ${ticket.language}
⏰ **Створено:** ${new Date(ticket.created_at).toLocaleString('uk-UA')}
✅ **Статус:** ${ticket.status}`
  }
}

module.exports = new TicketParser()
