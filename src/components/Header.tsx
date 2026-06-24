import { Navbar, NavbarBrand, Tabs, Tab } from '@heroui/react';
import { Trophy } from 'lucide-react';

interface HeaderProps {
  mode: 'events' | 'channels';
  setMode: (m: 'events' | 'channels') => void;
  category: string;
  setCategory: (c: string) => void;
  categories: string[];
}

export default function Header({ mode, setMode, category, setCategory, categories }: HeaderProps) {
  return (
    <Navbar isBordered className="bg-neutral-900 border-neutral-800 text-white py-2" maxWidth="full">
      <NavbarBrand className="flex items-center gap-2">
        <Trophy className="text-yellow-500 w-6 h-6" />
        <span className="font-extrabold text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
          StreamCup
        </span>
      </NavbarBrand>

      <div className="flex flex-col md:flex-row items-center gap-4">
        {/* 大类目切换 */}
        <Tabs
          selectedKey={mode}
          onSelectionChange={(key) => {
            setMode(key as 'events' | 'channels');
            setCategory('all');
          }}
          variant="solid"
          color="warning"
          classNames={{
            tabList: 'bg-neutral-800 border border-neutral-700',
            cursor: 'bg-gradient-to-r from-yellow-500 to-amber-600',
            tabContent: 'group-data-[selected=true]:text-neutral-950 font-bold',
          }}
        >
          <Tab key="events" title="⚽ 体育赛事直播" />
          <Tab key="channels" title="📺 24/7 电视直播" />
        </Tabs>

        {/* 细分类目切换 */}
        <Tabs
          selectedKey={category}
          onSelectionChange={(key) => setCategory(key as string)}
          variant="light"
          color="warning"
          classNames={{
            tabList: 'max-w-[300px] overflow-x-auto bg-transparent',
            tabContent: 'text-neutral-400 font-semibold',
          }}
        >
          <Tab key="all" title="全部" />
          {categories.map((cat) => (
            <Tab key={cat} title={cat} />
          ))}
        </Tabs>
      </div>
    </Navbar>
  );
}
