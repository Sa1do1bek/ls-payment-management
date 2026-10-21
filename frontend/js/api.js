import { API_BASE_URL } from './config.js';

export class ApiRequestError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, expectedStatus = 200 } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiRequestError('Cannot connect to the server. Check that the backend is running.');
  }

  let payload;
  try {
    payload = JSON.parse(await response.text());
  } catch {
    throw new ApiRequestError('The server returned an unreadable response.', response.ok ? null : response.status);
  }

  if (!response.ok) {
    const safeMessage = [400, 404, 409].includes(response.status)
      && payload && typeof payload.message === 'string' && payload.message.length <= 300
      ? payload.message : null;
    throw new ApiRequestError(safeMessage || `Server request failed (HTTP ${response.status}).`, response.status);
  }
  if (response.status !== expectedStatus || payload === null || typeof payload !== 'object') {
    throw new ApiRequestError('The server returned an unexpected response.');
  }
  return payload;
}

export async function getStudents() {
  const students = await request('/api/students');
  if (!Array.isArray(students)) throw new ApiRequestError('The student list has an unexpected format.');
  return students;
}

export async function getDebtors(month) {
  const debtors = await request(`/api/debtors?month=${encodeURIComponent(month)}`);
  if (!Array.isArray(debtors)) throw new ApiRequestError('The monthly report has an unexpected format.');
  return debtors;
}

export function createPayment(payment) {
  return request('/api/payments', { method: 'POST', body: payment, expectedStatus: 201 });
}
