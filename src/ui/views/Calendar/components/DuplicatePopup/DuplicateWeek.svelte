<script lang="ts">
  import dayjs from "dayjs";
  import type { ProcessedCalendarData } from "../../types";
  import DuplicateDay from "./DuplicateDay.svelte";
  import Week from "../Calendar/Week.svelte";
  
  export let week: { date: dayjs.Dayjs; isOutsideMonth: boolean }[];
  export let processedData: ProcessedCalendarData | null;
  export let displayMode: 'list' | 'bars';
  export let startHour: number;
  export let endHour: number;
  export let isDaySelected: (date: dayjs.Dayjs) => boolean;
  export let handleDayClick: (date: dayjs.Dayjs) => void;
  
  // Увеличена высота для mobile для лучшей видимости событий
  const weekHeightRem = typeof window !== 'undefined' && window.innerWidth < 768 ? 12 : 8;
</script>

<Week heightRem={weekHeightRem} useFixedHeight={true}>
  {#each week as cell}
    <DuplicateDay 
      date={cell.date}
      isOutsideMonth={cell.isOutsideMonth}
      processedRecords={!cell.isOutsideMonth ? (processedData?.grouped[cell.date.format("YYYY-MM-DD")] || []) : []}
      {displayMode}
      startHourConfig={startHour}
      endHourConfig={endHour}
      isSelected={isDaySelected(cell.date)}
      onClick={() => handleDayClick(cell.date)}
    />
  {/each}
</Week>
