const nodemailer = require('nodemailer');
require('dotenv').config();

const pass_ = process.env.PASS_MAIL;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'julian1995ag@gmail.com',
    pass: pass_
  }
});

async function enviarCorreo({ destinatarios, asunto, mensaje }) {
  const mailOptions = {
    from: 'julian1995ag@gmail.com',
    to: destinatarios.join(','),
    subject: asunto,
    html: mensaje
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { enviarCorreo };
