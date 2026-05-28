import { Outlet } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <div className="min-h-full bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-2xl font-medium tracking-tight select-none">
            <span className="text-text-primary">Bee</span>
            <span className="text-amber">Free</span>
          </span>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
