# 📖 Projects Plus User Guide

Welcome to Projects Plus! This comprehensive guide will help you get the most out of your project management experience in Obsidian.

## 🚀 Getting Started

### First Steps

1. **Enable the Plugin**
   - Go to Settings → Community plugins
   - Enable "Projects Plus"
   - The plugin will appear in your ribbon bar

2. **Open Projects Plus**
   - Click the Projects Plus icon in the ribbon
   - Or use `Ctrl+P` → "Projects Plus: Show projects plus"

3. **Create Your First Project**
   - Click the "+" button
   - Choose your project type
   - Configure settings
   - Start organizing!

## 📱 Mobile Version (v2.2.0)

### Mobile Gestures

**Single tap on day cell:**
- Opens **DayPopup** — full-screen day overview
- Shows all notes for the selected day
- Allows managing notes

**Double tap on day cell:**
- Instantly creates a new note for that day
- Opens note creation dialog

### DayPopup — Day Overview

The popup window provides the following actions for each note:

| Action | Description |
|--------|-------------|
| ✅ **Checkbox** | Change note status |
| ⚙️ **Settings** | Open edit modal |
| 📋 **Duplicate** | Copy note to other dates |
| 🗑️ **Delete** | Delete note |

### Duplicating Notes

1. Tap the "Duplicate" button next to a note
2. A mini-calendar will open
3. Select one or more dates
4. Click "Duplicate"

The note will be copied to all selected dates.

### Hiding the Toolbar

- Click the collapse button in the toolbar
- The toolbar will fully hide
- A floating button will appear to restore it
- On mobile, a floating "Today" button appears

### Mobile-Specific Features

- **Larger day cells** — 100% taller for easier tapping
- **Disabled drag-n-drop** — prevents accidental dragging
- **Floating buttons** — semi-transparent, minimalist design

## 📊 View Types

### 📋 Table View
Perfect for data-heavy projects with lots of metadata.

**Features:**
- Sortable columns
- Filterable data
- Bulk operations
- Export capabilities

**Best for:**
- Research projects
- Content calendars
- Task management
- Data analysis

### 📌 Board View
Kanban-style interface for workflow management.

**Features:**
- Drag and drop cards
- Custom columns
- Card filtering
- Progress tracking

**Best for:**
- Agile development
- Content creation
- Task workflows
- Project phases

### 📅 Calendar View
Timeline-based project visualization.

**Features:**
- Monthly/weekly views
- Date-based filtering
- Timeline visualization
- Deadline tracking

**Best for:**
- Event planning
- Content scheduling
- Deadline management
- Time-based projects

### 🖼️ Gallery View
Visual card-based project browsing.

**Features:**
- Image previews
- Card layouts
- Visual filtering
- Quick navigation

**Best for:**
- Design projects
- Media libraries
- Visual content
- Portfolio management

## 🔧 Project Types

### 📁 Folder-based Projects

Create projects from existing folders in your vault.

**Setup:**
1. Right-click any folder in File Explorer
2. Select "Create project in folder"
3. Configure project settings
4. Start organizing!

**Configuration:**
- **Path**: Folder location
- **Recursive**: Include subfolders
- **Templates**: Default note template
- **Exclusions**: Files to ignore

### 🏷️ Tag-based Projects

Organize projects using Obsidian tags.

**Setup:**
1. Create a new project
2. Select "Tag" as data source
3. Enter your tag (e.g., `#project/my-project`)
4. Configure hierarchy settings

**Features:**
- Hierarchical tags support
- Automatic note detection
- Tag-based filtering
- Dynamic updates

### 🔍 Dataview Projects

Use Dataview queries for complex project filtering.

**Setup:**
1. Create a new project
2. Select "Dataview" as data source
3. Enter your query
4. Test and refine

**Example Queries:**
```dataview
FROM "Projects/MyProject"
WHERE status != "completed"
SORT file.ctime DESC
```

## ⚙️ Configuration

### General Settings

| Setting | Description | Recommendation |
|---------|-------------|----------------|
| **Project Size Limit** | Max notes to load | 1000 (default) |
| **Link Behavior** | Click behavior | "Open note" |
| **Start Week On** | Calendar start | "Monday" |

### Advanced Settings

#### Front Matter Configuration
- **Quote Strings**: When to use quotes in YAML
- **Date Format**: Custom date formatting
- **Boolean Values**: true/false vs yes/no

#### Template Management
- **Default Template**: Global template for new notes
- **Project Templates**: Per-project templates
- **Template Variables**: Dynamic content insertion

## 📝 Templates

### Basic Template Structure

```markdown
---
title: "{{title}}"
status: "draft"
created: {{date}}
project: "{{project}}
---

# {{title}}

## Overview
<!-- Add your project overview here -->

## Tasks
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

## Notes
<!-- Add your notes here -->

## Resources
<!-- Add links and resources here -->
```

### Advanced Template Features

#### Dynamic Variables
- `{{title}}` - Note title
- `{{date}}` - Current date
- `{{time}}` - Current time
- `{{project}}` - Project name
- `{{author}}` - Your name

#### Conditional Content
```markdown
{{#if status}}
Status: {{status}}
{{/if}}

{{#unless completed}}
This task is not completed yet.
{{/unless}}
```

## 🔄 Workflows

### Content Creation Workflow

1. **Planning Phase**
   - Create project in Calendar view
   - Set up content calendar
   - Define milestones

2. **Creation Phase**
   - Use Board view for content stages
   - Track progress with cards
   - Manage drafts and reviews

3. **Publishing Phase**
   - Move to Table view for final review
   - Check metadata and tags
   - Schedule publication

### Research Workflow

1. **Collection Phase**
   - Create folder-based project
   - Import research materials
   - Organize by topic

2. **Analysis Phase**
   - Use Table view for data analysis
   - Sort and filter information
   - Identify patterns

3. **Synthesis Phase**
   - Create summary notes
   - Link related concepts
   - Prepare final report

## 🎨 Customization

### View Customization

#### Table View
- **Column Configuration**: Show/hide columns
- **Sorting Options**: Primary and secondary sort
- **Filter Settings**: Advanced filtering options
- **Display Options**: Row height, font size

#### Board View
- **Column Setup**: Custom column names
- **Card Layout**: Information display
- **Color Coding**: Status-based colors
- **Drag Behavior**: Move restrictions

#### Calendar View
- **Date Range**: Month/week/day views
- **Event Display**: Show/hide details
- **Color Coding**: Category colors
- **Navigation**: Quick date jumping

### Theme Integration

Projects Plus automatically adapts to your Obsidian theme:
- **Light Themes**: Clean, minimal interface
- **Dark Themes**: High contrast, easy reading
- **Custom Themes**: Automatic color adaptation

## 🔧 Troubleshooting

### Common Issues

#### Performance Problems
- **Large Projects**: Reduce project size limit
- **Memory Issues**: Restart Obsidian
- **Slow Loading**: Check for corrupted files

#### Data Issues
- **Missing Notes**: Check folder permissions
- **Broken Links**: Verify file paths
- **Template Errors**: Check template syntax

#### Plugin Conflicts
- **Other Plugins**: Disable conflicting plugins
- **Settings Reset**: Reset to defaults
- **Reinstall**: Clean reinstall if needed

### Getting Help

1. **Check Documentation**: Review this guide
2. **Search Issues**: Look for similar problems
3. **Create Issue**: Report bugs with details
4. **Community**: Ask in discussions

## 📚 Advanced Features

### API Integration

Projects Plus provides a rich API for developers:

```javascript
// Get all projects
const projects = app.plugins.plugins['obs-projects-plus'].api.getProjects();

// Create new project
app.plugins.plugins['obs-projects-plus'].api.createProject({
  name: "My Project",
  dataSource: { kind: "folder", config: { path: "/MyProject" } }
});
```

### Custom Views

Create custom views for specialized needs:

```javascript
// Register custom view
app.plugins.plugins['obs-projects-plus'].api.registerView({
  id: "my-custom-view",
  name: "My Custom View",
  component: MyCustomComponent
});
```

### Automation

Use Templater or other plugins for automation:

```javascript
// Templater script for project creation
const project = await tp.user.createProject({
  name: tp.file.title,
  template: "Project Template"
});
```

## 🎯 Best Practices

### Project Organization

1. **Consistent Naming**: Use clear, descriptive names
2. **Logical Structure**: Organize by purpose, not type
3. **Regular Cleanup**: Archive completed projects
4. **Documentation**: Keep project notes updated

### Performance Optimization

1. **Reasonable Limits**: Don't load too many notes
2. **Efficient Queries**: Optimize Dataview queries
3. **Regular Maintenance**: Clean up unused files
4. **Backup Strategy**: Regular vault backups

### Collaboration

1. **Shared Projects**: Use consistent metadata
2. **Template Standards**: Agree on templates
3. **Naming Conventions**: Follow team standards
4. **Documentation**: Keep processes documented

---

## 📞 Support

Need help? We're here for you!

- **📧 GitHub Issues**: [Report bugs](https://github.com/ParkPavel/obs-projects-plus/issues)
- **💬 Discussions**: [Ask questions](https://github.com/ParkPavel/obs-projects-plus/discussions)
- **🌐 Website**: [parkpavel.github.io](https://parkpavel.github.io/park-pavel/)
- **📧 Email**: Contact through GitHub

---

*Happy project managing! 🚀*