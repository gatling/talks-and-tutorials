document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chatMessages');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');

    // Add code-like placeholder
    userInput.placeholder = 'Type your message here...';

    // Store chat history
    let chatHistory = [];

    // Auto-resize textarea
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';
    });

    // Handle send button click
    sendButton.addEventListener('click', sendMessage);

    // Handle enter key (shift+enter for new line)
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;

        // Add user message to chat
        addMessage(message, 'user');
        // Add to history
        chatHistory.push({ role: 'user', content: message });
        userInput.value = '';
        userInput.style.height = 'auto';

        try {
            // Show loading state with e-commerce themed messages
            const loadingMessages = [
                "🔍 Searching our product catalog...",
                "📦 Checking inventory status...",
                "💰 Calculating best prices...",
                "🚚 Checking shipping options...",
                "⭐ Finding similar products...",
                "📱 Updating product details...",
                "🎯 Personalizing recommendations..."
            ];
            const randomLoadingMessage = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
            const loadingMessage = addMessage(randomLoadingMessage, 'bot');

            // Call the backend API with chat history
            const response = await fetch('http://localhost:3000/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    message,
                    history: chatHistory
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get response');
            }

            const data = await response.json();
            
            // Replace loading message with actual response
            loadingMessage.querySelector('.message-content').textContent = data.response;
            // Add bot response to history
            chatHistory.push({ role: 'assistant', content: data.response });
        } catch (error) {
            console.error('Error:', error);
            addMessage('❌ Sorry, I encountered an error. Please try again in a moment.', 'bot');
        }
    }

    function addMessage(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        // Format the content based on message type
        if (type === 'bot') {
            // Convert markdown-style formatting
            content = content
                // Convert code blocks
                .replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
                    return `<pre><code class="${lang || ''}">${code.trim()}</code></pre>`;
                })
                // Convert inline code
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                // Convert lists
                .replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>')
                .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
                // Convert numbered lists
                .replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>')
                .replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>')
                // Convert blockquotes
                .replace(/^\s*>\s*(.+)$/gm, '<blockquote>$1</blockquote>')
                // Convert horizontal rules
                .replace(/^\s*---\s*$/gm, '<hr>')
                // Convert paragraphs
                .replace(/\n\n/g, '</p><p>')
                // Wrap content in paragraphs if not already wrapped
                .replace(/^(.+)$/gm, '<p>$1</p>')
                // Remove empty paragraphs
                .replace(/<p>\s*<\/p>/g, '')
                // Convert special keywords
                .replace(/(npm:|docker:|jest:|webpack:)(.+)/g, '<span class="keyword">$1</span>$2')
                // Convert commands
                .replace(/(^|\s)([>$])(.+)/g, '$1<span class="command">$2$3</span>')
                // Convert comments
                .replace(/(^|\s)(\/\/.+)/g, '$1<span class="comment">$2</span>');
        }

        messageDiv.innerHTML = `
            <div class="message-content">
                ${content}
            </div>
        `;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return messageDiv;
    }

    // Add typing indicator
    let typingTimeout;
    userInput.addEventListener('input', () => {
        clearTimeout(typingTimeout);
        userInput.classList.add('typing');
        typingTimeout = setTimeout(() => {
            userInput.classList.remove('typing');
        }, 1000);
    });
}); 