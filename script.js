(function(){
  const THAI_MONTHS = [
    "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
    "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"
  ];

  const DEFAULT_TYPES = [
    {id:'t1', label:'เลิก4โมง', start:'08:00', end:'16:00', color:'#e2604f', payMode:'hourly', rate:0},
    {id:'t2', label:'เลิก2ทุ่ม', start:'12:00', end:'20:00', color:'#1f8a82', payMode:'hourly', rate:0},
    {id:'t3', label:'เลิก4ทุ่ม', start:'22:00', end:'06:00', color:'#3e4e92', payMode:'hourly', rate:0},
    {id:'t4', label:'oncall mri', start:'09:00', end:'18:00', color:'#8b72b0', payMode:'hourly', rate:0}
  ];

  const COLOR_PALETTE = [
    '#e2604f','#1f8a82','#3e4e92','#8b72b0',
    '#d9a441','#4f9e5f','#c15a9b','#4f8ec1'
  ];

  // เพิ่ม: ตัวเลือกเวลาแจ้งเตือนล่วงหน้า (นาที)
  const LEAD_OPTIONS = [[10,'10 นาที'],[30,'30 นาที'],[60,'1 ชั่วโมง'],[1440,'1 วัน']];

  const board = document.getElementById('board');
  const monthLabel = document.getElementById('monthLabel');
  const legend = document.getElementById('legend');

  const overlay = document.getElementById('overlay');
  const modalDate = document.getElementById('modalDate');
  const btnCancel = document.getElementById('btnCancel');
  const btnDelete = document.getElementById('btnDelete');
  const btnSaveShift = document.getElementById('btnSaveShift');
  const shiftDetails = document.getElementById('shiftDetails');
  const caseCountField = document.getElementById('caseCountField');
  const shiftCaseCount = document.getElementById('shiftCaseCount');
  const shiftIncomeOverride = document.getElementById('shiftIncomeOverride');
  const shiftPayPreview = document.getElementById('shiftPayPreview');

  const settingsOverlay = document.getElementById('settingsOverlay');
  const settingsList = document.getElementById('settingsList');
  const btnSettings = document.getElementById('btnSettings');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const btnAddType = document.getElementById('btnAddType');

  const summaryMonth = document.getElementById('summaryMonth');
  const summaryHours = document.getElementById('summaryHours');
  const summaryIncome = document.getElementById('summaryIncome');
  const summaryBreakdown = document.getElementById('summaryBreakdown');

  // เพิ่ม: องค์ประกอบของฟีเจอร์ใหม่
  const summaryMonthSel = document.getElementById('summaryMonthSel');
  const summaryYearSel = document.getElementById('summaryYearSel');
  const shiftNotify = document.getElementById('shiftNotify');
  const shiftLead = document.getElementById('shiftLead');
  const eventOverlay = document.getElementById('eventOverlay');
  const evHeading = document.getElementById('evHeading');
  const evTitle = document.getElementById('evTitle');
  const evDate = document.getElementById('evDate');
  const evStart = document.getElementById('evStart');
  const evEnd = document.getElementById('evEnd');
  const evColor = document.getElementById('evColor');
  const evNotify = document.getElementById('evNotify');
  const evLead = document.getElementById('evLead');
  const evError = document.getElementById('evError');
  const evDelete = document.getElementById('evDelete');
  const evEndDate = document.getElementById('evEndDate');
  const evEndDateRow = document.getElementById('evEndDateRow');
  const evDeleteAll = document.getElementById('evDeleteAll');

  let viewDate = new Date();
  viewDate.setDate(1);

  const todayKey = fmtKey(new Date());

  let shifts = {};
  let idCounter = 1;

  // เพิ่ม: นัดหมายเก็บแยกจากเวร (ชนิด 'event') เพื่อไม่ถูกนำไปคำนวณรายได้
  let events = {};
  let notified = [];
  let pendingEvKey = null;
  let pendingEvId = null;
  let summaryYear = new Date().getFullYear();
  let summaryMonthIdx = new Date().getMonth();

  let types = loadTypes();
  let activeTypeId = types[0] ? types[0].id : null;

  function fmtKey(d){
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,'0')+"-"+String(d.getDate()).padStart(2,'0');
  }

  function escapeHtml(s){
    const div = document.createElement('div');
    div.textContent = s == null ? '' : String(s);
    return div.innerHTML;
  }

  function uid(prefix){
    return (prefix || 'id') + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  }

  // รองรับปุ่มเวรเดิมที่บันทึกไว้ก่อนเพิ่มระบบรายได้
  function normalizeType(t){
    return {
      ...t,
      payMode: ['hourly','shift','day','case'].includes(t.payMode) ? t.payMode : 'hourly',
      rate: Number.isFinite(Number(t.rate)) ? Number(t.rate) : 0
    };
  }

  function loadTypes(){
    try{
      const raw = localStorage.getItem('shift-types');
      const parsed = raw ? JSON.parse(raw) : null;

      if(Array.isArray(parsed) && parsed.length > 0){
        return parsed.map(normalizeType);
      }

      return JSON.parse(JSON.stringify(DEFAULT_TYPES)).map(normalizeType);
    }catch(e){
      return JSON.parse(JSON.stringify(DEFAULT_TYPES)).map(normalizeType);
    }
  }

  function saveTypes(){
    try{
      localStorage.setItem('shift-types', JSON.stringify(types));
    }catch(e){
      console.error('บันทึกปุ่มเวรไม่สำเร็จ', e);
    }
  }

  function loadShifts(){
    try{
      const raw = localStorage.getItem('shift-schedule-data');
      shifts = raw ? JSON.parse(raw) : {};

      idCounter = 1;
      Object.values(shifts).forEach(arr => {
        arr.forEach(s => {
          if(typeof s.id === 'number' && s.id >= idCounter){
            idCounter = s.id + 1;
          }
          // เพิ่ม: ค่าเริ่มต้นสำหรับข้อมูลเก่าที่ยังไม่มีฟิลด์ใหม่
          s.kind = 'work';
          s.notify = s.notify === true;
          s.leadMinutes = LEAD_OPTIONS.some(l => l[0] === Number(s.leadMinutes)) ? Number(s.leadMinutes) : 30;
        });
      });
    }catch(e){
      shifts = {};
    }
  }

  function saveShifts(){
    try{
      localStorage.setItem('shift-schedule-data', JSON.stringify(shifts));
    }catch(e){
      console.error('บันทึกตารางไม่สำเร็จ', e);
    }
  }

  // เพิ่ม: โหลด/บันทึกนัดหมาย
  function loadEvents(){
    try{
      const raw = localStorage.getItem('shift-events');
      events = raw ? JSON.parse(raw) : {};
      if(!events || typeof events !== 'object' || Array.isArray(events)) events = {};
      notified = JSON.parse(localStorage.getItem('shift-notified') || '[]');
      if(!Array.isArray(notified)) notified = [];
    }catch(e){
      events = {};
      notified = [];
    }
  }

  function saveEvents(){
    try{
      localStorage.setItem('shift-events', JSON.stringify(events));
    }catch(e){
      console.error('บันทึกนัดหมายไม่สำเร็จ', e);
    }
  }

  function findType(id){
    return types.find(t => t.id === id) || null;
  }

  function typeDisplay(id){
    const t = findType(id);
    return t || {
      id:id,
      label:'ไม่ระบุ',
      color:'#9aa398',
      payMode:'hourly',
      rate:0
    };
  }

  // แปลงเวลาเป็นนาที
  function timeToMinutes(value){
    if(!value || !/^\d{2}:\d{2}$/.test(value)){
      return 0;
    }

    const parts = value.split(':').map(Number);
    return parts[0] * 60 + parts[1];
  }

  // คำนวณชั่วโมง รวมเวรข้ามเที่ยงคืนด้วย
  function getShiftHours(shift){
    const start = timeToMinutes(shift.start);
    let end = timeToMinutes(shift.end);

    if(end <= start){
      end += 24 * 60;
    }

    return (end - start) / 60;
  }

  function money(value){
    return Number(value || 0).toLocaleString('th-TH', {
      minimumFractionDigits:0,
      maximumFractionDigits:2
    });
  }

 function getPayModeText(mode){
  if(mode === 'shift') return 'บาทต่อเวร';
  if(mode === 'day') return 'บาทต่อวัน';
  if(mode === 'case') return 'บาทต่อเคส';
  return 'บาทต่อชั่วโมง';
  }

  // คำนวณรายได้ของเวรแต่ละรายการ
  function getShiftPay(shift){
    const type = findType(shift.typeId);
    const hours = getShiftHours(shift);

    if(!type){
      return {
        hours,
        income: Number(shift.incomeOverride) || 0,
        mode:'hourly',
        rate:0
      };
    }

    const mode = type.payMode || 'hourly';
    const rate = Math.max(0, Number(type.rate) || 0);
    const cases = Math.max(1, Number(shift.caseCount) || 1);

    let calculatedIncome = 0;

    if(mode === 'shift' || mode === 'day'){
      calculatedIncome = rate;
    }else if(mode === 'case'){
      calculatedIncome = rate * cases;
    }else{
      calculatedIncome = rate * hours;
    }

    const hasOverride =
      shift.incomeOverride !== null &&
      shift.incomeOverride !== undefined &&
      shift.incomeOverride !== '' &&
      Number.isFinite(Number(shift.incomeOverride));

    return {
      hours,
      income:hasOverride
        ? Math.max(0, Number(shift.incomeOverride))
        : calculatedIncome,
      mode,
      rate,
      cases,
      hasOverride
    };
  }

  function addShift(key, typeId){
    const t = findType(typeId);
    if(!t) return;

    if(!shifts[key]){
      shifts[key] = [];
    }

    shifts[key].push({
      id:idCounter++,
      kind:'work',
      typeId:typeId,
      start:t.start,
      end:t.end,
      caseCount:1,
      incomeOverride:null,
      notify:false,
      leadMinutes:30
    });

    saveShifts();
  }

  function selectType(id){
    activeTypeId = id;

    [...legend.children].forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.typeId === id);
    });
  }

  function renderLegend(){
    legend.innerHTML = '';

    types.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'legend-btn' + (t.id === activeTypeId ? ' selected' : '');
      btn.dataset.typeId = t.id;
      btn.style.setProperty('--btn-color', t.color);
      btn.innerHTML = '<i></i>' + escapeHtml(t.label);
      legend.appendChild(btn);
    });
  }

  legend.addEventListener('click', e => {
    const btn = e.target.closest('.legend-btn');
    if(btn) selectType(btn.dataset.typeId);
  });

  // สรุปชั่วโมงและรายได้ของเดือนที่เลือกในหน้าสรุป (นับเฉพาะ work)
  function renderSummary(){
    const year = summaryYear;
    const month = summaryMonthIdx;
    const monthPrefix = year + '-' + String(month + 1).padStart(2,'0') + '-';

    summaryMonth.textContent = THAI_MONTHS[month] + ' ' + (year + 543);

    let totalHours = 0;
    let totalIncome = 0;
    const breakdown = {};

    Object.entries(shifts).forEach(([key, dayShifts]) => {
      if(!key.startsWith(monthPrefix)) return;

      (dayShifts || []).forEach(shift => {
        if(shift.kind === 'event') return;

        const result = getShiftPay(shift);
        const type = typeDisplay(shift.typeId);
        const groupKey = shift.typeId || 'unknown';

        totalHours += result.hours;
        totalIncome += result.income;

        if(!breakdown[groupKey]){
          breakdown[groupKey] = {
            label:type.label,
            color:type.color,
            hours:0,
            income:0
          };
        }

        breakdown[groupKey].hours += result.hours;
        breakdown[groupKey].income += result.income;
      });
    });

    summaryHours.textContent = money(totalHours) + ' ชั่วโมง';
    summaryIncome.textContent = money(totalIncome) + ' บาท';

    const rows = Object.values(breakdown);

    if(rows.length === 0){
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

  // เพิ่ม: ตัวเลือกเดือน/ปีของหน้าสรุป
  function initSummaryPicker(){
    summaryMonthSel.innerHTML = THAI_MONTHS
      .map((m,i) => '<option value="'+i+'">'+m+'</option>').join('');

    const cy = new Date().getFullYear();
    let opts = '';
    for(let y = cy - 5; y <= cy + 2; y++){
      opts += '<option value="'+y+'">'+(y + 543)+'</option>';
    }
    summaryYearSel.innerHTML = opts;

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

  function render(){
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();

    monthLabel.textContent = THAI_MONTHS[m] + " " + (y + 543);

    const firstDay = new Date(y, m, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(y, m+1, 0).getDate();
    const daysInPrevMonth = new Date(y, m, 0).getDate();

    const cells = [];

    for(let i=startOffset-1; i>=0; i--){
      cells.push({
        date:new Date(y, m-1, daysInPrevMonth-i),
        other:true
      });
    }

    for(let d=1; d<=daysInMonth; d++){
      cells.push({
        date:new Date(y, m, d),
        other:false
      });
    }

    while(cells.length % 7 !== 0 || cells.length < 42){
      const last = cells[cells.length-1].date;
      const next = new Date(last);
      next.setDate(last.getDate()+1);
      cells.push({date:next, other:true});

      if(cells.length >= 42) break;
    }

    board.innerHTML = '';

    cells.forEach(cell => {
      const key = fmtKey(cell.date);

      const dayEl = document.createElement('div');
      dayEl.className =
        'day' +
        (cell.other ? ' other-month' : '') +
        (key === todayKey ? ' today' : '');

      const num = document.createElement('div');
      num.className = 'date-num';
      num.textContent = cell.date.getDate();
      dayEl.appendChild(num);

      const list = document.createElement('div');
      list.className = 'shift-list';

      (shifts[key] || []).forEach(s => {
        const t = typeDisplay(s.typeId);
        const chip = document.createElement('div');

        chip.className = 'chip';
        chip.style.setProperty('--chip-color', t.color);
        chip.innerHTML = '<span class="n">' + escapeHtml(t.label) + '</span>';

        chip.addEventListener('click', e => {
          e.stopPropagation();
          openDeleteModal(key, s.id);
        });

        list.appendChild(chip);
      });

      // เพิ่ม: แสดงนัดหมายในวันนั้น
      (events[key] || []).forEach(ev => {
        const chip = document.createElement('div');

        chip.className = 'chip event-chip';
        chip.style.setProperty('--chip-color', ev.color);
        chip.innerHTML = '<span class="n">◆ ' + escapeHtml(ev.title) + '</span>';

        chip.addEventListener('click', e => {
          e.stopPropagation();
          openEventModal(key, ev.id);
        });

        list.appendChild(chip);
      });

      dayEl.appendChild(list);

      if(!cell.other){
        dayEl.addEventListener('click', () => {
          if(!activeTypeId) return;

          addShift(key, activeTypeId);
          render();
        });
      }

      board.appendChild(dayEl);
    });

    renderSummary();
  }

  let pendingKey = null;
  let pendingId = null;

  function getPendingShift(){
    if(!pendingKey || pendingId === null) return null;

    return (shifts[pendingKey] || []).find(s => s.id === pendingId) || null;
  }

  function updateShiftPayPreview(){
    const shift = getPendingShift();
    if(!shift) return;

    const type = findType(shift.typeId);
    const mode = type ? type.payMode : 'hourly';

    const caseValue = Math.max(1, Number(shiftCaseCount.value) || 1);
    const overrideText = shiftIncomeOverride.value.trim();

    const previewShift = {
      ...shift,
      caseCount:caseValue,
      incomeOverride:overrideText === '' ? null : Number(overrideText)
    };

    const result = getShiftPay(previewShift);
    const actualText = result.hasOverride ? ' (ยอดที่กรอก)' : ' (คำนวณตามอัตรา)';

    shiftPayPreview.textContent =
      'รายได้เวรนี้: ' + money(result.income) + ' บาท' + actualText;

    caseCountField.style.display = mode === 'case' ? 'flex' : 'none';
  }

  function openDeleteModal(key, id){
    pendingKey = key;
    pendingId = id;

    const shift = getPendingShift();
    if(!shift) return;

    const d = new Date(key + 'T00:00:00');
    const type = typeDisplay(shift.typeId);
    const result = getShiftPay(shift);

    modalDate.textContent =
      d.getDate() + ' ' +
      THAI_MONTHS[d.getMonth()] + ' ' +
      (d.getFullYear()+543);

    shiftDetails.innerHTML = `
      <div><span>ประเภทเวร</span><strong>${escapeHtml(type.label)}</strong></div>
      <div><span>เวลา</span><strong>${escapeHtml(shift.start)} – ${escapeHtml(shift.end)}</strong></div>
      <div><span>ชั่วโมงทำงาน</span><strong>${money(result.hours)} ชั่วโมง</strong></div>
      <div><span>อัตรา</span><strong>${money(result.rate)} ${escapeHtml(getPayModeText(result.mode))}</strong></div>
    `;

    shiftCaseCount.value = Math.max(1, Number(shift.caseCount) || 1);
    shiftIncomeOverride.value =
      shift.incomeOverride !== null &&
      shift.incomeOverride !== undefined
        ? shift.incomeOverride
        : '';

    // เพิ่ม: โหลดค่าการแจ้งเตือนของเวร
    shiftNotify.checked = shift.notify === true;
    shiftLead.value = String(shift.leadMinutes || 30);

    updateShiftPayPreview();
    overlay.classList.add('show');
  }

  function closeModal(){
    overlay.classList.remove('show');
    pendingKey = null;
    pendingId = null;
  }

  btnCancel.addEventListener('click', closeModal);

  overlay.addEventListener('click', e => {
    if(e.target === overlay) closeModal();
  });

  shiftCaseCount.addEventListener('input', updateShiftPayPreview);
  shiftIncomeOverride.addEventListener('input', updateShiftPayPreview);

  // บันทึกจำนวนเคสหรือรายได้จริงของเวรนี้
  btnSaveShift.addEventListener('click', () => {
    const shift = getPendingShift();
    if(!shift) return;

    const type = findType(shift.typeId);

    shift.caseCount = Math.max(1, Math.floor(Number(shiftCaseCount.value) || 1));

    const overrideText = shiftIncomeOverride.value.trim();

    if(overrideText === ''){
      shift.incomeOverride = null;
    }else{
      const value = Number(overrideText);

      if(!Number.isFinite(value) || value < 0){
        alert('กรุณากรอกรายได้เป็นตัวเลขตั้งแต่ 0 บาทขึ้นไป');
        return;
      }

      shift.incomeOverride = value;
    }

    // เพิ่ม: บันทึกการแจ้งเตือนของเวร
    shift.notify = shiftNotify.checked;
    shift.leadMinutes = Number(shiftLead.value) || 30;

    saveShifts();
    closeModal();
    render();
  });

  // ลบเวรได้เหมือนเดิม
  btnDelete.addEventListener('click', () => {
    if(!pendingKey || pendingId === null) return;

    shifts[pendingKey] = (shifts[pendingKey] || [])
      .filter(s => s.id !== pendingId);

    if(shifts[pendingKey].length === 0){
      delete shifts[pendingKey];
    }

    saveShifts();
    closeModal();
    render();
  });

  function renderSettingsList(){
    settingsList.innerHTML = '';

    types.forEach(t => {
      const row = document.createElement('div');
      row.className = 'settings-row';

      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = t.color;

      colorInput.addEventListener('input', () => {
        t.color = colorInput.value;
        saveTypes();
        renderLegend();
        render();
      });

      const textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.value = t.label;
      textInput.placeholder = 'ข้อความปุ่ม';

      textInput.addEventListener('input', () => {
        t.label = textInput.value;
      });

      textInput.addEventListener('blur', () => {
        if(!textInput.value.trim()){
          textInput.value = t.label || 'เวร';
        }

        t.label = textInput.value.trim() || 'เวร';
        saveTypes();
        renderLegend();
        render();
      });

      const timeGroup = document.createElement('div');
      timeGroup.className = 'time-group';

      const startInput = document.createElement('input');
      startInput.type = 'time';
      startInput.value = t.start;

      const sep = document.createElement('span');
      sep.className = 'time-sep';
      sep.textContent = '–';

      const endInput = document.createElement('input');
      endInput.type = 'time';
      endInput.value = t.end;

      function commitTime(){
        t.start = startInput.value;
        t.end = endInput.value;
        saveTypes();
      }

      startInput.addEventListener('change', commitTime);
      endInput.addEventListener('change', commitTime);

      timeGroup.appendChild(startInput);
      timeGroup.appendChild(sep);
      timeGroup.appendChild(endInput);

      // เพิ่ม: เลือกรูปแบบอัตราค่าตอบแทน
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
      payModeSelect.value = t.payMode || 'hourly';
      payModeSelect.title = 'รูปแบบค่าตอบแทน';

      payModeSelect.addEventListener('change', () => {
        t.payMode = payModeSelect.value;
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
      rateInput.value = Number(t.rate) || 0;

      rateInput.addEventListener('input', () => {
        const rate = Number(rateInput.value);

        if(rateInput.value.trim() === ''){
          t.rate = 0;
        }else if(Number.isFinite(rate) && rate >= 0){
          t.rate = rate;
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
      delBtn.disabled = types.length <= 1;

      delBtn.addEventListener('click', () => {
        if(types.length <= 1) return;

        types = types.filter(x => x.id !== t.id);

        if(activeTypeId === t.id){
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
    const color = COLOR_PALETTE[types.length % COLOR_PALETTE.length];

    const newType = {
      id:uid('t'),
      label:'เวรใหม่',
      start:'09:00',
      end:'17:00',
      color:color,
      payMode:'hourly',
      rate:0
    };

    types.push(newType);

    if(!activeTypeId){
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

  function finishSettings(){
    settingsOverlay.classList.remove('show');
    renderLegend();
    render();
  }

  btnCloseSettings.addEventListener('click', finishSettings);

  settingsOverlay.addEventListener('click', e => {
    if(e.target === settingsOverlay){
      finishSettings();
    }
  });

  document.getElementById('prevMonth').addEventListener('click', () => {
    viewDate.setMonth(viewDate.getMonth()-1);
    render();
  });

  document.getElementById('nextMonth').addEventListener('click', () => {
    viewDate.setMonth(viewDate.getMonth()+1);
    render();
  });

  document.getElementById('gotoToday').addEventListener('click', () => {
    viewDate = new Date();
    viewDate.setDate(1);
    render();
  });

  /* ===================== ส่วนที่เพิ่มใหม่ ===================== */

  // ตัวเลือกเวลาแจ้งเตือนล่วงหน้า
  [shiftLead, evLead].forEach(sel => {
    sel.innerHTML = LEAD_OPTIONS
      .map(l => '<option value="'+l[0]+'">'+l[1]+'</option>').join('');
    sel.value = '30';
  });

  // ---- นัดหมาย ----
  function openEventModal(key, id){
    pendingEvKey = key || null;
    pendingEvId = id || null;

    const ev = id ? (events[key] || []).find(x => x.id === id) : null;

    evHeading.textContent = ev ? 'แก้ไขนัดหมาย' : 'เพิ่มนัดหมาย';
    evTitle.value = ev ? ev.title : '';
    evDate.value = ev ? key : fmtKey(new Date());
    evStart.value = ev ? ev.start : '09:00';
    evEnd.value = ev ? ev.end : '10:00';
    evColor.value = ev ? ev.color : '#6b7a8f';
    evNotify.checked = ev ? ev.notify === true : true;
    evLead.value = String(ev ? ev.leadMinutes : 30);
    evError.textContent = '';
    evDelete.style.display = ev ? '' : 'none';
    evEndDate.value = '';
    evEndDateRow.style.display = ev ? 'none' : '';
    evDeleteAll.style.display = (ev && ev.groupId && countGroup(ev.groupId) > 1) ? '' : 'none';

    eventOverlay.classList.add('show');
  }

  function countGroup(gid){
    let n = 0;
    Object.values(events).forEach(arr => (arr || []).forEach(x => { if(x.groupId === gid) n++; }));
    return n;
  }

  function removeGroup(gid){
    Object.keys(events).forEach(k => {
      events[k] = (events[k] || []).filter(x => x.groupId !== gid);
      if(events[k].length === 0) delete events[k];
    });
  }

  function closeEventModal(){
    eventOverlay.classList.remove('show');
    pendingEvKey = null;
    pendingEvId = null;
  }

  document.getElementById('btnAddEvent').addEventListener('click', () => openEventModal());
  document.getElementById('evCancel').addEventListener('click', closeEventModal);

  eventOverlay.addEventListener('click', e => {
    if(e.target === eventOverlay) closeEventModal();
  });

    document.getElementById('evSave').addEventListener('click', () => {
    const title = evTitle.value.trim();

    if(!title){ evError.textContent = 'กรุณากรอกชื่อกิจกรรม'; return; }
    if(!/^\d{4}-\d{2}-\d{2}$/.test(evDate.value)){ evError.textContent = 'กรุณาเลือกวันที่'; return; }
    if(!evStart.value || !evEnd.value){ evError.textContent = 'กรุณากรอกเวลาเริ่มต้นและสิ้นสุด'; return; }

    const data = {
      kind:'event',
      title:title.slice(0,60),
      start:evStart.value,
      end:evEnd.value,
      color:/^#[0-9a-fA-F]{6}$/.test(evColor.value) ? evColor.value : '#6b7a8f',
      notify:evNotify.checked,
      leadMinutes:Number(evLead.value) || 30
    };

    const lastDay = (!pendingEvId && evEndDate.value) ? evEndDate.value : evDate.value;

    if(lastDay < evDate.value){
      evError.textContent = 'วันที่สิ้นสุดต้องไม่ก่อนวันเริ่มต้น';
      return;
    }

    const dayKeys = [];
    const cur = new Date(evDate.value + 'T00:00:00');
    while(fmtKey(cur) <= lastDay && dayKeys.length <= 31){
      dayKeys.push(fmtKey(cur));
      cur.setDate(cur.getDate() + 1);
    }

    if(dayKeys.length > 31){
      evError.textContent = 'เลือกช่วงได้ไม่เกิน 31 วัน';
      return;
    }

    let groupId = null;
    if(pendingEvId){
      const old = (events[pendingEvKey] || []).find(x => x.id === pendingEvId);
      groupId = old && old.groupId ? old.groupId : null;
      events[pendingEvKey] = (events[pendingEvKey] || []).filter(x => x.id !== pendingEvId);
      if(events[pendingEvKey].length === 0) delete events[pendingEvKey];
    }else if(dayKeys.length > 1){
      groupId = uid('g');
    }

    dayKeys.forEach((k, i) => {
      if(!events[k]) events[k] = [];
      events[k].push({
        ...data,
        id:(pendingEvId && i === 0) ? pendingEvId : uid('e'),
        groupId:groupId
      });
    });

    saveEvents();
    closeEventModal();
    render();
  });

  // ---- การแจ้งเตือน (ทำงานเฉพาะตอนเปิดหน้าเว็บค้างไว้) ----
  // ขอสิทธิ์เมื่อผู้ใช้ติ๊กเปิดการแจ้งเตือน (เบราว์เซอร์จะเด้งถามเอง)
  function askNotifyPermission(){
    if('Notification' in window && Notification.permission === 'default'){
      Notification.requestPermission();
    }
  }

  shiftNotify.addEventListener('change', () => {
    if(shiftNotify.checked) askNotifyPermission();
  });
  evNotify.addEventListener('change', () => {
    if(evNotify.checked) askNotifyPermission();
  });

  function showToast(msg){
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 8000);
  }

  function startTimestamp(dateKey, time){
    const a = dateKey.split('-').map(Number);
    const b = time.split(':').map(Number);
    return new Date(a[0], a[1]-1, a[2], b[0], b[1]).getTime();
  }

  function checkReminders(){
    const now = Date.now();
    const items = [];

    Object.entries(shifts).forEach(([k, arr]) => (arr || []).forEach(s => {
      if(s.notify){
        items.push({id:'w'+s.id, title:typeDisplay(s.typeId).label, date:k, start:s.start, lead:s.leadMinutes});
      }
    }));

    Object.entries(events).forEach(([k, arr]) => (arr || []).forEach(ev => {
      if(ev.notify){
        items.push({id:ev.id, title:ev.title, date:k, start:ev.start, lead:ev.leadMinutes});
      }
    }));

    items.forEach(it => {
      if(!/^\d{2}:\d{2}$/.test(it.start || '')) return;

      const st = startTimestamp(it.date, it.start);
      const trigger = st - (it.lead || 30) * 60000;
      const tag = [it.id, it.date, it.start, it.lead].join('|');

      if(now >= trigger && now < st && !notified.includes(tag)){
        notified.push(tag);
        notified = notified.slice(-300);

        try{
          localStorage.setItem('shift-notified', JSON.stringify(notified));
        }catch(e){}

        const msg = it.title + ' เริ่มเวลา ' + it.start + ' น.';

        if('Notification' in window && Notification.permission === 'granted'){
          new Notification('ตารางเวร', {body:msg, tag:tag});
        }else{
          showToast(msg);
        }
      }
    });
  }

  // ---- แท็บ ปฏิทิน / สรุป ----
  function showView(view){
    document.getElementById('viewCalendar').hidden = view !== 'calendar';
    document.getElementById('viewSummary').hidden = view !== 'summary';

    document.querySelectorAll('.tab').forEach(b => {
      b.classList.toggle('active', b.dataset.view === view);
    });

    document.querySelector('.nav').style.display = view === 'calendar' ? '' : 'none';

    if(view === 'summary') renderSummary();
  }

  document.getElementById('tabs').addEventListener('click', e => {
    const b = e.target.closest('.tab');
    if(b) showView(b.dataset.view);
  });

  loadShifts();
  loadEvents();
  initSummaryPicker();
  renderLegend();
  render();
  checkReminders();
  setInterval(checkReminders, 30000);
  })();