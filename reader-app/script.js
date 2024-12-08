// 文件处理相关功能
class FileHandler {
    constructor() {
        this.fileInput = document.getElementById('fileInput');
        this.textContent = document.getElementById('textContent');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    }

    showLoading() {
        this.loadingIndicator.classList.remove('hidden');
    }

    hideLoading() {
        this.loadingIndicator.classList.add('hidden');
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            this.showLoading();
            if (file.type === 'text/plain') {
                await this.handleTextFile(file);
            } else if (file.type === 'application/pdf') {
                await this.handlePDFFile(file);
            } else {
                alert('请上传 TXT 或 PDF 文件');
                return;
            }
            // 显示文本内容区域
            this.textContent.classList.add('active');
            // 隐藏上传区域
            document.getElementById('uploadArea').style.display = 'none';
        } catch (error) {
            console.error('文件处理错误:', error);
            alert('文件处理失败，请重试');
        } finally {
            this.hideLoading();
        }
    }

    async handleTextFile(file) {
        const text = await file.text();
        this.displayText(text);
    }

    async handlePDFFile(file) {
        try {
            this.textContent.innerHTML = ''; // 清空现有内容
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            let fullText = '';
            const totalPages = pdf.numPages;
            
            // 遍历所有页面
            for (let i = 1; i <= totalPages; i++) {
                // 更新加载提示文本
                document.querySelector('.loading-text').textContent = 
                    `正在解析第 ${i} 页，共 ${totalPages} 页...`;
                
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                    .map(item => item.str)
                    .join(' ');
                
                fullText += pageText + '\n\n';
            }
            
            this.displayText(fullText);
        } catch (error) {
            console.error('PDF 解析错误:', error);
            alert('PDF 文件解析失败，请重试');
        }
    }

    displayText(text) {
        const paragraphs = text.split('\n\n');
        this.textContent.innerHTML = paragraphs
            .map(p => p.trim())
            .filter(p => p.length > 0)
            .map(p => `<p>${p}</p>`)
            .join('');
    }
}

// 文本选择功能
class TextSelector {
    constructor() {
        this.textContent = document.getElementById('textContent');
        this.knowledgeDisplay = new KnowledgeDisplay();
        this.currentSelection = null;  // 添加当前选择状态
        this.initializeEventListeners();
        this.initializeTypeButtons();  // 只在这里初始化一次
        this.debounceTimer = null;
        this.throttleTimer = null;
        this.throttleDelay = 1000; // 1秒内只能发起一次请求
        this.requestQueue = []; // 请求队列
    }

    initializeEventListeners() {
        document.addEventListener('mouseup', () => this.handleTextSelection());
    }

    handleTextSelection() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();
            if (selectedText) {
                this.processSelectedText(selectedText);
            }
        }, 300);
    }

    async processSelectedText(selectedText) {
        // 添加请求节流
        if (this.throttleTimer) {
            this.requestQueue.push({ text: selectedText });
            return;
        }

        // 处理请求
        this.throttleTimer = setTimeout(() => {
            this.throttleTimer = null;
            if (this.requestQueue.length > 0) {
                const nextRequest = this.requestQueue.shift();
                this.processSelectedText(nextRequest.text);
            }
        }, this.throttleDelay);

        this.currentSelection = selectedText;  // 保存当前选择
        const currentType = document.querySelector('.type-btn.active').dataset.type;

        this.knowledgeDisplay.addKnowledgeCard({
            text: selectedText,
            type: currentType,
            loading: true
        });

        this.getExplanation(selectedText, currentType)
            .then(explanation => {
                this.knowledgeDisplay.updateLatestCard(explanation);
            })
            .catch(error => {
                console.error('获取解释失败:', error);
                this.knowledgeDisplay.updateLatestCard('抱歉，获取解释失败，请重试。');
            });
    }

    async getExplanation(text, type) {
        const cacheKey = `${text}-${type}`;
        if (this.knowledgeDisplay.cache.has(cacheKey)) {
            return this.knowledgeDisplay.cache.get(cacheKey);
        }
        
        const prompts = {
            general: `请对以下内容进行专业解析：
                "${text}"
                解析要求：
                1. 阐述核心观点
                2. 分析关键概念
                3. 说明专业背景

                注意：请将回答控制在100字以内。`,
            
            definition: `请对以下专业术语进行解释：
                "${text}"
                解释要求：
                1. 明确所属领域
                2. 给出标准定义
                3. 列举典型用例

                注意：请将回答控制在80字以内。`,
            
            context: `请分析以下内容的背景：
                "${text}"
                分析要求：
                1. 时间背景
                2. 相关事件
                3. 影响因素

                注意：请将回答控制在100字以内。`,
            
            translation: `请进行专业翻译：
                "${text}"
                翻译要求：
                1. ${this.isChineseText(text) ? '中译英' : '英译中'}
                2. 保留专业术语
                3. 确保行业用语准确
                4. 注意语言表达规范

                注意：请保持翻译简洁准确。`
        };

        try {
            const response = await fetch(CONFIG.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.API_KEY}`
                },
                body: JSON.stringify({
                    model: CONFIG.MODEL,
                    messages: [{
                        role: "user",
                        content: prompts[type]
                    }],
                    temperature: 0.7,
                    max_tokens: 1000,
                    top_p: 0.95,
                    frequency_penalty: 0.3,
                    presence_penalty: 0.3
                })
            });

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error.message || '请求失败');
            }
            
            // 修改文本处理方式，移除长制
            let response_text = data.choices[0].message.content
                .trim()
                // 只移除多余的引号
                .replace(/["""'']/g, '')
                // 保留换行，只处理多余的空格
                .replace(/[ \t]+/g, ' ')
                // 移除 markdown 符号
                .replace(/[*#`]/g, '')
                // 移除多余的标点符号
                .replace(/([。！？；，])\1+/g, '$1');
            
            // 移除字数限制和截断逻辑
            // if (response_text.length > 100) {
            //     response_text = response_text.slice(0, 97) + '...';
            // }
            
            return response_text;
        } catch (error) {
            console.error('API 调用失败:', error);
            return '抱歉，解析失败，请稍后重试。';
        }
    }

    isChineseText(text) {
        return /[\u4e00-\u9fa5]/.test(text);
    }

    initializeTypeButtons() {
        const typeButtons = document.querySelectorAll('.type-btn');
        typeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                typeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // 如果有保存的选择，使用新的类型重新生成释
                if (this.currentSelection) {
                    const currentType = btn.dataset.type;
                    // 清除之前的卡片
                    const previousCard = this.knowledgeDisplay.knowledgeCards.firstElementChild;
                    if (previousCard && previousCard.classList.contains('knowledge-card')) {
                        previousCard.remove();
                    }
                    
                    this.knowledgeDisplay.addKnowledgeCard({
                        text: this.currentSelection,
                        type: currentType,
                        loading: true
                    });

                    this.getExplanation(this.currentSelection, currentType)
                        .then(explanation => {
                            this.knowledgeDisplay.updateLatestCard(explanation);
                        })
                        .catch(error => {
                            console.error('获取解释失败:', error);
                            this.knowledgeDisplay.updateLatestCard('抱歉，获取解释失败，请重试。');
                        });
                }
            });
        });
    }
}

// 知识点展示功能
class KnowledgeDisplay {
    constructor() {
        this.knowledgeCards = document.getElementById('knowledgeCards');
        this.emptyState = this.knowledgeCards.querySelector('.empty-state');
        this.cache = new Map();
        this.loadFromLocalStorage();
        this.maxStorageItems = 50;
        this.storageKey = 'knowledgeCards';
    }

    loadFromLocalStorage() {
        const savedCards = localStorage.getItem('knowledgeCards');
        if (savedCards) {
            JSON.parse(savedCards).forEach(card => this.addKnowledgeCard(card));
        }
    }

    saveToLocalStorage() {
        try {
            const cards = Array.from(this.knowledgeCards.children)
                .slice(0, this.maxStorageItems)
                .map(card => ({
                    text: card.querySelector('.selected-text').textContent,
                    explanation: card.querySelector('.explanation').textContent,
                    type: card.querySelector('.type-label').textContent,
                    timestamp: Date.now()
                }));

            localStorage.setItem(this.storageKey, JSON.stringify(cards));
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                this.clearOldData();
                this.saveToLocalStorage();
            }
        }
    }

    clearOldData() {
        const cards = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        const newCards = cards
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, Math.floor(this.maxStorageItems / 2));
        localStorage.setItem(this.storageKey, JSON.stringify(newCards));
    }

    addKnowledgeCard(data) {
        try {
            if (this.emptyState) {
                this.emptyState.style.display = 'none';
            }

            const card = document.createElement('div');
            card.className = 'knowledge-card';
            
            // 修改卡片的HTML结构
            card.innerHTML = `
                <div class="type-label">${this.getTypeLabel(data.type)}</div>
                <div class="selected-text">${data.text}</div>
                ${data.loading ? 
                    '<div class="loading">正在获取解释...</div>' : 
                    `<div class="explanation">
                        ${data.explanation.split('\n').map(line => 
                            `<p>${line.trim()}</p>`
                        ).join('')}
                    </div>`
                }
                <div class="card-footer">
                    <button class="share-btn">分享</button>
                    <button class="delete-btn">删除</button>
                </div>
            `;

            card.querySelector('.share-btn').addEventListener('click', () => {
                const text = `${data.text}\n\n${data.explanation}\n\n-- 来自智能阅读助手`;
                if (navigator.share) {
                    navigator.share({
                        title: '智能阅读解释',
                        text: text
                    }).catch(console.error);
                } else {
                    navigator.clipboard.writeText(text)
                        .then(() => alert('内容已复制到剪贴板'))
                        .catch(console.error);
                }
            });

            card.querySelector('.delete-btn').addEventListener('click', () => {
                card.remove();
                if (this.knowledgeCards.children.length <= 1) {
                    this.emptyState.style.display = 'block';
                }
            });

            // 添加错误重试机制
            card.querySelector('.retry-btn')?.addEventListener('click', async () => {
                const loadingDiv = card.querySelector('.error-message');
                if (loadingDiv) {
                    loadingDiv.outerHTML = '<div class="loading">重新获取中...</div>';
                    try {
                        const explanation = await this.getExplanation(data.text, data.type);
                        this.updateCard(card, explanation);
                    } catch (error) {
                        this.showErrorInCard(card, error.message);
                    }
                }
            });

            // 添加可访问性属性
            card.setAttribute('role', 'article');
            card.setAttribute('aria-label', '解释卡片');
            
            const shareBtn = card.querySelector('.share-btn');
            shareBtn.setAttribute('aria-label', '分享解释');
            shareBtn.setAttribute('role', 'button');
            
            const deleteBtn = card.querySelector('.delete-btn');
            deleteBtn.setAttribute('aria-label', '删除卡片');
            deleteBtn.setAttribute('role', 'button');

            this.knowledgeCards.insertBefore(card, this.knowledgeCards.firstChild);
        } catch (error) {
            console.error('添加知识卡片失败:', error);
            // 显示用户友好的错误提示
            this.showErrorMessage('添加解释失败，请重试');
        }
    }

    updateLatestCard(explanation) {
        const latestCard = this.knowledgeCards.firstElementChild;
        if (latestCard && latestCard.classList.contains('knowledge-card')) {
            const loadingDiv = latestCard.querySelector('.loading');
            if (loadingDiv) {
                loadingDiv.outerHTML = `
                    <div class="explanation">
                        ${explanation.split('\n').map(line => 
                            `<p>${line.trim()}</p>`
                        ).join('')}
                    </div>`;
            }
        }
    }

    getTypeLabel(type) {
        const labels = {
            general: '通用解释',
            definition: '词义解释',
            context: '背景知识',
            translation: '中英互译'
        };
        return labels[type] || '通用解释';
    }

    async getExplanation(text, type, retryCount = 3) {
        try {
            return await this.callAPI(text, type);
        } catch (error) {
            if (retryCount > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this.getExplanation(text, type, retryCount - 1);
            }
            throw error;
        }
    }

    showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-toast';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 3000);
    }

    showErrorInCard(card, message) {
        const errorDiv = card.querySelector('.explanation') || card.querySelector('.loading');
        if (errorDiv) {
            errorDiv.outerHTML = `
                <div class="error-message">
                    <p>${message}</p>
                    <button class="retry-btn">重试</button>
                </div>`;
        }
    }
}

// 1. 添加事件总线，优化组件通信
class EventBus {
    constructor() {
        this.events = {};
    }

    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(callback => callback(data));
        }
    }
}

// 2. 添加配置管理
class ConfigManager {
    constructor() {
        this.config = {
            theme: localStorage.getItem('theme') || 'light',
            fontSize: localStorage.getItem('fontSize') || 'medium',
            language: localStorage.getItem('language') || 'zh-CN'
        };
    }

    updateConfig(key, value) {
        this.config[key] = value;
        localStorage.setItem(key, value);
        eventBus.emit('configChanged', { key, value });
    }
}

class ThemeManager {
    constructor() {
        this.readingModeBtn = document.querySelector('.reading-mode-btn');
        this.darkModeBtn = document.querySelector('.dark-mode-btn');
        this.initializeTheme();
        this.initializeEventListeners();
    }

    initializeTheme() {
        // 恢复保存的主题设置
        const isReadingMode = localStorage.getItem('readingMode') === 'true';
        const isDarkMode = localStorage.getItem('darkMode') === 'true';
        
        if (isReadingMode) this.toggleReadingMode();
        if (isDarkMode) this.toggleDarkMode();
    }

    initializeEventListeners() {
        this.readingModeBtn.addEventListener('click', () => this.toggleReadingMode());
        this.darkModeBtn.addEventListener('click', () => this.toggleDarkMode());
    }

    toggleReadingMode() {
        document.body.classList.toggle('reading-mode');
        this.readingModeBtn.classList.toggle('active');
        localStorage.setItem('readingMode', document.body.classList.contains('reading-mode'));
    }

    toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        this.darkModeBtn.classList.toggle('active');
        localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    const fileHandler = new FileHandler();
    const textSelector = new TextSelector();
    const knowledgeDisplay = new KnowledgeDisplay();
    const themeManager = new ThemeManager();
}); 

