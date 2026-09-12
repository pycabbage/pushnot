# 0012. push.tsのイベント判別で `as const` を例外的に許容する

## ステータス

Accepted (2026-09-13)

## コンテキスト

`src/api/push.ts` の `pushSchema`(`z.codec`)は、`defaultPushSchema` /
`ccStopSchema` / `codexStopSchema` のいずれかを受け取り、`decode`関数内で
`type: "default" | "cc" | "codex"` という判別可能なUnion型のオブジェクトへ
変換する。各分岐では `type: "codex" as const` のように const assertion を
使い、`type` プロパティをリテラル型として確定させている。

自動レビューにより、この `as const` が `AGENTS.md` の「型アサーション
(as構文など)は禁止」への違反として指摘され、一度は以下の修正を行った。

- `z.union([...])` の出力スキーマを `pushEventSchema` という変数に切り出す。
- `decode` 関数に `z.input<typeof pushEventSchema>` という明示的な戻り値
  型注釈を付け、TypeScriptのcontextual typingにより `as const` なしで
  `type` プロパティをリテラル型として確定させる。

この修正はいずれも型チェック(`pnpm tsc --noEmit`)を通過することを確認
済みだったが、プロジェクトオーナーから、この方式は
`AGENTS.md` の別の規約「ライブラリが提供する型を自前で書き写さないこと」
への違反になるという指摘を受けた。`z.codec` は、本来 `decode` の引数・
戻り値の型を呼び出し側のコンテキストから自動推論する設計になっており、
`z.input<typeof pushEventSchema>` という戻り値型注釈を関数の外から
明示的に書き下すことは、ライブラリ(zod)側の型推論に委ねるべき型を
手動で再現・複製する行為に当たる。

「型アサーション禁止」と「ライブラリ型の手書き複製禁止」という2つの
規約が同時には満たせない箇所であり、プロジェクトオーナーはこの3箇所に
限り前者(型アサーション禁止)の例外として `as const` を維持することを
明示的に選択した。

## 決定

1. **`src/api/push.ts` の `pushSchema` の `decode` 関数内、判別可能な
   Union型のリテラルを確定させるための `as const`(`"codex"` /
   `"cc"` / `"default"` の3箇所)を、型アサーション禁止規約の例外として
   許容する。**
2. **`decode` 関数へ戻り値型注釈(`z.input<typeof ...>`)を明示的に書く
   方式は採用しない。** `pushEventSchema` という変数への切り出しも
   行わず、出力スキーマは `z.codec` の第二引数としてインラインで
   記述したままにする。
3. **自動レビュー・静的解析等が今後この3箇所を指摘した場合も、この
   ADR を根拠に対応不要と判断してよい。実装を変更するのは、
   プロジェクトオーナー本人が明示的に指示した場合のみに限る。**

## 検討した代替案

- **`decode` 関数に明示的な戻り値型注釈(`z.input<typeof
pushEventSchema>`)を付け、`as const` を排除する案**: 一度実装し、
  型チェックの通過も確認したが、「ライブラリが提供する型を自前で
  書き写さないこと」への違反に当たるとしてプロジェクトオーナーにより
  差し戻された。

## 影響 (Consequences)

- `push.ts` には型アサーション(`as const`)が3箇所存在し続ける。
- `pushSchema` の出力スキーマ定義は `z.codec` 呼び出し内にインラインの
  ままであり、`decode` の戻り値型はzodのライブラリ側推論(`as const`に
  よるリテラル型の確定)にのみ依存する。
