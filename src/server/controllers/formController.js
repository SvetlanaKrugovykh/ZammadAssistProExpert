const formService = require('../services/formService')

const handleFormSubmit = (req, res) => {
  try {
    const phone = req.body.phone
    const name = req.body.name

    console.log('Received Form Data:')
    console.log('Phone:', phone)
    console.log('Name:', name)

    formService.processFormData(phone, name)

    res.status(200).json({ message: 'Form data received successfully.' })
  } catch (error) {
    console.error('Error processing form data:', error.message)
    res.status(500).json({ message: 'Internal server error.' })
  }
}

module.exports = {
  handleFormSubmit,
}
