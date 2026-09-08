# 0004. セッションごとのDurable Object + 組み込みSQLiteを採用する

## ステータス

Accepted (2026-09-08)

## コンテキスト

購読者(Push Subscription)と通知送信履歴を、匿名セッション単位で
永続化する必要がある。Cloudflare上でのデータストア選択肢としては、
D1(共有SQLデータベース)、KV(キーバリュー)、Durable Objects +
組み込みストレージ(SQLite backend)などがある。

セッションはユーザー登録なしに `crypto.randomUUID()` で発行され
(ADR 0002)、原理的には無数に作られうる。また `subscriber`(購読者)と
`notification`(送信履歴)という関係を持つ2テーブルを、セッションご
とに独立して読み書きしたい。

## 決定

1. **`wrangler.jsonc` の `durable_objects.bindings` に `SESSION_DO`
   (`SessionDO`クラス、`storage: "sqlite"`)を1つ定義し、
   `SESSION_DO.getByName(sessionId)` でセッションごとに1つのDO
   インスタンスを生成・取得する。**
2. **各DOインスタンスは `drizzle-orm/durable-sqlite` 経由で自身の
   組み込みSQLiteストレージにアクセスし、`subscriber` /
   `notification` の2テーブルをdrizzle-kitで生成した型付きスキーマ
   (`src/do/session/schema/`)で管理する。**
3. **DOのコンストラクタで `ctx.blockConcurrencyWhile()` を使い、
   マイグレーション(`drizzle/session/migrations.js`、drizzle-kit
   生成)をDO起動時に同期的に適用する。** これによりDOが最初に
   起動した時点でスキーマが必ず最新化されていることを保証する。
4. **`register` / `unregister` / `push` の各操作はすべて、対応する
   セッションのDOインスタンスに対するメソッド呼び出し
   (`stub.register()` 等)として実装する。** Worker側のAPIハンドラ
   (`src/api/*.ts`)自体はデータアクセスを一切持たない。

## 検討した代替案

- **単一の共有D1データベースに、全セッション分の行を `sessionId`
  列で保持する案**: テーブルごとに `WHERE sessionId = ?` を書き
  漏らすと他セッションのデータが混入しうる。DO単位での物理的な
  分離であれば、クエリを書き間違えても構造的に他セッションへは
  到達し得ないため、こちらを優先した。
- **Workers KVに購読者リストをJSON配列として保持する案**:
  `notification` テーブルのような追記型の履歴データや、
  `onConflictDoUpdate` による upsert 的な更新には向いておらず、
  drizzle-ormによる型付きテーブル操作の恩恵も受けられないため
  不採用。
- **セッションDOを使わず、Cronや外部キューでバッチ送信する案**:
  そもそも即時送信(AIエージェントの作業完了通知)が要件であり、
  検討の対象外。

## 影響 (Consequences)

- 匿名セッション1つにつきDOインスタンスが1つ作られるため、
  訪問者数に比例してDOの数が増える。初回アクセス時はマイグレーション
  適用のオーバーヘッドがかかる(DOの初回起動コスト)。
- データが物理的にセッション単位で分離されるため、`subscriber`/
  `notification` のクエリにセッションIDによるフィルタ条件を書く
  必要が一切ない(DOバインディングの名前解決自体がその役割を担う)。
- スキーマ変更のたびに `pnpm db:generate:session` でマイグレーションを
  生成し、`drizzle/session/` 配下にコミットする運用になる。
