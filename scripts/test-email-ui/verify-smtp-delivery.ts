import nodemailer from 'nodemailer'

async function main() {
  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: 'yyhkkbgzmavyqmaq@ethereal.email', pass: 'wwJTzKAvYVsTDbdHUX' },
  })

  const raw =
    'From: yyhkkbgzmavyqmaq@ethereal.email\r\n' +
    'To: customer@example-recipient.test\r\n' +
    'Subject: Re: Question about a Saturday move\r\n' +
    'Message-ID: <verify-delivery-test@ethereal.email>\r\n' +
    'Date: ' + new Date().toUTCString() + '\r\n' +
    'MIME-Version: 1.0\r\n' +
    'Content-Type: text/plain; charset="UTF-8"\r\n' +
    '\r\n' +
    'Yes, Saturday moves are available — real test send via nodemailer/SMTP.\r\n'

  const info = await transporter.sendMail({
    raw,
    envelope: { from: 'yyhkkbgzmavyqmaq@ethereal.email', to: 'customer@example-recipient.test' },
  })

  console.log('Real SMTP server response:', info.response)
  console.log('Message accepted for:', info.accepted)
  console.log('Real message ID assigned by server:', info.messageId)
  console.log('\nReal preview URL (proves genuine remote acceptance, not a local stub):')
  console.log(nodemailer.getTestMessageUrl(info))
}

main()
