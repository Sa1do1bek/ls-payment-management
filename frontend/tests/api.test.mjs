import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiRequestError, createPayment, getDebtors, getStudents } from '../js/api.js';

async function withFetch(fake, exercise) {
  const original = globalThis.fetch;
  globalThis.fetch = fake;
  try {
    await exercise();
  } finally {
    globalThis.fetch = original;
  }
}

test('payment creation sends exact validated numbers and waits for HTTP 201', async () => {
  let request;
  await withFetch(async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ id: 3, studentId: 7, amount: 300000, paymentDate: '2026-10-21' }),
      { status: 201, headers: { 'Content-Type': 'application/json' } });
  }, async () => {
    const saved = await createPayment({ studentId: 7, amount: 300000, paymentDate: '2026-10-21' });
    assert.equal(saved.id, 3);
  });
  assert.equal(request.url, 'http://localhost:8080/api/payments');
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body),
    { studentId: 7, amount: 300000, paymentDate: '2026-10-21' });
});

test('validation errors retain the safe API message', async () => {
  await withFetch(async () => new Response(JSON.stringify({ status: 400, message: 'amount must be positive' }),
    { status: 400 }), async () => {
    await assert.rejects(getStudents(), (error) => error instanceof ApiRequestError
      && error.status === 400 && error.message === 'amount must be positive');
  });
});

test('server failures do not display internal error details', async () => {
  await withFetch(async () => new Response(JSON.stringify({ message: 'SQL stack trace secret' }),
    { status: 500 }), async () => {
    await assert.rejects(getDebtors('2026-10'), (error) => error.status === 500
      && !error.message.includes('SQL stack trace secret'));
  });
});

test('network failure and invalid JSON are distinct errors', async () => {
  await withFetch(async () => { throw new Error('socket closed'); }, async () => {
    await assert.rejects(getStudents(), /Cannot connect to the server/);
  });
  await withFetch(async () => new Response('<html>wrong content</html>', { status: 200 }), async () => {
    await assert.rejects(getStudents(), /unreadable response/);
  });
});

test('unexpected JSON shape is rejected rather than rendered as empty data', async () => {
  await withFetch(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }), async () => {
    await assert.rejects(getDebtors('2026-10'), /unexpected format/);
  });
});
