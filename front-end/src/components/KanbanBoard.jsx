import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const initialData = {
  columns: [
    { id: 'TODO', title: 'To Do', taskIds: ['t1', 't2'] },
    { id: 'IN_PROGRESS', title: 'In Progress', taskIds: ['t3'] },
    { id: 'DONE', title: 'Done', taskIds: [] }
  ],
  tasks: {
    t1: {
      id: 't1',
      title: 'Design UI',
      description: 'Build kanban layout',
      status: 'TODO',
      boardId: 'default',
      createdAt: new Date().toISOString(),
      startDate: '',
      dueDate: '',
      tags: []
    },
    t2: {
      id: 't2',
      title: 'Configure DnD',
      description: 'Enable drag and drop',
      status: 'TODO',
      boardId: 'default',
      createdAt: new Date().toISOString(),
      startDate: '',
      dueDate: '',
      tags: []
    },
    t3: {
      id: 't3',
      title: 'Optimize responsive',
      description: 'Mobile-first tweaks',
      status: 'IN_PROGRESS',
      boardId: 'default',
      createdAt: new Date().toISOString(),
      startDate: '',
      dueDate: '',
      tags: []
    }
  }
};

const emptyBoardData = {
  columns: [
    { id: 'TODO', title: 'To Do', taskIds: [] },
    { id: 'IN_PROGRESS', title: 'In Progress', taskIds: [] },
    { id: 'DONE', title: 'Done', taskIds: [] }
  ],
  tasks: {}
};

function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const saveTimeoutRef = useRef();
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // ignore quota errors
      }
    }, 250);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [key, value]);

  return [value, setValue];
}

export default function KanbanBoard({ currentUser, boardId = 'default', api }) {
  const [board, setBoard] = useLocalStorage(`kanban-board-${boardId}`, initialData);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskTags, setNewTaskTags] = useState('');
  const [newTaskStart, setNewTaskStart] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [errors, setErrors] = useState({ title: '', desc: '', tags: '', dates: '' });

  const columnTaskMap = useMemo(() => {
    const map = {};
    for (const col of board.columns) {
      map[col.id] = col.taskIds.map((tid) => board.tasks[tid]).filter(Boolean);
    }
    return map;
  }, [board]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`kanban-board-${boardId}`);
      const stored = raw ? JSON.parse(raw) : null;
      setBoard(stored && stored.columns && stored.tasks ? stored : emptyBoardData);
    } catch {
      setBoard(emptyBoardData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        if (!api) return;
        const data = await api.getTasksByBoardId(boardId);
        const tasksArr = data.tasks || [];
        if (tasksArr.length === 0) return;
        const tasks = {};
        const byStatus = { TODO: [], IN_PROGRESS: [], DONE: [] };
        for (const t of tasksArr) {
          const id = t.id || t.SK || `${Math.random()}`;
          tasks[id] = {
            id,
            title: t.title || 'Task',
            description: t.description || '',
            status: t.status || 'TODO',
            boardId,
            createdAt: t.createdAt || new Date().toISOString(),
            startDate: t.startDate || '',
            dueDate: t.dueDate || '',
            tags: t.tags || []
          };
          const col = tasks[id].status;
          if (!byStatus[col]) byStatus[col] = [];
          byStatus[col].push(id);
        }
        const columns = [
          { id: 'TODO', title: 'To Do', taskIds: byStatus.TODO || [] },
          { id: 'IN_PROGRESS', title: 'In Progress', taskIds: byStatus.IN_PROGRESS || [] },
          { id: 'DONE', title: 'Done', taskIds: byStatus.DONE || [] }
        ];
        if (mounted) setBoard({ columns, tasks });
      } catch {
      }
    }
    load();
    return () => { mounted = false; };
  }, [api, boardId, setBoard]);

  const onDragEnd = useCallback(async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    )
      return;

    setBoard((prev) => {
      const sourceCol = prev.columns.find((c) => c.id === source.droppableId);
      const destCol = prev.columns.find((c) => c.id === destination.droppableId);
      if (!sourceCol || !destCol) return prev;

      const newSourceTaskIds = Array.from(sourceCol.taskIds);
      newSourceTaskIds.splice(source.index, 1);
      const newDestTaskIds = Array.from(destCol.taskIds);
      newDestTaskIds.splice(destination.index, 0, draggableId);

      const newColumns = prev.columns.map((c) => {
        if (c.id === sourceCol.id) return { ...c, taskIds: newSourceTaskIds };
        if (c.id === destCol.id) return { ...c, taskIds: newDestTaskIds };
        return c;
      });

      const task = prev.tasks[draggableId];
      const updatedTask = { ...task, status: destCol.id };
      const tasks = { ...prev.tasks, [draggableId]: updatedTask };

      return { ...prev, columns: newColumns, tasks };
    });
    try {
      if (api) {
        await api.updateTaskStatus({ boardId, taskId: draggableId, status: destination.droppableId });
      }
    } catch {}
  }, [api, boardId, setBoard]);

  function parseList(input) {
    return input
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function validateInputs() {
    const nextErrors = { title: '', desc: '', tags: '', dates: '' };
    const title = newTaskTitle.trim();
    const desc = newTaskDesc.trim();
    const tagsList = parseList(newTaskTags);

    if (!title) nextErrors.title = 'Title is required.';
    if (title.length > 120) nextErrors.title = 'Title must be ≤ 120 characters.';
    if (desc.length > 500) nextErrors.desc = 'Description must be ≤ 500 characters.';

    if (tagsList.length > 10) {
      nextErrors.tags = 'At most 10 tags allowed.';
    } else {
      const invalid = tagsList.find((t) => !/^[A-Za-z0-9-_]{1,20}$/.test(t));
      if (invalid) nextErrors.tags = 'Tags must be 1-20 chars: letters, numbers, - or _.';
    }

    if (newTaskStart && newTaskDue) {
      const start = new Date(newTaskStart);
      const due = new Date(newTaskDue);
      if (Number.isFinite(start.getTime()) && Number.isFinite(due.getTime())) {
        if (due.getTime() < start.getTime()) nextErrors.dates = 'Due date cannot be earlier than start date.';
      }
    }

    setErrors(nextErrors);
    return !nextErrors.title && !nextErrors.desc && !nextErrors.tags && !nextErrors.dates;
  }

  async function addTask() {
    const title = newTaskTitle.trim();
    const description = newTaskDesc.trim();
    if (!validateInputs()) return;

    if (newTaskStart && newTaskDue) {
      const start = new Date(newTaskStart);
      const due = new Date(newTaskDue);
      if (due.getTime() < start.getTime()) {
        alert('Due date cannot be earlier than start date.');
        return;
      }
    }

    const tags = parseList(newTaskTags);
    const firstCol = board.columns[0]?.id || 'TODO';

    let newId = `t${Date.now()}`;
    if (api) {
      try {
        const res = await api.createTask({
          boardId,
          title,
          description,
          status: firstCol,
          startDate: newTaskStart || '',
          dueDate: newTaskDue || '',
          tags
        });
        if (res && res.taskId) newId = res.taskId;
      } catch {
      }
    }

    const now = new Date().toISOString();
    const task = {
      id: newId,
      title,
      description,
      status: firstCol,
      boardId,
      createdAt: now,
      startDate: newTaskStart || '',
      dueDate: newTaskDue || '',
      tags
    };
    setBoard((prev) => {
      const tasks = { ...prev.tasks, [newId]: task };
      const columns = prev.columns.map((c, idx) =>
        idx === 0 ? { ...c, taskIds: [newId, ...c.taskIds] } : c
      );
      return { ...prev, tasks, columns };
    });
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskTags('');
    setNewTaskStart('');
    setNewTaskDue('');
    setErrors({ title: '', desc: '', tags: '', dates: '' });
  }

  async function deleteTask(taskId) {
    setBoard((prev) => {
      const { [taskId]: _removed, ...restTasks } = prev.tasks;
      const columns = prev.columns.map((c) => ({
        ...c,
        taskIds: c.taskIds.filter((id) => id !== taskId)
      }));
      return { ...prev, tasks: restTasks, columns };
    });
    try {
      if (api) {
        await api.deleteTask({ boardId, taskId });
      }
    } catch {}
  }

  const TaskCard = useMemo(() => memo(function TaskCard({ task, index, onDelete }) {
    return (
      <Draggable draggableId={task.id} index={index}>
        {(dragProvided, dragSnapshot) => (
          <article
            className={`task ${dragSnapshot.isDragging ? 'dragging' : ''}`}
            ref={dragProvided.innerRef}
            {...dragProvided.draggableProps}
            {...dragProvided.dragHandleProps}
          >
            <div className="task-title">{task.title}</div>
            {task.description && (
              <div className="task-desc">{task.description}</div>
            )}
            <div className="meta-row">
              <span className="badge status">{task.status}</span>
              {task.startDate && <span className="badge date">Start: {task.startDate}</span>}
              {task.dueDate && <span className="badge date">Due: {task.dueDate}</span>}
            </div>
            {task.tags && task.tags.length > 0 && (
              <div className="meta-row">
                {task.tags.map((t) => (
                  <span key={t} className="chip yellow">#{t}</span>
                ))}
              </div>
            )}
            <div className="meta-row muted">Created: {new Date(task.createdAt).toLocaleString()}</div>
            <div className="task-actions">
              <button className="btn ghost" onClick={() => onDelete(task.id)}>Delete</button>
            </div>
          </article>
        )}
      </Draggable>
    );
  }), []);

  const Column = useMemo(() => memo(function Column({ col, tasks, onDelete }) {
    return (
      <Droppable droppableId={col.id}>
        {(provided, snapshot) => (
          <div
            className={`column ${snapshot.isDraggingOver ? 'is-over' : ''}`}
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            <header className="column-header">
              <h3>{col.title}</h3>
              <span className="count">{tasks.length}</span>
            </header>
            <div className="tasks">
              {tasks.map((task, index) => (
                <TaskCard key={task.id} task={task} index={index} onDelete={onDelete} />
              ))}
              {provided.placeholder}
            </div>
          </div>
        )}
      </Droppable>
    );
  }), []);

  return (
    <div className="kanban">
      <section className="composer">
        <input
          className="input title"
          placeholder="Task title"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          aria-invalid={!!errors.title}
        />
        {errors.title && <div className="error-text">{errors.title}</div>}
        <input
          className="input desc"
          placeholder="Description (optional)"
          value={newTaskDesc}
          onChange={(e) => setNewTaskDesc(e.target.value)}
          aria-invalid={!!errors.desc}
        />
        {errors.desc && <div className="error-text">{errors.desc}</div>}
        <input
          className="input"
          placeholder="Tags (comma separated)"
          value={newTaskTags}
          onChange={(e) => setNewTaskTags(e.target.value)}
          aria-invalid={!!errors.tags}
        />
        {errors.tags && <div className="error-text">{errors.tags}</div>}
        <input
          className="input"
          type="date"
          value={newTaskStart}
          onChange={(e) => setNewTaskStart(e.target.value)}
        />
        <input
          className="input"
          type="date"
          value={newTaskDue}
          onChange={(e) => setNewTaskDue(e.target.value)}
          aria-invalid={!!errors.dates}
        />
        {errors.dates && <div className="error-text">{errors.dates}</div>}
        <button className="btn primary" onClick={addTask}>Add</button>
      </section>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="board">
          {board.columns.map((col) => (
            <Column key={col.id} col={col} tasks={columnTaskMap[col.id]} onDelete={deleteTask} />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}


