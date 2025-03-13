require('dotenv').config();
const fs = require('fs');
const https = require('https');
const http = require('http');
const url = require('url');
const path = require('path');
const Imap = require('imap');
const nodemailer = require('nodemailer');

const PluginManager = require('./plugins/manager');
const parse_config = require( "./src/config");
const EmailService = require('./src/services/email');
const MonitoringService = require('./src/services/monitoring');
const { log } = require('./src/utils/logger');
const aiService = require('./services/ai');
const express = require('express');

// Globals
let mailai = null;
let config = null;
let personas = null;
let envWatcher = null;


// Current environment configuration
function collectEnvConfig() {
  const config = {};
  Object.keys(process.env)
    .filter(key => key.startsWith('MAILAI_') && !key.startsWith('MAILAI_STATS_'))
    .forEach(key => {
      config[key] = process.env[key];
    });
  return config;
}

// handle .env file watching// Set up the initial watcher

function setupEnvWatcher() {
  const previousEnvConfig = collectEnvConfig();
  if( envWatcher ){
    envWatcher();
  }
  const envPath = path.join(__dirname, '.env');
  envWatcher = fs.watch(envPath, (eventType, filename) => {
    if (eventType === 'change') {
      // Clear previous environment
      for( key in previousEnvConfig.keys() ){
        delete process.env[key];
      }
      // Reload environment
      require('dotenv').config();
      // Get new configuration
      const newConfig = loadEnvConfig();
      // Compare configurations (ignoring stats)
      const hasSignificantChanges = Object.keys(newConfig).some(key => {
        return newConfig[key] !== previousEnvConfig[key];
      }) || Object.keys(previousEnvConfig).some(key => {
        return newConfig[key]  != previousEnvConfig[key];
      });
      if (hasSignificantChanges) {
        log('config', '🔄 Environment configuration changed, restarting application...');
        process.on('exit', () => {
          require('child_process').spawn(process.argv[0], process.argv.slice(1), {
            cwd: process.cwd(),
            detached: true,
            stdio: 'inherit'
          });
        });
        process.exit();
      } else {
        log('debug', 'Environment file changed but no significant configuration updates detected');
      }
    }
  });
}


// Then modify the updateEnvStats function to use the watcher function
async function updateEnvStats() {
  try {
    // Temporarily stop watching the .env file
    if( envWatcher ){
      envWatcher();
      envWatcher = null;
    }
    // ToDo: Do we need this: fs.unwatchFile(envPath);
    
    // Read the current .env file
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
    
    if (config.mode === "debug") {
      log('debug', 'Updated statistics and quotas in .env file');
    }
    
    // Resume watching the file with the same watcher function
    setupEnvWatcher();
  } catch (error) {
    log('error', `Failed to update stats in .env: ${error.message}`);
  }
}

class MailAI {
  constructor() {
    this.emailService = new EmailService();
    this.monitoringService = new MonitoringService();
    this.pluginManager = new PluginManager();
    this.processedMessageIds = new Set();
    this.monitoringStats = {
      emailStats: {
        processed: 0,
        skipped: 0,
        answered: 0,
        bccCopied: 0
      }
    };
    mailai = this;
    log( "debug", "MailAI is ready");
  }
}

async function startMailAI() {
  log( "debug", "Loading plugins");
  await mailai.pluginManager.loadPlugins();
  log( "debug", "loading config");
  config = parse_config();
  personas = config.personas;
  config.plugins = mailai.pluginManager.plugins;
  log( "debug", "Monitoring starting");
  mailai.monitoringService.start(config.monitor_port || 3000);
  log( "debug", "Email processing starting");
  startEmailProcessing();
  log( "MailAI is started");
}

// Add this function to mark messages with the custom flag
function markWithCustomFlag(imap, uid) {
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
  
// Then modify the processEmail method to use this
async function processEmail(emailData, messageId, persona) {
  try {
    if (shouldProcessEmail(emailData)) {
      await askAI(emailData, emailData.subject, emailData.from, persona);
      mailai.processedMessageIds.add(messageId);
      mailai.monitoringStats.emailStats.processed++;
      mailai.monitoringStats.emailStats.answered++;
      if (config.bcc_emails) {
        mailai.monitoringStats.emailStats.bccCopied++;
      }
      
      const senderEmail = emailData.from.address || emailData.from;
      emailStats.senderHistory.set(senderEmail, Date.now());
      emailStats.dailyCount++;
      
      // If using custom flag strategy, mark the message
      if (config.marking === "flag") {
        try {
          await mailai.markWithCustomFlag(persona, messageId);
        } catch (flagError) {
          log('warning', `Could not set custom flag: ${flagError.message}`);
        }
      }
      
      await updateEnvStats();
    } else {
      log('info', `Email "${emailData.subject}" from ${emailData.from} was not processed - Debug mode active`);
      this.monitoringStats.emailStats.skipped++;
      await updateEnvStats();
    }
  } catch (error) {
    log('error', `Failed to process email: ${error.message}`);
    await gracefulShutdown(error);
  }
}

function startEmailProcessing() {
  // For each persona, create and handle IMAP connection
  personas.forEach(persona => {
    const imap = createImapConnection(persona.mail_user);
    
    // Store the imap connection with the persona for later use
    persona.imap = imap;
    
    imap.once('ready', () => {
      log('info', `IMAP connection ready for ${persona.mail_user}`);
      openInbox(imap, (err, box) => {
        if (err) {
          log('error', `Failed to open inbox for ${persona.mail_user}: ${err.message}`);
          return;
        }
        
        log('info', `Inbox opened for ${persona.mail_user}, listening for new emails`);
        
        // Process existing unread emails first
        setTimeout( () => processNewEmails(persona), 5000 );
        
        // Set up email processing for new emails
        imap.on('mail', (numNewMsgs) => {
          log('info', `Received ${numNewMsgs} new message(s) for ${persona.mail_user}`);
          processNewEmails(persona);
        });
      });
    });

    imap.once('error', err => {
      log('error', `IMAP error for ${persona.mail_user}: ${err.message}`);
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
  const imap = persona.imap;
  try {
    const messages = await this.fetchNewEmails(imap);
    for (const message of messages) {
      if (!this.processedMessageIds.has(message.id)) {
        await this.processEmail(message.emailData, message.id, persona);
      }
    }
  } catch (error) {
    log('error', `Failed to process new emails: ${error.message}`);
    // Stop execution in debug mode
    if (process.env.NODE_ENV !== 'production' || process.env.MAILAI_DEBUG_MODE === 'true') {
      log('error', 'Stopping process due to email processing error in debug mode');
      await gracefulShutdown(error);
    }
  }
}


function fetchNewEmails(imap) {
  return new Promise((resolve, reject) => {
    const searchCriteria = getSearchCriteria();
    log('info', `Searching for emails with criteria: ${JSON.stringify(searchCriteria)}`);
    
    imap.search(searchCriteria, (err, results) => {
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
      const max = parseInt(config.max_emails_per_batch, 10);
      if (results.length > max) {
        results = results.slice(0, max);
      }

      log('info', `Found ${results.length} matching messages`);
      const messages = [];
      const fetch = imap.fetch(results, {
        bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE CC KEYWORD)', 'TEXT'],
        markSeen: shouldMarkSeen()
      });
  
      fetch.on('message', (msg, seqno) => {
        const message = {
          id: seqno,
          emailData: {
            from: '',
            subject: '',
            date: '',
            cc: [],
            body: '',
            keyword: ''
          }
        };

        msg.on('body', (stream, info) => {
          let buffer = '';
          stream.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
          });
          stream.on('end', () => {
            if (info.which === 'TEXT') {
              message.emailData.body = buffer;
            } else {
              const header = Imap.parseHeader(buffer);
              message.emailData.from = header.from ? header.from[0] : '';
              message.emailData.subject = header.subject ? header.subject[0] : '';
              message.emailData.date = header.date ? header.date[0] : '';
              message.emailData.cc = header.cc || [];
              message.emailData.keyword = header.keyword || '';
              
              // Log detailed message information
              log('info', `Message #${seqno}: From: ${message.emailData.from}, Subject: "${message.emailData.subject}", Date: ${message.emailData.date}, Keyword: ${message.emailData.keyword}`);
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
          return !message.emailData.keyword.includes('$Mailai');
        });
        resolve(filteredMessages);
      });
    });
  });
}


function createImapConnection(persona) {

  // Validate required environment variables with specific messages
  const requiredConfigs = {
    mail_user: 'email address',
    mail_password: 'email password',
    mail_host: 'IMAP host',
    mail_port: 'IMAP port'
  };

  const missingConfigs = Object.entries(requiredConfigs)
    .filter(([key]) => !process.env[key])
    .map(([_, desc]) => desc);

  if (missingConfigs.length > 0) {
    throw new Error(
      `Missing required IMAP configuration for $(persona.id):\n` +
      `- Missing ${missingConfigs.join(', ')}\n` +
      `Please check your .env file and ensure all required values are set.`
    );
  }

  // Clean up password by removing spaces
  const cleanPassword = persona.email_password.replace(/\s+/g, '');
  
  if (cleanPassword.length < 8) {
    log('warning', `Password for ${email} seems too short. Make sure you're using the correct password in MAILAI_EMAIL_PASSWORD.`);
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
    user: email,
    password: cleanPassword,  // Use cleaned password
    host: process.env.MAILAI_EMAIL_HOST,
    port: process.env.MAILAI_EMAIL_PORT,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    authTimeout: 3000,
    connTimeout: 10000,
    debug: process.env.NODE_ENV === 'development' ? console.log : null
  });
}

function openInbox(imap, cb) {
  imap.openBox('INBOX', true, cb);
}


const emailStats = {
  dailyCount: parseInt(process.env.MAILAI_DAILY_COUNT || '0'),
  lastReset: parseInt(process.env.MAILAI_LAST_RESET || new Date().setHours(0, 0, 0, 0)),
  senderHistory: new Map(
    process.env.MAILAI_SENDER_HISTORY ? 
    // Add a try-catch to handle potential JSON parsing errors
    (() => {
      try {
        const parsed = JSON.parse(process.env.MAILAI_SENDER_HISTORY);
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
    
    if (process.env.MAILAI_DEBUG_MODE === 'true') {
      log('debug', 'Updated statistics and quotas in .env file');
    }
  } catch (error) {
    log('error', `Failed to update stats in .env: ${error.message}`);
  }
}

// In the shouldProcessEmail function, update the daily counter persistence
function shouldProcessEmail(emailData) {
  const isDebug = config.mode === "debug";
  
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
  
  if (lastResponse && (now - lastResponse)
    < ( config.cooldown_period * 60 * 1000 )
  ) {
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

function resolveLocalPath(urlString) {
  const parsedUrl = url.parse(urlString);
  if (parsedUrl.protocol === 'file:' || !parsedUrl.protocol) {
    return path.join(__dirname, parsedUrl.pathname ? parsedUrl.pathname.replace(/^\//, '') : urlString);
  }
  return urlString;
}

async function askAI( persona, question, recipient ) {
  try {    
    log('email', `Processing email from ${recipient.address} using ${persona.mail_user}`);
    const emailData = { persona, question, recipient };
    const processedData = await mailai.pluginManager.executeHook('beforeProcessEmail', emailData);
    
    const promptCustom = fs.readFileSync(resolveLocalPath(persona.prompt), 'utf8');
    const mergedPrompt = `<mailai>\n${config.prompt}\n</mailai>\n<user>\n${promptCustom}\n</user>\n`;
    const messages = [
      { role: 'mailai', content: mergedPrompt },
      { role: 'question', content: processedData.question },
    ];
    
    const response = await aiService.getCompletion(messages, {
      model: persona.ai_model
    });
    
    if (!response) {
      throw new Error('No response received from AI service');
    }
    
    log('ai', `Got response from AI service`);
    const processedResponse = await mailai.pluginManager.executeHook('afterProcessEmail', emailData, response);
    const emailSubject = `Re: ${question}`;
    
    await sendEmail(persona, recipient.address, emailSubject, processedResponse );
  } catch (error) {
    log('error', error.message);
    await mailai.pluginManager.executeHook('onError', error, { question, recipient, persona });
    
    // Always throw the error to be handled by the caller
    throw error;
  }
}

async function sendEmail( persona, to, subject, text ) {

  const mailOptions = {
    from: persona.mail_user,
    to: to,
    subject: subject,
    text: text,
    bcc: config.bcc_emails ? config.bcc_emails.split(',').map(email => email.trim()) : [],
  };

  const transporter = nodemailer.createTransport({
    host: persona.email_host,
    port: persona.email_port,
    secure: true,
    auth: {
      user: persona.email_user,
      pass: persona.email_password
    }
  });

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Email sending error:', error);
    // Always stop on errors in development/debug mode
    if (config.mode === "debug") {
      log('error', 'Stopping process due to email sending error in development mode');
      await gracefulShutdown(error);
    }
    // In production, rethrow the error to be handled by the caller
    throw error;
  }
}

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
  await gracefulShutdown(reason);
});

process.on('SIGINT', async () => {
  log('info', 'Received SIGINT signal');
  await gracefulShutdown();
});


function start(){
    // Welcome message
    log( "info", "EmailAI - Welcome" );
    setupEnvWatcher();
    log( "debug", ".env watcher started" );
    new MailAI();
    log( "info", "Starting");
    startMailAI().catch(err => {
      log('error', `Failed to start MailAI: ${err.message}`);
      throw err;
    });
}

start();
