const nodemailer = require('nodemailer');
const { MAILHOST, MAILPORT } = process.env;

async function sendmail(message) {

  let transporter = nodemailer.createTransport({
    host: MAILHOST,
    port: Number(MAILPORT),
    secure: false,
    auth: {
      user: message.from,
      pass: undefined
    }
  });

  let info = await transporter.sendMail(message);

  console.log("Message sent: %s", info.messageId);
  console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
}

module.exports = { sendmail };