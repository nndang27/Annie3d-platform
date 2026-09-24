import { Button, cx } from '@annie3d/ui';
import { ListChecks, X } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { NodeInspector } from '@/components/workflow/NodeInspector';
import { RunPanel } from '@/components/workflow/RunPanel';
import { WorkflowCanvas } from '@/components/workflow/WorkflowCanvas';
import { WorkflowList } from '@/components/workflow/WorkflowList';
import type { RunFeed } from '@/services/runSubscription';
import { useUiStore } from '@/stores/uiStore';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useProjectContext } from './context';

/**
 * Flows-style work page: the canvas fills the area; the composer and toolbar float at the bottom;
 * runs live in a drawer that opens on demand (and when a run starts). List view keeps the
 * accessible, drag-free alternative with an inspector.
 */
export function WorkflowTab({ feed, composer }: { feed: RunFeed; composer: ReactNode }) {
  const view = useUiStore((s) => s.workflowView);
  const selected = useWorkflowStore((s) => s.selectedNodeId);
  const { canEdit, activeRun } = useProjectContext();
  const [runsOpen, setRunsOpen] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (activeRun) setRunsOpen(true);
  }, [activeRun]);
  // The composer is portalled into the canvas' floating bottom slot so it stays above the canvas chrome.
  useEffect(() => {
    if (view !== 'canvas') return;
    const find = () => setSlot(document.getElementById('flow-composer-slot'));
    find();
    const t = window.setTimeout(find, 50);
    return () => window.clearTimeout(t);
  }, [view]);

  if (view === 'list') {
    return (
      <div className={cx('workspace-body', 'has-inspector')} style={{ minHeight: 'calc(100dvh - 180px)' }}>
        <div className="flow-list-wrap">
          <WorkflowList readOnly={!canEdit} />
          <div style={{ padding: '0 20px 140px' }}>{composer}</div>
        </div>
        {selected ? (
          <NodeInspector readOnly={!canEdit} />
        ) : (
          <aside className="inspector inspector-inline" aria-label="Run status and history">
            <RunPanel run={feed.run} events={feed.events} connection={feed.connection} />
          </aside>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: 0 }}>
      <WorkflowCanvas readOnly={!canEdit} onOpenRuns={() => setRunsOpen(true)} />
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 26 }}>
        <Button
          variant={runsOpen ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setRunsOpen((o) => !o)}
          aria-expanded={runsOpen}
          aria-controls="runs-drawer"
          data-testid="toggle-runs"
        >
          <ListChecks size={14} aria-hidden="true" /> Runs
        </Button>
      </div>
      {runsOpen ? (
        <aside id="runs-drawer" className="flow-drawer" aria-label="Run status and history">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <strong style={{ fontSize: '0.9rem' }}>Runs</strong>
            <Button
              variant="tertiary"
              icon
              size="sm"
              aria-label="Close runs panel"
              onClick={() => setRunsOpen(false)}
            >
              <X size={16} aria-hidden="true" />
            </Button>
          </div>
          <RunPanel run={feed.run} events={feed.events} connection={feed.connection} />
        </aside>
      ) : null}
      {slot ? createPortal(composer, slot) : null}
    </div>
  );
}
