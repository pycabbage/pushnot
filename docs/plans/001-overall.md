# 全体的な設計

## Motivation

- AIエージェントの作業完了通知は、各製品それぞれ複数の経路で送信される
- WSL→Windows通知など、各製品の通知経路はそれぞれ独自の弱点がある
- 登録済みのブラウザへプッシュ通知を送信するWorkers+DO製品があれば、これらの問題を解決できる
  - だいたいのAIエージェントはHooksやプラグインなどで作業完了時に実行するコマンドなどを指定できるため

## Limitation

- 認証なし: ページを開いた時点で匿名セッションが作成される
- UIコンポーネントはすべてshadcn/uiコンポーネントを使用する。自前実装は行わない。

## Architecture

- Workers + Durable Objectsを用いたプッシュ通知システム
- DOは各セッションごとに作成される
- `/api/register` → DO `register()` → `subscriber` テーブルに登録
- `/api/push/<session_id>` → DO `push()` → `subscriber` テーブルにあるクライアントに通知を送信
  - curlコマンドによって送信され、このエンドポイントは認証をバイパスします。
- ページを開いたときクライアントを作成し、JWT発行・cookieに保存
