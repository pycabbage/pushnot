# 0003. Web PushをWeb Crypto APIのみで自前実装する

## ステータス

Accepted (2026-09-08)

## コンテキスト

ブラウザへプッシュ通知を送信するには、RFC 8291(Message Encryption for
Web Push, aes128gcm content-encoding)によるペイロード暗号化と、
RFC 8292(VAPID)によるJWT形式の送信者認証ヘッダの付与が必要になる。

これを実装する一般的な手段としては、Node.js向けの `web-push` npm
パッケージが広く使われている。しかし本プロダクトの実行環境は
Cloudflare Workers(`workerd`ランタイム)であり、`web-push`パッケージは
Node.jsの `crypto` モジュールや `http`/`https` エージェントに依存して
おり、`workerd`上では動作しない(あるいは動作の保証がない)。

一方で `workerd` は Web標準の `crypto.subtle`(Web Crypto API)を
サポートしており、ECDH鍵共有・HKDF・AES-GCM・ES256署名など、
RFC 8291/8292の実装に必要な暗号プリミティブはすべて標準APIの範囲内で
揃っている。

## 決定

1. **`src/lib/web-push.ts` に、追加の依存ライブラリを導入せず、
   `crypto.subtle` のみを使ってWeb Push送信を自前実装する。**
   - `encryptPayload()`: 購読者のP-256公開鍵(`p256dh`)と認証シークレット
     (`auth`)から、ECDH鍵共有 → HKDF → AES-GCM暗号化という手順で
     RFC 8291のaes128gcm形式ボディを生成する。
   - `buildVapidAuthHeader()`: `hono/jwt`の`sign()`(既存依存の`hono`に
     含まれる)を使い、ES256署名のVAPID JWTを生成し
     `Authorization: vapid t=..., k=...` ヘッダを組み立てる。
   - `sendWebPush()`: 上記2つを組み合わせて `fetch()` でPush
     サービスのエンドポイントへPOSTし、レスポンスステータスを
     `sent` / `gone`(404/410、購読失効) / `error` に正規化して返す。
2. **VAPID鍵ペアは `wrangler.jsonc` の `vars.VAPID_PUBLIC_KEY`(公開鍵、
   秘匿情報ではない)と `secrets.required` の
   `VAPID_PRIVATE_KEY_JWK`(秘密鍵、JWK形式)に分離して管理する。**

## 検討した代替案

- **`web-push` npmパッケージをそのまま使う案**: Node.js専用APIに
  依存しており `workerd` で動作しないため不採用。
- **`web-push` のWorkers対応フォーク/代替パッケージを探して使う案**:
  暗号処理という機微な領域を、メンテナンス状況が不明な非公式サードパーティ
  実装に委ねるリスクがあり、標準APIだけで十分実装可能なため採用しなかった。
- **暗号プリミティブ自体を手書きする(AES-GCMやHKDFを自前実装する)案**:
  `crypto.subtle` が標準でこれらを提供しており、車輪の再発明でしかなく
  検討にも値しなかった。

## 影響 (Consequences)

- `src/lib/web-push.ts` に約150行程度の低レベルな暗号処理コードが存在し、
  RFC 8291/8292の仕様理解を前提としたメンテナンスコストを負う。
- 外部依存が増えない(`package.json`に`web-push`系パッケージは登場しない)。
- ブラウザ側のPush購読解除(410/404)を検知し、`subscriber`テーブルから
  自動的に削除する処理(`push()`内の`gone`分岐)も、この自前実装の
  戻り値の正規化(`SendWebPushResult`)によって成立している。
