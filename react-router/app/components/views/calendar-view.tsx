import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

interface CalendarViewProps<T> {
  items: T[];
  getDate: (item: T) => string | Date;
  renderItem: (item: T) => ReactNode;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView<T>({ items, getDate, renderItem }: CalendarViewProps<T>) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfWeek = getFirstDayOfWeek(currentYear, currentMonth);

  // Map items to dates
  const itemsByDate = new Map<string, T[]>();
  for (const item of items) {
    const raw = getDate(item);
    const d = raw instanceof Date ? raw : new Date(raw);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!itemsByDate.has(key)) {
      itemsByDate.set(key, []);
    }
    itemsByDate.get(key)!.push(item);
  }

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDate(null);
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDate(null);
  }

  // Items for selected date
  const selectedItems = selectedDate
    ? itemsByDate.get(`${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`) ?? []
    : [];

  // Build calendar grid cells
  const cells: Array<{ day: number | null; date: Date | null }> = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push({ day: null, date: null });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, date: new Date(currentYear, currentMonth, day) });
  }

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold">
          {MONTH_NAMES[currentMonth]} {currentYear}
        </h3>
        <Button variant="outline" size="sm" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {DAY_NAMES.map((day) => (
            <div
              key={day}
              className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((cell, idx) => {
            if (!cell.date) {
              return <div key={`empty-${idx}`} className="border-b border-r p-2 min-h-[4rem]" />;
            }

            const dateKey = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`;
            const dayItems = itemsByDate.get(dateKey) ?? [];
            const isToday = isSameDay(cell.date, today);
            const isSelected = selectedDate ? isSameDay(cell.date, selectedDate) : false;

            return (
              <button
                key={dateKey}
                onClick={() => setSelectedDate(cell.date)}
                className={`border-b border-r p-2 min-h-[4rem] text-left transition-colors hover:bg-muted/50 ${
                  isSelected ? "bg-primary/10 ring-1 ring-primary" : ""
                }`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isToday
                      ? "bg-primary text-primary-foreground font-bold"
                      : "text-foreground"
                  }`}
                >
                  {cell.day}
                </span>
                {dayItems.length > 0 && (
                  <Badge variant="secondary" className="mt-1 block w-fit text-[10px]">
                    {dayItems.length} item{dayItems.length !== 1 ? "s" : ""}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected date items */}
      {selectedDate && (
        <div className="rounded-lg border bg-card p-4">
          <h4 className="mb-3 text-sm font-semibold text-foreground">
            {selectedDate.toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            <span className="ml-2 text-muted-foreground font-normal">
              ({selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""})
            </span>
          </h4>
          {selectedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items on this date.</p>
          ) : (
            <div className="space-y-2">
              {selectedItems.map((item, index) => (
                <div key={index} className="rounded-md border p-3">
                  {renderItem(item)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
