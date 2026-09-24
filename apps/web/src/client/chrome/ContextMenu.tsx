import { NODE_DEFS } from '@annie3d/contracts';
import { useCallback } from 'react';
import { deleteNodes, onRunNode, openEditor } from '../canvas/actions';
import { copySelection, duplicateNodes, hasCopy, pasteNodes } from '../canvas/clipboard';
import { useBoard } from '../store/board';
import { useUi } from '../store/ui';
import { Popover } from './Popover';

export function ContextMenu() {
  const menu = useUi((s) => s.contextMenu);
  const close = useCallback(() => useUi.setState({ contextMenu: null }), []);
  if (!menu) return null;
  const node = menu.nodeId ? useBoard.getState().graph.nodes.get(menu.nodeId) : undefined;
  const selected = [...useUi.getState().selected];
  const targets = node ? (selected.includes(node.id) ? selected : [node.id]) : selected;
  const item = (label: string, fn: () => void, kbd?: string, testId?: string) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        close();
        fn();
      }}
      data-testid={testId}
    >
      {label}
      {kbd && <kbd>{kbd}</kbd>}
    </button>
  );
  return (
    <Popover x={menu.x} y={menu.y} onClose={close} label="Canvas menu" testId="context-menu">
      <div role="menu">
        {node ? (
          <>
            {NODE_DEFS[node.kind].runnable &&
              item('Run this node', () => onRunNode(node.id), undefined, 'ctx-run')}
            {(node.kind === 'model3d' || node.kind === 'upload3d') &&
              node.currentVersionId &&
              item('Open 3D editor', () => openEditor(node.id))}
            {(node.kind === 'model3d' || node.kind === 'upload3d' || node.kind === 'export') &&
              node.currentVersionId &&
              item(
                'Export / download…',
                () => useUi.setState({ dialog: { type: 'export', nodeId: node.id } }),
                undefined,
                'ctx-export',
              )}
            {item(
              'Copy',
              () => {
                useUi.setState({ selected: new Set(targets) });
                copySelection();
              },
              '⌘C',
              'ctx-copy',
            )}
            {item('Duplicate', () => duplicateNodes(targets), '⌘D', 'ctx-duplicate')}
            {item('Delete', () => deleteNodes(targets), '⌫', 'ctx-delete')}
          </>
        ) : (
          <>
            {item(
              'Add node…',
              () =>
                useUi.setState({ palette: { x: menu.x, y: menu.y, flowX: menu.flowX, flowY: menu.flowY } }),
              'N',
              'ctx-add',
            )}
            {hasCopy() &&
              item(
                'Paste here',
                () => pasteNodes(null, () => ({ x: menu.flowX, y: menu.flowY }), true),
                '⌘V',
                'ctx-paste',
              )}
            {targets.length > 0 &&
              item(`Duplicate ${targets.length} selected`, () => duplicateNodes(targets), '⌘D')}
            {targets.length > 0 && item(`Delete ${targets.length} selected`, () => deleteNodes(targets), '⌫')}
          </>
        )}
      </div>
    </Popover>
  );
}
