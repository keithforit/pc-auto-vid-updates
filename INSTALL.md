# 🎬 Video Generator — Install Guide / インストールガイド

*English first, 日本語は下にあります。*

---

## English

### 1. What you need first (one-time)

| Tool | Why | Where |
|---|---|---|
| **Node.js LTS** (v18 or newer) | Runs the app | https://nodejs.org → big green "LTS" button |
| **ffmpeg** | Reads & processes video files | Mac: `brew install ffmpeg` · Windows: `winget install ffmpeg` (then restart the terminal) |
| **VOICEVOX** | Generates the narration voices | https://voicevox.hiroshiba.jp (run it before generating videos) |

> You also need the **two API keys** (Pexels and Pixabay) given to you by your administrator. Keep them somewhere handy — the app asks for them once during setup.

### 2. Install

1. **Download** the zip from the link your administrator shared.
2. **Unzip it** into any folder you like (for example a folder on your Desktop).
3. Open a **terminal in that folder**:
   - Mac: right-click the folder → *New Terminal at Folder* (or drag the folder onto Terminal)
   - Windows: open the folder, click the address bar, type `cmd`, press Enter
4. Type:
   ```
   npm install
   npm run factory
   ```
5. Your browser opens automatically at `http://localhost:3000`.

### 3. First-run setup

The app greets you with a short setup:
1. **Welcome** → click *"Yes, let's get started"*
2. Enter **your name**
3. Paste the **Pexels** and **Pixabay** API keys → *Verify & continue* (the app checks they really work)
4. 🎉 Confetti — you're done. Your name and keys are saved on your computer only (`UserConfig.json`).

### 4. Day-to-day

- Start the app any time with `npm run factory` from the install folder.
- Start **VOICEVOX** first when you plan to generate voices.
- Updates: the app checks for updates automatically and offers them in the dashboard.

### 5. Security notes

- The dashboard runs **only on your own computer** (`localhost`) — nobody on your network can reach it.
- Your API keys live in `UserConfig.json` inside the install folder. Don't share that file.
- The first launch may show an OS warning ("app from the internet") — that's normal for unsigned tools; choose Allow/Run.

---

## 日本語

### 1. 最初に必要なもの（初回のみ）

| ツール | 用途 | 入手先 |
|---|---|---|
| **Node.js LTS**（v18以上） | アプリの実行 | https://nodejs.org → 緑の「LTS」ボタン |
| **ffmpeg** | 動画ファイルの読み込み・処理 | Mac: `brew install ffmpeg` · Windows: `winget install ffmpeg`（実行後ターミナルを再起動） |
| **VOICEVOX** | ナレーション音声の生成 | https://voicevox.hiroshiba.jp （動画生成の前に起動しておく） |

> 管理者から渡された **2つのAPIキー**（Pexels と Pixabay）も必要です。セットアップ時に一度だけ入力します。

### 2. インストール

1. 共有されたリンクから zip を**ダウンロード**します。
2. 好きなフォルダ（例：デスクトップのフォルダ）に**解凍**します。
3. そのフォルダで**ターミナルを開きます**：
   - Mac: フォルダを右クリック → 「フォルダに新規ターミナル」
   - Windows: フォルダを開き、アドレスバーに `cmd` と入力して Enter
4. 次のコマンドを入力：
   ```
   npm install
   npm run factory
   ```
5. ブラウザが自動的に `http://localhost:3000` を開きます。

### 3. 初回セットアップ

アプリが短いセットアップを案内します：
1. **ようこそ画面** → 「はい、始めましょう」をクリック
2. **お名前**を入力
3. **Pexels** と **Pixabay** のAPIキーを貼り付け → 「確認して続ける」（キーが本当に使えるかチェックします）
4. 🎉 紙吹雪が出たら完了。名前とキーはあなたのPCの中だけに保存されます（`UserConfig.json`）。

### 4. ふだんの使い方

- インストールフォルダから `npm run factory` でいつでも起動できます。
- 音声を生成する日は先に **VOICEVOX** を起動してください。
- アップデート：アプリが自動で更新を確認し、ダッシュボードに表示します。

### 5. セキュリティについて

- ダッシュボードは**自分のPCの中だけ**（`localhost`）で動きます。ネットワーク上の他人はアクセスできません。
- APIキーはインストールフォルダ内の `UserConfig.json` に保存されます。このファイルは共有しないでください。
- 初回起動時にOSの警告（「インターネットから入手したアプリ」）が出ることがありますが、署名のないツールでは通常のことです。「許可 / 実行」を選んでください。
