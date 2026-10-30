export default function Loading() {
  return (
    <div role="status" aria-live="polite">
      <p className="muted">Cargando antecedentes…</p>
      <div className="card" style={{ minHeight: 180, opacity: 0.5 }} />
      <div
        className="card"
        style={{ marginTop: 20, minHeight: 140, opacity: 0.3 }}
      />
    </div>
  );
}
