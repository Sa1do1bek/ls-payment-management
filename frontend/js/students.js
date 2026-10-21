import { tuitionFee } from './money.js';

const moneyFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatUZS(value) {
  return `${moneyFormatter.format(value)} UZS`;
}

export function validateStudentInput({ name, phone, groupName, monthlyFeeRaw }) {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName || trimmedName.length > 150) {
    throw new Error('Name is required and must not exceed 150 characters.');
  }

  const trimmedPhone = typeof phone === 'string' ? phone.trim() : '';
  if (!trimmedPhone || trimmedPhone.length > 30) {
    throw new Error('Phone number is required and must not exceed 30 characters.');
  }

  const trimmedGroup = typeof groupName === 'string' ? groupName.trim() : '';
  if (!trimmedGroup || trimmedGroup.length > 100) {
    throw new Error('Group name is required and must not exceed 100 characters.');
  }

  const fee = tuitionFee(typeof monthlyFeeRaw === 'string' ? monthlyFeeRaw.trim() : String(monthlyFeeRaw ?? ''));

  return {
    name: trimmedName,
    phone: trimmedPhone,
    groupName: trimmedGroup,
    monthlyFee: fee,
  };
}

export function filterStudents(students, { query = '', group = '' } = {}) {
  const normalizedQuery = (query || '').trim().toLowerCase();
  const targetGroup = (group || '').trim();

  return students.filter((student) => {
    if (targetGroup && student.groupName !== targetGroup) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    const matchesName = student.name && student.name.toLowerCase().includes(normalizedQuery);
    const matchesPhone = student.phone && student.phone.toLowerCase().includes(normalizedQuery);
    const matchesId = student.id !== undefined && String(student.id).includes(normalizedQuery);
    return matchesName || matchesPhone || matchesId;
  });
}

export function extractGroups(students) {
  const groups = new Set();
  for (const student of students) {
    if (student && typeof student.groupName === 'string' && student.groupName.trim()) {
      groups.add(student.groupName.trim());
    }
  }
  return Array.from(groups).sort((a, b) => a.localeCompare(b));
}

function textNode(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

export function createStudentTableRow(student, { onEdit, onDelete }) {
  const tr = document.createElement('tr');

  const idTd = document.createElement('td');
  idTd.append(textNode('span', 'student-id-badge', `#${student.id}`));

  const nameTd = document.createElement('td');
  nameTd.append(textNode('strong', 'student-name', student.name));

  const phoneTd = document.createElement('td');
  phoneTd.append(textNode('span', 'secondary-text', student.phone));

  const groupTd = document.createElement('td');
  groupTd.append(textNode('span', 'badge-group', student.groupName));

  const feeTd = document.createElement('td');
  feeTd.className = 'money-cell text-end';
  feeTd.textContent = formatUZS(student.monthlyFee);

  const actionsTd = document.createElement('td');
  actionsTd.className = 'text-end';

  const editBtn = textNode('button', 'btn btn-sm btn-outline-primary me-2', 'Edit');
  editBtn.type = 'button';
  editBtn.setAttribute('aria-label', `Edit student ${student.name}`);
  editBtn.addEventListener('click', () => onEdit(student));

  const deleteBtn = textNode('button', 'btn btn-sm btn-outline-danger', 'Delete');
  deleteBtn.type = 'button';
  deleteBtn.setAttribute('aria-label', `Delete student ${student.name}`);
  deleteBtn.addEventListener('click', () => onDelete(student));

  actionsTd.append(editBtn, deleteBtn);
  tr.append(idTd, nameTd, phoneTd, groupTd, feeTd, actionsTd);
  return tr;
}

export function createStudentCard(student, { onEdit, onDelete }) {
  const card = document.createElement('article');
  card.className = 'student-card';

  const top = document.createElement('div');
  top.className = 'card-top';

  const identity = document.createElement('div');
  identity.append(
    textNode('strong', 'student-name', student.name),
    textNode('span', 'student-id', `ID #${student.id}`),
  );

  const feeBox = document.createElement('div');
  feeBox.className = 'card-fee';
  feeBox.append(
    textNode('span', 'card-fee-label', 'Monthly tuition'),
    document.createTextNode(formatUZS(student.monthlyFee)),
  );
  top.append(identity, feeBox);

  const details = document.createElement('div');
  details.className = 'card-details';
  const groupDetail = document.createElement('div');
  groupDetail.append(textNode('span', 'detail-label', 'Group'), textNode('span', 'detail-value', student.groupName));
  const phoneDetail = document.createElement('div');
  phoneDetail.append(textNode('span', 'detail-label', 'Phone'), textNode('span', 'detail-value', student.phone));
  details.append(groupDetail, phoneDetail);

  const actions = document.createElement('div');
  actions.className = 'student-card-actions';

  const editBtn = textNode('button', 'btn btn-sm btn-outline-primary', 'Edit');
  editBtn.type = 'button';
  editBtn.setAttribute('aria-label', `Edit student ${student.name}`);
  editBtn.addEventListener('click', () => onEdit(student));

  const deleteBtn = textNode('button', 'btn btn-sm btn-outline-danger', 'Delete');
  deleteBtn.type = 'button';
  deleteBtn.setAttribute('aria-label', `Delete student ${student.name}`);
  deleteBtn.addEventListener('click', () => onDelete(student));

  actions.append(editBtn, deleteBtn);
  card.append(top, details, actions);
  return card;
}
