# 0011. Claude Code/CodexのフックからのPush要求には204を返す

## ステータス

Accepted (2026-09-13)

## コンテキスト

`POST /api/push/:sessionId`(`src/api/push.ts`)は `pushSchema` により、
以下の3種類のペイロードを区別して受け付ける。

- `defaultPushSchema`: 通常のプッシュ通知(`title`/`body`)
- `ccStopSchema`: Claude Code の Stop hook イベント
  (`session_id`/`hook_event_name`/`last_assistant_message`/`scratchpad_dir`)
- `codexStopSchema`: Codex の Stop hook イベント
  (`session_id`/`hook_event_name`/`last_assistant_message`/`turn_id`/`model`)

後者2つは、Claude Code / Codex 側の Stop hook スクリプトから直接呼び出される
ことを想定している。hook スクリプトはこのエンドポイントの呼び出し結果を
hook自体の実行結果として扱うため、レスポンスボディに内容(送信結果のJSON等)
を含めると、hook側の後続処理に意図しない形で影響しうる。この干渉を避けるため、
レスポンスボディを一切持たない応答を返す必要がある。

## 決定

1. **`payload.type` が `"codex"` または `"cc"` の場合、`stub.push()` の
   呼び出し自体は行うが、レスポンスは `c.body(null, 204)` とし、
   ボディを持たない `204 No Content` を返す。**
2. **`payload.type` が `"default"` の場合は、従来通り `stub.push()` の
   結果を `c.json(result)` としてそのまま返す。**

## 検討した代替案

- **すべてのケースで `stub.push()` の結果をJSONとして返す案**: 実装は
  単純だが、hook スクリプト側の挙動に干渉しないという要件を満たせない
  ため不採用。
- **空文字列のボディを伴う `200 OK` を返す案**: ボディが存在しないことを
  意味的に明確に表現できる `204 No Content` の方が適切なため不採用。

## 影響 (Consequences)

- Claude Code / Codex の Stop hook から呼び出した場合、送信結果
  (成功件数・失敗理由など)をレスポンスから確認できない。送信結果を
  確認したい場合は `notification` テーブル(ADR 0007)を参照する必要が
  ある。
- 通常のプッシュ通知(`defaultPushSchema`)を送る場合の挙動(JSONレスポンス)
  は変更されない。
