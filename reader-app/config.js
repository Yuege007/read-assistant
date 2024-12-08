const CONFIG = {
    API_URL: '/api/chat/completions',
    MODEL: 'yi-34b-chat',
    MAX_REQUESTS_PER_MINUTE: 60,
    MAX_TEXT_LENGTH: 1000
}; 

class RateLimiter {
    constructor(limit) {
        this.limit = limit;
        this.requests = [];
    }

    async checkLimit() {
        const now = Date.now();
        this.requests = this.requests.filter(time => now - time < 60000);
        if (this.requests.length >= this.limit) {
            throw new Error('请求过于频繁，请稍后再试');
        }
        this.requests.push(now);
    }
} 