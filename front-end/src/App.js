import './App.css';
import KanbanBoard from './components/KanbanBoard';
import BoardSidebar from './components/BoardSidebar';
import { Api } from './api';
import { useEffect, useState } from 'react';

function App() {
  const [user, setUser] = useState(null);
  // Login UI removed in single-user mode
  const [boards, setBoards] = useState([]);
  const [currentBoardId, setCurrentBoardId] = useState(() => localStorage.getItem('currentBoardId') || 'default');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('kanban-user');
      if (raw) setUser(JSON.parse(raw));
    } catch {
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    Api.getBoards()
      .then((data) => {
        if (!mounted) return;
        const apiBoards = (data.boards || []).map(b => ({ id: b.id, name: b.title || b.name || 'Board' }));
        if (apiBoards.length > 0) {
          setBoards(apiBoards);
          if (!apiBoards.find((b) => b.id === currentBoardId)) {
            setCurrentBoardId(apiBoards[0].id);
          }
        } else {
          (async () => {
            try {
              const res = await Api.createBoard({ title: 'Bảng mặc định', description: '' });
              const id = res.boardId;
              const board = { id, name: 'Bảng mặc định' };
              if (!mounted) return;
              setBoards([board]);
              setCurrentBoardId(id);
            } catch {
              try {
                const raw = localStorage.getItem('kanban-boards');
                const saved = raw ? JSON.parse(raw) : [];
                setBoards(saved);
                if (saved[0]?.id) setCurrentBoardId(saved[0].id);
              } catch {}
            }
          })();
        }
      })
      .catch(() => {
        try {
          const raw = localStorage.getItem('kanban-boards');
          const saved = raw ? JSON.parse(raw) : [];
          setBoards(saved);
        } catch {}
      });
    return () => { mounted = false; };
  }, [currentBoardId, user]);

  useEffect(() => {
    try { localStorage.setItem('kanban-boards', JSON.stringify(boards)); } catch {}
  }, [boards]);

  useEffect(() => {
    try { localStorage.setItem('currentBoardId', currentBoardId); } catch {}
  }, [currentBoardId]);

  // function login() {
  //   const name = nameInput.trim();
  //   if (!name) return;
  //   const newUser = { id: `u-${Date.now()}`, name };
  //   setUser(newUser);
  //   localStorage.setItem('kanban-user', JSON.stringify(newUser));
  //   setIsLoginOpen(false);
  //   setNameInput('');
  //   setBoards((prev) => prev.map((b) => {
  //     if (b.id !== currentBoardId) return b;
  //     const setP = new Set(b.participants || []);
  //     setP.add(newUser.name);
  //     return { ...b, participants: Array.from(setP) };
  //   }));
  // }

  // function logout() {
  //   setUser(null);
  //   localStorage.removeItem('kanban-user');
  // }

  async function addBoard(name) {
    try {
      const res = await Api.createBoard({ title: name, description: '' });
      const id = res.boardId;
      const board = { id, name };
      setBoards((prev) => [board, ...prev]);
      setCurrentBoardId(id);
    } catch {
      const id = `b-${Date.now()}`;
      const board = { id, name };
      setBoards((prev) => [board, ...prev]);
      setCurrentBoardId(id);
    }
  }

  function selectBoard(id) {
    setCurrentBoardId(id);
  }

  // Listen for delete-board events from Sidebar
  useEffect(() => {
    async function handler(e) {
      const { boardId } = e.detail || {};
      if (!boardId) return;
      try {
        await Api.deleteBoard({ boardId });
      } catch {}
      // update local state synchronously and compute next selection from new list
      setBoards((prev) => {
        const newList = prev.filter((b) => b.id !== boardId);
        if (currentBoardId === boardId) {
          const next = newList[0];
          setCurrentBoardId(next ? next.id : 'default');
        }
        return newList;
      });
      // clear board storage
      try { localStorage.removeItem(`kanban-board-${boardId}`); } catch {}
    }
    window.addEventListener('delete-board', handler);
    return () => window.removeEventListener('delete-board', handler);
  }, [boards, currentBoardId]);

  return (
    <div className="app-root">
      <header className="app-header">
        <button className="hamburger" onClick={() => setIsSidebarOpen((v) => !v)} aria-label="Toggle menu">≡</button>
        <div className="brand">
          <span className="dot" />
          <h1>To Do Tasks</h1>
        </div>
      </header>
      <main className={`app-main with-sidebar ${isSidebarOpen ? 'sidebar-open' : ''}`}>
        <BoardSidebar
          isOpen={isSidebarOpen}
          boards={boards}
          currentBoardId={currentBoardId}
          onSelectBoard={selectBoard}
          onAddBoard={addBoard}
          onToggle={() => setIsSidebarOpen((v) => !v)}
        />
        <div className="content">
          <KanbanBoard currentUser={user} boardId={currentBoardId} api={Api} />
        </div>
      </main>
    </div>
  );
}

export default App;
