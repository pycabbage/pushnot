# 0002. 認証なしの匿名JWT Cookieセッションを採用する

## ステータス

Accepted (2026-09-08)

## コンテキスト

pushnotは各ブラウザ(タブ)ごとにプッシュ通知の購読を管理する必要があり、
その単位として「セッション」を導入し、`SESSION_DO.getByName(sessionId)` で
セッションごとに1つのDurable Objectを対応させている(購読者テーブルへの
読み書きの単位)。

`docs/plans/001-overall.md` の設計方針で明記されている通り、本プロダクトは
個人利用のAIエージェント通知リレーであり、ユーザー登録・ログインを要求
しない方針が最初から決まっている。一方で、何らかの形でブラウザを識別し、
再訪問時に同じDurable Object(=同じ購読者リスト)へたどり着けるように
する必要がある。

また `/api/push/<sessionId>` エンドポイントは、AIエージェントのHooksや
curlコマンドなど、Cookieを持たない外部プロセスから直接呼び出されることが
前提の設計であり(`docs/plans/001-overall.md` 参照)、ブラウザセッションと
同じ認証の枠組みには乗らない。

## 決定

1. **ページ初回アクセス時に、`crypto.randomUUID()` で生成した匿名の
   `sessionId` を `sub` クレームとしてJWT(HS256)に署名し、Cookieとして
   発行する。**(`src/middleware/session.ts`)
   - Cookie名は `session`、`httpOnly: true` / `secure: true` /
     `sameSite: "Lax"` / `maxAge` は1年(`60 * 60 * 24 * 365`秒)。
   - 2回目以降のアクセスでは、Cookieの署名を`hono/jwt`の`verify()`で
     検証し、有効なら同じ`sessionId`を再利用する。検証に失敗した場合
     (改ざん・期限切れなど)は新しい匿名セッションを発行し直す。
2. **署名鍵は `wrangler.jsonc` の `secrets.required` に含めた
   `SESSION_SECRET` を使い、Workers外(`.dev.vars` / `wrangler secret`)
   で管理する。** アプリケーションコードにはハードコードしない。
3. **`/api/push/:sessionId` ルートは、このCookieベースのセッション
   ミドルウェアを完全にスキップする。**(`session.ts`内の
   `if (c.req.url.startsWith("/api/push/")) return next()`)
   - このルートは `sessionId` をURLパスパラメータとして直接受け取り、
     それをそのままDOの名前解決に使う。Cookieを持たないcurl等からの
     呼び出しを可能にするための意図的な設計であり、`docs/plans/001-overall.md`
     に明記された「認証をバイパスする」仕様に対応する。

## 検討した代替案

- **Workers KVやD1にサーバー側セッションストアを持ち、Cookieには
  ランダムなセッションIDのみを入れる案**: JWTの署名検証だけで
  改ざん検知ができるため、KVやD1への追加の読み書き(=レイテンシと
  1バインディング分の運用コスト)を払うだけの理由がなく採用しなかった。
- **認証(メール/パスワードやOAuth)を導入する案**: 個人のAIエージェント
  通知リレーという用途に対して明らかに過剰であり、`docs/plans/001-overall.md`
  で最初から「認証なし」と明記されているため不採用。
- **署名なしの平文Cookie(単なるUUID)案**: 改ざん・推測が容易になり、
  他人のセッションを乗っ取れてしまう。`hono/jwt`が既存の依存関係
  (`hono`)に含まれ追加コストがほぼないため、署名付きJWTを採用しない
  理由がなかった。

## 影響 (Consequences)

- アカウントの概念が存在しないため、同じユーザーが別ブラウザ/別デバイスで
  アクセスすると別セッション(別DO・別購読者リスト)として扱われる。
- Cookieの値さえ入手できれば誰でもそのセッションの購読者として振る舞える
  (register/unregisterが可能)。ただし個人利用ツールとしてのリスク許容
  範囲内と判断している。
- `/api/push/:sessionId` はCookieを検証しないため、`sessionId`を知る
  者は誰でも任意のセッションへ通知を送信できる。この経路はそもそも
  「外部スクリプトから叩けること」が要件であるため、意図した仕様である。
