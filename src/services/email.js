const nodemailer = require('nodemailer');
const Imap = require('imap');
const { log } = require('../utils/logger');

class EmailService {
  constructor(config) {
    this.config = config;
    this.connections = new Map();
  }

  // Add authentication middleware
  auth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.setHeader('WWW-Authenticate', 'Basic');
      return res.status(401).send('Authentication required');
    }

    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const user = auth[0];
    const pass = auth[1];

    if (user === process.env.MAILAI_MONITOR_USER && pass === process.env.MAILAI_MONITOR_PASS) {
      next();
    } else {
      res.status(401).send('Invalid credentials');
    }
  }

  createImapConnection(email) {
    const cleanPassword = this.config.password.replace(/\s+/g, '');
    
    if (cleanPassword.length < 8) {
      log('warning', `Password for ${email} seems too short`);
    }
    
    if (email.includes('gmail.com') && cleanPassword.length !== 16) {
      log('warning', `Gmail account detected but password length is not 16 characters`);
    }

    return new Imap({
      user: email,
      password: cleanPassword,
      host: this.config.host,
      port: this.config.port,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 3000,
      connTimeout: 10000
    });
  }

  async sendEmail(options) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAILAI_EMAIL_USER,
        pass: process.env.MAILAI_EMAIL_PASSWORD,
      },
    });

    try {
      const info = await transporter.sendMail(options);
      log('info', `Email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      log('error', `Email sending error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = EmailService;