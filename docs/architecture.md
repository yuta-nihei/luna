# architecture.md

# Luna Architecture

## 概要

Lunaは以下の設計原則に基づいて構築する。

* UIとロジックを分離する
* シンプルな構造を維持する
* 将来的な機能追加を容易にする
* 高速起動を最優先する
* モジュール単位で責務を明確にする

---

# システム構成

```text
┌─────────────────────────────┐
│         React UI            │
├─────────────────────────────┤
│       Command Layer         │
├─────────────────────────────┤
│         Core Layer          │
├─────────────────────────────┤
│      Infrastructure         │
└─────────────────────────────┘
```

---

# レイヤー構成

## UI Layer

責務

* 描画
* ユーザー操作
* ショートカット
* テーマ
* パネル管理

含まれる機能

```text
Editor
Left Palette
Command Palette
Terminal Panel
Settings
Workspace View
```

UIは状態を持ちすぎない。

ビジネスロジックを実装しない。

---

## Command Layer

Lunaの中心レイヤー。

すべての操作はCommandとして扱う。

例

```text
OpenFile
SaveFile
SearchProject
GitPull
RunTerminalCommand
OpenSettings
```

UIはCommandを呼び出すだけにする。

---

## Core Layer

責務

```text
FileSystem
Search
Git
Workspace
Terminal
AI
Basket
```

アプリケーションの主要ロジックを担当する。

UIに依存しない。

---

## Infrastructure Layer

OSとの接続部分。

責務

```text
File Access
Git Process
Terminal Process
Secure Storage
HTTP Client
```

Tauri APIとGo側の橋渡しを担当する。

---

# ディレクトリ構成

```text
luna/

├── apps/
│
├── src/
│   ├── ui/
│   ├── commands/
│   ├── core/
│   ├── services/
│   ├── hooks/
│   ├── store/
│   ├── themes/
│   └── types/
│
├── backend/
│   ├── filesystem/
│   ├── git/
│   ├── terminal/
│   ├── workspace/
│   └── basket/
│
├── docs/
│
└── tests/
```

---

# Core Modules

## FileSystem Module

責務

* ファイル読み込み
* ファイル保存
* フォルダ監視
* パス管理

---

## Search Module

責務

* ファイル検索
* 全文検索

採用

```text
ripgrep
```

---

## Terminal Module

責務

* ターミナル生成
* プロセス管理
* 出力取得

対応

```text
bash
zsh
PowerShell
cmd
```

---

## Git Module

責務

* Status
* Commit
* Push
* Pull

将来的に

* Branch
* Diff
* Merge

へ拡張する。

---

## Workspace Module

責務

* プロジェクト管理
* 最近開いたプロジェクト
* セッション復元

---

## Basket Module

責務

* メモ保存
* URL保存
* コード保存
* Markdown保存

将来的に同期対応。

---

## AI Module

責務

* API通信
* プロンプト生成
* モデル管理

対応予定

```text
OpenAI
Anthropic
Gemini
OpenRouter
```

---

# 状態管理

## 原則

状態は最小限にする。

---

## グローバル状態

保持するもの

```text
Theme
Workspace
Settings
User Preferences
```

---

## ローカル状態

保持するもの

```text
Modal
Input
Temporary UI State
```

---

# イベントフロー

## ファイル保存

```text
UI
 ↓
Command
 ↓
FileSystem Service
 ↓
OS
```

---

## Git Pull

```text
UI
 ↓
Command
 ↓
Git Service
 ↓
Git Process
```

---

## AIアクション

```text
UI
 ↓
Command
 ↓
AI Service
 ↓
Provider API
```

---

# 左パレット設計

## 概要

Luna独自機能。

ユーザー定義アクションを管理する。

---

## データ構造

```json
{
  "id": "git-pull",
  "label": "Git Pull",
  "icon": "git",
  "type": "command",
  "value": "git pull"
}
```

---

## 対応タイプ

```text
command
url
ai
workflow
terminal
```

---

# ワークフロー

将来的に複数アクションを連結可能にする。

例

```text
Git Pull
↓
pnpm install
↓
pnpm dev
```

---

# 設定管理

保存場所

```text
~/.luna/
```

---

## 管理ファイル

```text
settings.json
palette.json
workspace.json
theme.json
```

---

# パフォーマンス戦略

## 起動

必要な機能のみロードする。

Lazy Loadを利用する。

---

## 検索

インデックスを保持しない。

ripgrepを利用する。

---

## メモリ

不要なキャッシュを持たない。

---

# セキュリティ

APIキーはOSのセキュアストレージへ保存する。

対応

```text
Windows Credential Manager
macOS Keychain
Secret Service
```

---

# 将来拡張

## Plugin System

独立プロセスで実行する。

本体を停止させない。

---

## Marketplace

プラグイン配布機能。

---

## Cloud Sync

設定同期

Basket同期

ワークスペース同期

---

# 設計方針

実装時は以下を優先する。

1. シンプル
2. 高速
3. 保守性
4. 拡張性
5. 再利用性

複雑な設計よりも理解しやすい設計を選択する。
