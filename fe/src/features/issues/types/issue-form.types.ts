import type { Issue } from '../../../shared/api/types';
export interface IssueFormProps {
  issue?: Issue;
  onSaved?: (issue: Issue) => void;
  onCancel?: () => void;
}
