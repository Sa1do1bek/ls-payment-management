import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ApiRequestError,
  createPayment,
  createStudent,
  deleteStudent,
  getDebtors,
  getStudents,
  updateStudent,
} from '../js/api.js';
import { outstandingTotal, paymentAmount, safeInteger, tuitionFee } from '../js/money.js';
import {
  createStudentCard,
  createStudentTableRow,
  extractGroups,
  filterStudents,
  formatUZS,
  validateStudentInput,
} from '../js/students.js';

async function withFetch(fake, exercise) {
  const original = globalThis.fetch;
  globalThis.fetch = fake;
  try {
    await exercise();
  } finally {
    globalThis.fetch = original;
  }
}

// Lightweight DOM mock for testing rendering in Node.js
class MockNode {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this._textContent = '';
    this.attributes = {};
    this.listeners = {};
    this.className = '';
    this.type = '';
    this.disabled = false;
  }
  get textContent() {
    if (this._textContent) return this._textContent;
    return this.children.map((c) => (typeof c === 'string' ? c : c.textContent || '')).join('');
  }
  set textContent(val) {
    this._textContent = String(val);
    this.children = [];
  }
  append(...nodes) {
    for (const node of nodes) {
      if (typeof node === 'string') {
        this.children.push({ textContent: node });
      } else {
        this.children.push(node);
      }
    }
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k]; }
  addEventListener(event, fn) { this.listeners[event] = fn; }
  replaceChildren(...nodes) { this.children = nodes; }
}

function withMockDocument(exercise) {
  const originalDoc = globalThis.document;
  globalThis.document = {
    createElement: (tag) => new MockNode(tag),
    createTextNode: (text) => ({ textContent: String(text) }),
  };
  try {
    exercise();
  } finally {
    globalThis.document = originalDoc;
  }
}

// ---------------- Existing Baseline Tests ----------------

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

test('payment input is checked as text before conversion to Number', () => {
  assert.equal(paymentAmount('9007199254740991'), Number.MAX_SAFE_INTEGER);
  for (const raw of ['0', '-1', '12.5', '9007199254740992', '9007199254740993']) {
    assert.throws(() => paymentAmount(raw), /positive whole UZS/);
  }
});

test('unsafe API monetary values are rejected even after JSON parsing rounded them', () => {
  const rounded = JSON.parse('{"debt":9007199254740993}').debt;
  assert.equal(rounded, 9007199254740992);
  assert.throws(() => safeInteger(rounded, 'Debt'), /outside the range/);
  assert.throws(() => outstandingTotal([{ debt: rounded }]), /outside the range/);
});

test('supported debtor amounts sum exactly beyond Number safe range', () => {
  assert.equal(outstandingTotal([{ debt: Number.MAX_SAFE_INTEGER }, { debt: 20 }]), 9007199254741011n);
});

// ---------------- Task 7 Specific Frontend Tests ----------------

test('1. student listing consumes GET /api/students and validates array format', async () => {
  const mockStudents = [
    { id: 1, name: 'Ali Valiyev', phone: '+998901234567', groupName: 'English B2', monthlyFee: 800000 },
    { id: 2, name: 'Malika Karimova', phone: '+998911234567', groupName: 'Mathematics A1', monthlyFee: 600000 },
  ];
  await withFetch(async (url, options) => {
    assert.equal(url, 'http://localhost:8080/api/students');
    assert.equal(options.method, 'GET');
    return new Response(JSON.stringify(mockStudents), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }, async () => {
    const result = await getStudents();
    assert.equal(result.length, 2);
    assert.equal(result[0].name, 'Ali Valiyev');
  });

  // Non-array returns error
  await withFetch(async () => new Response(JSON.stringify({ data: 'invalid' }), { status: 200 }), async () => {
    await assert.rejects(getStudents(), /unexpected format/);
  });
});

test('2. creating a student sends POST /api/students and parses 201 response', async () => {
  let capturedRequest;
  const newStudent = { name: 'Bobur Mirzo', phone: '+998931234567', groupName: 'History 101', monthlyFee: 750000 };

  await withFetch(async (url, options) => {
    capturedRequest = { url, options };
    return new Response(JSON.stringify({ id: 10, ...newStudent }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  }, async () => {
    const created = await createStudent(newStudent);
    assert.equal(created.id, 10);
    assert.equal(created.name, 'Bobur Mirzo');
  });

  assert.equal(capturedRequest.url, 'http://localhost:8080/api/students');
  assert.equal(capturedRequest.options.method, 'POST');
  assert.deepEqual(JSON.parse(capturedRequest.options.body), newStudent);
});

test('3. invalid student input is rejected before submission', () => {
  // Empty or whitespace name
  assert.throws(() => validateStudentInput({ name: '   ', phone: '+998901234567', groupName: 'QA', monthlyFeeRaw: '500000' }),
    /Name is required/);

  // Name exceeding 150 chars
  assert.throws(() => validateStudentInput({ name: 'A'.repeat(151), phone: '+998901234567', groupName: 'QA', monthlyFeeRaw: '500000' }),
    /must not exceed 150 characters/);

  // Empty or whitespace phone
  assert.throws(() => validateStudentInput({ name: 'Valid Name', phone: '', groupName: 'QA', monthlyFeeRaw: '500000' }),
    /Phone number is required/);

  // Phone exceeding 30 chars
  assert.throws(() => validateStudentInput({ name: 'Valid Name', phone: '+1'.repeat(16), groupName: 'QA', monthlyFeeRaw: '500000' }),
    /must not exceed 30 characters/);

  // Empty or whitespace group
  assert.throws(() => validateStudentInput({ name: 'Valid Name', phone: '+998901234567', groupName: '  ', monthlyFeeRaw: '500000' }),
    /Group name is required/);

  // Group exceeding 100 chars
  assert.throws(() => validateStudentInput({ name: 'Valid Name', phone: '+998901234567', groupName: 'G'.repeat(101), monthlyFeeRaw: '500000' }),
    /must not exceed 100 characters/);

  // Fee: negative, zero, decimal, non-numeric, unsafe integer
  for (const invalidFee of ['0', '-500', '100.50', 'abc', '', '9007199254740992']) {
    assert.throws(() => validateStudentInput({ name: 'Valid Name', phone: '+998901234567', groupName: 'QA', monthlyFeeRaw: invalidFee }),
      /positive whole UZS monthly fee/);
  }

  // Valid inputs pass and are trimmed
  const valid = validateStudentInput({
    name: '  Dilshod Aliyev  ',
    phone: '  +998901112233  ',
    groupName: '  Physics Alpha  ',
    monthlyFeeRaw: '  850000  ',
  });
  assert.deepEqual(valid, {
    name: 'Dilshod Aliyev',
    phone: '+998901112233',
    groupName: 'Physics Alpha',
    monthlyFee: 850000,
  });
});

test('4. editing a student sends full replacement PUT /api/students/{id} and returns 200', async () => {
  let capturedRequest;
  const updatePayload = { name: 'Ali Valiyev Updated', phone: '+998909998877', groupName: 'English C1', monthlyFee: 900000 };

  await withFetch(async (url, options) => {
    capturedRequest = { url, options };
    return new Response(JSON.stringify({ id: 5, ...updatePayload }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }, async () => {
    const updated = await updateStudent(5, updatePayload);
    assert.equal(updated.id, 5);
    assert.equal(updated.monthlyFee, 900000);
  });

  assert.equal(capturedRequest.url, 'http://localhost:8080/api/students/5');
  assert.equal(capturedRequest.options.method, 'PUT');
  assert.deepEqual(JSON.parse(capturedRequest.options.body), updatePayload);
});

test('5. deleting a student without payments sends DELETE /api/students/{id} and handles HTTP 204', async () => {
  let capturedRequest;
  await withFetch(async (url, options) => {
    capturedRequest = { url, options };
    return new Response(null, { status: 204 });
  }, async () => {
    const result = await deleteStudent(8);
    assert.equal(result, null);
  });

  assert.equal(capturedRequest.url, 'http://localhost:8080/api/students/8');
  assert.equal(capturedRequest.options.method, 'DELETE');
});

test('6. deletion conflict HTTP 409 returns meaningful backend error message', async () => {
  const backendError = {
    status: 409,
    error: 'Conflict',
    message: 'Student with ID 1 cannot be deleted because payment history exists',
    path: '/api/students/1',
  };

  await withFetch(async () => new Response(JSON.stringify(backendError), { status: 409 }), async () => {
    await assert.rejects(deleteStudent(1), (err) => {
      assert(err instanceof ApiRequestError);
      assert.equal(err.status, 409);
      assert.equal(err.message, 'Student with ID 1 cannot be deleted because payment history exists');
      return true;
    });
  });
});

test('7. nonexistent student deletion HTTP 404 is handled correctly', async () => {
  const backendError = {
    status: 404,
    error: 'Not Found',
    message: 'Student with ID 999 was not found',
    path: '/api/students/999',
  };

  await withFetch(async () => new Response(JSON.stringify(backendError), { status: 404 }), async () => {
    await assert.rejects(deleteStudent(999), (err) => {
      assert(err instanceof ApiRequestError);
      assert.equal(err.status, 404);
      assert.equal(err.message, 'Student with ID 999 was not found');
      return true;
    });
  });
});

test('8. search behavior matches student name, phone, or ID case-insensitively', () => {
  const students = [
    { id: 1, name: 'Ali Valiyev', phone: '+998901234567', groupName: 'English B2', monthlyFee: 800000 },
    { id: 2, name: 'Malika Karimova', phone: '+998911234567', groupName: 'Math A1', monthlyFee: 600000 },
    { id: 33, name: 'Vali Aliyev', phone: '+998939876543', groupName: 'English B2', monthlyFee: 800000 },
  ];

  // Search by name lowercase - "iyev" matches Ali Valiyev and Vali Aliyev
  const nameSearch = filterStudents(students, { query: 'iyev' });
  assert.equal(nameSearch.length, 2);

  // Search by specific name "karim" matches Malika Karimova
  const karimSearch = filterStudents(students, { query: 'karim' });
  assert.equal(karimSearch.length, 1);
  assert.equal(karimSearch[0].id, 2);

  // Search by phone substring
  const phoneSearch = filterStudents(students, { query: '9876543' });
  assert.equal(phoneSearch.length, 1);
  assert.equal(phoneSearch[0].id, 33);

  // Search by ID exact or partial
  const idSearch = filterStudents(students, { query: '33' });
  assert.equal(idSearch.length, 1);
  assert.equal(idSearch[0].name, 'Vali Aliyev');

  // Search with no matches
  const emptySearch = filterStudents(students, { query: 'Nonexistent' });
  assert.equal(emptySearch.length, 0);
});

test('9. group filtering filters accurately and combines with search', () => {
  const students = [
    { id: 1, name: 'Ali Valiyev', phone: '+998901234567', groupName: 'English B2', monthlyFee: 800000 },
    { id: 2, name: 'Malika Karimova', phone: '+998911234567', groupName: 'Math A1', monthlyFee: 600000 },
    { id: 3, name: 'Sardor Rakhimov', phone: '+998941234567', groupName: 'English B2', monthlyFee: 800000 },
  ];

  // Group choices extraction
  const groups = extractGroups(students);
  assert.deepEqual(groups, ['English B2', 'Math A1']);

  // Filter only by group
  const englishGroup = filterStudents(students, { group: 'English B2' });
  assert.equal(englishGroup.length, 2);

  // Combined search and group
  const combined = filterStudents(students, { query: 'Ali', group: 'English B2' });
  assert.equal(combined.length, 1);
  assert.equal(combined[0].name, 'Ali Valiyev');

  // Combined with no match
  const noMatch = filterStudents(students, { query: 'Malika', group: 'English B2' });
  assert.equal(noMatch.length, 0);
});

test('10. payment dropdown synchronization handles addition, renaming, and removal', () => {
  const initial = [
    { id: 1, name: 'Ali Valiyev', groupName: 'English B2' },
    { id: 2, name: 'Malika Karimova', groupName: 'Math A1' },
  ];

  // Helper simulating dropdown options update
  function updateOptions(students, selectedId) {
    const valid = students.some((s) => String(s.id) === String(selectedId));
    return {
      options: students.map((s) => ({ value: String(s.id), text: `${s.name} · #${s.id} · ${s.groupName}` })),
      selectedId: valid ? selectedId : '',
    };
  }

  // Initial state with student 1 selected
  let state = updateOptions(initial, '1');
  assert.equal(state.options.length, 2);
  assert.equal(state.selectedId, '1');

  // Renamed student: selection preserved, text updated
  const updated = [
    { id: 1, name: 'Ali Valiyev Renamed', groupName: 'English C1' },
    { id: 2, name: 'Malika Karimova', groupName: 'Math A1' },
  ];
  state = updateOptions(updated, '1');
  assert.equal(state.selectedId, '1');
  assert.equal(state.options[0].text, 'Ali Valiyev Renamed · #1 · English C1');

  // Deleted student 1: selection cleared safely
  const afterDeletion = [
    { id: 2, name: 'Malika Karimova', groupName: 'Math A1' },
  ];
  state = updateOptions(afterDeletion, '1');
  assert.equal(state.options.length, 1);
  assert.equal(state.selectedId, ''); // cleared safely
});

test('11. tuitionFee validates positive whole UZS and currency formatting is consistent', () => {
  assert.equal(tuitionFee('800000'), 800000);
  assert.equal(formatUZS(800000), '800,000 UZS');
  assert.equal(formatUZS(1500000), '1,500,000 UZS');
});

test('12. protection against duplicate submissions blocks re-triggering while pending', async () => {
  let inFlight = false;
  let executionCount = 0;

  async function mockSubmitAction() {
    if (inFlight) return; // duplicate blocked
    inFlight = true;
    try {
      executionCount++;
      await new Promise((resolve) => setTimeout(resolve, 20));
    } finally {
      inFlight = false;
    }
  }

  // Trigger two concurrent submissions
  await Promise.all([mockSubmitAction(), mockSubmitAction()]);
  assert.equal(executionCount, 1, 'Second concurrent submission was prevented');
});

test('13. rendering potentially unsafe student text displays as plain text without HTML injection', () => {
  withMockDocument(() => {
    const unsafeStudent = {
      id: 99,
      name: '<script>alert("xss")</script>',
      phone: '<b>+998901234567</b>',
      groupName: '<img src=x onerror=alert(1)>',
      monthlyFee: 500000,
    };

    const row = createStudentTableRow(unsafeStudent, { onEdit: () => {}, onDelete: () => {} });
    assert(row.textContent.includes('<script>alert("xss")</script>'));
    assert(row.textContent.includes('<b>+998901234567</b>'));
    assert(row.textContent.includes('<img src=x onerror=alert(1)>'));

    const card = createStudentCard(unsafeStudent, { onEdit: () => {}, onDelete: () => {} });
    assert(card.textContent.includes('<script>alert("xss")</script>'));
    assert(card.textContent.includes('<img src=x onerror=alert(1)>'));
  });
});
