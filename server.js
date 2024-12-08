const express = require('express');
const cors = require('cors');
const app = express();

// 环境变量中存储敏感信息
require('dotenv').config();

app.use(cors());
app.use(express.json());
app.use(express.static('reader-app'));

// API代理
app.post('/api/chat/completions', async (req, res) => {
    try {
        const response = await fetch('https://api.lingyiwanwu.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.API_KEY}`
            },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// 添加简单的日志记录
const winston = require('winston');
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
}); 