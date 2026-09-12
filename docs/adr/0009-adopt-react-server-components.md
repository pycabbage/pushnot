# 0009. React Server Components (RSC) を導入する

## ステータス

Accepted (2026-09-10)

## コンテキスト

調査・検討に基づき、本プロジェクトへ React Server Components (RSC) を導入する。
ADR 0001 で「React SSR を採用する」と決定した
際の実装(`renderToReadableStream` でReactツリーを直接HTMLへレンダリングする
だけの構成)は、名前に反してRSC(Flightプロトコルによるシリアライズ)を一切
経由しておらず、`"use client"` を付けても解釈する仕組みがなかった。

`@vitejs/plugin-rsc`(`0.5.34`)を導入すればRSCのビルド基盤・ランタイムAPIが
手に入るが、Honoを Workers の `fetch` ハンドラとして使い続けるための配線は
自分で行う必要がある。また `@cloudflare/vite-plugin`(`1.54.6`)には、単一
Worker内で複数のVite Environmentを実行するための `viteEnvironment.childEnvironments`
オプションが実装されていることを、パッケージ本体のソース
(`node_modules/@cloudflare/vite-plugin/dist/index.mjs`)を直接読んで確認した。

## 決定

1. **`@vitejs/plugin-rsc` を追加し、Viteに `rsc` /
   `ssr` / `client` の3つのEnvironmentを持たせる。**(`vite.config.ts`)

   - `rsc` 環境: React Server Components(react-server条件)の実行環境。
     `src/index.tsx`(Honoアプリ本体)がここでビルド・実行される。
   - `ssr` 環境: RSC FlightストリームをHTMLへ変換する環境
     (`src/rsc/entry.ssr.tsx`)。
   - `client` 環境: ブラウザでのhydration/CSR環境(`src/rsc/entry.browser.tsx`)。

   なお `ssr` 環境の出力先(`environments.ssr.build.outDir`)は、既定値の
   `dist/ssr`(`rsc`環境の出力先 `dist/rsc` と兄弟ディレクトリ)ではなく、
   明示的に `dist/rsc/ssr` (`rsc`環境の出力先の内側)を指定している。
   `vite build` 後に `vite preview`(Cloudflare Workersの
   `no_bundle`デプロイ相当)で実機検証したところ、`rsc`環境の
   `index.js`から`import.meta.viteRsc.loadModule("ssr", "index")`が
   ビルド時に書き換えられた `import("../ssr/index.js")`
   (`dist/rsc`から見て親ディレクトリへ抜ける相対パス)が
   `Error: No such module "../ssr/index.js"` で失敗することを確認した。
   workerdの`no_bundle`ワーカーはエントリスクリプトのディレクトリ配下
   (`rules`の glob スキャン範囲)にないファイルを動的importで解決できない
   ため、`ssr`環境の出力を`rsc`環境の出力の内側に置くことで解決した。

2. **`@cloudflare/vite-plugin` の `viteEnvironment` オプションで、Workerの
   エントリ環境名を `"rsc"` にリネームし、`"ssr"` をその子環境
   (`childEnvironments`)にする。** (`"client"` は同プラグインの予約名の
   ため子環境に含められない。) これにより、`rsc` 環境内から
   `import.meta.viteRsc.loadModule("ssr", "index")` を呼んだ際、`ssr` 環境の
   コードが本番同様に同じworkerd上で直接実行される(`loadModuleDevProxy` の
   ようなfetchベースのプロキシを別途組む必要がない)。
3. **`wrangler.jsonc` の `main` は `./src/index.tsx` のまま変更しない。**
   `@cloudflare/vite-plugin` は、エントリWorkerに対応するVite Environment
   (今回は `rsc`)の `build.rollupOptions.input` を、ユーザー側の設定に
   関わらず常に `wrangler.jsonc` の `main` を指す仮想モジュールへ上書きする
   (`MAIN_ENTRY_NAME = "index"` として内部的に固定)。そのため `rsc` 環境
   専用のエントリファイルを別途用意する必要はなく、`ssr` / `client` の
   2環境分だけ `environments.*.build.rollupOptions.input` を明示すれば良い。
4. **`compatibility_flags` に `nodejs_als` を追加する。**(`wrangler.jsonc`)
   `@vitejs/plugin-rsc` は、Reactの内部コードが
   `typeof AsyncLocalStorage === "function"` のようなパターンで
   `AsyncLocalStorage` の存在を検出しようとしている箇所を検知すると、
   `import * as x from "node:async_hooks"` を自動的に注入して
   `globalThis.AsyncLocalStorage` を用意する。この`node:async_hooks`自体は
   `nodejs_als`(または`nodejs_compat`)フラグなしでは workerd 上で
   解決できないため、フラグを追加しないとRSC/SSRのレンダリングがモジュール
   解決エラーで失敗する。
5. **`src/middleware/renderer.tsx` を全面的に書き換える。** ADR 0001 で
   決めた「`app.use(renderer)` + `c.setRenderer()`/`c.render()`」という
   Honoミドルウェアパターン自体は維持しつつ、内部の処理を
   「Reactツリー → RSC Flightストリーム
   (`@vitejs/plugin-rsc/rsc/server` の `renderToReadableStream`)→
   (Acceptヘッダに応じて)FlightストリームをそのままレスポンスするかSSR環境
   でHTML化するか分岐」という2段階に変更した。HTML化は
   `import.meta.viteRsc.loadModule("ssr", "index")` で `ssr` 環境の
   `entry.ssr.tsx` を呼び出す形に切り出した。
6. **セッションID・VAPID公開鍵・初期登録状態は、`data-*` HTML属性を
   `client/index.tsx` で `querySelector` して読み直す方式をやめ、
   `<AppClient sessionId={...} vapidPublicKey={...}
initialRegistered={...} />` という通常のReact propsとして渡す。**
   RSCのFlightシリアライズがサーバー→クライアントの値の受け渡しを
   担うようになったため、DOM属性経由で値を"密輸"する必要がなくなった。
   ADR 0006(初期登録状態をサーバー側で解決する決定)自体は変更しない。
   値の伝達経路が`data-*`属性からRSC propsに変わっただけである。
7. **`RscPayload` 型(`src/rsc/payload.ts`)は自前定義のままとする。**
   `@vitejs/plugin-rsc` の `/rsc`・`/ssr`・`/browser`・`/plugin` の
   型定義(`dist/rsc.d.ts` / `dist/ssr.d.ts` / `dist/browser.d.ts` /
   `dist/plugin.d.ts`)を確認したが、汎用的な `RscPayload` 相当の型は
   存在しない。`renderToReadableStream<T>` /
   `createFromReadableStream<T>` はいずれもペイロードの形をアプリ側の
   型引数`T`に委ねる設計であり、公式READMEの全サンプルもアプリ側で
   `RscPayload` 型を定義している。AGENTS.mdの「ライブラリが提供する型
   を自前で書き写さない」という規約は、ライブラリ側に対応する型が
   存在する場合の話であり、本ケースは該当しない。
8. **`src/client/` を `src/app/` へリネームし、旧 `App.tsx` を
   Server Component(`src/app/App.tsx`)と Client Component
   (`src/app/AppClient.tsx`)へ分割して、ランタイム層
   (`src/index.tsx`)からビジネスロジックを排除する。**

   - `src/index.tsx` の `GET /` ハンドラは
     `c.render(<App vars={c.var} />)` のみを行う薄い配線にする。
     Honoの `c.var`(型は `Env["Variables"]`、実体は
     `Object.fromEntries(...)` が返すプレーンオブジェクト)をまるごと
     `vars` propとして渡すことで、変数を追加してもランタイム層側の
     配線を変更しなくて済むようにした。
   - `src/app/App.tsx` はasyncな Server Component(`"use client"`
     なし)にし、`import { env } from "cloudflare:workers"` で
     環境バインディングへ直接アクセスする。旧 `src/index.tsx` の
     ハンドラが行っていた `SESSION_DO.getByName(...).hasSubscribers()`
     の呼び出しと `VAPID_PUBLIC_KEY` の参照はここへ移した。
     `cloudflare:workers` の `env` は、`worker-configuration.d.ts` が
     生成する `declare module 'cloudflare:workers' { export const env:
Cloudflare.Env }` と、同ファイル内で `Cloudflare.Env` を
     `CloudflareBindings` 相当の実体へマージする宣言により、追加の
     型定義なしで型付けされることを確認した。
   - 旧 `App.tsx`(`useState`/`useTransition`を使う対話的UI)は
     `src/app/AppClient.tsx`(既定エクスポートの関数名も`AppClient`に
     変更)へ移動した。受け取る `sessionId` / `vapidPublicKey` /
     `initialRegistered` の3propsという形自体は変えていない。

9. **`src/app/AppClient.tsx` の先頭に `"use client"` を追加する。**
   このコンポーネントは `useState`/`useTransition` を使うため、RSC
   においてはClient Componentである必要がある。`AppClient.tsx` から
   しか import されない `DataTable`/`Button`/`Badge`/`Empty` 等の子
   コンポーネントは、Client Component境界の内側にあるため個別に
   `"use client"` を付ける必要はない。
10. **通知配信(WebSocket)の購読は `src/app/AppClient.tsx` 内で、React
    19.3で追加された `react-dom` の `browser()` と `use()` を使って行う
    (React/React DOMは19.3へ更新済み)。** `src/rsc/` 配下には RSCの
    bootstrap処理(RSCペイロードの読み取りと`hydrateRoot`)以外のコード
    を一切置かないという方針のもと、`useEffect`・`typeof window`判定・
    `ref`いずれも使わない構成にした。

    - `react-dom`(`react-dom/client`ではなく素の`"react-dom"`)が
      `browser(reason?: string | (() => unknown)): BrowserUsable` を
      エクスポートしていることを、インストール済み`react-dom@19.3.0`の
      実ソース(`node_modules/react-dom/cjs/react-dom.development.js`)
      で確認した。型定義も`@types/react-dom/index.d.ts`に
      `export function browser(reason?: string | (() => unknown)):BrowserUsable;`
      として含まれており(JSDocに`@version 19.3.0`と
      明記)、`@types/react-dom/canary.d.ts`は`export {}`のみの空ファイル
      である。そのため`tsconfig.json`の`types`に`"react-dom/canary"`を
      追加する必要はなく、追加していない。
    - `use(browser(reason))` を呼ぶと、`ssr` 環境(`react-dom/server.edge`)
      では `$$typeof: Symbol.for("react.recoverable")` を持つ
      リカバラブルなエラーを`use()`自身が投げる(react-dom-server.edge
      のソースで確認済み)。これは`<Suspense>`でしか捕捉できないため、
      通知購読コンポーネント(`NotificationsSocket`)を
      `<Suspense fallback={null}>`で包んでいる。SSR側はフォールバック
      (`null`)を出力して終わり、`use(browser(...))`より後ろのコード
      (WebSocket接続処理)は一切実行されない。
    - ブラウザ側の`use()`実装は同じ`$$typeof`を見て単に`return`する
      (react-dom-clientのソースで確認済み)ため、ブラウザでは
      `use(browser(...))`を素通りしてそこから先が実行される。
    - `NotificationsSocket`はpropsを持たないコンポーネントとして
      `AppClient`の外(モジュールトップレベル)に定義した。React
      Compiler(`vite.config.ts`の`react({ compiler: true })`)が
      有効なため、`useCallback`/`useMemo`による手動メモ化はせず、
      素のコンポーネント・素のクロージャのまま書いている
      (前段のref callback版で使っていた`useCallback`は、compilerが
      有効な環境でわざわざ手動メモ化する理由がないという指摘を受けて
      撤回した)。propsを取らないコンポーネントの再レンダー省略は
      compilerが担う。
    - `vite preview` と agent-browser で、SSRされた画面、RSC Flightの
      再取得、hydrate後の登録ボタンのイベント処理を確認した。

11. **`src/client/index.tsx` を削除し、`src/rsc/entry.browser.tsx` に
    置き換える。** 新しいエントリポイントは、同じURLへ
    `Accept: text/x-component` 付きでfetchし直してRSC Flightストリーム
    を取得する。同一オリジンのfetchなのでセッションCookieは自動送信
    される。取得Promiseを`use()`する`Root`を`hydrateRoot(document,
<Root />)`へ直ちに渡すため、Flightの取得を`await`してhydration開始を
    ブロックしない。hydration対象が `#root` divではなく `document` 全体に
    なるのは、`Layout` の `<html>`/`<head>`/`<body>` もRSCツリーの一部として
    シリアライズされるためである。通知購読などのアプリ固有の処理はここへは
    置かず、`src/app/AppClient.tsx` 側に完結させている。
12. **`rsc-html-stream` への依存を削除する。** GitHub Stars 195・
    週間ダウンロード数2万程度と、サプライチェーンの信頼性の観点で
    採用に値しないという指摘を受けた。このパッケージは「RSC
    ペイロードをHTMLストリームに埋め込み、クライアントが追加fetch
    なしでhydrationできるようにする」という最適化のためだけに
    使っていたもので、`@vitejs/plugin-rsc`本体・READMEのシンプルな
    サンプル実装が採用している「ブラウザから`Accept:
text/x-component`で同じURLへ取りに行く」方式(項目11)へ戻せば
    追加パッケージなしで成立する。埋め込みをやめたことで初期表示から
    インタラクティブになるまでの間に1往復分のfetchが増えるが、
    個人利用のツールという性質上この程度のレイテンシ増は許容範囲と
    判断した。削除後、`src/rsc/entry.ssr.tsx`(ストリームの`tee()`と
    埋め込みを撤去)・`src/rsc/entry.browser.tsx`(埋め込み読み取りを
    fetchに置き換え)を修正し、`pnpm build`(3環境とも成功)と
    実ブラウザでのhydration・通知のWebSocket疎通(ダミー購読者への
    `push`でテーブルが即時更新されること)を再確認済み。
13. **`vite-ssr-components` への依存を完全に削除する。** `Script` /
    `ReactRefresh` は `@vitejs/plugin-rsc` 自身のbootstrapスクリプト
    注入(`getClientEntryUrl()` + `bootstrapModules`)とHMR機構に
    置き換わるため不要になった。`Link` / `ViteClient` についても、
    `vite-ssr-components/plugin`(`ssrPlugin()`)のソース
    (`dist/plugin/index.js`)を確認したところ、ファイル内の
    `<Script>` / `<Link>` 使用箇所をASTスキャンして
    `environments.client.build.rollupOptions.input` を自動追記する
    実装になっており、この値が(`@vitejs/plugin-rsc`の要求する)
    オブジェクト形式の場合は追記ではなく**まるごと上書き**して
    しまうことを確認した。これを使い続けるとビルド時に `client`
    環境のエントリ設定が壊れるため、パッケージ自体を削除した。
    スタイルシートは `renderer.tsx` から `import "../style.css"` した
    上で `{import.meta.viteRsc.loadCss()}` を明示的に呼んで注入し、
    開発時のVite HMRクライアントは
    `{import.meta.env.DEV && <script type="module" src="/@vite/client" />}`
    を直接書く形に置き換えた。
14. **Server Functions(`"use server"`)の導入は今回のスコープに含め
    ない。** `register`/`unregister`/`push` はADR 0005の通りHonoの
    通常ルートのままとする。導入前の調査で、
    `"use client"` はHono構成での動作が複数の独立実装で確認済みで
    ある一方、`"use server"` をHonoのミドルウェア配下に配線した
    公開実装は見つからなかったと明記されており、確度の低い部分まで
    無理に導入しない。
15. **コード内コメントは使わず、設計判断はADRへ記録する。** RSCのVite
    Environment・SSR出力先・Flightの応答分岐は本ADRの項目1、2、5、11、
    `RscPayload`は項目7、アプリ層の分離とブラウザ限定のWebSocket購読は
    項目8、10に記録する。匿名セッション、Web Push、Durable Objectの
    スキーマと送信結果の扱いは、それぞれADR 0002、0003、0004、0007を
    正とする。

## 検討した代替案

- **`ViteClient`(`vite-ssr-components/react`)を `import.meta.env.DEV` の
  ガード付きで使い続ける案**: 初期検討で提案されていた
  折衷案だったが、上記の通り `ssrPlugin()` の自動エントリ検出が
  `client` 環境のビルド入力を破壊することを実際にソースを読んで確認した
  ため、`vite-ssr-components` ごと削除する方を選んだ。
- **`rsc({ loadModuleDevProxy: true })` を使い、`ssr` 環境をメインの
  Node.js Viteプロセス側で実行する案**: `rsc` 環境(Cloudflare Workers/
  workerd)から `ssr` 環境への呼び出しをfetchベースのRPCで橋渡しする
  もう一つの公式な統合方法。開発時に本番(単一Worker内で完結)と異なる
  プロセス配置になるため、`@cloudflare/vite-plugin` が提供する
  `childEnvironments` を使い、`ssr` も同じworkerd上で動かす方を採用した。
- **`register`/`unregister`/`push` を `"use server"` のServer Functions
  として書き直す案**: 前述の通り検証確度が低く、既存のHonoルートは
  ADR 0005の設計のまま何の問題もなく動作しているため、書き換える理由が
  なかった。
- **`sessionId` 等を `src/index.tsx` 側で個別に選んで `App` へ渡す案
  (現状維持)**: 変数を1つ追加するたびにランタイム層(`src/index.tsx`)
  を修正する必要があり、「ビジネスロジックをランタイム層に置きたく
  ない」という目的に反するため、`c.var` をまるごと `vars` propとして
  渡す方式に変更した。
- **`VAPID_PUBLIC_KEY` 等を `c.env` から引き続き `App` の追加propとして
  渡す案**: `cloudflare:workers` の `env` エクスポートを使えば
  Server Component側から直接バインディングを参照でき、ランタイム層の
  関数シグネチャを変数追加のたびに変える必要がなくなるため、
  こちらを採用した。
- **`src/app/bootstrap.ts` に `bootstrapApp()` のような汎用フックを
  用意し、`entry.browser.tsx` から1回だけ呼ぶ案**: 一度実装したが、
  「`src/rsc/` から `src/app/` への呼び出しが1段挟まるだけで、
  結局間接的にビジネスロジックを起動している」という指摘を受けて
  撤回した。`entry.browser.tsx` からのいかなる呼び出しも行わず、
  `AppClient.tsx` の中だけで完結させる方式に変更した。
- **React 19の ref callback(クリーンアップ関数)で、ブラウザでの
  マウント時にのみWebSocketを接続する案**: React 19.3へ更新する前に
  実装し、`curl`のみのリクエストでは発火せずブラウザでのみ発火する
  ことを実機で確認した上で一時的に採用していた。React/React DOMを
  19.3へ更新した後、同じ目的のために設計された公式API
  (`react-dom`の`browser()` + `use()`)の存在をソースと型定義
  (`@types/react-dom/index.d.ts`)で確認できたため、こちらへ置き換えた。
  DOM要素の存在を経由しない分、`browser()`の方が「このサブツリーは
  ブラウザでしか描画できない」という意図をより直接的に表現できる。
- **`useSyncExternalStore` の `subscribe` 引数(ブラウザでのみ呼ばれ、
  SSRでは`getServerSnapshot`が使われる)を、値を返さない「ブラウザ限定
  実行のトリガー」として流用する案**: 技術的には動作するはずだが、
  AGENTS.mdが名指しで禁止している
  「`useSyncExternalStore`を使った自前のストア実装」に見た目上
  酷似し紛らわしいため採用しなかった。
- **`useCallback`で`browser()`呼び出し部分のコンポーネントや関数を
  手動メモ化する案**: React Compiler(`vite.config.ts`の
  `react({ compiler: true })`)が既に有効な環境で手動メモ化を書く
  理由がないという指摘を受けて不採用とした。`NotificationsSocket`は
  propsを取らないコンポーネントとして定義するに留め、再レンダー省略の
  判断はcompilerに委ねている。

## 影響 (Consequences)

- ビルド成果物が `dist/rsc`(`ssr`環境分は入れ子の`dist/rsc/ssr`) /
  `dist/client` の3系統に分かれる
  (`wrangler.jsonc` の `main` は引き続き `./src/index.tsx` を指定するだけで、
  実体の解決は `@cloudflare/vite-plugin` が行う)。
- 今後 新しいServer Component/Client Componentの境界を追加する際は、
  hooksやブラウザAPIを使うモジュールに `"use client"` を付ける判断が
  都度必要になる。現状この境界を持つのは `src/app/AppClient.tsx` のみ。
- `src/index.tsx` は `c.render(<App vars={c.var} />)` のみのランタイム
  配線となり、DurableObjectの参照や `env` 参照といったビジネスロジックは
  すべて `src/app/App.tsx`(Server Component)側に集約された。今後
  同様のサーバー側データ取得を追加する場合は、ランタイム層ではなく
  `src/app/App.tsx` 側に書くのが本ADRで確立した方針になる。
- `src/rsc/` 配下(`entry.ssr.tsx` / `entry.browser.tsx` /
  `payload.ts`)と `src/middleware/renderer.tsx` は、RSCのbootstrap・
  レンダリング処理のみを持ち、アプリ固有のビジネスロジック(通知配信の
  購読など)を一切参照しない。今後ブラウザ限定の初期化処理を追加する
  場合は、`useEffect`を使わず、`react-dom`の`browser()` + `use()`
  ( + `<Suspense>`)で`src/app/`側のコンポーネントに書くのが本ADRで
  確立した方針になる。propsを取らないコンポーネントとして切り出せば、
  再レンダー時の再実行抑制はReact Compilerに委ねられ、手動での
  `useCallback`/`useMemo`は不要。
- ADR 0001 に記載された「`renderToReadableStream(<Layout>{children}</Layout>)`
  を直接呼ぶ」という実装は、本ADRにより
  `renderer.tsx`(RSC Flight化)と `entry.ssr.tsx`(HTML化)の2ファイルに
  分割された。ADR 0001の「Honoの`c.setRenderer`/`c.render`パターンを
  維持する」という決定自体は変わっていない。
