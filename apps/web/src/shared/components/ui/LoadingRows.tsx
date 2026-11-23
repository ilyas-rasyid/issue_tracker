export function LoadingRows({ count = 5 }: { count?: number }) {
  return (
    <div aria-label="Loading" className="skeleton-list">
      {Array.from({ length: count }, (_, i) => (
        <div className="skeleton-row" key={i}>
          <span />
          <div>
            <span />
            <span />
          </div>
          <span />
        </div>
      ))}
    </div>
  );
}
