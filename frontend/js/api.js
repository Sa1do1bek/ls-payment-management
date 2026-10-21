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

  const text = await response.text();
  let payload = null;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiRequestError('The server returned an unreadable response.', response.ok ? null : response.status);
    }
  }

  if (!response.ok) {
    const safeMessage = [400, 404, 409].includes(response.status)
      && payload && typeof payload.message === 'string' && payload.message.length <= 300
      ? payload.message : null;
    throw new ApiRequestError(safeMessage || `Server request failed (HTTP ${response.status}).`, response.status);
  }
  if (response.status !== expectedStatus) {
    throw new ApiRequestError('The server returned an unexpected response.');
  }
  if (expectedStatus === 204) {
    return null;
  }
  if (payload === null || typeof payload !== 'object') {
    throw new ApiRequestError('The server returned an unexpected response.');
  }
  return payload;
}

export async function getStudents() {
  const students = await request('/api/students');
  if (!Array.isArray(students)) throw new ApiRequestError('The student list has an unexpected format.');
  return students;
}

export function createStudent(student) {
  return request('/api/students', { method: 'POST', body: student, expectedStatus: 201 });
}

export function updateStudent(id, student) {
  return request(`/api/students/${encodeURIComponent(id)}`, { method: 'PUT', body: student, expectedStatus: 200 });
}

export function deleteStudent(id) {
  return request(`/api/students/${encodeURIComponent(id)}`, { method: 'DELETE', expectedStatus: 204 });
}

export async function getDebtors(month) {
  const debtors = await request(`/api/debtors?month=${encodeURIComponent(month)}`);
  if (!Array.isArray(debtors)) throw new ApiRequestError('The monthly report has an unexpected format.');
  return debtors;
}

export function createPayment(payment) {
  return request('/api/payments', { method: 'POST', body: payment, expectedStatus: 201 });
}
