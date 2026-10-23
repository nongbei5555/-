(function () {
  'use strict';

  const THAI_MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const DEFAULT_TYPES = [];

  const COLOR_PALETTE = [
    '#e2604f', '#1f8a82', '#3e4e92', '#8b72b0',
    '#d9a441', '#4f9e5f', '#c15a9b', '#4f8ec1'
  ];

  const LEAD_OPTIONS = [
    [15, '15 นาที'],
    [30, '30 นาที'],
    [60, '1 ชั่วโมง'],
    [180, '3 ชั่วโมง'],
    [1440, '1 วัน'],
    [10080, '7 วัน']
  ];

  const $ = id => document.getElementById(id);

  const board = $('board');
  const monthLabel = $('monthLabel');
  const legend = $('legend');

  const overlay = $('overlay');
  const modalDate = $('modalDate');
  const btnCancel = $('btnCancel');
  const btnDelete = $('btnDelete');
  const btnSaveShift = $('btnSaveShift');
  const shiftDetails = $('shiftDetails');
  const caseCountField = $('caseCountField');
  const shiftCaseCount = $('shiftCaseCount');
  const shiftIncomeOverride = $('shiftIncomeOverride');
  const shiftPayPreview = $('shiftPayPreview');

  const settingsOverlay = $('settingsOverlay');
  const settingsList = $('settingsList');
  const btnSettings = $('btnSettings');
  const btnCloseSettings = $('btnCloseSettings');
  const btnAddType = $('btnAddType');

  const summaryMonth = $('summaryMonth');
  const summaryHours = $('summaryHours');
  const summaryIncome = $('summaryIncome');
  const summaryBreakdown = $('summaryBreakdown');

  const summaryMonthSel = $('summaryMonthSel');
  const summaryYearSel = $('summaryYearSel');

  const shiftNotify = $('shiftNotify');
  const shiftLead = $('shiftLead');

  const eventOverlay = $('eventOverlay');
  const evHeading = $('evHeading');
  const evTitle = $('evTitle');
  const evDate = $('evDate');
  const evStart = $('evStart');
  const evEnd = $('evEnd');
  const evColor = $('evColor');
  const evNotify = $('evNotify');
  const evLead = $('evLead');
  const evError = $('evError');
  const evDelete = $('evDelete');
  const evEndDate = $('evEndDate');
  const evEndDateRow = $('evEndDateRow');
  const evDeleteAll = $('evDeleteAll');

  let viewDate = new Date();
  viewDate.setDate(1);

  const todayKey = fmtKey(new Date());

  let shifts = {};
  let idCounter = 1;

  let events = {};
  let notified = [];
  let pendingEvKey = null;
  let pendingEvId = null;

  let summaryYear = new Date().getFullYear();
  let summaryMonthIdx = new Date().getMonth();

  let types = loadTypes();
  let activeTypeId = types[0] ? types[0].id : null;

  let pendingKey = null;
  let pendingId = null;

  function fmtKey(date) {
    return (
      date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0')
    );
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function uid(prefix) {
    return (prefix || 'id') +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 6);
  }

  function normalizeType(type) {
    const t = type && typeof type === 'object' ? type : {};

    return {
      ...t,
      id: t.id != null ? String(t.id) : uid('t'),
      label: String(t.label || 'เวร'),
      color: /^#[0-9a-fA-F]{6}$/.test(t.color || '')
        ? t.color
        : COLOR_PALETTE[0],
      start: /^\d{2}:\d{2}$/.test(t.start || '') ? t.start : '09:00',
      end: /^\d{2}:\d{2}$/.test(t.end || '') ? t.end : '17:00',
      payMode: ['hourly', 'shift', 'day', 'case'].includes(t.payMode)
        ? t.payMode
        : 'hourly',
      rate: Number.isFinite(Number(t.rate)) && Number(t.rate) >= 0
        ? Number(t.rate)
        : 0
    };
  }

  function loadTypes() {
    try {
      const raw = localStorage.getItem('shift-types');
      const parsed = raw ? JSON.parse(raw) : null;

      if (Array.isArray(parsed)) {
        return parsed
          .filter(item => item && typeof item === 'object')
          .map(normalizeType);
      }

      return DEFAULT_TYPES.map(normalizeType);
    } catch (error) {
      console.error('โหลดประเภทเวรไม่สำเร็จ', error);
      return DEFAULT_TYPES.map(normalizeType);
    }
  }

  function saveTypes() {
    try {
      localStorage.setItem('shift-types', JSON.stringify(types));
    } catch (error) {
      console.error('บันทึกประเภทเวรไม่สำเร็จ', error);
    }
  }

  function loadShifts() {
    try {
      const raw = localStorage.getItem('shift-schedule-data');
      const parsed = raw ? JSON.parse(raw) : {};

      shifts = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};

      idCounter = 1;

      Object.keys(shifts).forEach(key => {
        if (!Array.isArray(shifts[key])) {
          delete shifts[key];
          return;
        }

        shifts[key] = shifts[key]
          .filter(shift => shift && typeof shift === 'object')
          .map(shift => {
            const s = { ...shift };

            if (typeof s.id === 'number' && s.id >= idCounter) {
              idCounter = s.id + 1;
            }

            /*
             * สำคัญ:
             * ต้องเก็บ kind เดิมไว้ ไม่เขียนทับทุกข้อมูลเป็น work
             * เพื่อไม่ให้ข้อมูลที่มีชนิดอื่นสูญเสียความหมาย
             */
            s.kind = s.kind || 'work';
            s.notify = s.notify === true;

            s.leadMinutes = LEAD_OPTIONS.some(
              option => option[0] === Number(s.leadMinutes)
            )
              ? Number(s.leadMinutes)
              : 30;

            s.caseCount = Math.max(1, Number(s.caseCount) || 1);

            if (s.incomeOverride === undefined) {
              s.incomeOverride = null;
            }

            return s;
          });

        if (shifts[key].length === 0) {
          delete shifts[key];
        }
      });
    } catch (error) {
      console.error('โหลดตารางเวรไม่สำเร็จ', error);
      shifts = {};
      idCounter = 1;
    }
  }

  function saveShifts() {
    try {
      localStorage.setItem('shift-schedule-data', JSON.stringify(shifts));
    } catch (error) {
      console.error('บันทึกตารางเวรไม่สำเร็จ', error);
    }
  }

  function loadEvents() {
    try {
      const raw = localStorage.getItem('shift-events');
      const parsed = raw ? JSON.parse(raw) : {};

      events = parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed)
        ? parsed
        : {};

      Object.keys(events).forEach(key => {
        if (!Array.isArray(events[key])) {
          delete events[key];
          return;
        }

        events[key] = events[key].filter(
          event => event && typeof event === 'object'
        );
      });

      notified = JSON.parse(
        localStorage.getItem('shift-notified') || '[]'
      );

      if (!Array.isArray(notified)) {
        notified = [];
      }
    } catch (error) {
      console.error('โหลดนัดหมายไม่สำเร็จ', error);
      events = {};
      notified = [];
    }
  }

  function saveEvents() {
    try {
      localStorage.setItem('shift-events', JSON.stringify(events));
    } catch (error) {
      console.error('บันทึกนัดหมายไม่สำเร็จ', error);
    }
  }

  function findType(id) {
    return types.find(type => type.id === id) || null;
  }

  function typeDisplay(id) {
    return findType(id) || {
      id,
      label: 'ไม่ระบุ',
      color: '#9aa398',
      payMode: 'hourly',
      rate: 0
    };
  }

  function timeToMinutes(value) {
    if (!value || !/^\d{2}:\d{2}$/.test(value)) {
      return 0;
    }

    const parts = value.split(':').map(Number);

    if (
      parts[0] < 0 || parts[0] > 23 ||
      parts[1] < 0 || parts[1] > 59
    ) {
      return 0;
    }

    return parts[0] * 60 + parts[1];
  }

  function getShiftHours(shift) {
    const start = timeToMinutes(shift.start);
    let end = timeToMinutes(shift.end);

    if (end <= start) {
      end += 24 * 60;
    }

    return (end - start) / 60;
  }

  function money(value) {
    return Number(value || 0).toLocaleString('th-TH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  function getPayModeText(mode) {
    if (mode === 'shift') return 'บาทต่อเวร';
    if (mode === 'day') return 'บาทต่อวัน';
    if (mode === 'case') return 'บาทต่อเคส';
    return 'บาทต่อชั่วโมง';
  }

  function getShiftPay(shift) {
    const type = findType(shift.typeId);
    const hours = getShiftHours(shift);

    if (!type) {
      return {
        hours,
        income: Math.max(0, Number(shift.incomeOverride) || 0),
        mode: 'hourly',
        rate: 0,
        cases: Math.max(1, Number(shift.caseCount) || 1),
        hasOverride: shift.incomeOverride !== null &&
          shift.incomeOverride !== undefined &&
          shift.incomeOverride !== ''
      };
    }

    const mode = type.payMode || 'hourly';
    const rate = Math.max(0, Number(type.rate) || 0);
    const cases = Math.max(1, Number(shift.caseCount) || 1);

    let calculatedIncome = 0;

    if (mode === 'shift' || mode === 'day') {
      calculatedIncome = rate;
    } else if (mode === 'case') {
      calculatedIncome = rate * cases;
    } else {
      calculatedIncome = rate * hours;
    }

    const hasOverride =
      shift.incomeOverride !== null &&
      shift.incomeOverride !== undefined &&
      shift.incomeOverride !== '' &&
      Number.isFinite(Number(shift.incomeOverride));

    return {
      hours,
      income: hasOverride
        ? Math.max(0, Number(shift.incomeOverride))
        : calculatedIncome,
      mode,
      rate,
      cases,
      hasOverride
    };
  }

  function addShift(key, typeId) {
    const type = findType(typeId);
    if (!type) return;

    if (!Array.isArray(shifts[key])) {
      shifts[key] = [];
    }

    shifts[key].push({
      id: idCounter++,
      kind: 'work',
      typeId,
      start: type.start,
      end: type.end,
      caseCount: 1,
      incomeOverride: null,
      notify: false,
      leadMinutes: 30
    });

    saveShifts();
  }

  function selectType(id) {
    activeTypeId = id;

    [...legend.children].forEach(button => {
      button.classList.toggle(
        'selected',
        button.dataset.typeId === id
      );
    });
  }

  function renderLegend() {
    legend.innerHTML = '';

    types.forEach(type => {
      const button = document.createElement('button');

      button.className = 'legend-btn' +
        (type.id === activeTypeId ? ' selected' : '');

      button.dataset.typeId = type.id;
      button.style.setProperty('--btn-color', type.color);
      button.innerHTML = '<i></i>' + escapeHtml(type.label);

      legend.appendChild(button);
    });
  }

  legend.addEventListener('click', event => {
    const button = event.target.closest('.legend-btn');

    if (button) {
      selectType(button.dataset.typeId);
    }
  });

  function renderSummary() {
    const year = summaryYear;
    const month = summaryMonthIdx;
    const monthPrefix =
      year + '-' + String(month + 1).padStart(2, '0') + '-';

    summaryMonth.textContent =
      THAI_MONTHS[month] + ' ' + (year + 543);

    let totalHours = 0;
    let totalIncome = 0;
    const breakdown = {};

    Object.entries(shifts).forEach(([key, dayShifts]) => {
      if (!key.startsWith(monthPrefix)) return;

      (dayShifts || []).forEach(shift => {
        if (shift.kind === 'event') return;

        const result = getShiftPay(shift);
        const type = typeDisplay(shift.typeId);
        const groupKey = shift.typeId || 'unknown';

        totalHours += result.hours;
        totalIncome += result.income;

        if (!breakdown[groupKey]) {
          breakdown[groupKey] = {
            label: type.label,
            color: type.color,
            hours: 0,
            income: 0
          };
        }

        breakdown[groupKey].hours += result.hours;
        breakdown[groupKey].income += result.income;
      });
    });

    summaryHours.textContent = money(totalHours) + ' ชั่วโมง';
    summaryIncome.textContent = money(totalIncome) + ' บาท';

    const rows = Object.values(breakdown);

    if (rows.length === 0) {
      summaryBreakdown.innerHTML =
        '<p class="empty-summary">ยังไม่มีข้อมูลรายได้ในเดือนนี้</p>';
      return;
    }

    summaryBreakdown.innerHTML = rows.map(item => `
      <div class="income-row">
        <div class="income-type">
          <span class="income-dot" style="background:${escapeHtml(item.color)}"></span>
          <span>${escapeHtml(item.label)}</span>
        </div>
        <div class="income-meta">
          <span>${money(item.hours)} ชั่วโมง</span>
          <strong>${money(item.income)} บาท</strong>
        </div>
      </div>
    `).join('');
  }

  function initSummaryPicker() {
    summaryMonthSel.innerHTML = THAI_MONTHS
      .map((month, index) =>
        '<option value="' + index + '">' + month + '</option>'
      ).join('');

    const currentYear = new Date().getFullYear();
    let options = '';

    for (let year = currentYear - 5; year <= currentYear + 2; year++) {
      options += '<option value="' + year + '">' +
        (year + 543) + '</option>';
    }

    summaryYearSel.innerHTML = options;
    summaryMonthSel.value = String(summaryMonthIdx);
    summaryYearSel.value = String(summaryYear);

    summaryMonthSel.addEventListener('change', () => {
      summaryMonthIdx = Number(summaryMonthSel.value);
      renderSummary();
    });

    summaryYearSel.addEventListener('change', () => {
      summaryYear = Number(summaryYearSel.value);
      renderSummary();
    });
  }

  function render() {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    monthLabel.textContent =
      THAI_MONTHS[month] + ' ' + (year + 543);

    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells = [];

    for (let i = startOffset - 1; i >= 0; i--) {
      cells.push({
        date: new Date(year, month - 1, daysInPrevMonth - i),
        other: true
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({
        date: new Date(year, month, day),
        other: false
      });
    }

    while (cells.length < 42) {
      const lastDate = cells[cells.length - 1].date;
      const nextDate = new Date(lastDate);

      nextDate.setDate(lastDate.getDate() + 1);

      cells.push({
        date: nextDate,
        other: true
      });
    }

    board.innerHTML = '';

    cells.forEach(cell => {
      const key = fmtKey(cell.date);

      const dayEl = document.createElement('div');

      dayEl.className = 'day' +
        (cell.other ? ' other-month' : '') +
        (key === todayKey ? ' today' : '');

      const number = document.createElement('div');
      number.className = 'date-num';
      number.textContent = cell.date.getDate();

      dayEl.appendChild(number);

      const list = document.createElement('div');
      list.className = 'shift-list';

      (shifts[key] || []).forEach(shift => {
        const type = typeDisplay(shift.typeId);
        const chip = document.createElement('div');

        chip.className = 'chip';
        chip.style.setProperty('--chip-color', type.color);
        chip.innerHTML =
          '<span class="n">' + escapeHtml(type.label) + '</span>';

        chip.addEventListener('click', event => {
          event.stopPropagation();
          openDeleteModal(key, shift.id);
        });

        list.appendChild(chip);
      });

      (events[key] || []).forEach(eventItem => {
        const chip = document.createElement('div');

        chip.className = 'chip event-chip';
        chip.style.setProperty('--chip-color', eventItem.color || '#6b7a8f');
        chip.innerHTML =
          '<span class="n">◆ ' +
          escapeHtml(eventItem.title) + '</span>';

        chip.addEventListener('click', event => {
          event.stopPropagation();
          openEventModal(key, eventItem.id);
        });

        list.appendChild(chip);
      });

      dayEl.appendChild(list);

      if (!cell.other) {
        dayEl.addEventListener('click', () => {
          if (!activeTypeId) return;

          addShift(key, activeTypeId);
          render();
        });
      }

      board.appendChild(dayEl);
    });

    renderSummary();
  }

  function getPendingShift() {
    if (!pendingKey || pendingId === null) return null;

    return (shifts[pendingKey] || []).find(
      shift => shift.id === pendingId
    ) || null;
  }

  function updateShiftPayPreview() {
    const shift = getPendingShift();
    if (!shift) return;

    const type = findType(shift.typeId);
    const mode = type ? type.payMode : 'hourly';

    const caseValue = Math.max(
      1,
      Number(shiftCaseCount.value) || 1
    );

    const overrideText = shiftIncomeOverride.value.trim();

    const previewShift = {
      ...shift,
      caseCount: caseValue,
      incomeOverride: overrideText === ''
        ? null
        : Number(overrideText)
    };

    const result = getShiftPay(previewShift);
    const actualText = result.hasOverride
      ? ' (ยอดที่กรอก)'
      : ' (คำนวณตามอัตรา)';

    shiftPayPreview.textContent =
      'รายได้เวรนี้: ' + money(result.income) +
      ' บาท' + actualText;

    caseCountField.style.display =
      mode === 'case' ? 'flex' : 'none';
  }

  function openDeleteModal(key, id) {
    pendingKey = key;
    pendingId = id;

    const shift = getPendingShift();
    if (!shift) return;

    const date = new Date(key + 'T00:00:00');
    const type = typeDisplay(shift.typeId);
    const result = getShiftPay(shift);

    modalDate.textContent =
      date.getDate() + ' ' +
      THAI_MONTHS[date.getMonth()] + ' ' +
      (date.getFullYear() + 543);

    shiftDetails.innerHTML = `
      <div><span>ประเภทเวร</span><strong>${escapeHtml(type.label)}</strong></div>
      <div><span>เวลา</span><strong>${escapeHtml(shift.start)} – ${escapeHtml(shift.end)}</strong></div>
      <div><span>ชั่วโมงทำงาน</span><strong>${money(result.hours)} ชั่วโมง</strong></div>
      <div><span>อัตรา</span><strong>${money(result.rate)} ${escapeHtml(getPayModeText(result.mode))}</strong></div>
    `;

    shiftCaseCount.value = Math.max(
      1,
      Number(shift.caseCount) || 1
    );

    shiftIncomeOverride.value =
      shift.incomeOverride !== null &&
      shift.incomeOverride !== undefined
        ? shift.incomeOverride
        : '';

    shiftNotify.checked = shift.notify === true;
    shiftLead.value = String(shift.leadMinutes || 30);

    updateShiftPayPreview();
    overlay.classList.add('show');
  }

  function closeModal() {
    overlay.classList.remove('show');
    pendingKey = null;
    pendingId = null;
  }

  btnCancel.addEventListener('click', closeModal);

  overlay.addEventListener('click', event => {
    if (event.target === overlay) closeModal();
  });

  shiftCaseCount.addEventListener('input', updateShiftPayPreview);
  shiftIncomeOverride.addEventListener('input', updateShiftPayPreview);

  btnSaveShift.addEventListener('click', () => {
    const shift = getPendingShift();
    if (!shift) return;

    shift.caseCount = Math.max(
      1,
      Math.floor(Number(shiftCaseCount.value) || 1)
    );

    const overrideText = shiftIncomeOverride.value.trim();

    if (overrideText === '') {
      shift.incomeOverride = null;
    } else {
      const value = Number(overrideText);

      if (!Number.isFinite(value) || value < 0) {
        alert('กรุณากรอกรายได้เป็นตัวเลขตั้งแต่ 0 บาทขึ้นไป');
        return;
      }

      shift.incomeOverride = value;
    }

    shift.notify = shiftNotify.checked;
    shift.leadMinutes = Number(shiftLead.value) || 30;

    saveShifts();
    closeModal();
    render();
  });

  btnDelete.addEventListener('click', () => {
    if (!pendingKey || pendingId === null) return;

    shifts[pendingKey] = (shifts[pendingKey] || []).filter(
      shift => shift.id !== pendingId
    );

    if (shifts[pendingKey].length === 0) {
      delete shifts[pendingKey];
    }

    saveShifts();
    closeModal();
    render();
  });

  function renderSettingsList() {
    settingsList.innerHTML = '';

    types.forEach(type => {
      const row = document.createElement('div');
      row.className = 'settings-row';

      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = type.color;

      colorInput.addEventListener('input', () => {
        type.color = colorInput.value;
        saveTypes();
        renderLegend();
        render();
      });

      const textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.value = type.label;
      textInput.placeholder = 'ข้อความปุ่ม';

      textInput.addEventListener('input', () => {
        type.label = textInput.value;
      });

      textInput.addEventListener('blur', () => {
        type.label = textInput.value.trim() || 'เวร';
        textInput.value = type.label;

        saveTypes();
        renderLegend();
        render();
      });

      const timeGroup = document.createElement('div');
      timeGroup.className = 'time-group shift-time-group';

      function makeTimePicker(value, label, property) {
        const picker = document.createElement('input');

        picker.type = 'time';
        picker.className = 'shift-time-picker';
        picker.lang = 'th-TH';
        picker.value = /^\d{2}:\d{2}$/.test(value || '')
        ? value
        : '09:00';

        picker.setAttribute('aria-label', label);
        picker.title = label;
        picker.step = '60';

        picker.addEventListener('change', () => {
        if (!picker.value) return;

        t[property] = picker.value;
        saveTypes();
        });

        return picker;
      }
      
      timeGroup.appendChild(
        makeTimePicker(type.start, 'เวลาเริ่มต้น', 'start')
      );

      const separator = document.createElement('span');
      separator.className = 'time-sep';
      separator.textContent = '–';

      timeGroup.appendChild(separator);

      timeGroup.appendChild(
        makeTimePicker(type.end, 'เวลาสิ้นสุด', 'end')
      );

      const payGroup = document.createElement('div');
      payGroup.className = 'pay-group';

      const payModeSelect = document.createElement('select');
      payModeSelect.className = 'pay-mode-select';
      payModeSelect.innerHTML = `
        <option value="hourly">บาท/ชั่วโมง</option>
        <option value="shift">บาท/เวร</option>
        <option value="day">บาท/วัน</option>
        <option value="case">บาท/เคส</option>
      `;

      payModeSelect.value = type.payMode || 'hourly';
      payModeSelect.title = 'รูปแบบค่าตอบแทน';

      payModeSelect.addEventListener('change', () => {
        type.payMode = payModeSelect.value;
        saveTypes();
        renderSummary();
      });

      const rateInput = document.createElement('input');
      rateInput.type = 'number';
      rateInput.className = 'pay-rate-input';
      rateInput.min = '0';
      rateInput.step = '1';
      rateInput.placeholder = 'อัตรา';
      rateInput.title = 'อัตราค่าตอบแทน';
      rateInput.value = Number(type.rate) || 0;

      rateInput.addEventListener('input', () => {
        const rate = Number(rateInput.value);

        if (rateInput.value.trim() === '') {
          type.rate = 0;
        } else if (Number.isFinite(rate) && rate >= 0) {
          type.rate = rate;
        }

        saveTypes();
        renderSummary();
      });

      payGroup.appendChild(payModeSelect);
      payGroup.appendChild(rateInput);

      const delBtn = document.createElement('button');
      delBtn.className = 'del-type-btn';
      delBtn.textContent = '×';
      delBtn.title = 'ลบปุ่มนี้';

      // คงพฤติกรรมเดิม: ต้องเหลือประเภทเวรอย่างน้อยหนึ่งประเภท
      delBtn.disabled = types.length <= 1;

      delBtn.addEventListener('click', () => {
        if (types.length <= 1) return;

        types = types.filter(item => item.id !== type.id);

        if (activeTypeId === type.id) {
          activeTypeId = types[0] ? types[0].id : null;
        }

        saveTypes();
        renderSettingsList();
        renderLegend();
        render();
      });

      row.appendChild(colorInput);
      row.appendChild(textInput);
      row.appendChild(timeGroup);
      row.appendChild(payGroup);
      row.appendChild(delBtn);

      settingsList.appendChild(row);
    });
  }

  btnAddType.addEventListener('click', () => {
    const color =
      COLOR_PALETTE[types.length % COLOR_PALETTE.length];

    const newType = {
      id: uid('t'),
      label: 'เวรใหม่',
      start: '09:00',
      end: '17:00',
      color,
      payMode: 'hourly',
      rate: 0
    };

    types.push(newType);

    if (!activeTypeId) {
      activeTypeId = newType.id;
    }

    saveTypes();
    renderSettingsList();
    renderLegend();
    settingsList.scrollTop = settingsList.scrollHeight;
  });

  btnSettings.addEventListener('click', () => {
    renderSettingsList();
    settingsOverlay.classList.add('show');
  });

  function finishSettings() {
    settingsOverlay.classList.remove('show');
    renderLegend();
    render();
  }

  btnCloseSettings.addEventListener('click', finishSettings);

  settingsOverlay.addEventListener('click', event => {
    if (event.target === settingsOverlay) {
      finishSettings();
    }
  });

  $('prevMonth').addEventListener('click', () => {
    viewDate.setMonth(viewDate.getMonth() - 1);
    render();
  });

  $('nextMonth').addEventListener('click', () => {
    viewDate.setMonth(viewDate.getMonth() + 1);
    render();
  });

  $('gotoToday').addEventListener('click', () => {
    viewDate = new Date();
    viewDate.setDate(1);
    render();
  });

  /* ===================== นัดหมายและการแจ้งเตือน ===================== */

  [shiftLead, evLead].forEach(select => {
    select.innerHTML = LEAD_OPTIONS
      .map(option =>
        '<option value="' + option[0] + '">' +
        option[1] + '</option>'
      ).join('');

    select.value = '30';
  });

  function countGroup(groupId) {
    let count = 0;

    Object.values(events).forEach(arr => {
      (arr || []).forEach(event => {
        if (event.groupId === groupId) count++;
      });
    });

    return count;
  }

  function removeGroup(groupId) {
    Object.keys(events).forEach(key => {
      events[key] = (events[key] || []).filter(
        event => event.groupId !== groupId
      );

      if (events[key].length === 0) {
        delete events[key];
      }
    });
  }

  function openEventModal(key, id) {
    pendingEvKey = key || null;
    pendingEvId = id != null ? id : null;

    const eventItem = id != null
      ? (events[key] || []).find(item => item.id === id)
      : null;

    evHeading.textContent =
      eventItem ? 'แก้ไขนัดหมาย' : 'เพิ่มนัดหมาย';

    evTitle.value = eventItem ? eventItem.title : '';
    evDate.value = eventItem ? key : fmtKey(new Date());
    evStart.value = eventItem ? eventItem.start : '09:00';
    evEnd.value = eventItem ? eventItem.end : '10:00';
    evColor.value = eventItem
      ? eventItem.color
      : '#6b7a8f';

    evNotify.checked = eventItem
      ? eventItem.notify === true
      : true;

    evLead.value = String(
      eventItem ? eventItem.leadMinutes || 30 : 30
    );

    evError.textContent = '';
    evDelete.style.display = eventItem ? '' : 'none';
    evEndDate.value = '';
    evEndDateRow.style.display = eventItem ? 'none' : '';

    evDeleteAll.style.display =
      eventItem &&
      eventItem.groupId &&
      countGroup(eventItem.groupId) > 1
        ? ''
        : 'none';

    eventOverlay.classList.add('show');
  }

  function closeEventModal() {
    eventOverlay.classList.remove('show');
    pendingEvKey = null;
    pendingEvId = null;
  }

  $('btnAddEvent').addEventListener('click', () => {
    openEventModal();
  });

  $('evCancel').addEventListener('click', closeEventModal);

  eventOverlay.addEventListener('click', event => {
    if (event.target === eventOverlay) {
      closeEventModal();
    }
  });

  $('evSave').addEventListener('click', () => {
    const title = evTitle.value.trim();

    if (!title) {
      evError.textContent = 'กรุณากรอกชื่อกิจกรรม';
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(evDate.value)) {
      evError.textContent = 'กรุณาเลือกวันที่';
      return;
    }

    if (!evStart.value || !evEnd.value) {
      evError.textContent =
        'กรุณากรอกเวลาเริ่มต้นและสิ้นสุด';
      return;
    }

    const data = {
      kind: 'event',
      title: title.slice(0, 60),
      start: evStart.value,
      end: evEnd.value,
      color: /^#[0-9a-fA-F]{6}$/.test(evColor.value)
        ? evColor.value
        : '#6b7a8f',
      notify: evNotify.checked,
      leadMinutes: LEAD_OPTIONS.some(
        option => option[0] === Number(evLead.value)
      )
        ? Number(evLead.value)
        : 30
    };

    const lastDay = (
      pendingEvId === null && evEndDate.value
    )
      ? evEndDate.value
      : evDate.value;

    if (lastDay < evDate.value) {
      evError.textContent =
        'วันที่สิ้นสุดต้องไม่ก่อนวันเริ่มต้น';
      return;
    }

    const dayKeys = [];
    const currentDate = new Date(evDate.value + 'T00:00:00');

    while (
      fmtKey(currentDate) <= lastDay &&
      dayKeys.length <= 31
    ) {
      dayKeys.push(fmtKey(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (dayKeys.length > 31) {
      evError.textContent = 'เลือกช่วงได้ไม่เกิน 31 วัน';
      return;
    }

    /*
     * ตอนแก้ไขนัดหมาย ให้แก้เฉพาะรายการที่เลือก
     * และไม่สร้างรายการซ้ำในวันที่เดิม
     */
    if (pendingEvId !== null) {
      const oldEvent = (events[pendingEvKey] || []).find(
        item => item.id === pendingEvId
      );

      if (!oldEvent) {
        evError.textContent =
          'ไม่พบนัดหมายเดิม กรุณาปิดแล้วลองใหม่';
        return;
      }

      const oldGroupId = oldEvent.groupId || null;

      events[pendingEvKey] = (
        events[pendingEvKey] || []
      ).filter(item => item.id !== pendingEvId);

      if (events[pendingEvKey].length === 0) {
        delete events[pendingEvKey];
      }

      const targetKey = evDate.value;

      if (!Array.isArray(events[targetKey])) {
        events[targetKey] = [];
      }

      events[targetKey].push({
        ...data,
        id: pendingEvId,
        groupId: oldGroupId
      });
    } else {
      const groupId = dayKeys.length > 1 ? uid('g') : null;

      dayKeys.forEach(key => {
        if (!Array.isArray(events[key])) {
          events[key] = [];
        }

        events[key].push({
          ...data,
          id: uid('e'),
          groupId
        });
      });
    }

    saveEvents();
    closeEventModal();
    render();
  });

  function askNotifyPermission() {
    if (
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      Notification.requestPermission().catch(error => {
        console.error('ขอสิทธิ์แจ้งเตือนไม่สำเร็จ', error);
      });
    }
  }

  evDelete.addEventListener('click', () => {
    if (pendingEvKey === null || pendingEvId === null) return;

    const list = events[pendingEvKey] || [];

    events[pendingEvKey] = list.filter(
      event => event.id !== pendingEvId
    );

    if (events[pendingEvKey].length === 0) {
      delete events[pendingEvKey];
    }

    saveEvents();
    closeEventModal();
    render();
  });

  evDeleteAll.addEventListener('click', () => {
    if (pendingEvKey === null || pendingEvId === null) return;

    const eventItem = (events[pendingEvKey] || []).find(
      item => item.id === pendingEvId
    );

    if (!eventItem) return;

    if (eventItem.groupId) {
      removeGroup(eventItem.groupId);
    } else {
      events[pendingEvKey] = (
        events[pendingEvKey] || []
      ).filter(item => item.id !== pendingEvId);

      if (events[pendingEvKey].length === 0) {
        delete events[pendingEvKey];
      }
    }

    saveEvents();
    closeEventModal();
    render();
  });

  shiftNotify.addEventListener('change', () => {
    if (shiftNotify.checked) askNotifyPermission();
  });

  evNotify.addEventListener('change', () => {
    if (evNotify.checked) askNotifyPermission();
  });

  function showToast(message) {
    const toast = document.createElement('div');

    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 8000);
  }

  function startTimestamp(dateKey, time) {
    const dateParts = dateKey.split('-').map(Number);
    const timeParts = time.split(':').map(Number);

    return new Date(
      dateParts[0],
      dateParts[1] - 1,
      dateParts[2],
      timeParts[0],
      timeParts[1]
    ).getTime();
  }

  function checkReminders() {
    const now = Date.now();
    const items = [];

    Object.entries(shifts).forEach(([key, arr]) => {
      (arr || []).forEach(shift => {
        if (shift.notify && shift.kind !== 'event') {
          items.push({
            id: 'w' + shift.id,
            title: typeDisplay(shift.typeId).label,
            date: key,
            start: shift.start,
            lead: shift.leadMinutes
          });
        }
      });
    });

    Object.entries(events).forEach(([key, arr]) => {
      (arr || []).forEach(eventItem => {
        if (eventItem.notify) {
          items.push({
            id: eventItem.id,
            title: eventItem.title,
            date: key,
            start: eventItem.start,
            lead: eventItem.leadMinutes
          });
        }
      });
    });

    items.forEach(item => {
      if (!/^\d{2}:\d{2}$/.test(item.start || '')) return;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date || '')) return;

      const start = startTimestamp(item.date, item.start);
      const lead = LEAD_OPTIONS.some(
        option => option[0] === Number(item.lead)
      )
        ? Number(item.lead)
        : 30;

      const trigger = start - lead * 60000;
      const tag = [
        item.id,
        item.date,
        item.start,
        lead
      ].join('|');

      if (
        now >= trigger &&
        now < start &&
        !notified.includes(tag)
      ) {
        notified.push(tag);
        notified = notified.slice(-300);

        try {
          localStorage.setItem(
            'shift-notified',
            JSON.stringify(notified)
          );
        } catch (error) {
          console.error('บันทึกประวัติแจ้งเตือนไม่สำเร็จ', error);
        }

        const message =
          item.title + ' เริ่มเวลา ' + item.start + ' น.';

        if (
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          new Notification('ตารางเวร', {
            body: message,
            tag
          });
        } else {
          showToast(message);
        }
      }
    });
  }

  function showView(view) {
    $('viewCalendar').hidden = view !== 'calendar';
    $('viewSummary').hidden = view !== 'summary';

    document.querySelectorAll('.tab').forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.view === view
      );
    });

    const nav = document.querySelector('.nav');

    if (nav) {
      nav.style.display = view === 'calendar' ? '' : 'none';
    }

    if (view === 'summary') {
      renderSummary();
    }
  }

  $('tabs').addEventListener('click', event => {
    const button = event.target.closest('.tab');

    if (button) {
      showView(button.dataset.view);
    }
  });

  /* ===================== ตัวเลือกวันที่ไทยและเวลา 24 ชั่วโมง ===================== */

  function initThaiEventPickers() {
    const months = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
      'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
      'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];

    const now = new Date();
    const currentBE = now.getFullYear() + 543;

    function fill(select, items) {
      select.innerHTML = '';

      items.forEach(item => {
        const option = document.createElement('option');

        option.value = item.value;
        option.textContent = item.label;

        select.appendChild(option);
      });
    }

    function makeDatePicker(prefix, optional) {
      const hidden = $(prefix);
      const day = $(prefix + 'Day');
      const month = $(prefix + 'Month');
      const year = $(prefix + 'Year');

      if (!hidden || !day || !month || !year) {
        return function () {};
      }

      const blank = {
        value: '',
        label: 'ไม่ระบุ'
      };

      fill(month, [
        ...(optional
          ? [blank]
          : [{ value: '', label: 'เดือน' }]),
        ...months.map((name, index) => ({
          value: String(index + 1),
          label: name
        }))
      ]);

      fill(year, [
        ...(optional
          ? [blank]
          : [{ value: '', label: 'ปี พ.ศ.' }]),
        ...Array.from({ length: 16 }, (_, index) => ({
          value: String(currentBE - 5 + index),
          label: String(currentBE - 5 + index)
        }))
      ]);

      function refreshDays() {
        const oldDay = day.value;
        const monthNumber = Number(month.value);
        const yearNumber = Number(year.value);

        const max = monthNumber && yearNumber
          ? new Date(yearNumber - 543, monthNumber, 0).getDate()
          : 31;

        fill(day, [
          ...(optional
            ? [blank]
            : [{ value: '', label: 'วัน' }]),
          ...Array.from({ length: max }, (_, index) => ({
            value: String(index + 1),
            label: String(index + 1)
          }))
        ]);

        if (oldDay && Number(oldDay) <= max) {
          day.value = oldDay;
        } else if (oldDay) {
          day.value = String(max);
        }
      }

      function updateHidden() {
        if (!day.value || !month.value || !year.value) {
          hidden.value = '';
          return;
        }

        const dayNumber = Number(day.value);
        const monthNumber = Number(month.value);
        const yearNumber = Number(year.value) - 543;

        const check = new Date(
          yearNumber,
          monthNumber - 1,
          dayNumber
        );

        if (
          check.getFullYear() !== yearNumber ||
          check.getMonth() !== monthNumber - 1 ||
          check.getDate() !== dayNumber
        ) {
          hidden.value = '';
          return;
        }

        hidden.value =
          String(yearNumber).padStart(4, '0') + '-' +
          String(monthNumber).padStart(2, '0') + '-' +
          String(dayNumber).padStart(2, '0');
      }

      function loadFromHidden() {
        if (!hidden.value) {
          if (optional) {
            month.value = '';
            year.value = '';
            refreshDays();
            day.value = '';
            return;
          }

          const today = new Date();

          month.value = String(today.getMonth() + 1);
          year.value = String(today.getFullYear() + 543);

          refreshDays();

          day.value = String(today.getDate());
          updateHidden();

          return;
        }

        const parts = hidden.value.split('-');

        if (parts.length !== 3) return;

        const yearNumber = Number(parts[0]);
        const monthNumber = Number(parts[1]);
        const dayNumber = Number(parts[2]);

        month.value = String(monthNumber);
        year.value = String(yearNumber + 543);

        refreshDays();

        day.value = String(dayNumber);
      }

      month.addEventListener('change', () => {
        refreshDays();
        updateHidden();
      });

      year.addEventListener('change', () => {
        refreshDays();
        updateHidden();
      });

      day.addEventListener('change', updateHidden);

      refreshDays();
      loadFromHidden();

      return loadFromHidden;
    }

    const loadStartDate = makeDatePicker('evDate', false);
    const loadEndDate = makeDatePicker('evEndDate', true);

    function makeTimePicker(prefix) {
      const hidden = $(prefix);
      const hour = $(prefix + 'Hour');
      const minute = $(prefix + 'Minute');

      if (!hidden || !hour || !minute) {
        return function () {};
      }

      fill(hour, [
        { value: '', label: 'ชม.' },
        ...Array.from({ length: 24 }, (_, index) => ({
          value: String(index).padStart(2, '0'),
          label: String(index).padStart(2, '0')
        }))
      ]);

      fill(minute, [
        { value: '', label: 'นาที' },
        ...Array.from({ length: 60 }, (_, index) => ({
          value: String(index).padStart(2, '0'),
          label: String(index).padStart(2, '0')
        }))
      ]);

      function updateHidden() {
        hidden.value = hour.value && minute.value
          ? hour.value + ':' + minute.value
          : '';
      }

      function loadFromHidden() {
        const parts = (hidden.value || '').split(':');

        hour.value = parts.length === 2 ? parts[0] : '';
        minute.value = parts.length === 2 ? parts[1] : '';
      }

      hour.addEventListener('change', updateHidden);
      minute.addEventListener('change', updateHidden);

      loadFromHidden();

      return loadFromHidden;
    }

    const loadStartTime = makeTimePicker('evStart');
    const loadEndTime = makeTimePicker('evEnd');

    const eventModal = $('eventOverlay');

    if (eventModal && 'MutationObserver' in window) {
      const observer = new MutationObserver(() => {
        if (eventModal.classList.contains('show')) {
          loadStartDate();
          loadEndDate();
          loadStartTime();
          loadEndTime();
        }
      });

      observer.observe(eventModal, {
        attributes: true,
        attributeFilter: ['class']
      });
    }
  }

  /* ===================== เริ่มต้นโปรแกรม ===================== */

  initThaiEventPickers();

  loadShifts();
  loadEvents();
  initSummaryPicker();

  renderLegend();
  render();
  checkReminders();

  setInterval(checkReminders, 30000);
})();
