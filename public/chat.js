(function () {
  const sessionId = localStorage.getItem('chatbotSessionId') || crypto.randomUUID();
  localStorage.setItem('chatbotSessionId', sessionId);
  let chatHistory = JSON.parse(localStorage.getItem('chatbotHistory') || '[]');

  const bubble     = document.querySelector('.chat-bubble');
  const windowEl   = document.querySelector('.chat-window');
  const input      = document.querySelector('.chat-input');
  const sendButton = document.querySelector('.chat-send');
  const chatBody   = document.querySelector('.chat-body');

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

    // ✅ Add typing indicator
    const typingEl = document.createElement('div');
    typingEl.className = 'message bot typing';
    typingEl.textContent = '...';
    chatBody.appendChild(typingEl);
    chatBody.scrollTop = chatBody.scrollHeight;

    try {
      const payload = {
        query,
        pageURL: window.location.href,
        sessionId,
        history: chatHistory.slice(-10)
      };
      const response = await fetch('https://blateco-chatbot.vercel.app/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      typingEl.remove(); // ✅ Remove the typing bubble
      appendMessage('bot', data.answer);
      chatHistory.push({ role: 'assistant', content: data.answer });
      localStorage.setItem('chatbotHistory', JSON.stringify(chatHistory));
    } catch (error) {
      typingEl.remove();
      appendMessage('bot', 'Sorry, something went wrong. Please try again.');
      console.error('Chat error:', error);
    }

    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function appendMessage(role, content) {
    const message = document.createElement('div');
    message.className = `message ${role}`;
    message.innerHTML = formatMessage(content);
    chatBody.appendChild(message);
  }

  /* ---------- Updated Markdown-aware formatter ---------- */
  function formatMessage(content) {
    const escapeHTML = (str) =>
      str.replace(/&/g, '&amp;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;');

    const renderInline = (str) => {
      let safe = escapeHTML(str);
      safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      safe = safe.replace(/(\*|_)(.+?)\1/g, '<em>$2</em>');
      return safe;
    };

    const lines = content.split('\n');
    let html = '';
    let inList = false;
    let listType = 'ul';

    lines.forEach(line => {
      const trimmed = line.trim();
      if (/^[-*•]\s+/.test(trimmed) || /^\d+[\.\-]\s+/.test(trimmed)) {
        const isNumbered = /^\d+[\.\-]\s+/.test(trimmed);
        if (!inList) {
          listType = isNumbered ? 'ol' : 'ul';
          html += `<${listType}>`;
          inList = true;
        }
        const itemContent = trimmed.replace(/^[-*•]\s+|^\d+[\.\-]\s+/, '');
        html += `<li>${renderInline(itemContent)}</li>`;
      } else if (/^#{1,3}\s+/.test(trimmed)) {
        if (inList) {
          html += `</${listType}>`;
          inList = false;
        }
        const level = trimmed.match(/^#+/)[0].length;
        const headingContent = trimmed.replace(/^#{1,3}\s+/, '');
        html += `<h${level}>${renderInline(headingContent)}</h${level}>`;
      } else if (trimmed) {
        if (inList) {
          html += `</${listType}>`;
          inList = false;
        }
        html += `<p>${renderInline(trimmed)}</p>`;
      }
    });

    if (inList) html += `</${listType}>`;
    return html || `<p>${renderInline(content)}</p>`;
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
