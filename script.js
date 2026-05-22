// Элементы навигации
const views = {
    start: document.getElementById('view-start'),
    create: document.getElementById('view-create'),
    join: document.getElementById('view-join'),
    content: document.getElementById('view-content')
};

// Элементы интерфейса
const dropArea = document.getElementById('drop-area');
const dropOverlay = document.getElementById('drop-overlay');
const fileInput = document.getElementById('file-input');
const fileLabel = document.getElementById('file-label');
const textInput = document.getElementById('text-input');
const btnAddText = document.getElementById('btn-add-text');
const btnPublish = document.getElementById('btn-publish');
const spaceInfo = document.getElementById('space-info');
const spaceCodeDisplay = document.getElementById('space-code');
const statusBadge = document.getElementById('status-badge');
const qrContainer = document.getElementById('qr-container');

// Настройки
const passTypeSelect = document.getElementById('pass-type');
const customPassInput = document.getElementById('custom-pass');
const burnAfterCheck = document.getElementById('burn-after');

const creatorFilesList = document.getElementById('creator-files-list');
const creatorTextsList = document.getElementById('creator-texts-list');

const joinCodeInput = document.getElementById('join-code');
const btnConnect = document.getElementById('btn-connect');

const joinerUpload = document.getElementById('joiner-upload');
const joinerFileInput = document.getElementById('joiner-file-input');
const receiveFilesSection = document.getElementById('receive-files-section');
const receiveFilesList = document.getElementById('receive-files-list');
const receiveTextsSection = document.getElementById('receive-texts-section');
const receiveTextsList = document.getElementById('receive-texts-list');
const noContent = document.getElementById('no-content');

// Состояние
let myPeer = null;
let activeConnections = [];
let sharedFiles = []; // {file, filename, filesize, preview}
let sharedTexts = []; 
let isBurnMode = false;
let isCreator = false;

const peerConfig = {
    debug: 2,
    secure: true // Используем бесплатное публичное облако PeerJS
};

// Навигация
function showView(name) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[name].classList.remove('hidden');
}

function showCreateView() { showView('create'); }
function showJoinView() { showView('join'); }
function backToStart() { 
    if (myPeer) {
        activeConnections.forEach(conn => conn.close());
        myPeer.destroy();
    }
    window.location.reload(); 
}

// Настройки пароля
passTypeSelect.addEventListener('change', () => {
    customPassInput.classList.toggle('hidden', passTypeSelect.value !== 'custom');
});

// Full-screen Drag & Drop
window.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (views.create.classList.contains('hidden') && views.content.classList.contains('hidden')) return;
    dropOverlay.style.display = 'flex';
});

dropOverlay.addEventListener('dragleave', () => {
    dropOverlay.style.display = 'none';
});

window.addEventListener('drop', (e) => {
    e.preventDefault();
    dropOverlay.style.display = 'none';
    if (views.create.classList.contains('hidden') && views.content.classList.contains('hidden')) return;
    handleFiles(e.dataTransfer.files);
});

// Выбор файлов
dropArea.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

async function handleFiles(files) {
    for (const file of Array.from(files)) {
        let preview = null;
        if (file.type.startsWith('image/')) {
            preview = URL.createObjectURL(file);
        }
        
        sharedFiles.push({
            file: file,
            filename: file.name,
            filesize: formatBytes(file.size),
            preview: preview
        });
    }
    renderCreatorLists();
    if (myPeer && !myPeer.destroyed) broadcastUpdate();
}

// Добавление текста
btnAddText.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (text) {
        sharedTexts.push(text);
        textInput.value = '';
        renderCreatorLists();
        if (myPeer && !myPeer.destroyed) broadcastUpdate();
    }
});

textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) btnAddText.click();
});

function renderCreatorLists() {
    if (sharedFiles.length > 0) {
        creatorFilesList.classList.remove('hidden');
        creatorFilesList.innerHTML = sharedFiles.map((f, i) => `
            <div class="flex items-center justify-between bg-white/5 p-2 rounded-xl border border-white/5 group">
                <div class="flex items-center gap-3 overflow-hidden">
                    ${f.preview ? `<img src="${f.preview}" class="w-8 h-8 rounded-lg object-cover flex-shrink-0">` : `
                        <div class="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                        </div>
                    `}
                    <div class="overflow-hidden leading-tight">
                        <p class="text-[10px] truncate font-bold text-emerald-50">${f.filename}</p>
                        <p class="text-[8px] text-emerald-500/40 uppercase">${f.filesize}</p>
                    </div>
                </div>
                <button onclick="removeFile(${i})" class="text-rose-500/50 hover:text-rose-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
        `).join('');
    } else {
        creatorFilesList.classList.add('hidden');
    }

    if (sharedTexts.length > 0) {
        creatorTextsList.classList.remove('hidden');
        creatorTextsList.innerHTML = sharedTexts.map((t, i) => `
            <div class="flex items-center justify-between bg-white/5 p-2 rounded-xl border border-white/5 group">
                <span class="text-[10px] truncate pr-2 text-emerald-500/60 font-medium">${t.substring(0, 50)}${t.length > 50 ? '...' : ''}</span>
                <button onclick="removeText(${i})" class="text-rose-500/50 hover:text-rose-500 p-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
        `).join('');
    } else {
        creatorTextsList.classList.add('hidden');
    }
}

window.removeFile = (index) => {
    sharedFiles.splice(index, 1);
    renderCreatorLists();
    if (myPeer && !myPeer.destroyed) broadcastUpdate();
};

window.removeText = (index) => {
    sharedTexts.splice(index, 1);
    renderCreatorLists();
    if (myPeer && !myPeer.destroyed) broadcastUpdate();
};

function generateCode() {
    const type = passTypeSelect.value;
    if (type === 'custom') return customPassInput.value.trim().toUpperCase();
    if (type === '4num') return Math.floor(1000 + Math.random() * 9000).toString();
    if (type === '6num') return Math.floor(100000 + Math.random() * 900000).toString();
    if (type === 'alpha') {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        return Array.from({length: 4}, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    }
    return Math.floor(1000 + Math.random() * 9000).toString();
}

function broadcastUpdate() {
    const payload = {
        type: 'space-content',
        files: sharedFiles.map(f => ({ file: f.file, filename: f.filename, filesize: f.filesize, isImage: !!f.preview })),
        texts: sharedTexts
    };
    activeConnections.forEach(conn => {
        if (conn.open) conn.send(payload);
    });
}

// Работа с PeerJS
btnPublish.addEventListener('click', () => {
    if (sharedFiles.length === 0 && sharedTexts.length === 0) return showToast('Добавьте данные!');
    
    if (myPeer && !myPeer.destroyed) {
        broadcastUpdate();
        showToast('Обновлено!');
        return;
    }

    const code = generateCode();
    if (!code) return showToast('Введите пароль!');
    
    isBurnMode = burnAfterCheck.checked;
    isCreator = true;

    myPeer = new Peer(code, peerConfig);

    myPeer.on('open', (id) => {
        spaceCodeDisplay.innerText = id;
        spaceInfo.classList.remove('hidden');
        btnPublish.innerText = 'Обновить данные';
        statusBadge.innerText = 'Ожидание...';
        showToast('Пространство открыто!');
        
        // QR Code
        qrContainer.innerHTML = '';
        QRCode.toCanvas(id, { width: 90, margin: 1, color: { dark: '#065f46', light: '#ffffff' } }, (err, canvas) => {
            if (!err) qrContainer.appendChild(canvas);
        });
    });

    myPeer.on('connection', (conn) => {
        activeConnections.push(conn);
        conn.on('open', () => {
            statusBadge.innerText = 'Подключено';
            conn.send({
                type: 'space-content',
                files: sharedFiles.map(f => ({ file: f.file, filename: f.filename, filesize: f.filesize, isImage: !!f.preview })),
                texts: sharedTexts
            });
        });

        conn.on('data', (data) => {
            if (data.type === 'consumed' && isBurnMode) {
                showToast('Данные получены. Сжигание...');
                setTimeout(() => backToStart(), 2000);
            }
            if (data.type === 'space-content') {
                // Двусторонний обмен: добавляем файлы гостя к себе
                if (data.files) {
                    data.files.forEach(f => {
                        let preview = f.isImage ? URL.createObjectURL(new Blob([f.file])) : null;
                        sharedFiles.push({ file: f.file, filename: f.filename, filesize: f.filesize, preview });
                    });
                }
                if (data.texts) {
                    data.texts.forEach(t => sharedTexts.push(t));
                }
                renderCreatorLists();
                showToast('Получены данные от гостя!');
                broadcastUpdate(); // Синхронизируем всех
            }
        });

        conn.on('close', () => {
            activeConnections = activeConnections.filter(c => c !== conn);
            if (activeConnections.length === 0) statusBadge.innerText = 'Ожидание...';
        });
    });

    myPeer.on('error', (err) => {
        if (err.type === 'unavailable-id') showToast('Код занят!');
        else console.error(err);
    });
});

btnConnect.addEventListener('click', () => {
    const code = joinCodeInput.value.trim().toUpperCase();
    if (!code) return showToast('Введите код!');

    btnConnect.disabled = true;
    btnConnect.innerText = 'Вход...';

    myPeer = new Peer(peerConfig);

    myPeer.on('open', () => {
        const conn = myPeer.connect(code, { reliable: true });
        conn.on('open', () => {
            activeConnections.push(conn);
            showView('content');
            showToast('Успешный вход!');
        });
        conn.on('data', (data) => {
            if (data.type === 'space-content') renderContent(data);
        });
        conn.on('error', (err) => {
            showToast('Ошибка связи');
            btnConnect.disabled = false;
        });
    });
});

// Двусторонний обмен (Гость -> Создатель)
joinerUpload.addEventListener('click', () => joinerFileInput.click());
joinerFileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    const conn = activeConnections[0];
    if (conn && conn.open) {
        conn.send({
            type: 'space-content',
            files: files.map(f => ({ file: f, filename: f.name, filesize: formatBytes(f.size), isImage: f.type.startsWith('image/') })),
            texts: []
        });
        showToast('Отправлено создателю!');
    }
});

function renderContent(data) {
    noContent.classList.add('hidden');
    
    if (data.files && data.files.length > 0) {
        receiveFilesSection.classList.remove('hidden');
        receiveFilesList.innerHTML = data.files.map((f, i) => {
            let previewImg = '';
            if (f.isImage && f.file) {
                const url = URL.createObjectURL(new Blob([f.file]));
                previewImg = `<img src="${url}" class="w-10 h-10 rounded-lg object-cover flex-shrink-0">`;
            }
            return `
            <div class="bg-white/5 p-3 rounded-2xl border border-white/5 flex items-center justify-between group">
                <div class="flex items-center gap-3 overflow-hidden">
                    ${previewImg || `<div class="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0 text-emerald-400">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                    </div>`}
                    <div class="overflow-hidden text-left leading-tight">
                        <p class="font-bold text-[11px] text-emerald-50 truncate">${f.filename}</p>
                        <p class="text-[9px] text-emerald-500/40 uppercase font-medium">${f.filesize}</p>
                    </div>
                </div>
                <button onclick="downloadFile(${i})" class="p-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-lg shadow-emerald-500/10">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                </button>
            </div>`;
        }).join('');

        window.downloadFile = (index) => {
            const f = data.files[index];
            const blob = new Blob([f.file]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = f.filename;
            a.click();
            URL.revokeObjectURL(url);
            
            // Сообщаем создателю, что контент "потреблен"
            if (activeConnections[0]) activeConnections[0].send({ type: 'consumed' });
        };
    }

    if (data.texts && data.texts.length > 0) {
        receiveTextsSection.classList.remove('hidden');
        receiveTextsList.innerHTML = data.texts.map((t, i) => `
            <div class="relative group">
                <pre class="bg-emerald-950/20 border border-emerald-500/10 rounded-2xl p-4 text-xs text-emerald-100/70 whitespace-pre-wrap font-sans text-left">${t}</pre>
                <button onclick="copyToClipboard(this, ${i})" class="absolute top-2 right-2 p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/5 opacity-0 group-hover:opacity-100">
                    <svg class="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                </button>
            </div>
        `).join('');

        window.copyToClipboard = (btn, index) => {
            navigator.clipboard.writeText(data.texts[index]);
            showToast('Текст скопирован!');
            if (activeConnections[0]) activeConnections[0].send({ type: 'consumed' });
        };
    }
}

// Утилиты
function copySpaceCode() {
    navigator.clipboard.writeText(spaceCodeDisplay.innerText);
    showToast('Код скопирован!');
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.remove('translate-y-24', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-24', 'opacity-0');
    }, 3000);
}