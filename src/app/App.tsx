import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { I18nProvider } from '@/i18n';
import AppRouter from './router';
import { AppLoadError } from '@/components/common/AppErrorBoundary';
import NativeAgeGate from '@/components/common/NativeAgeGate';

const router = createBrowserRouter([{ path: '*', element: <AppRouter />, errorElement: <AppLoadError /> }]);

export default function App() {
  return (
    <I18nProvider>
      <NativeAgeGate>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </NativeAgeGate>
    </I18nProvider>
  );
}
