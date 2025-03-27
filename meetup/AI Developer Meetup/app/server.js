import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;
const model = 'mistral';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// Function to query Ollama
async function queryOllama(prompt) {
    const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: model,
            prompt: prompt,
            stream: false
        })
    });
    const data = await response.json();
    return data.response;
}

// API endpoint for chat
app.post('/chat', async (req, res) => {
    try {
        const { message, history} = req.body;
        
        // Create conversation history
        const conversationHistory = history.map(msg => {
            return `${msg.role === 'user' ? 'Customer' : 'Assistant'}: ${msg.content}`;
        }).join('\n');

        // Create prompt for Ollama with conversation history
        const prompt = `You are a helpful and friendly e-commerce shopping assistant. Your role is to:
1. Help customers find products
2. Answer questions about prices, availability, and shipping
3. Provide product recommendations
4. Handle basic customer service inquiries
5. Be professional yet conversational

Previous conversation:
${conversationHistory}

Current customer message: ${message}

Respond to the customer's message in a helpful and friendly way, taking into account the conversation history. If you don't have specific product information, you can make general suggestions or ask for more details about what they're looking for.`;

        // Get response from Ollama
        const response = await queryOllama(prompt);
        
        res.json({ response });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

// Serve the frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 