# XDGAME 游戏评分助手

在 [XDGAME](https://www.xdgame.com/) 游戏列表中直接显示小黑盒评分、Steam 全语言好评率、评价人数和当前在线人数的 Tampermonkey 用户脚本。

[简体中文](#简体中文) · [English](#english) · [日本語](#日本語)

---

## 简体中文

### 一键安装

## [🚀 点击这里安装脚本](https://github.com/Jabami-Yumek0/xdgame-ratings/raw/refs/heads/main/xdgame-ratings.user.js)

> 请先安装 [Tampermonkey](https://www.tampermonkey.net/)。点击上面的链接后，Tampermonkey 应当自动打开安装页面。

如果没有弹出安装页面，请下载仓库根目录中的 `xdgame-ratings.user.js`，然后在 Tampermonkey 中选择“添加新脚本”，粘贴全部内容并保存。

### 功能展示
<img width="1389" height="854" alt="image" src="https://github.com/user-attachments/assets/117ea6f8-2e55-4be5-8b7c-d8e16c60d663" />


脚本会在 XDGAME 的每个游戏卡片中增加三项数据：

| 卡片 | 显示内容 | 数据来源 |
| --- | --- | --- |
| Steam | Steam 图标、全语言好评率、评价人数 | 小黑盒“全语言好评率”页面 |
| 小黑盒 | 小黑盒图标、评分、评价人数 | 小黑盒游戏详情页 |
| 当前在线 | 在线图标、当前在线人数 | 小黑盒游戏详情页 |

示例布局：

| Steam | 小黑盒 | 当前在线 |
| :---: | :---: | :---: |
| 🎮 **52%** | **4.7** | 👥 **1.8万** |
| 32.9万人评价 | 1.6万人评价 | 当前在线 |

### 主要特点

- 自动识别 XDGAME 游戏卡片中的 Steam AppID。
- Steam 卡片使用固定蓝色背景，不随好评率改变颜色。
- Steam 好评率来自小黑盒的“全语言好评率”，不直接请求 Steam。
- 小黑盒评分卡片仿照小黑盒官方的上下两层布局。
- 小黑盒没有评分时，自动改为粉红色心愿单卡片并显示想玩人数。
- 显示小黑盒页面中的当前在线人数。
- 支持动态加载的游戏卡片。
- 最多同时处理 4 个游戏，降低页面卡顿和请求压力。
- 数据缓存 15 分钟，可在 Tampermonkey 菜单中手动清除。
- Steam、小黑盒和当前在线卡片均可分别关闭。

### 小黑盒评分颜色

评分卡片按照小黑盒当前使用的分档显示颜色：

| 评分 | 颜色 |
| --- | --- |
| 9.0–10.0 | 橙色渐变 |
| 7.0–8.9 | 紫色渐变 |
| 5.0–6.9 | 蓝色渐变 |
| 0–4.9 | 绿色渐变 |
| 无评分 | 粉红色心愿单样式 |

### 使用方法

1. 安装 Tampermonkey。
2. 点击[一键安装脚本](https://github.com/Jabami-Yumek0/xdgame-ratings/raw/refs/heads/main/xdgame-ratings.user.js)。
3. 在 Tampermonkey 安装页面点击“安装”。
4. 打开或刷新 [XDGAME 游戏列表](https://www.xdgame.com/list/1/)。
5. 等待片刻，评分卡片会显示在游戏名称与原页面信息之间。

如果更新后仍显示旧数据，可以点击 Tampermonkey 图标，在脚本菜单中选择“清除数据缓存并刷新”。

### 权限与隐私

- 脚本只在 `xdgame.com` 及其子域名运行。
- 脚本只向 `api.xiaoheihe.cn` 请求公开游戏数据。
- 脚本不会读取密码、Cookie、浏览记录或账号信息。
- 为满足小黑盒公开接口的请求格式，脚本会在 Tampermonkey 本地存储中生成一个随机设备标识；该标识不会被本项目作者收集。
- 评分和在线数据会暂存在 Tampermonkey 本地存储中，默认缓存 15 分钟。

### 兼容性

- Tampermonkey
- Chrome / Edge / Firefox 等支持 Tampermonkey 的现代浏览器
- XDGAME 列表页面及包含相同游戏卡片结构的页面

### 免责声明

本项目是非官方、非商业的第三方用户脚本，与 XDGAME、Steam、Valve、小黑盒及其运营方不存在隶属、合作、授权或背书关系。

游戏评分、评价人数、心愿单和在线人数来自第三方页面或接口，可能存在延迟、缺失、不准确或随时变更的情况。由于目标网站页面结构、接口或访问规则发生变化，脚本可能暂时或永久失效。作者不保证数据的准确性、完整性、实时性、持续可用性或对任何用途的适用性。

使用者应自行遵守所在地法律以及相关网站的服务条款，并自行承担安装和使用本脚本产生的风险。作者不对数据错误、页面异常、账号限制、服务中断或任何直接、间接损失承担责任。所有商标、名称和图标均归其各自权利人所有。

---

## English

### One-click installation

## [🚀 Install the userscript](https://github.com/Jabami-Yumek0/xdgame-ratings/raw/refs/heads/main/xdgame-ratings.user.js)

> Install [Tampermonkey](https://www.tampermonkey.net/) first. Opening the link above should launch Tampermonkey's installation page automatically.

If the installation page does not appear, download `xdgame-ratings.user.js` from the repository root, create a new userscript in Tampermonkey, paste the complete file, and save it.

### What it does

The script adds three data cards to every game entry on XDGAME:

| Card | Information | Source |
| --- | --- | --- |
| Steam | Steam icon, all-language positive rate, and review count | Xiaoheihe all-language rating page |
| Xiaoheihe | Xiaoheihe icon, score, and rating count | Xiaoheihe game detail page |
| Players online | Online icon and current player count | Xiaoheihe game detail page |

Example layout:

| Steam | Xiaoheihe | Online |
| :---: | :---: | :---: |
| 🎮 **52%** | **4.7** | 👥 **18K** |
| 328.5K reviews | 15.8K ratings | Online now |

### Features

- Detects the Steam AppID automatically from each XDGAME game card.
- Uses a fixed blue background for the Steam card, independent of its rating.
- Uses Xiaoheihe's all-language positive rate instead of requesting Steam directly.
- Recreates Xiaoheihe's two-level score-card layout.
- Falls back to a pink wishlist card when no Xiaoheihe score is available.
- Displays the current player count reported on Xiaoheihe.
- Supports dynamically loaded game cards.
- Processes up to four games concurrently to reduce page lag and request pressure.
- Caches data for 15 minutes and provides a manual cache-clear menu command.
- Allows the Steam, Xiaoheihe, and online cards to be enabled or disabled separately.

### Xiaoheihe score colors

| Score | Color |
| --- | --- |
| 9.0–10.0 | Orange gradient |
| 7.0–8.9 | Purple gradient |
| 5.0–6.9 | Blue gradient |
| 0–4.9 | Green gradient |
| No score | Pink wishlist style |

### Usage

1. Install Tampermonkey.
2. Open the [one-click installation link](https://github.com/Jabami-Yumek0/xdgame-ratings/raw/refs/heads/main/xdgame-ratings.user.js).
3. Select **Install** on the Tampermonkey page.
4. Open or refresh the [XDGAME game list](https://www.xdgame.com/list/1/).
5. Wait briefly for the rating cards to appear between the game title and the original game information.

If old data remains after an update, open the script menu from Tampermonkey and select the command that clears the data cache and reloads the page.

### Permissions and privacy

- Runs only on `xdgame.com` and its subdomains.
- Requests public game information only from `api.xiaoheihe.cn`.
- Does not read passwords, cookies, browsing history, or account information.
- Generates a random device identifier in Tampermonkey's local storage to satisfy the public API request format. The project author does not collect this identifier.
- Rating and player data are cached locally by Tampermonkey for 15 minutes.

### Compatibility

- Tampermonkey
- Modern browsers that support Tampermonkey, including Chrome, Edge, and Firefox
- XDGAME list pages and pages using the same game-card structure

### Disclaimer

This is an unofficial, non-commercial third-party userscript. It is not affiliated with, authorized by, sponsored by, or endorsed by XDGAME, Steam, Valve, Xiaoheihe, or their operators.

Scores, review counts, wishlist numbers, and online player counts come from third-party pages or interfaces and may be delayed, incomplete, inaccurate, or changed without notice. Changes to the target websites, page structures, APIs, or access policies may temporarily or permanently break the script. No warranty is provided regarding accuracy, completeness, timeliness, availability, or fitness for any purpose.

Users are responsible for complying with applicable laws and the terms of service of the relevant websites, and they use this script at their own risk. The author is not liable for incorrect data, page errors, account restrictions, service interruptions, or any direct or indirect loss. All trademarks, names, and icons belong to their respective owners.

---

## 日本語

### ワンクリックインストール

## [🚀 ユーザースクリプトをインストール](https://github.com/Jabami-Yumek0/xdgame-ratings/raw/refs/heads/main/xdgame-ratings.user.js)

> 先に [Tampermonkey](https://www.tampermonkey.net/) をインストールしてください。上のリンクを開くと、通常は Tampermonkey のインストール画面が自動的に表示されます。

インストール画面が表示されない場合は、リポジトリ直下の `xdgame-ratings.user.js` をダウンロードし、Tampermonkey で新しいスクリプトを作成して、ファイルの内容をすべて貼り付けて保存してください。

### 機能

XDGAME の各ゲームカードに、次の3種類の情報カードを追加します。

| カード | 表示内容 | データ取得元 |
| --- | --- | --- |
| Steam | Steamアイコン、全言語の好評率、レビュー件数 | 小黒盒の全言語好評率ページ |
| 小黒盒 | 小黒盒アイコン、スコア、評価人数 | 小黒盒のゲーム詳細ページ |
| 現在オンライン | オンラインアイコン、現在のプレイヤー数 | 小黒盒のゲーム詳細ページ |

表示例：

| Steam | 小黒盒 | 現在オンライン |
| :---: | :---: | :---: |
| 🎮 **52%** | **4.7** | 👥 **1.8万** |
| 32.9万人レビュー | 1.6万人評価 | 現在オンライン |

### 主な特徴

- XDGAME のゲームカードから Steam AppID を自動認識します。
- Steam カードは評価に関係なく固定の青い背景を使用します。
- Steam に直接アクセスせず、小黒盒の「全言語好評率」を使用します。
- 小黒盒公式に近い上下2段のスコアカードを表示します。
- 小黒盒スコアがない場合は、ピンク色のウィッシュリストカードと希望者数を表示します。
- 小黒盒に表示される現在のオンライン人数を追加します。
- 動的に読み込まれたゲームカードにも対応します。
- ページ負荷とリクエスト数を抑えるため、同時処理は最大4ゲームです。
- データを15分間キャッシュし、メニューから手動で削除できます。
- Steam、小黒盒、現在オンラインの各カードを個別に有効・無効にできます。

### 小黒盒スコアの色分け

| スコア | 色 |
| --- | --- |
| 9.0–10.0 | オレンジのグラデーション |
| 7.0–8.9 | 紫のグラデーション |
| 5.0–6.9 | 青のグラデーション |
| 0–4.9 | 緑のグラデーション |
| スコアなし | ピンクのウィッシュリスト表示 |

### 使い方

1. Tampermonkey をインストールします。
2. [ワンクリックインストール](https://github.com/Jabami-Yumek0/xdgame-ratings/raw/refs/heads/main/xdgame-ratings.user.js)を開きます。
3. Tampermonkey の画面で「インストール」を選択します。
4. [XDGAME ゲーム一覧](https://www.xdgame.com/list/1/)を開くか、ページを再読み込みします。
5. ゲーム名と元のゲーム情報の間にカードが表示されるまで少し待ちます。

更新後も古いデータが残る場合は、Tampermonkey のスクリプトメニューからデータキャッシュを削除してページを再読み込みしてください。

### 権限とプライバシー

- `xdgame.com` とそのサブドメインでのみ動作します。
- `api.xiaoheihe.cn` の公開ゲーム情報のみを取得します。
- パスワード、Cookie、閲覧履歴、アカウント情報は読み取りません。
- 公開APIのリクエスト形式に対応するため、Tampermonkey のローカルストレージにランダムな端末識別子を生成します。この識別子をプロジェクト作者が収集することはありません。
- 評価とオンライン人数は Tampermonkey のローカルストレージに15分間キャッシュされます。

### 対応環境

- Tampermonkey
- Chrome、Edge、Firefox など、Tampermonkey に対応するモダンブラウザ
- XDGAME の一覧ページ、および同じゲームカード構造を使用するページ

### 免責事項

本プロジェクトは非公式・非営利の第三者ユーザースクリプトです。XDGAME、Steam、Valve、小黒盒および各運営会社との提携、協力、許可、後援関係はありません。

ゲームスコア、レビュー件数、ウィッシュリスト数、オンライン人数は第三者のページまたはインターフェースから取得しており、遅延、欠落、誤差、予告のない変更が発生する場合があります。対象サイトの構造、API、アクセス方針の変更により、本スクリプトが一時的または恒久的に動作しなくなる可能性があります。データの正確性、完全性、即時性、継続的な利用可能性、特定目的への適合性は保証されません。

利用者は、適用される法律および関連サイトの利用規約を自ら確認し、自己責任で本スクリプトを使用してください。作者は、誤ったデータ、ページの不具合、アカウント制限、サービス停止、その他の直接的・間接的損害について責任を負いません。すべての商標、名称、アイコンは各権利者に帰属します。

---

## License

Released under the [MIT License](./LICENSE).
