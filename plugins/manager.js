import fs from 'fs';
import path from 'path';
import logger from '../src/utils/logger.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class PluginManager {
    constructor() {
        this.plugins = new Map();
        this.pluginsDir = path.join(__dirname, 'enabled');
    }

    async loadPlugins() {
        try {
            logger.plugin(`Plugins directory path: ${this.pluginsDir}`);
    
            if (!fs.existsSync(this.pluginsDir)) {
                logger.error(`Plugins directory does not exist: ${this.pluginsDir}`);
                throw new Error('Plugins directory not found.');
            }
    
            const pluginsToLoad = ['unavailable.js']; // Only load the unavailable plugin
            const files = fs.readdirSync(this.pluginsDir); // Use synchronous version
            logger.plugin(`Found ${files.length} files in plugins directory: ${this.pluginsDir}`);
            for (const file of files) {
                if (pluginsToLoad.includes(file)) {
                    logger.plugin(`Attempting to load plugin: ${file}`);
                    try {
                        const pluginPath = path.join(this.pluginsDir, file);
                        const PluginClass = await import(`file://${pluginPath}`);
                        const aiProviderName = file.replace('.js', '').toLowerCase();
                        const plugin = new PluginClass.default();
    
                        if (!plugin.processMessage) {
                            throw new Error(`Plugin ${file} missing required method: processMessage`);
                        }
    
                        this.plugins.set(aiProviderName, plugin);
                        logger.plugin(`Successfully loaded provider plugin: ${file}`, {
                            ai: aiProviderName,
                        });
                    } catch (error) {
                        logger.error(`Failed to load plugin ${file}: ${error.message}`);
                        throw new Error(`Plugin loading failed for ${file}`); // Stop execution on error
                    }
                }
            }
        } catch (error) {
            logger.error(`Failed to read plugins directory: ${error.message}`);
            throw new Error('Plugin loading failed, stopping execution.');
        }
    }
    
    getPlugin(provider) {
        const plugin = this.plugins.get(provider.toLowerCase());
        if (!plugin) {
            throw new Error(`No plugin found for provider: ${provider}`);
        }
        return plugin;
    }

    async executeHook(hookName, plugin, ...args) {
        try {
            if (typeof plugin[hookName] === 'function') {
                logger.plugin(`Executing hook: ${hookName}`, {
                    plugin: plugin.constructor.name,
                    args: args.map(arg => typeof arg === 'object' ? Object.keys(arg) : typeof arg)
                });
                return await plugin[hookName](...args);
            }
        } catch (error) {
            logger.error(`Hook execution failed: ${hookName}`, {
                plugin: plugin.constructor.name,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async processMessage(aiProvider, message, config) {
        const plugin = this.getPlugin(aiProvider);
        try {
            logger.plugin(`Processing message with AI provider: ${aiProvider}`, {
                messageId: message.id,
                config: {
                    ...config,
                    // Redact sensitive information
                    email_password: '***',
                    password: '***'
                }
            });
            const result = await plugin.processMessage(message, config);
            logger.plugin(`Message processed successfully: ${aiProvider}`, {
                messageId: message.id,
                success: true
            });
            return result;
        } catch (error) {
            logger.error(`Message processing failed: ${aiProvider}`, {
                messageId: message.id,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
}

export default PluginManager;
