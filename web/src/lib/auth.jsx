import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [projectRoles, setProjectRoles] = useState([]);
  const [multimediaProjectRoles, setMultimediaProjectRoles] = useState([]);
  const [isMultimediaCoordinator, setIsMultimediaCoordinator] = useState(false);
  const [implementacionProjectRoles, setImplementacionProjectRoles] = useState([]);
  const [isImplementacionLider, setIsImplementacionLider] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    try {
      const data = await api.get('/auth/me');
      setProfile(data.profile);
      setIsAdmin(data.is_admin);
      setProjectRoles(data.project_roles || []);
      setMultimediaProjectRoles(data.multimedia_project_roles || []);
      setIsMultimediaCoordinator(!!data.is_multimedia_coordinator);
      setImplementacionProjectRoles(data.implementacion_project_roles || []);
      setIsImplementacionLider(!!data.is_implementacion_lider);
    } catch {
      setProfile(null);
      setIsAdmin(false);
      setProjectRoles([]);
      setMultimediaProjectRoles([]);
      setIsMultimediaCoordinator(false);
      setImplementacionProjectRoles([]);
      setIsImplementacionLider(false);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    setToken(data.access_token);
    setProfile(data.profile);
    setProjectRoles(data.project_roles || []);
    setIsAdmin(!!data.profile.is_admin);
    setMultimediaProjectRoles(data.multimedia_project_roles || []);
    setIsMultimediaCoordinator(!!data.is_multimedia_coordinator);
    setImplementacionProjectRoles(data.implementacion_project_roles || []);
    setIsImplementacionLider(!!data.is_implementacion_lider);
    return data;
  };

  const logout = () => {
    setToken(null);
    setProfile(null);
    setIsAdmin(false);
    setProjectRoles([]);
    setMultimediaProjectRoles([]);
    setIsMultimediaCoordinator(false);
    setImplementacionProjectRoles([]);
    setIsImplementacionLider(false);
  };

  return (
    <AuthContext.Provider
      value={{
        profile,
        isAdmin,
        projectRoles,
        multimediaProjectRoles,
        isMultimediaCoordinator,
        implementacionProjectRoles,
        isImplementacionLider,
        loading,
        login,
        logout,
        refresh: loadMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
