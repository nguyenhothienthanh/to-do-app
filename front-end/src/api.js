const API_BASE = process.env.REACT_APP_API_BASE ;

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export const Api = {
  getBoards() {
    return request('/boards');
  },
  createBoard(payload) {
    return request('/boards', { method: 'POST', body: JSON.stringify(payload) });
  },
  getTasksByBoardId(boardId) {
    const q = new URLSearchParams({ boardId }).toString();
    return request(`/tasks?${q}`);
  },
  createTask(payload) {
    return request('/tasks', { method: 'POST', body: JSON.stringify(payload) });
  },
  updateTaskStatus({ boardId, taskId, status }) {
    return request('/tasks/status', { method: 'PATCH', body: JSON.stringify({ boardId, taskId, status }) });
  },
  deleteTask({ boardId, taskId }) {
    return request('/tasks', { method: 'DELETE', body: JSON.stringify({ boardId, taskId }) });
  },
  deleteBoard({ boardId }) {
    return request('/boards', { method: 'DELETE', body: JSON.stringify({ boardId }) });
  }
};


