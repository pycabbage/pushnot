# 0005. APIルートを動詞名のRPCスタイルで設計し、REST的なリソース+HTTPメソッドは採用しない

## ステータス

Accepted (2026-09-08)

## コンテキスト

Push購読の登録・解除・通知送信という3つの操作をHTTP APIとして公開する
必要がある。登録解除機能を追加した際、当初は `DELETE /api/register`
として実装したが、「register」という動詞的な名前のリソースに対して
DELETEメソッドを重ねるのは語義上不自然である、という指摘があった。

もともと `register`(`POST /api/register`)と `push`
(`POST /api/push/:sessionId`)は、それぞれHono上の独立したサブアプリ
(`src/api/register.ts` / `src/api/push.ts`)として実装されており、
DOの同名メソッド(`register()` / `push()`)へ1:1で対応する、
RPC的な命名規約が既にできていた。

## 決定

1. **すべてのAPIエンドポイントを、対応するDOメソッドと同名の動詞で
   1ファイル・1ルートとして実装する。** `POST /api/register` →
   `stub.register()`、`POST /api/unregister` → `stub.unregister()`、
   `POST /api/push/:sessionId` → `stub.push()`。
2. **1つのパスに複数のHTTPメソッドを重ねてリソース的に表現すること
   はしない。** 登録解除は `DELETE /api/register` ではなく、
   新規ファイル `src/api/unregister.ts` に独立した
   `POST /api/unregister` として実装する。
3. **`src/api/index.ts` で `factory.createApp().route("/register",
register).route("/unregister", unregister).route("/push", push)`
   のように、動詞ごとのサブアプリをフラットにマウントする。**

## 検討した代替案

- **RESTfulなリソース設計(`POST` / `DELETE /api/subscription`)に
  作り直す案**: `register` / `push` という既存の動詞ベースの命名と
  一貫しなくなること、また「subscription」という新しいリソース名を
  導入するだけの設計変更コストに見合う利点がなかったため不採用。
- **`DELETE /api/register` のまま維持する案**: 動詞である
  `register` に対してDELETEを使うのは読み手にとって意味が
  取りづらく、素直に不採用とした。

## 影響 (Consequences)

- クライアント側(HonoのRPCクライアント)からは
  `client.api.register.$post(...)` / `client.api.unregister.$post(...)`
  / `client.api.push[":sessionId"].$post(...)` のように、動詞名 +
  `$post` で一貫して呼び出せる。
- 将来的に操作を追加する場合は、既存ルートにメソッドを重ねるのでは
  なく、新しい動詞ルート(ファイル)を追加する形になる。
