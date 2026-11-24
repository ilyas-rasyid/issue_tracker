import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button, Empty, LoadingRows, Notice } from '../../../shared/components/ui/index';
import { KanbanBoard } from '../components/KanbanBoard';
import { ProjectHeading } from '../../projects/components/ProjectHeading';
import { IssueBoardToolbar } from '../components/IssueBoardToolbar';
import { IssueBoardControls } from '../components/IssueBoardControls';
import { IssueListTable } from '../components/IssueListTable';
import { IssueListPagination } from '../components/IssueListPagination';
import { useIssueBoard } from '../hooks/useIssueBoard';

/** Page composition: server state and filter logic are in the dedicated hook. */
export function Board() {
  const {
    params,
    user,
    view,
    search,
    setSearch,
    setView,
    update,
    clear,
    hasFilters,
    activeProject,
    list,
    board,
    data,
    columns,
    boardRows,
  } = useIssueBoard();
  return (
    <div className="page board-page">
      <div className="page-heading">
        <ProjectHeading activeSlug={activeProject} />
        {user?.emailVerified ? (
          <Link
            className="button button-primary"
            to={
              activeProject
                ? `/issues/new?project=${encodeURIComponent(activeProject)}`
                : '/issues/new'
            }
          >
            <Plus size={16} /> New issue
          </Link>
        ) : null}
      </div>

      <IssueBoardToolbar params={params} search={search} setSearch={setSearch} update={update} />
      <IssueBoardControls
        view={view}
        total={data?.meta.total}
        hasFilters={hasFilters}
        hasUser={!!user}
        mine={params.get('mine') === 'true'}
        update={update}
        clear={clear}
        setView={setView}
      />

      {view === 'list' ? (
        list.isPending ? (
          <LoadingRows count={8} />
        ) : list.error ? (
          <Notice error={list.error} />
        ) : data?.data.length ? (
          <IssueListTable issues={data.data} />
        ) : (
          <Empty
            title="No matching issues"
            detail={
              hasFilters
                ? 'Try clearing your filters or changing your search.'
                : 'No issues have been reported yet.'
            }
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={clear}>
                  Clear filters
                </Button>
              ) : null
            }
          />
        )
      ) : board.isPending ? (
        <LoadingRows />
      ) : board.error ? (
        <Notice error={board.error} />
      ) : (
        <KanbanBoard
          columns={columns}
          boardRows={boardRows}
          onLoadMore={(status, cursor) => update(`cursor${status}`, cursor)}
        />
      )}

      {view === 'list' && data && (
        <IssueListPagination meta={data.meta} limit={params.get('limit') || '10'} update={update} />
      )}
    </div>
  );
}
