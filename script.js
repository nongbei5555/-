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
  const summaryShifts = document.getElementById('summaryShifts');
  const summaryIncome = document.getElementById('summaryIncome');
  const summaryBreakdown = document.getElementById('summaryBreakdown');

  let viewDate = new Date();
  viewDate.setDate(1);

  const todayKey = fmtKey(new Date());

  let shifts = {};
  let idCounter = 1;

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
      payMode: ['hourly','shift','case'].includes(t.payMode) ? t.payMode : 'hourly',
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

    if(mode === 'shift'){
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
      typeId:typeId,
      start:t.start,
      end:t.end,
      caseCount:1,
      incomeOverride:null
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

  // สรุปชั่วโมงและรายได้เฉพาะเดือนที่กำลังเปิดดู
  function renderSummary(){
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const monthPrefix = year + '-' + String(month + 1).padStart(2,'0') + '-';

    summaryMonth.textContent = THAI_MONTHS[month] + ' ' + (year + 543);

    let totalHours = 0;
    let totalIncome = 0;
    let totalShiftCount = 0;
    const breakdown = {};

    Object.entries(shifts).forEach(([key, dayShifts]) => {
      if(!key.startsWith(monthPrefix)) return;

      (dayShifts || []).forEach(shift => {
        const result = getShiftPay(shift);
        const type = typeDisplay(shift.typeId);
        const groupKey = shift.typeId || 'unknown';

        totalHours += result.hours;
        totalIncome += result.income;
        totalShiftCount++;

        if(!breakdown[groupKey]){
          breakdown[groupKey] = {
            label:type.label,
            color:type.color,
            count:0,
            hours:0,
            income:0
          };
        }

        breakdown[groupKey].count++;
        breakdown[groupKey].hours += result.hours;
        breakdown[groupKey].income += result.income;
      });
    });

    summaryHours.textContent = money(totalHours) + ' ชั่วโมง';
    summaryShifts.textContent = totalShiftCount + ' เวร';
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
          <span>${money(item.count)} เวร</span>
          <span>${money(item.hours)} ชม.</span>
          <strong>${money(item.income)} บาท</strong>
        </div>
      </div>
    `).join('');
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

  loadShifts();
  renderLegend();
  render();
})();
