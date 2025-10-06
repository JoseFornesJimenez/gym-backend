// Variables globales
let machines = [];
let muscleGroups = [];
let currentEditingMachine = null;

// Configuración de la API
const API_BASE = window.location.origin;

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    loadMachines();
    loadMuscleGroups();
});

// Gestión de tabs
function showSection(sectionName) {
    // Ocultar todas las secciones
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remover clase active de todos los tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Mostrar la sección seleccionada
    document.getElementById(sectionName).classList.add('active');
    
    // Activar el tab correspondiente
    event.target.classList.add('active');
    
    // Cargar datos según la sección
    if (sectionName === 'machines') {
        loadMachines();
    } else if (sectionName === 'muscle-groups') {
        loadMuscleGroups();
    } else if (sectionName === 'associations') {
        loadAssociations();
    }
}

// Funciones para máquinas
async function loadMachines() {
    try {
        document.getElementById('machinesLoading').style.display = 'block';
        document.getElementById('machinesGrid').style.display = 'none';
        
        const response = await fetch(`${API_BASE}/panel/machines`);
        const data = await response.json();
        
        if (data.success) {
            machines = data.data;
            renderMachines(machines);
        } else {
            showAlert('Error al cargar máquinas: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error loading machines:', error);
        showAlert('Error de conexión al cargar máquinas', 'error');
    } finally {
        document.getElementById('machinesLoading').style.display = 'none';
        document.getElementById('machinesGrid').style.display = 'grid';
    }
}

function renderMachines(machinesToRender) {
    const grid = document.getElementById('machinesGrid');
    
    if (machinesToRender.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">No se encontraron máquinas</div>';
        return;
    }
    
    grid.innerHTML = machinesToRender.map(machine => `
        <div class="machine-card">
            <img src="${machine.image}" alt="${machine.name}" class="machine-image" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlbiBubyBkaXNwb25pYmxlPC90ZXh0Pjwvc3ZnPg=='">
            
            <div class="machine-name">${machine.name}</div>
            
            <div class="muscle-groups-tags">
                ${machine.muscle_groups.map(group => `
                    <span class="muscle-tag" style="background-color: ${group.muscle_group_color}">
                        ${group.muscle_group_display}
                    </span>
                `).join('')}
            </div>
            
            <div class="machine-actions">
                <button class="btn btn-primary" onclick="editMachine('${machine.id}')">
                    ✏️ Editar
                </button>
                <button class="btn btn-danger" onclick="confirmDeleteMachine('${machine.id}', '${machine.name}')">
                    🗑️ Eliminar
                </button>
            </div>
        </div>
    `).join('');
}

function filterMachines() {
    const searchTerm = document.getElementById('machineSearch').value.toLowerCase();
    const filtered = machines.filter(machine => 
        machine.name.toLowerCase().includes(searchTerm) ||
        machine.muscle_groups.some(group => 
            group.muscle_group_display.toLowerCase().includes(searchTerm)
        )
    );
    renderMachines(filtered);
}

async function editMachine(machineId) {
    try {
        const response = await fetch(`${API_BASE}/panel/machines/${machineId}`);
        const data = await response.json();
        
        if (data.success) {
            currentEditingMachine = data.data;
            populateEditModal(data.data);
            showModal('editMachineModal');
        } else {
            showAlert('Error al cargar datos de la máquina: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error loading machine:', error);
        showAlert('Error de conexión al cargar la máquina', 'error');
    }
}

function populateEditModal(machine) {
    document.getElementById('editMachineName').value = machine.name;
    document.getElementById('editMachineType').value = machine.type;
    
    // Renderizar grupos musculares
    const groupsContainer = document.getElementById('editMachineGroups');
    groupsContainer.innerHTML = muscleGroups.map(group => {
        const isAssociated = machine.muscle_groups.some(mg => mg.muscle_group_id === group.id);
        return `
            <div class="checkbox-item ${isAssociated ? 'selected' : ''}" onclick="toggleMuscleGroup(this, ${group.id})">
                <input type="checkbox" ${isAssociated ? 'checked' : ''} onchange="event.stopPropagation()">
                <span style="color: ${group.color}">●</span>
                <span>${group.display_name}</span>
            </div>
        `;
    }).join('');
}

function toggleMuscleGroup(element, groupId) {
    const checkbox = element.querySelector('input');
    checkbox.checked = !checkbox.checked;
    element.classList.toggle('selected', checkbox.checked);
}

async function updateMachine() {
    if (!currentEditingMachine) return;
    
    try {
        const name = document.getElementById('editMachineName').value.trim();
        const type = document.getElementById('editMachineType').value;
        
        if (!name) {
            showAlert('El nombre de la máquina es obligatorio', 'error');
            return;
        }
        
        // Actualizar datos básicos de la máquina
        const updateResponse = await fetch(`${API_BASE}/panel/machines/${currentEditingMachine.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, type })
        });
        
        if (!updateResponse.ok) {
            throw new Error('Error al actualizar la máquina');
        }
        
        // Obtener grupos musculares seleccionados
        const selectedGroups = [];
        document.querySelectorAll('#editMachineGroups .checkbox-item input:checked').forEach(checkbox => {
            const groupId = parseInt(checkbox.parentElement.onclick.toString().match(/toggleMuscleGroup\(this, (\d+)\)/)[1]);
            selectedGroups.push(groupId);
        });
        
        // Eliminar todas las asociaciones actuales
        for (const group of currentEditingMachine.muscle_groups) {
            await fetch(`${API_BASE}/panel/machines/${currentEditingMachine.id}/muscle-groups/${group.muscle_group_id}`, {
                method: 'DELETE'
            });
        }
        
        // Crear nuevas asociaciones
        for (const groupId of selectedGroups) {
            await fetch(`${API_BASE}/panel/machines/${currentEditingMachine.id}/muscle-groups`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    muscleGroupId: groupId,
                    isPrimary: true 
                })
            });
        }
        
        showAlert('Máquina actualizada correctamente', 'success');
        closeModal('editMachineModal');
        loadMachines();
        
    } catch (error) {
        console.error('Error updating machine:', error);
        showAlert('Error al actualizar la máquina', 'error');
    }
}

function confirmDeleteMachine(machineId, machineName) {
    if (confirm(`¿Estás seguro de eliminar la máquina "${machineName}"?`)) {
        deleteMachineById(machineId);
    }
}

async function deleteMachineById(machineId) {
    try {
        const response = await fetch(`${API_BASE}/panel/machines/${machineId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Máquina eliminada correctamente', 'success');
            loadMachines();
        } else {
            showAlert('Error al eliminar máquina: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error deleting machine:', error);
        showAlert('Error de conexión al eliminar máquina', 'error');
    }
}

// Funciones para grupos musculares
async function loadMuscleGroups() {
    try {
        document.getElementById('muscleGroupsLoading').style.display = 'block';
        document.getElementById('muscleGroupsList').style.display = 'none';
        
        const response = await fetch(`${API_BASE}/panel/muscle-groups`);
        const data = await response.json();
        
        if (data.success) {
            muscleGroups = data.data;
            renderMuscleGroups(data.data);
        } else {
            showAlert('Error al cargar grupos musculares: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error loading muscle groups:', error);
        showAlert('Error de conexión al cargar grupos musculares', 'error');
    } finally {
        document.getElementById('muscleGroupsLoading').style.display = 'none';
        document.getElementById('muscleGroupsList').style.display = 'block';
    }
}

function renderMuscleGroups(groups) {
    const list = document.getElementById('muscleGroupsList');
    
    list.innerHTML = groups.map(group => `
        <div class="muscle-group-item">
            <div class="muscle-group-info">
                <div class="color-indicator" style="background-color: ${group.color}"></div>
                <div class="muscle-group-details">
                    <h3>${group.display_name}</h3>
                    <p>ID: ${group.name} • ${group.machine_count} máquinas asociadas</p>
                </div>
            </div>
            <div class="muscle-group-actions">
                <button class="btn btn-primary" onclick="editMuscleGroup(${group.id})">
                    ✏️ Editar
                </button>
                <button class="btn btn-danger" onclick="confirmDeleteMuscleGroup(${group.id}, '${group.display_name}')">
                    🗑️ Eliminar
                </button>
            </div>
        </div>
    `).join('');
}

function showAddMuscleGroupModal() {
    document.getElementById('newGroupName').value = '';
    document.getElementById('newGroupDisplayName').value = '';
    document.getElementById('newGroupColor').value = '#667eea';
    showModal('addMuscleGroupModal');
}

async function createMuscleGroup() {
    try {
        const name = document.getElementById('newGroupName').value.trim();
        const displayName = document.getElementById('newGroupDisplayName').value.trim();
        const color = document.getElementById('newGroupColor').value;
        
        if (!name || !displayName) {
            showAlert('Todos los campos son obligatorios', 'error');
            return;
        }
        
        const response = await fetch(`${API_BASE}/panel/muscle-groups`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, displayName, color })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Grupo muscular creado correctamente', 'success');
            closeModal('addMuscleGroupModal');
            loadMuscleGroups();
        } else {
            showAlert('Error al crear grupo: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error creating muscle group:', error);
        showAlert('Error de conexión al crear grupo', 'error');
    }
}

function confirmDeleteMuscleGroup(groupId, groupName) {
    if (confirm(`¿Estás seguro de eliminar el grupo "${groupName}"? Esto también eliminará todas sus asociaciones.`)) {
        deleteMuscleGroupById(groupId);
    }
}

async function deleteMuscleGroupById(groupId) {
    try {
        const response = await fetch(`${API_BASE}/panel/muscle-groups/${groupId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Grupo muscular eliminado correctamente', 'success');
            loadMuscleGroups();
        } else {
            showAlert('Error al eliminar grupo: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error deleting muscle group:', error);
        showAlert('Error de conexión al eliminar grupo', 'error');
    }
}

// Funciones de utilidad
function showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
    currentEditingMachine = null;
}

function showAlert(message, type) {
    // Remover alertas existentes
    document.querySelectorAll('.alert').forEach(alert => alert.remove());
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    document.querySelector('.content').insertBefore(alert, document.querySelector('.content').firstChild);
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

// Cerrar modales al hacer clic fuera
document.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('show');
        currentEditingMachine = null;
    }
});

// Funciones para asociaciones (sección de resumen)
async function loadAssociations() {
    try {
        document.getElementById('associationsLoading').style.display = 'block';
        document.getElementById('associationsList').style.display = 'none';
        
        // Para esta sección, podemos reutilizar los datos de máquinas
        await loadMachines();
        
        renderAssociations();
    } catch (error) {
        console.error('Error loading associations:', error);
        showAlert('Error al cargar asociaciones', 'error');
    } finally {
        document.getElementById('associationsLoading').style.display = 'none';
        document.getElementById('associationsList').style.display = 'block';
    }
}

function renderAssociations() {
    const container = document.getElementById('associationsList');
    
    // Agrupar por grupo muscular
    const groupedAssociations = {};
    
    machines.forEach(machine => {
        machine.muscle_groups.forEach(group => {
            if (!groupedAssociations[group.muscle_group_display]) {
                groupedAssociations[group.muscle_group_display] = {
                    color: group.muscle_group_color,
                    machines: []
                };
            }
            groupedAssociations[group.muscle_group_display].machines.push(machine);
        });
    });
    
    container.innerHTML = Object.entries(groupedAssociations).map(([groupName, data]) => `
        <div style="margin-bottom: 20px; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h3 style="color: ${data.color}; margin: 0 0 15px 0; display: flex; align-items: center; gap: 10px;">
                <span style="width: 12px; height: 12px; background-color: ${data.color}; border-radius: 50%; display: inline-block;"></span>
                ${groupName} (${data.machines.length} máquinas)
            </h3>
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                ${data.machines.map(machine => `
                    <span style="padding: 5px 10px; background-color: ${data.color}20; color: ${data.color}; border-radius: 15px; font-size: 14px;">
                        ${machine.name}
                    </span>
                `).join('')}
            </div>
        </div>
    `).join('');
}