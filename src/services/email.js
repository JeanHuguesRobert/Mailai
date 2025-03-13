import Imap from 'imap';
import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

class EmailService {
  constructor(config) {
    this.config = config;
    this.connections = new Map();
  }

  // Add authentication middleware
  auth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      logger.monitor('Authentication required - no header provided');
      res.setHeader('WWW-Authenticate', 'Basic');
      return res.status(401).send('Authentication required');
    }

    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const user = auth[0];
    const pass = auth[1];

    if (user === process.env.MAILAI_MONITOR_USER && pass === process.env.MAILAI_MONITOR_PASS) {
      logger.monitor('Authentication successful', { user });
      next();
    } else {
      logger.monitor('Authentication failed - invalid credentials', { user });
      res.status(401).send('Invalid credentials');
    }
  }

  createImapConnection(persona) {
    // Validate required fields
    const required = ['email_user', 'email_password', 'email_imap'];
    const missing = required.filter(field => !persona[field]);
    if (missing.length > 0) {
      const error = `Missing required email fields for persona '${persona.id}': ${missing.join(', ')}. Example: MAILAI_${persona.id}_${missing[0]}=value`;
      logger.error(error);
      throw new Error(error);
    }

    // Validate email field names are lowercase
    Object.keys(persona).forEach(key => {
      if (key.startsWith('email_') && key !== key.toLowerCase()) {
        const error = `Email field '${key}' must be lowercase in persona '${persona.id}'. Example: '${key.toLowerCase()}'`;
        logger.error(error);
        throw new Error(error);
      }
    });

    const cleanPassword = persona.email_password.replace(/\s+/g, '');
    
    if (cleanPassword.length < 8) {
      logger.warning(`Password for ${persona.email_user} seems too short (less than 8 characters)`);
    }
    
    if (persona.email_user.includes('gmail.com') && cleanPassword.length !== 16) {
      logger.warning(`Gmail account detected but password length is not 16 characters. Make sure you're using an App Password from Google Account settings`);
    }

    logger.imap(`Creating IMAP connection for persona '${persona.id}'`, {
      user: persona.email_user,
      host: persona.email_imap,
      port: parseInt(persona.email_port) || 993
    });

    const imap = new Imap({
      user: persona.email_user,
      password: cleanPassword,
      host: persona.email_imap,
      port: parseInt(persona.email_port) || 993, // Default IMAPS port
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 3000,
      connTimeout: 10000,
      debug: process.env.MAILAI_MODE === 'debug' ? 
        (text) => logger.debug(`IMAP Debug [${persona.id}]: ${text}`) : null
    });

    // Set up IMAP event handlers
    imap.once('ready', () => {
      logger.imap(`IMAP connection ready for '${persona.id}'`);
    });

    imap.once('error', (err) => {
      logger.error(`IMAP error for '${persona.id}'`, err);
    });

    imap.once('end', () => {
      logger.imap(`IMAP connection ended for '${persona.id}'`);
    });

    imap.on('mail', (numNewMsgs) => {
      logger.imap(`Received ${numNewMsgs} new message(s) for '${persona.id}'`);
    });

    return imap;
  }

  async sendEmail(persona, options) {
    // Validate required fields
    const required = ['email_user', 'email_password', 'email_imap'];
    const missing = required.filter(field => !persona[field]);
    if (missing.length > 0) {
      const error = `Missing required email fields for persona '${persona.id}': ${missing.join(', ')}. Example: MAILAI_${persona.id}_${missing[0]}=value`;
      logger.error(error);
      throw new Error(error);
    }

    // Validate email field names are lowercase
    Object.keys(persona).forEach(key => {
      if (key.startsWith('email_') && key !== key.toLowerCase()) {
        const error = `Email field '${key}' must be lowercase in persona '${persona.id}'. Example: '${key.toLowerCase()}'`;
        logger.error(error);
        throw new Error(error);
      }
    });

    logger.email(`Creating email transport for persona '${persona.id}'`, {
      host: persona.email_imap,
      port: parseInt(persona.email_port) || 993,
      user: persona.email_user
    });

    const transporter = nodemailer.createTransport({
      host: persona.email_imap,
      port: parseInt(persona.email_port) || 993, // Default IMAPS port
      secure: true,
      auth: {
        user: persona.email_user,
        pass: persona.email_password,
      },
    });

    try {
      logger.email(`Sending email from '${persona.id}'`, {
        to: options.to,
        subject: options.subject,
        hasAttachments: !!options.attachments
      });

      const info = await transporter.sendMail(options);
      logger.email(`Email sent successfully from '${persona.id}'`, {
        messageId: info.messageId,
        response: info.response
      });
      return info;
    } catch (error) {
      logger.error(`Failed to send email from '${persona.id}'`, error);
      throw error;
    }
  }

  async processEmail(persona, emailData) {
    const mode = process.env.MAILAI_mode || 'development';
    
    try {
      // Log the email being processed
      if (mode === 'dry_run') {
        logger.dryRun(`Processing email from: ${emailData.from}`);
        logger.dryRun(`Subject: ${emailData.subject}`);
      } else if (mode === 'testing') {
        logger.test(`Processing email from: ${emailData.from}`);
      } else {
        logger.email(`Processing email from: ${emailData.from}`);
      }

      // Get AI response
      const response = await this.getAIResponse(persona, emailData);

      // Mark email as processed
      await this.markEmailAsProcessed(persona, emailData);
      
      // Send response
      await this.sendResponse(persona, emailData, response);
      
      if (mode === 'testing') {
        logger.test('Email processed and response sent in test mode');
      } else {
        logger.email('Email processed and response sent successfully');
      }
    } catch (error) {
      logger.error(`Failed to process email: ${error.message}`);
      throw error;
    }
  }

  async sendResponse(persona, emailData, response) {
    const mode = process.env.MAILAI_mode || 'development';
    
    // In dry_run mode, log what would be sent but don't actually send
    if (mode === 'dry_run') {
      logger.dryRun(`Would send response to: ${emailData.from}`);
      logger.dryRun(`Response content: ${response}`);
      return;
    }

    // In testing mode, use a test marker in subject
    const subjectPrefix = mode === 'testing' ? '[TEST] ' : '';
    
    try {
      const transporter = nodemailer.createTransport({
        host: persona.config.email_smtp,
        port: persona.config.email_smtp_port,
        secure: true,
        auth: {
          user: persona.config.email_user,
          pass: persona.config.email_password
        },
        debug: mode === 'development',
        logger: mode === 'development'
      });

      // Add mode-specific headers
      const headers = {};
      if (mode === 'testing') {
        headers['X-MailAI-Mode'] = 'testing';
      }

      await transporter.sendMail({
        from: persona.config.email_user,
        to: emailData.from,
        subject: `${subjectPrefix}Re: ${emailData.subject}`,
        text: response,
        inReplyTo: emailData.messageId,
        references: [emailData.messageId],
        headers
      });

      if (mode === 'testing') {
        logger.test(`Sent test response to: ${emailData.from}`);
      } else {
        logger.email(`Sent response to: ${emailData.from}`);
      }
    } catch (error) {
      logger.error(`Failed to send response: ${error.message}`);
      throw error;
    }
  }

  async markEmailAsProcessed(persona, emailData) {
    const mode = process.env.MAILAI_mode || 'development';
    
    if (mode === 'dry_run') {
      logger.dryRun(`Would mark email as processed: ${emailData.messageId}`);
      return;
    }

    try {
      const markType = persona.config.marking || 'flag';
      
      if (mode === 'testing') {
        logger.test(`Marking email as processed using: ${markType}`);
      } else {
        logger.email(`Marking email as processed using: ${markType}`);
      }

      if (markType === 'flag') {
        await emailData.message.setFlag('$Mailai');
      } else if (markType === 'read') {
        await emailData.message.setFlag('\\Seen');
      }
    } catch (error) {
      logger.error(`Failed to mark email as processed: ${error.message}`);
      throw error;
    }
  }

  async getAIResponse(persona, emailData) {
    // TO DO: implement AI response logic
  }
}

export default EmailService;