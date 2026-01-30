/**
 * 経過観察アンケートアプリ メインロジック
 * チャット形式UI / 高齢者向け設計
 */

// アプリケーション状態
const AppState = {
    patientId: '',
    questions: [],
    answers: {},
    currentQuestionIndex: -1,
    totalAnswered: 0,
    deletedQuestionIndex: -1
};

// DOM要素キャッシュ
let elements = {};

/**
 * 初期化
 */
document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    setupEventListeners();
    startApp();
});

/**
 * アプリ開始
 */
async function startApp() {
    try {
        AppState.questions = await loadDefaultTemplate();
        resetState();
        showScreen('chat');
        showConsentModal();
    } catch (error) {
        console.error('テンプレート読み込みエラー:', error);
        alert('アンケートの読み込みに失敗しました。ページを再読み込みしてください。');
    }
}

/**
 * 状態をリセット
 */
function resetState() {
    AppState.patientId = '';
    AppState.answers = {};
    AppState.currentQuestionIndex = -1;
    AppState.totalAnswered = 0;
    AppState.deletedQuestionIndex = -1;
    elements.chatContainer.innerHTML = '';
    elements.confirmArea.hidden = true;
    updateProgress();
}

/**
 * DOM要素をキャッシュ
 */
function cacheElements() {
    elements = {
        screenChat: document.getElementById('screen-chat'),
        screenResult: document.getElementById('screen-result'),
        chatContainer: document.getElementById('chat-container'),
        chatProgress: document.getElementById('chat-progress'),
        progressFill: document.getElementById('progress-fill'),
        confirmArea: document.getElementById('confirm-area'),
        btnConfirm: document.getElementById('btn-confirm'),
        resultText: document.getElementById('result-text'),
        btnSubmit: document.getElementById('btn-submit'),
        btnRestart: document.getElementById('btn-restart'),
        confirmModal: document.getElementById('confirm-modal'),
        modalCancel: document.getElementById('modal-cancel'),
        modalOk: document.getElementById('modal-ok'),
        consentModal: document.getElementById('consent-modal'),
        consentScrollArea: document.getElementById('consent-scroll-area'),
        consentCheckbox: document.getElementById('consent-checkbox'),
        consentConfirmBtn: document.getElementById('consent-confirm-btn'),
        submitModal: document.getElementById('submit-modal'),
        submitCancel: document.getElementById('submit-cancel'),
        submitOk: document.getElementById('submit-ok')
    };
}

/**
 * イベントリスナーを設定
 */
function setupEventListeners() {
    elements.btnConfirm.addEventListener('click', handleConfirm);
    elements.btnRestart.addEventListener('click', showRestartModal);
    elements.modalCancel.addEventListener('click', hideRestartModal);
    elements.modalOk.addEventListener('click', handleRestart);

    // 同意書モーダル
    elements.consentScrollArea.addEventListener('scroll', handleConsentScroll);
    elements.consentCheckbox.addEventListener('change', handleConsentCheckboxChange);
    elements.consentConfirmBtn.addEventListener('click', handleConsentConfirm);

    // 送信モーダル
    elements.btnSubmit.addEventListener('click', showSubmitModal);
    elements.submitCancel.addEventListener('click', hideSubmitModal);
    elements.submitOk.addEventListener('click', handleSubmit);
}

/**
 * 画面を切り替え
 */
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${screenId}`).classList.add('active');
}

/**
 * リスタート確認モーダルを表示
 */
function showRestartModal() {
    elements.confirmModal.hidden = false;
}

/**
 * リスタート確認モーダルを非表示
 */
function hideRestartModal() {
    elements.confirmModal.hidden = true;
}

/**
 * 最初に戻る（確認後）
 */
function handleRestart() {
    hideRestartModal();
    resetState();
    showScreen('chat');
    showConsentModal();
}

/**
 * 進捗を更新
 */
function updateProgress() {
    const total = AppState.questions.length + 1;
    const answered = AppState.totalAnswered + (AppState.patientId ? 1 : 0);
    elements.chatProgress.textContent = `${answered} / ${total}`;
    elements.progressFill.style.width = `${(answered / total) * 100}%`;
}

/**
 * 診察券番号入力を追加
 */
function addPatientIdQuestion() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    messageDiv.id = 'msg-patient-id';

    messageDiv.innerHTML = `
        <div class="question-bubble">診察券番号を入力してください</div>
        <div class="answer-area">
            <div class="id-input-area">
                <input type="text" class="id-input" id="patient-id-input"
                       placeholder="例: 01234567" maxlength="20"
                       pattern="[A-Za-z0-9]+" autocomplete="off" inputmode="latin">
                <div class="input-error" id="id-error" hidden></div>
                <button class="id-confirm-btn" id="btn-id-confirm" disabled>決定</button>
            </div>
        </div>
    `;

    elements.chatContainer.appendChild(messageDiv);

    const input = document.getElementById('patient-id-input');
    const btn = document.getElementById('btn-id-confirm');
    const error = document.getElementById('id-error');

    function updateButtonState() {
        btn.disabled = input.value.trim() === '';
    }

    input.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^A-Za-z0-9]/g, '');
        error.hidden = true;
        updateButtonState();
    });

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && input.value.trim()) confirmPatientId();
    });

    btn.addEventListener('click', confirmPatientId);

    setTimeout(() => {
        input.focus();
        scrollToBottom();
    }, 100);
}

/**
 * 診察券番号を確定
 */
function confirmPatientId() {
    const input = document.getElementById('patient-id-input');
    const error = document.getElementById('id-error');
    const value = input.value.trim();

    if (!value) {
        error.textContent = '診察券番号を入力してください';
        error.hidden = false;
        return;
    }

    if (!/^[A-Za-z0-9]+$/.test(value)) {
        error.textContent = '半角英数字のみ入力できます';
        error.hidden = false;
        return;
    }

    AppState.patientId = value;

    const msgDiv = document.getElementById('msg-patient-id');
    const answerArea = msgDiv.querySelector('.answer-area');
    answerArea.innerHTML = `
        <div class="answer-bubble" onclick="editPatientId()">
            ${value}
            <div class="edit-hint">タップで修正</div>
        </div>
    `;

    updateProgress();

    if (AppState.deletedQuestionIndex !== -1) {
        const deletedIndex = AppState.deletedQuestionIndex;
        AppState.deletedQuestionIndex = -1;
        setTimeout(() => addQuestion(deletedIndex), 300);
    } else {
        AppState.currentQuestionIndex = 0;
        setTimeout(() => addQuestion(0), 300);
    }
}

/**
 * 診察券番号を編集
 */
window.editPatientId = function() {
    deleteLatestUnansweredQuestion();

    const msgDiv = document.getElementById('msg-patient-id');
    const answerArea = msgDiv.querySelector('.answer-area');

    answerArea.innerHTML = `
        <div class="id-input-area">
            <input type="text" class="id-input" id="patient-id-input"
                   value="${AppState.patientId}" maxlength="20"
                   pattern="[A-Za-z0-9]+" autocomplete="off" inputmode="latin">
            <div class="input-error" id="id-error" hidden></div>
            <button class="id-confirm-btn" id="btn-id-confirm">決定</button>
        </div>
    `;

    const input = document.getElementById('patient-id-input');
    const btn = document.getElementById('btn-id-confirm');
    const error = document.getElementById('id-error');

    function updateButtonState() {
        btn.disabled = input.value.trim() === '';
    }
    updateButtonState();

    input.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^A-Za-z0-9]/g, '');
        error.hidden = true;
        updateButtonState();
    });

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && input.value.trim()) confirmPatientId();
    });

    btn.addEventListener('click', confirmPatientId);
    input.focus();
    input.select();
};

/**
 * 質問を追加
 */
function addQuestion(index) {
    const question = AppState.questions[index];
    if (!question) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    messageDiv.id = `msg-q-${index}`;
    messageDiv.dataset.questionId = question.question_id;

    const existingAnswer = AppState.answers[question.question_id];
    const answerAreaHtml = existingAnswer !== undefined
        ? createAnswerBubble(question, existingAnswer, index)
        : createInputArea(question, index);

    messageDiv.innerHTML = `
        <div class="question-bubble">${question.question_text}</div>
        <div class="answer-area" id="answer-area-${index}">
            ${answerAreaHtml}
        </div>
    `;

    elements.chatContainer.appendChild(messageDiv);

    if (existingAnswer === undefined) {
        setupInputListeners(question, index);
    }

    setTimeout(() => scrollToBottom(), 100);
}

/**
 * 入力エリアを作成
 */
function createInputArea(question, index) {
    switch (question.question_type) {
        case 'single':
            return createSingleChoiceArea(question, index);
        case 'multiple':
            return createMultipleChoiceArea(question, index);
        case 'vas':
            return createVasArea(question, index);
        case 'text':
            return createTextArea(question, index);
        default:
            return createSingleChoiceArea(question, index);
    }
}

/**
 * 単一選択エリア
 */
function createSingleChoiceArea(question, index) {
    let html = '<div class="options-list">';
    question.options.forEach(opt => {
        html += `<button class="option-btn" data-index="${index}" data-value="${opt.value}">${opt.label}</button>`;
    });
    html += '</div>';
    return html;
}

/**
 * 複数選択エリア
 */
function createMultipleChoiceArea(question, index) {
    let html = '<div class="options-list">';
    question.options.forEach(opt => {
        html += `<button class="option-btn" data-index="${index}" data-value="${opt.value}" data-multi="true">${opt.label}</button>`;
    });
    html += `<button class="vas-confirm-btn" data-index="${index}" id="multi-confirm-${index}">決定</button></div>`;
    return html;
}

/**
 * VASエリア
 */
function createVasArea(question, index) {
    const minVal = question.min_value || 0;
    const maxVal = question.max_value || 100;
    const midVal = Math.round((minVal + maxVal) / 2);

    return `
        <div class="vas-area">
            <div class="vas-value-display">
                <input type="number" class="vas-value-input" id="vas-input-${index}"
                       min="${minVal}" max="${maxVal}" placeholder="数値を入力" inputmode="numeric">
            </div>
            <input type="range" id="vas-slider-${index}" min="${minVal}" max="${maxVal}" value="${midVal}">
            <div class="vas-scale-numbers"><span>${minVal}</span><span>${maxVal}</span></div>
            <div class="vas-labels">
                ${question.min_label ? `<div>${minVal}：${question.min_label}</div>` : ''}
                ${question.max_label ? `<div>${maxVal}：${question.max_label}</div>` : ''}
            </div>
            <button class="vas-confirm-btn" data-index="${index}" id="vas-confirm-${index}" disabled>決定</button>
        </div>
    `;
}

/**
 * テキスト入力エリア
 */
function createTextArea(question, index) {
    return `
        <div class="text-input-area">
            <textarea class="text-input" id="text-input-${index}" placeholder="ここに入力してください"></textarea>
            <button class="text-confirm-btn" data-index="${index}" id="text-confirm-${index}">決定</button>
        </div>
    `;
}

/**
 * 回答バブルを作成
 */
function createAnswerBubble(question, value, index) {
    let displayValue = value;

    if (question.question_type === 'single' || question.question_type === 'multiple') {
        const values = String(value).split(',');
        const labels = values.map(v => {
            const opt = question.options.find(o => o.value === v);
            return opt ? opt.label : v;
        });
        displayValue = labels.join(', ');
    }

    return `
        <div class="answer-bubble" onclick="editAnswer(${index})">
            ${displayValue}
            <div class="edit-hint">タップで修正</div>
        </div>
    `;
}

/**
 * 入力リスナーを設定
 */
function setupInputListeners(question, index) {
    setTimeout(() => {
        switch (question.question_type) {
            case 'single':
                setupSingleChoiceListeners(index);
                break;
            case 'multiple':
                setupMultipleChoiceListeners(question, index);
                break;
            case 'vas':
                setupVasListeners(question, index);
                break;
            case 'text':
                setupTextListeners(question, index);
                break;
            default:
                setupSingleChoiceListeners(index);
        }
    }, 50);
}

/**
 * 単一選択リスナー
 * 選択→青フラッシュ→フェードアウト→回答バブル表示
 */
function setupSingleChoiceListeners(index) {
    const buttons = document.querySelectorAll(`[data-index="${index}"].option-btn:not([data-multi])`);

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const value = btn.dataset.value;
            const answerArea = document.getElementById(`answer-area-${index}`);

            // 修正モードで同じ回答を再タップ→即確定
            if (btn.classList.contains('selected-previous')) {
                btn.classList.remove('selected-previous');
                btn.classList.add('selecting');
                setTimeout(() => confirmAnswerWithAnimation(index, value), 200);
                return;
            }

            btn.classList.add('selecting');
            buttons.forEach(b => b.classList.remove('selected-previous'));

            // スクロールジャンプ防止用スペーサー
            const spacerHeight = Math.max(answerArea.offsetHeight, window.innerHeight * 0.5);
            const spacer = document.createElement('div');
            spacer.id = 'scroll-spacer';
            spacer.style.height = spacerHeight + 'px';
            spacer.style.visibility = 'hidden';
            elements.chatContainer.appendChild(spacer);

            // 200ms→フェードアウト→200ms→確定
            setTimeout(() => {
                answerArea.classList.add('fading-out');
                setTimeout(() => {
                    confirmAnswerWithAnimation(index, value);
                    setTimeout(() => {
                        const existingSpacer = document.getElementById('scroll-spacer');
                        if (existingSpacer) existingSpacer.remove();
                    }, 500);
                }, 200);
            }, 200);
        });
    });
}

/**
 * 複数選択リスナー
 */
function setupMultipleChoiceListeners(question, index) {
    const buttons = document.querySelectorAll(`[data-index="${index}"][data-multi="true"]`);
    const confirmBtn = document.getElementById(`multi-confirm-${index}`);
    let selected = [];

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const value = btn.dataset.value;
            if (btn.classList.contains('selected')) {
                btn.classList.remove('selected');
                selected = selected.filter(v => v !== value);
            } else {
                btn.classList.add('selected');
                selected.push(value);
            }
        });
    });

    confirmBtn.addEventListener('click', () => {
        if (selected.length === 0 && question.required) {
            alert('1つ以上選択してください');
            return;
        }
        confirmAnswer(index, selected.join(','));
    });
}

/**
 * VASリスナー
 */
function setupVasListeners(question, index) {
    const slider = document.getElementById(`vas-slider-${index}`);
    const input = document.getElementById(`vas-input-${index}`);
    const confirmBtn = document.getElementById(`vas-confirm-${index}`);
    const minVal = question.min_value || 0;
    const maxVal = question.max_value || 100;

    function updateConfirmButton() {
        const val = input.value.trim();
        confirmBtn.disabled = val === '' || isNaN(parseInt(val));
    }

    slider.addEventListener('input', () => {
        input.value = slider.value;
        updateConfirmButton();
    });

    input.addEventListener('input', () => {
        const val = parseInt(input.value);
        if (!isNaN(val)) {
            slider.value = Math.max(minVal, Math.min(maxVal, val));
        }
        updateConfirmButton();
    });

    input.addEventListener('blur', () => {
        if (input.value.trim() !== '') {
            let val = parseInt(input.value) || minVal;
            val = Math.max(minVal, Math.min(maxVal, val));
            input.value = val;
            slider.value = val;
        }
        updateConfirmButton();
    });

    confirmBtn.addEventListener('click', () => {
        if (input.value.trim() === '') {
            alert('数値を入力してください');
            return;
        }
        confirmAnswer(index, input.value);
    });
}

/**
 * テキスト入力リスナー
 */
function setupTextListeners(question, index) {
    const textarea = document.getElementById(`text-input-${index}`);
    const confirmBtn = document.getElementById(`text-confirm-${index}`);

    confirmBtn.addEventListener('click', () => {
        const value = textarea.value.trim();
        if (!value && question.required) {
            alert('入力してください');
            return;
        }
        confirmAnswer(index, value || '(未入力)');
    });
}

/**
 * 回答を確定
 */
function confirmAnswer(index, value) {
    const question = AppState.questions[index];
    const isNewAnswer = AppState.answers[question.question_id] === undefined;

    AppState.answers[question.question_id] = value;
    if (isNewAnswer) AppState.totalAnswered++;

    const answerArea = document.getElementById(`answer-area-${index}`);
    answerArea.innerHTML = createAnswerBubble(question, value, index);

    updateProgress();
    handlePostAnswer(index, isNewAnswer);
}

/**
 * 回答を確定（アニメーション付き）
 */
function confirmAnswerWithAnimation(index, value) {
    const question = AppState.questions[index];
    const isNewAnswer = AppState.answers[question.question_id] === undefined;

    AppState.answers[question.question_id] = value;
    if (isNewAnswer) AppState.totalAnswered++;

    const answerArea = document.getElementById(`answer-area-${index}`);
    answerArea.classList.remove('fading-out');
    answerArea.innerHTML = createAnswerBubble(question, value, index);
    answerArea.classList.add('fading-in');

    updateProgress();
    handlePostAnswer(index, isNewAnswer);
}

/**
 * 回答後の処理（次の質問表示 or スクロール）
 */
function handlePostAnswer(index, isNewAnswer) {
    if (AppState.deletedQuestionIndex !== -1) {
        const deletedIndex = AppState.deletedQuestionIndex;
        AppState.deletedQuestionIndex = -1;
        setTimeout(() => addQuestion(deletedIndex), 300);
    } else if (isNewAnswer) {
        proceedToNext(index);
    } else {
        setTimeout(() => scrollToLastQuestion(), 300);
    }
}

/**
 * 最後の質問にスクロール
 */
function scrollToLastQuestion() {
    for (let i = AppState.questions.length - 1; i >= 0; i--) {
        const msgDiv = document.getElementById(`msg-q-${i}`);
        if (msgDiv) {
            msgDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
    }
}

/**
 * 次の質問へ進む
 */
function proceedToNext(index) {
    const nextIndex = index + 1;
    if (nextIndex < AppState.questions.length) {
        if (!document.getElementById(`msg-q-${nextIndex}`)) {
            AppState.currentQuestionIndex = nextIndex;
            setTimeout(() => addQuestion(nextIndex), 300);
        } else {
            setTimeout(() => {
                document.getElementById(`msg-q-${nextIndex}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    } else {
        showConfirmButton();
    }
}

/**
 * 確定ボタンを表示
 */
function showConfirmButton() {
    if (AppState.totalAnswered === AppState.questions.length) {
        elements.confirmArea.hidden = false;
        setTimeout(() => {
            elements.confirmArea.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }
}

/**
 * 回答を編集
 */
window.editAnswer = function(index) {
    const question = AppState.questions[index];
    const answerArea = document.getElementById(`answer-area-${index}`);

    deleteLatestUnansweredQuestion();

    answerArea.innerHTML = createInputArea(question, index);
    setupInputListeners(question, index);

    // VAS: 既存値を復元し、決定ボタンを有効化
    if (question.question_type === 'vas') {
        const existingValue = AppState.answers[question.question_id];
        if (existingValue !== undefined) {
            document.getElementById(`vas-slider-${index}`).value = existingValue;
            document.getElementById(`vas-input-${index}`).value = existingValue;
            document.getElementById(`vas-confirm-${index}`).disabled = false;
        }
    }

    // 単一選択: 既存回答を薄青で表示
    if (question.question_type === 'single') {
        const existingValue = AppState.answers[question.question_id];
        if (existingValue !== undefined) {
            const btn = document.querySelector(`[data-index="${index}"][data-value="${existingValue}"]`);
            if (btn) btn.classList.add('selected-previous');
        }
    }

    setTimeout(() => {
        answerArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
};

/**
 * 最新の未回答質問を削除（修正モード用）
 */
function deleteLatestUnansweredQuestion() {
    for (let i = AppState.questions.length - 1; i >= 0; i--) {
        const msgDiv = document.getElementById(`msg-q-${i}`);
        if (msgDiv) {
            if (!msgDiv.querySelector('.answer-bubble')) {
                msgDiv.remove();
                AppState.deletedQuestionIndex = i;
                return;
            }
            return;
        }
    }
}

/**
 * 確定処理
 */
function handleConfirm() {
    for (let i = 0; i < AppState.questions.length; i++) {
        const q = AppState.questions[i];
        if (q.required && (AppState.answers[q.question_id] === undefined || AppState.answers[q.question_id] === '')) {
            alert(`質問${i + 1}は必須です`);
            document.getElementById(`msg-q-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
    }

    const resultText = generateResultText(AppState.patientId, AppState.answers, AppState.questions);
    elements.resultText.textContent = formatResultForDisplay(resultText);
    elements.btnSubmit.textContent = '結果を送信';
    elements.btnSubmit.classList.remove('submitted');
    elements.btnSubmit.disabled = false;
    showScreen('result');
}

/**
 * 最下部にスクロール（400msアニメーション）
 */
function scrollToBottom() {
    const container = elements.chatContainer;
    const targetScrollTop = container.scrollHeight - container.clientHeight;
    const startScrollTop = container.scrollTop;
    const distance = targetScrollTop - startScrollTop;

    if (distance <= 0) return;

    const duration = 400;
    const startTime = performance.now();

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    function animateScroll(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        container.scrollTop = startScrollTop + (distance * easeOutCubic(progress));
        if (progress < 1) requestAnimationFrame(animateScroll);
    }

    requestAnimationFrame(animateScroll);
}

/**
 * 同意書モーダルを表示
 */
function showConsentModal() {
    elements.consentModal.hidden = false;
    elements.consentScrollArea.scrollTop = 0;
    elements.consentCheckbox.checked = false;
    elements.consentCheckbox.disabled = true;
    elements.consentConfirmBtn.disabled = true;
}

/**
 * 同意書モーダルを非表示
 */
function hideConsentModal() {
    elements.consentModal.hidden = true;
}

/**
 * 同意書スクロール処理
 */
function handleConsentScroll() {
    const scrollArea = elements.consentScrollArea;
    const isScrolledToBottom = scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight < 10;

    if (isScrolledToBottom) {
        elements.consentCheckbox.disabled = false;
    }
}

/**
 * 同意チェックボックス変更処理
 */
function handleConsentCheckboxChange() {
    elements.consentConfirmBtn.disabled = !elements.consentCheckbox.checked;
}

/**
 * 同意確定処理
 */
function handleConsentConfirm() {
    if (elements.consentCheckbox.checked) {
        hideConsentModal();
        addPatientIdQuestion();
    }
}

/**
 * 送信確認モーダルを表示
 */
function showSubmitModal() {
    elements.submitModal.hidden = false;
}

/**
 * 送信確認モーダルを非表示
 */
function hideSubmitModal() {
    elements.submitModal.hidden = true;
}

/**
 * 送信処理
 */
function handleSubmit() {
    hideSubmitModal();
    elements.btnSubmit.textContent = '送信が完了しました';
    elements.btnSubmit.classList.add('submitted');
    elements.btnSubmit.disabled = true;
}

/**
 * 結果文字列を生成
 * @param {string} patientId - 診察券番号
 * @param {Object} answers - 回答オブジェクト { question_id: value }
 * @param {Array} questions - 質問配列
 * @returns {string} 生成した結果文字列
 */
function generateResultText(patientId, answers, questions) {
    const now = new Date();
    const dateStr = now.getFullYear() + '/' +
        String(now.getMonth() + 1).padStart(2, '0') + '/' +
        String(now.getDate()).padStart(2, '0');

    const parts = [patientId, dateStr];

    questions.forEach(q => {
        const value = answers[q.question_id];
        parts.push(value !== undefined && value !== '' ? value : '');
    });

    return parts.join('\t');
}

/**
 * 結果テキストを整形して表示
 * @param {string} resultText - タブ区切りの結果文字列
 * @returns {string} 表示用テキスト
 */
function formatResultForDisplay(resultText) {
    const parts = resultText.split('\t');
    return `ID: ${parts[0]}\n日時: ${parts[1]}\n回答数: ${parts.length - 2}`;
}
