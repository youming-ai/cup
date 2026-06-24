import { Input, Card, CardBody, Chip } from '@heroui/react';
import { Search, Users, Tv } from 'lucide-react';
import { Match, Channel } from '../types';

type StreamItem = Match | Channel;

interface SidebarProps {
  items: StreamItem[];
  selectedItem: StreamItem | null;
  onSelectItem: (item: StreamItem) => void;
  mode: 'events' | 'channels';
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export default function Sidebar({
  items,
  selectedItem,
  onSelectItem,
  mode,
  searchQuery,
  setSearchQuery,
}: SidebarProps) {
  return (
    <div className="flex flex-col h-full bg-neutral-900 border-r border-neutral-800 p-4">
      {/* 搜索框 */}
      <Input
        isClearable
        placeholder={mode === 'events' ? '搜索赛事（如 Colombia）...' : '搜索频道...'}
        startContent={<Search className="text-neutral-400 w-4 h-4" />}
        value={searchQuery}
        onValueChange={setSearchQuery}
        variant="bordered"
        className="mb-4 text-white"
        classNames={{
          inputWrapper:
            'border-neutral-700 bg-neutral-800 hover:border-neutral-600 focus-within:!border-yellow-500',
          input: 'text-neutral-200',
        }}
      />

      {/* 滚动卡片列表 */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {items.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">没有找到相关内容</div>
        ) : (
          items.map((item) => {
            const isSelected =
              !!selectedItem &&
              (mode === 'events'
                ? (item as Match).id === (selectedItem as Match).id
                : (item as Channel).channel === (selectedItem as Channel).channel);

            return (
              <Card
                key={mode === 'events' ? (item as Match).id : (item as Channel).channel}
                isPressable
                onPress={() => onSelectItem(item)}
                className={`w-full bg-neutral-800 border transition-all hover:bg-neutral-750 ${
                  isSelected
                    ? 'border-yellow-500 bg-neutral-800 shadow-md shadow-yellow-500/10'
                    : 'border-neutral-750'
                }`}
              >
                <CardBody className="p-3 flex flex-row items-center gap-3">
                  {mode === 'channels' ? (
                    // 电视 LOGO 或者占位符
                    <div className="w-10 h-10 rounded bg-neutral-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {(item as Channel).logo ? (
                        <img
                          src={(item as Channel).logo}
                          alt={(item as Channel).title}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Tv className="w-5 h-5 text-neutral-400" />
                      )}
                    </div>
                  ) : (
                    // 赛事占位徽章
                    <div className="w-10 h-10 rounded bg-yellow-600/20 text-yellow-500 flex items-center justify-center font-extrabold flex-shrink-0 text-lg">
                      ⚽
                    </div>
                  )}

                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-bold text-sm text-neutral-200 truncate">
                      {mode === 'events' ? (item as Match).name : (item as Channel).title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Chip
                        size="sm"
                        variant="flat"
                        color={mode === 'events' ? 'warning' : 'default'}
                        className="h-5 text-[10px]"
                      >
                        {mode === 'events'
                          ? (item as Match).category_name
                          : (item as Channel).category}
                      </Chip>
                      {mode === 'events' && (
                        <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {(item as Match).viewers}
                        </span>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
