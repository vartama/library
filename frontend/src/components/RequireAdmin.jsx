import { Navigate } from 'react-router-dom';
import { selectIsAdmin, useLibraryStore } from '../store/library';

/** Admin-only pages send other users back to Books (the API refuses them with 403 anyway). */
export default function RequireAdmin({ children }) {
  const isAdmin = useLibraryStore(selectIsAdmin);
  return isAdmin ? children : <Navigate to="/" replace />;
}
