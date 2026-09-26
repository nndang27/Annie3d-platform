import type { Catalog } from '../index';

/**
 * Portuguese (Brazil). Glossary (keep these choices when adding keys):
 * board = quadro, canvas = tela, node = nó (nós), wire / connection = conexão,
 * run = executar / execução, credits = créditos, Stage = Cenário, scene = cena,
 * Packshot = packshot (loanword), Ad video = anúncio em vídeo, Export (node) = Exportação,
 * Simulation = Simulação, simulator = simulador, starter / template = modelo,
 * preset = predefinição, look = visual, motion = movimento, version = versão (v{n}),
 * headline = título, prompt = prompt, input / output = entrada / saída, upload = enviar / envio,
 * download = baixar, delete = excluir, share = compartilhar, sign in / out = entrar / sair,
 * preview = prévia, view (camera) = vista, region = região, face = face, mesh = malha,
 * check = verificação (aprovada / reprovada), quality gate = verificação de qualidade,
 * budget = orçamento, held credits = em reserva, cached = em cache, workspace = espaço de trabalho,
 * checkout = pagamento, reel = reel, process reel = reel de bastidores, sticker = figurinha,
 * phone = celular, agent = agente, Annie = a Annie (assistant), Annie 3D = o Annie 3D (app).
 * macOS menus follow Apple pt-BR title case (Salvar Como…, Selecionar Tudo).
 */
const catalog: Catalog = {
  // Words used across the product.
  'common.credits': { one: '{count} crédito', many: '{count} de créditos', other: '{count} créditos' },
  'common.cancel': 'Cancelar',
  'common.close': 'Fechar',
  'common.save': 'Salvar',
  'common.done': 'Concluído',
  'common.retry': 'Tentar de novo',
  'common.language': 'Idioma',
  'common.brand': 'Annie 3D',

  // Names that come from packages/contracts (node kinds, ports, presets, starters).
  'node.photo': 'Foto',
  'node.text': 'Texto',
  'node.upload3d': 'Importar 3D',
  'node.audio': 'Música',
  'node.model3d': 'Modelo 3D',
  'node.stage': 'Cenário',
  'node.packshot': 'Packshot',
  'node.adVideo': 'Anúncio em vídeo',
  'node.export': 'Exportação',
  'node.simulation': 'Simulação',
  'node.note': 'Nota',

  'engine.photo': 'Envio',
  'engine.text': 'Texto',
  'engine.upload3d': 'Envio',
  'engine.audio': 'Envio',
  'engine.model3d': 'Construtor',
  'engine.stage': 'Diretor de cena',
  'engine.packshot': 'Renderizador',
  'engine.adVideo': 'Renderizador',
  'engine.export': 'Empacotador',
  'engine.simulation': 'Prévia ao vivo',
  'engine.note': 'Nota',

  'category.input': 'Entradas',
  'category.build': 'Construção',
  'category.stage': 'Cenário',
  'category.output': 'Saídas',
  'category.note': 'Notas',

  'port.photo.out': 'Imagem',
  'port.text.out': 'Texto',
  'port.upload3d.out': 'Modelo 3D',
  'port.audio.out': 'Áudio',
  'port.model3d.images': 'Fotos',
  'port.model3d.prompt': 'Descrição',
  'port.model3d.out': 'Modelo 3D',
  'port.stage.model': 'Modelo 3D',
  'port.stage.prompt': 'Direção',
  'port.stage.style': 'Referência de estilo',
  'port.stage.out': 'Cena',
  'port.packshot.subject': 'Modelo ou cena',
  'port.packshot.out': 'Imagens',
  'port.adVideo.subject': 'Cena ou modelo',
  'port.adVideo.headline': 'Título',
  'port.adVideo.logo': 'Logo',
  'port.adVideo.music': 'Música',
  'port.adVideo.out': 'Vídeo',
  'port.export.items': 'Saídas',
  'port.export.out': 'Arquivos',
  'port.simulation.subject': 'Modelo ou cena',
  'port.simulation.headline': 'Título',
  'port.simulation.logo': 'Logo',

  'portType.image': 'Imagem',
  'portType.text': 'Texto',
  'portType.model3d': 'Modelo 3D',
  'portType.scene': 'Cena',
  'portType.video': 'Vídeo',
  'portType.audio': 'Áudio',
  'portType.file': 'Arquivo',

  'look.studio-light': 'Luz de estúdio',
  'look.dark-lab': 'Lab escuro',
  'look.stone-water': 'Pedra e água',
  'look.velvet': 'Veludo',
  'look.splash-pastel': 'Splash pastel',
  'look.podium-botanical': 'Pódio e botânica',

  'motion.turntable': 'Giro 360°',
  'motion.hero-orbit': 'Órbita de destaque',
  'motion.teardown-reveal': 'Desmontagem',
  'motion.stone-water': 'Pedra e água',
  'motion.splash-hero': 'Splash em destaque',

  'glbPreset.web': 'Web / loja',
  'glbPreset.google_merchant': 'Google Merchant',
  'glbPreset.google_swirl': 'Google Swirl',

  'simEnv.shop': 'Página de loja',
  'simEnv.tiktok': 'TikTok',
  'simEnv.sticker': 'Figurinha',
  'simEnv.showroom': 'Showroom',

  'starter.teardown-reveal.title': 'Desmontagem',
  'starter.teardown-reveal.vertical': 'Eletrônicos',
  'starter.teardown-reveal.description':
    'O produto se desmonta camada por camada, para por um instante e se encaixa de volta.',
  'starter.teardown-reveal.headline': 'Engenharia até o último parafuso',
  'starter.stone-water.title': 'Pedra e água',
  'starter.stone-water.vertical': 'Joias',
  'starter.stone-water.description':
    'A peça repousa sobre pedra molhada ao lado de uma cascata fina; aproximação lenta, brilhos.',
  'starter.stone-water.headline': 'Feita para ser notada',
  'starter.splash-hero.title': 'Splash em destaque',
  'starter.splash-hero.vertical': 'Beleza',
  'starter.splash-hero.description': 'O frasco sobe através de um splash da própria cor e pousa num pódio.',
  'starter.splash-hero.headline': 'Conheça a nova fórmula',
  'starter.node.photo': 'Foto do produto',
  'starter.node.headline': 'Título',
  'starter.node.pack': 'Packshots',

  'setting.simulation.cta': 'Compre agora',

  // App shell (App.tsx): loading splash, lazy overlays, checkout return.
  'app.canvas': 'Tela do quadro',
  'app.loading': 'Carregando quadro…',
  'app.docAccess': 'Abrir {name}',
  'app.opening3d': 'Abrindo 3D…',
  'app.openingSimulator': 'Abrindo simulador…',
  'app.error3d': 'Não foi possível iniciar a visualização 3D: {message}',
  'app.checkoutDone': 'Pagamento concluído. Créditos adicionados.',
  'app.board.firstTitle': 'Meu primeiro quadro',

  // Top bar: logo, title, save state.
  'topbar.home': 'Início do Annie 3D',
  'topbar.title': 'Título do quadro',
  'topbar.save.saved': 'Salvo',
  'topbar.save.saving': 'Salvando…',
  'topbar.save.offline': 'Offline, sincroniza depois',
  'topbar.save.error': 'Tentando de novo…',
  'topbar.save.edited': 'Editado',
  'topbar.save.notSaved': 'Não salvo',
  'topbar.save.noFile': 'Ainda não salvo em um arquivo',
  'topbar.save.guest': 'Salvo neste navegador',
  'topbar.save.guestHint': 'Entre para guardá-lo na sua conta',

  // Top bar: board file ("…") menu.
  'topbar.file.menu': 'Arquivo do quadro',
  'topbar.file.save': 'Salvar',
  'topbar.file.saveAsFile': 'Salvar como arquivo…',
  'topbar.file.saveAs': 'Salvar como…',
  'topbar.file.open': 'Abrir…',
  'topbar.file.new': 'Novo arquivo de quadro',
  'topbar.file.import': 'Importar para este quadro…',
  'topbar.file.download': 'Baixar quadro (.annie3d)',
  'topbar.file.openFile': 'Abrir arquivo de quadro…',

  // Top bar: templates, run all, zoom.
  'topbar.templates': 'Modelos',
  'topbar.running': 'Executando…',
  'topbar.runAll': 'Executar tudo',
  'topbar.runAllHint': 'Nós sem alterações são grátis; o custo exato aparece antes de você confirmar',
  'topbar.upToDate': 'Atualizado',
  'topbar.zoomOut': 'Diminuir zoom',
  'topbar.zoomIn': 'Aumentar zoom',
  'topbar.zoomLevel': 'Zoom de {percent}, ajustar à tela',
  'topbar.fitToScreen': 'Ajustar à tela (Shift+1)',

  // Top bar: account, credits, share.
  'topbar.creditsHint': 'Créditos e plano',
  'topbar.signIn': 'Entrar',
  'topbar.share': 'Compartilhar',
  'topbar.shareFile': 'Um arquivo de quadro é compartilhado como arquivo: envie o próprio arquivo .annie3d.',
  'topbar.account': 'Conta',
  'topbar.accountOf': 'Conta: {name}',
  'topbar.creditsAndPlan': 'Créditos e plano',
  'topbar.signOut': 'Sair',

  // Language picker (top bar and the file menu).
  'lang.button': 'Idioma: {language}',

  // Bottom toolbar.
  'toolbar.label': 'Ferramentas da tela',
  'toolbar.select': 'Selecionar (V)',
  'toolbar.hand': 'Mão (H)',
  'toolbar.add': 'Adicionar {name}',
  'toolbar.moreNodes': 'Mais nós (N)',
  'toolbar.undo': 'Desfazer (⌘Z)',
  'toolbar.redo': 'Refazer (⇧⌘Z)',
  'toolbar.askAnnie': 'Pergunte à Annie',

  // Add-node palette.
  'palette.label': 'Adicionar nó',
  'palette.search': 'Adicionar um nó…',
  'palette.searchLabel': 'Buscar nós',
  'palette.list': 'Nós',
  'palette.starters': 'Modelos',
  'palette.starter': 'Modelo {title}',
  'palette.noMatch': 'Nenhum nó corresponde a “{query}”.',
  'palette.accepts.image': 'Nós que recebem uma imagem…',
  'palette.accepts.text': 'Nós que recebem texto…',
  'palette.accepts.model3d': 'Nós que recebem um modelo 3D…',
  'palette.accepts.scene': 'Nós que recebem uma cena…',
  'palette.accepts.video': 'Nós que recebem um vídeo…',
  'palette.accepts.audio': 'Nós que recebem áudio…',
  'palette.accepts.file': 'Nós que recebem um arquivo…',

  // Right-click menu on the canvas.
  'menu.canvas': 'Menu da tela',
  'menu.runNode': 'Executar este nó',
  'menu.openEditor': 'Abrir editor 3D',
  'menu.export': 'Exportar / baixar…',
  'menu.copy': 'Copiar',
  'menu.duplicate': 'Duplicar',
  'menu.delete': 'Excluir',
  'menu.addNode': 'Adicionar nó…',
  'menu.paste': 'Colar aqui',
  'menu.duplicateSelected': {
    one: 'Duplicar {count} item selecionado',
    many: 'Duplicar {count} de itens selecionados',
    other: 'Duplicar {count} itens selecionados',
  },
  'menu.deleteSelected': {
    one: 'Excluir {count} item selecionado',
    many: 'Excluir {count} de itens selecionados',
    other: 'Excluir {count} itens selecionados',
  },

  // Agent dock (Ask Annie).
  'agent.title': 'Pergunte à Annie',
  'agent.close': 'Fechar agente',
  'agent.intro':
    'A Annie altera este quadro para você: nós, configurações e conexões. ⌘Z desfaz as edições dela.',
  'agent.suggestion.warmerStage': 'Deixe o cenário mais quente e crie um corte de 6 segundos',
  'agent.suggestion.fourAngles': 'Adicione um packshot com quatro ângulos',
  'agent.suggestion.softerLight': 'Use uma luz mais suave no modelo 3D',
  'agent.undoHint': 'Desfaça com ⌘Z',
  'agent.thinking': 'Pensando…',
  'agent.input': 'Mensagem para o agente',
  'agent.placeholder': 'Descreva uma alteração…',
  'agent.budget': 'Orçamento',
  'agent.budgetLabel': 'Orçamento em créditos',
  'agent.send': 'Enviar',
  'agent.boardEdited': 'Quadro editado',
  'agent.failed': 'Desculpe, não deu certo: {message}',

  // Shared dialog words.
  'dialog.download': 'Baixar',

  // Billing dialog.
  'dialog.billing.title': 'Créditos',
  'dialog.billing.guest': {
    one: 'Entre para ganhar {count} crédito grátis, o suficiente para uma execução completa.',
    many: 'Entre para ganhar {count} de créditos grátis, o suficiente para uma execução completa.',
    other: 'Entre para ganhar {count} créditos grátis, o suficiente para uma execução completa.',
  },
  'dialog.billing.signIn': 'Entrar',
  'dialog.billing.balance': {
    one: '{balance} crédito',
    many: '{balance} de créditos',
    other: '{balance} créditos',
  },
  'dialog.billing.held': {
    one: '({count} em reserva para uma execução em andamento)',
    many: '({count} em reserva para execuções em andamento)',
    other: '({count} em reserva para execuções em andamento)',
  },
  'dialog.billing.plan.free': 'Grátis',
  'dialog.billing.plan.creator': 'Creator',
  'dialog.billing.plan.studio': 'Studio',
  'dialog.billing.firstRunFree': {
    one: 'Sua primeira execução é grátis ({count} crédito incluído).',
    many: 'Sua primeira execução é grátis ({count} de créditos incluídos).',
    other: 'Sua primeira execução é grátis ({count} créditos incluídos).',
  },
  'dialog.billing.chargedOnSuccess':
    'Só são cobradas as etapas concluídas com sucesso; etapas em cache são grátis.',
  'dialog.billing.perMonth': '/mês',
  'dialog.billing.creditsPerMonth': {
    one: '{count} crédito por mês',
    many: '{count} de créditos por mês',
    other: '{count} créditos por mês',
  },
  'dialog.billing.openingCheckout': 'Abrindo o pagamento…',
  'dialog.billing.addCredits': 'Adicionar créditos',
  'dialog.billing.choose': 'Escolher {plan}',
  'dialog.billing.history': 'Histórico',
  'dialog.billing.reason.grantFree': 'Créditos grátis',
  'dialog.billing.reason.purchase': 'Compra de plano',
  'dialog.billing.reason.subscription': 'Créditos mensais',
  'dialog.billing.reason.runReserve': 'Execução iniciada (em reserva)',
  'dialog.billing.reason.runSettle': 'Execução cobrada',
  'dialog.billing.reason.runRefund': 'Reembolso',
  'dialog.billing.reason.adjust': 'Ajuste',

  // Export dialog.
  'dialog.export.noNode': 'Selecione um nó de Modelo 3D ou de Exportação para exportar.',
  'dialog.export.titleBundle': 'Exportar pacote',
  'dialog.export.titleModel': 'Exportar modelo 3D',
  'dialog.export.preset': 'Predefinição',
  'dialog.export.limits': 'Até {size}, {triangles} triângulos, texturas de {texture} px',
  'dialog.export.limitsAnimated': 'Até {size}, {triangles} triângulos, texturas de {texture} px, animado',
  'dialog.export.megabytes': '{size} MB',
  'dialog.export.includeVideo': 'Anúncio em vídeo (MP4)',
  'dialog.export.includeImages': 'Imagens (PNG)',
  'dialog.export.ready': 'Pronto para {preset}',
  'dialog.export.notReady': 'Ainda não atende a {preset}',
  'dialog.export.passed': 'aprovado',
  'dialog.export.failed': 'reprovado',
  'dialog.export.zip': 'Todos os arquivos (.zip)',
  'dialog.export.glb': 'Modelo GLB',
  'dialog.export.exporting': 'Exportando…',
  'dialog.export.run': 'Exportar (grátis)',

  // Process reel dialog.
  'dialog.reel.button': 'Reel de bastidores',
  'dialog.reel.hint': 'Vídeo 9:16: o anúncio em cima, os bastidores embaixo',
  'dialog.reel.title': 'Reel de bastidores',
  'dialog.reel.intro':
    'Um vídeo 9:16 para Reels e TikTok: seu anúncio em cima e, embaixo, como ele foi feito no Annie 3D.',
  'dialog.reel.preview': 'Prévia do reel',
  'dialog.reel.recording': 'Gravando… {percent}',
  'dialog.reel.saving': 'Salvando…',
  'dialog.reel.record': 'Gravar reel',

  // Run dialog (cost before charging).
  'dialog.run.inProgress': 'Já há uma execução em andamento neste quadro',
  'dialog.run.checking': 'Calculando o custo…',
  'dialog.run.estimateFailed': 'Não foi possível estimar esta execução.',
  'dialog.run.upToDate': 'Tudo está atualizado',
  'dialog.run.allCached': {
    one: '{count} nó já tem resultados para as entradas atuais. Altere um prompt, uma configuração ou uma entrada para executar de novo.',
    many: '{count} de nós já têm resultados para as entradas atuais. Altere um prompt, uma configuração ou uma entrada para executar de novo.',
    other:
      '{count} nós já têm resultados para as entradas atuais. Altere um prompt, uma configuração ou uma entrada para executar de novo.',
  },
  'dialog.run.ok': 'OK',
  'dialog.run.titleOne': 'Executar {name}',
  'dialog.run.titleMany': {
    one: 'Executar {count} nó',
    many: 'Executar {count} de nós',
    other: 'Executar {count} nós',
  },
  'dialog.run.cached': {
    one: '{count} nó sem alterações reutiliza os resultados',
    many: '{count} de nós sem alterações reutilizam os resultados',
    other: '{count} nós sem alterações reutilizam os resultados',
  },
  'dialog.run.free': 'grátis',
  'dialog.run.total': 'Total',
  'dialog.run.balance': {
    one: 'Saldo: {count} crédito.',
    many: 'Saldo: {count} de créditos.',
    other: 'Saldo: {count} créditos.',
  },
  'dialog.run.firstRunFree': 'Sua primeira execução é grátis.',
  'dialog.run.refunded': 'Etapas com falha são reembolsadas.',
  'dialog.run.starting': 'Iniciando…',
  'dialog.run.run': 'Executar',
  'dialog.run.getCredits': 'Obter créditos',

  // Share dialog.
  'dialog.share.copied': 'Link copiado',
  'dialog.share.copyFailed': 'Não foi possível copiar: selecione o link e copie',
  'dialog.share.revoked': 'Link desativado',
  'dialog.share.title': 'Compartilhar este quadro',
  'dialog.share.body':
    'Qualquer pessoa com o link pode assistir ao anúncio, ver as imagens e baixar o modelo 3D, mas não pode editar.',
  'dialog.share.creating': 'Criando link…',
  'dialog.share.link': 'Link de compartilhamento',
  'dialog.share.copy': 'Copiar',
  'dialog.share.views': {
    one: '{count} visualização.',
    many: '{count} de visualizações.',
    other: '{count} visualizações.',
  },
  'dialog.share.openPreview': 'Abrir prévia',
  'dialog.share.revoke': 'Desativar link',

  // Shared UI primitives (packages/ui): the host app passes these in.
  'dialog.close': 'Fechar caixa de diálogo',
  'dialog.locked': 'Aguarde a ação atual terminar.',
  'dialog.dismiss': 'Dispensar',
  'dialog.loading': 'Carregando',

  // Sign-in prompt (guest tries a paid or cloud action).
  'signin.run.title': 'Entre para executar',
  'signin.run.body': {
    one: 'Sua primeira execução completa é grátis ({count} crédito). Seu quadro vai junto.',
    many: 'Sua primeira execução completa é grátis ({count} de créditos). Seu quadro vai junto.',
    other: 'Sua primeira execução completa é grátis ({count} créditos). Seu quadro vai junto.',
  },
  'signin.share.title': 'Entre para compartilhar',
  'signin.share.body': 'Links de compartilhamento precisam de um quadro salvo. Seu quadro vai junto.',
  'signin.save.title': 'Entre para manter este quadro',
  'signin.save.body': 'Quadros de visitante ficam só neste navegador.',
  'signin.google': 'Continuar com o Google',
  'signin.notNow': 'Agora não',

  // Performance panel (developer tool, ⌥P).
  'perf.title': 'Desempenho',
  'perf.copied': 'Relatório de desempenho copiado',
  'perf.copy': 'Copiar relatório',
  'perf.copyHint': 'Copiar relatório (JSON)',
  'perf.close': 'Fechar painel de desempenho',
  'perf.pageLoad': 'Carregamento da página',
  'perf.network': {
    one: '{count} requisição, {kb} KB transferidos',
    many: '{count} de requisições, {kb} KB transferidos',
    other: '{count} requisições, {kb} KB transferidos',
  },
  'perf.features': 'Recursos',
  'perf.action': 'Ação',
  'perf.last': 'última',
  'perf.slowApis': 'Chamadas de API mais lentas',
  'perf.slowFiles': 'Arquivos mais lentos',
  'perf.serverTime': 'Tempo do Worker (Server-Timing)',
  'perf.server': 'srv {time}',
  'perf.ms': '{value} ms',
  'perf.seconds': '{value} s',
  'perf.budget': '≤ {value}',
  'perf.foot':
    'Medido neste navegador. Metas: Core Web Vitals (web.dev), RAIL e limites de tempo de resposta de Nielsen. Os mesmos números são enviados ao servidor quando você sai da aba.',
  'perf.metric.ttfb': 'Resposta do servidor (TTFB)',
  'perf.metric.fcp': 'Primeira renderização (FCP)',
  'perf.metric.lcp': 'Conteúdo principal (LCP)',
  'perf.metric.cls': 'Mudança de layout (CLS)',
  'perf.metric.inp': 'Resposta à interação (INP)',
  'perf.metric.boardReady': 'Quadro pronto para uso',
  'perf.metric.boardLoad': 'Carregar dados do quadro',
  'perf.metric.clipboardPaste': 'Colar / duplicar nós',
  'perf.metric.imageAdd': 'Colar ou soltar uma imagem',
  'perf.metric.uploadFile': 'Enviar um arquivo',
  'perf.metric.editorOpen': 'Abrir editor 3D',
  'perf.metric.simulatorOpen': 'Abrir simulador',
  'perf.metric.runStart': 'Iniciar execução (até o 1º evento)',
  'perf.metric.runTotal': 'Execução até o fim',
  'perf.metric.agentFirst': 'Primeiras palavras do agente',
  'perf.metric.agentReply': 'Resposta completa do agente',
  'perf.metric.exportBundle': 'Exportar arquivos',
  'perf.metric.undoApply': 'Desfazer / refazer',
  'perf.metric.fileExport': 'Baixar .annie3d',
  'perf.metric.fileImport': 'Abrir .annie3d',
  'perf.metric.api': 'Chamada de API',

  // Desktop app update pill.
  'update.rolledBack': 'A atualização {version} não iniciou, então a versão anterior foi restaurada.',
  'update.shellRequired': 'A atualização mais recente exige um app mais novo (app {version}+).',
  'update.available': 'Atualização disponível',
  'update.restarting': 'Reiniciando…',
  'update.restart': 'Reiniciar para atualizar',

  // canvas/FlowNode.tsx: the node card
  'canvas.node.openSim': 'Abrir',
  'canvas.node.staleTitle': 'As entradas mudaram desde esta versão',
  'canvas.node.stale': 'desatualizado',
  'canvas.node.openSimLabel': 'Abrir simulador',
  'canvas.node.openSimTitle': 'Abrir simulador (ou clique duas vezes)',
  'canvas.node.dropPhoto': 'Solte, cole ou clique para adicionar uma foto',
  'canvas.node.dropMusic': 'Solte um arquivo de música',
  'canvas.node.dropGlb': 'Solte um arquivo .glb',
  'canvas.node.emptyResult': 'O resultado vai aparecer aqui',
  'canvas.node.filesReady': {
    one: '{count} arquivo pronto',
    many: '{count} de arquivos prontos',
    other: '{count} arquivos prontos',
  },
  'canvas.node.checksPassed': '{passed}/{total} verificações aprovadas',
  'canvas.node.checksPassedPreset': '{passed}/{total} verificações aprovadas ({preset})',
  'canvas.node.referenceImages': {
    one: '{count} imagem de referência',
    many: '{count} de imagens de referência',
    other: '{count} imagens de referência',
  },
  'canvas.node.progress': 'Progresso: {percent}%',
  'canvas.node.openEditorLabel': 'Abrir editor 3D',
  'canvas.node.openEditorTitle': 'Abrir editor 3D (ou clique duas vezes)',
  'canvas.node.runFromHere': 'Executar a partir daqui',
  'canvas.node.writePlaceholder': 'Escreva algo…',
  'canvas.node.describePlaceholder': 'Descreva o que você quer…',
  'canvas.node.runCost': 'Executar ({credits})',
  'canvas.node.run': 'Executar',
  'canvas.node.running': 'Executando…',
  'canvas.node.runOptions': 'Opções de execução',
  'canvas.node.runWithInputs': 'Executar com as entradas',
  'canvas.node.runNodeOnly': 'Executar só este nó',
  'canvas.node.runDownstream': 'Executar este e os seguintes',

  // canvas/FlowNode.tsx: port bubbles (screen-reader name: port and the types it takes)
  'canvas.port.one': '{port} ({type})',
  'canvas.port.two': '{port} ({first} ou {second})',
  'canvas.port.many': '{port} ({list} ou {last})',
  'canvas.port.separator': ', ',

  // canvas/FlowNode.tsx: settings toolbar under the selected node. The select names are
  // screen-reader labels.
  'canvas.toolbar.builder': 'Construtor',
  'canvas.toolbar.detail': 'Detalhe',
  'canvas.toolbar.look': 'Visual',
  'canvas.toolbar.angles': 'Ângulos',
  'canvas.toolbar.size': 'Tamanho',
  'canvas.toolbar.motion': 'Movimento',
  'canvas.toolbar.aspect': 'Proporção',
  'canvas.toolbar.durationSec': 'Duração (segundos)',
  'canvas.toolbar.environment': 'Local',
  'canvas.toolbar.glbPreset': 'Predefinição GLB',
  'canvas.toolbar.price': 'Preço',
  'canvas.toolbar.builderAuto': 'Construtor: automático',
  'canvas.toolbar.builderCode': 'Construtor: código',
  'canvas.toolbar.builderGenerative': 'Construtor: generativo',
  'canvas.toolbar.detailDraft': 'rascunho',
  'canvas.toolbar.detailStandard': 'padrão',
  'canvas.toolbar.detailHigh': 'alto',
  'canvas.toolbar.anglesFour': '4 ângulos',
  'canvas.toolbar.anglesCustom': 'Câmera personalizada',
  'canvas.toolbar.seconds': '{seconds} s',
  'canvas.toolbar.replace': 'Substituir',
  'canvas.toolbar.download': 'Baixar',
  'canvas.toolbar.deleteNode': 'Excluir nó',
  'canvas.toolbar.delete': 'Excluir',
  'canvas.toolbar.more': 'Mais ações',
  'canvas.toolbar.duplicate': 'Duplicar',
  'canvas.toolbar.copy': 'Copiar',

  // canvas/FlowEdge.tsx
  'canvas.edge.remove': 'Remover conexão',
  'canvas.edge.label': 'Conexão de {from} para {to}',

  // canvas/Canvas.tsx: React Flow's screen-reader texts
  'canvas.a11y.nodeDescription':
    'Pressione Enter ou Espaço para selecionar um nó. Pressione Delete para removê-lo e Esc para cancelar.',
  'canvas.a11y.nodeDescriptionKeyboard':
    'Pressione Enter ou Espaço para selecionar um nó. Depois, use as setas para mover o nó. Pressione Delete para removê-lo e Esc para cancelar.',
  'canvas.a11y.edgeDescription':
    'Pressione Enter ou Espaço para selecionar uma conexão. Depois, pressione Delete para removê-la ou Esc para cancelar.',
  'canvas.a11y.nodeMoved': 'Nó selecionado movido {direction}. Nova posição, x: {x}, y: {y}',
  'canvas.a11y.up': 'para cima',
  'canvas.a11y.down': 'para baixo',
  'canvas.a11y.left': 'para a esquerda',
  'canvas.a11y.right': 'para a direita',

  // canvas/clipboard.ts
  'canvas.imageTooLarge': 'É possível adicionar imagens de até {size} MB',

  // lib/agentClient.ts
  'canvas.agentUnavailable': 'Agente indisponível ({status})',

  // canvas/example.ts, store/board.ts: board titles and labels the app writes
  'board.example': 'Quadro de exemplo',
  'board.untitled': 'Quadro sem título',
  'board.exampleLabel': '{label} ({product})',
  'board.product.serum': 'sérum',
  'board.product.headphones': 'fones de ouvido',
  'board.product.ring': 'anel',

  // lib/runSocket.ts, lib/doc.ts: runs
  'run.queued': 'Na fila',
  'run.starting': 'Iniciando',
  'run.checkFailed': 'Verificação reprovada: {gate}',
  'run.finished': {
    one: 'Execução concluída: {count} crédito usado',
    many: 'Execução concluída: {count} de créditos usados',
    other: 'Execução concluída: {count} créditos usados',
  },
  'run.finishedWithErrors': {
    one: 'Execução concluída com erros: {count} crédito usado',
    many: 'Execução concluída com erros: {count} de créditos usados',
    other: 'Execução concluída com erros: {count} créditos usados',
  },
  'run.failedRefunded': 'A execução falhou. Créditos reembolsados.',
  'run.cancelled': {
    one: 'Execução cancelada: {count} crédito usado',
    many: 'Execução cancelada: {count} de créditos usados',
    other: 'Execução cancelada: {count} créditos usados',
  },
  'run.preparing': 'Preparando a execução…',
  'run.couldNotPrepare': 'Não foi possível preparar a execução',

  // lib/reel.ts: the process reel (drawn into the video)
  'reel.historyUnavailable': 'O histórico de execuções não está disponível',
  'reel.couldNotLoadHistory': 'Não foi possível carregar o histórico de execuções',
  'reel.howItWasMade': 'COMO FOI FEITO',
  'reel.madeWith': 'Feito com Annie 3D',
  'reel.tagline': 'Anúncios 3D de produtos a partir de uma foto',

  // canvas/actions.ts: uploads
  'file.uploadFailed': 'Falha no envio ({status})',
  'file.partFailed': 'Falha na parte {part}',

  // lib/boardFile.ts: .annie3d board files
  'file.tooLarge': 'É possível abrir arquivos de quadro de até {size} GB',
  'file.opened': '{name} aberto',
  'file.couldNotOpen': 'Não foi possível abrir o arquivo',
  'file.notBoardFile': 'Não é um arquivo do Annie 3D',
  'file.notBoardFileOrNewer': 'Não é um arquivo do Annie 3D (ou é de uma versão mais nova)',
  'file.noNodes': 'O arquivo não tem nós',
  'file.uploadPartFailed': 'Falha no envio da parte {part} ({status})',
  'file.couldNotReadResult': 'Não foi possível ler um resultado ({status})',
  'file.missing': 'Falta {path}',
  'file.boardEmpty': 'O quadro está vazio',

  // lib/doc.ts, lib/webDoc.ts: saving and opening board files
  'file.saving': 'Salvando…',
  'file.saved': '{name} salvo',
  'file.couldNotSave': 'Não foi possível salvar: {reason}',
  'file.noLongerOpen': 'Este arquivo de quadro não está mais aberto.',
  'file.typeDescription': 'Quadro do Annie 3D',
  'file.writeDenied': 'A permissão para gravar o arquivo não foi concedida',
  'file.notOpenHere': 'Este arquivo de quadro não está mais aberto neste navegador. Abra-o de novo.',
  'file.allowAccess': 'Permita o acesso a {name} para abri-lo.',
  'file.windowTitle': '{name} – Annie 3D',
  'file.windowTitleUnsaved': '• {name} – Annie 3D',

  // The 3D editor overlay. Header
  'editor.dialog.label': 'Editor 3D: {name}',
  'editor.head.back': 'Voltar à tela',
  'editor.head.notCurrent': '(não é a atual)',
  'editor.head.compare': 'Comparar',
  'editor.head.compareHint': 'Comparar lado a lado',
  'editor.head.compareNeedsTwo': 'Para comparar, são necessárias duas versões',
  'editor.head.export': 'Exportar',
  /** A version number, as on the version strip and the title. */
  'editor.version': 'v{version}',

  // Tools (left rail); `{key}` is the keyboard shortcut letter.
  'editor.tools.label': 'Ferramentas do editor',
  'editor.tool.withKey': '{tool} ({key})',
  'editor.tool.orbit': 'Orbitar',
  'editor.tool.brush': 'Seleção com pincel',
  'editor.tool.lasso': 'Seleção com laço',
  'editor.tool.camera': 'Câmera do packshot',
  'editor.tool.light': 'Luz de prévia',
  'editor.tool.clear': 'Limpar seleção (Delete)',

  // Viewport
  'editor.viewport.label': 'Visualização 3D',
  'editor.viewport.loading': 'Carregando modelo…',
  'editor.option.brush': 'Pincel',
  'editor.option.brushSize': 'Tamanho do pincel',
  'editor.option.light': 'Luz',
  'editor.option.lightDirection': 'Direção da luz',
  /** `{button}` is the "Use this view for packshots" button. */
  'editor.camera.hint': 'Enquadre o produto e clique em {button}',
  'editor.camera.useView': 'Usar esta vista nos packshots',
  'editor.playback.play': 'Reproduzir',
  'editor.playback.pause': 'Pausar',

  // Version strip; `{source}` is one of editor.versionSource.*.
  'editor.versions.label': 'Versões',
  'editor.versions.itemTitle': '{source}, {date}',
  'editor.versions.makeCurrent': 'Tornar atual',
  'editor.versionSource.run': 'execução',
  'editor.versionSource.edit': 'edição',
  'editor.versionSource.upload': 'envio',
  'editor.versionSource.agent': 'agente',
  'editor.versionSource.copy': 'cópia',

  // Edit panel (right)
  'editor.panel.title': 'Editar uma região',
  /** `{regions}` and `{faces}` are editor.selection.regions and editor.selection.faces. */
  'editor.selection.summary': '{regions}, {faces}',
  'editor.selection.regions': { one: '{count} região', many: '{count} de regiões', other: '{count} regiões' },
  'editor.selection.faces': { one: '{count} face', many: '{count} de faces', other: '{count} faces' },
  'editor.panel.stepPaint': '1. Pinte ou contorne com o laço uma região do modelo',
  'editor.panel.stepDescribe': 'O que deve mudar na seleção?',
  'editor.panel.placeholder': 'Por exemplo: deixe a tampa preta fosca',
  'editor.panel.apply': 'Aplicar',
  'editor.panel.help':
    'Só as faces selecionadas mudam. O resultado vira uma nova versão; a anterior continua na faixa.',

  // Toasts
  'editor.toast.loadFailed': 'Não foi possível carregar o modelo: {message}',
  'editor.toast.nowCurrent': 'v{version} agora é a atual',
  'editor.toast.cameraSet': {
    one: 'Câmera do packshot definida em {count} nó',
    many: 'Câmera do packshot definida em {count} de nós',
    other: 'Câmera do packshot definida em {count} nós',
  },
  'editor.toast.packshotAdded': 'Nó de packshot adicionado com esta vista',
  'editor.toast.readyAgain': 'Pronto: selecione a região de novo e clique em Aplicar',
  'editor.toast.selectFirst': 'Selecione uma região primeiro (pincel ou laço)',

  /** Label of the packshot node the camera tool creates. */
  'editor.packshot.customLabel': 'Packshot (vista personalizada)',

  // The simulator. What each place is (tab tooltip).
  'sim.envHint.shop': 'Página de produto de uma loja on-line',
  'sim.envHint.tiktok': 'Feed social vertical com card de loja',
  'sim.envHint.sticker': 'Figurinha de chat com fundo transparente',
  'sim.envHint.showroom': 'Vitrine ao vivo que você controla pelo celular',
  /** Title when nothing names the product (no headline, no custom label). */
  'sim.product.default': 'Seu produto',

  // Overlay header
  'sim.dialog.label': 'Simulador',
  'sim.head.environments': 'Ambiente',
  'sim.head.spin': 'Girar',
  'sim.head.stopSpin': 'Parar de girar',
  'sim.head.download': 'Baixar PNG',
  'sim.head.close': 'Fechar simulador',
  'sim.stage.empty': 'Conecte um modelo 3D a este nó para vê-lo aqui.',
  'sim.stage.loading': 'Carregando 3D…',
  'sim.toast.loadFailed': 'Não foi possível carregar o modelo 3D: {message}',

  // Shop page mock-up
  'sim.shop.brand': 'MARCA',
  'sim.shop.navNew': 'Novidades',
  'sim.shop.navShop': 'Loja',
  'sim.shop.navAbout': 'Sobre',
  'sim.shop.crumb': 'Início / Lançamentos',
  'sim.shop.rating': {
    one: '{rating} ({count} avaliação)',
    many: '{rating} ({count} de avaliações)',
    other: '{rating} ({count} avaliações)',
  },
  'sim.shop.description': 'Arraste para girar. O que você vê é o produto real em 3D.',
  'sim.shop.addToCart': 'Adicionar ao carrinho',
  'sim.shop.freeShipping': 'Frete grátis acima de US$ 50',
  'sim.shop.returns': 'Devolução em até 30 dias',

  // TikTok feed mock-up
  'sim.tiktok.following': 'Seguindo',
  'sim.tiktok.forYou': 'Para você',
  'sim.tiktok.share': 'Compartilhar',
  'sim.tiktok.handle': '@suamarca',
  'sim.tiktok.tags': '#fyp #tiktokshop #novidade',

  // Chat sticker mock-up
  'sim.sticker.msgAsk': 'viu o lançamento novo?? 👀',
  'sim.sticker.msgSend': 'te mandando a figurinha',
  'sim.sticker.msgReply': 'meu deus, quero 😍',
  'sim.sticker.note':
    'A figurinha é a visualização ao vivo com fundo transparente: gire e depois baixe o PNG.',

  // Showroom: phone pairing panel
  'sim.showroom.title': 'Controle pelo celular',
  'sim.showroom.help':
    'Escaneie com o celular e incline-o: o produto acompanha. Funciona nos dois sentidos: o celular vê o que esta tela mostra.',
  /** `{command}` is the command name `pnpm share`. */
  'sim.showroom.localhost':
    'Celulares não conseguem abrir localhost. Abra este quadro pelo link do {command} para parear um celular.',
  'sim.showroom.phones': {
    one: '{count} celular conectado',
    many: '{count} de celulares conectados',
    other: '{count} celulares conectados',
  },
  'sim.showroom.waiting': 'Aguardando um celular',
  'sim.showroom.pose': 'α {alpha}°, β {beta}°, γ {gamma}°',

  // Shared by the overlay and the phone remote
  'sim.status.connecting': 'Conectando…',
  'sim.action.recenter': 'Recentralizar',

  // Phone remote page (/sim/<room>)
  'sim.remote.title': 'Controle remoto do Annie 3D',
  'sim.remote.connected': 'Conectado',
  'sim.remote.waitingScreen': 'Aguardando a tela',
  'sim.remote.product': 'Produto',
  'sim.remote.startMotion': 'Ativar controle por movimento',
  'sim.remote.tilt': 'Incline o celular para girar',
  'sim.remote.motionDenied': 'O acesso ao movimento foi negado. Use o painel abaixo.',
  'sim.remote.motionUnsupported': 'Este aparelho não tem sensor de movimento. Use o painel.',
  'sim.remote.padLabel': 'Arraste para girar o produto',
  'sim.remote.pad': 'Arraste aqui para girar',
  'sim.remote.spin': 'Girar',
  'sim.remote.stop': 'Parar',
  'sim.remote.snapshot': 'Captura',
  'sim.remote.places': 'Local',
  'sim.remote.snapshotAlt': 'Captura da tela',

  // Errors every route can return (lib/http.ts, index.ts)
  'api.error.internal': 'Algo deu errado. Tente de novo.',
  'api.error.unknownEndpoint': 'Endpoint desconhecido',
  'api.http.bodyNotJson': 'O corpo precisa ser JSON',
  'api.http.invalidBody': 'Corpo da requisição inválido',
  'api.http.invalidQuery': 'Consulta inválida',
  'api.http.unknownParam': '{name} desconhecido',
  'api.http.notFound': 'Não encontrado',
  'api.http.expectedWebSocket': 'Esperava-se um upgrade para WebSocket',

  // Sign-in and roles (lib/session.ts)
  'api.auth.signIn': 'Entre para continuar',
  'api.auth.viewerCannotEdit': 'Leitores não podem editar',

  // Workspace made at sign-up (auth.ts)
  'api.workspace.named': 'Espaço de trabalho de {name}',
  'api.workspace.unnamed': 'Meu espaço de trabalho',

  // Boards and board edits (routes/boards.ts, services/boards.ts)
  'api.board.notFound': 'Quadro não encontrado',
  'api.board.tooManyEdits': 'Muitas edições seguidas; aguarde um pouco',
  'api.board.nodeNotFound': 'Nó não encontrado',
  'api.board.opRejected': 'Operação {index} rejeitada: {reason}',
  'api.board.nodeOfOtherBoard': 'O id do nó pertence a outro quadro',
  'api.board.uploadNeedsAsset': 'Versões de envio precisam de settings.assetId',
  'api.board.unknownAsset': 'Arquivo desconhecido',
  'api.board.versionOfOtherNode': 'A versão pertence a outro nó',
  'api.board.unknownSourceVersion': 'Versão de origem desconhecida',

  // Uploads and files (routes/assets.ts)
  'api.upload.tooMany': 'Muitos envios seguidos; tente de novo em um minuto',
  'api.upload.mimeNotAccepted': '{kind}: {mime} não é aceito',
  'api.upload.tooLarge': '{kind}: máximo de {size} MB',
  'api.upload.assetNotFound': 'Arquivo não encontrado',
  'api.upload.partsRequired': 'Um envio em várias partes precisa das partes',
  'api.upload.notInStorage': 'Envio não encontrado no armazenamento',
  'api.upload.sizeMismatch': 'Tamanho divergente: esperado {expected}, armazenado {stored}',
  'api.upload.typeMismatch': 'O conteúdo do arquivo não corresponde ao tipo declarado',
  'api.upload.imageTooLarge': 'Imagem maior que {size} px',
  'api.upload.variantNotFound': 'Variante não encontrada',

  // Board files (.annie3d) import (routes/boardFile.ts, services/boardImport.ts)
  'api.boardFile.tooManyImports': 'Muitas importações seguidas; aguarde um pouco',
  'api.boardFile.useUpload': 'Envie arquivos acima de 80 MB por /import-upload',
  'api.boardFile.uploadUnfinished': 'O envio está ausente, incompleto ou já foi importado',
  'api.boardFile.uploadMissing': 'O envio está ausente',
  'api.boardFile.uploadGone': 'O arquivo enviado não existe mais',
  'api.boardFile.checksum': '{name} não corresponde ao checksum',
  'api.boardFile.missingEntry': 'Falta {path}',
  'api.boardFile.notBoardFile': 'Não é um arquivo do Annie 3D',
  'api.boardFile.newerVersion': 'Não é um arquivo do Annie 3D (ou é de uma versão mais nova)',
  'api.boardFile.noNodes': 'O arquivo não tem nós',
  'api.boardFile.unknownNodes': 'Os resultados são de nós que este quadro não tem',
  'api.boardFile.tooLarge': 'O arquivo é maior que 2 GB',
  'api.boardFile.multiPart': 'Arquivos compactados em várias partes não são arquivos de quadro',
  'api.boardFile.zip64': 'Arquivos ZIP64 não são arquivos de quadro',
  'api.boardFile.tooManyEntries': 'O arquivo tem entradas demais',
  'api.boardFile.damaged': 'O arquivo está corrompido',
  'api.boardFile.encrypted': 'Arquivos criptografados não são arquivos de quadro',
  'api.boardFile.duplicateEntry': 'Entrada duplicada: {name}',
  'api.boardFile.unsupportedCompression': 'Compressão não suportada',
  'api.boardFile.manifestTooLarge': 'A descrição do quadro é grande demais',
  'api.boardFile.unexpectedEntry': 'Entrada inesperada: {name}',
  'api.boardFile.entryCompressed':
    '{name} está compactado; arquivos de quadro guardam a mídia sem compressão',
  'api.boardFile.unreadable': 'Não foi possível ler o arquivo: {reason}',

  // Runs (routes/runs.ts, routes/credits.ts)
  'api.run.notFound': 'Execução não encontrada',
  'api.run.tooMany': 'Muitas execuções seguidas. Aguarde um minuto.',
  'api.run.alreadyRunning': 'Já há uma execução em andamento neste quadro',
  'api.run.notEnoughCredits': 'Créditos insuficientes para esta execução',
  'api.run.nothingToRun': 'Nada para executar: adicione um nó executável',
  'api.run.upToDate': 'Tudo está atualizado',
  'api.run.editNeedsModel': 'Edições de região se aplicam a nós de Modelo 3D',
  'api.run.versionNotOnNode': 'Versão não encontrada neste nó',
  'api.run.selectRegion': 'Selecione uma região primeiro',

  // Run steps, sent over the run's WebSocket in the language of the person who started it
  // (services/runner.ts, engines/*)
  'api.run.connectFirst': 'Conecte “{port}” primeiro',
  'api.run.noEngine': 'Nenhum mecanismo para {kind}',
  'api.run.baseHasNoModel': 'A versão base não tem modelo',
  'api.run.baseModelMissing': 'O arquivo do modelo base está faltando',
  'api.run.selectionExpired': 'A seleção expirou; selecione a região de novo',
  'api.run.inputNotFound': 'Arquivo de entrada não encontrado',
  'api.run.inputMissingInStorage': 'Arquivo de entrada ausente no armazenamento',
  'api.run.gateFailed': 'A verificação de qualidade “{gate}” foi reprovada',
  'api.run.needsPhotoOrText': 'Adicione uma foto do produto ou uma descrição',
  'api.run.regionNotOnVersion': 'A região selecionada não está nesta versão',

  // Progress stages of the engines (engines/simulator.ts, engines/registry.ts, engines/export.ts)
  'api.stage.model3d.readingPhotos': 'Lendo as fotos',
  'api.stage.model3d.segmenting': 'Segmentando o produto',
  'api.stage.model3d.estimatingShape': 'Estimando a forma',
  'api.stage.model3d.buildingMesh': 'Construindo a malha',
  'api.stage.model3d.bakingTextures': 'Gerando as texturas',
  'api.stage.model3d.checkingSilhouette': 'Verificando a silhueta',
  'api.stage.stage.readingBrief': 'Lendo o briefing',
  'api.stage.stage.blockingSet': 'Montando o cenário',
  'api.stage.stage.lighting': 'Iluminação',
  'api.stage.stage.placingProduct': 'Posicionando o produto',
  'api.stage.stage.testRender': 'Render de teste',
  'api.stage.packshot.framing': 'Enquadrando as câmeras',
  'api.stage.packshot.renderingFront': 'Renderizando a frente',
  'api.stage.packshot.renderingAngles': 'Renderizando os ângulos',
  'api.stage.packshot.denoising': 'Removendo ruído',
  'api.stage.adVideo.storyboard': 'Storyboard',
  'api.stage.adVideo.cameraMoves': 'Movimentos de câmera',
  'api.stage.adVideo.renderingFrames': 'Renderizando os frames',
  'api.stage.adVideo.addingHeadline': 'Adicionando o título',
  'api.stage.adVideo.mixingMusic': 'Mixando a música',
  'api.stage.adVideo.encoding': 'Codificando',
  'api.stage.export.packaging': 'Empacotando',
  'api.stage.export.validating': 'Validando o glTF',
  'api.stage.export.writing': 'Gravando os arquivos',
  'api.stage.working': 'Processando',
  'api.stage.done': 'Concluído',
  'api.stage.edit.readingSelection': 'Lendo a seleção',
  'api.stage.edit.applying': 'Aplicando a edição',
  'api.stage.edit.checking': 'Verificando o resultado',
  'api.stage.export.optimising': 'Otimizando para {preset}',
  'api.stage.export.collecting': 'Reunindo os arquivos',
  'api.stage.export.exported': 'Exportado',
  'api.stage.export.exportedWithFailures': 'Exportado com verificações reprovadas',

  // Quality gates and export checks by id (`step.failed.gate`, version gates `<preset>:<id>`)
  'api.gate.inputs': 'Entradas',
  'api.gate.selection': 'Seleção',
  'api.gate.silhouette_iou': 'Correspondência de silhueta',
  'api.gate.watertight': 'Malha fechada',
  'api.gate.triangles': 'Contagem de triângulos',
  'api.gate.product_visible': 'Produto visível',
  'api.gate.framing': 'Enquadramento',
  'api.gate.duration_ok': 'Duração',
  'api.gate.loudness_lufs': 'Volume',
  'api.gate.edit_applied': 'Edição aplicada',
  'api.gate.bytes': 'Tamanho do arquivo',
  'api.gate.texture': 'Tamanho da textura',
  'api.gate.animation': 'Animação',
  'api.gate.validator': 'Validação glTF',

  // Exports (routes/exports.ts, services/exporter.ts)
  'api.export.notFound': 'Exportação não encontrada',
  'api.export.noModelYet': 'Este nó ainda não tem modelo para exportar',
  'api.export.wrongNode': 'Exporte um Modelo 3D ou um nó de Exportação',
  'api.export.nothingToExport': 'Nada para exportar: conecte um modelo 3D, um vídeo ou imagens',
  'api.export.failed': 'A exportação falhou: {reason}',
  'api.export.megabytes': '{value} MB',
  'api.export.checkBytes': '{size} de {limit}',
  'api.export.checkTriangles': '{count} de {limit} triângulos',
  'api.export.checkTexture': 'Maior textura: {size} px (limite de {limit} px)',
  'api.export.checkNoTextures': 'Sem texturas de imagem',
  'api.export.checkAnimation': {
    one: '{count} clipe de animação',
    many: '{count} de clipes de animação',
    other: '{count} clipes de animação',
  },
  'api.export.checkAnimationNeeded': 'Precisa de uma animação (ex.: giro 360°)',
  'api.export.checkAnimationOptional': {
    one: '{count} clipe de animação, nenhum obrigatório',
    many: '{count} de clipes de animação, nenhum obrigatório',
    other: '{count} clipes de animação, nenhum obrigatório',
  },
  'api.export.checkValid': 'Relido como glTF 2.0 válido',
  'api.export.checkInvalid': 'Não é um glTF válido: {reason}',
  'api.export.checkRoundTrip': 'Falha na verificação de ida e volta: {reason}',

  // Shares (routes/shares.ts; the share page's own text is `share.*` in site.ts)
  'api.share.versionNotFound': 'Versão não encontrada',
  'api.share.changed': 'O compartilhamento mudou; tente de novo',
  'api.share.notFound': 'Compartilhamento não encontrado',
  'api.share.unavailable': 'Este link não está disponível',
  'api.share.anonymousOwner': 'Usuário do Annie 3D',

  // Plans and the simulated checkout page (routes/credits.ts)
  'api.plan.creator': 'Creator',
  'api.plan.studio': 'Studio',
  'api.checkout.invalidSignature': 'Assinatura do pagamento inválida',
  'api.checkout.expired': 'O pagamento expirou',
  'api.checkout.otherWorkspace': 'Este pagamento pertence a outro espaço de trabalho',
  'api.checkout.invalidLink': 'Link de pagamento inválido',
  'api.checkout.pageTitle': 'Pagamento · Annie 3D',
  'api.checkout.simulated':
    'Pagamento simulado: nenhum cartão é cobrado. Um provedor real substituirá esta página.',
  'api.checkout.planName': 'Plano {plan}',
  'api.checkout.creditsMonthly': {
    one: '{count} crédito por mês',
    many: '{count} de créditos por mês',
    other: '{count} créditos por mês',
  },
  'api.checkout.dueToday': 'A pagar hoje',
  'api.checkout.pay': 'Pagar {price}',
  'api.checkout.cancel': 'Cancelar e voltar',

  // Reels (routes/reels.ts)
  'api.reel.serverNotAttached':
    'A renderização de reels no servidor ainda não está disponível; grave o reel no navegador',
  'api.reel.afterRun': 'Crie um reel depois que a execução terminar',
  'api.reel.uploadFirst': 'Envie primeiro o vídeo do reel gravado',

  // Simulation remote link (routes/sim.ts)
  'api.sim.badRoom': 'Id de sala inválido',

  // Agent route (routes/agent.ts)
  'api.agent.tooMany': 'Muitas mensagens seguidas. Aguarde um minuto.',
  'api.agent.threadNotFound': 'Conversa não encontrada',
  'api.agent.couldNotApply': 'Não foi possível aplicar “{label}”: {reason}',
  'api.agent.upToDate': 'Tudo já está atualizado, então nada foi executado.',
  'api.agent.overBudget': {
    one: 'Essa execução precisa de {count} crédito, mais que o orçamento de {budget} desta mensagem. Aumente o orçamento e peça de novo.',
    many: 'Essa execução precisa de {count} de créditos, mais que o orçamento de {budget} desta mensagem. Aumente o orçamento e peça de novo.',
    other:
      'Essa execução precisa de {count} créditos, mais que o orçamento de {budget} desta mensagem. Aumente o orçamento e peça de novo.',
  },
  'api.agent.couldNotStart': 'Não consegui iniciar a execução: {reason}',

  // Simulated agent's replies and change labels (agents/simulated.ts)
  'api.agent.help':
    'Posso mudar o visual de um Cenário (lab escuro, pedra e água, veludo, splash pastel, botânico, estúdio), deixá-lo mais quente ou mais frio, definir o vídeo com 6, 10 ou 15 segundos, mudar para 9:16, 1:1 ou 16:9, trocar o movimento, definir o título (“título: ...”), adicionar packshots, escolher uma predefinição de exportação e executar. Selecione nós antes para me indicar uma sequência.',
  'api.agent.ambiguous': {
    one: 'Há {count} nó de {kind}. Selecione o que você quer (ou um nó da sequência dele) e peça de novo.',
    many: 'Há {count} de nós de {kind}. Selecione o que você quer (ou um nó da sequência dele) e peça de novo.',
    other: 'Há {count} nós de {kind}. Selecione o que você quer (ou um nó da sequência dele) e peça de novo.',
  },
  'api.agent.noNode': 'Ainda não há nenhum nó de {kind}, então pulei “{change}”.',
  'api.agent.alreadySet': {
    one: '{nodes} já está com {value}.',
    many: '{nodes} já estão com {value}.',
    other: '{nodes} já estão com {value}.',
  },
  'api.agent.changeOn': '{nodes}: {change}',
  'api.agent.change.look': 'visual → {value}',
  'api.agent.change.direction': 'direção: {value}',
  'api.agent.change.duration': 'duração → {value}',
  'api.agent.change.aspect': 'proporção → {value}',
  'api.agent.change.motion': 'movimento → {value}',
  'api.agent.change.detail': 'detalhe → {value}',
  'api.agent.change.preset': 'predefinição → {value}',
  'api.agent.change.headline': 'Título → “{text}”',
  'api.agent.change.addPackshot': 'Nó de Packshot adicionado a partir de {node}',
  'api.agent.value.seconds': '{seconds} s',
  'api.agent.value.secondsClosest': '{seconds} s (o mais próximo de {wanted} s)',
  'api.agent.value.detailHigh': 'alto',
  'api.agent.value.detailDraft': 'rascunho',
  'api.agent.ambiguousHeadline': {
    one: 'Há {count} título. Selecione a sequência que você quer e peça de novo.',
    many: 'Há {count} de títulos. Selecione a sequência que você quer e peça de novo.',
    other: 'Há {count} títulos. Selecione a sequência que você quer e peça de novo.',
  },
  'api.agent.pickModel': 'Selecione o modelo 3D de onde os packshots devem sair.',
  'api.agent.packshotLabel': 'Packshots (agente)',
  'api.agent.done': 'Pronto:',
  'api.agent.madeChanges': {
    one: 'Fiz {count} alteração:',
    many: 'Fiz {count} de alterações:',
    other: 'Fiz {count} alterações:',
  },
  'api.agent.runningChanged': 'Executando o que mudou; os nós sem alterações continuam em cache.',
  'api.agent.runningBoard': 'Executando o quadro; os nós sem alterações continuam em cache.',
  'api.agent.sayRun': 'Diga “executar” quando quiser ver o resultado.',

  // The desktop shell. macOS application menu ({app} is "Annie 3D").
  'desktop.menu.about': 'Sobre o {app}',
  'desktop.menu.services': 'Serviços',
  'desktop.menu.hide': 'Ocultar {app}',
  'desktop.menu.hideOthers': 'Ocultar Outros',
  'desktop.menu.showAll': 'Mostrar Tudo',
  'desktop.menu.quitApp': 'Encerrar {app}',
  // File
  'desktop.menu.file': 'Arquivo',
  'desktop.menu.newBoardFile': 'Novo Arquivo de Quadro',
  'desktop.menu.open': 'Abrir…',
  'desktop.menu.openRecent': 'Abrir Recente',
  'desktop.menu.clearRecent': 'Limpar Menu',
  'desktop.menu.save': 'Salvar',
  'desktop.menu.saveAs': 'Salvar Como…',
  'desktop.menu.importIntoBoard': 'Importar para Este Quadro…',
  'desktop.menu.closeWindow': 'Fechar Janela',
  'desktop.menu.quit': 'Sair',
  'desktop.menu.exit': 'Sair',
  // Edit
  'desktop.menu.edit': 'Editar',
  'desktop.menu.undo': 'Desfazer',
  'desktop.menu.redo': 'Refazer',
  'desktop.menu.cut': 'Recortar',
  'desktop.menu.copy': 'Copiar',
  'desktop.menu.paste': 'Colar',
  'desktop.menu.selectAll': 'Selecionar Tudo',
  // View
  'desktop.menu.view': 'Visualizar',
  'desktop.menu.reload': 'Recarregar',
  'desktop.menu.toggleDevTools': 'Ferramentas do Desenvolvedor',
  'desktop.menu.toggleFullScreen': 'Alternar Tela Cheia',
  // Window
  'desktop.menu.window': 'Janela',
  'desktop.menu.minimize': 'Minimizar',
  'desktop.menu.zoom': 'Zoom',
  'desktop.menu.bringAllToFront': 'Trazer Tudo para a Frente',
  'desktop.menu.close': 'Fechar',
  // Help
  'desktop.menu.help': 'Ajuda',
  'desktop.menu.website': 'Site do {app}',

  // Board files as documents
  'desktop.doc.untitled': 'Sem título.annie3d',
  'desktop.doc.fileType': 'Quadro do Annie 3D',
  'desktop.close.message': 'Deseja salvar as alterações feitas em “{name}”?',
  'desktop.close.detail': 'Suas alterações serão perdidas se você não salvá-las.',
  'desktop.close.dontSave': 'Não Salvar',
  'desktop.open.failed': 'Não foi possível abrir “{name}”',

  // Why a board file was refused ({name} is a path inside the file)
  'desktop.file.tooLarge': 'O arquivo é maior que 2 GB',
  'desktop.file.notBoard': 'Não é um arquivo do Annie 3D',
  'desktop.file.notBoardOrNewer': 'Não é um arquivo do Annie 3D (ou é de uma versão mais nova)',
  'desktop.file.damaged': 'O arquivo está corrompido',
  'desktop.file.invalidDescription': 'A descrição do quadro não é válida',
  'desktop.file.multiPart': 'Arquivos compactados em várias partes não são arquivos de quadro',
  'desktop.file.zip64': 'Arquivos ZIP64 não são arquivos de quadro',
  'desktop.file.tooManyEntries': 'O arquivo tem entradas demais',
  'desktop.file.encrypted': 'Arquivos criptografados não são arquivos de quadro',
  'desktop.file.duplicateEntry': 'Entrada duplicada: {name}',
  'desktop.file.unsupportedCompression': 'Compressão não suportada',
  'desktop.file.descriptionTooLarge': 'A descrição do quadro é grande demais',
  'desktop.file.unexpectedEntry': 'Entrada inesperada: {name}',
  'desktop.file.compressedMedia': '{name} está compactado; arquivos de quadro guardam a mídia sem compressão',
  'desktop.file.invalidBoard': 'Quadro inválido',
  'desktop.file.invalidAsset': 'Arquivo inválido: {name}',
  'desktop.file.missingAsset': 'Falta {name}',
  'desktop.file.boardTooLarge': 'O quadro é maior que 2 GB',
  'desktop.file.needsBytes': 'Cada arquivo precisa ter conteúdo',

  // The static site. Every page
  'site.meta.pageTitle': '{title} · Annie 3D',
  'site.nav.skipToContent': 'Pular para o conteúdo',
  'site.nav.homeLabel': 'Início do Annie 3D',
  'site.nav.openCanvas': 'Abrir a tela',
  'site.nav.footer': 'Rodapé',
  'site.nav.canvas': 'Tela',
  'site.nav.privacy': 'Privacidade',
  'site.nav.terms': 'Termos',
  'site.nav.contact': 'Contato',
  'site.nav.languages': 'Idiomas',
  'site.footer.copyright': '© 2026 Annie 3D, Austrália.',

  // /home
  'site.home.title': 'Anúncios 3D de produtos a partir de uma foto',
  'site.home.description':
    'O Annie 3D transforma uma foto de produto em um modelo 3D de verdade, anúncios em vídeo, packshots de qualquer ângulo e um GLB animado, numa tela que você abre sem criar conta.',
  'site.home.eyebrow': 'Espaço de trabalho de publicidade 3D',
  'site.home.headline': 'Entra uma foto do produto. Sai um anúncio 3D.',
  'site.home.lead':
    'Solte uma foto do produto na tela. O Annie 3D cria o produto como um modelo 3D de verdade e entrega um anúncio em vídeo, packshots de qualquer ângulo, um GLB animado para a sua loja e um link que qualquer pessoa pode abrir. Como tudo sai do mesmo modelo, seu produto fica exatamente igual em todos eles.',
  'site.home.whatEyebrow': 'O que você recebe',
  'site.home.whatTitle': 'Tudo a partir de um só modelo',
  'site.home.videosTitle': 'Anúncios em vídeo',
  'site.home.videosBody':
    'Desmontagens para tecnologia, pedra e água para joias, splash em destaque para beleza, em 1:1, 4:5 e 9:16.',
  'site.home.packshotsTitle': 'Packshots de qualquer ângulo',
  'site.home.packshotsBody': 'Enquadre a câmera você mesmo ou use quatro ângulos padrão.',
  'site.home.glbTitle': 'GLB animado',
  'site.home.glbBody':
    'Verificado com os limites da web, do Google Merchant e do Google Swirl antes do download.',
  'site.home.howEyebrow': 'Como funciona',
  'site.home.howTitle': 'Uma tela de nós que você pode reconectar',
  'site.home.howBody':
    'Comece com um fluxo pronto ou adicione seus próprios nós: foto, texto, modelo 3D, cenário, packshot, anúncio em vídeo e exportação. Selecione uma região do modelo e descreva a alteração; cada edição vira uma nova versão que você pode comparar ou desfazer.',
  'site.home.tryExample': 'Experimente o quadro de exemplo',

  // /legal/*
  'site.legal.draft':
    'Rascunho para a versão de pré-lançamento · será revisado pela assessoria jurídica antes do lançamento',
  'site.legal.translationNotice':
    'Esta tradução é fornecida por conveniência. Se ela divergir da versão em inglês, prevalece a versão em inglês.',
  'site.legal.readEnglish': 'Ler a versão em inglês',

  'site.terms.title': 'Termos de uso',
  'site.terms.description': 'Termos para usar o Annie 3D.',
  'site.terms.contentTitle': 'Seu conteúdo',
  'site.terms.contentBody':
    'Você mantém os direitos sobre as fotos que envia e os resultados que cria. Envie apenas produtos que você tem o direito de anunciar.',
  'site.terms.useTitle': 'Uso aceitável',
  'site.terms.useBody':
    'Não use o Annie 3D para criar anúncios de produtos falsificados, para se passar por marcas ou pessoas, nem para produzir conteúdo ilegal.',
  'site.terms.creditsTitle': 'Créditos',
  'site.terms.creditsBody':
    'As execuções usam créditos. Uma execução que não passa nas nossas verificações de qualidade é reembolsada automaticamente.',
  'site.terms.preReleaseTitle': 'Pré-lançamento',
  'site.terms.preReleaseBody':
    'Os recursos podem mudar. Avisaremos sobre mudanças que afetem seus dados antes que elas entrem em vigor.',

  'site.privacy.title': 'Aviso de privacidade',
  'site.privacy.description': 'Como o Annie 3D trata seus dados.',
  'site.privacy.whoTitle': 'Quem somos',
  'site.privacy.whoBody': 'O Annie 3D é operado a partir da Austrália. Contato: {email}.',
  'site.privacy.storeTitle': 'O que armazenamos',
  'site.privacy.storeBody':
    'O nome, o endereço de e-mail e a foto de perfil da sua conta Google quando você entra; os quadros, nós, prompts e versões que você cria; os arquivos que você envia e os arquivos que geramos para você; o histórico de execuções e as transações de créditos.',
  'site.privacy.whereTitle': 'Onde os dados ficam armazenados',
  'site.privacy.whereBody':
    'Os dados de conta e de quadros ficam em um banco de dados Postgres hospedado pela Neon em Sydney, na Austrália. Os arquivos ficam no armazenamento de objetos Cloudflare R2, na região da Oceania. As páginas são entregues pela rede da Cloudflare.',
  'site.privacy.cookiesTitle': 'Cookies',
  'site.privacy.cookiesBody':
    'Um cookie de sessão próprio mantém você conectado, e um cookie próprio lembra o idioma que você escolher. Não usamos cookies de publicidade.',
  'site.privacy.sharingTitle': 'Compartilhamento',
  'site.privacy.sharingBody':
    'Nada fica público, a menos que você crie um link de compartilhamento. Você pode revogar um link a qualquer momento.',
  'site.privacy.deleteTitle': 'Exclusão dos seus dados',
  'site.privacy.deleteBody':
    'Exclua quadros pela tela ou nos envie um e-mail para excluir sua conta e todos os arquivos.',

  // Public share page rendered by the Worker (/s/<token>)
  'share.unavailableTitle': 'Link indisponível',
  'share.unavailableHeading': 'Este link não está disponível',
  'share.unavailableBody': 'Talvez o dono tenha desativado o link.',
  'share.openApp': 'Abrir o Annie 3D',
  'share.makeYours': 'Crie o seu grátis',
  'share.description': '{owner} criou isto com o Annie 3D: anúncios 3D de produtos a partir de uma foto.',
  'share.by': 'por {owner}',
  'share.modelAlt': 'Prévia do modelo 3D',
  'share.modelTitle': 'Modelo 3D',
  'share.triangles': { one: '{count} triângulo', many: '{count} de triângulos', other: '{count} triângulos' },
  'share.megabytes': '{size} MB',
  'share.downloadGlb': 'Baixar GLB',
  'share.madeWith': 'Feito com {brand}',
  'share.terms': 'Termos',
};

/** Keys whose correct Portuguese is the English text (names, loanwords). */
export const sameAsEnglish: readonly string[] = [
  'node.packshot',
  'port.adVideo.logo',
  'port.simulation.logo',
  'simEnv.showroom',
  'starter.node.pack',
  'dialog.billing.plan.creator',
  'dialog.billing.plan.studio',
  'dialog.export.megabytes',
  'dialog.run.total',
  'perf.server',
  'perf.ms',
  'perf.seconds',
  'perf.budget',
  'canvas.port.one',
  'board.exampleLabel',
  'file.windowTitle',
  'file.windowTitleUnsaved',
  'editor.version',
  'editor.tool.withKey',
  'editor.versions.itemTitle',
  'editor.selection.summary',
  'sim.showroom.pose',
  'api.stage.adVideo.storyboard',
  'api.export.megabytes',
  'api.plan.creator',
  'api.plan.studio',
  'api.agent.changeOn',
  'desktop.menu.zoom',
  'site.meta.pageTitle',
  'site.privacy.cookiesTitle',
  'share.megabytes',
];

export default catalog;
