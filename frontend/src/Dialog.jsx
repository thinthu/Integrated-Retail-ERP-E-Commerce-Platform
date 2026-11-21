export function Confirm({ title, children, onYes, onNo, yes = 'Confirm', no = 'Cancel', danger, busy }) {
  return (<div className="overlay" onMouseDown={onNo}><div className="modal wide" onMouseDown={(e) => e.stopPropagation()}><h3>{title}</h3><div className="cbody">{children}</div>
    <div className="row l"><button className={'btn' + (danger ? ' danger' : '')} onClick={onYes} disabled={busy}>{yes}</button><button className="btn ghost" onClick={onNo}>{no}</button></div></div></div>)
}
