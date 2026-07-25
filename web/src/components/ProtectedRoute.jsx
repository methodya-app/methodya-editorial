import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

export function ProtectedRoute({ children, adminOnly = false, multimediaCoordinatorOnly = false }) {
  const { profile, isAdmin, isMultimediaCoordinator, loading } = useAuth();

  if (loading) {
    return <div className="p-10 text-center text-deepViolet">Cargando...</div>;
  }
  if (!profile) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/mis-proyectos" replace />;
  if (multimediaCoordinatorOnly && !isMultimediaCoordinator) return <Navigate to="/mis-proyectos" replace />;

  return children;
}
