import { useState } from 'react';

export default function Chat() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: input }),
    });
    const data = await res.json();
    setResponse(data.answer);
    setLoading(false);
  };

  return (
    <main className="p-4 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Blated Support Chat</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea value={input} onChange={e => setInput(e.target.value)} rows={4} className="p-2 border" />
        <button disabled={loading} className="bg-black text-white px-4 py-2">
          {loading ? 'Thinking...' : 'Ask'}
        </button>
      </form>
      {response && (
        <div className="mt-4 p-4 border bg-gray-50">
          <strong>Answer:</strong>
          <p>{response}</p>
        </div>
      )}
    </main>
  );
}
