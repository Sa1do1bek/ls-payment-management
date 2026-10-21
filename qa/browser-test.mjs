// Automated live browser verification script using Chrome DevTools Protocol
// Executes the complete 12-step real-browser integration test against live Spring Boot and PostgreSQL.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      }
    };
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(result.exceptionDetails)}`);
    }
    return result.result?.value;
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('--- Starting Live Browser Integration Verification ---');

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const userDataDir = 'C:\\Users\\User\\AppData\\Local\\Temp\\edge-test-cdp';

  const browserProc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://127.0.0.1:5500',
  ]);

  browserProc.on('error', (err) => console.error('Browser process error:', err));

  // Wait for remote debugging endpoint to become available
  let connected = false;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) {
        connected = true;
        break;
      }
    } catch {
      await sleep(250);
    }
  }

  if (!connected) {
    browserProc.kill();
    throw new Error('Failed to connect to browser on port 9222');
  }

  // Find page tab in Browser
  let tab = null;
  for (let i = 0; i < 20; i++) {
    const listRes = await fetch('http://127.0.0.1:9222/json/list');
    const tabs = await listRes.json();
    tab = tabs.find((t) => t.type === 'page');
    if (tab) break;
    await sleep(250);
  }
  if (!tab) throw new Error('No browser page tab found');
  console.log(`Found browser tab: ${tab.id} (${tab.url})`);

  const client = new CdpClient(tab.webSocketDebuggerUrl);
  await client.connect();
  client.ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.method === 'Runtime.exceptionThrown') {
      console.error('BROWSER RUNTIME EXCEPTION:', JSON.stringify(msg.params.exceptionDetails));
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log('CONSOLE:', msg.params.args.map(a => a.value || a.description).join(' '));
    }
  });
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Page.navigate', { url: 'http://127.0.0.1:5500' });

  let testStudent1Id = null;
  let testStudent2Id = null;

  try {
    // Wait for page and app.js initialization
    await sleep(2000);
    for (let i = 0; i < 40; i++) {
      const ready = await client.eval('window.__appReady === true');
      if (ready) break;
      await sleep(100);
    }

    const currentUrl = await client.eval('window.location.href');
    const title = await client.eval('document.title');
    const appReady = await client.eval('window.__appReady');
    console.log(`Current URL: ${currentUrl}, Page title: "${title}", appReady: ${appReady}`);

    // Switch to Students tab
    console.log('1. Switching to Students tab...');
    const clickResult = await client.eval(`
      (() => {
        const btn = document.querySelector('#nav-tab-students');
        if (!btn) return 'BUTTON NOT FOUND';
        btn.click();
        const view = document.querySelector('#view-students');
        return {
          btnExists: true,
          viewHidden: view.hidden,
          viewClasses: view.className,
        };
      })()
    `);
    console.log('Click result:', JSON.stringify(clickResult));

    const isStudentsViewVisible = await client.eval(`
      !document.querySelector('#view-students').hidden
    `);
    assert.equal(isStudentsViewVisible, true, 'Students view should be visible');

    // 1. Create a student
    console.log('2. Opening Create Student dialog and registering Student 1...');
    await client.eval(`
      document.querySelector('#btn-open-create-student').click();
      document.querySelector('#create-student-name').value = 'QA Browser Student 1';
      document.querySelector('#create-student-phone').value = '+998901112233';
      document.querySelector('#create-student-group').value = 'QA Automation';
      document.querySelector('#create-student-fee').value = '800000';
      document.querySelector('#create-student-form').dispatchEvent(new Event('submit', { cancelable: true }));
    `);
    await sleep(1500);

    // 2. Confirm student appears in list
    console.log('3. Confirming student 1 appears in the student table...');
    const student1Row = await client.eval(`
      (() => {
        const rows = Array.from(document.querySelectorAll('#students-table-body tr'));
        const row = rows.find(r => r.textContent.includes('QA Browser Student 1'));
        if (!row) return null;
        const idBadge = row.querySelector('.student-id-badge').textContent.replace('#', '');
        return { found: true, id: Number(idBadge), text: row.textContent };
      })()
    `);
    assert(student1Row && student1Row.found, 'Student 1 must appear in table');
    testStudent1Id = student1Row.id;
    console.log(`PASS: Student 1 found in table with ID #${testStudent1Id}`);

    // 3. Confirm student appears in payment form
    console.log('4. Confirming student 1 is selectable in payment form dropdown...');
    await client.eval(`document.querySelector('#nav-tab-payments').click();`);
    await sleep(500);

    const studentInPaymentDropdown = await client.eval(`
      (() => {
        const select = document.querySelector('#payment-student');
        const option = Array.from(select.options).find(o => o.value === String(${testStudent1Id}));
        return option ? { found: true, text: option.textContent } : null;
      })()
    `);
    assert(studentInPaymentDropdown && studentInPaymentDropdown.found, 'Student 1 must be in payment dropdown');
    console.log(`PASS: Student 1 in payment dropdown: "${studentInPaymentDropdown.text}"`);

    // 4. Update student's name and monthly fee
    console.log('5. Updating student 1 name and monthly fee (800,000 -> 950,000 UZS)...');
    await client.eval(`document.querySelector('#nav-tab-students').click();`);
    await sleep(500);

    await client.eval(`
      (() => {
        const rows = Array.from(document.querySelectorAll('#students-table-body tr'));
        const row = rows.find(r => r.textContent.includes('QA Browser Student 1'));
        row.querySelector('.btn-outline-primary').click(); // Edit button
      })()
    `);
    await sleep(400);

    await client.eval(`
      document.querySelector('#edit-student-name').value = 'QA Browser Student 1 Renamed';
      document.querySelector('#edit-student-fee').value = '950000';
      document.querySelector('#edit-student-form').dispatchEvent(new Event('submit', { cancelable: true }));
    `);
    await sleep(1500);

    // 5. Confirm new info persists
    console.log('6. Confirming updated info persists in table...');
    const updatedRow = await client.eval(`
      (() => {
        const rows = Array.from(document.querySelectorAll('#students-table-body tr'));
        const row = rows.find(r => r.textContent.includes('QA Browser Student 1 Renamed'));
        if (!row) return null;
        return { found: true, hasNewFee: row.textContent.includes('950,000 UZS') };
      })()
    `);
    assert(updatedRow && updatedRow.found && updatedRow.hasNewFee, 'Student 1 updated name and fee must persist');
    console.log('PASS: Updated name and 950,000 UZS confirmed in table.');

    // 6. Verify monthly debtor balance reflects updated fee
    console.log('7. Verifying monthly debtor balance reflects updated fee (950,000 UZS)...');
    await client.eval(`document.querySelector('#nav-tab-payments').click();`);
    await sleep(1000);

    const debtorRow = await client.eval(`
      (() => {
        const rows = Array.from(document.querySelectorAll('#debtors-table-body tr'));
        const row = rows.find(r => r.textContent.includes('QA Browser Student 1 Renamed'));
        if (!row) return null;
        return { found: true, text: row.textContent, owes950k: row.textContent.includes('950,000 UZS') };
      })()
    `);
    assert(debtorRow && debtorRow.found && debtorRow.owes950k, 'Debtor report must reflect updated 950,000 UZS fee');
    console.log('PASS: Monthly debtor balance reflects 950,000 UZS.');

    // 7. Record a payment
    console.log('8. Recording a payment of 200,000 UZS for Student 1...');
    await client.eval(`
      document.querySelector('#payment-student').value = String(${testStudent1Id});
      document.querySelector('#payment-amount').value = '200000';
      document.querySelector('#payment-form').dispatchEvent(new Event('submit', { cancelable: true }));
    `);
    await sleep(2000);

    const debtorAfterPay = await client.eval(`
      (() => {
        const rows = Array.from(document.querySelectorAll('#debtors-table-body tr'));
        const row = rows.find(r => r.textContent.includes('QA Browser Student 1 Renamed'));
        if (!row) return null;
        return {
          found: true,
          paid200k: row.textContent.includes('200,000 UZS'),
          remains750k: row.textContent.includes('750,000 UZS'),
        };
      })()
    `);
    assert(debtorAfterPay && debtorAfterPay.found && debtorAfterPay.paid200k && debtorAfterPay.remains750k,
      'Debtor row should show 200k paid and 750k outstanding');
    console.log('PASS: Payment recorded. Debtor shows 200,000 UZS paid, 750,000 UZS debt.');

    // 8. Attempt to delete student 1 and confirm HTTP 409 conflict
    console.log('9. Attempting deletion of Student 1 (has payment history) and expecting HTTP 409 conflict...');
    await client.eval(`document.querySelector('#nav-tab-students').click();`);
    await sleep(500);

    await client.eval(`
      (() => {
        const rows = Array.from(document.querySelectorAll('#students-table-body tr'));
        const row = rows.find(r => r.textContent.includes('QA Browser Student 1 Renamed'));
        row.querySelector('.btn-outline-danger').click(); // Delete button
      })()
    `);
    await sleep(400);

    await client.eval(`document.querySelector('#submit-delete-student').click();`);
    await sleep(1500);

    const deleteError = await client.eval(`
      (() => {
        const errorBox = document.querySelector('#delete-student-error');
        return {
          visible: !errorBox.classList.contains('d-none'),
          text: errorBox.textContent,
        };
      })()
    `);
    assert(deleteError.visible, 'Error box should be visible on 409');
    assert(deleteError.text.includes('payment history exists') || deleteError.text.includes('cannot be deleted'),
      'Error message should explain payment history prevents deletion');
    console.log(`PASS: HTTP 409 handled correctly. Message: "${deleteError.text}"`);

    // Close delete modal
    await client.eval(`document.querySelector('#delete-student-modal .custom-modal-cancel').click();`);
    await sleep(300);

    // 9. Create a second student without payments
    console.log('10. Creating second student without payments...');
    await client.eval(`
      document.querySelector('#btn-open-create-student').click();
      document.querySelector('#create-student-name').value = 'QA Browser Student 2';
      document.querySelector('#create-student-phone').value = '+998902223344';
      document.querySelector('#create-student-group').value = 'QA Temporary';
      document.querySelector('#create-student-fee').value = '500000';
      document.querySelector('#create-student-form').dispatchEvent(new Event('submit', { cancelable: true }));
    `);
    await sleep(1500);

    const student2Row = await client.eval(`
      (() => {
        const rows = Array.from(document.querySelectorAll('#students-table-body tr'));
        const row = rows.find(r => r.textContent.includes('QA Browser Student 2'));
        if (!row) return null;
        const idBadge = row.querySelector('.student-id-badge').textContent.replace('#', '');
        return { found: true, id: Number(idBadge) };
      })()
    `);
    assert(student2Row && student2Row.found, 'Student 2 should be in table');
    testStudent2Id = student2Row.id;
    console.log(`PASS: Student 2 created with ID #${testStudent2Id}.`);

    // 10. Delete the second student successfully (204)
    console.log('11. Deleting second student (no payments) and expecting success HTTP 204...');
    await client.eval(`
      (() => {
        const rows = Array.from(document.querySelectorAll('#students-table-body tr'));
        const row = rows.find(r => r.textContent.includes('QA Browser Student 2'));
        row.querySelector('.btn-outline-danger').click();
      })()
    `);
    await sleep(400);

    await client.eval(`document.querySelector('#submit-delete-student').click();`);
    await sleep(1500);

    const student2Gone = await client.eval(`
      (() => {
        const rows = Array.from(document.querySelectorAll('#students-table-body tr'));
        return !rows.some(r => r.textContent.includes('QA Browser Student 2'));
      })()
    `);
    assert(student2Gone, 'Student 2 should be removed from table after deletion');

    const noticeText = await client.eval(`document.querySelector('#notice').textContent`);
    assert(noticeText.includes('successfully deleted'), 'Success notice should appear');
    console.log(`PASS: Student 2 deleted cleanly. Notice: "${noticeText}"`);
    testStudent2Id = null; // Cleaned up!

    // 11. Verify search and group filtering
    console.log('12. Verifying search and group filtering...');
    // Search by phone
    await client.eval(`
      const search = document.querySelector('#student-search');
      search.value = '1112233';
      search.dispatchEvent(new Event('input'));
    `);
    await sleep(300);

    const searchMatchCount = await client.eval(`
      document.querySelectorAll('#students-table-body tr').length
    `);
    assert.equal(searchMatchCount, 1, 'Search for 1112233 should match Student 1');

    // Reset filters
    await client.eval(`document.querySelector('#btn-reset-filters').click();`);
    await sleep(300);

    const resetCount = await client.eval(`
      document.querySelectorAll('#students-table-body tr').length
    `);
    assert(resetCount >= 1, 'Reset filters should restore all students');

    // Group filter
    await client.eval(`
      const groupSelect = document.querySelector('#student-group-filter');
      groupSelect.value = 'QA Automation';
      groupSelect.dispatchEvent(new Event('change'));
    `);
    await sleep(300);

    const groupMatchCount = await client.eval(`
      document.querySelectorAll('#students-table-body tr').length
    `);
    assert(groupMatchCount >= 1, 'Group filter QA Automation should match Student 1');

    await client.eval(`document.querySelector('#btn-reset-filters').click();`);
    await sleep(300);
    console.log('PASS: Search, group filter, and reset filters verified.');

    // 13. Monthly Debtor CSV Export verification
    console.log('13. Verifying Monthly Debtor CSV Export...');
    // Switch to payments tab
    await client.eval(`document.querySelector('#nav-tab-payments').click();`);
    await sleep(300);

    // Track downloaded files in window
    await client.eval(`
      window.__downloadedFiles = [];
      const origCreateObjectURL = URL.createObjectURL;
      URL.createObjectURL = function(blob) {
        const reader = new FileReader();
        reader.onload = () => {
          const uint8 = new Uint8Array(reader.result);
          const hasBom = uint8[0] === 0xEF && uint8[1] === 0xBB && uint8[2] === 0xBF;
          const text = new TextDecoder('utf-8').decode(uint8);
          window.__downloadedFiles.push({
            content: text,
            hasBom: hasBom,
            firstBytes: [uint8[0], uint8[1], uint8[2]],
            type: blob.type,
            size: blob.size,
          });
        };
        reader.readAsArrayBuffer(blob);
        return origCreateObjectURL.call(URL, blob);
      };
    `);

    // Verify button is enabled for loaded month
    const debtorExportEnabled = await client.eval(`!document.querySelector('#btn-export-debtors').disabled`);
    assert(debtorExportEnabled, 'Debtor export button should be enabled when data is loaded');

    // Click Debtor export
    await client.eval(`document.querySelector('#btn-export-debtors').click();`);
    await sleep(500);

    const debtorNotice = await client.eval(`document.querySelector('#notice').textContent`);
    assert(debtorNotice.includes('Exported debtors-') && debtorNotice.includes('.csv'), `Notice should confirm debtor export: ${debtorNotice}`);

    const downloadedDebtorFile = await client.eval(`window.__downloadedFiles[window.__downloadedFiles.length - 1]`);
    assert(downloadedDebtorFile, 'Debtor export must have triggered a download');
    assert(downloadedDebtorFile.hasBom, 'Export must include UTF-8 BOM');
    assert(downloadedDebtorFile.content.includes('studentId,name,phone,groupName,monthlyFee,paidAmount,debt'), 'Debtors CSV must contain correct headers');
    console.log('PASS: Monthly Debtor CSV export generated with UTF-8 BOM and correct headers.');

    // Month change disables debtor export until reloaded
    await client.eval(`
      const monthInput = document.querySelector('#report-month');
      monthInput.value = '2025-01';
      monthInput.dispatchEvent(new Event('input'));
    `);
    const debtorExportDisabledOnStale = await client.eval(`document.querySelector('#btn-export-debtors').disabled`);
    assert(debtorExportDisabledOnStale, 'Debtor export button should be disabled when month input differs from loaded month');

    // Reload restore
    await client.eval(`document.querySelector('#refresh-debtors').click();`);
    await sleep(600);
    const debtorExportReEnabled = await client.eval(`!document.querySelector('#btn-export-debtors').disabled`);
    assert(debtorExportReEnabled, 'Debtor export button should be re-enabled after refreshing new month');
    console.log('PASS: Stale month prevention correctly disables Debtor export.');

    // 14. Student Directory CSV Export verification
    console.log('14. Verifying Student Directory CSV Export with active filters...');
    // Switch to students tab
    await client.eval(`document.querySelector('#nav-tab-students').click();`);
    await sleep(300);

    const studentExportEnabled = await client.eval(`!document.querySelector('#btn-export-students').disabled`);
    assert(studentExportEnabled, 'Student export button should be enabled');

    // Apply search filter
    await client.eval(`
      const searchInput = document.querySelector('#student-search');
      searchInput.value = 'QA Browser Student 1 Renamed';
      searchInput.dispatchEvent(new Event('input'));
    `);
    await sleep(300);

    // Export filtered students
    await client.eval(`document.querySelector('#btn-export-students').click();`);
    await sleep(500);

    const studentNotice = await client.eval(`document.querySelector('#notice').textContent`);
    assert(studentNotice.includes('Exported students.csv') && studentNotice.includes('respecting active filters'), `Notice should confirm filtered student export: ${studentNotice}`);

    const downloadedStudentFile = await client.eval(`window.__downloadedFiles[window.__downloadedFiles.length - 1]`);
    assert(downloadedStudentFile, 'Student export must have triggered a download');
    assert(downloadedStudentFile.hasBom, 'Export must include UTF-8 BOM');
    assert(downloadedStudentFile.content.includes('id,name,phone,groupName,monthlyFee'), 'Students CSV must contain correct headers');
    assert(downloadedStudentFile.content.includes('QA Browser Student 1 Renamed'), 'Exported file must contain filtered student');
    console.log('PASS: Filtered Student Directory CSV export generated with UTF-8 BOM, headers, and active filters.');

    // Reset filters
    await client.eval(`document.querySelector('#btn-reset-filters').click();`);
    await sleep(300);

    // 15. Check desktop, tablet, and mobile usability + overflow
    console.log('15. Checking responsive viewports (1440px desktop, 768px tablet, 375px mobile)...');
    for (const [w, h, name] of [[1440, 900, 'Desktop'], [768, 1024, 'Tablet'], [375, 667, 'Mobile']]) {
      await client.setViewport(w, h);
      await sleep(300);
      const overflow = await client.eval(`
        document.documentElement.scrollWidth <= window.innerWidth
      `);
      assert(overflow, `${name} (${w}px) must not have horizontal overflow`);

      if (w <= 991) {
        const mobileCardsVisible = await client.eval(`
          window.getComputedStyle(document.querySelector('#students-cards')).display !== 'none'
        `);
        assert(mobileCardsVisible, `${name} should display mobile cards`);
      } else {
        const desktopTableVisible = await client.eval(`
          window.getComputedStyle(document.querySelector('.desktop-students')).display !== 'none'
        `);
        assert(desktopTableVisible, `${name} should display desktop table`);
      }
      console.log(`PASS: ${name} (${w}px x ${h}px) layout verified without horizontal overflow.`);
    }

    console.log('--- ALL 15 LIVE BROWSER TESTS PASSED SUCCESSFULLY! ---');
  } finally {
    // Cleanup disposable test records
    console.log('--- Performing disposable data cleanup ---');
    client.close();
    try {
      await fetch(`http://127.0.0.1:9222/json/close/${tab.id}`);
    } catch {}
    browserProc.kill();
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {}

    // Clean up testStudent1 from DB if needed
    if (testStudent1Id) {
      console.log(`Cleaning up test student ${testStudent1Id} and their payments...`);
      // Delete payments for student 1 directly from postgres container
      const cleanupSql = `DELETE FROM payments WHERE student_id = ${testStudent1Id}; DELETE FROM students WHERE id = ${testStudent1Id};`;
      const p = spawn('docker', ['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'payment_user', '-d', 'payment_management', '-c', cleanupSql]);
      await new Promise((res) => p.on('close', res));
      console.log(`Disposable test records for student ${testStudent1Id} cleaned up from database.`);
    }
  }
}

run().catch((err) => {
  console.error('Browser verification failed:', err);
  process.exit(1);
});
