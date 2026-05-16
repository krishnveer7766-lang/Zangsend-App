const API_BASE = '/.netlify/functions';

export async function invokeNetlifyFunction(name: string, body: any) {
  const response = await fetch(`${API_BASE}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Failed to invoke ${name}`);
  }

  return response.json();
}
