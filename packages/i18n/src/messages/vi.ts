import type { Catalog } from '../index';

/**
 * Vietnamese. Glossary (keep these choices when adding keys):
 * board = bảng, board file = tệp bảng, canvas = khung vẽ, node = node (loanword, never "nút"),
 * wire / connection = kết nối, run = chạy (verb) / lượt chạy (noun), credits = tín dụng,
 * Stage = Bối cảnh, scene = cảnh, Packshot = Packshot (loanword), Ad video = Video quảng cáo,
 * Export = Xuất tệp (node) / Xuất (button), Simulation = Mô phỏng, simulator = trình mô phỏng,
 * Starter = mẫu khởi đầu, template = mẫu, preset = thiết lập sẵn, look = phong cách,
 * motion = chuyển động, version = phiên bản, Annie = Annie, agent = trợ lý, headline = tiêu đề,
 * region = vùng, face = mặt, upload = tải lên, download = tải xuống, file = tệp,
 * share link = đường liên kết chia sẻ, sign in = đăng nhập, plan = gói, workspace = không gian làm việc,
 * builder = trình dựng, renderer = trình kết xuất, render = kết xuất, quality gate = bước kiểm tra
 * chất lượng, process reel = video hậu trường, showroom = phòng trưng bày, sticker = nhãn dán.
 * Address the person as "bạn"; the assistant speaks of itself as "tôi". Quotes: “ ”.
 */
const catalog: Catalog = {
  // Words used across the product.
  'common.credits': { other: '{count} tín dụng' },
  'common.cancel': 'Hủy',
  'common.close': 'Đóng',
  'common.save': 'Lưu',
  'common.done': 'Xong',
  'common.retry': 'Thử lại',
  'common.language': 'Ngôn ngữ',
  'common.brand': 'Annie 3D',

  // Names that come from packages/contracts.
  'node.photo': 'Ảnh',
  'node.text': 'Văn bản',
  'node.upload3d': 'Tải lên 3D',
  'node.audio': 'Nhạc',
  'node.model3d': 'Mô hình 3D',
  'node.stage': 'Bối cảnh',
  'node.packshot': 'Packshot',
  'node.adVideo': 'Video quảng cáo',
  'node.export': 'Xuất tệp',
  'node.simulation': 'Mô phỏng',
  'node.note': 'Ghi chú',

  'engine.photo': 'Tải lên',
  'engine.text': 'Văn bản',
  'engine.upload3d': 'Tải lên',
  'engine.audio': 'Tải lên',
  'engine.model3d': 'Trình dựng',
  'engine.stage': 'Đạo diễn cảnh',
  'engine.packshot': 'Trình kết xuất',
  'engine.adVideo': 'Trình kết xuất',
  'engine.export': 'Trình đóng gói',
  'engine.simulation': 'Xem trước trực tiếp',
  'engine.note': 'Ghi chú',

  'category.input': 'Đầu vào',
  'category.build': 'Dựng',
  'category.stage': 'Bối cảnh',
  'category.output': 'Đầu ra',
  'category.note': 'Ghi chú',

  'port.photo.out': 'Hình ảnh',
  'port.text.out': 'Văn bản',
  'port.upload3d.out': 'Mô hình 3D',
  'port.audio.out': 'Âm thanh',
  'port.model3d.images': 'Ảnh',
  'port.model3d.prompt': 'Mô tả',
  'port.model3d.out': 'Mô hình 3D',
  'port.stage.model': 'Mô hình 3D',
  'port.stage.prompt': 'Chỉ đạo',
  'port.stage.style': 'Tham chiếu phong cách',
  'port.stage.out': 'Cảnh',
  'port.packshot.subject': 'Mô hình hoặc cảnh',
  'port.packshot.out': 'Hình ảnh',
  'port.adVideo.subject': 'Cảnh hoặc mô hình',
  'port.adVideo.headline': 'Tiêu đề',
  'port.adVideo.logo': 'Logo',
  'port.adVideo.music': 'Nhạc',
  'port.adVideo.out': 'Video',
  'port.export.items': 'Đầu ra',
  'port.export.out': 'Tệp',
  'port.simulation.subject': 'Mô hình hoặc cảnh',
  'port.simulation.headline': 'Tiêu đề',
  'port.simulation.logo': 'Logo',

  'portType.image': 'Hình ảnh',
  'portType.text': 'Văn bản',
  'portType.model3d': 'Mô hình 3D',
  'portType.scene': 'Cảnh',
  'portType.video': 'Video',
  'portType.audio': 'Âm thanh',
  'portType.file': 'Tệp',

  'look.studio-light': 'Ánh sáng studio',
  'look.dark-lab': 'Phòng lab tối',
  'look.stone-water': 'Đá và nước',
  'look.velvet': 'Nhung',
  'look.splash-pastel': 'Tung nước, pastel',
  'look.podium-botanical': 'Bục và cây lá',

  'motion.turntable': 'Bàn xoay',
  'motion.hero-orbit': 'Bay vòng quanh',
  'motion.teardown-reveal': 'Tháo rời từng lớp',
  'motion.stone-water': 'Đá và nước',
  'motion.splash-hero': 'Tung nước nổi bật',

  'glbPreset.web': 'Web / cửa hàng',
  'glbPreset.google_merchant': 'Google Merchant',
  'glbPreset.google_swirl': 'Google Swirl',

  'simEnv.shop': 'Trang cửa hàng',
  'simEnv.tiktok': 'TikTok',
  'simEnv.sticker': 'Nhãn dán',
  'simEnv.showroom': 'Phòng trưng bày',

  'starter.teardown-reveal.title': 'Tháo rời từng lớp',
  'starter.teardown-reveal.vertical': 'Điện tử',
  'starter.teardown-reveal.description': 'Sản phẩm tách ra từng lớp, dừng lại một nhịp rồi khớp lại như cũ.',
  'starter.teardown-reveal.headline': 'Chỉn chu đến từng con ốc',
  'starter.stone-water.title': 'Đá và nước',
  'starter.stone-water.vertical': 'Trang sức',
  'starter.stone-water.description':
    'Món trang sức nằm trên phiến đá ướt cạnh dòng thác mảnh; máy quay tiến chậm, ánh sáng lấp lánh.',
  'starter.stone-water.headline': 'Sinh ra để được chú ý',
  'starter.splash-hero.title': 'Tung nước nổi bật',
  'starter.splash-hero.vertical': 'Làm đẹp',
  'starter.splash-hero.description':
    'Chai sản phẩm vươn lên qua làn nước cùng màu rồi đáp xuống bục trưng bày.',
  'starter.splash-hero.headline': 'Gặp gỡ công thức mới',
  'starter.node.photo': 'Ảnh sản phẩm',
  'starter.node.headline': 'Tiêu đề',
  'starter.node.pack': 'Bộ packshot',

  'setting.simulation.cta': 'Mua ngay',

  // App shell (App.tsx): loading splash, lazy overlays, checkout return.
  'app.canvas': 'Khung vẽ của bảng',
  'app.loading': 'Đang tải bảng…',
  'app.docAccess': 'Mở {name}',
  'app.opening3d': 'Đang mở 3D…',
  'app.openingSimulator': 'Đang mở trình mô phỏng…',
  'app.error3d': 'Không khởi động được chế độ xem 3D: {message}',
  'app.checkoutDone': 'Đã thanh toán. Tín dụng đã được cộng.',
  'app.board.firstTitle': 'Bảng đầu tiên của tôi',

  // Top bar: logo, title, save state.
  'topbar.home': 'Trang chủ Annie 3D',
  'topbar.title': 'Tên bảng',
  'topbar.save.saved': 'Đã lưu',
  'topbar.save.saving': 'Đang lưu…',
  'topbar.save.offline': 'Ngoại tuyến, sẽ đồng bộ sau',
  'topbar.save.error': 'Đang thử lại…',
  'topbar.save.edited': 'Đã sửa',
  'topbar.save.notSaved': 'Chưa lưu',
  'topbar.save.noFile': 'Chưa lưu thành tệp',
  'topbar.save.guest': 'Đã lưu trong trình duyệt này',
  'topbar.save.guestHint': 'Đăng nhập để lưu vào tài khoản của bạn',

  // Top bar: board file ("…") menu.
  'topbar.file.menu': 'Tệp bảng',
  'topbar.file.save': 'Lưu',
  'topbar.file.saveAsFile': 'Lưu thành tệp…',
  'topbar.file.saveAs': 'Lưu thành…',
  'topbar.file.open': 'Mở…',
  'topbar.file.new': 'Tệp bảng mới',
  'topbar.file.import': 'Nhập vào bảng này…',
  'topbar.file.download': 'Tải bảng xuống (.annie3d)',
  'topbar.file.openFile': 'Mở tệp bảng…',

  // Top bar: templates, run all, zoom.
  'topbar.templates': 'Mẫu',
  'topbar.running': 'Đang chạy…',
  'topbar.runAll': 'Chạy tất cả',
  'topbar.runAllHint': 'Node không đổi được miễn phí; chi phí chính xác hiện ra trước khi bạn xác nhận',
  'topbar.upToDate': 'Đã cập nhật',
  'topbar.zoomOut': 'Thu nhỏ',
  'topbar.zoomIn': 'Phóng to',
  'topbar.zoomLevel': 'Thu phóng {percent}, vừa màn hình',
  'topbar.fitToScreen': 'Vừa màn hình (Shift+1)',

  // Top bar: account, credits, share.
  'topbar.creditsHint': 'Tín dụng và gói',
  'topbar.signIn': 'Đăng nhập',
  'topbar.share': 'Chia sẻ',
  'topbar.shareFile': 'Tệp bảng được chia sẻ dưới dạng tệp: hãy gửi chính tệp .annie3d.',
  'topbar.account': 'Tài khoản',
  'topbar.accountOf': 'Tài khoản: {name}',
  'topbar.creditsAndPlan': 'Tín dụng và gói',
  'topbar.signOut': 'Đăng xuất',

  // Language picker (top bar and the file menu).
  'lang.button': 'Ngôn ngữ: {language}',

  // Bottom toolbar.
  'toolbar.label': 'Công cụ khung vẽ',
  'toolbar.select': 'Chọn (V)',
  'toolbar.hand': 'Bàn tay (H)',
  'toolbar.add': 'Thêm {name}',
  'toolbar.moreNodes': 'Thêm node khác (N)',
  'toolbar.undo': 'Hoàn tác (⌘Z)',
  'toolbar.redo': 'Làm lại (⇧⌘Z)',
  'toolbar.askAnnie': 'Hỏi Annie',

  // Add-node palette.
  'palette.label': 'Thêm node',
  'palette.search': 'Thêm node…',
  'palette.searchLabel': 'Tìm node',
  'palette.list': 'Danh sách node',
  'palette.starters': 'Mẫu khởi đầu',
  'palette.starter': 'Mẫu khởi đầu {title}',
  'palette.noMatch': 'Không có node nào khớp với “{query}”.',
  'palette.accepts.image': 'Node nhận hình ảnh…',
  'palette.accepts.text': 'Node nhận văn bản…',
  'palette.accepts.model3d': 'Node nhận mô hình 3D…',
  'palette.accepts.scene': 'Node nhận cảnh…',
  'palette.accepts.video': 'Node nhận video…',
  'palette.accepts.audio': 'Node nhận âm thanh…',
  'palette.accepts.file': 'Node nhận tệp…',

  // Right-click menu on the canvas.
  'menu.canvas': 'Menu khung vẽ',
  'menu.runNode': 'Chạy node này',
  'menu.openEditor': 'Mở trình chỉnh sửa 3D',
  'menu.export': 'Xuất / tải xuống…',
  'menu.copy': 'Sao chép',
  'menu.duplicate': 'Nhân bản',
  'menu.delete': 'Xóa',
  'menu.addNode': 'Thêm node…',
  'menu.paste': 'Dán vào đây',
  'menu.duplicateSelected': { other: 'Nhân bản {count} mục đã chọn' },
  'menu.deleteSelected': { other: 'Xóa {count} mục đã chọn' },

  // Agent dock (Ask Annie).
  'agent.title': 'Hỏi Annie',
  'agent.close': 'Đóng trợ lý',
  'agent.intro':
    'Annie chỉnh bảng này giúp bạn: node, cài đặt và kết nối. Nhấn ⌘Z để hoàn tác các thay đổi của Annie.',
  'agent.suggestion.warmerStage': 'Làm bối cảnh ấm hơn và thêm một đoạn cắt 6 giây',
  'agent.suggestion.fourAngles': 'Thêm packshot với bốn góc chụp',
  'agent.suggestion.softerLight': 'Dùng ánh sáng dịu hơn cho mô hình 3D',
  'agent.undoHint': 'Hoàn tác bằng ⌘Z',
  'agent.thinking': 'Đang suy nghĩ…',
  'agent.input': 'Nhắn cho trợ lý',
  'agent.placeholder': 'Mô tả thay đổi bạn muốn…',
  'agent.budget': 'Ngân sách',
  'agent.budgetLabel': 'Ngân sách tính bằng tín dụng',
  'agent.send': 'Gửi',
  'agent.boardEdited': 'Đã chỉnh sửa bảng',
  'agent.failed': 'Rất tiếc, thao tác không thành công: {message}',

  // Shared dialog words.
  'dialog.download': 'Tải xuống',

  // Billing dialog.
  'dialog.billing.title': 'Tín dụng',
  'dialog.billing.guest': {
    other: 'Đăng nhập để nhận {count} tín dụng miễn phí: đủ cho một lượt chạy trọn vẹn.',
  },
  'dialog.billing.signIn': 'Đăng nhập',
  'dialog.billing.balance': { other: '{balance} tín dụng' },
  'dialog.billing.held': { other: '({count} đang tạm giữ cho lượt chạy đang diễn ra)' },
  'dialog.billing.plan.free': 'Miễn phí',
  'dialog.billing.plan.creator': 'Creator',
  'dialog.billing.plan.studio': 'Studio',
  'dialog.billing.firstRunFree': {
    other: 'Lượt chạy đầu tiên của bạn miễn phí (kèm {count} tín dụng).',
  },
  'dialog.billing.chargedOnSuccess':
    'Chỉ các bước chạy thành công mới bị tính phí; các bước đã lưu bộ nhớ đệm được miễn phí.',
  'dialog.billing.perMonth': '/tháng',
  'dialog.billing.creditsPerMonth': {
    other: '{count} tín dụng mỗi tháng',
  },
  'dialog.billing.openingCheckout': 'Đang mở trang thanh toán…',
  'dialog.billing.addCredits': 'Thêm tín dụng',
  'dialog.billing.choose': 'Chọn gói {plan}',
  'dialog.billing.history': 'Lịch sử',
  'dialog.billing.reason.grantFree': 'Tín dụng miễn phí',
  'dialog.billing.reason.purchase': 'Mua gói',
  'dialog.billing.reason.subscription': 'Tín dụng hằng tháng',
  'dialog.billing.reason.runReserve': 'Bắt đầu chạy (tạm giữ)',
  'dialog.billing.reason.runSettle': 'Đã tính phí lượt chạy',
  'dialog.billing.reason.runRefund': 'Hoàn tiền',
  'dialog.billing.reason.adjust': 'Điều chỉnh',

  // Export dialog.
  'dialog.export.noNode': 'Chọn một node Mô hình 3D hoặc Xuất tệp để xuất.',
  'dialog.export.titleBundle': 'Xuất gói tệp',
  'dialog.export.titleModel': 'Xuất mô hình 3D',
  'dialog.export.preset': 'Thiết lập sẵn',
  'dialog.export.limits': 'Tối đa {size}, {triangles} tam giác, texture {texture} px',
  'dialog.export.limitsAnimated': 'Tối đa {size}, {triangles} tam giác, texture {texture} px, có hoạt ảnh',
  'dialog.export.megabytes': '{size} MB',
  'dialog.export.includeVideo': 'Video quảng cáo (MP4)',
  'dialog.export.includeImages': 'Hình ảnh (PNG)',
  'dialog.export.ready': 'Sẵn sàng cho {preset}',
  'dialog.export.notReady': 'Chưa đạt yêu cầu của {preset}',
  'dialog.export.passed': 'đạt',
  'dialog.export.failed': 'không đạt',
  'dialog.export.zip': 'Tất cả tệp (.zip)',
  'dialog.export.glb': 'Mô hình GLB',
  'dialog.export.exporting': 'Đang xuất…',
  'dialog.export.run': 'Xuất (miễn phí)',

  // Process reel dialog.
  'dialog.reel.button': 'Video hậu trường',
  'dialog.reel.hint': 'Video 9:16: quảng cáo ở trên, quá trình thực hiện ở dưới',
  'dialog.reel.title': 'Video hậu trường',
  'dialog.reel.intro':
    'Video 9:16 cho Reels và TikTok: quảng cáo của bạn ở trên, cách Annie 3D tạo ra nó ở dưới.',
  'dialog.reel.preview': 'Xem trước video',
  'dialog.reel.recording': 'Đang ghi… {percent}',
  'dialog.reel.saving': 'Đang lưu…',
  'dialog.reel.record': 'Ghi video',

  // Run dialog (cost before charging).
  'dialog.run.inProgress': 'Bảng này đang có một lượt chạy',
  'dialog.run.checking': 'Đang kiểm tra chi phí…',
  'dialog.run.estimateFailed': 'Không thể ước tính lượt chạy này.',
  'dialog.run.upToDate': 'Mọi thứ đều đã cập nhật',
  'dialog.run.allCached': {
    other:
      '{count} node đã có kết quả cho đầu vào hiện tại. Hãy đổi câu lệnh, cài đặt hoặc đầu vào để chạy lại.',
  },
  'dialog.run.ok': 'OK',
  'dialog.run.titleOne': 'Chạy {name}',
  'dialog.run.titleMany': { other: 'Chạy {count} node' },
  'dialog.run.cached': {
    other: '{count} node không đổi dùng lại kết quả cũ',
  },
  'dialog.run.free': 'miễn phí',
  'dialog.run.total': 'Tổng cộng',
  'dialog.run.balance': { other: 'Số dư: {count} tín dụng.' },
  'dialog.run.firstRunFree': 'Lượt chạy đầu tiên của bạn miễn phí.',
  'dialog.run.refunded': 'Các bước lỗi sẽ được hoàn tín dụng.',
  'dialog.run.starting': 'Đang bắt đầu…',
  'dialog.run.run': 'Chạy',
  'dialog.run.getCredits': 'Mua tín dụng',

  // Share dialog.
  'dialog.share.copied': 'Đã sao chép đường liên kết',
  'dialog.share.copyFailed': 'Không sao chép được: hãy chọn đường liên kết và tự sao chép',
  'dialog.share.revoked': 'Đã tắt đường liên kết',
  'dialog.share.title': 'Chia sẻ bảng này',
  'dialog.share.body':
    'Bất kỳ ai có đường liên kết đều có thể xem quảng cáo, xem ảnh và tải mô hình 3D xuống. Họ không thể chỉnh sửa.',
  'dialog.share.creating': 'Đang tạo đường liên kết…',
  'dialog.share.link': 'Đường liên kết chia sẻ',
  'dialog.share.copy': 'Sao chép',
  'dialog.share.views': { other: '{count} lượt xem.' },
  'dialog.share.openPreview': 'Mở bản xem trước',
  'dialog.share.revoke': 'Tắt đường liên kết',

  // Shared UI primitives (packages/ui): the host app passes these in.
  'dialog.close': 'Đóng hộp thoại',
  'dialog.locked': 'Hãy chờ thao tác hiện tại hoàn tất.',
  'dialog.dismiss': 'Bỏ qua',
  'dialog.loading': 'Đang tải',

  // Sign-in prompt (guest tries a paid or cloud action).
  'signin.run.title': 'Đăng nhập để chạy',
  'signin.run.body': {
    other: 'Lượt chạy trọn vẹn đầu tiên của bạn miễn phí ({count} tín dụng). Bảng của bạn được giữ nguyên.',
  },
  'signin.share.title': 'Đăng nhập để chia sẻ',
  'signin.share.body': 'Đường liên kết chia sẻ cần một bảng đã lưu. Bảng của bạn được giữ nguyên.',
  'signin.save.title': 'Đăng nhập để giữ bảng này',
  'signin.save.body': 'Bảng của khách chỉ được lưu trong trình duyệt này.',
  'signin.google': 'Tiếp tục với Google',
  'signin.notNow': 'Để sau',

  // Performance panel (developer tool, ⌥P).
  'perf.title': 'Hiệu năng',
  'perf.copied': 'Đã sao chép báo cáo hiệu năng',
  'perf.copy': 'Sao chép báo cáo',
  'perf.copyHint': 'Sao chép báo cáo (JSON)',
  'perf.close': 'Đóng bảng hiệu năng',
  'perf.pageLoad': 'Tải trang',
  'perf.network': {
    other: '{count} yêu cầu, đã truyền {kb} KB',
  },
  'perf.features': 'Tính năng',
  'perf.action': 'Thao tác',
  'perf.last': 'gần nhất',
  'perf.slowApis': 'Lệnh gọi API chậm nhất',
  'perf.slowFiles': 'Tệp chậm nhất',
  'perf.serverTime': 'Thời gian Worker (Server-Timing)',
  'perf.server': 'srv {time}',
  'perf.ms': '{value} ms',
  'perf.seconds': '{value} s',
  'perf.budget': '≤ {value}',
  'perf.foot':
    'Đo trong trình duyệt này. Ngưỡng: Core Web Vitals (web.dev), RAIL, giới hạn phản hồi của Nielsen. Các số liệu này cũng được gửi lên máy chủ khi bạn rời thẻ.',
  'perf.metric.ttfb': 'Phản hồi máy chủ (TTFB)',
  'perf.metric.fcp': 'Lần vẽ đầu tiên (FCP)',
  'perf.metric.lcp': 'Nội dung chính (LCP)',
  'perf.metric.cls': 'Dịch chuyển bố cục (CLS)',
  'perf.metric.inp': 'Phản hồi tương tác (INP)',
  'perf.metric.boardReady': 'Bảng sẵn sàng sử dụng',
  'perf.metric.boardLoad': 'Tải dữ liệu bảng',
  'perf.metric.clipboardPaste': 'Dán / nhân bản node',
  'perf.metric.imageAdd': 'Dán hoặc thả ảnh',
  'perf.metric.uploadFile': 'Tải tệp lên',
  'perf.metric.editorOpen': 'Mở trình chỉnh sửa 3D',
  'perf.metric.simulatorOpen': 'Mở trình mô phỏng',
  'perf.metric.runStart': 'Bắt đầu chạy (đến sự kiện đầu tiên)',
  'perf.metric.runTotal': 'Chạy đến khi xong',
  'perf.metric.agentFirst': 'Chữ đầu tiên của trợ lý',
  'perf.metric.agentReply': 'Trợ lý trả lời đầy đủ',
  'perf.metric.exportBundle': 'Xuất tệp',
  'perf.metric.undoApply': 'Hoàn tác / làm lại',
  'perf.metric.fileExport': 'Tải xuống .annie3d',
  'perf.metric.fileImport': 'Mở .annie3d',
  'perf.metric.api': 'Lệnh gọi API',

  // Desktop app update pill.
  'update.rolledBack': 'Bản cập nhật {version} không khởi động được nên đã quay về phiên bản trước.',
  'update.shellRequired': 'Cần ứng dụng mới hơn để nhận bản cập nhật mới nhất (ứng dụng {version} trở lên).',
  'update.available': 'Có bản cập nhật',
  'update.restarting': 'Đang khởi động lại…',
  'update.restart': 'Khởi động lại để cập nhật',

  // canvas/FlowNode.tsx: the node card
  'canvas.node.openSim': 'Mở',
  'canvas.node.staleTitle': 'Đầu vào đã thay đổi kể từ phiên bản này',
  'canvas.node.stale': 'cũ',
  'canvas.node.openSimLabel': 'Mở trình mô phỏng',
  'canvas.node.openSimTitle': 'Mở trình mô phỏng (hoặc nhấp đúp)',
  'canvas.node.dropPhoto': 'Thả, dán hoặc nhấp để thêm ảnh',
  'canvas.node.dropMusic': 'Thả tệp nhạc vào đây',
  'canvas.node.dropGlb': 'Thả tệp .glb vào đây',
  'canvas.node.emptyResult': 'Kết quả tạo sẽ hiện ở đây',
  'canvas.node.filesReady': { other: '{count} tệp đã sẵn sàng' },
  'canvas.node.checksPassed': 'Đạt {passed}/{total} bước kiểm tra',
  'canvas.node.checksPassedPreset': 'Đạt {passed}/{total} bước kiểm tra ({preset})',
  'canvas.node.referenceImages': { other: '{count} ảnh tham chiếu' },
  'canvas.node.progress': 'Tiến độ {percent}%',
  'canvas.node.openEditorLabel': 'Mở trình chỉnh sửa 3D',
  'canvas.node.openEditorTitle': 'Mở trình chỉnh sửa 3D (hoặc nhấp đúp)',
  'canvas.node.runFromHere': 'Chạy từ đây',
  'canvas.node.writePlaceholder': 'Viết gì đó…',
  'canvas.node.describePlaceholder': 'Mô tả điều bạn muốn…',
  'canvas.node.runCost': 'Chạy ({credits})',
  'canvas.node.run': 'Chạy',
  'canvas.node.running': 'Đang chạy…',
  'canvas.node.runOptions': 'Tùy chọn chạy',
  'canvas.node.runWithInputs': 'Chạy cùng đầu vào',
  'canvas.node.runNodeOnly': 'Chỉ chạy node này',
  'canvas.node.runDownstream': 'Chạy node này và mọi node phía sau',

  // canvas/FlowNode.tsx: port bubbles (screen-reader name: port and the types it takes)
  'canvas.port.one': '{port} ({type})',
  'canvas.port.two': '{port} ({first} hoặc {second})',
  'canvas.port.many': '{port} ({list} hoặc {last})',
  'canvas.port.separator': ', ',

  // canvas/FlowNode.tsx: settings toolbar under the selected node (screen-reader labels).
  'canvas.toolbar.builder': 'Trình dựng',
  'canvas.toolbar.detail': 'Độ chi tiết',
  'canvas.toolbar.look': 'Phong cách',
  'canvas.toolbar.angles': 'Góc chụp',
  'canvas.toolbar.size': 'Kích thước',
  'canvas.toolbar.motion': 'Chuyển động',
  'canvas.toolbar.aspect': 'Tỷ lệ khung hình',
  'canvas.toolbar.durationSec': 'Thời lượng (giây)',
  'canvas.toolbar.environment': 'Nơi hiển thị',
  'canvas.toolbar.glbPreset': 'Thiết lập sẵn GLB',
  'canvas.toolbar.price': 'Giá',
  'canvas.toolbar.builderAuto': 'Trình dựng: tự động',
  'canvas.toolbar.builderCode': 'Trình dựng: mã',
  'canvas.toolbar.builderGenerative': 'Trình dựng: AI tạo sinh',
  'canvas.toolbar.detailDraft': 'nháp',
  'canvas.toolbar.detailStandard': 'tiêu chuẩn',
  'canvas.toolbar.detailHigh': 'cao',
  'canvas.toolbar.anglesFour': '4 góc',
  'canvas.toolbar.anglesCustom': 'Camera tùy chỉnh',
  'canvas.toolbar.seconds': '{seconds} giây',
  'canvas.toolbar.replace': 'Thay thế',
  'canvas.toolbar.download': 'Tải xuống',
  'canvas.toolbar.deleteNode': 'Xóa node',
  'canvas.toolbar.delete': 'Xóa',
  'canvas.toolbar.more': 'Thao tác khác',
  'canvas.toolbar.duplicate': 'Nhân bản',
  'canvas.toolbar.copy': 'Sao chép',

  // canvas/FlowEdge.tsx
  'canvas.edge.remove': 'Xóa kết nối',
  'canvas.edge.label': 'Kết nối từ {from} đến {to}',

  // canvas/Canvas.tsx: React Flow's screen-reader texts
  'canvas.a11y.nodeDescription':
    'Nhấn Enter hoặc phím cách để chọn node. Nhấn Delete để xóa hoặc Esc để hủy.',
  'canvas.a11y.nodeDescriptionKeyboard':
    'Nhấn Enter hoặc phím cách để chọn node. Sau đó dùng các phím mũi tên để di chuyển node. Nhấn Delete để xóa hoặc Esc để hủy.',
  'canvas.a11y.edgeDescription':
    'Nhấn Enter hoặc phím cách để chọn kết nối. Sau đó nhấn Delete để xóa hoặc Esc để hủy.',
  'canvas.a11y.nodeMoved': 'Đã di chuyển node đang chọn {direction}. Vị trí mới, x: {x}, y: {y}',
  'canvas.a11y.up': 'lên trên',
  'canvas.a11y.down': 'xuống dưới',
  'canvas.a11y.left': 'sang trái',
  'canvas.a11y.right': 'sang phải',

  // canvas/clipboard.ts
  'canvas.imageTooLarge': 'Chỉ thêm được ảnh tối đa {size} MB',

  // lib/agentClient.ts
  'canvas.agentUnavailable': 'Trợ lý không khả dụng ({status})',

  // canvas/example.ts, store/board.ts: board titles and labels the app writes
  'board.example': 'Bảng ví dụ',
  'board.untitled': 'Bảng chưa đặt tên',
  'board.exampleLabel': '{label} ({product})',
  'board.product.serum': 'serum',
  'board.product.headphones': 'tai nghe',
  'board.product.ring': 'nhẫn',

  // lib/runSocket.ts, lib/doc.ts: runs
  'run.queued': 'Đang xếp hàng',
  'run.starting': 'Đang bắt đầu',
  'run.checkFailed': 'Kiểm tra không đạt: {gate}',
  'run.finished': { other: 'Đã chạy xong: dùng {count} tín dụng' },
  'run.finishedWithErrors': {
    other: 'Đã chạy xong nhưng có lỗi: dùng {count} tín dụng',
  },
  'run.failedRefunded': 'Chạy không thành công. Đã hoàn tín dụng.',
  'run.cancelled': {
    other: 'Đã hủy lượt chạy: dùng {count} tín dụng',
  },
  'run.preparing': 'Đang chuẩn bị chạy…',
  'run.couldNotPrepare': 'Không thể chuẩn bị lượt chạy',

  // lib/reel.ts: the process reel (drawn into the video)
  'reel.historyUnavailable': 'Không có lịch sử chạy',
  'reel.couldNotLoadHistory': 'Không tải được lịch sử chạy',
  'reel.howItWasMade': 'QUÁ TRÌNH THỰC HIỆN',
  'reel.madeWith': 'Tạo bằng Annie 3D',
  'reel.tagline': 'Quảng cáo sản phẩm 3D từ một bức ảnh',

  // canvas/actions.ts: uploads
  'file.uploadFailed': 'Tải lên không thành công ({status})',
  'file.partFailed': 'Phần {part} bị lỗi',

  // lib/boardFile.ts: .annie3d board files
  'file.tooLarge': 'Chỉ mở được tệp bảng tối đa {size} GB',
  'file.opened': 'Đã mở {name}',
  'file.couldNotOpen': 'Không mở được tệp',
  'file.notBoardFile': 'Không phải tệp Annie 3D',
  'file.notBoardFileOrNewer': 'Không phải tệp Annie 3D (hoặc là phiên bản mới hơn)',
  'file.noNodes': 'Tệp không có node nào',
  'file.uploadPartFailed': 'Tải lên phần {part} không thành công ({status})',
  'file.couldNotReadResult': 'Không đọc được một kết quả ({status})',
  'file.missing': 'Thiếu {path}',
  'file.boardEmpty': 'Bảng đang trống',

  // lib/doc.ts, lib/webDoc.ts: saving and opening board files
  'file.saving': 'Đang lưu…',
  'file.saved': 'Đã lưu {name}',
  'file.couldNotSave': 'Không lưu được: {reason}',
  'file.noLongerOpen': 'Tệp bảng này không còn mở.',
  'file.typeDescription': 'Bảng Annie 3D',
  'file.writeDenied': 'Chưa được cấp quyền ghi tệp',
  'file.notOpenHere': 'Tệp bảng này không còn mở trong trình duyệt. Hãy mở lại.',
  'file.allowAccess': 'Cho phép truy cập {name} để mở tệp.',
  'file.windowTitle': '{name} – Annie 3D',
  'file.windowTitleUnsaved': '• {name} – Annie 3D',

  // The 3D editor overlay. Header
  'editor.dialog.label': 'Trình chỉnh sửa 3D: {name}',
  'editor.head.back': 'Quay lại khung vẽ',
  'editor.head.notCurrent': '(không phải bản hiện tại)',
  'editor.head.compare': 'So sánh',
  'editor.head.compareHint': 'So sánh song song',
  'editor.head.compareNeedsTwo': 'Cần hai phiên bản để so sánh',
  'editor.head.export': 'Xuất',
  'editor.version': 'v{version}',

  // Tools (left rail); `{key}` is the keyboard shortcut letter.
  'editor.tools.label': 'Công cụ chỉnh sửa',
  'editor.tool.withKey': '{tool} ({key})',
  'editor.tool.orbit': 'Xoay quanh',
  'editor.tool.brush': 'Chọn bằng cọ',
  'editor.tool.lasso': 'Chọn bằng lasso',
  'editor.tool.camera': 'Camera packshot',
  'editor.tool.light': 'Ánh sáng xem trước',
  'editor.tool.clear': 'Bỏ chọn (Delete)',

  // Viewport
  'editor.viewport.label': 'Khung nhìn 3D',
  'editor.viewport.loading': 'Đang tải mô hình…',
  'editor.option.brush': 'Cọ',
  'editor.option.brushSize': 'Cỡ cọ',
  'editor.option.light': 'Ánh sáng',
  'editor.option.lightDirection': 'Hướng sáng',
  'editor.camera.hint': 'Căn khung sản phẩm, rồi {button}',
  'editor.camera.useView': 'Dùng góc nhìn này cho packshot',
  'editor.playback.play': 'Phát',
  'editor.playback.pause': 'Tạm dừng',

  // Version strip; `{source}` is one of editor.versionSource.*.
  'editor.versions.label': 'Phiên bản',
  'editor.versions.itemTitle': '{source}, {date}',
  'editor.versions.makeCurrent': 'Đặt làm bản hiện tại',
  'editor.versionSource.run': 'lượt chạy',
  'editor.versionSource.edit': 'chỉnh sửa',
  'editor.versionSource.upload': 'tải lên',
  'editor.versionSource.agent': 'trợ lý',
  'editor.versionSource.copy': 'bản sao',

  // Edit panel (right)
  'editor.panel.title': 'Chỉnh sửa một vùng',
  'editor.selection.summary': '{regions}, {faces}',
  'editor.selection.regions': { other: '{count} vùng' },
  'editor.selection.faces': { other: '{count} mặt' },
  'editor.panel.stepPaint': '1. Tô hoặc khoanh một vùng trên mô hình',
  'editor.panel.stepDescribe': 'Vùng đã chọn cần thay đổi thế nào?',
  'editor.panel.placeholder': 'Ví dụ: đổi nắp thành màu đen nhám',
  'editor.panel.apply': 'Áp dụng',
  'editor.panel.help':
    'Chỉ các mặt đã chọn thay đổi. Kết quả thành một phiên bản mới; bản cũ vẫn nằm trên dải phiên bản.',

  // Toasts
  'editor.toast.loadFailed': 'Không tải được mô hình: {message}',
  'editor.toast.nowCurrent': 'v{version} giờ là bản hiện tại',
  'editor.toast.cameraSet': {
    other: 'Đã đặt camera packshot cho {count} node',
  },
  'editor.toast.packshotAdded': 'Đã thêm node Packshot với góc nhìn này',
  'editor.toast.readyAgain': 'Đã sẵn sàng: hãy chọn lại vùng rồi nhấn Áp dụng',
  'editor.toast.selectFirst': 'Hãy chọn một vùng trước (bằng cọ hoặc lasso)',

  'editor.packshot.customLabel': 'Packshot (góc tùy chỉnh)',

  // The simulator. What each place is (tab tooltip).
  'sim.envHint.shop': 'Trang sản phẩm của một cửa hàng trực tuyến',
  'sim.envHint.tiktok': 'Bảng tin video dọc kèm thẻ mua hàng',
  'sim.envHint.sticker': 'Nhãn dán trò chuyện với nền trong suốt',
  'sim.envHint.showroom': 'Sân khấu trực tiếp bạn điều khiển bằng điện thoại',
  'sim.product.default': 'Sản phẩm của bạn',

  // Overlay header
  'sim.dialog.label': 'Trình mô phỏng',
  'sim.head.environments': 'Môi trường',
  'sim.head.spin': 'Xoay',
  'sim.head.stopSpin': 'Dừng xoay',
  'sim.head.download': 'Tải xuống PNG',
  'sim.head.close': 'Đóng trình mô phỏng',
  'sim.stage.empty': 'Nối một mô hình 3D vào node này để xem tại đây.',
  'sim.stage.loading': 'Đang tải 3D…',
  'sim.toast.loadFailed': 'Không tải được mô hình 3D: {message}',

  // Shop page mock-up
  'sim.shop.brand': 'THƯƠNG HIỆU',
  'sim.shop.navNew': 'Hàng mới',
  'sim.shop.navShop': 'Cửa hàng',
  'sim.shop.navAbout': 'Giới thiệu',
  'sim.shop.crumb': 'Trang chủ / Hàng mới về',
  'sim.shop.rating': { other: '{rating} ({count} đánh giá)' },
  'sim.shop.description': 'Kéo để xoay sản phẩm. Những gì bạn thấy là sản phẩm 3D thật.',
  'sim.shop.addToCart': 'Thêm vào giỏ',
  'sim.shop.freeShipping': 'Miễn phí vận chuyển cho đơn trên $50',
  'sim.shop.returns': 'Đổi trả trong 30 ngày',

  // TikTok feed mock-up
  'sim.tiktok.following': 'Đang Follow',
  'sim.tiktok.forYou': 'Dành cho bạn',
  'sim.tiktok.share': 'Chia sẻ',
  'sim.tiktok.handle': '@thuonghieucuaban',
  'sim.tiktok.tags': '#fyp #tiktokshop #hangmoi',

  // Chat sticker mock-up
  'sim.sticker.msgAsk': 'thấy mẫu mới ra chưa?? 👀',
  'sim.sticker.msgSend': 'gửi bạn cái sticker nè',
  'sim.sticker.msgReply': 'trời ơi muốn quá 😍',
  'sim.sticker.note':
    'Nhãn dán là khung xem trực tiếp với nền trong suốt: xoay theo ý bạn, rồi tải PNG xuống.',

  // Showroom: phone pairing panel
  'sim.showroom.title': 'Điều khiển bằng điện thoại',
  'sim.showroom.help':
    'Quét bằng điện thoại rồi nghiêng máy: sản phẩm sẽ xoay theo. Hai chiều: điện thoại thấy những gì màn hình này hiển thị.',
  'sim.showroom.localhost':
    'Điện thoại không mở được localhost. Hãy mở bảng này qua đường liên kết {command} để ghép nối điện thoại.',
  'sim.showroom.phones': { other: '{count} điện thoại đã kết nối' },
  'sim.showroom.waiting': 'Đang chờ điện thoại',
  'sim.showroom.pose': 'α {alpha}°, β {beta}°, γ {gamma}°',

  // Shared by the overlay and the phone remote
  'sim.status.connecting': 'Đang kết nối…',
  'sim.action.recenter': 'Căn giữa lại',

  // Phone remote page (/sim/<room>)
  'sim.remote.title': 'Điều khiển Annie 3D',
  'sim.remote.connected': 'Đã kết nối',
  'sim.remote.waitingScreen': 'Đang chờ màn hình',
  'sim.remote.product': 'Sản phẩm',
  'sim.remote.startMotion': 'Bật điều khiển bằng chuyển động',
  'sim.remote.tilt': 'Nghiêng điện thoại để xoay sản phẩm',
  'sim.remote.motionDenied': 'Quyền truy cập chuyển động bị từ chối. Hãy dùng bảng điều khiển bên dưới.',
  'sim.remote.motionUnsupported': 'Thiết bị này không có cảm biến chuyển động. Hãy dùng bảng điều khiển.',
  'sim.remote.padLabel': 'Kéo để xoay sản phẩm',
  'sim.remote.pad': 'Kéo tại đây để xoay',
  'sim.remote.spin': 'Xoay',
  'sim.remote.stop': 'Dừng',
  'sim.remote.snapshot': 'Chụp màn hình',
  'sim.remote.places': 'Nơi hiển thị',
  'sim.remote.snapshotAlt': 'Ảnh chụp từ màn hình',

  // Errors every route can return (lib/http.ts, index.ts)
  'api.error.internal': 'Đã xảy ra lỗi. Hãy thử lại.',
  'api.error.unknownEndpoint': 'Endpoint không xác định',
  'api.http.bodyNotJson': 'Nội dung yêu cầu phải là JSON',
  'api.http.invalidBody': 'Nội dung yêu cầu không hợp lệ',
  'api.http.invalidQuery': 'Truy vấn không hợp lệ',
  'api.http.unknownParam': '{name} không xác định',
  'api.http.notFound': 'Không tìm thấy',
  'api.http.expectedWebSocket': 'Cần nâng cấp kết nối lên WebSocket',

  // Sign-in and roles (lib/session.ts)
  'api.auth.signIn': 'Đăng nhập để tiếp tục',
  'api.auth.viewerCannotEdit': 'Người xem không thể chỉnh sửa',

  // Workspace made at sign-up (auth.ts)
  'api.workspace.named': 'Không gian làm việc của {name}',
  'api.workspace.unnamed': 'Không gian làm việc của tôi',

  // Boards and board edits (routes/boards.ts, services/boards.ts)
  'api.board.notFound': 'Không tìm thấy bảng',
  'api.board.tooManyEdits': 'Quá nhiều thay đổi, hãy chậm lại',
  'api.board.nodeNotFound': 'Không tìm thấy node',
  'api.board.opRejected': 'Thao tác {index} bị từ chối: {reason}',
  'api.board.nodeOfOtherBoard': 'Mã node thuộc về một bảng khác',
  'api.board.uploadNeedsAsset': 'Phiên bản tải lên cần có settings.assetId',
  'api.board.unknownAsset': 'Tệp không xác định',
  'api.board.versionOfOtherNode': 'Phiên bản thuộc về một node khác',
  'api.board.unknownSourceVersion': 'Phiên bản nguồn không xác định',

  // Uploads and files (routes/assets.ts)
  'api.upload.tooMany': 'Quá nhiều lượt tải lên, hãy thử lại sau một phút',
  'api.upload.mimeNotAccepted': '{kind}: không chấp nhận định dạng {mime}',
  'api.upload.tooLarge': '{kind}: tối đa {size} MB',
  'api.upload.assetNotFound': 'Không tìm thấy tệp',
  'api.upload.partsRequired': 'Tệp tải lên nhiều phần đang thiếu các phần',
  'api.upload.notInStorage': 'Không tìm thấy tệp tải lên trong bộ lưu trữ',
  'api.upload.sizeMismatch': 'Kích thước không khớp: cần {expected}, đã lưu {stored}',
  'api.upload.typeMismatch': 'Nội dung tệp không khớp với loại tệp đã khai báo',
  'api.upload.imageTooLarge': 'Ảnh lớn hơn {size} px',
  'api.upload.variantNotFound': 'Không tìm thấy biến thể',

  // Board files (.annie3d) import (routes/boardFile.ts, services/boardImport.ts)
  'api.boardFile.tooManyImports': 'Quá nhiều lượt nhập, hãy chậm lại',
  'api.boardFile.useUpload': 'Gửi tệp trên 80 MB qua /import-upload',
  'api.boardFile.uploadUnfinished': 'Tệp tải lên bị thiếu, chưa hoàn tất hoặc đã được nhập',
  'api.boardFile.uploadMissing': 'Thiếu tệp tải lên',
  'api.boardFile.uploadGone': 'Tệp đã tải lên không còn nữa',
  'api.boardFile.checksum': '{name} không khớp với mã kiểm tra (checksum)',
  'api.boardFile.missingEntry': 'Thiếu {path}',
  'api.boardFile.notBoardFile': 'Không phải tệp Annie 3D',
  'api.boardFile.newerVersion': 'Không phải tệp Annie 3D (hoặc là phiên bản mới hơn)',
  'api.boardFile.noNodes': 'Tệp không có node nào',
  'api.boardFile.unknownNodes': 'Kết quả thuộc về các node không có trong bảng này',
  'api.boardFile.tooLarge': 'Tệp lớn hơn 2 GB',
  'api.boardFile.multiPart': 'Tệp nén nhiều phần không phải tệp bảng',
  'api.boardFile.zip64': 'Tệp nén ZIP64 không phải tệp bảng',
  'api.boardFile.tooManyEntries': 'Tệp có quá nhiều mục',
  'api.boardFile.damaged': 'Tệp bị hỏng',
  'api.boardFile.encrypted': 'Tệp đã mã hóa không phải tệp bảng',
  'api.boardFile.duplicateEntry': 'Mục {name} bị trùng',
  'api.boardFile.unsupportedCompression': 'Kiểu nén không được hỗ trợ',
  'api.boardFile.manifestTooLarge': 'Phần mô tả bảng quá lớn',
  'api.boardFile.unexpectedEntry': 'Mục không mong đợi: {name}',
  'api.boardFile.entryCompressed': '{name} đã bị nén; tệp bảng lưu phương tiện ở dạng gốc',
  'api.boardFile.unreadable': 'Không đọc được tệp: {reason}',

  // Runs (routes/runs.ts, routes/credits.ts)
  'api.run.notFound': 'Không tìm thấy lượt chạy',
  'api.run.tooMany': 'Quá nhiều lượt chạy. Hãy chờ một phút.',
  'api.run.alreadyRunning': 'Bảng này đang có một lượt chạy',
  'api.run.notEnoughCredits': 'Không đủ tín dụng cho lượt chạy này',
  'api.run.nothingToRun': 'Không có gì để chạy: hãy thêm một node có thể chạy',
  'api.run.upToDate': 'Mọi thứ đều đã cập nhật',
  'api.run.editNeedsModel': 'Chỉnh sửa vùng chỉ áp dụng cho node Mô hình 3D',
  'api.run.versionNotOnNode': 'Không tìm thấy phiên bản trên node này',
  'api.run.selectRegion': 'Hãy chọn một vùng trước',

  // Run steps, sent over the run's WebSocket (services/runner.ts, engines/*)
  'api.run.connectFirst': 'Hãy nối “{port}” trước',
  'api.run.noEngine': 'Không có công cụ cho {kind}',
  'api.run.baseHasNoModel': 'Phiên bản gốc không có mô hình',
  'api.run.baseModelMissing': 'Thiếu tệp mô hình gốc',
  'api.run.selectionExpired': 'Vùng chọn đã hết hạn; hãy chọn lại vùng',
  'api.run.inputNotFound': 'Không tìm thấy tệp đầu vào',
  'api.run.inputMissingInStorage': 'Thiếu tệp đầu vào trong bộ lưu trữ',
  'api.run.gateFailed': 'Bước kiểm tra chất lượng “{gate}” không đạt',
  'api.run.needsPhotoOrText': 'Hãy thêm ảnh sản phẩm hoặc mô tả',
  'api.run.regionNotOnVersion': 'Vùng đã chọn không có trên phiên bản này',

  // Progress stages of the engines (engines/simulator.ts, engines/registry.ts, engines/export.ts)
  'api.stage.model3d.readingPhotos': 'Đang đọc ảnh',
  'api.stage.model3d.segmenting': 'Đang tách sản phẩm',
  'api.stage.model3d.estimatingShape': 'Đang ước tính hình dạng',
  'api.stage.model3d.buildingMesh': 'Đang dựng lưới',
  'api.stage.model3d.bakingTextures': 'Đang bake texture',
  'api.stage.model3d.checkingSilhouette': 'Đang kiểm tra đường viền',
  'api.stage.stage.readingBrief': 'Đang đọc yêu cầu',
  'api.stage.stage.blockingSet': 'Đang dựng khung bối cảnh',
  'api.stage.stage.lighting': 'Đang chiếu sáng',
  'api.stage.stage.placingProduct': 'Đang đặt sản phẩm',
  'api.stage.stage.testRender': 'Kết xuất thử',
  'api.stage.packshot.framing': 'Đang căn khung camera',
  'api.stage.packshot.renderingFront': 'Đang kết xuất mặt trước',
  'api.stage.packshot.renderingAngles': 'Đang kết xuất các góc',
  'api.stage.packshot.denoising': 'Đang khử nhiễu',
  'api.stage.adVideo.storyboard': 'Kịch bản phân cảnh',
  'api.stage.adVideo.cameraMoves': 'Chuyển động camera',
  'api.stage.adVideo.renderingFrames': 'Đang kết xuất khung hình',
  'api.stage.adVideo.addingHeadline': 'Đang thêm tiêu đề',
  'api.stage.adVideo.mixingMusic': 'Đang phối nhạc',
  'api.stage.adVideo.encoding': 'Đang mã hóa',
  'api.stage.export.packaging': 'Đang đóng gói',
  'api.stage.export.validating': 'Đang kiểm định glTF',
  'api.stage.export.writing': 'Đang ghi tệp',
  'api.stage.working': 'Đang xử lý',
  'api.stage.done': 'Xong',
  'api.stage.edit.readingSelection': 'Đang đọc vùng chọn',
  'api.stage.edit.applying': 'Đang áp dụng chỉnh sửa',
  'api.stage.edit.checking': 'Đang kiểm tra kết quả',
  'api.stage.export.optimising': 'Đang tối ưu cho {preset}',
  'api.stage.export.collecting': 'Đang gom tệp',
  'api.stage.export.exported': 'Đã xuất',
  'api.stage.export.exportedWithFailures': 'Đã xuất, có bước kiểm tra không đạt',

  // Quality gates and export checks by id (`step.failed.gate`, version gates `<preset>:<id>`)
  'api.gate.inputs': 'Đầu vào',
  'api.gate.selection': 'Vùng chọn',
  'api.gate.silhouette_iou': 'Khớp đường viền',
  'api.gate.watertight': 'Lưới kín',
  'api.gate.triangles': 'Số tam giác',
  'api.gate.product_visible': 'Sản phẩm hiển thị rõ',
  'api.gate.framing': 'Bố cục khung hình',
  'api.gate.duration_ok': 'Thời lượng',
  'api.gate.loudness_lufs': 'Độ lớn âm thanh',
  'api.gate.edit_applied': 'Đã áp dụng chỉnh sửa',
  'api.gate.bytes': 'Dung lượng tệp',
  'api.gate.texture': 'Kích thước texture',
  'api.gate.animation': 'Hoạt ảnh',
  'api.gate.validator': 'Kiểm định glTF',

  // Exports (routes/exports.ts, services/exporter.ts)
  'api.export.notFound': 'Không tìm thấy bản xuất',
  'api.export.noModelYet': 'Node này chưa có mô hình để xuất',
  'api.export.wrongNode': 'Hãy xuất một node Mô hình 3D hoặc Xuất tệp',
  'api.export.nothingToExport': 'Không có gì để xuất: hãy nối một mô hình 3D, video hoặc hình ảnh',
  'api.export.failed': 'Xuất không thành công: {reason}',
  'api.export.megabytes': '{value} MB',
  'api.export.checkBytes': '{size} / {limit}',
  'api.export.checkTriangles': '{count} / {limit} tam giác',
  'api.export.checkTexture': 'Texture lớn nhất {size}px (giới hạn {limit}px)',
  'api.export.checkNoTextures': 'Không có texture ảnh',
  'api.export.checkAnimation': { other: '{count} đoạn hoạt ảnh' },
  'api.export.checkAnimationNeeded': 'Cần một hoạt ảnh (ví dụ: bàn xoay)',
  'api.export.checkAnimationOptional': {
    other: '{count} đoạn hoạt ảnh, không bắt buộc',
  },
  'api.export.checkValid': 'Đọc lại là glTF 2.0 hợp lệ',
  'api.export.checkInvalid': 'Không phải glTF hợp lệ: {reason}',
  'api.export.checkRoundTrip': 'Kiểm tra đọc lại không thành công: {reason}',

  // Shares (routes/shares.ts; the share page's own text is `share.*`)
  'api.share.versionNotFound': 'Không tìm thấy phiên bản',
  'api.share.changed': 'Lượt chia sẻ đã thay đổi, hãy thử lại',
  'api.share.notFound': 'Không tìm thấy lượt chia sẻ',
  'api.share.unavailable': 'Đường liên kết này không khả dụng',
  'api.share.anonymousOwner': 'Người dùng Annie 3D',

  // Plans and the simulated checkout page (routes/credits.ts)
  'api.plan.creator': 'Creator',
  'api.plan.studio': 'Studio',
  'api.checkout.invalidSignature': 'Chữ ký thanh toán không hợp lệ',
  'api.checkout.expired': 'Phiên thanh toán đã hết hạn',
  'api.checkout.otherWorkspace': 'Phiên thanh toán thuộc về một không gian làm việc khác',
  'api.checkout.invalidLink': 'Đường liên kết thanh toán không hợp lệ',
  'api.checkout.pageTitle': 'Thanh toán · Annie 3D',
  'api.checkout.simulated':
    'Thanh toán mô phỏng: không có thẻ nào bị trừ tiền. Trang này sẽ được thay bằng nhà cung cấp thanh toán thật.',
  'api.checkout.planName': 'Gói {plan}',
  'api.checkout.creditsMonthly': { other: '{count} tín dụng mỗi tháng' },
  'api.checkout.dueToday': 'Thanh toán hôm nay',
  'api.checkout.pay': 'Thanh toán {price}',
  'api.checkout.cancel': 'Hủy và quay lại',

  // Reels (routes/reels.ts)
  'api.reel.serverNotAttached':
    'Chưa hỗ trợ kết xuất video hậu trường trên máy chủ; hãy ghi video trong trình duyệt',
  'api.reel.afterRun': 'Hãy tạo video hậu trường sau khi lượt chạy hoàn tất',
  'api.reel.uploadFirst': 'Hãy tải video hậu trường đã ghi lên trước',

  // Simulation remote link (routes/sim.ts)
  'api.sim.badRoom': 'Mã phòng không hợp lệ',

  // Agent route (routes/agent.ts)
  'api.agent.tooMany': 'Quá nhiều tin nhắn. Hãy chờ một phút.',
  'api.agent.threadNotFound': 'Không tìm thấy cuộc trò chuyện',
  'api.agent.couldNotApply': 'Không áp dụng được “{label}”: {reason}',
  'api.agent.upToDate': 'Mọi thứ đều đã cập nhật nên không có gì được chạy.',
  'api.agent.overBudget': {
    other:
      'Lượt chạy đó cần {count} tín dụng, vượt ngân sách {budget} của tin nhắn này. Hãy tăng ngân sách rồi hỏi lại.',
  },
  'api.agent.couldNotStart': 'Tôi không bắt đầu chạy được: {reason}',

  // Simulated agent's replies and change labels (agents/simulated.ts). The simulated agent
  // only understands English commands, so the command words stay English in quotes.
  'api.agent.help':
    'Tôi có thể đổi phong cách của Bối cảnh (dark lab, stone & water, velvet, pastel splash, botanical, studio), làm ấm hơn hoặc lạnh hơn (warmer, cooler), đặt video dài 6, 10 hoặc 15 giây, chuyển sang 9:16, 1:1 hoặc 16:9, đổi chuyển động, đặt tiêu đề ("headline: ..."), thêm packshot, chọn thiết lập sẵn khi xuất tệp và chạy. Hãy chọn node trước để chỉ cho tôi luồng cần sửa. Hiện tôi chỉ hiểu lệnh bằng tiếng Anh.',
  'api.agent.ambiguous': {
    other: 'Có {count} node {kind}. Hãy chọn node bạn muốn (hoặc một node trong luồng của nó) rồi hỏi lại.',
  },
  'api.agent.noNode': 'Chưa có node {kind} nào nên tôi đã bỏ qua “{change}”.',
  'api.agent.alreadySet': { other: '{nodes} đã có {value}.' },
  'api.agent.changeOn': '{nodes}: {change}',
  'api.agent.change.look': 'phong cách → {value}',
  'api.agent.change.direction': 'chỉ đạo: {value}',
  'api.agent.change.duration': 'thời lượng → {value}',
  'api.agent.change.aspect': 'tỷ lệ khung hình → {value}',
  'api.agent.change.motion': 'chuyển động → {value}',
  'api.agent.change.detail': 'độ chi tiết → {value}',
  'api.agent.change.preset': 'thiết lập sẵn → {value}',
  'api.agent.change.headline': 'Tiêu đề → “{text}”',
  'api.agent.change.addPackshot': 'Đã thêm node Packshot từ {node}',
  'api.agent.value.seconds': '{seconds} giây',
  'api.agent.value.secondsClosest': '{seconds} giây (gần nhất với {wanted} giây)',
  'api.agent.value.detailHigh': 'cao',
  'api.agent.value.detailDraft': 'nháp',
  'api.agent.ambiguousHeadline': {
    other: 'Có {count} tiêu đề. Hãy chọn luồng bạn muốn rồi hỏi lại.',
  },
  'api.agent.pickModel': 'Hãy chọn mô hình 3D dùng để tạo packshot.',
  'api.agent.packshotLabel': 'Packshot (trợ lý)',
  'api.agent.done': 'Xong:',
  'api.agent.madeChanges': { other: 'Tôi đã thực hiện {count} thay đổi:' },
  'api.agent.runningChanged': 'Đang chạy phần đã thay đổi; node không đổi vẫn dùng bộ nhớ đệm.',
  'api.agent.runningBoard': 'Đang chạy bảng; node không đổi vẫn dùng bộ nhớ đệm.',
  'api.agent.sayRun': 'Hãy nói “run it” khi bạn muốn xem kết quả.',

  // The desktop shell (apps/desktop). macOS application menu ({app} is "Annie 3D").
  'desktop.menu.about': 'Giới thiệu về {app}',
  'desktop.menu.services': 'Dịch vụ',
  'desktop.menu.hide': 'Ẩn {app}',
  'desktop.menu.hideOthers': 'Ẩn các ứng dụng khác',
  'desktop.menu.showAll': 'Hiện tất cả',
  'desktop.menu.quitApp': 'Thoát {app}',
  // File
  'desktop.menu.file': 'Tệp',
  'desktop.menu.newBoardFile': 'Tệp bảng mới',
  'desktop.menu.open': 'Mở…',
  'desktop.menu.openRecent': 'Mở mục gần đây',
  'desktop.menu.clearRecent': 'Xóa menu',
  'desktop.menu.save': 'Lưu',
  'desktop.menu.saveAs': 'Lưu thành…',
  'desktop.menu.importIntoBoard': 'Nhập vào bảng này…',
  'desktop.menu.closeWindow': 'Đóng cửa sổ',
  'desktop.menu.quit': 'Thoát',
  'desktop.menu.exit': 'Thoát',
  // Edit
  'desktop.menu.edit': 'Sửa',
  'desktop.menu.undo': 'Hoàn tác',
  'desktop.menu.redo': 'Làm lại',
  'desktop.menu.cut': 'Cắt',
  'desktop.menu.copy': 'Sao chép',
  'desktop.menu.paste': 'Dán',
  'desktop.menu.selectAll': 'Chọn tất cả',
  // View
  'desktop.menu.view': 'Xem',
  'desktop.menu.reload': 'Tải lại',
  'desktop.menu.toggleDevTools': 'Bật/tắt công cụ nhà phát triển',
  'desktop.menu.toggleFullScreen': 'Bật/tắt toàn màn hình',
  // Window
  'desktop.menu.window': 'Cửa sổ',
  'desktop.menu.minimize': 'Thu nhỏ',
  'desktop.menu.zoom': 'Thu phóng',
  'desktop.menu.bringAllToFront': 'Đưa tất cả ra trước',
  'desktop.menu.close': 'Đóng',
  // Help
  'desktop.menu.help': 'Trợ giúp',
  'desktop.menu.website': 'Trang web {app}',

  // Board files as documents
  'desktop.doc.untitled': 'Chưa đặt tên.annie3d',
  'desktop.doc.fileType': 'Bảng Annie 3D',
  'desktop.close.message': 'Bạn có muốn lưu các thay đổi đã thực hiện trong “{name}” không?',
  'desktop.close.detail': 'Các thay đổi sẽ bị mất nếu bạn không lưu.',
  'desktop.close.dontSave': 'Không lưu',
  'desktop.open.failed': 'Không mở được “{name}”',

  // Why a board file was refused ({name} is a path inside the file)
  'desktop.file.tooLarge': 'Tệp lớn hơn 2 GB',
  'desktop.file.notBoard': 'Không phải tệp Annie 3D',
  'desktop.file.notBoardOrNewer': 'Không phải tệp Annie 3D (hoặc là phiên bản mới hơn)',
  'desktop.file.damaged': 'Tệp bị hỏng',
  'desktop.file.invalidDescription': 'Phần mô tả bảng không hợp lệ',
  'desktop.file.multiPart': 'Tệp nén nhiều phần không phải tệp bảng',
  'desktop.file.zip64': 'Tệp nén ZIP64 không phải tệp bảng',
  'desktop.file.tooManyEntries': 'Tệp có quá nhiều mục',
  'desktop.file.encrypted': 'Tệp đã mã hóa không phải tệp bảng',
  'desktop.file.duplicateEntry': 'Mục {name} bị trùng',
  'desktop.file.unsupportedCompression': 'Kiểu nén không được hỗ trợ',
  'desktop.file.descriptionTooLarge': 'Phần mô tả bảng quá lớn',
  'desktop.file.unexpectedEntry': 'Mục không mong đợi: {name}',
  'desktop.file.compressedMedia': '{name} đã bị nén; tệp bảng lưu phương tiện ở dạng gốc',
  'desktop.file.invalidBoard': 'Bảng không hợp lệ',
  'desktop.file.invalidAsset': 'Tệp {name} không hợp lệ',
  'desktop.file.missingAsset': 'Thiếu {name}',
  'desktop.file.boardTooLarge': 'Bảng lớn hơn 2 GB',
  'desktop.file.needsBytes': 'Mỗi tệp đều cần có dữ liệu',

  // The static site (apps/site) and the public share page. Every page
  'site.meta.pageTitle': '{title} · Annie 3D',
  'site.nav.skipToContent': 'Chuyển đến nội dung',
  'site.nav.homeLabel': 'Trang chủ Annie 3D',
  'site.nav.openCanvas': 'Mở khung vẽ',
  'site.nav.footer': 'Chân trang',
  'site.nav.canvas': 'Khung vẽ',
  'site.nav.privacy': 'Quyền riêng tư',
  'site.nav.terms': 'Điều khoản',
  'site.nav.contact': 'Liên hệ',
  'site.nav.languages': 'Ngôn ngữ',
  'site.footer.copyright': '© 2026 Annie 3D, Úc.',

  // /home
  'site.home.title': 'Quảng cáo sản phẩm 3D từ một bức ảnh',
  'site.home.description':
    'Annie 3D biến một bức ảnh sản phẩm thành mô hình 3D thật, video quảng cáo, packshot ở mọi góc và GLB có hoạt ảnh, ngay trên khung vẽ bạn mở được mà không cần đăng ký.',
  'site.home.eyebrow': 'Không gian làm quảng cáo 3D',
  'site.home.headline': 'Một ảnh sản phẩm vào. Một quảng cáo 3D ra.',
  'site.home.lead':
    'Thả ảnh sản phẩm lên khung vẽ. Annie 3D dựng sản phẩm thành mô hình 3D thật, rồi tạo cho bạn video quảng cáo, packshot từ mọi góc, GLB có hoạt ảnh cho cửa hàng và một đường liên kết ai cũng mở được. Vì mọi đầu ra đều từ cùng một mô hình, sản phẩm của bạn trông chuẩn xác ở tất cả.',
  'site.home.whatEyebrow': 'Bạn nhận được gì',
  'site.home.whatTitle': 'Tất cả từ một mô hình',
  'site.home.videosTitle': 'Video quảng cáo',
  'site.home.videosBody':
    'Tháo rời từng lớp cho đồ công nghệ, đá và nước cho trang sức, tung nước nổi bật cho mỹ phẩm, ở tỷ lệ 1:1, 4:5 và 9:16.',
  'site.home.packshotsTitle': 'Packshot ở mọi góc',
  'site.home.packshotsBody': 'Tự căn khung camera hoặc dùng bốn góc chụp tiêu chuẩn.',
  'site.home.glbTitle': 'GLB có hoạt ảnh',
  'site.home.glbBody':
    'Được kiểm tra theo giới hạn của web, Google Merchant và Google Swirl trước khi bạn tải xuống.',
  'site.home.howEyebrow': 'Cách hoạt động',
  'site.home.howTitle': 'Khung vẽ gồm các node bạn tự nối lại được',
  'site.home.howBody':
    'Bắt đầu từ một sơ đồ dựng sẵn hoặc tự thêm node: ảnh, văn bản, mô hình 3D, bối cảnh, packshot, video quảng cáo và xuất tệp. Chọn một vùng trên mô hình và mô tả thay đổi; mỗi lần chỉnh sửa tạo ra một phiên bản mới để bạn so sánh hoặc hoàn tác.',
  'site.home.tryExample': 'Dùng thử bảng ví dụ',

  // /legal/*
  'site.legal.draft': 'Bản nháp cho giai đoạn tiền phát hành · sẽ được luật sư rà soát trước khi ra mắt',
  'site.legal.translationNotice':
    'Bản dịch này được cung cấp để thuận tiện cho bạn. Nếu có khác biệt so với bản tiếng Anh, bản tiếng Anh sẽ được áp dụng.',
  'site.legal.readEnglish': 'Đọc bản tiếng Anh',

  'site.terms.title': 'Điều khoản sử dụng',
  'site.terms.description': 'Điều khoản sử dụng Annie 3D.',
  'site.terms.contentTitle': 'Nội dung của bạn',
  'site.terms.contentBody':
    'Bạn giữ quyền đối với ảnh bạn tải lên và các đầu ra bạn tạo. Chỉ tải lên những sản phẩm bạn có quyền quảng cáo.',
  'site.terms.useTitle': 'Sử dụng được chấp nhận',
  'site.terms.useBody':
    'Không sử dụng Annie 3D để tạo quảng cáo sản phẩm giả mạo, mạo danh thương hiệu hoặc cá nhân, hoặc tạo nội dung trái pháp luật.',
  'site.terms.creditsTitle': 'Tín dụng',
  'site.terms.creditsBody':
    'Mỗi lượt chạy sử dụng tín dụng. Lượt chạy không vượt qua các bước kiểm tra chất lượng của chúng tôi sẽ được hoàn tín dụng tự động.',
  'site.terms.preReleaseTitle': 'Tiền phát hành',
  'site.terms.preReleaseBody':
    'Các tính năng có thể thay đổi. Chúng tôi sẽ thông báo những thay đổi ảnh hưởng đến dữ liệu của bạn trước khi chúng có hiệu lực.',

  'site.privacy.title': 'Thông báo về quyền riêng tư',
  'site.privacy.description': 'Cách Annie 3D xử lý dữ liệu của bạn.',
  'site.privacy.whoTitle': 'Chúng tôi là ai',
  'site.privacy.whoBody': 'Annie 3D được vận hành từ Úc. Liên hệ: {email}.',
  'site.privacy.storeTitle': 'Chúng tôi lưu trữ những gì',
  'site.privacy.storeBody':
    'Tên tài khoản Google, địa chỉ email và ảnh hồ sơ của bạn khi bạn đăng nhập; các bảng, node, câu lệnh và phiên bản bạn tạo; tệp bạn tải lên và tệp chúng tôi tạo cho bạn; lịch sử chạy và các giao dịch tín dụng.',
  'site.privacy.whereTitle': 'Dữ liệu được lưu trữ ở đâu',
  'site.privacy.whereBody':
    'Dữ liệu tài khoản và bảng được lưu trong cơ sở dữ liệu Postgres do Neon lưu trữ tại Sydney, Úc. Tệp được lưu trong kho lưu trữ đối tượng Cloudflare R2 tại khu vực châu Đại Dương. Các trang được phân phối qua mạng lưới của Cloudflare.',
  'site.privacy.cookiesTitle': 'Cookie',
  'site.privacy.cookiesBody':
    'Một cookie phiên của bên thứ nhất giúp bạn duy trì đăng nhập, và một cookie của bên thứ nhất ghi nhớ ngôn ngữ bạn chọn. Chúng tôi không sử dụng cookie quảng cáo.',
  'site.privacy.sharingTitle': 'Chia sẻ',
  'site.privacy.sharingBody':
    'Không có gì được công khai trừ khi bạn tạo đường liên kết chia sẻ. Bạn có thể thu hồi đường liên kết bất cứ lúc nào.',
  'site.privacy.deleteTitle': 'Xóa dữ liệu của bạn',
  'site.privacy.deleteBody':
    'Xóa bảng ngay trên khung vẽ, hoặc gửi email cho chúng tôi để xóa tài khoản và toàn bộ tệp của bạn.',

  // Public share page rendered by the Worker (/s/<token>)
  'share.unavailableTitle': 'Đường liên kết không khả dụng',
  'share.unavailableHeading': 'Đường liên kết này không khả dụng',
  'share.unavailableBody': 'Có thể chủ sở hữu đã thu hồi đường liên kết này.',
  'share.openApp': 'Mở Annie 3D',
  'share.makeYours': 'Tạo của riêng bạn miễn phí',
  'share.description': '{owner} đã tạo nội dung này bằng Annie 3D: quảng cáo sản phẩm 3D từ một bức ảnh.',
  'share.by': 'của {owner}',
  'share.modelAlt': 'Bản xem trước mô hình 3D',
  'share.modelTitle': 'Mô hình 3D',
  'share.triangles': { other: '{count} tam giác' },
  'share.megabytes': '{size} MB',
  'share.downloadGlb': 'Tải xuống GLB',
  'share.madeWith': 'Tạo bằng {brand}',
  'share.terms': 'Điều khoản',
};

/** Keys whose correct Vietnamese is the English text (names, loanwords). */
export const sameAsEnglish: readonly string[] = [
  'node.packshot',
  'port.adVideo.logo',
  'port.simulation.logo',
  'dialog.billing.plan.creator',
  'dialog.billing.plan.studio',
  'api.plan.creator',
  'api.plan.studio',
  'perf.server',
  'perf.ms',
  'perf.seconds',
  'perf.budget',
  'canvas.port.one',
  'board.exampleLabel',
  'board.product.serum',
  'file.windowTitle',
  'file.windowTitleUnsaved',
  'editor.version',
  'editor.tool.withKey',
  'editor.versions.itemTitle',
  'editor.selection.summary',
  'sim.showroom.pose',
  'api.agent.changeOn',
  'api.export.megabytes',
  'dialog.export.megabytes',
  'share.megabytes',
  'site.meta.pageTitle',
  'portType.video',
  'port.adVideo.out',
  'dialog.run.ok',
];

export default catalog;
