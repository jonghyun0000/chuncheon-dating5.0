import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { I18nProvider } from '@/i18n';
import AppRouter from './router';

const router = createBrowserRouter([{ path: '*', element: <AppRouter /> }]);

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </I18nProvider>
  );
}
