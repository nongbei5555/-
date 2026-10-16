(function(){
  const THAI_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
    "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

  const DEFAULT_TYPES = [
    {id:'t1', label:'เลิก4โมง',   start:'08:00', end:'16:00', color:'#e2604f'},
    {id:'t2', label:'เลิก2ทุ่ม',  start:'12:00', end:'20:00', color:'#1f8a82'},
    {id:'t3', label:'เลิก4ทุ่ม',  start:'22:00', end:'06:00', color:'#3e4e92'},
    {id:'t4', label:'oncall mri', start:'09:00', end:'18:00', color:'#8b72b0'}
  ];
  const COLOR_PALETTE = ['#e2604f','#1f8a82','#3e4e92','#8b72b0','#d9a441','#4f9e5f','#c15a9b','#4f8ec1'];

  const board = document.getElementById('board');
  const monthLabel = document.getElementById('monthLabel');
  const legend = document.getElementById('legend');
  const overlay = document.getElementById('overlay');
  const modalDate = document.getElementById('modalDate');
  const btnCancel = document.getElementById('btnCancel');
  const btnDelete = document.getElementById('btnDelete');
  const settingsOverlay = document.getElementById('settingsOverlay');
  const settingsList = document.getElementById('settingsList');
  const btnSettings = document.getElementById('btnSettings');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const btnAddType = document.getElementById('btnAddType');

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
    div.textContent = s == null ? '' : s;
    return div.innerHTML;
  }
  function uid(prefix){ return (prefix||'id')+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

  function loadTypes(){
    try{
      const raw = localStorage.getItem('shift-types');
      const parsed = raw ? JSON.parse(raw) : null;
      if(Array.isArray(parsed) && parsed.length > 0) return parsed;
      return JSON.parse(JSON.stringify(DEFAULT_TYPES));
    }catch(e){
      return JSON.parse(JSON.stringify(DEFAULT_TYPES));
    }
  }
  function saveTypes(){
    try{ localStorage.setItem('shift-types', JSON.stringify(types)); }
    catch(e){ console.error('บันทึกปุ่มเวรไม่สำเร็จ', e); }
  }

  function loadShifts(){
    try{
      const raw = localStorage.getItem('shift-schedule-data');
      shifts = raw ? JSON.parse(raw) : {};
      idCounter = 1;
      Object.values(shifts).forEach(arr => arr.forEach(s => { if(s.id >= idCounter) idCounter = s.id+1; }));
    }catch(e){ shifts = {}; }
  }
  function saveShifts(){
    try{ localStorage.setItem('shift-schedule-data', JSON.stringify(shifts)); }
    catch(e){ console.error('บันทึกตารางไม่สำเร็จ', e); }
  }

  function findType(id){
    return types.find(t => t.id === id) || null;
  }
  function typeDisplay(id){
    const t = findType(id);
    return t ? t : {id:id, label:'ไม่ระบุ', color:'#9aa398'};
  }

  function addShift(key, typeId){
    const t = findType(typeId);
    if(!t) return;
    if(!shifts[key]) shifts[key] = [];
    shifts[key].push({id: idCounter++, typeId: typeId, start: t.start, end: t.end});
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

  function render(){
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();
    monthLabel.textContent = THAI_MONTHS[m] + " " + (y + 543);

    const firstDay = new Date(y, m, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(y, m+1, 0).getDate();
    const daysInPrevMonth = new Date(y, m, 0).getDate();

    const cells = [];
    for(let i=startOffset-1;i>=0;i--){
      cells.push({date:new Date(y, m-1, daysInPrevMonth-i), other:true});
    }
    for(let d=1; d<=daysInMonth; d++){
      cells.push({date:new Date(y, m, d), other:false});
    }
    while(cells.length % 7 !== 0 || cells.length < 42){
      const last = cells[cells.length-1].date;
      const next = new Date(last); next.setDate(last.getDate()+1);
      cells.push({date:next, other:true});
      if(cells.length >= 42) break;
    }

    board.innerHTML = '';
    cells.forEach(cell => {
      const key = fmtKey(cell.date);
      const dayEl = document.createElement('div');
      dayEl.className = 'day' + (cell.other ? ' other-month' : '') + (key === todayKey ? ' today' : '');

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
        chip.innerHTML = '<span class="n">'+escapeHtml(t.label)+'</span>';
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
  }

  let pendingKey = null;
  let pendingId = null;

  function openDeleteModal(key, id){
    pendingKey = key;
    pendingId = id;
    const d = new Date(key+'T00:00:00');
    modalDate.textContent = d.getDate()+' '+THAI_MONTHS[d.getMonth()]+' '+(d.getFullYear()+543);
    overlay.classList.add('show');
  }
  function closeModal(){
    overlay.classList.remove('show');
    pendingKey = null; pendingId = null;
  }
  btnCancel.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if(e.target === overlay) closeModal(); });
  btnDelete.addEventListener('click', () => {
    if(!pendingKey || !pendingId) return;
    shifts[pendingKey] = (shifts[pendingKey] || []).filter(s => s.id !== pendingId);
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
      textInput.addEventListener('input', () => { t.label = textInput.value; });
      textInput.addEventListener('blur', () => {
        if(!textInput.value.trim()){ textInput.value = t.label || 'เวร'; }
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

      const delBtn = document.createElement('button');
      delBtn.className = 'del-type-btn';
      delBtn.textContent = '×';
      delBtn.title = 'ลบปุ่มนี้';
      delBtn.disabled = types.length <= 1;
      delBtn.addEventListener('click', () => {
        if(types.length <= 1) return;
        types = types.filter(x => x.id !== t.id);
        if(activeTypeId === t.id) activeTypeId = types[0] ? types[0].id : null;
        saveTypes();
        renderSettingsList();
        renderLegend();
        render();
      });

      row.appendChild(colorInput);
      row.appendChild(textInput);
      row.appendChild(timeGroup);
      row.appendChild(delBtn);
      settingsList.appendChild(row);
    });
  }

  btnAddType.addEventListener('click', () => {
    const color = COLOR_PALETTE[types.length % COLOR_PALETTE.length];
    const newType = {id: uid('t'), label:'เวรใหม่', start:'09:00', end:'17:00', color: color};
    types.push(newType);
    if(!activeTypeId) activeTypeId = newType.id;
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
    if(e.target === settingsOverlay) finishSettings();
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
    viewDate = new Date(); viewDate.setDate(1);
    render();
  });

  loadShifts();
  renderLegend();
  render();
})();