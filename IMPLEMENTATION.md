# 経過観察アンケートアプリ 実装仕様書

## 概要

医療機関向けの経過観察アンケートWebアプリ。チャット形式のUIで高齢者にも使いやすい設計。IPSS-QoL + EQ-5D-5Lの14問構成。回答結果はQRコードで出力し、電子カルテ等への取り込みを想定。

## ファイル構成

```
/
├── index.html          # メインHTML（2画面構成）
├── css/
│   └── style.css       # スタイルシート
├── js/
│   ├── app.js          # メインアプリロジック
│   ├── csv-parser.js   # CSVパース処理
│   ├── qr-generator.js # QRコード生成
│   └── lib/
│       └── qrcode.min.js  # QRCode.jsライブラリ
└── templates/
    └── ipss-eq5d.csv   # 質問テンプレート（14問）
```

## 画面構成

1. **チャット画面** (`screen-chat`)
   - 診察券番号入力 → 質問回答 → 確定

2. **結果画面** (`screen-result`)
   - QRコード表示 + 回答サマリー

## UI/UX設計

### 高齢者向け設計
- フォントサイズ: 本文20px、ボタン19px、VAS数値44px
- ボタン最小高さ: 54px（タップしやすい）
- 配色: 落ち着いた青系（#3B7CB8）
- コントラスト: 白背景に濃い文字

### チャット形式UI
- 質問は左側の白バブル
- 回答は右側の青バブル
- 回答後に自動で次の質問が表示

## 質問タイプ

| タイプ | 説明 | 確定方法 |
|--------|------|----------|
| `single` | 単一選択（ボタン） | タップで即確定 |
| `multiple` | 複数選択 | 決定ボタンで確定 |
| `vas` | スライダー＋数値入力 | 決定ボタンで確定 |
| `text` | 自由記述 | 決定ボタンで確定 |

## 質問遷移の処理フロー

### 通常の回答フロー
```
1. 選択肢をタップ
2. 選択ボタンが青色に変化（200ms）
3. 選択肢エリアがフェードアウト（200ms）
4. 回答バブルがフェードイン（200ms）
5. 次の質問が追加され、スクロール
```

### スクロールジャンプ防止
選択肢消去時に画面高さが縮むとスクロール位置がジャンプする問題への対策:

```javascript
// ダミースペーサーを追加して高さを維持
const spacerHeight = Math.max(answerArea.offsetHeight, window.innerHeight * 0.5);
const spacer = document.createElement('div');
spacer.id = 'scroll-spacer';
spacer.style.height = spacerHeight + 'px';
spacer.style.visibility = 'hidden';
elements.chatContainer.appendChild(spacer);

// 遷移完了後にスペーサーを削除
setTimeout(() => {
    const existingSpacer = document.getElementById('scroll-spacer');
    if (existingSpacer) existingSpacer.remove();
}, 500);
```

### 回答修正時の処理

回答済みの項目をタップして修正する際の問題と解決策:

**問題**: 修正完了後に質問が重複表示される

**解決策**: 修正モード開始時に最新の未回答質問を一時削除し、修正完了後に再表示

```javascript
// 修正モード開始時
function deleteLatestUnansweredQuestion() {
    for (let i = AppState.questions.length - 1; i >= 0; i--) {
        const msgDiv = document.getElementById(`msg-q-${i}`);
        if (msgDiv) {
            if (!msgDiv.querySelector('.answer-bubble')) {
                // 未回答質問を削除し、indexを記録
                msgDiv.remove();
                AppState.deletedQuestionIndex = i;
                return;
            }
            return; // 回答済みに到達したら終了
        }
    }
}

// 修正完了後
function handlePostAnswer(index, isNewAnswer) {
    if (AppState.deletedQuestionIndex !== -1) {
        // 削除した質問を再表示
        const deletedIndex = AppState.deletedQuestionIndex;
        AppState.deletedQuestionIndex = -1;
        setTimeout(() => addQuestion(deletedIndex), 300);
    } else if (isNewAnswer) {
        proceedToNext(index);
    } else {
        setTimeout(() => scrollToLastQuestion(), 300);
    }
}
```

### 単一選択の修正時UI
- 既存回答を薄青（`selected-previous`）で表示
- 同じ選択肢を再タップ → 即座に確定（アニメーション短縮）
- 別の選択肢をタップ → 通常のアニメーションで確定

### VASの修正時
- 既存の数値が入力欄に復元される
- 決定ボタンは即座に有効（誤タップ時にすぐ戻れる）

## スクロールアニメーション

カスタムスクロールを使用（`scrollToBottom`関数）:

```javascript
function scrollToBottom() {
    const container = elements.chatContainer;
    const targetScrollTop = container.scrollHeight - container.clientHeight;
    const startScrollTop = container.scrollTop;
    const distance = targetScrollTop - startScrollTop;

    if (distance <= 0) return;

    const duration = 400; // 400msのアニメーション
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
```

## QRコード出力形式

```
診察券番号[TAB]日付(YYYY/MM/DD)[TAB]回答1[TAB]回答2[TAB]...
```

例: `12345678	2026/01/26	2	3	1	2	3	1	2	0	1	1	1	1	1	75`

- 日付形式はExcel対応（セルに貼り付けると日付として認識）
- タブ区切りでExcelに直接貼り付け可能

## CSVテンプレート形式

**ファイル形式**: UTF-8 with BOM（Excelで文字化けせずに開ける）

| 列名 | 説明 | 必須 |
|------|------|------|
| `question_id` | 質問ID（英数字） | ○ |
| `question_type` | `single`, `multiple`, `vas`, `text` | ○ |
| `question_text` | 質問文 | ○ |
| `required` | `true` / `false` | ○ |
| `options` | 選択肢（`値:ラベル\|値:ラベル`形式） | △ |
| `min_value` | VAS最小値 | △ |
| `max_value` | VAS最大値 | △ |
| `min_label` | VAS最小ラベル | - |
| `max_label` | VAS最大ラベル | - |

## アクセシビリティ

- `prefers-reduced-motion`: アニメーション削減対応
- 半角英数字のみ入力制限（診察券番号）
- 必須項目の入力検証

## モーダル確認

「最初に戻る」ボタン押下時:
- 半透明白オーバーレイ（`rgba(255, 255, 255, 0.85)`）
- 中央にメッセージ表示
- 「キャンセル」「はい」ボタン

## 状態管理

```javascript
const AppState = {
    patientId: '',              // 診察券番号
    questions: [],              // 質問配列
    answers: {},                // { question_id: value }
    currentQuestionIndex: -1,   // 現在の質問index
    totalAnswered: 0,           // 回答済み数
    deletedQuestionIndex: -1    // 修正時に削除した質問のindex
};
```

## 依存ライブラリ

- **QRCode.js** (MIT License): QRコード生成
  - https://github.com/davidshimjs/qrcodejs

## 動作環境

- モダンブラウザ（Chrome, Safari, Firefox, Edge）
- スマートフォン / タブレット対応
- ローカルファイルでの実行可能（サーバー不要）
