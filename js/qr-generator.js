/**
 * QRコード生成モジュール
 * 回答結果をタブ区切り形式でQRコードに出力
 */

/**
 * 結果文字列を生成してQRコードを表示
 * @param {string} patientId - 診察券番号
 * @param {Object} answers - 回答オブジェクト { question_id: value }
 * @param {Array} questions - 質問配列
 * @returns {string} 生成した結果文字列
 */
function generateResultQR(patientId, answers, questions) {
    // 日付（YYYY/MM/DD形式 - Excel対応）
    const now = new Date();
    const dateStr = now.getFullYear() + '/' +
        String(now.getMonth() + 1).padStart(2, '0') + '/' +
        String(now.getDate()).padStart(2, '0');

    // 結果文字列生成：ID[TAB]日時[TAB]値1[TAB]値2[TAB]...
    const parts = [patientId, dateStr];

    questions.forEach(q => {
        const value = answers[q.question_id];
        parts.push(value !== undefined && value !== '' ? value : '');
    });

    const resultText = parts.join('\t');

    // QRコード生成
    const container = document.getElementById('qrcode-container');
    container.innerHTML = '';

    const containerWidth = Math.min(window.innerWidth - 48, 300);
    const qrSize = Math.max(200, containerWidth);

    new QRCode(container, {
        text: resultText,
        width: qrSize,
        height: qrSize,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
    });

    return resultText;
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
