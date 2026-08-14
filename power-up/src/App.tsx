import { createContext, useContext, useState } from 'react'
import type { Folder } from './db/db'
import Today from './screens/Today'
import History from './screens/History'
import Progress from './screens/Progress'
import Settings from './screens/Settings'
import Editor from './screens/Editor'
import Library from './screens/Library'
import SessionDetail from './screens/SessionDetail'
import RestTimer from './screens/RestTimer'

export type Route =
  | { name: 'today' }
  | { name: 'history' }
  | { name: 'progress' }
  | { name: 'settings' }
  | { name: 'editor'; templateId: string }
  | {
      name: 'library'
      templateId: string
      mode: 'add' | 'swap'
      swapTeId?: string
      scopeFolder?: Folder
    }
  | { name: 'sessionDetail'; sessionId: string }

interface Nav {
  route: Route
  push: (r: Route) => void
  back: () => void
}

const NavContext = createContext<Nav>(null!)
export const useNav = () => useContext(NavContext)

const TABS: { route: Route; label: string; icon: (active: boolean) => JSX.Element }[] = [
  { route: { name: 'today' }, label: 'Today', icon: (a) => <TabIcon d="M12 3l8 7v10a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1V10z" active={a} /> },
  { route: { name: 'history' }, label: 'History', icon: (a) => <TabIcon d="M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" active={a} stroke /> },
  { route: { name: 'progress' }, label: 'Progress', icon: (a) => <TabIcon d="M4 19L10 12l4 3 6-8" active={a} stroke /> },
  { route: { name: 'settings' }, label: 'Settings', icon: (a) => <TabIcon d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm8.5 3a8 8 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a8 8 0 0 0-2-1.2L15.6 3h-4l-.4 2.6a8 8 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5a8 8 0 0 0 0 2.4l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 2 1.2l.4 2.6h4l.4-2.6a8 8 0 0 0 2-1.2l2.4 1 2-3.5-2-1.5c.06-.4.1-.8.1-1.2z" active={a} /> },
]

function TabIcon({ d, active, stroke = false }: { d: string; active: boolean; stroke?: boolean }) {
  const color = active ? '#141412' : '#A6A69E'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={stroke ? 'none' : color} stroke={stroke ? color : 'none'} strokeWidth={stroke ? 1.8 : 0} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

export default function App() {
  const [stack, setStack] = useState<Route[]>([{ name: 'today' }])
  const route = stack[stack.length - 1]
  const push = (r: Route) => setStack((s) => [...s, r])
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
  const setTab = (r: Route) => setStack([r])

  const isTab = ['today', 'history', 'progress', 'settings'].includes(route.name)

  return (
    <NavContext.Provider value={{ route, push, back }}>
      <div className="max-w-lg mx-auto min-h-dvh flex flex-col">
        <main className={`flex-1 ${isTab ? 'pb-24' : 'pb-8'}`}>
          {route.name === 'today' && <Today />}
          {route.name === 'history' && <History />}
          {route.name === 'progress' && <Progress />}
          {route.name === 'settings' && <Settings />}
          {route.name === 'editor' && <Editor templateId={route.templateId} />}
          {route.name === 'library' && (
            <Library
              templateId={route.templateId}
              mode={route.mode}
              swapTeId={route.swapTeId}
              scopeFolder={route.scopeFolder}
            />
          )}
          {route.name === 'sessionDetail' && <SessionDetail sessionId={route.sessionId} />}
        </main>

        {isTab && (
          <nav className="fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-hairline">
            <div className="max-w-lg mx-auto flex pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              {TABS.map((t) => {
                const active = route.name === t.route.name
                return (
                  <button
                    key={t.label}
                    onClick={() => setTab(t.route)}
                    className="flex-1 flex flex-col items-center gap-1 pt-2.5 pb-1"
                  >
                    {t.icon(active)}
                    <span className={`text-[10px] font-medium ${active ? 'text-ink' : 'text-faint'}`}>
                      {t.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </nav>
        )}

        <RestTimer />
      </div>
    </NavContext.Provider>
  )
}
