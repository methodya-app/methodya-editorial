import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';

import Login from './pages/Login.jsx';
import ProjectsList from './pages/admin/ProjectsList.jsx';
import Analytics from './pages/admin/Analytics.jsx';
import ProjectDetail from './pages/admin/ProjectDetail.jsx';
import FormBuilder from './pages/admin/FormBuilder.jsx';
import UsersGlobal from './pages/admin/UsersGlobal.jsx';
import DocumentTypes from './pages/admin/DocumentTypes.jsx';
import SubformsLibrary from './pages/admin/SubformsLibrary.jsx';
import ParagraphsLibrary from './pages/admin/ParagraphsLibrary.jsx';
import ServerSettings from './pages/admin/ServerSettings.jsx';
import TargetPopulations from './pages/admin/TargetPopulations.jsx';
import DotacionCatalog from './pages/admin/DotacionCatalog.jsx';
import MultimediaRoles from './pages/MultimediaRoles.jsx';
import MyProjects from './pages/shared/MyProjects.jsx';
import MyDocuments from './pages/shared/MyDocuments.jsx';
import DocumentExecute from './pages/shared/DocumentExecute.jsx';
import MultimediaProjects from './pages/shared/MultimediaProjects.jsx';
import MultimediaProjectWork from './pages/shared/MultimediaProjectWork.jsx';
import MultimediaSubformDetail from './pages/shared/MultimediaSubformDetail.jsx';

function Home() {
  const { isAdmin } = useAuth();
  return <Navigate to={isAdmin ? '/admin/proyectos' : '/mis-proyectos'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Home />} />

        <Route path="/admin/proyectos" element={<ProtectedRoute adminOnly><ProjectsList /></ProtectedRoute>} />
        <Route path="/admin/proyectos/:id" element={<ProtectedRoute adminOnly><ProjectDetail /></ProtectedRoute>} />
        <Route path="/admin/analitica" element={<ProtectedRoute adminOnly><Analytics /></ProtectedRoute>} />
        <Route path="/admin/formularios/:id" element={<ProtectedRoute adminOnly><FormBuilder /></ProtectedRoute>} />
        <Route path="/admin/usuarios" element={<ProtectedRoute adminOnly><UsersGlobal /></ProtectedRoute>} />
        <Route path="/admin/tipos-documento" element={<ProtectedRoute adminOnly><DocumentTypes /></ProtectedRoute>} />
        <Route path="/admin/subformularios" element={<ProtectedRoute adminOnly><SubformsLibrary /></ProtectedRoute>} />
        <Route path="/admin/parrafos" element={<ProtectedRoute adminOnly><ParagraphsLibrary /></ProtectedRoute>} />
        <Route path="/admin/parametros" element={<ProtectedRoute adminOnly><ServerSettings /></ProtectedRoute>} />
        <Route
          path="/admin/poblaciones-objetivo"
          element={<ProtectedRoute adminOnly><TargetPopulations /></ProtectedRoute>}
        />
        <Route
          path="/admin/dotacion"
          element={<ProtectedRoute adminOnly><DotacionCatalog /></ProtectedRoute>}
        />
        <Route
          path="/multimedia-roles"
          element={<ProtectedRoute multimediaCoordinatorOnly><MultimediaRoles /></ProtectedRoute>}
        />

        <Route path="/mis-proyectos" element={<MyProjects />} />
        <Route path="/mis-proyectos/:projectId" element={<MyDocuments />} />
        <Route path="/documentos/:id" element={<DocumentExecute />} />
        <Route path="/multimedia" element={<MultimediaProjects />} />
        <Route path="/multimedia/tarea/:id" element={<MultimediaSubformDetail />} />
        <Route path="/multimedia/:projectId" element={<MultimediaProjectWork />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
