import type { Catalog } from '../index';

/**
 * Japanese. Glossary (keep these choices when adding keys):
 * board = ボード, node = ノード, wire / connection = 接続 (verb: 接続する), run = 実行 (verb: 実行する),
 * credits = クレジット ("{count} クレジット", space before the word), Stage = ステージ,
 * Packshot = パックショット, Ad video = 広告動画, Export = エクスポート, Simulation = シミュレーション,
 * simulator = シミュレーター, Starter = スターター, template = テンプレート, preset = プリセット,
 * look = ルック, motion = モーション, version = バージョン ("v{n}" stays), current version = 使用中,
 * Annie = Annie, canvas = キャンバス, scene = シーン, 3D model = 3Dモデル, headline = 見出し,
 * direction (Stage prompt) = 演出指示, region = 領域, face = 面, triangle = 三角形, detail = 精細度,
 * draft / standard / high = ドラフト / 標準 / 高精細, angle = アングル, aspect = アスペクト比,
 * sign in / out = ログイン / ログアウト, share = 共有 (TikTok mock: シェア), link = リンク,
 * turn off / revoke a link = リンクを無効にする, refund = 払い戻し, cached = キャッシュ済み,
 * check / quality gate = チェック / 品質チェック, agent = エージェント, workspace = ワークスペース,
 * process reel = メイキングリール, sticker = スタンプ, showroom = ショールーム, phone = スマートフォン
 * (short: スマホ), line of nodes = フロー, undo / redo = 取り消す / やり直す, paste = ペースト,
 * lasso = なげなわ, plan names = フリー / クリエイター / スタジオ.
 * Style: です/ます in sentences, noun phrases on buttons, full-width 、。「」（）：, counters without a space
 * ("{count}個", "{count}件"), units with a space ("{size} MB", "{texture} px").
 */
const catalog: Catalog = {
  // Words used across the product.
  'common.credits': { other: '{count} クレジット' },
  'common.cancel': 'キャンセル',
  'common.close': '閉じる',
  'common.save': '保存',
  'common.done': '完了',
  'common.retry': '再試行',
  'common.language': '言語',
  'common.brand': 'Annie 3D',

  // Names from packages/contracts (node kinds, ports, presets, starters).
  'node.photo': '写真',
  'node.text': 'テキスト',
  'node.upload3d': '3Dアップロード',
  'node.audio': '音楽',
  'node.model3d': '3Dモデル',
  'node.stage': 'ステージ',
  'node.packshot': 'パックショット',
  'node.adVideo': '広告動画',
  'node.export': 'エクスポート',
  'node.simulation': 'シミュレーション',
  'node.note': 'メモ',

  'engine.photo': 'アップロード',
  'engine.text': 'テキスト',
  'engine.upload3d': 'アップロード',
  'engine.audio': 'アップロード',
  'engine.model3d': 'ビルダー',
  'engine.stage': 'シーンディレクター',
  'engine.packshot': 'レンダラー',
  'engine.adVideo': 'レンダラー',
  'engine.export': 'パッケージャー',
  'engine.simulation': 'ライブプレビュー',
  'engine.note': 'メモ',

  'category.input': '入力',
  'category.build': 'ビルド',
  'category.stage': 'ステージ',
  'category.output': '出力',
  'category.note': 'メモ',

  'port.photo.out': '画像',
  'port.text.out': 'テキスト',
  'port.upload3d.out': '3Dモデル',
  'port.audio.out': 'オーディオ',
  'port.model3d.images': '写真',
  'port.model3d.prompt': '説明',
  'port.model3d.out': '3Dモデル',
  'port.stage.model': '3Dモデル',
  'port.stage.prompt': '演出指示',
  'port.stage.style': 'スタイル参照',
  'port.stage.out': 'シーン',
  'port.packshot.subject': 'モデルまたはシーン',
  'port.packshot.out': '画像',
  'port.adVideo.subject': 'シーンまたはモデル',
  'port.adVideo.headline': '見出し',
  'port.adVideo.logo': 'ロゴ',
  'port.adVideo.music': '音楽',
  'port.adVideo.out': '動画',
  'port.export.items': '出力',
  'port.export.out': 'ファイル',
  'port.simulation.subject': 'モデルまたはシーン',
  'port.simulation.headline': '見出し',
  'port.simulation.logo': 'ロゴ',

  'portType.image': '画像',
  'portType.text': 'テキスト',
  'portType.model3d': '3Dモデル',
  'portType.scene': 'シーン',
  'portType.video': '動画',
  'portType.audio': 'オーディオ',
  'portType.file': 'ファイル',

  'look.studio-light': 'スタジオライト',
  'look.dark-lab': 'ダークラボ',
  'look.stone-water': '石と水',
  'look.velvet': 'ベルベット',
  'look.splash-pastel': 'パステルスプラッシュ',
  'look.podium-botanical': '台座とボタニカル',

  'motion.turntable': 'ターンテーブル',
  'motion.hero-orbit': 'ヒーローオービット',
  'motion.teardown-reveal': '分解リビール',
  'motion.stone-water': '石と水',
  'motion.splash-hero': 'スプラッシュヒーロー',

  'glbPreset.web': 'Web／ストア',
  'glbPreset.google_merchant': 'Google Merchant',
  'glbPreset.google_swirl': 'Google Swirl',

  'simEnv.shop': '商品ページ',
  'simEnv.tiktok': 'TikTok',
  'simEnv.sticker': 'スタンプ',
  'simEnv.showroom': 'ショールーム',

  'starter.teardown-reveal.title': '分解リビール',
  'starter.teardown-reveal.vertical': '家電・ガジェット',
  'starter.teardown-reveal.description': '製品が一層ずつ分解し、一瞬止まってから、ぴたりと元に戻ります。',
  'starter.teardown-reveal.headline': 'ネジ1本まで、妥協なし。',
  'starter.stone-water.title': '石と水',
  'starter.stone-water.vertical': 'ジュエリー',
  'starter.stone-water.description':
    '細い滝のそば、濡れた石の上にジュエリーを置き、ゆっくり寄りながら輝きを捉えます。',
  'starter.stone-water.headline': '目を惹くために生まれた。',
  'starter.splash-hero.title': 'スプラッシュヒーロー',
  'starter.splash-hero.vertical': 'ビューティー',
  'starter.splash-hero.description': 'ボトルが同じ色のしぶきの中から現れ、台座の上に収まります。',
  'starter.splash-hero.headline': '新処方、誕生。',
  'starter.node.photo': '製品写真',
  'starter.node.headline': '見出し',
  'starter.node.pack': 'パックショット',

  'setting.simulation.cta': '今すぐ購入',

  // App shell (App.tsx): loading splash, lazy overlays, checkout return.
  'app.canvas': 'ボードのキャンバス',
  'app.loading': 'ボードを読み込み中…',
  'app.docAccess': '{name}を開く',
  'app.opening3d': '3Dを開いています…',
  'app.openingSimulator': 'シミュレーターを開いています…',
  'app.error3d': '3Dビューを開始できませんでした：{message}',
  'app.checkoutDone': 'お支払いが完了しました。クレジットを追加しました。',
  'app.board.firstTitle': 'はじめてのボード',

  // Top bar: logo, title, save state.
  'topbar.home': 'Annie 3Dホーム',
  'topbar.title': 'ボードのタイトル',
  'topbar.save.saved': '保存済み',
  'topbar.save.saving': '保存中…',
  'topbar.save.offline': 'オフライン（後で同期）',
  'topbar.save.error': '再試行中…',
  'topbar.save.edited': '編集済み',
  'topbar.save.notSaved': '未保存',
  'topbar.save.noFile': 'まだファイルに保存されていません',
  'topbar.save.guest': 'このブラウザに保存済み',
  'topbar.save.guestHint': 'ログインするとアカウントに保存できます',

  // Top bar: board file ("…") menu.
  'topbar.file.menu': 'ボードファイル',
  'topbar.file.save': '保存',
  'topbar.file.saveAsFile': 'ファイルとして保存…',
  'topbar.file.saveAs': '別名で保存…',
  'topbar.file.open': '開く…',
  'topbar.file.new': '新規ボードファイル',
  'topbar.file.import': 'このボードに読み込む…',
  'topbar.file.download': 'ボードをダウンロード（.annie3d）',
  'topbar.file.openFile': 'ボードファイルを開く…',

  // Top bar: templates, run all, zoom.
  'topbar.templates': 'テンプレート',
  'topbar.running': '実行中…',
  'topbar.runAll': 'すべて実行',
  'topbar.runAllHint': '変更のないノードは無料です。正確な料金は確定前に表示されます',
  'topbar.upToDate': '最新の状態',
  'topbar.zoomOut': '縮小',
  'topbar.zoomIn': '拡大',
  'topbar.zoomLevel': 'ズーム{percent}、画面に合わせる',
  'topbar.fitToScreen': '画面に合わせる（Shift+1）',

  // Top bar: account, credits, share.
  'topbar.creditsHint': 'クレジットとプラン',
  'topbar.signIn': 'ログイン',
  'topbar.share': '共有',
  'topbar.shareFile': 'ボードファイルはファイルとして共有します。.annie3dファイルそのものを送ってください。',
  'topbar.account': 'アカウント',
  'topbar.accountOf': 'アカウント：{name}',
  'topbar.creditsAndPlan': 'クレジットとプラン',
  'topbar.signOut': 'ログアウト',

  // Language picker (top bar and the file menu).
  'lang.button': '言語：{language}',

  // Bottom toolbar.
  'toolbar.label': 'キャンバスツール',
  'toolbar.select': '選択（V）',
  'toolbar.hand': 'ハンド（H）',
  'toolbar.add': '{name}を追加',
  'toolbar.moreNodes': 'その他のノード（N）',
  'toolbar.undo': '取り消す（⌘Z）',
  'toolbar.redo': 'やり直す（⇧⌘Z）',
  'toolbar.askAnnie': 'Annieに聞く',

  // Add-node palette.
  'palette.label': 'ノードを追加',
  'palette.search': 'ノードを追加…',
  'palette.searchLabel': 'ノードを検索',
  'palette.list': 'ノード',
  'palette.starters': 'スターター',
  'palette.starter': '{title}スターター',
  'palette.noMatch': '「{query}」に一致するノードはありません。',
  'palette.accepts.image': '画像を受け取るノード…',
  'palette.accepts.text': 'テキストを受け取るノード…',
  'palette.accepts.model3d': '3Dモデルを受け取るノード…',
  'palette.accepts.scene': 'シーンを受け取るノード…',
  'palette.accepts.video': '動画を受け取るノード…',
  'palette.accepts.audio': 'オーディオを受け取るノード…',
  'palette.accepts.file': 'ファイルを受け取るノード…',

  // Right-click menu on the canvas.
  'menu.canvas': 'キャンバスメニュー',
  'menu.runNode': 'このノードを実行',
  'menu.openEditor': '3Dエディタを開く',
  'menu.export': 'エクスポート／ダウンロード…',
  'menu.copy': 'コピー',
  'menu.duplicate': '複製',
  'menu.delete': '削除',
  'menu.addNode': 'ノードを追加…',
  'menu.paste': 'ここにペースト',
  'menu.duplicateSelected': { other: '選択した{count}個を複製' },
  'menu.deleteSelected': { other: '選択した{count}個を削除' },

  // Agent dock (Ask Annie).
  'agent.title': 'Annieに聞く',
  'agent.close': 'エージェントを閉じる',
  'agent.intro': 'Annieがこのボードのノード、設定、接続を変更します。Annieの編集は⌘Zで取り消せます。',
  'agent.suggestion.warmerStage': 'ステージを暖かい雰囲気にして、6秒のカットを追加',
  'agent.suggestion.fourAngles': '4アングルのパックショットを追加',
  'agent.suggestion.softerLight': '3Dモデルのライトを柔らかく',
  'agent.undoHint': '⌘Zで取り消し',
  'agent.thinking': '考え中…',
  'agent.input': 'エージェントにメッセージを送信',
  'agent.placeholder': '変更内容を入力…',
  'agent.budget': '予算',
  'agent.budgetLabel': '予算（クレジット）',
  'agent.send': '送信',
  'agent.boardEdited': 'ボードを編集しました',
  'agent.failed': '申し訳ありません。失敗しました：{message}',

  // Shared dialog words.
  'dialog.download': 'ダウンロード',

  // Billing dialog.
  'dialog.billing.title': 'クレジット',
  'dialog.billing.guest': {
    other: 'ログインすると{count} クレジットを無料で受け取れます。1回のフル実行に十分な量です。',
  },
  'dialog.billing.signIn': 'ログイン',
  'dialog.billing.balance': { other: '{balance} クレジット' },
  'dialog.billing.held': { other: '（うち{count}は実行中のジョブで確保中）' },
  'dialog.billing.plan.free': 'フリー',
  'dialog.billing.plan.creator': 'Creator',
  'dialog.billing.plan.studio': 'Studio',
  'dialog.billing.firstRunFree': {
    other: '最初の実行は無料です（{count} クレジット付き）。',
  },
  'dialog.billing.chargedOnSuccess':
    '料金は成功したステップの分だけ発生します。キャッシュ済みのステップは無料です。',
  'dialog.billing.perMonth': '/月',
  'dialog.billing.creditsPerMonth': {
    other: '毎月{count} クレジット',
  },
  'dialog.billing.openingCheckout': '決済ページを開いています…',
  'dialog.billing.addCredits': 'クレジットを追加',
  'dialog.billing.choose': '{plan} を選択',
  'dialog.billing.history': '履歴',
  'dialog.billing.reason.grantFree': '無料クレジット',
  'dialog.billing.reason.purchase': 'プランの購入',
  'dialog.billing.reason.subscription': '月間クレジット',
  'dialog.billing.reason.runReserve': '実行開始（確保）',
  'dialog.billing.reason.runSettle': '実行の課金',
  'dialog.billing.reason.runRefund': '払い戻し',
  'dialog.billing.reason.adjust': '調整',

  // Export dialog.
  'dialog.export.noNode': 'エクスポートする3Dモデルまたはエクスポートノードを選択してください。',
  'dialog.export.titleBundle': 'バンドルをエクスポート',
  'dialog.export.titleModel': '3Dモデルをエクスポート',
  'dialog.export.preset': 'プリセット',
  'dialog.export.limits': '最大{size}、三角形{triangles}個、テクスチャ{texture} px',
  'dialog.export.limitsAnimated':
    '最大{size}、三角形{triangles}個、テクスチャ{texture} px、アニメーション付き',
  'dialog.export.megabytes': '{size} MB',
  'dialog.export.includeVideo': '広告動画（MP4）',
  'dialog.export.includeImages': '画像（PNG）',
  'dialog.export.ready': '{preset}に対応',
  'dialog.export.notReady': '{preset}の条件をまだ満たしていません',
  'dialog.export.passed': '合格',
  'dialog.export.failed': '不合格',
  'dialog.export.zip': 'すべてのファイル（.zip）',
  'dialog.export.glb': 'GLBモデル',
  'dialog.export.exporting': 'エクスポート中…',
  'dialog.export.run': 'エクスポート（無料）',

  // Process reel dialog.
  'dialog.reel.button': 'メイキングリール',
  'dialog.reel.hint': '9:16の動画：上に広告、下に制作過程',
  'dialog.reel.title': 'メイキングリール',
  'dialog.reel.intro': 'ReelsやTikTok向けの9:16の動画です。上に広告、下にAnnie 3Dでの制作過程を表示します。',
  'dialog.reel.preview': 'リールのプレビュー',
  'dialog.reel.recording': '録画中… {percent}',
  'dialog.reel.saving': '保存中…',
  'dialog.reel.record': 'リールを録画',

  // Run dialog (cost before charging).
  'dialog.run.inProgress': 'このボードはすでに実行中です',
  'dialog.run.checking': '料金を確認中…',
  'dialog.run.estimateFailed': 'この実行の料金を見積もれませんでした。',
  'dialog.run.upToDate': 'すべて最新の状態です',
  'dialog.run.allCached': {
    other:
      '{count}個のノードには、現在の入力に対する結果がすでにあります。もう一度実行するには、プロンプト、設定、入力のいずれかを変更してください。',
  },
  'dialog.run.ok': 'OK',
  'dialog.run.titleOne': '{name}を実行',
  'dialog.run.titleMany': { other: '{count}個のノードを実行' },
  'dialog.run.cached': {
    other: '変更のない{count}個のノードは結果を再利用します',
  },
  'dialog.run.free': '無料',
  'dialog.run.total': '合計',
  'dialog.run.balance': { other: '残高：{count} クレジット' },
  'dialog.run.firstRunFree': '最初の実行は無料です。',
  'dialog.run.refunded': '失敗したステップは払い戻されます。',
  'dialog.run.starting': '開始中…',
  'dialog.run.run': '実行',
  'dialog.run.getCredits': 'クレジットを入手',

  // Share dialog.
  'dialog.share.copied': 'リンクをコピーしました',
  'dialog.share.copyFailed': 'コピーできませんでした。リンクを選択してコピーしてください',
  'dialog.share.revoked': 'リンクを無効にしました',
  'dialog.share.title': 'このボードを共有',
  'dialog.share.body':
    'リンクを知っている人は誰でも、広告の視聴、画像の閲覧、3Dモデルのダウンロードができます。編集はできません。',
  'dialog.share.creating': 'リンクを作成中…',
  'dialog.share.link': '共有リンク',
  'dialog.share.copy': 'コピー',
  'dialog.share.views': { other: '{count}回閲覧されました。' },
  'dialog.share.openPreview': 'プレビューを開く',
  'dialog.share.revoke': 'リンクを無効にする',

  // Shared UI primitives (packages/ui): the host app passes these in.
  'dialog.close': 'ダイアログを閉じる',
  'dialog.locked': '現在の処理が終わるまでお待ちください。',
  'dialog.dismiss': '閉じる',
  'dialog.loading': '読み込み中',

  // Sign-in prompt (guest tries a paid or cloud action).
  'signin.run.title': 'ログインして実行',
  'signin.run.body': {
    other: '最初のフル実行は無料です（{count} クレジット）。ボードはそのまま引き継がれます。',
  },
  'signin.share.title': 'ログインして共有',
  'signin.share.body': '共有リンクには保存済みのボードが必要です。ボードはそのまま引き継がれます。',
  'signin.save.title': 'ログインしてボードを保存',
  'signin.save.body': 'ゲストのボードはこのブラウザにのみ保存されます。',
  'signin.google': 'Googleで続ける',
  'signin.notNow': '後で',

  // Performance panel (developer tool, ⌥P).
  'perf.title': 'パフォーマンス',
  'perf.copied': 'パフォーマンスレポートをコピーしました',
  'perf.copy': 'レポートをコピー',
  'perf.copyHint': 'レポートをコピー（JSON）',
  'perf.close': 'パフォーマンスパネルを閉じる',
  'perf.pageLoad': 'ページの読み込み',
  'perf.network': {
    other: '{count}件のリクエスト、{kb} KB転送',
  },
  'perf.features': '機能',
  'perf.action': '操作',
  'perf.last': '最新',
  'perf.slowApis': '最も遅いAPI呼び出し',
  'perf.slowFiles': '最も遅いファイル',
  'perf.serverTime': 'Worker時間（Server-Timing）',
  'perf.server': 'srv {time}',
  'perf.ms': '{value} ms',
  'perf.seconds': '{value}秒',
  'perf.budget': '≤ {value}',
  'perf.foot':
    'このブラウザで計測しています。目標値：Core Web Vitals（web.dev）、RAIL、Nielsenの応答時間の限界。タブを離れると、同じ数値がサーバーに送信されます。',
  'perf.metric.ttfb': 'サーバー応答（TTFB）',
  'perf.metric.fcp': '初回描画（FCP）',
  'perf.metric.lcp': 'メインコンテンツ（LCP）',
  'perf.metric.cls': 'レイアウトのずれ（CLS）',
  'perf.metric.inp': '入力への応答（INP）',
  'perf.metric.boardReady': 'ボードの操作開始まで',
  'perf.metric.boardLoad': 'ボードデータの読み込み',
  'perf.metric.clipboardPaste': 'ノードのペースト・複製',
  'perf.metric.imageAdd': '画像のペーストまたはドロップ',
  'perf.metric.uploadFile': 'ファイルのアップロード',
  'perf.metric.editorOpen': '3Dエディタを開く',
  'perf.metric.simulatorOpen': 'シミュレーターを開く',
  'perf.metric.runStart': '実行の開始（最初のイベントまで）',
  'perf.metric.runTotal': '実行の完了まで',
  'perf.metric.agentFirst': 'エージェントの最初の応答',
  'perf.metric.agentReply': 'エージェントの応答完了',
  'perf.metric.exportBundle': 'ファイルのエクスポート',
  'perf.metric.undoApply': '取り消し・やり直し',
  'perf.metric.fileExport': '.annie3dのダウンロード',
  'perf.metric.fileImport': '.annie3dを開く',
  'perf.metric.api': 'API呼び出し',

  // Desktop app update pill.
  'update.rolledBack': 'アップデート{version}を開始できなかったため、以前のバージョンに戻しました。',
  'update.shellRequired': '最新のアップデートには新しいアプリが必要です（アプリ{version}以降）。',
  'update.available': 'アップデートがあります',
  'update.restarting': '再起動中…',
  'update.restart': '再起動してアップデート',

  // canvas/FlowNode.tsx: the node card
  'canvas.node.openSim': '開く',
  'canvas.node.staleTitle': 'このバージョンの後に入力が変更されました',
  'canvas.node.stale': '要更新',
  'canvas.node.openSimLabel': 'シミュレーターを開く',
  'canvas.node.openSimTitle': 'シミュレーターを開く（ダブルクリックでも可）',
  'canvas.node.dropPhoto': 'ドロップ、ペースト、またはクリックして写真を追加',
  'canvas.node.dropMusic': '音楽ファイルをドロップ',
  'canvas.node.dropGlb': '.glbファイルをドロップ',
  'canvas.node.emptyResult': '生成結果がここに表示されます',
  'canvas.node.filesReady': { other: '{count}個のファイルを準備済み' },
  'canvas.node.checksPassed': '{passed}/{total}件のチェックに合格',
  'canvas.node.checksPassedPreset': '{passed}/{total}件のチェックに合格（{preset}）',
  'canvas.node.referenceImages': { other: '参照画像{count}枚' },
  'canvas.node.progress': '進捗{percent}%',
  'canvas.node.openEditorLabel': '3Dエディタを開く',
  'canvas.node.openEditorTitle': '3Dエディタを開く（ダブルクリックでも可）',
  'canvas.node.runFromHere': 'ここから実行',
  'canvas.node.writePlaceholder': 'テキストを入力…',
  'canvas.node.describePlaceholder': '作りたいものを説明…',
  'canvas.node.runCost': '実行（{credits}）',
  'canvas.node.run': '実行',
  'canvas.node.running': '実行中…',
  'canvas.node.runOptions': '実行オプション',
  'canvas.node.runWithInputs': '入力も含めて実行',
  'canvas.node.runNodeOnly': 'このノードのみ実行',
  'canvas.node.runDownstream': 'このノード以降をすべて実行',

  // canvas/FlowNode.tsx: port bubbles (screen-reader name: port and the types it takes)
  'canvas.port.one': '{port}（{type}）',
  'canvas.port.two': '{port}（{first}または{second}）',
  'canvas.port.many': '{port}（{list}または{last}）',
  'canvas.port.separator': '、',

  // canvas/FlowNode.tsx: settings toolbar under the selected node (screen-reader labels).
  'canvas.toolbar.builder': 'ビルダー',
  'canvas.toolbar.detail': '精細度',
  'canvas.toolbar.look': 'ルック',
  'canvas.toolbar.angles': 'アングル',
  'canvas.toolbar.size': 'サイズ',
  'canvas.toolbar.motion': 'モーション',
  'canvas.toolbar.aspect': 'アスペクト比',
  'canvas.toolbar.durationSec': '長さ（秒）',
  'canvas.toolbar.environment': '場所',
  'canvas.toolbar.glbPreset': 'GLBプリセット',
  'canvas.toolbar.price': '価格',
  'canvas.toolbar.builderAuto': 'ビルダー：自動',
  'canvas.toolbar.builderCode': 'ビルダー：コード',
  'canvas.toolbar.builderGenerative': 'ビルダー：生成AI',
  'canvas.toolbar.detailDraft': 'ドラフト',
  'canvas.toolbar.detailStandard': '標準',
  'canvas.toolbar.detailHigh': '高精細',
  'canvas.toolbar.anglesFour': '4アングル',
  'canvas.toolbar.anglesCustom': 'カスタムカメラ',
  'canvas.toolbar.seconds': '{seconds}秒',
  'canvas.toolbar.replace': '置き換え',
  'canvas.toolbar.download': 'ダウンロード',
  'canvas.toolbar.deleteNode': 'ノードを削除',
  'canvas.toolbar.delete': '削除',
  'canvas.toolbar.more': 'その他の操作',
  'canvas.toolbar.duplicate': '複製',
  'canvas.toolbar.copy': 'コピー',

  // canvas/FlowEdge.tsx
  'canvas.edge.remove': '接続を削除',
  'canvas.edge.label': '{from}から{to}への接続',

  // canvas/Canvas.tsx: React Flow's screen-reader texts
  'canvas.a11y.nodeDescription':
    'EnterキーまたはSpaceキーでノードを選択します。Deleteキーで削除、Escキーでキャンセルします。',
  'canvas.a11y.nodeDescriptionKeyboard':
    'EnterキーまたはSpaceキーでノードを選択します。選択後は矢印キーでノードを移動できます。Deleteキーで削除、Escキーでキャンセルします。',
  'canvas.a11y.edgeDescription':
    'EnterキーまたはSpaceキーで接続を選択します。選択後はDeleteキーで削除、Escキーでキャンセルできます。',
  'canvas.a11y.nodeMoved': '選択したノードを{direction}に移動しました。新しい位置 x：{x}、y：{y}',
  'canvas.a11y.up': '上',
  'canvas.a11y.down': '下',
  'canvas.a11y.left': '左',
  'canvas.a11y.right': '右',

  // canvas/clipboard.ts
  'canvas.imageTooLarge': '追加できる画像は{size} MBまでです',

  // lib/agentClient.ts
  'canvas.agentUnavailable': 'エージェントを利用できません（{status}）',

  // canvas/example.ts, store/board.ts: board titles and labels the app writes
  'board.example': 'サンプルボード',
  'board.untitled': '名称未設定のボード',
  'board.exampleLabel': '{label}（{product}）',
  'board.product.serum': '美容液',
  'board.product.headphones': 'ヘッドホン',
  'board.product.ring': 'リング',

  // lib/runSocket.ts, lib/doc.ts: runs
  'run.queued': '待機中',
  'run.starting': '開始中',
  'run.checkFailed': 'チェックに失敗：{gate}',
  'run.finished': { other: '実行完了：{count} クレジットを使用' },
  'run.finishedWithErrors': {
    other: '実行完了（エラーあり）：{count} クレジットを使用',
  },
  'run.failedRefunded': '実行に失敗しました。クレジットは払い戻されました。',
  'run.cancelled': {
    other: '実行をキャンセルしました：{count} クレジットを使用',
  },
  'run.preparing': '実行の準備中…',
  'run.couldNotPrepare': '実行を準備できませんでした',

  // lib/reel.ts: the process reel (drawn into the video)
  'reel.historyUnavailable': '実行履歴を利用できません',
  'reel.couldNotLoadHistory': '実行履歴を読み込めませんでした',
  'reel.howItWasMade': '制作過程',
  'reel.madeWith': 'Annie 3Dで制作',
  'reel.tagline': '1枚の写真から3D製品広告を',

  // canvas/actions.ts: uploads
  'file.uploadFailed': 'アップロードに失敗しました（{status}）',
  'file.partFailed': 'パート{part}に失敗しました',

  // lib/boardFile.ts: .annie3d board files
  'file.tooLarge': '開けるボードファイルは{size} GBまでです',
  'file.opened': '{name}を開きました',
  'file.couldNotOpen': 'ファイルを開けませんでした',
  'file.notBoardFile': 'Annie 3Dのファイルではありません',
  'file.notBoardFileOrNewer': 'Annie 3Dのファイルではありません（または新しいバージョンのファイルです）',
  'file.noNodes': 'ファイルにノードがありません',
  'file.uploadPartFailed': 'パート{part}のアップロードに失敗しました（{status}）',
  'file.couldNotReadResult': '結果を読み込めませんでした（{status}）',
  'file.missing': '{path}がありません',
  'file.boardEmpty': 'ボードが空です',

  // lib/doc.ts, lib/webDoc.ts: saving and opening board files
  'file.saving': '保存中…',
  'file.saved': '{name}を保存しました',
  'file.couldNotSave': '保存できませんでした：{reason}',
  'file.noLongerOpen': 'このボードファイルはもう開かれていません。',
  'file.typeDescription': 'Annie 3Dボード',
  'file.writeDenied': 'ファイルへの書き込みが許可されませんでした',
  'file.notOpenHere': 'このボードファイルは、このブラウザではもう開かれていません。もう一度開いてください。',
  'file.allowAccess': '開くには{name}へのアクセスを許可してください。',
  'file.windowTitle': '{name} – Annie 3D',
  'file.windowTitleUnsaved': '• {name} – Annie 3D',

  // Header
  'editor.dialog.label': '3Dエディタ：{name}',
  'editor.head.back': 'キャンバスに戻る',
  'editor.head.notCurrent': '（使用中ではありません）',
  'editor.head.compare': '比較',
  'editor.head.compareHint': '並べて比較',
  'editor.head.compareNeedsTwo': '比較するには2つのバージョンが必要です',
  'editor.head.export': 'エクスポート',
  'editor.version': 'v{version}',

  // Tools (left rail); `{key}` is the keyboard shortcut letter.
  'editor.tools.label': 'エディタツール',
  'editor.tool.withKey': '{tool}（{key}）',
  'editor.tool.orbit': 'オービット',
  'editor.tool.brush': 'ブラシ選択',
  'editor.tool.lasso': 'なげなわ選択',
  'editor.tool.camera': 'パックショットカメラ',
  'editor.tool.light': 'プレビューライト',
  'editor.tool.clear': '選択を解除（Delete）',

  // Viewport
  'editor.viewport.label': '3Dビューポート',
  'editor.viewport.loading': 'モデルを読み込み中…',
  'editor.option.brush': 'ブラシ',
  'editor.option.brushSize': 'ブラシサイズ',
  'editor.option.light': 'ライト',
  'editor.option.lightDirection': 'ライトの方向',
  'editor.camera.hint': '製品をフレームに収めてから、{button}',
  'editor.camera.useView': 'このビューをパックショットに使用',
  'editor.playback.play': '再生',
  'editor.playback.pause': '一時停止',

  // Version strip; `{source}` is one of editor.versionSource.*.
  'editor.versions.label': 'バージョン',
  'editor.versions.itemTitle': '{source}、{date}',
  'editor.versions.makeCurrent': '使用中にする',
  'editor.versionSource.run': '実行',
  'editor.versionSource.edit': '編集',
  'editor.versionSource.upload': 'アップロード',
  'editor.versionSource.agent': 'エージェント',
  'editor.versionSource.copy': 'コピー',

  // Edit panel (right)
  'editor.panel.title': '領域を編集',
  'editor.selection.summary': '{regions}、{faces}',
  'editor.selection.regions': { other: '領域{count}個' },
  'editor.selection.faces': { other: '面{count}個' },
  'editor.panel.stepPaint': '1. モデル上の領域をペイントまたはなげなわで選択',
  'editor.panel.stepDescribe': '選択部分をどう変更しますか？',
  'editor.panel.placeholder': '例：キャップをマットな黒にする',
  'editor.panel.apply': '適用',
  'editor.panel.help':
    '選択した面だけが変更されます。結果は新しいバージョンになり、以前のバージョンはバージョン一覧に残ります。',

  // Toasts
  'editor.toast.loadFailed': 'モデルを読み込めませんでした：{message}',
  'editor.toast.nowCurrent': 'v{version}を使用中にしました',
  'editor.toast.cameraSet': {
    other: '{count}個のノードにパックショットカメラを設定しました',
  },
  'editor.toast.packshotAdded': 'このビューでパックショットノードを追加しました',
  'editor.toast.readyAgain': '準備完了：もう一度領域を選択して「適用」を押してください',
  'editor.toast.selectFirst': '先に領域を選択してください（ブラシまたはなげなわ）',

  'editor.packshot.customLabel': 'パックショット（カスタムビュー）',

  // What each place is (tab tooltip).
  'sim.envHint.shop': 'オンラインストアの商品ページ',
  'sim.envHint.tiktok': 'ショップカード付きの縦型ソーシャルフィード',
  'sim.envHint.sticker': '背景が透明なチャット用スタンプ',
  'sim.envHint.showroom': 'スマートフォンで操作するライブステージ',
  'sim.product.default': 'あなたの製品',

  // Overlay header
  'sim.dialog.label': 'シミュレーター',
  'sim.head.environments': '環境',
  'sim.head.spin': '回転',
  'sim.head.stopSpin': '回転を停止',
  'sim.head.download': 'PNGをダウンロード',
  'sim.head.close': 'シミュレーターを閉じる',
  'sim.stage.empty': 'ここに表示するには、このノードに3Dモデルを接続してください。',
  'sim.stage.loading': '3Dを読み込み中…',
  'sim.toast.loadFailed': '3Dモデルを読み込めませんでした：{message}',

  // Shop page mock-up
  'sim.shop.brand': 'BRAND',
  'sim.shop.navNew': '新着',
  'sim.shop.navShop': 'ショップ',
  'sim.shop.navAbout': 'ブランド紹介',
  'sim.shop.crumb': 'ホーム / 新着アイテム',
  'sim.shop.rating': { other: '{rating}（{count}件のレビュー）' },
  'sim.shop.description': 'ドラッグして回転できます。表示されているのは実際の3D製品です。',
  'sim.shop.addToCart': 'カートに入れる',
  'sim.shop.freeShipping': '$50以上のご注文で送料無料',
  'sim.shop.returns': '30日間返品可能',

  // TikTok feed mock-up
  'sim.tiktok.following': 'フォロー中',
  'sim.tiktok.forYou': 'おすすめ',
  'sim.tiktok.share': 'シェア',
  'sim.tiktok.handle': '@yourbrand',
  'sim.tiktok.tags': '#おすすめ #tiktokshop #新作',

  // Chat sticker mock-up
  'sim.sticker.msgAsk': '新作見た？？👀',
  'sim.sticker.msgSend': 'スタンプ送るね',
  'sim.sticker.msgReply': 'やば、ほしい😍',
  'sim.sticker.note': 'スタンプは背景が透明なライブビューです。回転させてからPNGをダウンロードしてください。',

  // Showroom: phone pairing panel
  'sim.showroom.title': 'スマホリモート',
  'sim.showroom.help':
    'スマートフォンでスキャンして傾けると、製品が連動して動きます。双方向なので、スマートフォンにもこの画面の表示が映ります。',
  'sim.showroom.localhost':
    'スマートフォンではlocalhostを開けません。スマートフォンと接続するには、{command}のリンクからこのボードを開いてください。',
  'sim.showroom.phones': { other: '{count}台のスマートフォンが接続中' },
  'sim.showroom.waiting': 'スマートフォンの接続を待っています',
  'sim.showroom.pose': 'α {alpha}°、β {beta}°、γ {gamma}°',

  // Shared by the overlay and the phone remote
  'sim.status.connecting': '接続中…',
  'sim.action.recenter': '中央に戻す',

  // Phone remote page (/sim/<room>)
  'sim.remote.title': 'Annie 3Dリモート',
  'sim.remote.connected': '接続済み',
  'sim.remote.waitingScreen': '画面の接続を待っています',
  'sim.remote.product': '製品',
  'sim.remote.startMotion': 'モーション操作を開始',
  'sim.remote.tilt': 'スマートフォンを傾けて回転',
  'sim.remote.motionDenied': 'モーションへのアクセスが拒否されました。下のパッドを使ってください。',
  'sim.remote.motionUnsupported': 'このデバイスにはモーションセンサーがありません。パッドを使ってください。',
  'sim.remote.padLabel': 'ドラッグして製品を回転',
  'sim.remote.pad': 'ここをドラッグして回転',
  'sim.remote.spin': '回転',
  'sim.remote.stop': '停止',
  'sim.remote.snapshot': 'スナップショット',
  'sim.remote.places': '場所',
  'sim.remote.snapshotAlt': '画面のスナップショット',

  // Errors every route can return (lib/http.ts, index.ts)
  'api.error.internal': '問題が発生しました。もう一度お試しください。',
  'api.error.unknownEndpoint': '不明なエンドポイントです',
  'api.http.bodyNotJson': 'リクエスト本文はJSONである必要があります',
  'api.http.invalidBody': 'リクエスト本文が無効です',
  'api.http.invalidQuery': 'クエリが無効です',
  'api.http.unknownParam': '不明な{name}です',
  'api.http.notFound': '見つかりません',
  'api.http.expectedWebSocket': 'WebSocketへのアップグレードが必要です',

  // Sign-in and roles (lib/session.ts)
  'api.auth.signIn': '続けるにはログインしてください',
  'api.auth.viewerCannotEdit': '閲覧者は編集できません',

  // Workspace made at sign-up (auth.ts)
  'api.workspace.named': '{name}のワークスペース',
  'api.workspace.unnamed': 'マイワークスペース',

  // Boards and board edits (routes/boards.ts, services/boards.ts)
  'api.board.notFound': 'ボードが見つかりません',
  'api.board.tooManyEdits': '編集が多すぎます。少し間をあけてください',
  'api.board.nodeNotFound': 'ノードが見つかりません',
  'api.board.opRejected': '操作{index}が拒否されました：{reason}',
  'api.board.nodeOfOtherBoard': 'このノードIDは別のボードのものです',
  'api.board.uploadNeedsAsset': 'アップロードのバージョンにはsettings.assetIdが必要です',
  'api.board.unknownAsset': '不明なアセットです',
  'api.board.versionOfOtherNode': 'このバージョンは別のノードのものです',
  'api.board.unknownSourceVersion': '元のバージョンが不明です',

  // Uploads and files (routes/assets.ts)
  'api.upload.tooMany': 'アップロードが多すぎます。1分後にもう一度お試しください',
  'api.upload.mimeNotAccepted': '{kind}には{mime}を使用できません',
  'api.upload.tooLarge': '{kind}の上限は{size} MBです',
  'api.upload.assetNotFound': 'アセットが見つかりません',
  'api.upload.partsRequired': 'マルチパートアップロードにはパートが必要です',
  'api.upload.notInStorage': 'ストレージにアップロードが見つかりません',
  'api.upload.sizeMismatch': 'サイズが一致しません：想定{expected}、保存済み{stored}',
  'api.upload.typeMismatch': 'ファイルの内容が宣言された形式と一致しません',
  'api.upload.imageTooLarge': '画像が{size} pxを超えています',
  'api.upload.variantNotFound': 'バリアントが見つかりません',

  // Board files (.annie3d) import (routes/boardFile.ts, services/boardImport.ts)
  'api.boardFile.tooManyImports': '読み込みが多すぎます。少し間をあけてください',
  'api.boardFile.useUpload': '80 MBを超えるファイルは/import-uploadで送信してください',
  'api.boardFile.uploadUnfinished': 'アップロードが見つからないか、未完了か、すでに読み込み済みです',
  'api.boardFile.uploadMissing': 'アップロードが見つかりません',
  'api.boardFile.uploadGone': 'アップロードしたファイルがなくなっています',
  'api.boardFile.checksum': '{name}がチェックサムと一致しません',
  'api.boardFile.missingEntry': '{path}がありません',
  'api.boardFile.notBoardFile': 'Annie 3Dのファイルではありません',
  'api.boardFile.newerVersion': 'Annie 3Dのファイルではありません（または新しいバージョンのファイルです）',
  'api.boardFile.noNodes': 'ファイルにノードがありません',
  'api.boardFile.unknownNodes': 'このボードにないノードの結果が含まれています',
  'api.boardFile.tooLarge': 'ファイルが2 GBを超えています',
  'api.boardFile.multiPart': '分割されたアーカイブはボードファイルではありません',
  'api.boardFile.zip64': 'ZIP64アーカイブはボードファイルではありません',
  'api.boardFile.tooManyEntries': 'ファイル内の項目が多すぎます',
  'api.boardFile.damaged': 'ファイルが破損しています',
  'api.boardFile.encrypted': '暗号化されたファイルはボードファイルではありません',
  'api.boardFile.duplicateEntry': '項目{name}が重複しています',
  'api.boardFile.unsupportedCompression': 'サポートされていない圧縮形式です',
  'api.boardFile.manifestTooLarge': 'ボード情報が大きすぎます',
  'api.boardFile.unexpectedEntry': '想定外の項目{name}があります',
  'api.boardFile.entryCompressed': '{name}は圧縮されています。ボードファイルではメディアを無圧縮で保存します',
  'api.boardFile.unreadable': 'ファイルを読み込めませんでした：{reason}',

  // Runs (routes/runs.ts, routes/credits.ts)
  'api.run.notFound': '実行が見つかりません',
  'api.run.tooMany': '実行が多すぎます。1分ほどお待ちください。',
  'api.run.alreadyRunning': 'このボードはすでに実行中です',
  'api.run.notEnoughCredits': 'この実行に必要なクレジットが足りません',
  'api.run.nothingToRun': '実行するものがありません。実行できるノードを追加してください',
  'api.run.upToDate': 'すべて最新の状態です',
  'api.run.editNeedsModel': '領域の編集は3Dモデルノードに適用されます',
  'api.run.versionNotOnNode': 'このノードにそのバージョンが見つかりません',
  'api.run.selectRegion': '先に領域を選択してください',

  // Run steps, sent over the run's WebSocket in the language of the person who started it
  'api.run.connectFirst': '先に「{port}」を接続してください',
  'api.run.noEngine': '{kind}のエンジンがありません',
  'api.run.baseHasNoModel': '元のバージョンにモデルがありません',
  'api.run.baseModelMissing': '元のモデルファイルが見つかりません',
  'api.run.selectionExpired': '選択の有効期限が切れました。もう一度領域を選択してください',
  'api.run.inputNotFound': '入力ファイルが見つかりません',
  'api.run.inputMissingInStorage': 'ストレージに入力ファイルがありません',
  'api.run.gateFailed': '品質チェック「{gate}」に失敗しました',
  'api.run.needsPhotoOrText': '製品写真または説明を追加してください',
  'api.run.regionNotOnVersion': '選択した領域はこのバージョンにありません',

  // Progress stages of the engines (engines/simulator.ts, engines/registry.ts, engines/export.ts)
  'api.stage.model3d.readingPhotos': '写真を読み込み中',
  'api.stage.model3d.segmenting': '製品を切り抜き中',
  'api.stage.model3d.estimatingShape': '形状を推定中',
  'api.stage.model3d.buildingMesh': 'メッシュを構築中',
  'api.stage.model3d.bakingTextures': 'テクスチャをベイク中',
  'api.stage.model3d.checkingSilhouette': 'シルエットを確認中',
  'api.stage.stage.readingBrief': 'ブリーフを読み込み中',
  'api.stage.stage.blockingSet': 'セットを配置中',
  'api.stage.stage.lighting': 'ライティング中',
  'api.stage.stage.placingProduct': '製品を配置中',
  'api.stage.stage.testRender': 'テストレンダリング',
  'api.stage.packshot.framing': 'カメラをフレーミング中',
  'api.stage.packshot.renderingFront': '正面をレンダリング中',
  'api.stage.packshot.renderingAngles': '各アングルをレンダリング中',
  'api.stage.packshot.denoising': 'ノイズを除去中',
  'api.stage.adVideo.storyboard': '絵コンテ',
  'api.stage.adVideo.cameraMoves': 'カメラワーク',
  'api.stage.adVideo.renderingFrames': 'フレームをレンダリング中',
  'api.stage.adVideo.addingHeadline': '見出しを追加中',
  'api.stage.adVideo.mixingMusic': '音楽をミックス中',
  'api.stage.adVideo.encoding': 'エンコード中',
  'api.stage.export.packaging': 'パッケージング中',
  'api.stage.export.validating': 'glTFを検証中',
  'api.stage.export.writing': 'ファイルを書き込み中',
  'api.stage.working': '処理中',
  'api.stage.done': '完了',
  'api.stage.edit.readingSelection': '選択範囲を読み込み中',
  'api.stage.edit.applying': '編集を適用中',
  'api.stage.edit.checking': '結果を確認中',
  'api.stage.export.optimising': '{preset}向けに最適化中',
  'api.stage.export.collecting': 'ファイルを収集中',
  'api.stage.export.exported': 'エクスポート完了',
  'api.stage.export.exportedWithFailures': 'エクスポート完了（一部のチェックに不合格）',

  // Quality gates and export checks by id (`step.failed.gate`, version gates `<preset>:<id>`)
  'api.gate.inputs': '入力',
  'api.gate.selection': '選択範囲',
  'api.gate.silhouette_iou': 'シルエットの一致',
  'api.gate.watertight': '水密メッシュ',
  'api.gate.triangles': '三角形の数',
  'api.gate.product_visible': '製品の視認性',
  'api.gate.framing': 'フレーミング',
  'api.gate.duration_ok': '長さ',
  'api.gate.loudness_lufs': 'ラウドネス',
  'api.gate.edit_applied': '編集の適用',
  'api.gate.bytes': 'ファイルサイズ',
  'api.gate.texture': 'テクスチャサイズ',
  'api.gate.animation': 'アニメーション',
  'api.gate.validator': 'glTFの検証',

  // Exports (routes/exports.ts, services/exporter.ts)
  'api.export.notFound': 'エクスポートが見つかりません',
  'api.export.noModelYet': 'このノードにはまだエクスポートできるモデルがありません',
  'api.export.wrongNode': '3Dモデルまたはエクスポートノードをエクスポートしてください',
  'api.export.nothingToExport':
    'エクスポートするものがありません。3Dモデル、動画、画像のいずれかを接続してください',
  'api.export.failed': 'エクスポートに失敗しました：{reason}',
  'api.export.megabytes': '{value} MB',
  'api.export.checkBytes': '{size}／{limit}',
  'api.export.checkTriangles': '三角形{count}／{limit}個',
  'api.export.checkTexture': '最大テクスチャ{size}px（上限{limit}px）',
  'api.export.checkNoTextures': '画像テクスチャなし',
  'api.export.checkAnimation': { other: 'アニメーションクリップ{count}個' },
  'api.export.checkAnimationNeeded': 'アニメーションが必要です（例：ターンテーブル）',
  'api.export.checkAnimationOptional': {
    other: 'アニメーションクリップ{count}個（必須ではありません）',
  },
  'api.export.checkValid': '有効なglTF 2.0として読み込めます',
  'api.export.checkInvalid': '有効なglTFではありません：{reason}',
  'api.export.checkRoundTrip': 'ラウンドトリップに失敗しました：{reason}',

  // Shares (routes/shares.ts)
  'api.share.versionNotFound': 'バージョンが見つかりません',
  'api.share.changed': '共有が変更されました。もう一度お試しください',
  'api.share.notFound': '共有が見つかりません',
  'api.share.unavailable': 'このリンクは利用できません',
  'api.share.anonymousOwner': 'Annie 3Dユーザー',

  // Plans and the simulated checkout page (routes/credits.ts)
  'api.plan.creator': 'Creator',
  'api.plan.studio': 'Studio',
  'api.checkout.invalidSignature': '決済の署名が無効です',
  'api.checkout.expired': '決済の有効期限が切れました',
  'api.checkout.otherWorkspace': 'この決済は別のワークスペースのものです',
  'api.checkout.invalidLink': '決済リンクが無効です',
  'api.checkout.pageTitle': 'お支払い · Annie 3D',
  'api.checkout.simulated':
    '決済のシミュレーションです。カードへの請求は発生しません。実際の決済サービスがこのページに置き換わります。',
  'api.checkout.planName': '{plan} プラン',
  'api.checkout.creditsMonthly': { other: '毎月{count} クレジット' },
  'api.checkout.dueToday': '本日のお支払い',
  'api.checkout.pay': '{price}を支払う',
  'api.checkout.cancel': 'キャンセルして戻る',

  // Reels (routes/reels.ts)
  'api.reel.serverNotAttached':
    'サーバーでのリールのレンダリングにはまだ対応していません。ブラウザでリールを録画してください',
  'api.reel.afterRun': '実行が完了してからリールを作成してください',
  'api.reel.uploadFirst': '先に録画したリール動画をアップロードしてください',

  // Simulation remote link (routes/sim.ts)
  'api.sim.badRoom': 'ルームIDが無効です',

  // Agent route (routes/agent.ts)
  'api.agent.tooMany': 'メッセージが多すぎます。1分ほどお待ちください。',
  'api.agent.threadNotFound': 'スレッドが見つかりません',
  'api.agent.couldNotApply': '「{label}」を適用できませんでした：{reason}',
  'api.agent.upToDate': 'すべて最新の状態のため、何も実行しませんでした。',
  'api.agent.overBudget': {
    other:
      'この実行には{count} クレジットが必要で、このメッセージの予算（{budget}）を超えています。予算を増やしてもう一度お試しください。',
  },
  'api.agent.couldNotStart': '実行を開始できませんでした：{reason}',

  // Simulated agent's replies and change labels (agents/simulated.ts)
  'api.agent.help':
    'ステージのルック（ダークラボ、石と水、ベルベット、パステルスプラッシュ、ボタニカル、スタジオ）の変更、暖かみや涼しさの調整、動画の長さ（6秒・10秒・15秒）の設定、9:16・1:1・16:9への切り替え、モーションの変更、見出しの設定（headline: "..."）、パックショットの追加、エクスポートプリセットの選択、そして実行ができます。対象のフローを指定するには、先にノードを選択してください。',
  'api.agent.ambiguous': {
    other:
      '{kind}ノードが{count}個あります。対象のノード（またはそのフロー内のノード）を選択して、もう一度お試しください。',
  },
  'api.agent.noNode': '{kind}ノードがまだないため、「{change}」をスキップしました。',
  'api.agent.alreadySet': { other: '{nodes}はすでに{value}です。' },
  'api.agent.changeOn': '{nodes}：{change}',
  'api.agent.change.look': 'ルック → {value}',
  'api.agent.change.direction': '演出指示：{value}',
  'api.agent.change.duration': '長さ → {value}',
  'api.agent.change.aspect': 'アスペクト比 → {value}',
  'api.agent.change.motion': 'モーション → {value}',
  'api.agent.change.detail': '精細度 → {value}',
  'api.agent.change.preset': 'プリセット → {value}',
  'api.agent.change.headline': '見出し → 「{text}」',
  'api.agent.change.addPackshot': '{node}からパックショットノードを追加しました',
  'api.agent.value.seconds': '{seconds}秒',
  'api.agent.value.secondsClosest': '{seconds}秒（{wanted}秒に最も近い値）',
  'api.agent.value.detailHigh': '高精細',
  'api.agent.value.detailDraft': 'ドラフト',
  'api.agent.ambiguousHeadline': {
    other: '見出しが{count}個あります。対象のフローを選択して、もう一度お試しください。',
  },
  'api.agent.pickModel': 'パックショットの元にする3Dモデルを選択してください。',
  'api.agent.packshotLabel': 'パックショット（エージェント）',
  'api.agent.done': '完了：',
  'api.agent.madeChanges': { other: '{count}件の変更を行いました：' },
  'api.agent.runningChanged': '変更された部分を実行します。変更のないノードはキャッシュを使います。',
  'api.agent.runningBoard': 'ボードを実行します。変更のないノードはキャッシュを使います。',
  'api.agent.sayRun': '結果を見たいときは「run it」と送ってください。',

  // macOS application menu ({app} is "Annie 3D").
  'desktop.menu.about': '{app}について',
  'desktop.menu.services': 'サービス',
  'desktop.menu.hide': '{app}を隠す',
  'desktop.menu.hideOthers': 'ほかを隠す',
  'desktop.menu.showAll': 'すべてを表示',
  'desktop.menu.quitApp': '{app}を終了',
  // File
  'desktop.menu.file': 'ファイル',
  'desktop.menu.newBoardFile': '新規ボードファイル',
  'desktop.menu.open': '開く…',
  'desktop.menu.openRecent': '最近使った項目を開く',
  'desktop.menu.clearRecent': 'メニューを消去',
  'desktop.menu.save': '保存',
  'desktop.menu.saveAs': '別名で保存…',
  'desktop.menu.importIntoBoard': 'このボードに読み込む…',
  'desktop.menu.closeWindow': 'ウインドウを閉じる',
  'desktop.menu.quit': '終了',
  'desktop.menu.exit': '終了',
  // Edit
  'desktop.menu.edit': '編集',
  'desktop.menu.undo': '取り消す',
  'desktop.menu.redo': 'やり直す',
  'desktop.menu.cut': 'カット',
  'desktop.menu.copy': 'コピー',
  'desktop.menu.paste': 'ペースト',
  'desktop.menu.selectAll': 'すべてを選択',
  // View
  'desktop.menu.view': '表示',
  'desktop.menu.reload': '再読み込み',
  'desktop.menu.toggleDevTools': '開発者ツールを切り替え',
  'desktop.menu.toggleFullScreen': 'フルスクリーンを切り替え',
  // Window
  'desktop.menu.window': 'ウインドウ',
  'desktop.menu.minimize': 'しまう',
  'desktop.menu.zoom': '拡大／縮小',
  'desktop.menu.bringAllToFront': 'すべてを手前に移動',
  'desktop.menu.close': '閉じる',
  // Help
  'desktop.menu.help': 'ヘルプ',
  'desktop.menu.website': '{app}のWebサイト',

  // Board files as documents
  'desktop.doc.untitled': '名称未設定.annie3d',
  'desktop.doc.fileType': 'Annie 3Dボード',
  'desktop.close.message': '「{name}」に加えた変更を保存しますか？',
  'desktop.close.detail': '保存しないと、変更内容は失われます。',
  'desktop.close.dontSave': '保存しない',
  'desktop.open.failed': '「{name}」を開けませんでした',

  // Why a board file was refused ({name} is a path inside the file)
  'desktop.file.tooLarge': 'ファイルが2 GBを超えています',
  'desktop.file.notBoard': 'Annie 3Dのファイルではありません',
  'desktop.file.notBoardOrNewer': 'Annie 3Dのファイルではありません（または新しいバージョンのファイルです）',
  'desktop.file.damaged': 'ファイルが破損しています',
  'desktop.file.invalidDescription': 'ボード情報が無効です',
  'desktop.file.multiPart': '分割されたアーカイブはボードファイルではありません',
  'desktop.file.zip64': 'ZIP64アーカイブはボードファイルではありません',
  'desktop.file.tooManyEntries': 'ファイル内の項目が多すぎます',
  'desktop.file.encrypted': '暗号化されたファイルはボードファイルではありません',
  'desktop.file.duplicateEntry': '項目{name}が重複しています',
  'desktop.file.unsupportedCompression': 'サポートされていない圧縮形式です',
  'desktop.file.descriptionTooLarge': 'ボード情報が大きすぎます',
  'desktop.file.unexpectedEntry': '想定外の項目{name}があります',
  'desktop.file.compressedMedia': '{name}は圧縮されています。ボードファイルではメディアを無圧縮で保存します',
  'desktop.file.invalidBoard': '無効なボードです',
  'desktop.file.invalidAsset': '無効なファイル：{name}',
  'desktop.file.missingAsset': '{name}がありません',
  'desktop.file.boardTooLarge': 'ボードが2 GBを超えています',
  'desktop.file.needsBytes': 'すべてのファイルにデータが必要です',

  // Every page
  'site.meta.pageTitle': '{title} · Annie 3D',
  'site.nav.skipToContent': 'コンテンツへスキップ',
  'site.nav.homeLabel': 'Annie 3Dホーム',
  'site.nav.openCanvas': 'キャンバスを開く',
  'site.nav.footer': 'フッター',
  'site.nav.canvas': 'キャンバス',
  'site.nav.privacy': 'プライバシー',
  'site.nav.terms': '利用規約',
  'site.nav.contact': 'お問い合わせ',
  'site.nav.languages': '言語',
  'site.footer.copyright': '© 2026 Annie 3D（オーストラリア）',

  // /home
  'site.home.title': '1枚の写真から作る3D製品広告',
  'site.home.description':
    'Annie 3Dは、1枚の製品写真から本物の3Dモデル、広告動画、あらゆる角度のパックショット、アニメーション付きGLBを作成します。キャンバスは登録なしで開けます。',
  'site.home.eyebrow': '3D広告ワークスペース',
  'site.home.headline': '製品写真1枚から、3D広告へ。',
  'site.home.lead':
    'キャンバスに製品写真をドロップするだけ。Annie 3Dが製品を本物の3Dモデルとして構築し、広告動画、あらゆる角度のパックショット、ストア用のアニメーション付きGLB、誰でも開ける共有リンクを用意します。すべての出力が同じモデルから生まれるので、どの出力でも製品が正確に再現されます。',
  'site.home.whatEyebrow': 'できること',
  'site.home.whatTitle': 'ひとつのモデルからすべてを',
  'site.home.videosTitle': '広告動画',
  'site.home.videosBody':
    'テック製品には分解リビール、ジュエリーには石と水、コスメにはスプラッシュヒーロー。1:1、4:5、9:16に対応します。',
  'site.home.packshotsTitle': 'あらゆる角度のパックショット',
  'site.home.packshotsBody': 'カメラを自分でフレーミングするか、標準の4アングルを使えます。',
  'site.home.glbTitle': 'アニメーション付きGLB',
  'site.home.glbBody':
    'ダウンロード前に、Web、Google Merchant、Google Swirlの制限を満たしているかチェックします。',
  'site.home.howEyebrow': '使い方',
  'site.home.howTitle': 'つなぎ直せるノードのキャンバス',
  'site.home.howBody':
    '用意されたグラフから始めるか、写真、テキスト、3Dモデル、ステージ、パックショット、広告動画、エクスポートのノードを自分で追加します。モデル上の領域を選んで変更内容を伝えるだけ。すべての編集は新しいバージョンになり、比較や取り消しができます。',
  'site.home.tryExample': 'サンプルボードを試す',

  // /legal/*
  'site.legal.draft': 'プレリリース版の草案・公開前に法律顧問による確認を予定',
  'site.legal.translationNotice':
    'この翻訳は便宜上提供するものです。英語版と内容が異なる場合は、英語版が優先されます。',
  'site.legal.readEnglish': '英語版を読む',

  'site.terms.title': '利用規約',
  'site.terms.description': 'Annie 3Dの利用に関する規約です。',
  'site.terms.contentTitle': 'お客様のコンテンツ',
  'site.terms.contentBody':
    'お客様がアップロードした写真および作成した出力物の権利は、お客様が保持します。広告する権利を有する製品のみをアップロードしてください。',
  'site.terms.useTitle': '適切な利用',
  'site.terms.useBody':
    '偽造品の広告の作成、ブランドや個人へのなりすまし、または違法なコンテンツの制作にAnnie 3Dを使用しないでください。',
  'site.terms.creditsTitle': 'クレジット',
  'site.terms.creditsBody':
    '実行にはクレジットを使用します。当社の品質チェックに合格しなかった実行は、自動的に払い戻されます。',
  'site.terms.preReleaseTitle': 'プレリリース',
  'site.terms.preReleaseBody':
    '機能は変更される場合があります。お客様のデータに影響する変更は、発効前にお知らせします。',

  'site.privacy.title': 'プライバシーに関するお知らせ',
  'site.privacy.description': 'Annie 3Dにおけるお客様のデータの取り扱いについて。',
  'site.privacy.whoTitle': '運営者',
  'site.privacy.whoBody': 'Annie 3Dはオーストラリアから運営されています。連絡先：{email}',
  'site.privacy.storeTitle': '保存する情報',
  'site.privacy.storeBody':
    'ログイン時のGoogleアカウントの名前、メールアドレス、プロフィール写真。お客様が作成したボード、ノード、プロンプト、バージョン。お客様がアップロードしたファイルおよび当社がお客様のために生成したファイル。実行履歴とクレジットの取引。',
  'site.privacy.whereTitle': '保存場所',
  'site.privacy.whereBody':
    'アカウントとボードのデータは、オーストラリア・シドニーでNeonがホストするPostgresデータベースに保存されます。ファイルはオセアニア地域のCloudflare R2オブジェクトストレージに保存されます。ページはCloudflareのネットワークを通じて配信されます。',
  'site.privacy.cookiesTitle': 'Cookie',
  'site.privacy.cookiesBody':
    'ファーストパーティのセッションCookie 1つでログイン状態を維持し、もう1つのファーストパーティCookieで選択した言語を記憶します。広告用Cookieは使用しません。',
  'site.privacy.sharingTitle': '共有',
  'site.privacy.sharingBody':
    '共有リンクを作成しない限り、何も公開されません。リンクはいつでも取り消すことができます。',
  'site.privacy.deleteTitle': 'データの削除',
  'site.privacy.deleteBody':
    'ボードはキャンバスから削除できます。アカウントとすべてのファイルを削除するには、メールでご連絡ください。',

  // Public share page rendered by the Worker (/s/<token>)
  'share.unavailableTitle': 'リンクを利用できません',
  'share.unavailableHeading': 'このリンクは利用できません',
  'share.unavailableBody': '所有者によって無効にされた可能性があります。',
  'share.openApp': 'Annie 3Dを開く',
  'share.makeYours': '無料で作ってみる',
  'share.description': '{owner}がAnnie 3Dで作成しました。1枚の写真から3D製品広告を。',
  'share.by': '作成者：{owner}',
  'share.modelAlt': '3Dモデルのプレビュー',
  'share.modelTitle': '3Dモデル',
  'share.triangles': { other: '三角形{count}個' },
  'share.megabytes': '{size} MB',
  'share.downloadGlb': 'GLBをダウンロード',
  'share.madeWith': '{brand}で制作',
  'share.terms': '利用規約',
};

/** Keys whose correct Japanese is the English text (names, loanwords). */
export const sameAsEnglish: readonly string[] = [
  'dialog.run.ok',
  'dialog.export.megabytes',
  'perf.server',
  'perf.ms',
  'perf.budget',
  'file.windowTitle',
  'file.windowTitleUnsaved',
  'editor.version',
  'sim.shop.brand',
  'sim.tiktok.handle',
  'api.export.megabytes',
  'site.meta.pageTitle',
  'share.megabytes',
];

export default catalog;
