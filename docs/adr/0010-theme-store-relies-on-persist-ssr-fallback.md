# 0010. テーマ状態はzustand/persistの標準SSRフォールバックに委ね、browser()/Suspenseガードを設けない

## ステータス

Accepted (2026-09-12)

## コンテキスト

ダーク/ライト/システムテーマの状態を保持するため、`src/components/theme-provider.tsx` に
zustandの`persist`ミドルウェアを使った`useTheme`ストアを追加した。`resolveSystemTheme`
(`window.matchMedia`)と`applyThemeClass`(`window.document.documentElement`)はいずれも
ブラウザ専用APIに依存する。

ADR 0009 §10 では、ブラウザでしか実行できない処理(通知のWebSocket購読)を`react-dom`の
`browser()` + `use()` + `<Suspense>`という明示的なガードで囲む方針を確立している。テーマ
ストアも同様のガードが必要か検討した。

しかし、zustandの`persist`ミドルウェアの実装(`node_modules/zustand/esm/middleware.mjs`、
`zustand/middleware`のexport先。`zustand`の`package.json`の`exports["./*"]`定義で確認済み)を
直接確認したところ、以下の挙動になっていることをソースコードで確認した。

- `persist`のデフォルトストレージ解決は`createJSONStorage(() => window.localStorage)`であり、
  `createJSONStorage`内部で`getStorage()`の呼び出しが`try`/`catch`で保護されている。
- 本プロジェクトの`rsc`/`ssr`Vite Environment(いずれもworkerd上で実行される)には`window`という
  グローバル変数自体が存在しないため、`window.localStorage`の参照は`ReferenceError`を送出し、
  上記の`try`/`catch`に捕捉されて`storage`は`undefined`になる。
- `persistImpl`は`storage`が`falsy`の場合、`hydrate()`を一切呼び出さずに早期リターンする。
  したがって`onRehydrateStorage`コールバックも実行されず、ストアはデフォルト値
  (`theme: "system"`)のまま、DOM APIには一切触れない。

この結果、`useTheme`および`resolveSystemTheme`/`applyThemeClass`は、`typeof window`チェックや
`browser()`/`use()`/`<Suspense>`を実装側に書かなくても、サーバー(workerd)側では自動的に
「何もしない」状態にフォールバックすることが、ライブラリの実装として保証されている。

## 決定

1. **`useTheme`ストアには、`browser()`/`use()`/`<Suspense>`によるブラウザ限定化を行わない。**
   zustandの`persist`ミドルウェアが`window`未定義環境で自動的に永続化なしへフォールバックする
   ことをソースコードで確認済みであり、追加のガードは不要と判断した。
2. **`resolveSystemTheme`/`applyThemeClass`は`window.*`に直接アクセスし、`typeof window`
   チェックを行わない。** これらの関数は`setTheme`(ユーザーのクリック操作からのみ呼ばれる)と
   `onRehydrateStorage`の返り値コールバック(決定1の理由により、`hydrate()`が実際に実行される
   ブラウザ環境でのみ呼ばれる)からのみ到達可能であり、サーバー側から呼ばれる経路が存在しない
   ため。
3. **`src/app/AppClient.tsx`は`useTheme()`を呼び出す。** `theme-provider.tsx`は"use client"
   モジュールであり、クライアントバンドルの評価対象(ストア生成・`hydrate()`実行)に含まれる
   ためには、いずれかのClient Componentから実際にimport・参照される必要がある(ADR 0009 §9の
   「Client Component境界の内側」という考え方と同じ、RSCのモジュール到達可能性の仕組みに
   基づく)。現時点でテーマ切り替えUI自体は未実装だが、ストアの初期化(localStorageからの
   復元とDOMクラスの適用)を発火させるため、`AppClient`から呼び出す形にした。

## 検討した代替案

- **`NotificationsSocket`と同様に`use(browser(...))` + `<Suspense>`でラップする案**: 決定1の
  理由により、`persist`ミドルウェア自体がSSR環境で安全にフォールバックすることがソースコードで
  確認できており、追加のガードを設けても挙動は変わらない。無駄な複雑性を持ち込むだけのため
  採用しなかった。
- **`typeof window !== "undefined"`で明示的に分岐する案**: `AGENTS.md`で明示的に禁止されている
  パターンであり、かつ決定1の通りライブラリ側で同等の保護が既に行われているため不要。

## 影響 (Consequences)

- テーマ関連のブラウザ専用コードは、ADR 0009 §10で確立した`browser()`/`use()`パターンとは
  異なる経路(ライブラリのSSR安全機構)で保護される。今後同種の「ライブラリ自身がwindow未定義
  環境を吸収する」ケースに遭遇した場合、都度ソースコードで挙動を確認した上で、同様に明示的
  ガードを省略してよい。
- `theme-provider.tsx`および`AppClient.tsx`にはこの経緯を説明するコード内コメントを置かず、
  本ADRのみに記録する。
