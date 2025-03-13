const OpenAI = require('openai');

module.exports = function(config) {
    if (!config.apiKey) {
        throw new Error('apiKey is required in MAILAI_OPENAI_CONFIG');
    }

    const openai = new OpenAI({
        apiKey: config.apiKey
    });

    return {
        async getCompletion(messages, options = {}) {
            const response = await openai.chat.completions.create({
                model: options.model || config.model || 'gpt-3.5-turbo',
                messages: messages,
                temperature: config.temperature || 0.7,
                max_tokens: config.maxTokens || 2048
            });

            return response.choices[0].message.content;
        }
    };
};