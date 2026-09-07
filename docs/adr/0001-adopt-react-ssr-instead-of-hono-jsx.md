# 0001. hono/jsx を廃止し React + React SSR を採用する

## ステータス

Accepted (2026-09-07)

## コンテキスト

プロジェクト初期構成では、SSR フレームワークとして Hono に同梱の `hono/jsx` /
`hono/jsx-renderer`(`jsxRenderer` ミドルウェア)を採用していた。

- ルーティング・サーバーロジックは Hono
- 画面コンポーネントは `hono/jsx` の `useState` 等を用いた JSX
- レイアウトは `hono/jsx-renderer` の `jsxRenderer` ミドルウェアが提供する
  `c.render()` / `app.use(renderer)` パターンで実現

一方で `package.json` には `react` / `react-dom` および型定義
(`@types/react` / `@types/react-dom`)が既に依存関係として導入されており、
`hono/jsx` から React エコシステムへ移行する方針が決定された。あわせて、
`vite-ssr-components` が React 向けの補助コンポーネント一式
(`vite-ssr-components/react`: `Link` / `Script` / `ViteClient` /
`ReactRefresh`)を提供していることを確認済みである。

移行にあたり、以下の制約・要件を踏まえる必要があった。

- 実行環境は Cloudflare Workers(`workerd` ランタイム)であり、Node.js 専用の
  SSR API(`renderToString` 等の同期API)よりも、Web Streams ベースの
  ストリーミング SSR API を利用するのが望ましい。
- 既存の `App.tsx` は `useState` と `onClick` を用いた対話的なコンポーネントで
  あり、SSR 後にクライアント側でも同じロジックが動作する(ハイドレーション)
  ことが求められる。移行前の構成にはクライアントサイドのエントリーポイントが
  存在せず、`dist/client` にはスタイルシートのみがビルドされ、JS バンドルは
  出力されていなかった(=ボタンの操作は実際にはブラウザ上で機能していな
  かった)。
- 既存のコードは Hono ミドルウェアパターン
  (`app.use(renderer)` + 各ルートでの `c.render(<App />)`)に統一されており、
  この書き心地・呼び出し方を可能な限り維持したい。

## 決定

1. **`hono/jsx` / `hono/jsx-renderer` への依存を全廃し、`react` /
   `react-dom` に一本化する。**
   - `tsconfig.json` の `jsxImportSource` を `hono/jsx` から `react` に変更。
   - 画面コンポーネント(`src/client/App.tsx`)の `useState` の import 元を
     `react` に変更。

2. **サーバーサイドのレンダリングには `react-dom/server` の
   `renderToReadableStream` を採用する。**
   - `react-dom` の `package.json` の `exports` 条件には `workerd` が
     `server.edge.js` にマッピングされており、Cloudflare Vite Plugin
     経由で自動的に Workers(edge)向けの実装が解決されるため、
     `react-dom/server` を素直に import すれば良く、
     `react-dom/server.edge` を明示的に指定する必要はない。
   - `renderToReadableStream` は、ルート要素が `<html>` の場合、
     自動的に `<!DOCTYPE html>` を先頭に付与する仕様であることを
     実装検証により確認した。そのため独自に doctype を付与するコードは
     設けていない。

3. **Hono コアの汎用レンダラー差し替え API(`c.setRenderer()` /
   `c.render()`)を使い、既存の `app.use(renderer)` パターンを維持する。**
   - `hono/jsx-renderer` の `jsxRenderer` ミドルウェアは、内部で
     `c.setRenderer(...)` を呼んでいるだけの薄いラッパーであり、
     `c.render()` 自体は Hono コアが提供する汎用の差し替え機構である
     (デフォルト実装は `c.html()` へフォールバックするのみ)。
   - `src/renderer.tsx` にて `declare module "hono" { interface
ContextRenderer { (children: ReactNode): Response | Promise<Response> } }`
     という module augmentation を行い、`c.render()` の引数型を
     `ReactNode` として型付けした上で、`c.setRenderer()` に
     `renderToReadableStream` ベースの実装を登録するミドルウェア
     (`export const renderer`)を自作した。
   - これにより `src/index.tsx` は移行前と同じ
     `app.use(renderer)` → `app.get("/", (c) => c.render(<App />))`
     という記述のまま、内部実装のみを React に置き換えられた。

4. **クライアントサイドのハイドレーション用エントリーポイント
   (`src/client/index.tsx`)を新規に用意する。**
   - `react-dom/client` の `hydrateRoot` を用いて、SSR 結果
     (`<div id="root">` 配下)に対してハイドレーションを行う。
   - サーバー側コード(`src/index.tsx`, `src/renderer.tsx`)とクライアント側
     コード(`src/client/App.tsx`, `src/client/index.tsx`)をディレクトリで
     分離する構成を採用した。

5. **開発体験(HMR)のため `@vitejs/plugin-react` を新規に追加する。**
   - `vite-ssr-components/react` が提供する `ReactRefresh` コンポーネントの
     利用には `@vitejs/plugin-react` が前提となるため、
     devDependencies に追加した。
   - `vite.config.ts` の `ssrPlugin` には
     `hotReload: { ignore: ["./src/client/**/*.tsx"] }` を設定し、
     クライアント側コードの変更でサーバーサイドの hot reload が
     二重に発火しないようにしている。

## 検討した代替案

- **`c.html()` を直接呼び出し、`app.use(renderer)` パターンを廃止する案**:
  実装は単純になるが、既存コードベース全体で踏襲されているミドルウェア
  パターンとの一貫性が失われるため採用しなかった。
- **`react-dom/server` の同期 API(`renderToString`)を採用する案**:
  実装は単純だが、ストリーミングの利点(TTFB 短縮)が得られず、
  Cloudflare Workers(`workerd`)向けに用意されている
  `renderToReadableStream` を使わない理由がないため採用しなかった。
- **React Fast Refresh を導入せず `@vitejs/plugin-react` を追加しない案**:
  パッケージ追加を最小限に抑えられるが、開発時のホットリロードが
  フルリロードになり体験が劣化するため、ユーザーの承認を得た上で
  `@vitejs/plugin-react` を追加する方を採用した。

## 影響 (Consequences)

- `dist/client` に React ランタイムを含む JS バンドル(約190KB)が新たに
  出力されるようになった(移行前は CSS のみで JS バンドルは存在せず、
  画面上のボタン操作は実際には機能していなかった)。
- `tsconfig.json` の `lib` に `DOM` / `DOM.Iterable` を追加する必要が
  生じた(クライアントエントリーポイントで `document` 等の DOM 型を
  使用するため)。
- `package.json` の devDependencies に `@vitejs/plugin-react` が
  追加された。
- サーバーサイドコードとクライアントサイドコードが
  `src/` 直下と `src/client/` 以下とでディレクトリ分離される構成となった。
