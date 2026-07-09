// --- Global Application Orchestration Sync State ---
let projects = JSON.parse(localStorage.getItem('kanban-projects')) || [{ id: 'default', name: 'Main Project' }];
let currentProjectId = localStorage.getItem('kanban-current-project') || 'default';
let tasks = JSON.parse(localStorage.getItem('kanban-tasks')) || [];
let customTodos = JSON.parse(localStorage.getItem('global-custom-todos')) || [];
let importKanbanToggle = JSON.parse(localStorage.getItem('import-kanban-toggle')) || false;
// Track where the Kanban group sits relative to the custom list elements (0 means top, larger numbers push it down)
let kanbanGroupPlacementIndex = parseInt(localStorage.getItem('kanban-group-placement-idx')) || 0;

// Shared DOM Elements
const projectSelect = document.getElementById('project-select');

// View Layout Identifier flags
const isKanbanPage = document.querySelector('.kanban-container') !== null;
const isTodoPage = document.getElementById('master-todo-list') !== null;

document.addEventListener('DOMContentLoaded', () => {
    if (projectSelect) renderProjectsDropdown();
    
    if (isKanbanPage) {
        initKanbanPage();
    } else if (isTodoPage) {
        initTodoPage();
    }

    // --- Global Application Reset Hook (Nuke Option) ---
    const nukeBtn = document.getElementById('nuke-all-data-btn');
    if (nukeBtn) {
        nukeBtn.addEventListener('click', () => {
            const firstWarning = confirm("WARNING: This will permanently delete ALL projects, ALL Kanban tasks, and ALL custom checklist items. Are you absolutely sure?");
            if (firstWarning) {
                const secondWarning = confirm("Are you completely sure? This action cannot be reversed and wipes the entire application data clean.");
                if (secondWarning) {
                    localStorage.clear(); 
                    window.location.reload(); 
                }
            }
        });
    }
});

// --- Unified Dropdown Manager ---
function renderProjectsDropdown() {
    if (!projectSelect) return;
    projectSelect.innerHTML = '';
    projects.forEach(proj => {
        const option = document.createElement('option');
        option.value = proj.id;
        option.textContent = proj.name;
        if (proj.id === currentProjectId) option.selected = true;
        projectSelect.appendChild(option);
    });
}

if (projectSelect) {
    projectSelect.addEventListener('change', (e) => {
        currentProjectId = e.target.value;
        localStorage.setItem('kanban-current-project', currentProjectId);
        if (isKanbanPage) renderTasks();
        if (isTodoPage) renderCombinedTodoList();
    });
}

function saveToLocalStorage() {
    localStorage.setItem('kanban-tasks', JSON.stringify(tasks));
}

// --- KANBAN BOARD SYSTEM LOGIC ---
function initKanbanPage() {
    const modal = document.getElementById('task-modal');
    const taskForm = document.getElementById('task-form');
    const cancelBtn = document.getElementById('cancel-btn');
    const addBtns = document.querySelectorAll('.add-task-btn');
    const clearBoardBtn = document.getElementById('clear-board-btn');
    const addProjectBtn = document.getElementById('add-project-btn');
    const deleteProjectBtn = document.getElementById('delete-project-btn');
    const modalDeleteBtn = document.getElementById('modal-delete-task-btn');
    const modalHeadline = document.getElementById('modal-headline');

    renderTasks();
    setupDragAndDrop();

    addBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.getElementById('task-column-status').value = e.target.parentElement.dataset.status;
            document.getElementById('task-id').value = '';
            if (modalHeadline) modalHeadline.textContent = "Create New Task";
            if (modalDeleteBtn) modalDeleteBtn.classList.add('hide');
            taskForm.reset();
            modal.classList.add('active');
        });
    });

    cancelBtn.addEventListener('click', () => modal.classList.remove('active'));

    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('task-id').value || Date.now().toString();
        const title = document.getElementById('task-title').value;
        const desc = document.getElementById('task-desc').value;
        const comment = document.getElementById('task-comment').value;
        const status = document.getElementById('task-column-status').value;

        const idx = tasks.findIndex(t => t.id === id);
        if (idx > -1) tasks[idx] = { id, projectId: currentProjectId, title, desc, comment, status };
        else tasks.push({ id, projectId: currentProjectId, title, desc, comment, status });

        saveToLocalStorage();
        renderTasks();
        modal.classList.remove('active');
    });

    if (modalDeleteBtn) {
        modalDeleteBtn.addEventListener('click', () => {
            const id = document.getElementById('task-id').value;
            if (id && confirm("Are you sure you want to delete this task?")) {
                deleteTask(id);
                modal.classList.remove('active');
            }
        });
    }

    addProjectBtn.addEventListener('click', () => {
        const name = prompt("Enter new project name:");
        if (!name || !name.trim()) return;
        const id = 'project-' + Date.now();
        projects.push({ id, name: name.trim() });
        localStorage.setItem('kanban-projects', JSON.stringify(projects));
        currentProjectId = id;
        localStorage.setItem('kanban-current-project', currentProjectId);
        renderProjectsDropdown();
        renderTasks();
    });

    deleteProjectBtn.addEventListener('click', () => {
        if (projects.length <= 1) return alert("Keep at least one active project.");
        if (!confirm("Delete this project and all its tasks?")) return;
        tasks = tasks.filter(t => t.projectId !== currentProjectId);
        projects = projects.filter(p => p.id !== currentProjectId);
        currentProjectId = projects[0].id;
        localStorage.setItem('kanban-projects', JSON.stringify(projects));
        localStorage.setItem('kanban-current-project', currentProjectId);
        saveToLocalStorage();
        renderProjectsDropdown();
        renderTasks();
    });

    clearBoardBtn.addEventListener('click', () => {
        if (confirm("Delete ALL tasks across ALL projects?")) {
            tasks = [];
            saveToLocalStorage();
            renderTasks();
        }
    });
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveToLocalStorage();
    renderTasks();
}

function renderTasks() {
    const taskLists = document.querySelectorAll('.task-list');
    taskLists.forEach(l => l.innerHTML = '');
    const counts = { todo: 0, inprogress: 0, done: 0 };
    const currentTasks = tasks.filter(t => t.projectId === currentProjectId);

    currentTasks.forEach(t => {
        counts[t.status]++;
        const card = document.createElement('div');
        card.classList.add('task-card');
        card.setAttribute('draggable', 'true');
        card.setAttribute('data-id', t.id);
        card.innerHTML = `
            <h4>${escapeHTML(t.title)}</h4>
            <p>${escapeHTML(t.desc)}</p>
            ${t.comment ? `<p class="task-comment">${escapeHTML(t.comment)}</p>` : ''}
            <button class="delete-task-btn" onclick="deleteTask('${t.id}')">&times;</button>
        `;
        
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-task-btn')) return;
            document.getElementById('task-id').value = t.id;
            document.getElementById('task-column-status').value = t.status;
            document.getElementById('task-title').value = t.title;
            document.getElementById('task-desc').value = t.desc;
            document.getElementById('task-comment').value = t.comment || '';
            
            const modalHeadline = document.getElementById('modal-headline');
            if (modalHeadline) modalHeadline.textContent = "Edit Kanban Task";
            
            const modalDeleteBtn = document.getElementById('modal-delete-task-btn');
            if (modalDeleteBtn) modalDeleteBtn.classList.remove('hide');
            
            document.getElementById('task-modal').classList.add('active');
        });

        card.addEventListener('dragstart', () => card.classList.add('dragging'));
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            taskLists.forEach(l => l.classList.remove('drag-over'));
        });
        document.getElementById(`${t.status}-list`).appendChild(card);
    });

    document.querySelectorAll('.kanban-column').forEach(c => {
        c.querySelector('.task-count').textContent = counts[c.dataset.status];
    });
}

function setupDragAndDrop() {
    const taskLists = document.querySelectorAll('.task-list');
    taskLists.forEach(list => {
        list.addEventListener('dragover', (e) => {
            e.preventDefault();
            list.classList.add('drag-over');
            const dragCard = document.querySelector('.dragging');
            const afterNode = getDragAfterElement(list, e.clientY);
            if (!afterNode) list.appendChild(dragCard);
            else list.insertBefore(dragCard, afterNode);
        });
        list.addEventListener('dragleave', () => list.classList.remove('drag-over'));
        list.addEventListener('dragend', () => list.classList.remove('drag-over'));
        list.addEventListener('drop', () => {
            list.classList.remove('drag-over');
            const dragCard = document.querySelector('.dragging');
            if (!dragCard) return;
            
            const listColumn = list.parentElement.dataset.status;
            const cardId = dragCard.getAttribute('data-id');
            
            const matchedTaskIndex = tasks.findIndex(t => t.id === cardId);
            if (matchedTaskIndex > -1) {
                const [targetItem] = tasks.splice(matchedTaskIndex, 1);
                targetItem.status = listColumn;
                
                const visualSiblings = [...list.querySelectorAll('.task-card')];
                const finalVisualIndex = visualSiblings.indexOf(dragCard);
                
                let placementIdx = tasks.length;
                if (finalVisualIndex > -1 && finalVisualIndex < visualSiblings.length - 1) {
                    const successorId = visualSiblings[finalVisualIndex + 1].getAttribute('data-id');
                    const targetSuccessorIdx = tasks.findIndex(t => t.id === successorId);
                    if (targetSuccessorIdx > -1) placementIdx = targetSuccessorIdx;
                } else if (finalVisualIndex > 0) {
                    const predecessorId = visualSiblings[finalVisualIndex - 1].getAttribute('data-id');
                    const targetPredecessorIdx = tasks.findIndex(t => t.id === predecessorId);
                    if (targetPredecessorIdx > -1) placementIdx = targetPredecessorIdx + 1;
                }
                
                tasks.splice(placementIdx, 0, targetItem);
                saveToLocalStorage();
                renderTasks();
            }
        });
    });
}

function getDragAfterElement(list, y) {
    const cards = [...list.querySelectorAll('.task-card:not(.dragging), .todo-item:not(.dragging), .kanban-group-card:not(.dragging)')];
    return cards.reduce((closest, child) => {
        const b = child.getBoundingClientRect();
        const offset = y - b.top - b.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset, element: child };
        return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// --- MINIMALIST STANDALONE TODO WORKSPACE LOGIC ---
function initTodoPage() {
    const todoForm = document.getElementById('custom-todo-form');
    const todoInput = document.getElementById('custom-todo-input');
    const todoDescInput = document.getElementById('custom-todo-desc');
    const todoCommentInput = document.getElementById('custom-todo-comment');
    const toggleKanban = document.getElementById('toggle-kanban');
    const clearCompletedBtn = document.getElementById('clear-completed-btn');
    const clearAllTodoBtn = document.getElementById('clear-all-todo-btn');

    const accordionTrigger = document.getElementById('toggle-form-accordion');
    const accordionPanel = document.getElementById('accordion-content');
    const accordionIcon = accordionTrigger ? accordionTrigger.querySelector('.accordion-icon') : null;

    const editModal = document.getElementById('todo-edit-modal');
    const editForm = document.getElementById('todo-edit-form');
    const editCancelBtn = document.getElementById('todo-edit-cancel-btn');
    const todoEditDeleteBtn = document.getElementById('todo-edit-delete-btn');

    if (toggleKanban) toggleKanban.checked = importKanbanToggle;
    
    toggleDropdownVisibility(importKanbanToggle);
    renderCombinedTodoList();
    setupTodoListDragAndDrop();

    if (accordionTrigger && accordionPanel) {
        accordionTrigger.addEventListener('click', () => {
            const isHidden = accordionPanel.classList.toggle('hide');
            if (accordionIcon) {
                accordionIcon.textContent = isHidden ? '▼' : '▲';
            }
        });
    }

    if (toggleKanban) {
        toggleKanban.addEventListener('change', (e) => {
            importKanbanToggle = e.target.checked;
            localStorage.setItem('import-kanban-toggle', importKanbanToggle);
            toggleDropdownVisibility(importKanbanToggle);
            renderCombinedTodoList();
        });
    }

    todoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        customTodos.push({ 
            id: 'todo-' + Date.now(), 
            text: todoInput.value, 
            desc: todoDescInput.value,
            comment: todoCommentInput.value,
            completed: false 
        });
        localStorage.setItem('global-custom-todos', JSON.stringify(customTodos));
        todoInput.value = '';
        todoDescInput.value = '';
        todoCommentInput.value = '';
        renderCombinedTodoList();
        
        if (accordionPanel && !accordionPanel.classList.contains('hide')) {
            accordionPanel.classList.add('hide');
            if (accordionIcon) accordionIcon.textContent = '▼';
        }
    });

    clearCompletedBtn.addEventListener('click', () => {
        if (confirm("Clear all completed custom checklist items?")) {
            customTodos = customTodos.filter(t => !t.completed);
            localStorage.setItem('global-custom-todos', JSON.stringify(customTodos));
            renderCombinedTodoList();
        }
    });

    clearAllTodoBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to delete ALL custom checklist items? This cannot be undone.")) {
            customTodos = [];
            localStorage.setItem('global-custom-todos', JSON.stringify(customTodos));
            renderCombinedTodoList();
        }
    });

    editCancelBtn.addEventListener('click', () => editModal.classList.remove('active'));

    editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const itemId = document.getElementById('edit-item-id').value;
        const itemType = document.getElementById('edit-item-type').value;
        const updatedTitle = document.getElementById('edit-item-title').value;
        const updatedDesc = document.getElementById('edit-item-desc').value;
        const updatedComment = document.getElementById('edit-item-comment').value;

        if (itemType === 'custom') {
            const targetTodo = customTodos.find(t => t.id === itemId);
            if (targetTodo) {
                targetTodo.text = updatedTitle;
                targetTodo.desc = updatedDesc;
                targetTodo.comment = updatedComment;
                localStorage.setItem('global-custom-todos', JSON.stringify(customTodos));
            }
        } else if (itemType === 'kanban') {
            const targetTask = tasks.find(t => t.id === itemId);
            if (targetTask) {
                targetTask.title = updatedTitle;
                targetTask.desc = updatedDesc;
                targetTask.comment = updatedComment;
                saveToLocalStorage();
            }
        }

        editModal.classList.remove('active');
        renderCombinedTodoList();
    });

    if (todoEditDeleteBtn) {
        todoEditDeleteBtn.addEventListener('click', () => {
            const itemId = document.getElementById('edit-item-id').value;
            const itemType = document.getElementById('edit-item-type').value;

            if (!itemId || !confirm("Are you sure you want to delete this item?")) return;

            if (itemType === 'custom') {
                customTodos = customTodos.filter(t => t.id !== itemId);
                localStorage.setItem('global-custom-todos', JSON.stringify(customTodos));
            } else if (itemType === 'kanban') {
                tasks = tasks.filter(t => t.id !== itemId);
                saveToLocalStorage();
            }

            editModal.classList.remove('active');
            renderCombinedTodoList();
        });
    }
}

function toggleDropdownVisibility(show) {
    if (!projectSelect) return;
    if (show) projectSelect.classList.remove('hide');
    else projectSelect.classList.add('hide');
}

// --- MODAL ACTION CONTROLS ---
function openEditTodoModal(id, type, currentTitle, currentDesc, currentComment) {
    document.getElementById('edit-item-id').value = id;
    document.getElementById('edit-item-type').value = type;
    document.getElementById('edit-item-title').value = currentTitle;
    document.getElementById('edit-item-desc').value = currentDesc;
    document.getElementById('edit-item-comment').value = currentComment || '';
    document.getElementById('todo-edit-modal').classList.add('active');
}

function renderCombinedTodoList() {
    const listElement = document.getElementById('master-todo-list');
    if (!listElement) return;
    listElement.innerHTML = '';

    // Create custom todo elements
    const customElements = customTodos.map(item => {
        const row = document.createElement('li');
        row.className = `todo-item ${item.completed ? 'completed' : ''}`;
        row.setAttribute('draggable', 'true');
        row.setAttribute('data-id', item.id);
        row.setAttribute('data-type', 'custom');
        row.innerHTML = `
            <input type="checkbox" class="todo-item-checkbox" ${item.completed ? 'checked' : ''}>
            <div class="todo-item-content">
                <span class="todo-item-text">${escapeHTML(item.text)}</span>
                ${item.desc ? `<span class="todo-item-desc">${escapeHTML(item.desc)}</span>` : ''}
                ${item.comment ? `<span class="todo-item-comment">${escapeHTML(item.comment)}</span>` : ''}
            </div>
            <button class="btn-edit-todo">Edit</button>
        `;
        
        row.querySelector('.todo-item-checkbox').addEventListener('change', () => {
            item.completed = !item.completed;
            localStorage.setItem('global-custom-todos', JSON.stringify(customTodos));
            renderCombinedTodoList();
        });

        row.querySelector('.btn-edit-todo').addEventListener('click', () => {
            openEditTodoModal(item.id, 'custom', item.text, item.desc || '', item.comment || '');
        });

        setupListItemDragEvents(row);
        return row;
    });

    // Handle Kanban group generation
    if (importKanbanToggle) {
        const activeBoardTasks = tasks.filter(t => t.projectId === currentProjectId && t.status === 'inprogress');
        
        if (activeBoardTasks.length > 0) {
            const groupWrapper = document.createElement('li');
            groupWrapper.className = 'kanban-group-card';
            groupWrapper.setAttribute('draggable', 'true');
            groupWrapper.setAttribute('data-type', 'kanban-group');
            
            groupWrapper.innerHTML = `
                <div class="kanban-group-header">
                    <span>📋 Imported Kanban Batch (In Progress)</span>
                    <span class="badge">${activeBoardTasks.length} Tasks</span>
                </div>
                <ul class="kanban-sub-list"></ul>
            `;
            
            const subList = groupWrapper.querySelector('.kanban-sub-list');
            
            activeBoardTasks.forEach(task => {
                const subRow = document.createElement('li');
                subRow.className = 'todo-item kanban-imported';
                subRow.setAttribute('draggable', 'true');
                subRow.setAttribute('data-id', task.id);
                subRow.innerHTML = `
                    <input type="checkbox" class="todo-item-checkbox">
                    <div class="todo-item-content">
                        <span class="todo-item-text">${escapeHTML(task.title)}</span>
                        ${task.desc ? `<span class="todo-item-desc">${escapeHTML(task.desc)}</span>` : ''}
                        ${task.comment ? `<span class="todo-item-comment">${escapeHTML(task.comment)}</span>` : ''}
                    </div>
                    <button class="btn-edit-todo">Edit</button>
                `;
                
                subRow.querySelector('.todo-item-checkbox').addEventListener('change', () => {
                    task.status = 'done';
                    saveToLocalStorage();
                    renderCombinedTodoList();
                });

                subRow.querySelector('.btn-edit-todo').addEventListener('click', () => {
                    openEditTodoModal(task.id, 'kanban', task.title, task.desc || '', task.comment || '');
                });

                // Internal sorting within the group to reorder Kanban priority lines
                subRow.addEventListener('dragstart', (e) => {
                    e.stopPropagation();
                    subRow.classList.add('dragging-sub');
                });
                subRow.addEventListener('dragend', (e) => {
                    e.stopPropagation();
                    subRow.classList.remove('dragging-sub');
                });

                subList.appendChild(subRow);
            });

            // Set up sublist drop listeners to update internal board array rankings
            subList.addEventListener('dragover', (e) => {
                e.preventDefault();
                const draggingSub = document.querySelector('.dragging-sub');
                if (!draggingSub) return;
                const afterNode = getDragAfterElement(subList, e.clientY);
                if (!afterNode) subList.appendChild(draggingSub);
                else subList.insertBefore(draggingSub, afterNode);
            });

            subList.addEventListener('drop', (e) => {
                e.stopPropagation();
                const visibleSubItems = [...subList.querySelectorAll('.todo-item')];
                let updatedTasksOrder = [...tasks];

                visibleSubItems.forEach((item, index) => {
                    const currentTaskId = item.getAttribute('data-id');
                    const masterIdx = updatedTasksOrder.findIndex(t => t.id === currentTaskId);
                    if (masterIdx > -1) {
                        const [extracted] = updatedTasksOrder.splice(masterIdx, 1);
                        let insertPoint = updatedTasksOrder.length;
                        if (index > 0) {
                            const prevTaskId = visibleSubItems[index - 1].getAttribute('data-id');
                            const referenceIdx = updatedTasksOrder.findIndex(t => t.id === prevTaskId);
                            if (referenceIdx > -1) insertPoint = referenceIdx + 1;
                        } else if (index < visibleSubItems.length - 1) {
                            const nextTaskId = visibleSubItems[index + 1].getAttribute('data-id');
                            const referenceIdx = updatedTasksOrder.findIndex(t => t.id === nextTaskId);
                            if (referenceIdx > -1) insertPoint = referenceIdx;
                        }
                        updatedTasksOrder.splice(insertPoint, 0, extracted);
                    }
                });

                tasks = updatedTasksOrder;
                saveToLocalStorage();
                renderCombinedTodoList();
            });

            groupWrapper.addEventListener('dragstart', () => groupWrapper.classList.add('dragging'));
            groupWrapper.addEventListener('dragend', () => groupWrapper.classList.remove('dragging'));

            // Splice group wrapper into the layout array securely
            if (kanbanGroupPlacementIndex > customElements.length) {
                kanbanGroupPlacementIndex = customElements.length;
            }
            customElements.splice(kanbanGroupPlacementIndex, 0, groupWrapper);
        }
    }

    // Append everything inside DOM view order securely
    customElements.forEach(el => listElement.appendChild(el));
}

function setupListItemDragEvents(row) {
    row.addEventListener('dragstart', () => row.classList.add('dragging'));
    row.addEventListener('dragend', () => row.classList.remove('dragging'));
}

function setupTodoListDragAndDrop() {
    const listElement = document.getElementById('master-todo-list');
    if (!listElement) return;

    listElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragRow = document.querySelector('.todo-item.dragging, .kanban-group-card.dragging');
        if (!dragRow) return;
        const afterNode = getDragAfterElement(listElement, e.clientY);
        if (!afterNode) listElement.appendChild(dragRow);
        else listElement.insertBefore(dragRow, afterNode);
    });

    listElement.addEventListener('drop', () => {
        const visibleItems = [...listElement.children];
        let newCustomSequence = [];
        let groupIdxCounter = 0;

        visibleItems.forEach((item, idx) => {
            const itemType = item.getAttribute('data-type');
            if (itemType === 'custom') {
                const itemId = item.getAttribute('data-id');
                const matchedTodo = customTodos.find(t => t.id === itemId);
                if (matchedTodo) newCustomSequence.push(matchedTodo);
            } else if (itemType === 'kanban-group') {
                groupIdxCounter = idx;
            }
        });

        customTodos = newCustomSequence;
        localStorage.setItem('global-custom-todos', JSON.stringify(customTodos));
        
        kanbanGroupPlacementIndex = groupIdxCounter;
        localStorage.setItem('kanban-group-placement-idx', kanbanGroupPlacementIndex);

        renderCombinedTodoList();
    });
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}