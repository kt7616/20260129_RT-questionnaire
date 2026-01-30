/**
 * CSVパーサー
 * ダブルクォート対応のCSVパース処理
 */

/**
 * CSVテキストをパースして質問配列を返す
 * @param {string} csvText - CSVテキスト
 * @returns {Array} 質問オブジェクトの配列
 */
function parseCSV(csvText) {
    // BOM除去
    if (csvText.charCodeAt(0) === 0xFEFF) {
        csvText = csvText.substring(1);
    }

    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) {
        throw new Error('CSVファイルにデータがありません');
    }

    const headers = parseCSVLine(lines[0]);
    const questions = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // 空行スキップ

        const values = parseCSVLine(line);
        const question = {};

        headers.forEach((header, index) => {
            question[header.trim()] = values[index] ? values[index].trim() : '';
        });

        // options列のパース（値:ラベル|値:ラベル形式）
        if (question.options) {
            question.options = question.options.split('|').map(opt => {
                const colonIndex = opt.indexOf(':');
                if (colonIndex === -1) {
                    return { value: opt.trim(), label: opt.trim() };
                }
                const value = opt.substring(0, colonIndex).trim();
                const label = opt.substring(colonIndex + 1).trim();
                return { value, label };
            });
        } else {
            question.options = [];
        }

        // 型変換
        question.required = question.required === 'true';
        if (question.min_value) question.min_value = parseInt(question.min_value, 10);
        if (question.max_value) question.max_value = parseInt(question.max_value, 10);

        questions.push(question);
    }

    return questions;
}

/**
 * CSVの1行をパース（ダブルクォート対応）
 * @param {string} line - CSV行
 * @returns {Array} フィールドの配列
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (inQuotes) {
            if (char === '"') {
                if (nextChar === '"') {
                    // エスケープされた引用符
                    current += '"';
                    i++;
                } else {
                    // 引用終了
                    inQuotes = false;
                }
            } else {
                current += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
    }
    result.push(current);

    return result;
}

/**
 * デフォルトテンプレートを読み込む
 * @returns {Promise<Array>} 質問配列
 */
async function loadDefaultTemplate() {
    try {
        const response = await fetch('templates/ipss-eq5d.csv');
        if (!response.ok) {
            throw new Error('テンプレートファイルが見つかりません');
        }
        const csvText = await response.text();
        return parseCSV(csvText);
    } catch (error) {
        console.error('テンプレート読み込みエラー:', error);
        throw error;
    }
}

/**
 * ファイルからCSVを読み込む
 * @param {File} file - CSVファイル
 * @returns {Promise<Array>} 質問配列
 */
function loadCSVFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const questions = parseCSV(e.target.result);
                resolve(questions);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('ファイル読み込みエラー'));
        reader.readAsText(file, 'UTF-8');
    });
}
