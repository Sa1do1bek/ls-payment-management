import { ApiRequestError, createPayment, getDebtors, getStudents } from './api.js';

const elements = {
  notice: document.querySelector('#notice'),
  month: document.querySelector('#report-month'),
  refresh: document.querySelector('#refresh-debtors'),
  debtorCount: document.querySelector('#debtor-count'),
  totalDebt: document.querySelector('#total-debt'),
  loading: document.querySelector('#debtors-loading'),
  reportError: document.querySelector('#debtors-error'),
  empty: document.querySelector('#debtors-empty'),
  content: document.querySelector('#debtors-content'),
  tableBody: document.querySelector('#debtors-table-body'),
  cards: document.querySelector('#debtors-cards'),
  studentsStatus: document.querySelector('#students-status'),
  form: document.querySelector('#payment-form'),
  student: document.querySelector('#payment-student'),
  amount: document.querySelector('#payment-amount'),
  date: document.querySelector('#payment-date'),
  submit: document.querySelector('#submit-payment'),
  paymentPanel: document.querySelector('#payment-panel'),
};

const state = { students: [], debtors: [], reportRequest: 0, paymentPending: false };
const moneyFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function localDateParts(date = new Date()) {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return { month: `${year}-${month}`, date: `${year}-${month}-${day}` };
}

function validMonth(value) {
  return /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function safeInteger(value, field, positive = false) {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) {
    throw new Error(`${field} is outside the range this browser can display exactly.`);
  }
  return value;
}

function formatMoney(value) {
  return `${moneyFormatter.format(value)} UZS`;
}

function showNotice(kind, message) {
  elements.notice.className = `notice notice-${kind}`;
  elements.notice.textContent = message;
}

function clearNotice() {
  elements.notice.className = 'notice d-none';
  elements.notice.textContent = '';
}

function reportState(mode, message = '') {
  elements.loading.hidden = mode !== 'loading';
  elements.reportError.hidden = mode !== 'error';
  elements.empty.hidden = mode !== 'empty';
  elements.content.hidden = mode !== 'content';
  elements.reportError.textContent = mode === 'error' ? message : '';
  elements.refresh.disabled = mode === 'loading';
}

function validatedStudent(student) {
  if (!student || typeof student.name !== 'string' || typeof student.groupName !== 'string') {
    throw new Error('The student list contains an invalid record.');
  }
  return { ...student, id: safeInteger(student.id, 'Student ID', true) };
}

function validatedDebtor(debtor) {
  if (!debtor || ['name', 'phone', 'groupName'].some((field) => typeof debtor[field] !== 'string')) {
    throw new Error('The monthly report contains an invalid record.');
  }
  return {
    ...debtor,
    studentId: safeInteger(debtor.studentId, 'Student ID', true),
    monthlyFee: safeInteger(debtor.monthlyFee, 'Monthly fee'),
    paidAmount: safeInteger(debtor.paidAmount, 'Paid amount'),
    debt: safeInteger(debtor.debt, 'Debt'),
  };
}

async function loadStudents() {
  elements.studentsStatus.classList.remove('error');
  elements.studentsStatus.textContent = 'Loading students…';
  elements.student.disabled = true;
  elements.submit.disabled = true;
  try {
    const students = (await getStudents()).map(validatedStudent);
    const previousSelection = elements.student.value;
    state.students = students;
    const placeholder = new Option('Select a student', '');
    const options = students.map((student) => new Option(
      `${student.name} · #${student.id} · ${student.groupName}`, String(student.id),
    ));
    elements.student.replaceChildren(placeholder, ...options);
    if (students.some((student) => String(student.id) === previousSelection)) {
      elements.student.value = previousSelection;
    }
    elements.student.disabled = students.length === 0;
    elements.submit.disabled = students.length === 0 || state.paymentPending;
    elements.studentsStatus.textContent = students.length === 0
      ? 'No students are available. Add a student through the backend before recording a payment.'
      : `${students.length} student${students.length === 1 ? '' : 's'} available`;
  } catch (error) {
    state.students = [];
    elements.student.replaceChildren(new Option('Select a student', ''));
    elements.student.disabled = true;
    elements.submit.disabled = true;
    elements.studentsStatus.classList.add('error');
    elements.studentsStatus.textContent = `Student list unavailable. ${error.message}`;
  }
}

function textElement(tag, className, value) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = value;
  return node;
}

function quickPaymentButton(studentId) {
  const button = textElement('button', 'btn btn-sm btn-outline-primary quick-pay', 'Record payment');
  button.type = 'button';
  button.addEventListener('click', () => {
    if (!state.students.some((student) => student.id === studentId)) {
      showNotice('error', 'This student is not available in the payment selector. Reload the page to update the student list.');
      return;
    }
    elements.student.value = String(studentId);
    elements.paymentPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    elements.amount.focus({ preventScroll: true });
  });
  return button;
}

function tableRow(debtor) {
  const row = document.createElement('tr');
  const student = document.createElement('td');
  student.append(textElement('span', 'student-name', debtor.name), textElement('span', 'student-id', `ID #${debtor.studentId}`));
  const contact = document.createElement('td');
  contact.append(textElement('span', '', debtor.groupName), textElement('span', 'secondary-text', debtor.phone));
  row.append(student, contact);
  for (const [value, className] of [
    [debtor.monthlyFee, 'money-cell text-end'],
    [debtor.paidAmount, 'money-cell text-end'],
    [debtor.debt, 'money-cell text-end debt-amount'],
  ]) {
    row.append(textElement('td', className, formatMoney(value)));
  }
  const action = document.createElement('td');
  action.append(quickPaymentButton(debtor.studentId));
  row.append(action);
  return row;
}

function detail(label, value) {
  const item = document.createElement('div');
  item.append(textElement('span', 'detail-label', label), textElement('span', 'detail-value', value));
  return item;
}

function mobileCard(debtor) {
  const card = document.createElement('article');
  card.className = 'debtor-card';
  const top = document.createElement('div');
  top.className = 'card-top';
  const identity = document.createElement('div');
  identity.append(textElement('strong', 'student-name', debtor.name), textElement('span', 'student-id', `ID #${debtor.studentId}`));
  const amount = document.createElement('div');
  amount.className = 'card-debt';
  amount.append(textElement('span', 'card-debt-label', 'Outstanding'), document.createTextNode(formatMoney(debtor.debt)));
  top.append(identity, amount);
  const details = document.createElement('div');
  details.className = 'card-details';
  details.append(
    detail('Group', debtor.groupName), detail('Phone', debtor.phone),
    detail('Monthly tuition', formatMoney(debtor.monthlyFee)), detail('Paid this month', formatMoney(debtor.paidAmount)),
  );
  card.append(top, details, quickPaymentButton(debtor.studentId));
  return card;
}

function renderDebtors(debtors) {
  state.debtors = debtors;
  const total = debtors.reduce((sum, debtor) => sum + BigInt(debtor.debt), 0n);
  elements.debtorCount.textContent = String(debtors.length);
  elements.totalDebt.textContent = `${total.toLocaleString('en-US')} UZS`;
  elements.tableBody.replaceChildren(...debtors.map(tableRow));
  elements.cards.replaceChildren(...debtors.map(mobileCard));
  reportState(debtors.length === 0 ? 'empty' : 'content');
}

async function loadDebtors() {
  const requestId = ++state.reportRequest;
  const month = elements.month.value;
  state.debtors = [];
  elements.tableBody.replaceChildren();
  elements.cards.replaceChildren();
  elements.debtorCount.textContent = '—';
  elements.totalDebt.textContent = '—';
  if (!validMonth(month)) {
    reportState('error', 'Select a valid month in YYYY-MM format.');
    return false;
  }
  reportState('loading');
  try {
    const debtors = (await getDebtors(month)).map(validatedDebtor);
    if (requestId !== state.reportRequest) return true;
    renderDebtors(debtors);
    return true;
  } catch (error) {
    if (requestId !== state.reportRequest) return true;
    reportState('error', error.message);
    return false;
  }
}

function paymentDetails() {
  const studentId = Number(elements.student.value);
  if (!elements.student.value || !Number.isSafeInteger(studentId) || studentId <= 0
      || !state.students.some((student) => student.id === studentId)) {
    elements.student.focus();
    throw new Error('Select a student before recording a payment.');
  }
  const rawAmount = elements.amount.value.trim();
  if (!/^[0-9]+$/.test(rawAmount) || BigInt(rawAmount) < 1n || BigInt(rawAmount) > BigInt(Number.MAX_SAFE_INTEGER)) {
    elements.amount.focus();
    throw new Error('Enter a positive whole UZS amount within the displayed limit.');
  }
  if (!elements.date.value || !elements.date.validity.valid) {
    elements.date.focus();
    throw new Error('Select a valid payment date.');
  }
  return { studentId, amount: Number(rawAmount), paymentDate: elements.date.value };
}

async function submitPayment(event) {
  event.preventDefault();
  if (state.paymentPending) return;
  let payment;
  try {
    payment = paymentDetails();
  } catch (error) {
    showNotice('error', error.message);
    return;
  }

  state.paymentPending = true;
  elements.submit.disabled = true;
  elements.submit.textContent = 'Saving payment…';
  clearNotice();
  try {
    await createPayment(payment);
    elements.amount.value = '';
    showNotice('success', `Payment of ${formatMoney(payment.amount)} recorded. Refreshing the current report…`);
    const refreshed = await loadDebtors();
    if (refreshed) {
      showNotice('success', `Payment of ${formatMoney(payment.amount)} recorded successfully.`);
    } else {
      showNotice('warning', `Payment of ${formatMoney(payment.amount)} was recorded, but the report could not refresh. Use Refresh report to try again.`);
    }
  } catch (error) {
    const message = error instanceof ApiRequestError && error.status && error.status < 500
      ? error.message : 'Could not confirm the payment. Check the records before submitting again.';
    showNotice('error', message);
  } finally {
    state.paymentPending = false;
    elements.submit.textContent = 'Record payment';
    elements.submit.disabled = state.students.length === 0;
  }
}

const today = localDateParts();
elements.month.value = today.month;
elements.date.value = today.date;
elements.month.addEventListener('change', loadDebtors);
elements.refresh.addEventListener('click', loadDebtors);
elements.form.addEventListener('submit', submitPayment);
void loadStudents();
void loadDebtors();
