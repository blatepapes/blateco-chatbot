(function () {
  const sessionId = localStorage.getItem('chatbotSessionId') || crypto.randomUUID();
  localStorage.setItem('chatbotSessionId', sessionId);
  let chatHistory = JSON.parse(localStorage.getItem('chatbotHistory') || '[]');

  const bubble = document.querySelector('.chat-bubble');
  const windowEl = document.querySelector('.chat-window');
  const input = document.querySelector('.chat-input');
  const sendButton = document.querySelector('.chat-send');
  const chatBody = document.querySelector('.chat-body');

  if (chatHistory.length === 0) {
    appendMessage('bot', 'Hi there 👋! Let me know if you have any questions at all!');
    chatHistory.push({ role: 'assistant', content: 'Hi there 👋! Let me know if you have any questions at all!' });
    localStorage.setItem('chatbotHistory', JSON.stringify(chatHistory));
  } else {
    chatHistory.forEach(msg => appendMessage(msg.role, msg.content));
  }

  bubble.addEventListener('click', () => {
    windowEl.classList.toggle('active');
    if (windowEl.classList.contains('active')) {
      input.focus();
      chatBody.scrollTop = chatBody.scrollHeight;
    }
  });

  input.addEventListener('input', () => {
    sendButton.classList.toggle('active', input.value.trim().length > 0);
  });

  sendButton.addEventListener('click', sendMessage);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  async function sendMessage() {
    const query = input.value.trim();
    if (!query) return;

    appendMessage('user', query);
    chatHistory.push({ role: 'user', content: query });
    input.value = '';
    sendButton.classList.remove('active');

    try {
      const response = await fetch('https://blateco-chatbot.vercel.app/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          pageURL: window.location.href,
          sessionId,
          history: chatHistory.slice(-10)
        })
      });
      const data = await response.json();

      if (data.error) throw new Error(data.error);
      appendMessage('bot', data.answer);
      chatHistory.push({ role: 'assistant', content: data.answer });
      localStorage.setItem('chatbotHistory', JSON.stringify(chatHistory));
    } catch (error) {
      appendMessage('bot', 'Sorry, something went wrong. Please try again.');
      console.error('Chat error:', error);
    }

    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function appendMessage(role, content) {
    const message = document.createElement('div');
    message.className = `message ${role}`;
    message.textContent = content;
    chatBody.appendChild(message);
  }

  function resetChat() {
    localStorage.removeItem('chatbotSessionId');
    localStorage.removeItem('chatbotHistory');
    chatHistory = [];
    chatBody.innerHTML = '';
    appendMessage('bot', 'Hi there 👋! Let me know if you have any questions at all!');
    chatHistory.push({ role: 'assistant', content: 'Hi there 👋! Let me know if you have any questions at all!' });
    localStorage.setItem('chatbotHistory', JSON.stringify(chatHistory));
    sendButton.classList.remove('active');
  }

  window.resetChat = resetChat;
})();