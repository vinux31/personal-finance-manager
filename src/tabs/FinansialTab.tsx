import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import GoalsTab from '@/tabs/GoalsTab'
import KekayaanTab from '@/tabs/KekayaanTab'
import type { GoalFilters } from '@/queries/goals'

export default function FinansialTab() {
  const [goalFilters, setGoalFilters] = useState<GoalFilters>({})

  return (
    <div className="space-y-6">
      <Tabs defaultValue="kekayaan" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="kekayaan">Kekayaan</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
        </TabsList>
        <TabsContent value="kekayaan">
          <KekayaanTab />
        </TabsContent>
        <TabsContent value="goals">
          <GoalsTab filters={goalFilters} onFiltersChange={setGoalFilters} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
