// pages/index.js or pages/chat.js
import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export default function ChatbotPage() {
  const [input, setInput] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    const savedSession = localStorage.getItem('chatbotSessionId') || uuidv4();
    localStorage.setItem('chatbotSessionId', savedSession);
    setSessionId(savedSession);

    const savedHistory = JSON.parse(localStorage.getItem('chatbotHistory') || '[]');
    setChatLog(savedHistory);
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;

    const updatedHistory = [...chatLog, { role: 'user', content: input }];
    setChatLog(updatedHistory);

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: input,
        pageURL: location.href,
        sessionId,
        history: updatedHistory,
      }),
    }).then(r => r.json());

    const fullLog = [...updatedHistory, { role: 'assistant', content: res.answer }];
    setChatLog(fullLog);
    localStorage.setItem('chatbotHistory', JSON.stringify(fullLog));
    setInput('');
  };

  const handleReset = () => {
    localStorage.removeItem('chatbotSessionId');
    localStorage.removeItem('chatbotHistory');
    setChatLog([]);
    setInput('');
    location.reload();
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: 600, margin: '0 auto' }}>
      <h1>BlateCo Chatbot</h1>
      <div style={{ marginBottom: '1rem' }}>
        {chatLog.map((msg, idx) => (
          <p key={idx}>
            <strong>{msg.role === 'user' ? 'You' : 'Bot'}:</strong> {msg.content}
          </p>
        ))}
      </div>

      <textarea
        rows={3}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask a question..."
        style={{ width: '100%', padding: '0.5rem' }}
      />
      <button onClick={handleSend} style={{ marginTop: '0.5rem', marginRight: '1rem' }}>Send</button>
      <button onClick={handleReset} style={{ marginTop: '0.5rem' }}>Reset Chat</button>
    </div>
  );
}
