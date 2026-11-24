import { Modal, Button } from '../../../shared/components/ui';

interface IssueActionDialogsProps {
  confirmClose: boolean;
  confirmDelete: boolean;
  busy: boolean;
  cancelClose: () => void;
  cancelDelete: () => void;
  changeStatus: (next: string) => Promise<void>;
  deleteIssue: () => Promise<void>;
}

/** Confirm the destructive and locking transitions only. */
export function IssueActionDialogs({
  confirmClose,
  confirmDelete,
  busy,
  cancelClose,
  cancelDelete,
  changeStatus,
  deleteIssue,
}: IssueActionDialogsProps) {
  return (
    <>
      <Modal
        open={confirmClose}
        title="Close this issue?"
        description="Closing locks editing and new comments until the issue is reopened."
        onClose={() => cancelClose()}
      >
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => cancelClose()}>
            Cancel
          </Button>
          <Button busy={busy} onClick={() => changeStatus('CLOSED')}>
            Close issue
          </Button>
        </div>
      </Modal>

      <Modal
        open={confirmDelete}
        title="Delete this issue?"
        description="The issue and its discussion will immediately disappear from public view. This action cannot be undone."
        onClose={() => cancelDelete()}
      >
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => cancelDelete()}>
            Cancel
          </Button>
          <Button variant="danger" busy={busy} onClick={deleteIssue}>
            Delete issue
          </Button>
        </div>
      </Modal>
    </>
  );
}
