# 0006. 初期登録状態はクライアントをブロックせずサーバー側で解決する

## ステータス

Accepted (2026-09-08)

## コンテキスト

`App.tsx` の「Register client」/「Unregister client」ボタンは、
このブラウザが既にPush購読済みかどうかで表示・挙動を切り替える。
ページを再読み込みしても正しい状態を表示する必要がある。

最初の実装では、クライアント側の `useEffect` でマウント後に
`navigator.serviceWorker.ready` → `pushManager.getSubscription()` を
呼び、その結果で状態を更新していた。しかし本プロジェクトでは
`useEffect` の使用自体を禁止している(`AGENTS.md`)ため、この実装は
維持できなかった。

次に、ハイドレーション(`hydrateRoot`)の呼び出し自体をこのチェックの
`await` でブロックする実装に変更したが、これはハイドレーション=
インタラクティブ化を丸ごと遅延させてしまい、パフォーマンス上の
問題として指摘された。またその際、チェック処理の置き場所を
`client/index.tsx` から `App.tsx` のトップレベルに移すという案も
検討したが、ESモジュールのトップレベルawaitは、それをimportする側
(`client/index.tsx`)の評価そのものをブロックするため、置き場所を
変えるだけでは根本的な解決にならない。

最終的に、「このセッションに購読者が存在するか」は、サーバー側で
セッションのDOに問い合わせれば同期的に(クライアントの待ち時間
ゼロで)判定できる情報であることに気づいた。

## 決定

1. **`SessionDO` に `hasSubscribers()` を追加し、`subscriber`
   テーブルに1件でも行があるかどうかを返す。**(`limit(1)`で1件だけ
   取得し、存在有無だけを判定する)
2. **`src/index.tsx` の `GET /` ハンドラを `async` にし、
   `c.env.SESSION_DO.getByName(c.var.sessionId)` のDOへ
   `hasSubscribers()` を問い合わせ、その結果をSSR時点で
   `<App data-initial-registered={isRegistered} />` として
   HTMLに埋め込む。**
3. **`src/client/index.tsx` は、他の `data-session-id` /
   `data-vapid-public-key` と全く同じ方法で、
   `data-initial-registered` 属性を同期的に読み取るだけにする。**
   非同期処理・`await`・`useEffect` は一切使わない。
4. **`App.tsx` は `useState(props["data-initial-registered"])` で
   初期状態を受け取るだけにする。**

## 検討した代替案

- **クライアント側 `useEffect` でマウント後にチェックする案**:
  `useEffect` 禁止の規約に反するため不採用。
- **`hydrateRoot` 呼び出し自体を非同期チェックの完了までブロック
  する案**: ハイドレーションが遅延し、ページ表示後もしばらく
  ボタンが操作不能になるためパフォーマンス上不採用。チェック処理を
  `App.tsx` のトップレベルに移動する案も、ESモジュールの
  トップレベルawaitの仕様上ハイドレーションのブロックは解消され
  ないため同様に不採用とした。
- **React 19の `use()` フックとSuspenseストリーミングを使い、
  ハイドレーションをブロックせずに非同期解決する案**: 実現は
  可能だが、Suspense境界の追加など構成変更が大きく、値がサーバー側
  から同期的に導出できる以上、そこまでの複雑さを持ち込む理由が
  なかったため不採用とした。

## 影響 (Consequences)

- `GET /` ハンドラがDOへの問い合わせを1回挟むため、特にそのセッション
  で初めてDOが起動する場合(マイグレーション未適用)は、TTFBに
  多少の遅延が生じる。
- クライアントの起動処理(`client/index.tsx`)は完全に同期的になり、
  ハイドレーション開始が遅延することはない。
- 「ブラウザの実際のPush購読状態」ではなく「サーバー側DBに購読者が
  存在するか」を初期状態の根拠としているため、ブラウザ側で購読が
  独立して失効した場合(サイトデータ削除など)は、初期表示が実際の
  状態とずれる可能性がある。ただし「Unregister」実行時は改めて
  `pushManager.getSubscription()` を確認しているため、実際の解除
  処理自体はこのずれの影響を受けない。
