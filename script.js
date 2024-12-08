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
        // 改进文本显示方法，添加页面标记
        const paragraphs = text.split('\n\n');
        this.textContent.innerHTML = paragraphs
            .map(p => p.trim())
            .filter(p => p.length > 0)  // 过滤空段落
            .map(p => `<p>${p}</p>`)
            .join('');
    }
}

// 文本选择功能
class TextSelector {
    constructor() {
        this.textContent = document.getElementById('textContent');
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        document.addEventListener('mouseup', () => this.handleTextSelection());
    }

    handleTextSelection() {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (selectedText) {
            this.processSelectedText(selectedText);
        }
    }

    processSelectedText(text) {
        // 创建一个示例知识卡片
        const knowledgeDisplay = new KnowledgeDisplay();
        knowledgeDisplay.addKnowledgeCard({
            title: '选中内容',
            description: text
        });
    }
}

// 知识点展示功能
class KnowledgeDisplay {
    constructor() {
        this.knowledgeCards = document.getElementById('knowledgeCards');
    }

    addKnowledgeCard(data) {
        const card = document.createElement('div');
        card.className = 'knowledge-card';
        card.innerHTML = `
            <p>${data.description}</p>
            <div class="card-footer">
                <!-- 这里可以添加更多交互按钮 -->
            </div>
        `;
        this.knowledgeCards.insertBefore(card, this.knowledgeCards.firstChild);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    const fileHandler = new FileHandler();
    const textSelector = new TextSelector();
    const knowledgeDisplay = new KnowledgeDisplay();
}); 