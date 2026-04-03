'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Save, Plus, Trash2, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GrowthMapEditorProps {
  data: {
    mapId: string
    title: string
    description: string
    status: string
    stages: Array<{
      id: string
      title: string
      description: string
      durationWeeks: number
      goals: Array<{
        id: string
        title: string
        description: string
        tasks: Array<{
          id: string
          title: string
          description: string
          type: 'learn' | 'practice' | 'test' | 'reflect'
          durationDays: number
        }>
      }>
    }>
  }
}

export function GrowthMapEditor({ data }: GrowthMapEditorProps) {
  const [mapData, setMapData] = useState(data)
  const [saving, setSaving] = useState(false)

  const handleSave = async (activate = false) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/growth-map/${mapData.mapId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...mapData,
          status: activate ? 'learning' : mapData.status,
        }),
      })

      if (response.ok) {
        alert(activate ? '保存成功并已激活地图！' : '保存成功！')
        window.location.reload()
      } else {
        alert('保存失败，请重试')
      }
    } catch (error) {
      console.error('Save error:', error)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Save Buttons */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          当前状态：
          <span className={`ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            mapData.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
            mapData.status === 'pending_plan' ? 'bg-blue-100 text-blue-800' :
            mapData.status === 'planned' ? 'bg-emerald-100 text-emerald-800' :
            mapData.status === 'learning' ? 'bg-green-100 text-green-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {mapData.status === 'draft' ? '草稿' : mapData.status === 'pending_plan' ? '待规划' : mapData.status === 'planned' ? '已规划' : mapData.status === 'learning' ? '学习中' : '已完成'}
          </span>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => handleSave(false)} 
            disabled={saving} 
            variant="outline"
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? '保存中...' : '保存草稿'}
          </Button>
          {mapData.status === 'draft' && (
            <Button 
              onClick={() => handleSave(true)} 
              disabled={saving}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? '保存中...' : '保存并激活'}
            </Button>
          )}
        </div>
      </div>

      {/* Map Info */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="font-semibold mb-4">基本信息</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">标题</label>
            <Input
              value={mapData.title}
              onChange={(e) => setMapData({ ...mapData, title: e.target.value })}
              placeholder="学习地图标题"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">描述</label>
            <textarea
              value={mapData.description}
              onChange={(e) => setMapData({ ...mapData, description: e.target.value })}
              placeholder="学习地图描述"
              className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Stages */}
      <div className="space-y-4">
        {mapData.stages.map((stage, sIdx) => (
          <div key={stage.id} className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex items-center gap-2 flex-1">
                <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                <div className="flex-1">
                  <Input
                    value={stage.title}
                    onChange={(e) => {
                      const newStages = [...mapData.stages]
                      newStages[sIdx].title = e.target.value
                      setMapData({ ...mapData, stages: newStages })
                    }}
                    placeholder="阶段标题"
                    className="font-semibold"
                  />
                </div>
                <Input
                  type="number"
                  value={stage.durationWeeks}
                  onChange={(e) => {
                    const newStages = [...mapData.stages]
                    newStages[sIdx].durationWeeks = parseInt(e.target.value) || 0
                    setMapData({ ...mapData, stages: newStages })
                  }}
                  placeholder="周数"
                  className="w-24"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newStages = mapData.stages.filter((_, i) => i !== sIdx)
                    setMapData({ ...mapData, stages: newStages })
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>

            <textarea
              value={stage.description}
              onChange={(e) => {
                const newStages = [...mapData.stages]
                newStages[sIdx].description = e.target.value
                setMapData({ ...mapData, stages: newStages })
              }}
              placeholder="阶段描述"
              className="w-full mb-4 rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={2}
            />

            {/* Goals */}
            <div className="space-y-3 pl-6">
              {stage.goals.map((goal, gIdx) => (
                <div key={goal.id} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Input
                      value={goal.title}
                      onChange={(e) => {
                        const newStages = [...mapData.stages]
                        newStages[sIdx].goals[gIdx].title = e.target.value
                        setMapData({ ...mapData, stages: newStages })
                      }}
                      placeholder="目标标题"
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newStages = [...mapData.stages]
                        newStages[sIdx].goals = newStages[sIdx].goals.filter((_, i) => i !== gIdx)
                        setMapData({ ...mapData, stages: newStages })
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  {/* Tasks */}
                  <div className="space-y-2 pl-4">
                    {goal.tasks.map((task, tIdx) => (
                      <div key={task.id} className="flex items-center gap-2">
                        <select
                          value={task.type}
                          onChange={(e) => {
                            const newStages = [...mapData.stages]
                            newStages[sIdx].goals[gIdx].tasks[tIdx].type = e.target.value as any
                            setMapData({ ...mapData, stages: newStages })
                          }}
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                        >
                          <option value="learn">学习</option>
                          <option value="practice">实践</option>
                          <option value="test">测验</option>
                          <option value="reflect">复盘</option>
                        </select>
                        <Input
                          value={task.title}
                          onChange={(e) => {
                            const newStages = [...mapData.stages]
                            newStages[sIdx].goals[gIdx].tasks[tIdx].title = e.target.value
                            setMapData({ ...mapData, stages: newStages })
                          }}
                          placeholder="任务标题"
                          className="flex-1 text-sm"
                        />
                        <Input
                          type="number"
                          value={task.durationDays}
                          onChange={(e) => {
                            const newStages = [...mapData.stages]
                            newStages[sIdx].goals[gIdx].tasks[tIdx].durationDays = parseInt(e.target.value) || 0
                            setMapData({ ...mapData, stages: newStages })
                          }}
                          placeholder="天"
                          className="w-16 text-sm"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newStages = [...mapData.stages]
                            newStages[sIdx].goals[gIdx].tasks = newStages[sIdx].goals[gIdx].tasks.filter((_, i) => i !== tIdx)
                            setMapData({ ...mapData, stages: newStages })
                          }}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newStages = [...mapData.stages]
                        newStages[sIdx].goals[gIdx].tasks.push({
                          id: `task-${Date.now()}`,
                          title: '',
                          description: '',
                          type: 'learn',
                          durationDays: 1,
                        })
                        setMapData({ ...mapData, stages: newStages })
                      }}
                      className="w-full gap-2 text-xs"
                    >
                      <Plus className="h-3 w-3" />
                      添加任务
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newStages = [...mapData.stages]
                  newStages[sIdx].goals.push({
                    id: `goal-${Date.now()}`,
                    title: '',
                    description: '',
                    tasks: [],
                  })
                  setMapData({ ...mapData, stages: newStages })
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                添加目标
              </Button>
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          onClick={() => {
            setMapData({
              ...mapData,
              stages: [
                ...mapData.stages,
                {
                  id: `stage-${Date.now()}`,
                  title: '',
                  description: '',
                  durationWeeks: 4,
                  goals: [],
                },
              ],
            })
          }}
          className="w-full gap-2"
        >
          <Plus className="h-4 w-4" />
          添加阶段
        </Button>
      </div>
    </div>
  )
}
