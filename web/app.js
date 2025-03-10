class MailaiWeb {
    constructor() {
        this.config = {};
        this.status = document.querySelector('.status');
        this.initializeUI();
        this.registerServiceWorker();
    }

    async initializeUI() {
        document.getElementById('config-form').addEventListener('submit', 
            e => this.handleConfig(e));
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('./sw.js');
            } catch (error) {
                console.error('SW registration failed:', error);
            }
        }
    }

    async handleConfig(e) {
        e.preventDefault();
        // Save configuration and start monitoring
    }
}

new MailaiWeb();
