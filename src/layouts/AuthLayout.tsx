import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import RouteFallback from '../components/ui/RouteFallback'

export default function AuthLayout() {
  return (
    <div className="min-h-full bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-2xl font-medium tracking-tight select-none">
            <span className="text-text-primary">Hi</span>
            <span className="text-amber">vvo</span>
          </span>
        </div>
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  )
}
