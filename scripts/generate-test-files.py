#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════════════════
  Projects Plus Demo Data Generator v2.0.0
  
  Generates comprehensive demo data for testing ALL features of Projects Plus:
  - Calendar View: events, multi-day spans, all-day, timed, recurring
  - Board View: tasks with statuses, priorities, progress
  - Table View: records with various field types
  - Agenda: overdue, today, upcoming, undated items
  
  Usage:
    python generate-test-files.py <output_folder> -n <count> [options]
    
  Examples:
    python generate-test-files.py ./demo -n 50 --type all
    python generate-test-files.py ./demo -n 20 --type calendar --with-overdue
    python generate-test-files.py ./demo -n 30 --type board --realistic
═══════════════════════════════════════════════════════════════════════════════
"""

import random
import string
import argparse
import os
import yaml
import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

COLORS = {
    "red": "#ff6b9d",
    "blue": "#4a9eff",
    "yellow": "#ffd93d",
    "green": "#6bcf7f",
    "orange": "#ff8c42",
    "purple": "#b892ff",
    "gray": "#94a3b8",
    "teal": "#2dd4bf",
    "pink": "#f472b6",
    "indigo": "#818cf8",
}

TASK_STATUSES = ["inbox", "todo", "in-progress", "done", "cancelled"]
EVENT_STATUSES = ["scheduled", "completed", "cancelled"]
PROJECT_STATUSES = ["active", "paused", "completed", "cancelled"]
PRIORITIES = ["high", "medium", "low"]

# Realistic names for demo
TASK_TITLES = [
    "Написать документацию",
    "Код-ревью PR #42",
    "Обновить зависимости",
    "Исправить баг с авторизацией",
    "Настроить CI/CD",
    "Провести рефакторинг модуля",
    "Подготовить презентацию",
    "Отправить отчет",
    "Созвон с командой",
    "Тестирование релиза",
    "Оптимизировать запросы к БД",
    "Добавить темную тему",
    "Интеграция с API",
    "Миграция базы данных",
    "Написать unit тесты",
    "Обновить README",
    "Фикс верстки мобильной версии",
    "Анализ производительности",
    "Настройка мониторинга",
    "Бэкап данных",
]

EVENT_TITLES = [
    "Стендап",
    "Планирование спринта",
    "Ретроспектива",
    "Демо продукта",
    "1-on-1 с руководителем",
    "Собеседование кандидата",
    "Вебинар по новым технологиям",
    "Конференция разработчиков",
    "Корпоратив",
    "День рождения коллеги",
    "Созвон с заказчиком",
    "Обучение новичков",
    "Хакатон",
    "Code Review сессия",
    "Архитектурный комитет",
]

PROJECT_TITLES = [
    "Редизайн главной страницы",
    "Мобильное приложение v2",
    "API Gateway",
    "Микросервисы миграция",
    "Performance Sprint",
    "Автоматизация тестирования",
    "Документация проекта",
    "Онбординг система",
    "Analytics Dashboard",
    "Безопасность и аудит",
]

MEETING_LOCATIONS = [
    "Zoom",
    "Google Meet",
    "Переговорная 'Альфа'",
    "Переговорная 'Бета'",
    "Slack Huddle",
    "Teams",
    "Офис, 3 этаж",
    "Кофейня рядом",
]

ATTENDEES = [
    "Анна", "Борис", "Виктор", "Галина", "Дмитрий",
    "Елена", "Жанна", "Захар", "Ирина", "Константин",
    "Лариса", "Михаил", "Наталья", "Олег", "Полина",
]

TAGS_POOL = {
    "task": ["task", "todo", "work", "dev"],
    "event": ["event", "calendar", "meeting"],
    "project": ["project", "epic", "milestone"],
    "meeting": ["meeting", "sync", "call"],
    "personal": ["personal", "life", "home"],
}

# ═══════════════════════════════════════════════════════════════════════════════
# ARGUMENT PARSING
# ═══════════════════════════════════════════════════════════════════════════════

parser = argparse.ArgumentParser(
    prog="generate-test-files",
    description="Generates comprehensive demo data for Projects Plus testing.",
    formatter_class=argparse.RawDescriptionHelpFormatter,
    epilog="""
Examples:
  python generate-test-files.py ./demo -n 50 --type all
  python generate-test-files.py ./demo -n 20 --type calendar --with-overdue
  python generate-test-files.py ./demo -n 30 --type board --realistic
  python generate-test-files.py ./demo -n 100 --type mixed --date-range 90

Types:
  all       - Generate all types of records
  calendar  - Events with dates, times, multi-day spans
  board     - Tasks with statuses, priorities
  table     - Mixed records for table view
  mixed     - Random mix of all types
    """
)

parser.add_argument("output", help="Output folder for generated Markdown files.")
parser.add_argument(
    "-n", "--numfiles",
    type=int,
    required=True,
    help="Number of files to generate.",
)
parser.add_argument(
    "-t", "--type",
    choices=["all", "calendar", "board", "table", "mixed"],
    default="all",
    help="Type of records to generate (default: all)",
)
parser.add_argument(
    "--with-overdue",
    action="store_true",
    help="Include overdue items (past due dates)",
)
parser.add_argument(
    "--with-undated",
    action="store_true",
    help="Include items without dates",
)
parser.add_argument(
    "--realistic",
    action="store_true",
    help="Use realistic titles and data",
)
parser.add_argument(
    "--date-range",
    type=int,
    default=60,
    help="Date range in days from today (default: 60)",
)
parser.add_argument(
    "--clear",
    action="store_true",
    help="Clear output folder before generating",
)
parser.add_argument(
    "--seed",
    type=int,
    help="Random seed for reproducible generation",
)
parser.add_argument(
    "-v", "--verbose",
    action="store_true",
    help="Verbose output",
)

args = parser.parse_args()

if args.seed:
    random.seed(args.seed)

# ═══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def random_text(length: int = 10) -> str:
    """Generate random alphanumeric string."""
    letters = string.ascii_letters + string.digits
    return "".join(random.choice(letters) for _ in range(length))


def random_id() -> str:
    """Generate unique file-safe ID."""
    return f"{random_text(6)}_{int(datetime.datetime.now().timestamp())}"


def random_bool(probability: float = 0.5) -> bool:
    """Random boolean with custom probability."""
    return random.random() < probability


def random_date(days_back: int = 30, days_forward: int = 60) -> datetime.date:
    """Generate random date within range from today."""
    today = datetime.date.today()
    start_date = today - datetime.timedelta(days=days_back)
    end_date = today + datetime.timedelta(days=days_forward)
    delta = (end_date - start_date).days
    return start_date + datetime.timedelta(days=random.randrange(delta))


def random_time(start_hour: int = 8, end_hour: int = 20) -> str:
    """Generate random time string HH:mm."""
    hour = random.randint(start_hour, end_hour)
    minute = random.choice([0, 15, 30, 45])
    return f"{hour:02d}:{minute:02d}"


def random_duration_hours() -> int:
    """Generate random duration in hours."""
    return random.choice([1, 1, 1, 2, 2, 3, 4, 8])


def add_hours_to_time(time_str: str, hours: int) -> str:
    """Add hours to time string."""
    hour, minute = map(int, time_str.split(':'))
    new_hour = min(hour + hours, 23)
    return f"{new_hour:02d}:{minute:02d}"


def random_color() -> str:
    """Random color from palette."""
    return random.choice(list(COLORS.values()))


def random_priority() -> str:
    """Random priority with weighted distribution."""
    return random.choices(
        PRIORITIES,
        weights=[0.2, 0.5, 0.3],  # high is less common
        k=1
    )[0]


def random_progress() -> int:
    """Random progress percentage."""
    return random.choice([0, 10, 25, 33, 50, 66, 75, 80, 90, 100])


def random_attendees(min_count: int = 1, max_count: int = 5) -> List[str]:
    """Random list of attendees."""
    count = random.randint(min_count, max_count)
    return random.sample(ATTENDEES, count)


def random_tags(category: str) -> List[str]:
    """Random tags for category."""
    base_tags = TAGS_POOL.get(category, ["misc"])
    extra_tags = random.sample(["urgent", "important", "low-priority", "blocked", "review"], k=random.randint(0, 2))
    return base_tags[:2] + extra_tags


def get_title(category: str, realistic: bool = False) -> str:
    """Get title based on category and realistic flag."""
    if not realistic:
        return random_text(15)
    
    titles = {
        "task": TASK_TITLES,
        "event": EVENT_TITLES,
        "project": PROJECT_TITLES,
        "meeting": EVENT_TITLES,
    }
    return random.choice(titles.get(category, TASK_TITLES))


# ═══════════════════════════════════════════════════════════════════════════════
# RECORD GENERATORS
# ═══════════════════════════════════════════════════════════════════════════════

def generate_task(realistic: bool = False, with_overdue: bool = False) -> Dict[str, Any]:
    """Generate a task record for Board/Table view."""
    today = datetime.date.today()
    
    # Determine if this task is overdue
    if with_overdue and random_bool(0.2):
        start_date = random_date(days_back=30, days_forward=0)
        due_date = random_date(days_back=15, days_forward=0)
        status = random.choice(["todo", "in-progress"])  # Not done yet = overdue
    else:
        start_date = random_date(days_back=7, days_forward=30)
        due_delta = random.randint(1, 14)
        due_date = start_date + datetime.timedelta(days=due_delta)
        status = random.choice(TASK_STATUSES)
    
    priority = random_priority()
    color = {
        "high": COLORS["red"],
        "medium": COLORS["yellow"],
        "low": COLORS["green"],
    }.get(priority, COLORS["gray"])
    
    return {
        "title": get_title("task", realistic),
        "date": today.isoformat(),
        "startDate": start_date.isoformat(),
        "dueDate": due_date.isoformat(),
        "priority": priority,
        "status": status,
        "color": color,
        "progress": random_progress() if status in ["in-progress", "done"] else 0,
        "tags": random_tags("task"),
        "_type": "task",
    }


def generate_calendar_event(
    realistic: bool = False,
    force_multiday: bool = False,
    force_allday: bool = False,
    force_timed: bool = False,
) -> Dict[str, Any]:
    """Generate a calendar event with various configurations."""
    start_date = random_date(days_back=7, days_forward=args.date_range)
    
    # Determine event type
    is_multiday = force_multiday or (not force_timed and random_bool(0.2))
    is_allday = force_allday or (not force_timed and not is_multiday and random_bool(0.3))
    
    frontmatter: Dict[str, Any] = {
        "title": get_title("event", realistic),
        "date": datetime.date.today().isoformat(),
        "startDate": start_date.isoformat(),
        "status": random.choice(EVENT_STATUSES),
        "color": random_color(),
        "tags": random_tags("event"),
        "_type": "event",
    }
    
    if is_multiday:
        # Multi-day event: 2-7 days
        duration_days = random.randint(2, 7)
        end_date = start_date + datetime.timedelta(days=duration_days)
        frontmatter["endDate"] = end_date.isoformat()
        frontmatter["_subtype"] = "multi-day"
    elif not is_allday:
        # Timed event
        start_time = random_time(8, 18)
        duration = random_duration_hours()
        end_time = add_hours_to_time(start_time, duration)
        frontmatter["startTime"] = start_time
        frontmatter["endTime"] = end_time
        frontmatter["_subtype"] = "timed"
    else:
        # All-day event
        frontmatter["_subtype"] = "all-day"
    
    return frontmatter


def generate_meeting(realistic: bool = False) -> Dict[str, Any]:
    """Generate a meeting record."""
    meeting_date = random_date(days_back=3, days_forward=30)
    start_time = random_time(9, 17)
    duration = random.choice([1, 1, 2])
    end_time = add_hours_to_time(start_time, duration)
    
    return {
        "title": get_title("meeting", realistic),
        "date": datetime.date.today().isoformat(),
        "startDate": meeting_date.isoformat(),
        "startTime": start_time,
        "endTime": end_time,
        "location": random.choice(MEETING_LOCATIONS) if realistic else f"Room {random.randint(1, 10)}",
        "attendees": random_attendees() if realistic else [],
        "status": random.choice(["scheduled", "completed"]),
        "color": COLORS["blue"],
        "tags": random_tags("meeting"),
        "_type": "meeting",
    }


def generate_project(realistic: bool = False) -> Dict[str, Any]:
    """Generate a project record."""
    start_date = random_date(days_back=60, days_forward=30)
    duration_days = random.randint(14, 90)
    end_date = start_date + datetime.timedelta(days=duration_days)
    status = random.choice(PROJECT_STATUSES)
    progress = 100 if status == "completed" else random_progress()
    
    return {
        "title": get_title("project", realistic),
        "date": datetime.date.today().isoformat(),
        "startDate": start_date.isoformat(),
        "endDate": end_date.isoformat(),
        "status": status,
        "progress": progress,
        "color": COLORS["purple"],
        "tags": random_tags("project"),
        "_type": "project",
    }


def generate_undated_task(realistic: bool = False) -> Dict[str, Any]:
    """Generate a task without dates (for inbox/backlog)."""
    return {
        "title": get_title("task", realistic),
        "date": datetime.date.today().isoformat(),
        "priority": random_priority(),
        "status": "inbox",
        "color": COLORS["gray"],
        "tags": random_tags("task") + ["undated"],
        "_type": "task",
        "_subtype": "undated",
    }


# ═══════════════════════════════════════════════════════════════════════════════
# FILE GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

def generate_content(record: Dict[str, Any]) -> str:
    """Generate markdown content based on record type."""
    record_type = record.get("_type", "task")
    title = record.get("title", "Untitled")
    
    # Build frontmatter (exclude internal fields)
    frontmatter = {k: v for k, v in record.items() if not k.startswith("_")}
    
    content = "---\n"
    content += yaml.dump(frontmatter, allow_unicode=True, default_flow_style=False)
    content += "---\n\n"
    
    # Content by type
    if record_type == "task":
        content += f"# {title}\n\n"
        content += "## Описание\n\n"
        content += "<!-- Описание задачи -->\n\n"
        content += "## Чеклист\n"
        content += "- [ ] Подготовка\n"
        content += "- [ ] Выполнение\n"
        content += "- [ ] Проверка\n"
    
    elif record_type == "event":
        content += f"# 📅 {title}\n\n"
        content += "## Детали\n\n"
        if record.get("_subtype") == "multi-day":
            content += f"**Период**: {record.get('startDate')} — {record.get('endDate')}\n\n"
        elif record.get("startTime"):
            content += f"**Время**: {record.get('startTime')} — {record.get('endTime')}\n\n"
        content += "## Заметки\n\n"
    
    elif record_type == "meeting":
        content += f"# 📅 {title}\n\n"
        content += "## Участники\n"
        for att in record.get("attendees", []):
            content += f"- {att}\n"
        content += "\n## Повестка\n1. \n\n"
        content += "## Заметки\n\n"
        content += "## Действия\n- [ ] \n"
    
    elif record_type == "project":
        content += f"# 🎯 {title}\n\n"
        content += "## Описание\n\n"
        content += "## Цели\n- \n\n"
        content += "## Этапы\n"
        content += "- [ ] Этап 1\n"
        content += "- [ ] Этап 2\n"
        content += "- [ ] Этап 3\n"
    
    return content


def get_filename(record: Dict[str, Any]) -> str:
    """Generate safe filename from record."""
    title = record.get("title", "untitled")
    # Sanitize filename
    safe_title = "".join(c for c in title if c.isalnum() or c in " -_").strip()
    safe_title = safe_title[:40]  # Limit length
    unique_id = random_text(4)
    return f"{safe_title}_{unique_id}.md"


def generate_records(count: int, record_type: str) -> List[Dict[str, Any]]:
    """Generate records based on type."""
    records = []
    realistic = args.realistic
    
    if record_type == "all":
        # Balanced distribution
        generators = [
            (generate_task, 0.35),
            (generate_calendar_event, 0.25),
            (generate_meeting, 0.15),
            (generate_project, 0.10),
        ]
        
        if args.with_undated:
            generators.append((generate_undated_task, 0.15))
        
        # Add overdue tasks
        for _ in range(count):
            gen_func, _ = random.choices(
                generators,
                weights=[w for _, w in generators],
                k=1
            )[0]
            
            if gen_func == generate_task:
                records.append(gen_func(realistic, args.with_overdue))
            else:
                records.append(gen_func(realistic))
    
    elif record_type == "calendar":
        for _ in range(count):
            event_type = random.choices(
                ["timed", "allday", "multiday"],
                weights=[0.5, 0.3, 0.2],
                k=1
            )[0]
            records.append(generate_calendar_event(
                realistic,
                force_multiday=(event_type == "multiday"),
                force_allday=(event_type == "allday"),
                force_timed=(event_type == "timed"),
            ))
    
    elif record_type == "board":
        for _ in range(count):
            records.append(generate_task(realistic, args.with_overdue))
    
    elif record_type == "table":
        # Mix for table view
        for _ in range(count):
            gen_func = random.choice([
                generate_task,
                generate_calendar_event,
                generate_project,
            ])
            if gen_func == generate_task:
                records.append(gen_func(realistic, args.with_overdue))
            else:
                records.append(gen_func(realistic))
    
    elif record_type == "mixed":
        for _ in range(count):
            gen_func = random.choice([
                generate_task,
                generate_calendar_event,
                generate_meeting,
                generate_project,
                generate_undated_task,
            ])
            if gen_func == generate_task:
                records.append(gen_func(realistic, args.with_overdue))
            else:
                records.append(gen_func(realistic))
    
    return records


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN EXECUTION
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    """Main entry point."""
    output_path = Path(args.output)
    
    # Create output directory
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Clear if requested
    if args.clear:
        for file in output_path.glob("*.md"):
            file.unlink()
        if args.verbose:
            print(f"🗑️  Cleared {output_path}")
    
    # Generate records
    records = generate_records(args.numfiles, args.type)
    
    # Statistics
    stats = {
        "task": 0,
        "event": 0,
        "meeting": 0,
        "project": 0,
    }
    
    # Write files
    for record in records:
        filename = get_filename(record)
        filepath = output_path / filename
        content = generate_content(record)
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        
        record_type = record.get("_type", "task")
        stats[record_type] = stats.get(record_type, 0) + 1
        
        if args.verbose:
            print(f"✅ {filename}")
    
    # Summary
    print(f"\n{'═' * 50}")
    print(f"✨ Generated {len(records)} files in {output_path}")
    print(f"{'═' * 50}")
    print(f"📋 Tasks:    {stats.get('task', 0)}")
    print(f"📅 Events:   {stats.get('event', 0)}")
    print(f"🤝 Meetings: {stats.get('meeting', 0)}")
    print(f"🎯 Projects: {stats.get('project', 0)}")
    print(f"{'═' * 50}")


if __name__ == "__main__":
    main()
