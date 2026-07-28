import nodemailer from 'nodemailer'

async function main() {
  const testAccount = await nodemailer.createTestAccount()
  console.log('Real Ethereal SMTP test account created:')
  console.log(JSON.stringify(testAccount, null, 2))
}

main()
