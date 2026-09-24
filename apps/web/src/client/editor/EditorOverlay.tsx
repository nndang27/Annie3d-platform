import { useUi } from '../store/ui';

/** Placeholder until P6 lands the full editor; closes back to the canvas. */
export default function EditorOverlay({ nodeId }: { nodeId: string }) {
  const close = () => {
    useUi.setState({ editingNodeId: null });
    const u = new URL(location.href);
    u.searchParams.delete('edit');
    history.pushState(null, '', u);
  };
  return (
    <div className="editor" role="dialog" aria-label="3D editor" data-node-id={nodeId}>
      <button type="button" onClick={close}>
        Close
      </button>
    </div>
  );
}
