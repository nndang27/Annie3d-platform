/**
 * The board: nodes, wires, runs, board files and the process reel (apps/web/src/client/canvas,
 * store, lib, api). Node, port, preset and starter names live in contracts.ts.
 */
export default {
  // canvas/FlowNode.tsx: the node card
  'canvas.node.openSim': 'Open',
  'canvas.node.staleTitle': 'Inputs changed since this version',
  'canvas.node.stale': 'stale',
  'canvas.node.openSimLabel': 'Open simulator',
  'canvas.node.openSimTitle': 'Open simulator (or double-click)',
  'canvas.node.dropPhoto': 'Drop, paste or click to add a photo',
  'canvas.node.dropMusic': 'Drop a music file',
  'canvas.node.dropGlb': 'Drop a .glb file',
  'canvas.node.emptyResult': 'Your generation will appear here',
  'canvas.node.filesReady': { one: '{count} file ready', other: '{count} files ready' },
  'canvas.node.checksPassed': '{passed}/{total} checks passed',
  'canvas.node.checksPassedPreset': '{passed}/{total} checks passed ({preset})',
  'canvas.node.referenceImages': { one: '{count} reference image', other: '{count} reference images' },
  'canvas.node.progress': 'Progress {percent}%',
  'canvas.node.openEditorLabel': 'Open 3D editor',
  'canvas.node.openEditorTitle': 'Open 3D editor (or double-click)',
  'canvas.node.runFromHere': 'Run from here',
  'canvas.node.writePlaceholder': 'Write something…',
  'canvas.node.describePlaceholder': 'Describe what you want…',
  'canvas.node.runCost': 'Run ({credits})',
  'canvas.node.run': 'Run',
  'canvas.node.running': 'Running…',
  'canvas.node.runOptions': 'Run options',
  'canvas.node.runWithInputs': 'Run with inputs',
  'canvas.node.runNodeOnly': 'Run this node only',
  'canvas.node.runDownstream': 'Run this and everything after',

  // canvas/FlowNode.tsx: port bubbles (screen-reader name: port and the types it takes)
  'canvas.port.one': '{port} ({type})',
  'canvas.port.two': '{port} ({first} or {second})',
  'canvas.port.many': '{port} ({list} or {last})',
  'canvas.port.separator': ', ',

  // canvas/FlowNode.tsx: settings toolbar under the selected node. The select names are
  // screen-reader labels; tests find the Builder select by the English name "builder".
  'canvas.toolbar.builder': 'Builder',
  'canvas.toolbar.detail': 'Detail',
  'canvas.toolbar.look': 'Look',
  'canvas.toolbar.angles': 'Angles',
  'canvas.toolbar.size': 'Size',
  'canvas.toolbar.motion': 'Motion',
  'canvas.toolbar.aspect': 'Aspect ratio',
  'canvas.toolbar.durationSec': 'Duration (seconds)',
  'canvas.toolbar.environment': 'Place',
  'canvas.toolbar.glbPreset': 'GLB preset',
  'canvas.toolbar.price': 'Price',
  'canvas.toolbar.builderAuto': 'Builder: auto',
  'canvas.toolbar.builderCode': 'Builder: code',
  'canvas.toolbar.builderGenerative': 'Builder: generative',
  'canvas.toolbar.detailDraft': 'draft',
  'canvas.toolbar.detailStandard': 'standard',
  'canvas.toolbar.detailHigh': 'high',
  'canvas.toolbar.anglesFour': '4 angles',
  'canvas.toolbar.anglesCustom': 'Custom camera',
  'canvas.toolbar.seconds': '{seconds}s',
  'canvas.toolbar.replace': 'Replace',
  'canvas.toolbar.download': 'Download',
  'canvas.toolbar.deleteNode': 'Delete node',
  'canvas.toolbar.delete': 'Delete',
  'canvas.toolbar.more': 'More actions',
  'canvas.toolbar.duplicate': 'Duplicate',
  'canvas.toolbar.copy': 'Copy',

  // canvas/FlowEdge.tsx
  'canvas.edge.remove': 'Remove connection',
  'canvas.edge.label': 'Connection from {from} to {to}',

  // canvas/Canvas.tsx: React Flow's screen-reader texts
  'canvas.a11y.nodeDescription':
    'Press enter or space to select a node. Press delete to remove it and escape to cancel.',
  'canvas.a11y.nodeDescriptionKeyboard':
    'Press enter or space to select a node. You can then use the arrow keys to move the node around. Press delete to remove it and escape to cancel.',
  'canvas.a11y.edgeDescription':
    'Press enter or space to select an edge. You can then press delete to remove it or escape to cancel.',
  'canvas.a11y.nodeMoved': 'Moved selected node {direction}. New position, x: {x}, y: {y}',
  'canvas.a11y.up': 'Up',
  'canvas.a11y.down': 'Down',
  'canvas.a11y.left': 'Left',
  'canvas.a11y.right': 'Right',

  // canvas/clipboard.ts
  'canvas.imageTooLarge': 'Images up to {size} MB can be added',

  // lib/agentClient.ts
  'canvas.agentUnavailable': 'Agent unavailable ({status})',

  // canvas/example.ts, store/board.ts: board titles and labels the app writes
  'board.example': 'Example board',
  'board.untitled': 'Untitled board',
  'board.exampleLabel': '{label} ({product})',
  'board.product.serum': 'serum',
  'board.product.headphones': 'headphones',
  'board.product.ring': 'ring',

  // lib/runSocket.ts, lib/doc.ts: runs
  'run.queued': 'Queued',
  'run.starting': 'Starting',
  'run.checkFailed': 'Check failed: {gate}',
  'run.finished': { one: 'Run finished: {count} credit used', other: 'Run finished: {count} credits used' },
  'run.finishedWithErrors': {
    one: 'Run finished with errors: {count} credit used',
    other: 'Run finished with errors: {count} credits used',
  },
  'run.failedRefunded': 'Run failed. Credits refunded.',
  'run.cancelled': {
    one: 'Run cancelled: {count} credit used',
    other: 'Run cancelled: {count} credits used',
  },
  'run.preparing': 'Preparing to run…',
  'run.couldNotPrepare': 'Could not prepare the run',

  // lib/reel.ts: the process reel (drawn into the video)
  'reel.historyUnavailable': 'Run history is not available',
  'reel.couldNotLoadHistory': 'Could not load the run history',
  'reel.howItWasMade': 'HOW IT WAS MADE',
  'reel.madeWith': 'Made with Annie 3D',
  'reel.tagline': '3D product ads from one photo',

  // canvas/actions.ts: uploads
  'file.uploadFailed': 'Upload failed ({status})',
  'file.partFailed': 'Part {part} failed',

  // lib/boardFile.ts: .annie3d board files
  'file.tooLarge': 'Board files up to {size} GB can be opened',
  'file.opened': 'Opened {name}',
  'file.couldNotOpen': 'Could not open the file',
  'file.notBoardFile': 'Not an Annie 3D file',
  'file.notBoardFileOrNewer': 'Not an Annie 3D file (or a newer version)',
  'file.noNodes': 'The file has no nodes',
  'file.uploadPartFailed': 'Upload part {part} failed ({status})',
  'file.couldNotReadResult': 'Could not read a result ({status})',
  'file.missing': 'Missing {path}',
  'file.boardEmpty': 'The board is empty',

  // lib/doc.ts, lib/webDoc.ts: saving and opening board files
  'file.saving': 'Saving…',
  'file.saved': 'Saved {name}',
  'file.couldNotSave': 'Could not save: {reason}',
  'file.noLongerOpen': 'This board file is no longer open.',
  'file.typeDescription': 'Annie 3D board',
  'file.writeDenied': 'Permission to write the file was not given',
  'file.notOpenHere': 'This board file is not open in this browser any more. Open it again.',
  'file.allowAccess': 'Allow access to {name} to open it.',
  'file.windowTitle': '{name} – Annie 3D',
  'file.windowTitleUnsaved': '• {name} – Annie 3D',
} as const;
