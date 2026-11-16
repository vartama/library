import { Navigate, useLocation } from 'react-router-dom';
import { useLibraryStore } from '../store/library';

/** Sends signed-out visitors to /login and remembers where they were going. */
export default function RequireAuth({ children }) {
  const token = useLibraryStore((state) => state.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
