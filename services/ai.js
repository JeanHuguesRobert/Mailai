const { log } = require('../server');

class AIService {
    constructor() {
        this.provider = 'unavailable';
    }

    async getCompletion(messages, options) {
        if (this.provider === 'unavailable') {
            log('info', 'AI service is in unavailable mode - no API key configured');
            return 'Sorry, the AI service is currently unavailable. Please configure an AI provider to enable responses.';
        }

        try {
            return await this.provider.getCompletion(messages, options);
        } catch (error) {
            log('error', `AI Provider error: ${error.message}`);
            throw error;
        }
    }
}

module.exports = new AIService();
