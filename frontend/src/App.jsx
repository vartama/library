import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import RequireAdmin from './components/RequireAdmin';
import RequireAuth from './components/RequireAuth';
import BooksPage from './pages/BooksPage';
import GenresPage from './pages/GenresPage';
import HistoryPage from './pages/HistoryPage';
import LendPage from './pages/LendPage';
import LoginPage from './pages/LoginPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<BooksPage />} />
        <Route
          path="genres"
          element={
            <RequireAdmin>
              <GenresPage />
            </RequireAdmin>
          }
        />
        <Route path="lend" element={<LendPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
