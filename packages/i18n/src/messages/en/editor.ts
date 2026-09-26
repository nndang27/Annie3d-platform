/** The 3D editor overlay: region edit, versions, compare, packshot camera (EditorOverlay). */
export default {
  // Header
  'editor.dialog.label': '3D editor: {name}',
  'editor.head.back': 'Back to canvas',
  'editor.head.notCurrent': '(not current)',
  'editor.head.compare': 'Compare',
  'editor.head.compareHint': 'Compare side by side',
  'editor.head.compareNeedsTwo': 'Compare needs two versions',
  'editor.head.export': 'Export',
  /** A version number, as on the version strip and the title. */
  'editor.version': 'v{version}',

  // Tools (left rail); `{key}` is the keyboard shortcut letter.
  'editor.tools.label': 'Editor tools',
  'editor.tool.withKey': '{tool} ({key})',
  'editor.tool.orbit': 'Orbit',
  'editor.tool.brush': 'Brush select',
  'editor.tool.lasso': 'Lasso select',
  'editor.tool.camera': 'Packshot camera',
  'editor.tool.light': 'Preview light',
  'editor.tool.clear': 'Clear selection (Delete)',

  // Viewport
  'editor.viewport.label': '3D viewport',
  'editor.viewport.loading': 'Loading model…',
  'editor.option.brush': 'Brush',
  'editor.option.brushSize': 'Brush size',
  'editor.option.light': 'Light',
  'editor.option.lightDirection': 'Light direction',
  /** `{button}` is the "Use this view for packshots" button. */
  'editor.camera.hint': 'Frame the product, then {button}',
  'editor.camera.useView': 'Use this view for packshots',
  'editor.playback.play': 'Play',
  'editor.playback.pause': 'Pause',

  // Version strip; `{source}` is one of editor.versionSource.*.
  'editor.versions.label': 'Versions',
  'editor.versions.itemTitle': '{source}, {date}',
  'editor.versions.makeCurrent': 'Make current',
  'editor.versionSource.run': 'run',
  'editor.versionSource.edit': 'edit',
  'editor.versionSource.upload': 'upload',
  'editor.versionSource.agent': 'agent',
  'editor.versionSource.copy': 'copy',

  // Edit panel (right)
  'editor.panel.title': 'Edit a region',
  /** `{regions}` and `{faces}` are editor.selection.regions and editor.selection.faces. */
  'editor.selection.summary': '{regions}, {faces}',
  'editor.selection.regions': { one: '{count} region', other: '{count} regions' },
  'editor.selection.faces': { one: '{count} face', other: '{count} faces' },
  'editor.panel.stepPaint': '1. Paint or lasso a region on the model',
  'editor.panel.stepDescribe': 'What should change in the selection?',
  'editor.panel.placeholder': 'For example: make the cap matte black',
  'editor.panel.apply': 'Apply',
  'editor.panel.help':
    'Only the selected faces change. The result becomes a new version; the old one stays in the strip.',

  // Toasts
  'editor.toast.loadFailed': 'Could not load the model: {message}',
  'editor.toast.nowCurrent': 'v{version} is now current',
  'editor.toast.cameraSet': {
    one: 'Packshot camera set on {count} node',
    other: 'Packshot camera set on {count} nodes',
  },
  'editor.toast.packshotAdded': 'Added a packshot node with this view',
  'editor.toast.readyAgain': 'Ready: select the region again and press Apply',
  'editor.toast.selectFirst': 'Select a region first (brush or lasso)',

  /** Label of the packshot node the camera tool creates. */
  'editor.packshot.customLabel': 'Packshot (custom view)',
} as const;
