import {
  ApiRequestError,
  createPayment,
  createStudent,
  deleteStudent,
  getDebtors,
  getStudents,
  updateStudent,
} from './api.js';
import { outstandingTotal, paymentAmount, safeInteger } from './money.js';
import {
  createStudentCard,
  createStudentTableRow,
  extractGroups,
  filterStudents,
  formatUZS,
  validateStudentInput,
} from './students.js';

const elements = {
  // Navigation & notices
  navPayments: document.querySelector('#nav-tab-payments'),
  navStudents: document.querySelector('#nav-tab-students'),
  viewPayments: document.querySelector('#view-payments'),
  viewStudents: document.querySelector('#view-students'),
  notice: document.querySelector('#notice'),

  // Debtors & Payments
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

  // Students Directory
  studentsLoading: document.querySelector('#students-table-loading'),
  studentsError: document.querySelector('#students-table-error'),
  studentsEmpty: document.querySelector('#students-table-empty'),
  studentsNoMatches: document.querySelector('#students-table-no-matches'),
  studentsContent: document.querySelector('#students-table-content'),
  studentsTableBody: document.querySelector('#students-table-body'),
  studentsCards: document.querySelector('#students-cards'),
  studentSearch: document.querySelector('#student-search'),
  studentGroupFilter: document.querySelector('#student-group-filter'),
  btnResetFilters: document.querySelector('#btn-reset-filters'),
  btnNoMatchesReset: document.querySelector('#btn-no-matches-reset'),
  filteredStudentCount: document.querySelector('#filtered-student-count'),
  totalStudentCount: document.querySelector('#total-student-count'),
  btnOpenCreateStudent: document.querySelector('#btn-open-create-student'),
  btnEmptyAddStudent: document.querySelector('#btn-empty-add-student'),

  // Create Student Modal
  createModal: document.querySelector('#create-student-modal'),
  createForm: document.querySelector('#create-student-form'),
  createName: document.querySelector('#create-student-name'),
  createPhone: document.querySelector('#create-student-phone'),
  createGroup: document.querySelector('#create-student-group'),
  createFee: document.querySelector('#create-student-fee'),
  createError: document.querySelector('#create-student-error'),
  submitCreate: document.querySelector('#submit-create-student'),

  // Edit Student Modal
  editModal: document.querySelector('#edit-student-modal'),
  editForm: document.querySelector('#edit-student-form'),
  editId: document.querySelector('#edit-student-id'),
  editName: document.querySelector('#edit-student-name'),
  editPhone: document.querySelector('#edit-student-phone'),
  editGroup: document.querySelector('#edit-student-group'),
  editFee: document.querySelector('#edit-student-fee'),
  editError: document.querySelector('#edit-student-error'),
  submitEdit: document.querySelector('#submit-edit-student'),

  // Delete Student Modal
  deleteModal: document.querySelector('#delete-student-modal'),
  deleteDetails: document.querySelector('#delete-student-details'),
  deleteError: document.querySelector('#delete-student-error'),
  submitDelete: document.querySelector('#submit-delete-student'),
};

const state = {
  students: [],
  debtors: [],
  reportRequest: 0,
  studentsRequest: 0,
  paymentPending: false,
  studentCreatePending: false,
  studentEditPending: false,
  studentDeletePending: false,
  activeTab: 'payments',
  searchQuery: '',
  selectedGroup: '',
  studentPendingDelete: null,
};

function localDateParts(date = new Date()) {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return { month: `${year}-${month}`, date: `${year}-${month}-${day}` };
}

function validMonth(value) {
  return /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value);
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
  return {
    ...student,
    id: safeInteger(student.id, 'Student ID', true),
    monthlyFee: safeInteger(student.monthlyFee, 'Monthly fee', true),
  };
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

function textElement(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value;
  return node;
}

// Tab Switching
function switchTab(target) {
  state.activeTab = target;
  const isPayments = target === 'payments';

  elements.navPayments.classList.toggle('active', isPayments);
  elements.navPayments.setAttribute('aria-selected', isPayments ? 'true' : 'false');
  elements.viewPayments.hidden = !isPayments;
  elements.viewPayments.classList.toggle('d-none', !isPayments);

  elements.navStudents.classList.toggle('active', !isPayments);
  elements.navStudents.setAttribute('aria-selected', isPayments ? 'false' : 'true');
  elements.viewStudents.hidden = isPayments;
  elements.viewStudents.classList.toggle('d-none', isPayments);
}

// Modal Dialog Helpers
function openModal(modal) {
  modal.hidden = false;
  modal.classList.remove('d-none');
  const errorBox = modal.querySelector('.alert');
  if (errorBox) {
    errorBox.classList.add('d-none');
    errorBox.textContent = '';
  }
  const focusTarget = modal.querySelector('input:not([type="hidden"]), button.btn-close');
  if (focusTarget) focusTarget.focus();
}

function closeModal(modal) {
  modal.hidden = true;
  modal.classList.add('d-none');
  const errorBox = modal.querySelector('.alert');
  if (errorBox) {
    errorBox.classList.add('d-none');
    errorBox.textContent = '';
  }
}

// Update Group Filter Dropdown choices
function updateGroupOptions(groups) {
  const currentSelection = elements.studentGroupFilter.value;
  const defaultOption = new Option('All groups', '');
  const options = groups.map((group) => new Option(group, group));
  elements.studentGroupFilter.replaceChildren(defaultOption, ...options);
  if (groups.includes(currentSelection)) {
    elements.studentGroupFilter.value = currentSelection;
    state.selectedGroup = currentSelection;
  } else {
    elements.studentGroupFilter.value = '';
    state.selectedGroup = '';
  }
}

// Update Payment Form student dropdown
function updatePaymentStudentOptions(students) {
  const previousSelection = elements.student.value;
  const placeholder = new Option('Select a student', '');
  const options = students.map((student) => new Option(
    `${student.name} · #${student.id} · ${student.groupName}`, String(student.id),
  ));
  elements.student.replaceChildren(placeholder, ...options);
  if (students.some((student) => String(student.id) === previousSelection)) {
    elements.student.value = previousSelection;
  } else {
    elements.student.value = '';
  }
  elements.student.disabled = students.length === 0;
  elements.submit.disabled = students.length === 0 || state.paymentPending;
  elements.studentsStatus.textContent = students.length === 0
    ? 'No students are available. Add a student through the Students tab before recording a payment.'
    : `${students.length} student${students.length === 1 ? '' : 's'} available`;
}

// Render Students Directory
function renderStudents() {
  const filtered = filterStudents(state.students, {
    query: state.searchQuery,
    group: state.selectedGroup,
  });

  elements.totalStudentCount.textContent = String(state.students.length);
  elements.filteredStudentCount.textContent = String(filtered.length);

  elements.studentsLoading.hidden = true;
  elements.studentsError.hidden = true;

  if (state.students.length === 0) {
    elements.studentsEmpty.hidden = false;
    elements.studentsNoMatches.hidden = true;
    elements.studentsContent.hidden = true;
    return;
  }

  elements.studentsEmpty.hidden = true;

  if (filtered.length === 0) {
    elements.studentsNoMatches.hidden = false;
    elements.studentsContent.hidden = true;
    return;
  }

  elements.studentsNoMatches.hidden = true;
  elements.studentsContent.hidden = false;

  const rows = filtered.map((student) => createStudentTableRow(student, {
    onEdit: openEditModal,
    onDelete: openDeleteModal,
  }));
  elements.studentsTableBody.replaceChildren(...rows);

  const cards = filtered.map((student) => createStudentCard(student, {
    onEdit: openEditModal,
    onDelete: openDeleteModal,
  }));
  elements.studentsCards.replaceChildren(...cards);
}

// Load Students from API
async function loadStudents() {
  const requestId = ++state.studentsRequest;
  elements.studentsLoading.hidden = false;
  elements.studentsError.hidden = true;
  elements.studentsEmpty.hidden = true;
  elements.studentsNoMatches.hidden = true;
  elements.studentsContent.hidden = true;

  elements.studentsStatus.classList.remove('error');
  elements.studentsStatus.textContent = 'Loading students…';
  elements.student.disabled = true;
  elements.submit.disabled = true;

  try {
    const students = (await getStudents()).map(validatedStudent);
    if (requestId !== state.studentsRequest) return;

    state.students = students;
    updatePaymentStudentOptions(students);
    updateGroupOptions(extractGroups(students));
    renderStudents();
  } catch (error) {
    if (requestId !== state.studentsRequest) return;
    state.students = [];
    updatePaymentStudentOptions([]);
    updateGroupOptions([]);
    elements.studentsLoading.hidden = true;
    elements.studentsContent.hidden = true;
    elements.studentsEmpty.hidden = true;
    elements.studentsNoMatches.hidden = true;
    elements.studentsError.hidden = false;
    elements.studentsError.textContent = `Could not load student directory. ${error.message}`;

    elements.studentsStatus.classList.add('error');
    elements.studentsStatus.textContent = `Student list unavailable. ${error.message}`;
  }
}

// Filter reset
function resetFilters() {
  state.searchQuery = '';
  state.selectedGroup = '';
  elements.studentSearch.value = '';
  elements.studentGroupFilter.value = '';
  renderStudents();
}

// Create Student Modal Handlers
function openCreateModal() {
  elements.createForm.reset();
  elements.createError.classList.add('d-none');
  elements.createError.textContent = '';
  openModal(elements.createModal);
}

async function handleCreateStudent(event) {
  event.preventDefault();
  if (state.studentCreatePending) return;

  let validated;
  try {
    validated = validateStudentInput({
      name: elements.createName.value,
      phone: elements.createPhone.value,
      groupName: elements.createGroup.value,
      monthlyFeeRaw: elements.createFee.value,
    });
  } catch (error) {
    elements.createError.textContent = error.message;
    elements.createError.classList.remove('d-none');
    return;
  }

  state.studentCreatePending = true;
  elements.submitCreate.disabled = true;
  elements.submitCreate.textContent = 'Creating student…';
  elements.createError.classList.add('d-none');

  try {
    const created = await createStudent(validated);
    closeModal(elements.createModal);
    elements.createForm.reset();
    showNotice('success', `Student "${created.name}" (ID #${created.id}) registered successfully.`);
    await loadStudents();
    await loadDebtors();
  } catch (error) {
    elements.createError.textContent = error.message;
    elements.createError.classList.remove('d-none');
  } finally {
    state.studentCreatePending = false;
    elements.submitCreate.disabled = false;
    elements.submitCreate.textContent = 'Create student';
  }
}

// Edit Student Modal Handlers
function openEditModal(student) {
  elements.editId.value = String(student.id);
  elements.editName.value = student.name;
  elements.editPhone.value = student.phone;
  elements.editGroup.value = student.groupName;
  elements.editFee.value = String(student.monthlyFee);
  elements.editError.classList.add('d-none');
  elements.editError.textContent = '';
  openModal(elements.editModal);
}

async function handleEditStudent(event) {
  event.preventDefault();
  if (state.studentEditPending) return;

  const id = Number(elements.editId.value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    elements.editError.textContent = 'Invalid student record identifier.';
    elements.editError.classList.remove('d-none');
    return;
  }

  let validated;
  try {
    validated = validateStudentInput({
      name: elements.editName.value,
      phone: elements.editPhone.value,
      groupName: elements.editGroup.value,
      monthlyFeeRaw: elements.editFee.value,
    });
  } catch (error) {
    elements.editError.textContent = error.message;
    elements.editError.classList.remove('d-none');
    return;
  }

  state.studentEditPending = true;
  elements.submitEdit.disabled = true;
  elements.submitEdit.textContent = 'Saving changes…';
  elements.editError.classList.add('d-none');

  try {
    const updated = await updateStudent(id, validated);
    closeModal(elements.editModal);
    showNotice('success', `Student "${updated.name}" (ID #${updated.id}) updated successfully.`);
    await loadStudents();
    await loadDebtors();
  } catch (error) {
    elements.editError.textContent = error.message;
    elements.editError.classList.remove('d-none');
  } finally {
    state.studentEditPending = false;
    elements.submitEdit.disabled = false;
    elements.submitEdit.textContent = 'Save changes';
  }
}

// Delete Student Modal Handlers
function openDeleteModal(student) {
  state.studentPendingDelete = student;
  elements.deleteDetails.replaceChildren(
    textElement('div', 'fw-bold', student.name),
    textElement('div', 'text-muted small', `ID #${student.id} · Group: ${student.groupName}`),
    textElement('div', 'text-muted small', `Monthly tuition: ${formatUZS(student.monthlyFee)}`),
  );
  elements.deleteError.classList.add('d-none');
  elements.deleteError.textContent = '';
  openModal(elements.deleteModal);
}

async function handleDeleteStudent() {
  if (!state.studentPendingDelete || state.studentDeletePending) return;

  const student = state.studentPendingDelete;
  state.studentDeletePending = true;
  elements.submitDelete.disabled = true;
  elements.submitDelete.textContent = 'Deleting student…';
  elements.deleteError.classList.add('d-none');

  try {
    await deleteStudent(student.id);
    closeModal(elements.deleteModal);
    state.studentPendingDelete = null;
    showNotice('success', `Student "${student.name}" (ID #${student.id}) was successfully deleted.`);

    if (elements.student.value === String(student.id)) {
      elements.student.value = '';
    }

    await loadStudents();
    await loadDebtors();
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 409) {
      elements.deleteError.replaceChildren(
        document.createTextNode(error.message + '. '),
        textElement('div', 'mt-1 small', 'Financial records prevent deletion. Students with recorded payments cannot be removed.'),
      );
      elements.deleteError.classList.remove('d-none');
    } else if (error instanceof ApiRequestError && error.status === 404) {
      closeModal(elements.deleteModal);
      state.studentPendingDelete = null;
      showNotice('warning', `Student with ID #${student.id} was not found (they may have already been removed). The student directory has been refreshed.`);
      await loadStudents();
      await loadDebtors();
    } else {
      elements.deleteError.textContent = error.message;
      elements.deleteError.classList.remove('d-none');
    }
  } finally {
    state.studentDeletePending = false;
    elements.submitDelete.disabled = false;
    elements.submitDelete.textContent = 'Delete student';
  }
}

// Quick Payment from Debtors table
function quickPaymentButton(studentId) {
  const button = textElement('button', 'btn btn-sm btn-outline-primary quick-pay', 'Record payment');
  button.type = 'button';
  button.addEventListener('click', () => {
    switchTab('payments');
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
    row.append(textElement('td', className, formatUZS(value)));
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
  amount.append(textElement('span', 'card-debt-label', 'Outstanding'), document.createTextNode(formatUZS(debtor.debt)));
  top.append(identity, amount);
  const details = document.createElement('div');
  details.className = 'card-details';
  details.append(
    detail('Group', debtor.groupName), detail('Phone', debtor.phone),
    detail('Monthly tuition', formatUZS(debtor.monthlyFee)), detail('Paid this month', formatUZS(debtor.paidAmount)),
  );
  card.append(top, details, quickPaymentButton(debtor.studentId));
  return card;
}

function renderDebtors(debtors) {
  state.debtors = debtors;
  const total = outstandingTotal(debtors);
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
  let amount;
  try {
    amount = paymentAmount(rawAmount);
  } catch (error) {
    elements.amount.focus();
    throw error;
  }
  if (!elements.date.value || !elements.date.validity.valid) {
    elements.date.focus();
    throw new Error('Select a valid payment date.');
  }
  return { studentId, amount, paymentDate: elements.date.value };
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
    showNotice('success', `Payment of ${formatUZS(payment.amount)} recorded. Refreshing the current report…`);
    const refreshed = await loadDebtors();
    if (refreshed) {
      showNotice('success', `Payment of ${formatUZS(payment.amount)} recorded successfully.`);
    } else {
      showNotice('warning', `Payment of ${formatUZS(payment.amount)} was recorded, but the report could not refresh. Use Refresh report to try again.`);
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

// Event Listeners Initialization
const today = localDateParts();
elements.month.value = today.month;
elements.date.value = today.date;

// Navigation
elements.navPayments.addEventListener('click', () => switchTab('payments'));
elements.navStudents.addEventListener('click', () => switchTab('students'));

// Payments and Debtors
elements.month.addEventListener('change', loadDebtors);
elements.refresh.addEventListener('click', loadDebtors);
elements.form.addEventListener('submit', submitPayment);

// Search & Filter
elements.studentSearch.addEventListener('input', (e) => {
  state.searchQuery = e.target.value;
  renderStudents();
});
elements.studentGroupFilter.addEventListener('change', (e) => {
  state.selectedGroup = e.target.value;
  renderStudents();
});
elements.btnResetFilters.addEventListener('click', resetFilters);
elements.btnNoMatchesReset.addEventListener('click', resetFilters);

// Modals open
elements.btnOpenCreateStudent.addEventListener('click', openCreateModal);
elements.btnEmptyAddStudent.addEventListener('click', openCreateModal);

// Modal forms submit
elements.createForm.addEventListener('submit', handleCreateStudent);
elements.editForm.addEventListener('submit', handleEditStudent);
elements.submitDelete.addEventListener('click', handleDeleteStudent);

// Modal close buttons & backdrop handling
for (const modal of [elements.createModal, elements.editModal, elements.deleteModal]) {
  for (const cancelBtn of modal.querySelectorAll('.custom-modal-cancel, .custom-modal-close')) {
    cancelBtn.addEventListener('click', () => closeModal(modal));
  }
  const backdrop = modal.querySelector('.custom-modal-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', () => closeModal(modal));
  }
}

// Escape key closes modals
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeModal(elements.createModal);
    closeModal(elements.editModal);
    closeModal(elements.deleteModal);
  }
});

// Initial load
void loadStudents();
void loadDebtors();
window.__appReady = true;
