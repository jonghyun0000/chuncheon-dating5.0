import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { I18nProvider } from '@/i18n';
import AppRouter from './router';
import { AppLoadError } from '@/components/common/AppErrorBoundary';

const router = createBrowserRouter([{ path: '*', element: <AppRouter />, errorElement: <AppLoadError /> }]);

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </I18nProvider>
  );
}
