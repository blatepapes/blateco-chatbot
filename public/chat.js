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
      const payload = {
        query,
        pageURL: window.location.href,
        sessionId,
        history: chatHistory.slice(-10)
      };
      console.log('Sending payload:', payload);
      const response = await fetch('https://blateco-chatbot.vercel.app/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('API response:', data);
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
    message.innerHTML = formatMessage(content);
    chatBody.appendChild(message);
  }

  function formatMessage(content) {
    // Escape HTML to prevent XSS
    const escapeHTML = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Split content by lines
    const lines = content.split('\n');
    let html = '';
    let inList = false;
    let listType = 'ul';

    lines.forEach(line => {
      const trimmedLine = line.trim();

      // Handle bullet points (-, *, •) and numbered lists (1., 1-)
      if (trimmedLine.match(/^[-*•]\s+/) || trimmedLine.match(/^\d+\.\s+/) || trimmedLine.match(/^\d+-\s+/)) {
        const isNumbered = trimmedLine.match(/^\d+\.\s+/) || trimmedLine.match(/^\d+-\s+/);
        if (!inList) {
          listType = isNumbered ? 'ol' : 'ul';
          html += `<${listType}>`;
          inList = true;
        }
        const itemContent = trimmedLine.replace(/^[-*•]\s+|^(\d+\.\s+)|^\d+-\s+/, '');
        html += `<li>${escapeHTML(itemContent)}</li>`;
      }
      // Handle headings (# Heading, ## Heading)
      else if (trimmedLine.match(/^#{1,3}\s+/)) {
        if (inList) {
          html += `</${listType}>`;
          inList = false;
        }
        const level = trimmedLine.match(/^#+/)[0].length;
        const headingContent = trimmedLine.replace(/^#{1,3}\s+/, '');
        html += `<h${level}>${escapeHTML(headingContent)}</h${level}>`;
      }
      // Handle bold (**text**)
      else if (trimmedLine.match(/\*\*.*\*\*/)) {
        if (inList) {
          html += `</${listType}>`;
          inList = false;
        }
        const boldContent = trimmedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html += `<p>${boldContent}</p>`;
      }
      // Handle regular lines
      else {
        if (inList) {
          html += `</${listType}>`;
          inList = false;
        }
        if (trimmedLine) {
          html += `<p>${escapeHTML(trimmedLine)}</p>`;
        }
      }
    });

    if (inList) {
      html += `</${listType}>`;
    }

    return html || `<p>${escapeHTML(content)}</p>`;
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