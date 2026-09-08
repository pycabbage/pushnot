# 0007. 通知の送信結果を購読者単位で記録する

## ステータス

Accepted (2026-09-08)

## コンテキスト

`notification` テーブルは当初、`push()` が呼ばれるたびに
タイトル・本文のみを1行追加する、送信履歴のログとして実装されていた。
しかしこの行は成功/失敗の情報を一切持たず、`push()` 内でも一度も
`SELECT` されることがない書き込み専用のテーブルになっており、
存在意義が説明できない状態だった。

一方で `push()` は購読者(endpoint)ごとに `sendWebPush()` を呼び、
`sent` / `gone` / `error`(HTTPステータス付き)という結果を個別に
持っている。この情報を捨てずに残せば、「どの購読者への送信が
いつ・なぜ失敗したか」を後から追跡できる。

## 決定

1. **`notification` テーブルに `success`(boolean)と
   `failure_reason`(text、成功時はnull)の2カラムを追加する。**
   (`src/do/session/schema/notification.ts`)
2. **`push()` 内で、購読者ごとの`Promise.all`のコールバック内で
   `sendWebPush()`の結果に応じて1行ずつ `notification` へ挿入する。**
   `push()`の呼び出し単位(タイトル/本文)ではなく、購読者への
   送信試行単位でレコードを作る。
   - `sent` → `success: true`, `failureReason: null`
   - `gone` → `success: false`, `failureReason: "gone"`
   - `error` → `success: false`,
     `` failureReason: `http ${httpStatus}` ``

## 検討した代替案

- **`push()`呼び出し単位で1行、成功/失敗件数(`sentCount`/
  `failedCount`)だけを集計して記録する案**: どの購読者(endpoint)が
  なぜ失敗したかが分からず、デバッグ用途に使えないため不採用。
- **送信履歴を一切記録しない(テーブル自体を削除する)案**: 一度
  実際に検討・実施したが、「配信の成功/失敗と理由を記録する」という
  具体的な利用目的が生まれたため撤回し、このテーブルを前提とした
  設計に戻した。

## 影響 (Consequences)

- `notification` の行数は「`push()`の呼び出し回数」ではなく
  「`push()`の呼び出し回数 × 購読者数」に比例して増える。
- 特定の購読者(endpoint)への配信が継続的に失敗している、といった
  傾向を、後からこのテーブルを見るだけで確認できる。
