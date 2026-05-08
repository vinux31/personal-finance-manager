import { Outlet } from 'react-router-dom'

/**
 * Layout untuk route /kesehatan dengan children sub-routes.
 * Phase 12: cukup wrapper minimum + Outlet — sub-route Phase 15 nanti
 * akan tambah breadcrumb di sini.
 */
export default function KesehatanLayout() {
  return (
    <div className="space-y-6">
      <Outlet />
    </div>
  )
}
