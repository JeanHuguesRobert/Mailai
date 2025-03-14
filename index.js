/* index.js
 *    Main application file
 */

import fs from 'fs';
import path from 'path';

import dotenv from 'dotenv';

import https from 'https';
import http from 'http';
import url from 'url';
import express from 'express';

import Imap from 'imap';
import nodemailer from 'nodemailer';

import log from './src/utils/logger.js';
import PluginManager from './plugins/manager.js';

// Watch .env file for changes
const __dirname = path.resolve();
const dotEnvPath = path.join(__dirname, '.env');

// Load current environment MailAI configuration
function loadEnvConfig() {
  const config = {};
  Object.keys(import.meta.env)
    .filter(key => key.startsWith('MAILAI_') && !key.startsWith('MAILAI_STATS_'))
    .forEach(key => {
      config[key] = import.meta.env[key];
    });
  return config;
}


// Handle .env file watching

let dotEnvWatcher = null;

function setupEnvWatcher() {
  if (dotEnvWatcher) {
    dotEnvWatcher.close();
  }
  dotEnvWatcher = fs.watch(dotEnvPath, (eventType, filename) => {
    if (eventType === 'change') {
      // Clear previous process.env
      const previous = loadEnvConfig();
      Object.keys(previous).forEach(key => {
        delete process.env[key];
      });
      // Reload environment
      dotenv.config();
      // Get new configuration
      const now = loadEnvConfig();
      // Compare configurations (ignoring stats)
      const hasSignificantChanges = Object.keys(now).some(key => {
        return now[key] !== previous[key];
      }) || Object.keys(previous).some(key => {
        return now[key] !== previous[key];
      });
      if (hasSignificantChanges) {
        log('config', '🔄 Environment configuration changed, restarting application...');
        process.on('exit', () => {
          import('child_process').then(({ spawn }) => {
            spawn(process.argv[0], process.argv.slice(1), {
              cwd: process.cwd(),
              detached: true,
              stdio: 'inherit'
            });
          });
        });
        process.exit();
      } else {
        log('debug', 'Environment file changed but no significant configuration updates detected');
      }
    }
  });
}


async function updateEnvStats() {
  try {
    // Temporarily stop watching the .env file
    dotEnvWatcher.close();
    dotEnvWatcher = null;
    
    // Read the current .env file
    let envContent = fs.readFileSync(dotEnvPath, 'utf8');
    
    // Update the stats values including quotas
    const statsToUpdate = {
      MAILAI_STATS_PROCESSED: mailai.monitoringStats.emailStats.processed,
      MAILAI_STATS_SKIPPED: mailai.monitoringStats.emailStats.skipped,
      MAILAI_STATS_ANSWERED: mailai.monitoringStats.emailStats.answered,
      MAILAI_STATS_BCC: mailai.monitoringStats.emailStats.bccCopied,
      MAILAI_LAST_RESET: emailStats.lastReset,
      MAILAI_DAILY_COUNT: emailStats.dailyCount,
      MAILAI_SENDER_HISTORY: JSON.stringify(Array.from(emailStats.senderHistory.entries()))
    };
    
    // Update each stat in the .env content
    Object.entries(statsToUpdate).forEach(([key, value]) => {
      const regex = new RegExp(`^${key}=.*`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    });
    
    // Write the updated content back to the .env file
    fs.writeFileSync(dotEnvPath, envContent);
    
    if (import.meta.env.MAILAI_DEBUG_MODE === 'true') {
      log('debug', 'Updated statistics and quotas in .env file');
    }
    
    // Resume watching the file with the same watcher function
    setupEnvWatcher();
  } catch (error) {
    log('error', `Failed to update stats in .env: ${error.message}`);
  }
}

let mailai = null;
let config = null;
let personas = null;

class MailAI {
  constructor() {
    this.emailService = new EmailService();
    this.monitoringService = new MonitoringService();
    this.pluginManager = new PluginManager();
    this.processedMessageIds = new Set();
    this.monitoringStats = {
      timeStarted: Date.now(),
      emailStats: {
        processed: 0,
        skipped: 0,
        answered: 0,
        bccCopied: 0
      }
    };
    this.config = config = {};
    this.personas = personas = {};
    mailai = this;
  }
}

// Collect config for a persona
function getPersonaConfig(id) {
  console.log( "Getting config for persona", id);
  const prefix = `MAILAI_${id}_`;
  const persona = { id, mailai, config, marking: "flag", imapPort: 993 };

  // First check for AI provider selection
  let ai_provider = process.env[`${prefix}ai`];
  
  // If no provider specified, use default
  if (!ai_provider) {
    ai_provider = 'unavailable';
  }

  // Validate provider name is lowercase
  if (ai_provider !== ai_provider.toLowerCase()) {
    throw new Error(`AI provider name '${ai_provider}' must be lowercase in '${prefix}ai'. Example: '${ai_provider.toLowerCase()}'`);
  }

  persona.ai = { provider: ai_provider };

  // Check for optional prompt
  const prompt = process.env[`${prefix}prompt`];
  if (prompt) {
    persona.prompt = prompt;
  }else{
    persona.prompt = '';
  }

  // If provider is 'unavailable', check for custom message
  if (ai_provider === 'unavailable') {
    const message = process.env[`${prefix}unavailable_message`] || 'Service unavailable';
    persona.ai.message = message;
  }

  // Get provider-specific settings
  const providerPrefix = `${prefix}${ai_provider}_`;
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(providerPrefix)) {
      const param = key.slice(providerPrefix.length);
      // Validate parameter name is lowercase
      if (param !== param.toLowerCase()) {
        throw new Error(`AI parameter '${param}' must be lowercase in '${key}'. Example: '${key.replace(param, param.toLowerCase())}'`);
      }
      persona.ai[param] = value;
    // Else collect persona settings
    }else if( key.startsWith(prefix) ){
      const param = key.slice(prefix.length);
      // Some wellknown parameters are integer
      if( param === "imap_port" ){
        persona[param] = parseInt(value, 10);
      }else{
        persona[param] = value;
      }
    }
  }
  console.log( "Config for persona", persona);
  return persona;
}

function validateMode(mode) {
  const validModes = ['development', 'production', 'testing', 'dry_run'];
  const inputMode = mode.toLowerCase();
  if (!validModes.includes(inputMode)) {
    throw new Error(`Invalid mode '${mode}'. Must be one of: ${validModes.join(', ')}`);
  }
  return inputMode;
}


function populateConfig() {
  const personas = {};
  mailai.personas = personas;
  const config = {
    port: parseInt(process.env.MAILAI_PORT || "8080", 10),
    mode: validateMode(process.env.MAILAI_MODE || 'development'),
    batch_size: parseInt(process.env.MAILAI_BATCH_SIZE || "10", 10),
    max_emails_per_batch: parseInt(process.env.MAILAI_MAX_EMAILS_PER_BATCH || "50", 10),
    cooldown_period: parseInt(process.env.MAILAI_COOLDOWN_PERIOD || "5", 10),
    max_emails_per_day: parseInt(process.env.MAILAI_MAX_EMAILS_PER_DAY || "10", 10),
    min_days: parseInt(process.env.MAILAI_MIN_DAYS || "0", 10),
    max_days: parseInt(process.env.MAILAI_MAX_DAYS || "7", 10),
    personas,
    mailai
  };
  mailai.config = config;
  console.log( "Config", config);

  // Validate core settings
  if (config.min_days < 0 || config.max_days < 0) {
    throw new Error('MAILAI_MIN_DAYS and MAILAI_MAX_DAYS must be positive integers');
  }
  if (config.min_days > config.max_days) {
    throw new Error('MAILAI_MIN_DAYS cannot exceed MAILAI_MAX_DAYS');
  }

  // First pass: Get persona names
  let seen = false;
  for (const [key, value] of Object.entries(process.env)) {
    if (key.toLowerCase().startsWith('mailai_persona_')) {
      const id = key.split('_')[2];
      personas[id] = getPersonaConfig(id);
      seen = true;
    }
  }
  
  console.log( "Loaded config", config);

  // Throw error if no personas found
  if (!seen) {
    throw new Error('No personas found in configuration');
  } 

  return config;
}


function markWithCustomFlag(imap, uid) {
  if( config.mode === "dry_run") {
    log('info', `Would have marked message ${uid} with custom flag`);
    return;
  }
  return new Promise((resolve, reject) => {
    imap.addFlags(uid, '$Mailai', (err) => {
      if (err) {
        log('error', `Failed to mark message ${uid} with custom flag: ${err.message}`);
        reject(err);
      } else {
        log('info', `Marked message ${uid} with custom flag`);
        resolve();
      }
    });
  });
}
  

async function processEmail(message) {
  try {
    if (shouldProcessEmail(message)) {
      await askAI(message);
      mailai.processedMessageIds.add(message.id);
      mailai.monitoringStats.emailStats.processed++;
      if( config.BCC_EMAILS) {
        mailai.monitoringStats.emailStats.bccCopied++;
      }
      
      const sender = message.header.from;
      if( sender ){
        mailai.monitoringStats.senderHistory.set(sender, Date.now());
        mailai.monitoringStats.dailyCount++;
      }
      
      // If using custom flag strategy, mark the message
      if (persona.marking === "flag") {
        try {
          await markWithCustomFlag(message);
        } catch (flagError) {
          log('warning', `Could not set custom flag: ${flagError.message}`);
        }
      }
      
      await updateEnvStats();
    } else {
      log('info', `Email "${message.subject}" from ${message.from} was not processed - Debug mode active`);
      mailai.monitoringStats.emailStats.skipped++;
      await updateEnvStats();
    }
  } catch (error) {
    log('error', `Failed to process email: ${error.message}`);
    await gracefulShutdown(error);
  }
}

const connections = new Map(); 

// Add authentication middleware
function auth(req, res, next) {
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

function createImapConnection(persona) {
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

  persona.imap = imap;
}

async function sendEmail(persona, options) {
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
    // Not in dry_run mode, send the email
    if( mode !== 'dry_run') {
      const info = await transporter.sendMail(options);
      // Analyse the response
      if (info.accepted.length > 0) { 
        logger.email(`Email sent successfully from '${persona.id}'`, {
          messageId: info.messageId,
          response: info.response
        });
      } else {
        logger.error(`Failed to send email from '${persona.id}'`, {
          response: info.response
        });
      }
    }
  } catch (error) {
    logger.error(`Failed to send email from '${persona.id}'`, error);
    throw error;
  }
}

async function processEmail(message) {
  const mode = process.env.MAILAI_mode || 'development';
  const persona = message.persona;
  try {
    // Log the email being processed
    if (mode === 'dry_run') {
      logger.dryRun(`Processing email from: ${message.header.from}`);
      logger.dryRun(`Subject: ${message.header.subject}`);
    } else if (mode === 'testing') {
      logger.test(`Processing email from: ${message.header.from}`);
    } else {
      logger.email(`Processing email from: ${message.header.from}`);
    }

    const response = await getAIResponse(message);

    // Mark email as processed
    await markEmailAsProcessed(message);
    
    // Send response
    await sendResponse(message, response);
    
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

async function sendResponse(message) {
  const mode = process.env.MAILAI_mode || 'development';
  const persona = message.persona;
  const response = message.response;
  
  // In dry_run mode, log what would be sent but don't actually send
  if (mode === 'dry_run') {
    logger.dryRun(`Would send response to: ${message.header.from}`);
    logger.dryRun(`Response content: ${response}`);
    return;
  }

  // In testing mode, use a test marker in subject
  const subjectPrefix = mode === 'testing' ? '[TEST] ' : '';
  
  try {
    const transporter = nodemailer.createTransport({
      host: persona.email_smtp,
      port: persona.email_smtp_port,
      secure: true,
      auth: {
        user: persona.email_user,
        pass: persona.email_password
      },
      debug: mode === 'development',
      logger: mode !== 'production' ? logger : null
    });

    // Add mode-specific headers
    const headers = {};
    if (mode === 'testing') {
      headers['X-MailAI-Mode'] = 'testing';
    }

    // Send, not in dry_run mode
    if( config.MODE === 'dry_run') {
      logger.dryRun(`Would send response to: ${message.header.from}`);
    } else {
      await transporter.sendMail({
        from: response.header?.from || persona.email_user,
        to: message.header.from,
        subject: `${subjectPrefix}Re: ${message.header.subject}`,
        text: response,
        inReplyTo: message.header.messageId,
        references: [message.header.messageId],
        headers
      });
    }

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

async function markEmailAsProcessed(message) {
  const mode = process.env.MAILAI_mode || 'development';
  
  if (mode === 'dry_run') {
    logger.dryRun(`Would mark email as processed: ${message.messageId}`);
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


async function startMailAI() {
  new MailAI();
  await mailai.pluginManager.loadPlugins();
  mailai.monitoringService.start(parseInt( config.MONITOR_PORT || 3000, 10));
  // For each persona, create and handle IMAP connection
  personas.forEach(persona => {
    
    persona.config = config;
    persona.maila = mailai
    const imap = createImapConnection(persona);
    
    // Store the imap connection with the persona for later use
    persona.imap = imap;
    
    imap.once('ready', () => {
      log('info', `IMAP connection ready for ${persona.id}`);
      openInbox(imap, (err, box) => {
        if (err) {
          log('error', `Failed to open inbox for ${persona.id}: ${err.message}`);
          return;
        }
        
        log('info', `Inbox opened for ${persona.id}, listening for new emails`);
        
        // Process existing unread emails first
        processNewEmails(persona);
        
        // Set up email processing for new emails
        imap.on('mail', (numNewMsgs) => {
          log('info', `Received ${numNewMsgs} new message(s) for ${persona.email}`);
          this.processNewEmails(imap, persona);
        });
      });
    });

    imap.once('error', err => {
      log('error', `IMAP error for ${persona.email}: ${err.message}`);
      // Attempt to reconnect after a delay
      setTimeout(() => {
        log('info', `Attempting to reconnect IMAP for ${persona.email}`);
        imap.connect();
      }, 30000); // 30 second delay before reconnect
    });

    imap.once('end', () => {
      log('info', `IMAP connection ended for ${persona.email}`);
      // Attempt to reconnect after a delay
      setTimeout(() => {
        log('info', `Attempting to reconnect IMAP for ${persona.email}`);
        imap.connect();
      }, 30000); // 30 second delay before reconnect
    });

    imap.connect();
  });
}


async function processNewEmails(persona) {
  try {
    const messages = await fetchNewEmails(persona);
    for (const message of messages) {
      if (!mailai.processedMessageIds.has(message.id)) {
        await processEmail(message);
      }
    }
  } catch (error) {
    log('error', `Failed to process new emails: ${error.message}`);
    // Stop execution in debug mode
    if (config.mode !== 'production') {
      log('error', 'Stopping process due to email processing error in debug mode');
      await gracefulShutdown(error);
    }
  }
}



// Function to get search criteria based on strategy
function getSearchCriteria( persona ) {
  if( persona.marking === "seen" ){
    return ['UNSEEN'];
  }
  return ['ALL'];
}

// Function to determine if messages should be marked as seen
function shouldMarkSeen( persona ) {
  return persona.marking === "seen";
}


function fetchNewEmails( persona ) {
  return new Promise((resolve, reject) => {
    const searchCriteria = getSearchCriteria( persona );
    log('info', `Searching for emails with criteria: ${JSON.stringify(searchCriteria)}`);
    
    persona.imap.search(searchCriteria, (err, results) => {
      if (err) {
        reject(err);
        return;
      }

      if (!results || !results.length) {
        log('info', 'No matching messages found');
        resolve([]);
        return;
      }

      // Respect quotas, as defined in .env
      const max = parseInt(config.MAX_EMAILS_PER_BATCH || "50", 10);
      if (results.length > max) {
        results = results.slice(0, max);
      }

      log('info', `Found ${results.length} matching messages`);
      const messages = [];
      const fetch = persona.imap.fetch(results, {
        bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE CC KEYWORD)', 'TEXT'],
        markSeen: shouldMarkSeen( persona )
      });
  
      fetch.on('message', (msg, seqno) => {
        const message = {
          id: seqno,
          persona,
          header: {},
          body: ''
        };

        msg.on('body', (stream, info) => {
          let buffer = '';
          stream.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
          });
          stream.on('end', () => {
            if (info.which === 'TEXT') {
              message.body = buffer;
            } else {
              message.header = Imap.parseHeader(buffer);
              // Log detailed message information
              log('info', `Message #${seqno}: From: ${message.header.from}, Subject: "${message.header.subject}", Date: ${message.header.date}, Keyword: ${message.header.keyword}`);
            }
          });
        });

        msg.once('end', () => {
          messages.push(message);
        });
      });

      fetch.once('error', (err) => {
        reject(err);
      });

      fetch.once('end', () => {
        // Filter messages to exclude those with the custom flag
        const filteredMessages = messages.filter(message => {
          // Implement logic to check for the custom flag in message headers
          return !message.header.keyword?.includes('$Mailai');
        });
        resolve(filteredMessages);
      });
    });
  });
}

// In the askAI function
async function askAI(message) {
  const persona = message.persona;
  try {
    log('email', `Processing email for ${persona.id}`);
    await mailai.pluginManager.executeHook('beforeProcessEmail', message );
    const promptCustom = fs.readFileSync(resolveLocalPath(persona.prompt), 'utf8');
    const mergedPrompt = `${BASE_PROMPT}\n${promptCustom}`;
    const messages = [
      { role: 'system', content: mergedPrompt },
      { role: 'user', content: `${message} (as ${persona})` },
    ];
    
    const response = await aiService.getCompletion(messages, persona);
    
    if (!response) {
      throw new Error('No response received from AI service');
    }
    
    log('ai', `Got response from AI service`);
    const processedResponse = await mailai.pluginManager.executeHook('afterProcessEmail', message, response, persona );
    const emailSubject = `Re: ${message.header?.subject}`;
    
    await sendEmail(recipient.address, emailSubject, processedResponse, persona.email);
  } catch (error) {
    log('error', error.message);
    await mailai.pluginManager.executeHook('onError', error, { question, recipient, persona });
    
    // Always throw the error to be handled by the caller
    throw error;
  }
}

async function sendEmail(message) {
  if( config.mode === "dry_run"){
    console.log('Dry run - would have sent email:', message);
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
  auth: {
    user: from,
    pass: import.meta.env.MAILAI_EMAIL_PASSWORD
  },
    auth: {
      user: from,
      pass: import.meta.env.MAILAI_EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: from,
    to: to,
    subject: subject,
    text: emailContent,
    bcc: import.meta.env.MAILAI_BCC_EMAILS ? import.meta.env.MAILAI_BCC_EMAILS.split(',').map(email => email.trim()) : [],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Email sending error:', error);
    // Always stop on errors in development/debug mode
    if (import.meta.env.NODE_ENV !== 'production' || import.meta.env.MAILAI_DEBUG_MODE === 'true') {
      log('error', 'Stopping process due to email sending error in development mode');
      await gracefulShutdown(error);
    }
    // In production, rethrow the error to be handled by the caller
    throw error;
  }
}


function createImapConnection(persona) {

  // Validate required configuration variables with specific messages
  const requiredConfigs = {
    mail_user: 'email user',
    mail_password: 'email password',
    mail_imap: 'IMAP host'
  };

  const missingConfigs = Object.entries(requiredConfigs)
    .filter(([key]) => !import.meta.env[key])
    .map(([_, desc]) => desc);

  if (missingConfigs.length > 0) {
    throw new Error(
      `Missing required IMAP configuration:\n` +
      `- Missing ${missingConfigs.join(', ')}\n` +
      `Please check your .env file and ensure all required values are set.`
    );
  }

  // Clean up password by removing spaces
  const cleanPassword = person.mail_password.replace(/\s+/g, '');
  
  if (cleanPassword.length < 8) {
    log('warning', `Password for ${persona.id} seems too short. Make sure you're using the correct password in MAILAI_EMAIL_PASSWORD.`);
  }
  
  const email = persona.mail_user;
  if (email.includes('gmail.com')) {
    if (cleanPassword.length === 16) {
      log('info', `Detected correct Gmail App Password format for ${email}`);
    } else {
      log('warning', `Gmail account ${email} detected but password length is not 16 characters (current: ${cleanPassword.length}). Check if your app password is correct.`);
    }
  }

  return new Imap({
    user: persona.mail_user,
    password: cleanPassword,
    host: persona.mail_imap,
    port: persona.mail_port || 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    authTimeout: 3000,
    connTimeout: 10000,
    debug: config.mode !== "production" ? console.log : null
  });
}

function openInbox(imap, cb) {
  if( config.mode === "dry_run") {
    log('info', 'Dry run mode: Skipping IMAP connection');
    return;
  }
  imap.openBox('INBOX', true, cb);
}


// Add this before the pluginManager initialization
// After the initial requires, modify the emailStats initialization
// Fix the emailStats initialization to properly handle the sender history
const emailStats = {
  dailyCount: parseInt(import.meta.env.MAILAI_DAILY_COUNT || '0'),
  lastReset: parseInt(import.meta.env.MAILAI_LAST_RESET || new Date().setHours(0, 0, 0, 0)),
  senderHistory: new Map(
    import.meta.env.MAILAI_SENDER_HISTORY ? 
    // Add a try-catch to handle potential JSON parsing errors
    (() => {
      try {
        const parsed = JSON.parse(import.meta.env.MAILAI_SENDER_HISTORY);
        // Check if it's an array of arrays (proper format for Map constructor)
        if (Array.isArray(parsed) && parsed.every(item => Array.isArray(item))) {
          return parsed.map(([email, time]) => [email, parseInt(time)]);
        } else {
          log('warning', 'MAILAI_SENDER_HISTORY is not in the expected format, resetting sender history');
          return [];
        }
      } catch (e) {
        log('warning', `Error parsing MAILAI_SENDER_HISTORY: ${e.message}, resetting sender history`);
        return [];
      }
    })() : 
    []
  )
};

// Modify the updateEnvStats function to include quota information
async function updateEnvStats() {
  try {
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update the stats values including quotas
    const statsToUpdate = {
      MAILAI_STATS_PROCESSED: mailai.monitoringStats.emailStats.processed,
      MAILAI_STATS_SKIPPED: mailai.monitoringStats.emailStats.skipped,
      MAILAI_STATS_ANSWERED: mailai.monitoringStats.emailStats.answered,
      MAILAI_STATS_BCC: mailai.monitoringStats.emailStats.bccCopied,
      MAILAI_LAST_RESET: emailStats.lastReset,
      MAILAI_DAILY_COUNT: emailStats.dailyCount,
      MAILAI_SENDER_HISTORY: JSON.stringify(Array.from(emailStats.senderHistory.entries()))
    };
    
    // Update each stat in the .env content
    Object.entries(statsToUpdate).forEach(([key, value]) => {
      const regex = new RegExp(`^${key}=.*`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    });
    
    // Write the updated content back to the .env file
    fs.writeFileSync(envPath, envContent);
    
    if (import.meta.env.MAILAI_DEBUG_MODE === 'true') {
      log('debug', 'Updated statistics and quotas in .env file');
    }
  } catch (error) {
    log('error', `Failed to update stats in .env: ${error.message}`);
  }
}

function shouldProcessEmail(emailData) {
  const isDebug = import.meta.env.MAILAI_DEBUG_MODE === 'true';
  
  // Reset daily counter if it's a new day
  const today = new Date().setHours(0, 0, 0, 0);
  if (today > emailStats.lastReset) {
    emailStats.dailyCount = 0;
    emailStats.lastReset = today;
    // Update the env file when resetting counters
    updateEnvStats();
  }
  
  // Check daily limit
  if (emailStats.dailyCount >= RATE_LIMITS.MAX_DAILY_EMAILS) {
    log('warning', `Daily email limit (${RATE_LIMITS.MAX_DAILY_EMAILS}) reached. Skipping until tomorrow.`);
    return false;
  }

  // Check sender cooldown
  const senderEmail = emailData.from.address || emailData.from;
  const lastResponse = emailStats.senderHistory.get(senderEmail);
  const now = Date.now();
  
  if (lastResponse && (now - lastResponse) < RATE_LIMITS.COOLDOWN_PERIOD) {
    log('info', `Skipping email "${emailData.subject}" - Cooldown period active for sender ${senderEmail}`);
    return false;
  }

  // Check if any of our managed emails are in the CC field
  if (emailData.cc) {
    const ccEmails = Array.isArray(emailData.cc) ? emailData.cc : [emailData.cc];
    const isAnyEmailInCC = emailUsers.some(email => 
      ccEmails.some(cc => cc.includes(email.trim()))
    );

    if (isAnyEmailInCC) {
      log('info', `Skipping email "${emailData.subject}" because one of our managed emails is in CC - This prevents auto-response loops`);
      return false;
    }
  }

  // In debug mode, log but still process if explicitly enabled
  if (isDebug) {
    log('info', `Processing email "${emailData.subject}" from ${senderEmail} - Debug mode is active`);
  }
  
  return true;
}


function resolveLocalPath(urlString) {
  const parsedUrl = url.parse(urlString);
  if (parsedUrl.protocol === 'file:' || !parsedUrl.protocol) {
    return path.join(__dirname, parsedUrl.pathname ? parsedUrl.pathname.replace(/^\//, '') : urlString);
  }
  return urlString;
}

async function loadPrompt(prompt) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(prompt);
    if (parsedUrl.protocol === 'file:' || !parsedUrl.protocol) {
      fs.readFile(resolveLocalPath(prompt), 'utf8', (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    } else if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      protocol.get(prompt, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve(data);
        });
      }).on('error', (err) => {
        reject(err);
      });
    } else {
      reject(new Error('Invalid pre-prompt URL'));
    }
  });
}

class MonitoringService {
  constructor() {
    this.stats = {
      startTime: Date.now(),
      connections: new Map(),
      emailStats: this.initializeStats()
    };
  }

  initializeStats() {
    return {
      processed: 0,
      skipped: 0,
      answered: 0,
      errors: 0,
      responseTime: {
        avg: 0,
        min: Infinity,
        max: 0,
        total: 0,
        count: 0
      }
    };
  }

  start(port) {
    this.port = port;
    this.updateStats();
  }

  updateStats() {
    this.stats.uptime = Date.now() - this.stats.startTime;
  }

  recordMetric(type) {
    if (type in this.stats.emailStats) {
      this.stats.emailStats[type]++;
    }
  }

  recordResponseTime(time) {
    const rt = this.stats.emailStats.responseTime;
    rt.total += time;
    rt.count++;
    rt.avg = rt.total / rt.count;
    rt.min = Math.min(rt.min, time);
    rt.max = Math.max(rt.max, time);
  }

  getStats() {
    this.updateStats();
    return this.stats;
  }
}


// Add at the top level, after the initial requires
// Improve the gracefulShutdown function with better error tracing
async function gracefulShutdown(error = null) {
  try {
    // Save stats before exit
    await updateEnvStats();
    if (error) {
      log('error', `Shutting down due to error: ${error.message}`);
      // Add stack trace for better debugging
      log('debug', `Error stack trace: ${error.stack}`);
    } else {
      log('info', 'Gracefully shutting down');
    }
  } catch (saveError) {
    log('error', `Failed to save stats during shutdown: ${saveError.message}`);
    log('debug', `Shutdown error stack trace: ${saveError.stack}`);
  } finally {
    process.exit(error ? 1 : 0);
  }
}

// Add process-wide error handlers at the top level
process.on('uncaughtException', async (error) => {
  log('error', `Uncaught Exception: ${error.message}`);
  await gracefulShutdown(error);
});

process.on('unhandledRejection', async (reason, promise) => {
  log('error', `Unhandled Rejection at: ${promise}, reason: ${reason}`);
  await gracefulShutdown(new Error(String(reason)));
});

process.on('SIGINT', async () => {
  log('info', 'Received SIGINT signal');
  await gracefulShutdown();
});


startMailAI();
