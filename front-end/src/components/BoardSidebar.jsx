import { useState } from 'react';

export default function BoardSidebar({ isOpen, boards, currentBoardId, onSelectBoard, onAddBoard, onToggle }) {
  const [newBoardName, setNewBoardName] = useState('');

  function addBoard() {
    const name = newBoardName.trim();
    if (!name) return;
    onAddBoard(name);
    setNewBoardName('');
  }

  function confirmDelete(boardId) {
    if (!window.confirm('Delete this board and all its tasks?')) return;
    // Trigger deletion via a custom event; App handles API and state
    const evt = new CustomEvent('delete-board', { detail: { boardId } });
    window.dispatchEvent(evt);
  }

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        {isOpen && <h2 className="sidebar-title">My Boards</h2>}
      </div>
      {isOpen && (
        <>
          <div className="sidebar-section">
            {boards.map((b) => (
              <button
                key={b.id}
                className={`board-item ${b.id === currentBoardId ? 'active' : ''}`}
                onClick={() => onSelectBoard(b.id)}
              >
                <span className="dot" />
                <span className="board-name">{b.name}</span>
                <span style={{ marginLeft: 'auto' }}>
                  <button className="btn ghost" onClick={(e) => { e.stopPropagation(); confirmDelete(b.id); }}>Delete</button>
                </span>
              </button>
            ))}
          </div>
          <div className="sidebar-compose">
            <input
              className="input"
              placeholder="New Board Name"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addBoard(); }}
            />
            <button className="btn primary" onClick={addBoard} disabled={!newBoardName.trim()}>Create Board</button>
          </div>
        </>
      )}
    </aside>
  );
}


