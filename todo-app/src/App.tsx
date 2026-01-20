// src/App.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import 'bootstrap/dist/css/bootstrap.min.css';

const API_URL = 'http://localhost:3001/api/todos';

export const TodoStatus = {
  CREATED: 'created' as const,
  COMPLETED: 'completed' as const,
  ON_GOING: 'on_going' as const,
  PROBLEM: 'problem' as const,
};
export type TodoStatus = typeof TodoStatus[keyof typeof TodoStatus];

interface Todo {
  id: number;
  title: string;
  status: TodoStatus;
  problem_desc?: string;
  created_at: string;
}

export default function App() {
  const queryClient = useQueryClient();

  const [newTodo, setNewTodo] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);

  // --- QUERY TODOS ---
  const { data: todos, isLoading, isError, error } = useQuery<Todo[], Error>({
    queryKey: ['todos'],
    queryFn: async () => {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('Failed to fetch todos');
      return res.json();
    },
  });

  // --- ADD MUTATION ---
  const addMutation = useMutation<Todo, Error, string>({
    mutationFn: async (title: string) => {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error('Failed to add todo');
      return res.json();
    },
    onSuccess: (newTodo) => {
      queryClient.setQueryData<Todo[]>(['todos'], (old = []) => [...old, newTodo]);
    },
  });

  const isAdding = addMutation.status === 'pending'; // <-- perbaikan

  // --- UPDATE STATUS MUTATION ---
  const updateMutation = useMutation<
    Todo,
    Error,
    { id: number; status: TodoStatus },
    { previousTodos?: Todo[] }
  >({
    mutationFn: async ({ id, status }) => {
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      return res.json();
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['todos'] });
      const previousTodos = queryClient.getQueryData<Todo[]>(['todos']);
      queryClient.setQueryData<Todo[]>(['todos'], (old = []) =>
        old.map((t) => (t.id === id ? { ...t, status } : t))
      );
      return { previousTodos };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTodos) {
        queryClient.setQueryData<Todo[]>(['todos'], context.previousTodos);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });

  const isUpdating = updateMutation.status === 'pending'; // <-- perbaikan

  // --- HANDLERS ---
  const handleAdd = () => {
    if (!newTodo.trim()) return;
    addMutation.mutate(newTodo);
    setNewTodo('');
  };

  const filteredTodos = todos?.filter((todo) =>
    todo.title.toLowerCase().includes(search.toLowerCase())
  );

  const statusBadge = (status: TodoStatus) => {
    switch (status) {
      case TodoStatus.CREATED:
        return 'primary';
      case TodoStatus.ON_GOING:
        return 'warning';
      case TodoStatus.COMPLETED:
        return 'success';
      case TodoStatus.PROBLEM:
        return 'danger';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="container py-4">
      <h1 className="mb-4">Todo App (Dropdown + TS + React Query v4)</h1>

      {/* Add Todo */}
      <div className="input-group mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Add new todo..."
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
        />
        <button
          className="btn btn-primary"
          onClick={handleAdd}
          disabled={isAdding}
        >
          {isAdding ? 'Adding...' : 'Add'}
        </button>
      </div>

      {addMutation.isError && (
        <div className="text-danger mb-3">Error adding todo</div>
      )}

      {/* Search */}
      <div className="input-group mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Search todo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Todo Table */}
      {isLoading ? (
        <div className="alert alert-info">Loading todos...</div>
      ) : isError ? (
        <div className="alert alert-danger">Error: {error?.message}</div>
      ) : (
        <table className="table table-bordered table-striped">
          <thead className="table-dark">
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTodos?.map((todo, idx) => (
              <tr key={todo.id}>
                <td>{idx + 1}</td>
                <td>{todo.title}</td>
                <td>
                  <span className={`badge bg-${statusBadge(todo.status)}`}>
                    {todo.status}
                  </span>
                </td>
                <td>
                  <select
                    className="form-select form-select-sm w-auto d-inline me-2"
                    value={todo.status}
                    onChange={(e) =>
                      updateMutation.mutate({
                        id: todo.id,
                        status: e.target.value as TodoStatus,
                      })
                    }
                    disabled={isUpdating}
                  >
                    {Object.values(TodoStatus).map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-sm btn-info text-white"
                    onClick={() => setSelectedTodo(todo)}
                  >
                    Detail
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Detail Modal */}
      {selectedTodo && (
        <>
          <div
            className="modal-backdrop fade show"
            onClick={() => setSelectedTodo(null)}
          ></div>
          <div className="modal d-block" tabIndex={-1}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Todo Detail</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setSelectedTodo(null)}
                  ></button>
                </div>
                <div className="modal-body">
                  <p>
                    <strong>Title:</strong> {selectedTodo.title}
                  </p>
                  <p>
                    <strong>Status:</strong> {selectedTodo.status}
                  </p>
                  <p>
                    <strong>Problem Desc:</strong>{' '}
                    {selectedTodo.problem_desc || '-'}
                  </p>
                  <p>
                    <strong>Created At:</strong>{' '}
                    {new Date(selectedTodo.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setSelectedTodo(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
