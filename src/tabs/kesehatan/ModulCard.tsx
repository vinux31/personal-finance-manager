import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ModulItem } from './modulCatalog'

export default function ModulCard({ modul }: { modul: ModulItem }) {
  const navigate = useNavigate()
  const Icon = modul.icon
  const to = `/kesehatan/${modul.slug}`

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => navigate(to)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(to)
        }
      }}
      className="cursor-pointer transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <CardTitle className="text-base">{modul.label}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription>{modul.description}</CardDescription>
      </CardContent>
    </Card>
  )
}
