module.exports = function(config) {
    return {
        async getCompletion(messages, options = {}) {
            const response = JSON.parse(process.env.MAILAI_UNAVAILABLE).message;
            
            if (process.env.MAILAI_DEBUG_MODE === 'true' && process.env.MAILAI_BCC_EMAILS) {
                const debugInfo = {
                    response,
                    originalMessages: messages,
                    options,
                    timestamp: new Date().toISOString(),
                    note: 'Debug mode: Response not sent to recipient'
                };
                
                // Send debug info to monitoring email
                const nodemailer = require('nodemailer');
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.MAILAI_EMAIL_USER,
                        pass: process.env.MAILAI_EMAIL_PASSWORD
                    }
                });

                await transporter.sendMail({
                    from: process.env.MAILAI_EMAIL_USER,
                    to: process.env.MAILAI_BCC_EMAILS,
                    subject: '[DEBUG] AI Response Preview',
                    text: JSON.stringify(debugInfo, null, 2)
                });
            }

            return response;
        }
    };
};