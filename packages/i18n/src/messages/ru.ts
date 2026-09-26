import type { Catalog } from '../index';

/**
 * Russian. Glossary (keep these choices when adding keys):
 * board = доска, node = узел, wire / connection = связь, run = запуск / запустить,
 * credits = кредиты, Stage = сцена (Scene port = сцена), Packshot = пэкшот,
 * Ad video = рекламный ролик, Export = экспорт, Simulation = симуляция (simulator = симулятор),
 * Starter / template = шаблон, preset = пресет, look = стиль, motion = движение (камеры),
 * version = версия, Annie = Annie (never translated, never declined), canvas = холст,
 * product = товар, input = вход / входные данные, output = результат, line (of nodes) = цепочка,
 * region = область, face = грань, selection = выделение, plan = тариф, share link = ссылка для доступа,
 * environment / place = площадка, reel = ролик, gate / check = проверка, Builder = конструктор,
 * detail = детализация (черновая / стандартная / высокая), aspect = формат, angle = ракурс,
 * workspace = рабочее пространство, asset = файл, prompt = промпт.
 * Byte units МБ / КБ / ГБ; px and ms stay Latin; seconds = «с». The demo agent's command words stay English. Annie speaks in the feminine first person.
 */
const catalog: Catalog = {
  // common
  'common.credits': {
    one: '{count} кредит',
    few: '{count} кредита',
    many: '{count} кредитов',
    other: '{count} кредита',
  },
  'common.cancel': 'Отмена',
  'common.close': 'Закрыть',
  'common.save': 'Сохранить',
  'common.done': 'Готово',
  'common.retry': 'Повторить',
  'common.language': 'Язык',
  'common.brand': 'Annie 3D',

  // contracts
  'node.photo': 'Фото',
  'node.text': 'Текст',
  'node.upload3d': 'Загрузка 3D',
  'node.audio': 'Музыка',
  'node.model3d': '3D-модель',
  'node.stage': 'Сцена',
  'node.packshot': 'Пэкшот',
  'node.adVideo': 'Рекламный ролик',
  'node.export': 'Экспорт',
  'node.simulation': 'Симуляция',
  'node.note': 'Заметка',

  'engine.photo': 'Загрузка',
  'engine.text': 'Текст',
  'engine.upload3d': 'Загрузка',
  'engine.audio': 'Загрузка',
  'engine.model3d': 'Конструктор',
  'engine.stage': 'Постановщик сцены',
  'engine.packshot': 'Рендерер',
  'engine.adVideo': 'Рендерер',
  'engine.export': 'Упаковщик',
  'engine.simulation': 'Живой просмотр',
  'engine.note': 'Заметка',

  'category.input': 'Ввод',
  'category.build': 'Создание',
  'category.stage': 'Сцена',
  'category.output': 'Результаты',
  'category.note': 'Заметки',

  'port.photo.out': 'Изображение',
  'port.text.out': 'Текст',
  'port.upload3d.out': '3D-модель',
  'port.audio.out': 'Аудио',
  'port.model3d.images': 'Фото',
  'port.model3d.prompt': 'Описание',
  'port.model3d.out': '3D-модель',
  'port.stage.model': '3D-модель',
  'port.stage.prompt': 'Указания',
  'port.stage.style': 'Референс стиля',
  'port.stage.out': 'Сцена',
  'port.packshot.subject': 'Модель или сцена',
  'port.packshot.out': 'Изображения',
  'port.adVideo.subject': 'Сцена или модель',
  'port.adVideo.headline': 'Заголовок',
  'port.adVideo.logo': 'Логотип',
  'port.adVideo.music': 'Музыка',
  'port.adVideo.out': 'Видео',
  'port.export.items': 'Результаты',
  'port.export.out': 'Файлы',
  'port.simulation.subject': 'Модель или сцена',
  'port.simulation.headline': 'Заголовок',
  'port.simulation.logo': 'Логотип',

  'portType.image': 'Изображение',
  'portType.text': 'Текст',
  'portType.model3d': '3D-модель',
  'portType.scene': 'Сцена',
  'portType.video': 'Видео',
  'portType.audio': 'Аудио',
  'portType.file': 'Файл',

  'look.studio-light': 'Студийный свет',
  'look.dark-lab': 'Тёмная лаборатория',
  'look.stone-water': 'Камень и вода',
  'look.velvet': 'Бархат',
  'look.splash-pastel': 'Пастельный всплеск',
  'look.podium-botanical': 'Подиум и растения',

  'motion.turntable': 'Вращение',
  'motion.hero-orbit': 'Облёт',
  'motion.teardown-reveal': 'Разбор по деталям',
  'motion.stone-water': 'Камень и вода',
  'motion.splash-hero': 'Всплеск',

  'glbPreset.web': 'Веб / магазин',
  'glbPreset.google_merchant': 'Google Merchant',
  'glbPreset.google_swirl': 'Google Swirl',

  'simEnv.shop': 'Магазин',
  'simEnv.tiktok': 'TikTok',
  'simEnv.sticker': 'Стикер',
  'simEnv.showroom': 'Шоурум',

  'starter.teardown-reveal.title': 'Разбор по деталям',
  'starter.teardown-reveal.vertical': 'Электроника',
  'starter.teardown-reveal.description': 'Товар разбирается слой за слоем, замирает и снова собирается.',
  'starter.teardown-reveal.headline': 'Продумано до последнего винтика',
  'starter.stone-water.title': 'Камень и вода',
  'starter.stone-water.vertical': 'Украшения',
  'starter.stone-water.description':
    'Украшение лежит на мокром камне у тонкого водопада; медленный наезд камеры, блики.',
  'starter.stone-water.headline': 'Создано, чтобы замечали',
  'starter.splash-hero.title': 'Всплеск',
  'starter.splash-hero.vertical': 'Косметика',
  'starter.splash-hero.description': 'Флакон поднимается сквозь всплеск своего цвета и опускается на подиум.',
  'starter.splash-hero.headline': 'Встречайте новую формулу',
  'starter.node.photo': 'Фото товара',
  'starter.node.headline': 'Заголовок',
  'starter.node.pack': 'Пэкшоты',

  'setting.simulation.cta': 'Купить',

  // chrome
  // App shell (App.tsx): loading splash, lazy overlays, checkout return.
  'app.canvas': 'Холст доски',
  'app.loading': 'Загрузка доски…',
  'app.docAccess': 'Открыть {name}',
  'app.opening3d': 'Открытие 3D…',
  'app.openingSimulator': 'Открытие симулятора…',
  'app.error3d': 'Не удалось запустить 3D-просмотр: {message}',
  'app.checkoutDone': 'Оплата прошла. Кредиты начислены.',
  'app.board.firstTitle': 'Моя первая доска',

  // Top bar: logo, title, save state.
  'topbar.home': 'Главная Annie 3D',
  'topbar.title': 'Название доски',
  'topbar.save.saved': 'Сохранено',
  'topbar.save.saving': 'Сохранение…',
  'topbar.save.offline': 'Офлайн, сохраним позже',
  'topbar.save.error': 'Повтор…',
  'topbar.save.edited': 'Изменено',
  'topbar.save.notSaved': 'Не сохранено',
  'topbar.save.noFile': 'Ещё не сохранено в файл',
  'topbar.save.guest': 'Сохранено в этом браузере',
  'topbar.save.guestHint': 'Войдите, чтобы хранить доску в аккаунте',

  // Top bar: board file ("…") menu.
  'topbar.file.menu': 'Файл доски',
  'topbar.file.save': 'Сохранить',
  'topbar.file.saveAsFile': 'Сохранить в файл…',
  'topbar.file.saveAs': 'Сохранить как…',
  'topbar.file.open': 'Открыть…',
  'topbar.file.new': 'Новый файл доски',
  'topbar.file.import': 'Импорт в эту доску…',
  'topbar.file.download': 'Скачать доску (.annie3d)',
  'topbar.file.openFile': 'Открыть файл доски…',

  // Top bar: templates, run all, zoom.
  'topbar.templates': 'Шаблоны',
  'topbar.running': 'Выполняется…',
  'topbar.runAll': 'Запустить все',
  'topbar.runAllHint': 'Неизменённые узлы бесплатны; точная стоимость — перед подтверждением',
  'topbar.upToDate': 'Всё актуально',
  'topbar.zoomOut': 'Уменьшить',
  'topbar.zoomIn': 'Увеличить',
  'topbar.zoomLevel': 'Масштаб {percent}, вписать в экран',
  'topbar.fitToScreen': 'Вписать в экран (Shift+1)',

  // Top bar: account, credits, share.
  'topbar.creditsHint': 'Кредиты и тариф',
  'topbar.signIn': 'Войти',
  'topbar.share': 'Поделиться',
  'topbar.shareFile': 'Файл доски передаётся как файл: отправьте сам файл .annie3d.',
  'topbar.account': 'Аккаунт',
  'topbar.accountOf': 'Аккаунт: {name}',
  'topbar.creditsAndPlan': 'Кредиты и тариф',
  'topbar.signOut': 'Выйти',

  // Language picker (top bar and the file menu).
  'lang.button': 'Язык: {language}',

  // Bottom toolbar.
  'toolbar.label': 'Инструменты холста',
  'toolbar.select': 'Выбор (V)',
  'toolbar.hand': 'Рука (H)',
  'toolbar.add': 'Добавить: {name}',
  'toolbar.moreNodes': 'Другие узлы (N)',
  'toolbar.undo': 'Отменить (⌘Z)',
  'toolbar.redo': 'Повторить (⇧⌘Z)',
  'toolbar.askAnnie': 'Спросить Annie',

  // Add-node palette.
  'palette.label': 'Добавить узел',
  'palette.search': 'Добавить узел…',
  'palette.searchLabel': 'Поиск узлов',
  'palette.list': 'Узлы',
  'palette.starters': 'Шаблоны',
  'palette.starter': 'Шаблон «{title}»',
  'palette.noMatch': 'Нет узлов по запросу «{query}».',
  'palette.accepts.image': 'Узлы, принимающие изображение…',
  'palette.accepts.text': 'Узлы, принимающие текст…',
  'palette.accepts.model3d': 'Узлы, принимающие 3D-модель…',
  'palette.accepts.scene': 'Узлы, принимающие сцену…',
  'palette.accepts.video': 'Узлы, принимающие видео…',
  'palette.accepts.audio': 'Узлы, принимающие аудио…',
  'palette.accepts.file': 'Узлы, принимающие файл…',

  // Right-click menu on the canvas.
  'menu.canvas': 'Меню холста',
  'menu.runNode': 'Запустить этот узел',
  'menu.openEditor': 'Открыть 3D-редактор',
  'menu.export': 'Экспорт и скачивание…',
  'menu.copy': 'Копировать',
  'menu.duplicate': 'Дублировать',
  'menu.delete': 'Удалить',
  'menu.addNode': 'Добавить узел…',
  'menu.paste': 'Вставить сюда',
  'menu.duplicateSelected': {
    one: 'Дублировать выбранное ({count})',
    few: 'Дублировать выбранное ({count})',
    many: 'Дублировать выбранное ({count})',
    other: 'Дублировать выбранное ({count})',
  },
  'menu.deleteSelected': {
    one: 'Удалить выбранное ({count})',
    few: 'Удалить выбранное ({count})',
    many: 'Удалить выбранное ({count})',
    other: 'Удалить выбранное ({count})',
  },

  // Agent dock (Ask Annie).
  'agent.title': 'Спросить Annie',
  'agent.close': 'Закрыть агента',
  'agent.intro': 'Annie меняет эту доску за вас: узлы, настройки и связи. ⌘Z отменяет её правки.',
  'agent.suggestion.warmerStage': 'Сделай сцену теплее и добавь ролик на 6 секунд',
  'agent.suggestion.fourAngles': 'Добавь пэкшот с четырёх ракурсов',
  'agent.suggestion.softerLight': 'Сделай свет на 3D-модели мягче',
  'agent.undoHint': 'Отменить: ⌘Z',
  'agent.thinking': 'Думаю…',
  'agent.input': 'Сообщение агенту',
  'agent.placeholder': 'Опишите изменение…',
  'agent.budget': 'Бюджет',
  'agent.budgetLabel': 'Бюджет в кредитах',
  'agent.send': 'Отправить',
  'agent.boardEdited': 'Доска изменена',
  'agent.failed': 'Не получилось: {message}',

  // Shared dialog words.
  'dialog.download': 'Скачать',

  // Billing dialog.
  'dialog.billing.title': 'Кредиты',
  'dialog.billing.guest': {
    one: 'Войдите и получите {count} бесплатный кредит — хватит на один полный запуск.',
    few: 'Войдите и получите {count} бесплатных кредита — хватит на один полный запуск.',
    many: 'Войдите и получите {count} бесплатных кредитов — хватит на один полный запуск.',
    other: 'Войдите и получите {count} бесплатного кредита — хватит на один полный запуск.',
  },
  'dialog.billing.signIn': 'Войти',
  'dialog.billing.balance': {
    one: '{balance} кредит',
    few: '{balance} кредита',
    many: '{balance} кредитов',
    other: '{balance} кредита',
  },
  'dialog.billing.held': {
    one: '({count} в резерве у текущего запуска)',
    few: '({count} в резерве у текущих запусков)',
    many: '({count} в резерве у текущих запусков)',
    other: '({count} в резерве у текущих запусков)',
  },
  'dialog.billing.plan.free': 'Бесплатный',
  'dialog.billing.plan.creator': 'Creator',
  'dialog.billing.plan.studio': 'Studio',
  'dialog.billing.firstRunFree': {
    one: 'Первый запуск — бесплатно ({count} кредит в подарок).',
    few: 'Первый запуск — бесплатно ({count} кредита в подарок).',
    many: 'Первый запуск — бесплатно ({count} кредитов в подарок).',
    other: 'Первый запуск — бесплатно ({count} кредита в подарок).',
  },
  'dialog.billing.chargedOnSuccess': 'Кредиты списываются только за успешные шаги; шаги из кэша бесплатны.',
  'dialog.billing.perMonth': '/мес.',
  'dialog.billing.creditsPerMonth': {
    one: '{count} кредит в месяц',
    few: '{count} кредита в месяц',
    many: '{count} кредитов в месяц',
    other: '{count} кредита в месяц',
  },
  'dialog.billing.openingCheckout': 'Переход к оплате…',
  'dialog.billing.addCredits': 'Добавить кредиты',
  'dialog.billing.choose': 'Выбрать «{plan}»',
  'dialog.billing.history': 'История',
  'dialog.billing.reason.grantFree': 'Бесплатные кредиты',
  'dialog.billing.reason.purchase': 'Покупка тарифа',
  'dialog.billing.reason.subscription': 'Ежемесячные кредиты',
  'dialog.billing.reason.runReserve': 'Запуск (резерв)',
  'dialog.billing.reason.runSettle': 'Списание за запуск',
  'dialog.billing.reason.runRefund': 'Возврат',
  'dialog.billing.reason.adjust': 'Корректировка',

  // Export dialog.
  'dialog.export.noNode': 'Выберите узел «3D-модель» или «Экспорт».',
  'dialog.export.titleBundle': 'Экспорт пакета',
  'dialog.export.titleModel': 'Экспорт 3D-модели',
  'dialog.export.preset': 'Пресет',
  'dialog.export.limits': 'До {size}, треугольников: до {triangles}, текстуры до {texture} px',
  'dialog.export.limitsAnimated':
    'До {size}, треугольников: до {triangles}, текстуры до {texture} px, с анимацией',
  'dialog.export.megabytes': '{size} МБ',
  'dialog.export.includeVideo': 'Рекламный ролик (MP4)',
  'dialog.export.includeImages': 'Изображения (PNG)',
  'dialog.export.ready': 'Подходит для «{preset}»',
  'dialog.export.notReady': 'Пока не подходит для «{preset}»',
  'dialog.export.passed': 'пройдено',
  'dialog.export.failed': 'не пройдено',
  'dialog.export.zip': 'Все файлы (.zip)',
  'dialog.export.glb': 'Модель GLB',
  'dialog.export.exporting': 'Экспорт…',
  'dialog.export.run': 'Экспорт (бесплатно)',

  // Process reel dialog.
  'dialog.reel.button': 'Ролик о процессе',
  'dialog.reel.hint': 'Видео 9:16: сверху реклама, снизу — как она сделана',
  'dialog.reel.title': 'Ролик о процессе',
  'dialog.reel.intro': 'Видео 9:16 для Reels и TikTok: сверху ваша реклама, снизу — как Annie 3D её сделала.',
  'dialog.reel.preview': 'Превью ролика',
  'dialog.reel.recording': 'Запись… {percent}',
  'dialog.reel.saving': 'Сохранение…',
  'dialog.reel.record': 'Записать ролик',

  // Run dialog (cost before charging).
  'dialog.run.inProgress': 'На этой доске уже идёт запуск',
  'dialog.run.checking': 'Расчёт стоимости…',
  'dialog.run.estimateFailed': 'Не удалось оценить стоимость запуска.',
  'dialog.run.upToDate': 'Всё актуально',
  'dialog.run.allCached': {
    one: 'Результаты для текущих входных данных уже есть: {count} узел. Измените промпт, настройку или вход, чтобы запустить снова.',
    few: 'Результаты для текущих входных данных уже есть: {count} узла. Измените промпт, настройку или вход, чтобы запустить снова.',
    many: 'Результаты для текущих входных данных уже есть: {count} узлов. Измените промпт, настройку или вход, чтобы запустить снова.',
    other:
      'Результаты для текущих входных данных уже есть: {count} узла. Измените промпт, настройку или вход, чтобы запустить снова.',
  },
  'dialog.run.ok': 'ОК',
  'dialog.run.titleOne': 'Запуск: {name}',
  'dialog.run.titleMany': {
    one: 'Запустить {count} узел',
    few: 'Запустить {count} узла',
    many: 'Запустить {count} узлов',
    other: 'Запустить {count} узла',
  },
  'dialog.run.cached': {
    one: '{count} узел без изменений: результат используется повторно',
    few: '{count} узла без изменений: результаты используются повторно',
    many: '{count} узлов без изменений: результаты используются повторно',
    other: '{count} узла без изменений: результаты используются повторно',
  },
  'dialog.run.free': 'бесплатно',
  'dialog.run.total': 'Итого',
  'dialog.run.balance': {
    one: 'Баланс: {count} кредит.',
    few: 'Баланс: {count} кредита.',
    many: 'Баланс: {count} кредитов.',
    other: 'Баланс: {count} кредита.',
  },
  'dialog.run.firstRunFree': 'Первый запуск — бесплатно.',
  'dialog.run.refunded': 'Кредиты за неудачные шаги возвращаются.',
  'dialog.run.starting': 'Запуск…',
  'dialog.run.run': 'Запустить',
  'dialog.run.getCredits': 'Получить кредиты',

  // Share dialog.
  'dialog.share.copied': 'Ссылка скопирована',
  'dialog.share.copyFailed': 'Не удалось скопировать: выделите ссылку и скопируйте её',
  'dialog.share.revoked': 'Ссылка отключена',
  'dialog.share.title': 'Поделиться доской',
  'dialog.share.body':
    'Любой, у кого есть ссылка, сможет посмотреть рекламу и изображения и скачать 3D-модель. Редактировать доску нельзя.',
  'dialog.share.creating': 'Создание ссылки…',
  'dialog.share.link': 'Ссылка для доступа',
  'dialog.share.copy': 'Копировать',
  'dialog.share.views': {
    one: '{count} просмотр.',
    few: '{count} просмотра.',
    many: '{count} просмотров.',
    other: '{count} просмотра.',
  },
  'dialog.share.openPreview': 'Открыть превью',
  'dialog.share.revoke': 'Отключить ссылку',

  // Shared UI primitives (packages/ui): the host app passes these in.
  'dialog.close': 'Закрыть окно',
  'dialog.locked': 'Дождитесь завершения текущего действия.',
  'dialog.dismiss': 'Скрыть',
  'dialog.loading': 'Загрузка',

  // Sign-in prompt (guest tries a paid or cloud action).
  'signin.run.title': 'Войдите, чтобы запустить',
  'signin.run.body': {
    one: 'Первый полный запуск — бесплатно ({count} кредит). Доска останется с вами.',
    few: 'Первый полный запуск — бесплатно ({count} кредита). Доска останется с вами.',
    many: 'Первый полный запуск — бесплатно ({count} кредитов). Доска останется с вами.',
    other: 'Первый полный запуск — бесплатно ({count} кредита). Доска останется с вами.',
  },
  'signin.share.title': 'Войдите, чтобы поделиться',
  'signin.share.body': 'Для ссылки нужна сохранённая доска. Доска останется с вами.',
  'signin.save.title': 'Войдите, чтобы сохранить доску',
  'signin.save.body': 'Гостевые доски хранятся только в этом браузере.',
  'signin.google': 'Продолжить с Google',
  'signin.notNow': 'Не сейчас',

  // Performance panel (developer tool, ⌥P).
  'perf.title': 'Производительность',
  'perf.copied': 'Отчёт о производительности скопирован',
  'perf.copy': 'Копировать отчёт',
  'perf.copyHint': 'Копировать отчёт (JSON)',
  'perf.close': 'Закрыть панель производительности',
  'perf.pageLoad': 'Загрузка страницы',
  'perf.network': {
    one: '{count} запрос, передано {kb} КБ',
    few: '{count} запроса, передано {kb} КБ',
    many: '{count} запросов, передано {kb} КБ',
    other: '{count} запроса, передано {kb} КБ',
  },
  'perf.features': 'Функции',
  'perf.action': 'Действие',
  'perf.last': 'посл.',
  'perf.slowApis': 'Самые медленные вызовы API',
  'perf.slowFiles': 'Самые медленные файлы',
  'perf.serverTime': 'Время Worker (Server-Timing)',
  'perf.server': 'сервер {time}',
  'perf.ms': '{value} ms',
  'perf.seconds': '{value} с',
  'perf.budget': '≤ {value}',
  'perf.foot':
    'Измерено в этом браузере. Нормы: Core Web Vitals (web.dev), RAIL, пороги отклика Нильсена. Эти же данные отправляются на сервер, когда вы уходите со вкладки.',
  'perf.metric.ttfb': 'Ответ сервера (TTFB)',
  'perf.metric.fcp': 'Первая отрисовка (FCP)',
  'perf.metric.lcp': 'Основной контент (LCP)',
  'perf.metric.cls': 'Сдвиг макета (CLS)',
  'perf.metric.inp': 'Отклик на ввод (INP)',
  'perf.metric.boardReady': 'Доска готова к работе',
  'perf.metric.boardLoad': 'Загрузка данных доски',
  'perf.metric.clipboardPaste': 'Вставка / дублирование узлов',
  'perf.metric.imageAdd': 'Вставка или перетаскивание изображения',
  'perf.metric.uploadFile': 'Загрузка файла',
  'perf.metric.editorOpen': 'Открытие 3D-редактора',
  'perf.metric.simulatorOpen': 'Открытие симулятора',
  'perf.metric.runStart': 'Старт запуска (до первого события)',
  'perf.metric.runTotal': 'Запуск до завершения',
  'perf.metric.agentFirst': 'Первые слова агента',
  'perf.metric.agentReply': 'Полный ответ агента',
  'perf.metric.exportBundle': 'Экспорт файлов',
  'perf.metric.undoApply': 'Отмена / повтор',
  'perf.metric.fileExport': 'Скачивание .annie3d',
  'perf.metric.fileImport': 'Открытие .annie3d',
  'perf.metric.api': 'Вызов API',

  // Desktop app update pill.
  'update.rolledBack': 'Обновление {version} не запустилось, поэтому возвращена предыдущая версия.',
  'update.shellRequired': 'Для последнего обновления нужна более новая версия приложения ({version}+).',
  'update.available': 'Доступно обновление',
  'update.restarting': 'Перезапуск…',
  'update.restart': 'Перезапустить',

  // canvas
  // canvas/FlowNode.tsx: the node card
  'canvas.node.openSim': 'Открыть',
  'canvas.node.staleTitle': 'Входные данные изменились после этой версии',
  'canvas.node.stale': 'устарело',
  'canvas.node.openSimLabel': 'Открыть симулятор',
  'canvas.node.openSimTitle': 'Открыть симулятор (или двойной щелчок)',
  'canvas.node.dropPhoto': 'Перетащите, вставьте или нажмите, чтобы добавить фото',
  'canvas.node.dropMusic': 'Перетащите музыкальный файл',
  'canvas.node.dropGlb': 'Перетащите файл .glb',
  'canvas.node.emptyResult': 'Здесь появится результат',
  'canvas.node.filesReady': {
    one: 'Готов {count} файл',
    few: 'Готовы {count} файла',
    many: 'Готово {count} файлов',
    other: 'Готово {count} файла',
  },
  'canvas.node.checksPassed': 'Пройдено проверок: {passed}/{total}',
  'canvas.node.checksPassedPreset': 'Пройдено проверок: {passed}/{total} ({preset})',
  'canvas.node.referenceImages': {
    one: '{count} референс',
    few: '{count} референса',
    many: '{count} референсов',
    other: '{count} референса',
  },
  'canvas.node.progress': 'Прогресс {percent}%',
  'canvas.node.openEditorLabel': 'Открыть 3D-редактор',
  'canvas.node.openEditorTitle': 'Открыть 3D-редактор (или двойной щелчок)',
  'canvas.node.runFromHere': 'Запустить отсюда',
  'canvas.node.writePlaceholder': 'Напишите что-нибудь…',
  'canvas.node.describePlaceholder': 'Опишите, что вам нужно…',
  'canvas.node.runCost': 'Запустить ({credits})',
  'canvas.node.run': 'Запустить',
  'canvas.node.running': 'Выполняется…',
  'canvas.node.runOptions': 'Параметры запуска',
  'canvas.node.runWithInputs': 'Запустить со входами',
  'canvas.node.runNodeOnly': 'Запустить только этот узел',
  'canvas.node.runDownstream': 'Запустить этот и все следующие',

  // canvas/FlowNode.tsx: port bubbles (screen-reader name: port and the types it takes)
  'canvas.port.one': '{port} ({type})',
  'canvas.port.two': '{port} ({first} или {second})',
  'canvas.port.many': '{port} ({list} или {last})',
  'canvas.port.separator': ', ',

  // canvas/FlowNode.tsx: settings toolbar under the selected node. The select names are
  // screen-reader labels; tests find the Builder select by the English name "builder".
  'canvas.toolbar.builder': 'Конструктор',
  'canvas.toolbar.detail': 'Детализация',
  'canvas.toolbar.look': 'Стиль',
  'canvas.toolbar.angles': 'Ракурсы',
  'canvas.toolbar.size': 'Размер',
  'canvas.toolbar.motion': 'Движение',
  'canvas.toolbar.aspect': 'Формат',
  'canvas.toolbar.durationSec': 'Длительность (секунды)',
  'canvas.toolbar.environment': 'Площадка',
  'canvas.toolbar.glbPreset': 'Пресет GLB',
  'canvas.toolbar.price': 'Цена',
  'canvas.toolbar.builderAuto': 'Конструктор: авто',
  'canvas.toolbar.builderCode': 'Конструктор: код',
  'canvas.toolbar.builderGenerative': 'Конструктор: генеративный',
  'canvas.toolbar.detailDraft': 'черновая',
  'canvas.toolbar.detailStandard': 'стандартная',
  'canvas.toolbar.detailHigh': 'высокая',
  'canvas.toolbar.anglesFour': '4 ракурса',
  'canvas.toolbar.anglesCustom': 'Своя камера',
  'canvas.toolbar.seconds': '{seconds} с',
  'canvas.toolbar.replace': 'Заменить',
  'canvas.toolbar.download': 'Скачать',
  'canvas.toolbar.deleteNode': 'Удалить узел',
  'canvas.toolbar.delete': 'Удалить',
  'canvas.toolbar.more': 'Ещё',
  'canvas.toolbar.duplicate': 'Дублировать',
  'canvas.toolbar.copy': 'Копировать',

  // canvas/FlowEdge.tsx
  'canvas.edge.remove': 'Удалить связь',
  'canvas.edge.label': 'Связь: {from} → {to}',

  // canvas/Canvas.tsx: React Flow's screen-reader texts
  'canvas.a11y.nodeDescription':
    'Нажмите Enter или пробел, чтобы выбрать узел. Нажмите Delete, чтобы удалить его, или Esc, чтобы отменить.',
  'canvas.a11y.nodeDescriptionKeyboard':
    'Нажмите Enter или пробел, чтобы выбрать узел. Затем его можно перемещать клавишами со стрелками. Нажмите Delete, чтобы удалить его, или Esc, чтобы отменить.',
  'canvas.a11y.edgeDescription':
    'Нажмите Enter или пробел, чтобы выбрать связь. Затем нажмите Delete, чтобы удалить её, или Esc, чтобы отменить.',
  'canvas.a11y.nodeMoved': 'Выбранный узел перемещён: {direction}. Новая позиция: x {x}, y {y}',
  'canvas.a11y.up': 'вверх',
  'canvas.a11y.down': 'вниз',
  'canvas.a11y.left': 'влево',
  'canvas.a11y.right': 'вправо',

  // canvas/clipboard.ts
  'canvas.imageTooLarge': 'Можно добавлять изображения до {size} МБ',

  // lib/agentClient.ts
  'canvas.agentUnavailable': 'Агент недоступен ({status})',

  // canvas/example.ts, store/board.ts: board titles and labels the app writes
  'board.example': 'Пример доски',
  'board.untitled': 'Доска без названия',
  'board.exampleLabel': '{label} ({product})',
  'board.product.serum': 'сыворотка',
  'board.product.headphones': 'наушники',
  'board.product.ring': 'кольцо',

  // lib/runSocket.ts, lib/doc.ts: runs
  'run.queued': 'В очереди',
  'run.starting': 'Запуск',
  'run.checkFailed': 'Проверка не пройдена: {gate}',
  'run.finished': {
    one: 'Запуск завершён: потрачен {count} кредит',
    few: 'Запуск завершён: потрачено {count} кредита',
    many: 'Запуск завершён: потрачено {count} кредитов',
    other: 'Запуск завершён: потрачено {count} кредита',
  },
  'run.finishedWithErrors': {
    one: 'Запуск завершён с ошибками: потрачен {count} кредит',
    few: 'Запуск завершён с ошибками: потрачено {count} кредита',
    many: 'Запуск завершён с ошибками: потрачено {count} кредитов',
    other: 'Запуск завершён с ошибками: потрачено {count} кредита',
  },
  'run.failedRefunded': 'Запуск не удался. Кредиты возвращены.',
  'run.cancelled': {
    one: 'Запуск отменён: потрачен {count} кредит',
    few: 'Запуск отменён: потрачено {count} кредита',
    many: 'Запуск отменён: потрачено {count} кредитов',
    other: 'Запуск отменён: потрачено {count} кредита',
  },
  'run.preparing': 'Подготовка к запуску…',
  'run.couldNotPrepare': 'Не удалось подготовить запуск',

  // lib/reel.ts: the process reel (drawn into the video)
  'reel.historyUnavailable': 'История запусков недоступна',
  'reel.couldNotLoadHistory': 'Не удалось загрузить историю запусков',
  'reel.howItWasMade': 'КАК ЭТО СДЕЛАНО',
  'reel.madeWith': 'Сделано в Annie 3D',
  'reel.tagline': '3D-реклама товара по одному фото',

  // canvas/actions.ts: uploads
  'file.uploadFailed': 'Не удалось загрузить ({status})',
  'file.partFailed': 'Ошибка в части {part}',

  // lib/boardFile.ts: .annie3d board files
  'file.tooLarge': 'Можно открыть файлы досок до {size} ГБ',
  'file.opened': 'Открыт файл {name}',
  'file.couldNotOpen': 'Не удалось открыть файл',
  'file.notBoardFile': 'Это не файл Annie 3D',
  'file.notBoardFileOrNewer': 'Это не файл Annie 3D (или файл более новой версии)',
  'file.noNodes': 'В файле нет узлов',
  'file.uploadPartFailed': 'Не удалось загрузить часть {part} ({status})',
  'file.couldNotReadResult': 'Не удалось прочитать результат ({status})',
  'file.missing': 'Отсутствует {path}',
  'file.boardEmpty': 'Доска пуста',

  // lib/doc.ts, lib/webDoc.ts: saving and opening board files
  'file.saving': 'Сохранение…',
  'file.saved': 'Сохранено: {name}',
  'file.couldNotSave': 'Не удалось сохранить: {reason}',
  'file.noLongerOpen': 'Этот файл доски больше не открыт.',
  'file.typeDescription': 'Доска Annie 3D',
  'file.writeDenied': 'Нет разрешения на запись файла',
  'file.notOpenHere': 'Этот файл доски больше не открыт в этом браузере. Откройте его снова.',
  'file.allowAccess': 'Разрешите доступ к файлу {name}, чтобы открыть его.',
  'file.windowTitle': '{name} – Annie 3D',
  'file.windowTitleUnsaved': '• {name} – Annie 3D',

  // editor
  // Header
  'editor.dialog.label': '3D-редактор: {name}',
  'editor.head.back': 'Назад к холсту',
  'editor.head.notCurrent': '(не текущая)',
  'editor.head.compare': 'Сравнить',
  'editor.head.compareHint': 'Сравнить рядом',
  'editor.head.compareNeedsTwo': 'Для сравнения нужны две версии',
  'editor.head.export': 'Экспорт',
  /** A version number, as on the version strip and the title. */
  'editor.version': 'v{version}',

  // Tools (left rail); `{key}` is the keyboard shortcut letter.
  'editor.tools.label': 'Инструменты редактора',
  'editor.tool.withKey': '{tool} ({key})',
  'editor.tool.orbit': 'Орбита',
  'editor.tool.brush': 'Выделение кистью',
  'editor.tool.lasso': 'Выделение лассо',
  'editor.tool.camera': 'Камера пэкшота',
  'editor.tool.light': 'Свет превью',
  'editor.tool.clear': 'Снять выделение (Delete)',

  // Viewport
  'editor.viewport.label': '3D-просмотр',
  'editor.viewport.loading': 'Загрузка модели…',
  'editor.option.brush': 'Кисть',
  'editor.option.brushSize': 'Размер кисти',
  'editor.option.light': 'Свет',
  'editor.option.lightDirection': 'Направление света',
  /** `{button}` is the "Use this view for packshots" button. */
  'editor.camera.hint': 'Выберите кадр, затем нажмите {button}',
  'editor.camera.useView': 'Использовать вид для пэкшотов',
  'editor.playback.play': 'Воспроизвести',
  'editor.playback.pause': 'Пауза',

  // Version strip; `{source}` is one of editor.versionSource.*.
  'editor.versions.label': 'Версии',
  'editor.versions.itemTitle': '{source}, {date}',
  'editor.versions.makeCurrent': 'Сделать текущей',
  'editor.versionSource.run': 'запуск',
  'editor.versionSource.edit': 'правка',
  'editor.versionSource.upload': 'загрузка',
  'editor.versionSource.agent': 'агент',
  'editor.versionSource.copy': 'копия',

  // Edit panel (right)
  'editor.panel.title': 'Правка области',
  /** `{regions}` and `{faces}` are editor.selection.regions and editor.selection.faces. */
  'editor.selection.summary': '{regions}, {faces}',
  'editor.selection.regions': {
    one: '{count} область',
    few: '{count} области',
    many: '{count} областей',
    other: '{count} области',
  },
  'editor.selection.faces': {
    one: '{count} грань',
    few: '{count} грани',
    many: '{count} граней',
    other: '{count} грани',
  },
  'editor.panel.stepPaint': '1. Закрасьте или обведите область на модели',
  'editor.panel.stepDescribe': 'Что изменить в выделенной области?',
  'editor.panel.placeholder': 'Например: сделать крышку матовой чёрной',
  'editor.panel.apply': 'Применить',
  'editor.panel.help':
    'Меняются только выделенные грани. Результат станет новой версией, а прежняя останется в ленте.',

  // Toasts
  'editor.toast.loadFailed': 'Не удалось загрузить модель: {message}',
  'editor.toast.nowCurrent': 'v{version} теперь текущая',
  'editor.toast.cameraSet': {
    one: 'Камера пэкшота задана для {count} узла',
    few: 'Камера пэкшота задана для {count} узлов',
    many: 'Камера пэкшота задана для {count} узлов',
    other: 'Камера пэкшота задана для {count} узла',
  },
  'editor.toast.packshotAdded': 'Добавлен узел пэкшота с этим видом',
  'editor.toast.readyAgain': 'Готово: снова выделите область и нажмите «Применить»',
  'editor.toast.selectFirst': 'Сначала выделите область (кистью или лассо)',

  /** Label of the packshot node the camera tool creates. */
  'editor.packshot.customLabel': 'Пэкшот (свой вид)',

  // sim
  // What each place is (tab tooltip).
  'sim.envHint.shop': 'Карточка товара в интернет-магазине',
  'sim.envHint.tiktok': 'Вертикальная лента с карточкой товара',
  'sim.envHint.sticker': 'Стикер для чата с прозрачным фоном',
  'sim.envHint.showroom': 'Живая витрина, которой вы управляете с телефона',
  /** Title when nothing names the product (no headline, no custom label). */
  'sim.product.default': 'Ваш товар',

  // Overlay header
  'sim.dialog.label': 'Симулятор',
  'sim.head.environments': 'Площадка',
  'sim.head.spin': 'Вращать',
  'sim.head.stopSpin': 'Остановить',
  'sim.head.download': 'Скачать PNG',
  'sim.head.close': 'Закрыть симулятор',
  'sim.stage.empty': 'Подключите к этому узлу 3D-модель, чтобы увидеть её здесь.',
  'sim.stage.loading': 'Загрузка 3D…',
  'sim.toast.loadFailed': 'Не удалось загрузить 3D-модель: {message}',

  // Shop page mock-up
  'sim.shop.brand': 'БРЕНД',
  'sim.shop.navNew': 'Новинки',
  'sim.shop.navShop': 'Каталог',
  'sim.shop.navAbout': 'О нас',
  'sim.shop.crumb': 'Главная / Новинки',
  'sim.shop.rating': {
    one: '{rating} ({count} отзыв)',
    few: '{rating} ({count} отзыва)',
    many: '{rating} ({count} отзывов)',
    other: '{rating} ({count} отзыва)',
  },
  'sim.shop.description': 'Потяните, чтобы повернуть. Перед вами настоящая 3D-модель товара.',
  'sim.shop.addToCart': 'В корзину',
  'sim.shop.freeShipping': 'Бесплатная доставка от $50',
  'sim.shop.returns': 'Возврат в течение 30 дней',

  // TikTok feed mock-up
  'sim.tiktok.following': 'Подписки',
  'sim.tiktok.forYou': 'Рекомендации',
  'sim.tiktok.share': 'Поделиться',
  'sim.tiktok.handle': '@yourbrand',
  'sim.tiktok.tags': '#рекомендации #tiktokshop #новинки',

  // Chat sticker mock-up
  'sim.sticker.msgAsk': 'видела новинку?? 👀',
  'sim.sticker.msgSend': 'кидаю тебе стикер',
  'sim.sticker.msgReply': 'омг хочу 😍',
  'sim.sticker.note': 'Стикер — это живой вид с прозрачным фоном: поверните его и скачайте PNG.',

  // Showroom: phone pairing panel
  'sim.showroom.title': 'Пульт на телефоне',
  'sim.showroom.help':
    'Отсканируйте код телефоном и наклоняйте его — товар повторит движение. Связь двусторонняя: телефон видит то же, что этот экран.',
  /** `{command}` is the command name `pnpm share`. */
  'sim.showroom.localhost':
    'Телефон не может открыть localhost. Откройте доску по ссылке из {command}, чтобы подключить телефон.',
  'sim.showroom.phones': {
    one: 'Подключён {count} телефон',
    few: 'Подключено {count} телефона',
    many: 'Подключено {count} телефонов',
    other: 'Подключено {count} телефона',
  },
  'sim.showroom.waiting': 'Ожидание телефона',
  'sim.showroom.pose': 'α {alpha}°, β {beta}°, γ {gamma}°',

  // Shared by the overlay and the phone remote
  'sim.status.connecting': 'Подключение…',
  'sim.action.recenter': 'Центрировать',

  // Phone remote page (/sim/<room>)
  'sim.remote.title': 'Пульт Annie 3D',
  'sim.remote.connected': 'Подключено',
  'sim.remote.waitingScreen': 'Ожидание экрана',
  'sim.remote.product': 'Товар',
  'sim.remote.startMotion': 'Включить управление наклоном',
  'sim.remote.tilt': 'Наклоняйте телефон, чтобы повернуть товар',
  'sim.remote.motionDenied': 'Доступ к датчикам движения запрещён. Используйте панель ниже.',
  'sim.remote.motionUnsupported': 'На этом устройстве нет датчика движения. Используйте панель.',
  'sim.remote.padLabel': 'Потяните, чтобы повернуть товар',
  'sim.remote.pad': 'Тяните здесь, чтобы повернуть',
  'sim.remote.spin': 'Вращать',
  'sim.remote.stop': 'Стоп',
  'sim.remote.snapshot': 'Снимок',
  'sim.remote.places': 'Площадка',
  'sim.remote.snapshotAlt': 'Снимок с экрана',

  // api
  // Errors every route can return (lib/http.ts, index.ts)
  'api.error.internal': 'Что-то пошло не так. Попробуйте ещё раз.',
  'api.error.unknownEndpoint': 'Неизвестный эндпоинт',
  'api.http.bodyNotJson': 'Тело запроса должно быть в формате JSON',
  'api.http.invalidBody': 'Недопустимое тело запроса',
  'api.http.invalidQuery': 'Недопустимые параметры запроса',
  'api.http.unknownParam': 'Неизвестное значение {name}',
  'api.http.notFound': 'Не найдено',
  'api.http.expectedWebSocket': 'Ожидалось подключение по WebSocket',

  // Sign-in and roles (lib/session.ts)
  'api.auth.signIn': 'Войдите, чтобы продолжить',
  'api.auth.viewerCannotEdit': 'С правами на просмотр редактировать нельзя',

  // Workspace made at sign-up (auth.ts)
  'api.workspace.named': 'Рабочее пространство: {name}',
  'api.workspace.unnamed': 'Моё рабочее пространство',

  // Boards and board edits (routes/boards.ts, services/boards.ts)
  'api.board.notFound': 'Доска не найдена',
  'api.board.tooManyEdits': 'Слишком много правок, подождите немного',
  'api.board.nodeNotFound': 'Узел не найден',
  'api.board.opRejected': 'Операция {index} отклонена: {reason}',
  'api.board.nodeOfOtherBoard': 'ID узла относится к другой доске',
  'api.board.uploadNeedsAsset': 'Для версий-загрузок нужен settings.assetId',
  'api.board.unknownAsset': 'Неизвестный файл',
  'api.board.versionOfOtherNode': 'Версия относится к другому узлу',
  'api.board.unknownSourceVersion': 'Неизвестная исходная версия',

  // Uploads and files (routes/assets.ts)
  'api.upload.tooMany': 'Слишком много загрузок, повторите через минуту',
  'api.upload.mimeNotAccepted': '{mime} не подходит для типа «{kind}»',
  'api.upload.tooLarge': 'Для типа «{kind}» — не больше {size} МБ',
  'api.upload.assetNotFound': 'Файл не найден',
  'api.upload.partsRequired': 'Для загрузки по частям нужны её части',
  'api.upload.notInStorage': 'Загрузка не найдена в хранилище',
  'api.upload.sizeMismatch': 'Размер не совпадает: ожидалось {expected}, сохранено {stored}',
  'api.upload.typeMismatch': 'Содержимое файла не соответствует заявленному типу',
  'api.upload.imageTooLarge': 'Изображение больше {size} px',
  'api.upload.variantNotFound': 'Вариант не найден',

  // Board files (.annie3d) import (routes/boardFile.ts, services/boardImport.ts)
  'api.boardFile.tooManyImports': 'Слишком много импортов, подождите немного',
  'api.boardFile.useUpload': 'Файлы больше 80 МБ отправляйте через /import-upload',
  'api.boardFile.uploadUnfinished': 'Загрузка отсутствует, не завершена или уже импортирована',
  'api.boardFile.uploadMissing': 'Загрузка отсутствует',
  'api.boardFile.uploadGone': 'Загруженный файл больше недоступен',
  'api.boardFile.checksum': '{name}: контрольная сумма не совпадает',
  'api.boardFile.missingEntry': 'Отсутствует {path}',
  'api.boardFile.notBoardFile': 'Это не файл Annie 3D',
  'api.boardFile.newerVersion': 'Это не файл Annie 3D (или файл более новой версии)',
  'api.boardFile.noNodes': 'В файле нет узлов',
  'api.boardFile.unknownNodes': 'Результаты относятся к узлам, которых нет на этой доске',
  'api.boardFile.tooLarge': 'Файл больше 2 ГБ',
  'api.boardFile.multiPart': 'Многотомные архивы не являются файлами доски',
  'api.boardFile.zip64': 'Архивы ZIP64 не являются файлами доски',
  'api.boardFile.tooManyEntries': 'В файле слишком много записей',
  'api.boardFile.damaged': 'Файл повреждён',
  'api.boardFile.encrypted': 'Зашифрованные файлы не являются файлами доски',
  'api.boardFile.duplicateEntry': 'Повторяющаяся запись: {name}',
  'api.boardFile.unsupportedCompression': 'Неподдерживаемый метод сжатия',
  'api.boardFile.manifestTooLarge': 'Описание доски слишком большое',
  'api.boardFile.unexpectedEntry': 'Неожиданная запись: {name}',
  'api.boardFile.entryCompressed': '{name}: запись сжата, а файлы доски хранят медиа без сжатия',
  'api.boardFile.unreadable': 'Не удалось прочитать файл: {reason}',

  // Runs (routes/runs.ts, routes/credits.ts)
  'api.run.notFound': 'Запуск не найден',
  'api.run.tooMany': 'Слишком много запусков. Подождите минуту.',
  'api.run.alreadyRunning': 'На этой доске уже идёт запуск',
  'api.run.notEnoughCredits': 'Недостаточно кредитов для этого запуска',
  'api.run.nothingToRun': 'Нечего запускать: добавьте узел, который можно запустить',
  'api.run.upToDate': 'Всё актуально',
  'api.run.editNeedsModel': 'Правка области доступна только в узлах «3D-модель»',
  'api.run.versionNotOnNode': 'Версия не найдена в этом узле',
  'api.run.selectRegion': 'Сначала выделите область',

  // Run steps, sent over the run's WebSocket in the language of the person who started it
  // (services/runner.ts, engines/*)
  'api.run.connectFirst': 'Сначала подключите вход «{port}»',
  'api.run.noEngine': 'Нет движка для узла «{kind}»',
  'api.run.baseHasNoModel': 'В базовой версии нет модели',
  'api.run.baseModelMissing': 'Файл базовой модели отсутствует',
  'api.run.selectionExpired': 'Выделение устарело; выделите область снова',
  'api.run.inputNotFound': 'Входной файл не найден',
  'api.run.inputMissingInStorage': 'Входной файл отсутствует в хранилище',
  'api.run.gateFailed': 'Проверка качества «{gate}» не пройдена',
  'api.run.needsPhotoOrText': 'Добавьте фото товара или описание',
  'api.run.regionNotOnVersion': 'Выделенной области нет в этой версии',

  // Progress stages of the engines (engines/simulator.ts, engines/registry.ts, engines/export.ts)
  'api.stage.model3d.readingPhotos': 'Чтение фото',
  'api.stage.model3d.segmenting': 'Выделение товара',
  'api.stage.model3d.estimatingShape': 'Оценка формы',
  'api.stage.model3d.buildingMesh': 'Построение сетки',
  'api.stage.model3d.bakingTextures': 'Запекание текстур',
  'api.stage.model3d.checkingSilhouette': 'Проверка силуэта',
  'api.stage.stage.readingBrief': 'Чтение брифа',
  'api.stage.stage.blockingSet': 'Расстановка декораций',
  'api.stage.stage.lighting': 'Освещение',
  'api.stage.stage.placingProduct': 'Размещение товара',
  'api.stage.stage.testRender': 'Тестовый рендер',
  'api.stage.packshot.framing': 'Настройка камер',
  'api.stage.packshot.renderingFront': 'Рендер вида спереди',
  'api.stage.packshot.renderingAngles': 'Рендер ракурсов',
  'api.stage.packshot.denoising': 'Шумоподавление',
  'api.stage.adVideo.storyboard': 'Раскадровка',
  'api.stage.adVideo.cameraMoves': 'Движения камеры',
  'api.stage.adVideo.renderingFrames': 'Рендер кадров',
  'api.stage.adVideo.addingHeadline': 'Добавление заголовка',
  'api.stage.adVideo.mixingMusic': 'Сведение музыки',
  'api.stage.adVideo.encoding': 'Кодирование',
  'api.stage.export.packaging': 'Упаковка',
  'api.stage.export.validating': 'Проверка glTF',
  'api.stage.export.writing': 'Запись файлов',
  'api.stage.working': 'Обработка',
  'api.stage.done': 'Готово',
  'api.stage.edit.readingSelection': 'Чтение выделения',
  'api.stage.edit.applying': 'Применение правки',
  'api.stage.edit.checking': 'Проверка результата',
  'api.stage.export.optimising': 'Оптимизация: {preset}',
  'api.stage.export.collecting': 'Сбор файлов',
  'api.stage.export.exported': 'Экспортировано',
  'api.stage.export.exportedWithFailures': 'Экспортировано, но не все проверки пройдены',

  // Quality gates and export checks by id (`step.failed.gate`, version gates `<preset>:<id>`)
  'api.gate.inputs': 'Входные данные',
  'api.gate.selection': 'Выделение',
  'api.gate.silhouette_iou': 'Совпадение силуэта',
  'api.gate.watertight': 'Замкнутая сетка',
  'api.gate.triangles': 'Число треугольников',
  'api.gate.product_visible': 'Товар в кадре',
  'api.gate.framing': 'Кадрирование',
  'api.gate.duration_ok': 'Длительность',
  'api.gate.loudness_lufs': 'Громкость',
  'api.gate.edit_applied': 'Правка применена',
  'api.gate.bytes': 'Размер файла',
  'api.gate.texture': 'Размер текстур',
  'api.gate.animation': 'Анимация',
  'api.gate.validator': 'Проверка glTF',

  // Exports (routes/exports.ts, services/exporter.ts)
  'api.export.notFound': 'Экспорт не найден',
  'api.export.noModelYet': 'В этом узле пока нет модели для экспорта',
  'api.export.wrongNode': 'Экспортировать можно узел «3D-модель» или «Экспорт»',
  'api.export.nothingToExport': 'Нечего экспортировать: подключите 3D-модель, видео или изображения',
  'api.export.failed': 'Ошибка экспорта: {reason}',
  'api.export.megabytes': '{value} МБ',
  'api.export.checkBytes': '{size} из {limit}',
  'api.export.checkTriangles': 'Треугольников: {count} из {limit}',
  'api.export.checkTexture': 'Самая большая текстура {size} px (лимит {limit} px)',
  'api.export.checkNoTextures': 'Нет текстур-изображений',
  'api.export.checkAnimation': {
    one: '{count} клип анимации',
    few: '{count} клипа анимации',
    many: '{count} клипов анимации',
    other: '{count} клипа анимации',
  },
  'api.export.checkAnimationNeeded': 'Нужна анимация (например, вращение)',
  'api.export.checkAnimationOptional': {
    one: '{count} клип анимации, анимация не обязательна',
    few: '{count} клипа анимации, анимация не обязательна',
    many: '{count} клипов анимации, анимация не обязательна',
    other: '{count} клипа анимации, анимация не обязательна',
  },
  'api.export.checkValid': 'Читается как корректный glTF 2.0',
  'api.export.checkInvalid': 'Некорректный glTF: {reason}',
  'api.export.checkRoundTrip': 'Повторное чтение не удалось: {reason}',

  // Shares (routes/shares.ts)
  'api.share.versionNotFound': 'Версия не найдена',
  'api.share.changed': 'Ссылка изменилась, попробуйте ещё раз',
  'api.share.notFound': 'Ссылка не найдена',
  'api.share.unavailable': 'Эта ссылка недоступна',
  'api.share.anonymousOwner': 'Пользователь Annie 3D',

  // Plans and the simulated checkout page (routes/credits.ts)
  'api.plan.creator': 'Creator',
  'api.plan.studio': 'Studio',
  'api.checkout.invalidSignature': 'Недействительная подпись оплаты',
  'api.checkout.expired': 'Срок оплаты истёк',
  'api.checkout.otherWorkspace': 'Оплата относится к другому рабочему пространству',
  'api.checkout.invalidLink': 'Недействительная ссылка на оплату',
  'api.checkout.pageTitle': 'Оплата · Annie 3D',
  'api.checkout.simulated':
    'Тестовая оплата: деньги с карты не списываются. Эту страницу заменит настоящий платёжный сервис.',
  'api.checkout.planName': 'Тариф «{plan}»',
  'api.checkout.creditsMonthly': {
    one: '{count} кредит в месяц',
    few: '{count} кредита в месяц',
    many: '{count} кредитов в месяц',
    other: '{count} кредита в месяц',
  },
  'api.checkout.dueToday': 'К оплате сегодня',
  'api.checkout.pay': 'Оплатить {price}',
  'api.checkout.cancel': 'Отменить и вернуться',

  // Reels (routes/reels.ts)
  'api.reel.serverNotAttached': 'Серверный рендер роликов пока не подключён; запишите ролик в браузере',
  'api.reel.afterRun': 'Ролик можно сделать после завершения запуска',
  'api.reel.uploadFirst': 'Сначала загрузите записанное видео ролика',

  // Simulation remote link (routes/sim.ts)
  'api.sim.badRoom': 'Неверный ID комнаты',

  // Agent route (routes/agent.ts)
  'api.agent.tooMany': 'Слишком много сообщений. Подождите минуту.',
  'api.agent.threadNotFound': 'Диалог не найден',
  'api.agent.couldNotApply': 'Не удалось применить «{label}»: {reason}',
  'api.agent.upToDate': 'Всё уже актуально, поэтому ничего не запускалось.',
  'api.agent.overBudget': {
    one: 'Для этого запуска нужен {count} кредит — больше, чем бюджет сообщения ({budget}). Увеличьте бюджет и попросите снова.',
    few: 'Для этого запуска нужно {count} кредита — больше, чем бюджет сообщения ({budget}). Увеличьте бюджет и попросите снова.',
    many: 'Для этого запуска нужно {count} кредитов — больше, чем бюджет сообщения ({budget}). Увеличьте бюджет и попросите снова.',
    other:
      'Для этого запуска нужно {count} кредита — больше, чем бюджет сообщения ({budget}). Увеличьте бюджет и попросите снова.',
  },
  'api.agent.couldNotStart': 'Мне не удалось начать запуск: {reason}',

  // Simulated agent's replies and change labels (agents/simulated.ts)
  'api.agent.help':
    'Я могу сменить стиль сцены (dark lab, stone & water, velvet, pastel splash, botanical, studio), сделать её теплее или холоднее (warmer, cooler), задать длину видео 6, 10 или 15 секунд, переключить формат на 9:16, 1:1 или 16:9, сменить движение камеры, задать заголовок (headline: "..."), добавить пэкшоты (add packshots), выбрать пресет экспорта и запустить всё это (run it). Команды пишите по-английски. Чтобы указать нужную цепочку, сначала выделите узлы.',
  'api.agent.ambiguous': {
    one: 'На доске {count} узел «{kind}». Выделите нужный (или узел в его цепочке) и попросите снова.',
    few: 'На доске {count} узла «{kind}». Выделите нужный (или узел в его цепочке) и попросите снова.',
    many: 'На доске {count} узлов «{kind}». Выделите нужный (или узел в его цепочке) и попросите снова.',
    other: 'На доске {count} узла «{kind}». Выделите нужный (или узел в его цепочке) и попросите снова.',
  },
  'api.agent.noNode': 'Узла «{kind}» пока нет, поэтому я пропустила «{change}».',
  'api.agent.alreadySet': {
    one: '{nodes}: уже {value}.',
    few: '{nodes}: уже {value}.',
    many: '{nodes}: уже {value}.',
    other: '{nodes}: уже {value}.',
  },
  'api.agent.changeOn': '{nodes}: {change}',
  'api.agent.change.look': 'стиль → {value}',
  'api.agent.change.direction': 'указания: {value}',
  'api.agent.change.duration': 'длительность → {value}',
  'api.agent.change.aspect': 'формат → {value}',
  'api.agent.change.motion': 'движение → {value}',
  'api.agent.change.detail': 'детализация → {value}',
  'api.agent.change.preset': 'пресет → {value}',
  'api.agent.change.headline': 'Заголовок → «{text}»',
  'api.agent.change.addPackshot': 'Добавлен пэкшот на основе «{node}»',
  'api.agent.value.seconds': '{seconds} с',
  'api.agent.value.secondsClosest': '{seconds} с (ближе всего к {wanted} с)',
  'api.agent.value.detailHigh': 'высокая',
  'api.agent.value.detailDraft': 'черновая',
  'api.agent.ambiguousHeadline': {
    one: 'Найден {count} заголовок. Выделите нужную цепочку и попросите снова.',
    few: 'Найдено {count} заголовка. Выделите нужную цепочку и попросите снова.',
    many: 'Найдено {count} заголовков. Выделите нужную цепочку и попросите снова.',
    other: 'Найдено {count} заголовка. Выделите нужную цепочку и попросите снова.',
  },
  'api.agent.pickModel': 'Выделите 3D-модель, из которой делать пэкшоты.',
  'api.agent.packshotLabel': 'Пэкшоты (агент)',
  'api.agent.done': 'Готово:',
  'api.agent.madeChanges': {
    one: 'Я внесла {count} изменение:',
    few: 'Я внесла {count} изменения:',
    many: 'Я внесла {count} изменений:',
    other: 'Я внесла {count} изменения:',
  },
  'api.agent.runningChanged': 'Запускаю то, что изменилось; неизменённые узлы берутся из кэша.',
  'api.agent.runningBoard': 'Запускаю доску; неизменённые узлы берутся из кэша.',
  'api.agent.sayRun': 'Напишите «run it», когда захотите увидеть результат.',

  // desktop
  // macOS application menu ({app} is "Annie 3D").
  'desktop.menu.about': 'О программе {app}',
  'desktop.menu.services': 'Службы',
  'desktop.menu.hide': 'Скрыть {app}',
  'desktop.menu.hideOthers': 'Скрыть остальные',
  'desktop.menu.showAll': 'Показать все',
  'desktop.menu.quitApp': 'Завершить {app}',
  // File
  'desktop.menu.file': 'Файл',
  'desktop.menu.newBoardFile': 'Новый файл доски',
  'desktop.menu.open': 'Открыть…',
  'desktop.menu.openRecent': 'Открыть недавние',
  'desktop.menu.clearRecent': 'Очистить меню',
  'desktop.menu.save': 'Сохранить',
  'desktop.menu.saveAs': 'Сохранить как…',
  'desktop.menu.importIntoBoard': 'Импорт в эту доску…',
  'desktop.menu.closeWindow': 'Закрыть окно',
  'desktop.menu.quit': 'Завершить',
  'desktop.menu.exit': 'Выход',
  // Edit
  'desktop.menu.edit': 'Правка',
  'desktop.menu.undo': 'Отменить',
  'desktop.menu.redo': 'Повторить',
  'desktop.menu.cut': 'Вырезать',
  'desktop.menu.copy': 'Копировать',
  'desktop.menu.paste': 'Вставить',
  'desktop.menu.selectAll': 'Выбрать все',
  // View
  'desktop.menu.view': 'Вид',
  'desktop.menu.reload': 'Перезагрузить',
  'desktop.menu.toggleDevTools': 'Инструменты разработчика',
  'desktop.menu.toggleFullScreen': 'Полноэкранный режим',
  // Window
  'desktop.menu.window': 'Окно',
  'desktop.menu.minimize': 'Свернуть',
  'desktop.menu.zoom': 'Масштаб',
  'desktop.menu.bringAllToFront': 'Все окна — на передний план',
  'desktop.menu.close': 'Закрыть',
  // Help
  'desktop.menu.help': 'Справка',
  'desktop.menu.website': 'Сайт {app}',

  // Board files as documents
  'desktop.doc.untitled': 'Без названия.annie3d',
  'desktop.doc.fileType': 'Доска Annie 3D',
  'desktop.close.message': 'Сохранить изменения в «{name}»?',
  'desktop.close.detail': 'Если вы не сохраните изменения, они будут потеряны.',
  'desktop.close.dontSave': 'Не сохранять',
  'desktop.open.failed': 'Не удалось открыть «{name}»',

  // Why a board file was refused ({name} is a path inside the file)
  'desktop.file.tooLarge': 'Файл больше 2 ГБ',
  'desktop.file.notBoard': 'Это не файл Annie 3D',
  'desktop.file.notBoardOrNewer': 'Это не файл Annie 3D (или файл более новой версии)',
  'desktop.file.damaged': 'Файл повреждён',
  'desktop.file.invalidDescription': 'Недопустимое описание доски',
  'desktop.file.multiPart': 'Многотомные архивы не являются файлами доски',
  'desktop.file.zip64': 'Архивы ZIP64 не являются файлами доски',
  'desktop.file.tooManyEntries': 'В файле слишком много записей',
  'desktop.file.encrypted': 'Зашифрованные файлы не являются файлами доски',
  'desktop.file.duplicateEntry': 'Повторяющаяся запись: {name}',
  'desktop.file.unsupportedCompression': 'Неподдерживаемый метод сжатия',
  'desktop.file.descriptionTooLarge': 'Описание доски слишком большое',
  'desktop.file.unexpectedEntry': 'Неожиданная запись: {name}',
  'desktop.file.compressedMedia': '{name}: запись сжата, а файлы доски хранят медиа без сжатия',
  'desktop.file.invalidBoard': 'Недопустимая доска',
  'desktop.file.invalidAsset': 'Недопустимый файл: {name}',
  'desktop.file.missingAsset': 'Отсутствует {name}',
  'desktop.file.boardTooLarge': 'Доска больше 2 ГБ',
  'desktop.file.needsBytes': 'У каждого файла должно быть содержимое',

  // site
  // Every page
  'site.meta.pageTitle': '{title} · Annie 3D',
  'site.nav.skipToContent': 'Перейти к содержимому',
  'site.nav.homeLabel': 'Главная Annie 3D',
  'site.nav.openCanvas': 'Открыть холст',
  'site.nav.footer': 'Подвал сайта',
  'site.nav.canvas': 'Холст',
  'site.nav.privacy': 'Конфиденциальность',
  'site.nav.terms': 'Условия',
  'site.nav.contact': 'Контакты',
  'site.nav.languages': 'Языки',
  'site.footer.copyright': '© 2026 Annie 3D, Австралия.',

  // /home
  'site.home.title': '3D-реклама товара по одному фото',
  'site.home.description':
    'Annie 3D превращает одно фото товара в настоящую 3D-модель, рекламные ролики, пэкшоты с любого ракурса и анимированный GLB — на холсте, который можно открыть без регистрации.',
  'site.home.eyebrow': 'Рабочее пространство для 3D-рекламы',
  'site.home.headline': 'На входе — фото товара. На выходе — 3D-реклама.',
  'site.home.lead':
    'Перетащите фото товара на холст. Annie 3D построит настоящую 3D-модель товара, а затем сделает рекламный ролик, пэкшоты с любого ракурса, анимированный GLB для вашего магазина и ссылку, которую может открыть кто угодно. Все результаты получаются из одной модели, поэтому товар везде выглядит именно так, как нужно.',
  'site.home.whatEyebrow': 'Что вы получите',
  'site.home.whatTitle': 'Всё из одной модели',
  'site.home.videosTitle': 'Рекламные ролики',
  'site.home.videosBody':
    'Разбор по деталям для техники, камень и вода для украшений, всплеск для косметики — в форматах 1:1, 4:5 и 9:16.',
  'site.home.packshotsTitle': 'Пэкшоты с любого ракурса',
  'site.home.packshotsBody': 'Выстройте кадр сами или возьмите четыре стандартных ракурса.',
  'site.home.glbTitle': 'Анимированный GLB',
  'site.home.glbBody':
    'Перед скачиванием проверяется на соответствие лимитам веба, Google Merchant и Google Swirl.',
  'site.home.howEyebrow': 'Как это работает',
  'site.home.howTitle': 'Холст из узлов, которые можно пересоединять',
  'site.home.howBody':
    'Начните с готовой схемы или добавьте свои узлы: фото, текст, 3D-модель, сцена, пэкшот, рекламный ролик и экспорт. Выделите область на модели и опишите изменение — каждая правка становится новой версией, которую можно сравнить или отменить.',
  'site.home.tryExample': 'Открыть пример доски',

  // /legal/*
  'site.legal.draft': 'Черновик для предварительной версии · до запуска будет проверен юристами',
  'site.legal.translationNotice':
    'Этот перевод предоставлен для удобства. Если он расходится с английской версией, действует английская версия.',
  'site.legal.readEnglish': 'Читать английскую версию',

  'site.terms.title': 'Условия использования',
  'site.terms.description': 'Условия использования Annie 3D.',
  'site.terms.contentTitle': 'Ваш контент',
  'site.terms.contentBody':
    'Права на загруженные вами фотографии и созданные вами результаты остаются за вами. Загружайте только те товары, которые вы вправе рекламировать.',
  'site.terms.useTitle': 'Допустимое использование',
  'site.terms.useBody':
    'Не используйте Annie 3D для создания рекламы контрафактных товаров, для выдачи себя за бренды или людей, а также для создания незаконного контента.',
  'site.terms.creditsTitle': 'Кредиты',
  'site.terms.creditsBody':
    'Запуски расходуют кредиты. Кредиты за запуск, не прошедший наши проверки качества, возвращаются автоматически.',
  'site.terms.preReleaseTitle': 'Предварительная версия',
  'site.terms.preReleaseBody':
    'Функции могут меняться. Об изменениях, которые затрагивают ваши данные, мы сообщим до того, как они вступят в силу.',

  'site.privacy.title': 'Уведомление о конфиденциальности',
  'site.privacy.description': 'Как Annie 3D обращается с вашими данными.',
  'site.privacy.whoTitle': 'Кто мы',
  'site.privacy.whoBody': 'Сервис Annie 3D управляется из Австралии. Контакт: {email}.',
  'site.privacy.storeTitle': 'Какие данные мы храним',
  'site.privacy.storeBody':
    'Имя, адрес электронной почты и фото профиля вашего аккаунта Google — при входе; созданные вами доски, узлы, промпты и версии; загруженные вами файлы и файлы, которые мы создаём для вас; историю запусков и операции с кредитами.',
  'site.privacy.whereTitle': 'Где хранятся данные',
  'site.privacy.whereBody':
    'Данные аккаунта и досок — в базе данных Postgres, которую размещает Neon в Сиднее (Австралия). Файлы — в объектном хранилище Cloudflare R2 в регионе «Океания». Страницы доставляются через сеть Cloudflare.',
  'site.privacy.cookiesTitle': 'Файлы cookie',
  'site.privacy.cookiesBody':
    'Один собственный сеансовый файл cookie сохраняет ваш вход в аккаунт, и ещё один собственный файл cookie запоминает выбранный вами язык. Рекламные файлы cookie мы не используем.',
  'site.privacy.sharingTitle': 'Общий доступ',
  'site.privacy.sharingBody':
    'Ничего не становится общедоступным, пока вы не создадите ссылку для доступа. Ссылку можно отключить в любой момент.',
  'site.privacy.deleteTitle': 'Удаление данных',
  'site.privacy.deleteBody':
    'Удаляйте доски на холсте или напишите нам на электронную почту, чтобы удалить аккаунт и все файлы.',

  // Public share page rendered by the Worker (/s/<token>)
  'share.unavailableTitle': 'Ссылка недоступна',
  'share.unavailableHeading': 'Эта ссылка недоступна',
  'share.unavailableBody': 'Возможно, владелец её отключил.',
  'share.openApp': 'Открыть Annie 3D',
  'share.makeYours': 'Создать свою бесплатно',
  'share.description': 'Автор: {owner}. Сделано в Annie 3D — 3D-реклама товара по одному фото.',
  'share.by': 'Автор: {owner}',
  'share.modelAlt': 'Превью 3D-модели',
  'share.modelTitle': '3D-модель',
  'share.triangles': {
    one: '{count} треугольник',
    few: '{count} треугольника',
    many: '{count} треугольников',
    other: '{count} треугольника',
  },
  'share.megabytes': '{size} МБ',
  'share.downloadGlb': 'Скачать GLB',
  'share.madeWith': 'Сделано в {brand}',
  'share.terms': 'Условия',
};

/** Keys whose correct Russian is the English text (names, loanwords). */
export const sameAsEnglish: readonly string[] = [
  'canvas.port.one',
  'board.exampleLabel',
  'file.windowTitle',
  'file.windowTitleUnsaved',
  'editor.version',
  'editor.tool.withKey',
  'editor.versions.itemTitle',
  'editor.selection.summary',
  'perf.ms',
  'perf.budget',
  'sim.tiktok.handle',
  'sim.showroom.pose',
  'api.agent.changeOn',
  'site.meta.pageTitle',
];

export default catalog;
