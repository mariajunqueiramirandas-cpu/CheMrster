/** Today's tutor requests against the plan's daily allowance. */
export function UsageMeter({ used, limit }: { used: number; limit: number }) {
  const shown = Math.min(used, limit);
  return (
    <div className="usage">
      <meter className="usage-meter" min={0} max={Math.max(1, limit)} value={shown} aria-label="Pedidos ao tutor usados hoje" />
      <span className="usage-text">
        {shown} de {limit} pedidos usados hoje
      </span>
    </div>
  );
}
