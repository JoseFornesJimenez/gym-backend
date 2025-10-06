// API Base URL
const API_BASE_URL = '/api';

// Estado global
let currentUsers = [];
let currentExercises = [];
let currentImages = [];

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    initializeAdmin();
    setupEventListeners();
    loadDashboardData();
});

function initializeAdmin() {
    // Configurar navegación del sidebar
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            showSection(section);
            
            // Actualizar navegación activa
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

function setupEventListeners() {
    // Cerrar modales al hacer clic fuera
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
}

function showSection(sectionName) {
    // Ocultar todas las secciones
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => section.classList.remove('active'));
    
    // Mostrar la sección seleccionada
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
        
        // Actualizar título
        const titles = {
            'dashboard': 'Dashboard',
            'users': 'Gestión de Usuarios',
            'exercises': 'Gestión de Ejercicios',
            'images': 'Gestión de Imágenes',
            'statistics': 'Estadísticas del Sistema'
        };
        document.getElementById('page-title').textContent = titles[sectionName] || 'Panel de Administración';
        
        // Cargar datos específicos de la sección
        switch(sectionName) {
            case 'dashboard':
                loadDashboardData();
                break;
            case 'users':
                loadUsers();
                break;
            case 'exercises':
                loadExercises();
                break;
            case 'images':
                loadImages();
                break;
            case 'statistics':
                loadStatistics();
                break;
            case 'muscle-groups':
                loadMuscleGroups();
                break;
        }
    }
}

// Dashboard Functions
async function loadDashboardData() {
    try {
        showLoading();
        
        // Cargar estadísticas del dashboard
        const [usersRes, exercisesRes, recordsRes] = await Promise.all([
            fetch(`${API_BASE_URL}/admin/users/stats`),
            fetch(`${API_BASE_URL}/exercises`),
            fetch(`${API_BASE_URL}/admin/weight-records/stats`)
        ]);
        
        if (usersRes.ok) {
            const usersData = await usersRes.json();
            document.getElementById('total-users').textContent = usersData.total || 0;
            document.getElementById('active-users').textContent = usersData.active || 0;
        }
        
        if (exercisesRes.ok) {
            const exercisesData = await exercisesRes.json();
            document.getElementById('total-exercises').textContent = exercisesData.data?.length || 0;
        }
        
        if (recordsRes.ok) {
            const recordsData = await recordsRes.json();
            document.getElementById('total-records').textContent = recordsData.total || 0;
        }
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showAlert('Error al cargar datos del dashboard', 'danger');
    } finally {
        hideLoading();
    }
}

// Users Management Functions
async function loadUsers() {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/admin/users`);
        const data = await response.json();
        
        if (data.success) {
            currentUsers = data.users;
            displayUsers(currentUsers);
        } else {
            showAlert('Error al cargar usuarios', 'danger');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showAlert('Error de conexión al cargar usuarios', 'danger');
    } finally {
        hideLoading();
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const row = document.createElement('tr');
        const lastLogin = user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Nunca';
        const statusClass = user.is_active ? 'status-active' : 'status-inactive';
        const statusText = user.is_active ? 'Activo' : 'Inactivo';
        
        row.innerHTML = `
            <td>${user.id.substring(0, 8)}...</td>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>${user.first_name || ''} ${user.last_name || ''}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>${lastLogin}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-primary" onclick="editUser('${user.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="showResetPasswordModal('${user.id}', '${user.username}')">
                        <i class="fas fa-key"></i>
                    </button>
                    <button class="btn btn-sm ${user.is_active ? 'btn-secondary' : 'btn-success'}" 
                            onclick="toggleUserStatus('${user.id}', ${!user.is_active})">
                        <i class="fas fa-${user.is_active ? 'ban' : 'check'}"></i>
                    </button>
                    ${!user.is_admin ? `<button class="btn btn-sm btn-danger" onclick="deleteUser('${user.id}', '${user.username}')">
                        <i class="fas fa-trash"></i>
                    </button>` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function filterUsers() {
    const searchTerm = document.getElementById('user-search').value.toLowerCase();
    const filteredUsers = currentUsers.filter(user => 
        user.username.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm) ||
        (user.first_name && user.first_name.toLowerCase().includes(searchTerm)) ||
        (user.last_name && user.last_name.toLowerCase().includes(searchTerm))
    );
    displayUsers(filteredUsers);
}

function refreshUsers() {
    loadUsers();
}

function showCreateUserModal() {
    document.getElementById('user-modal-title').textContent = 'Nuevo Usuario';
    document.getElementById('user-form').reset();
    document.getElementById('user-id').value = '';
    document.getElementById('password-group').style.display = 'block';
    document.getElementById('password').required = true;
    document.getElementById('user-modal').style.display = 'block';
}

function editUser(userId) {
    const user = currentUsers.find(u => u.id === userId);
    if (!user) return;
    
    document.getElementById('user-modal-title').textContent = 'Editar Usuario';
    document.getElementById('user-id').value = user.id;
    document.getElementById('username').value = user.username;
    document.getElementById('email').value = user.email;
    document.getElementById('first-name').value = user.first_name || '';
    document.getElementById('last-name').value = user.last_name || '';
    document.getElementById('phone').value = user.phone || '';
    document.getElementById('date-of-birth').value = user.date_of_birth || '';
    document.getElementById('is-admin').checked = user.is_admin;
    document.getElementById('is-active').checked = user.is_active;
    document.getElementById('password').value = '';
    document.getElementById('password').required = false;
    document.getElementById('password-group').style.display = 'block';
    
    document.getElementById('user-modal').style.display = 'block';
}

function closeUserModal() {
    document.getElementById('user-modal').style.display = 'none';
}

async function saveUser() {
    const userId = document.getElementById('user-id').value;
    const isEdit = !!userId;
    
    const userData = {
        username: document.getElementById('username').value,
        email: document.getElementById('email').value,
        first_name: document.getElementById('first-name').value,
        last_name: document.getElementById('last-name').value,
        phone: document.getElementById('phone').value,
        date_of_birth: document.getElementById('date-of-birth').value,
        is_admin: document.getElementById('is-admin').checked,
        is_active: document.getElementById('is-active').checked
    };
    
    const password = document.getElementById('password').value;
    if (password || !isEdit) {
        userData.password = password;
    }
    
    try {
        showLoading();
        
        const url = isEdit ? `${API_BASE_URL}/admin/users/${userId}` : `${API_BASE_URL}/admin/users`;
        const method = isEdit ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert(isEdit ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente', 'success');
            closeUserModal();
            loadUsers();
        } else {
            showAlert(data.error || 'Error al guardar usuario', 'danger');
        }
    } catch (error) {
        console.error('Error saving user:', error);
        showAlert('Error de conexión al guardar usuario', 'danger');
    } finally {
        hideLoading();
    }
}

function showResetPasswordModal(userId, username) {
    document.getElementById('reset-user-id').value = userId;
    document.getElementById('reset-user-name').textContent = username;
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
    document.getElementById('reset-password-modal').style.display = 'block';
}

function closeResetPasswordModal() {
    document.getElementById('reset-password-modal').style.display = 'none';
}

async function resetUserPassword() {
    const userId = document.getElementById('reset-user-id').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (newPassword !== confirmPassword) {
        showAlert('Las contraseñas no coinciden', 'danger');
        return;
    }
    
    if (newPassword.length < 6) {
        showAlert('La contraseña debe tener al menos 6 caracteres', 'danger');
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ newPassword })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Contraseña reiniciada correctamente', 'success');
            closeResetPasswordModal();
        } else {
            showAlert(data.error || 'Error al reiniciar contraseña', 'danger');
        }
    } catch (error) {
        console.error('Error resetting password:', error);
        showAlert('Error de conexión al reiniciar contraseña', 'danger');
    } finally {
        hideLoading();
    }
}

async function toggleUserStatus(userId, newStatus) {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_active: newStatus })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert(`Usuario ${newStatus ? 'activado' : 'desactivado'} correctamente`, 'success');
            loadUsers();
        } else {
            showAlert(data.error || 'Error al cambiar estado del usuario', 'danger');
        }
    } catch (error) {
        console.error('Error toggling user status:', error);
        showAlert('Error de conexión al cambiar estado del usuario', 'danger');
    } finally {
        hideLoading();
    }
}

async function deleteUser(userId, username) {
    if (!confirm(`¿Estás seguro de que quieres eliminar al usuario "${username}"? Esta acción no se puede deshacer.`)) {
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Usuario eliminado correctamente', 'success');
            loadUsers();
        } else {
            showAlert(data.error || 'Error al eliminar usuario', 'danger');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showAlert('Error de conexión al eliminar usuario', 'danger');
    } finally {
        hideLoading();
    }
}

// Exercises Management Functions
async function loadExercises() {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/exercises`);
        const data = await response.json();
        
        if (data.success) {
            currentExercises = data.data;
            displayExercises(currentExercises);
        } else {
            showAlert('Error al cargar ejercicios', 'danger');
        }
    } catch (error) {
        console.error('Error loading exercises:', error);
        showAlert('Error de conexión al cargar ejercicios', 'danger');
    } finally {
        hideLoading();
    }
}

function displayExercises(exercises) {
    const grid = document.getElementById('exercises-grid');
    grid.innerHTML = '';
    
    exercises.forEach(exercise => {
        const card = document.createElement('div');
        card.className = 'exercise-card';
        card.innerHTML = `
            <img src="${exercise.image}" alt="${exercise.name}" onerror="this.src='/uploads/placeholder.jpg'">
            <div class="card-content">
                <h3>${exercise.name}</h3>
                <p><strong>ID:</strong> ${exercise.id}</p>
                <p><strong>Categoría:</strong> ${exercise.category || 'N/A'}</p>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-primary" onclick="editExercise('${exercise.id}')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-sm btn-success" onclick="editMachineComplete('${exercise.id}')">
                        <i class="fas fa-cogs"></i> Editar Completo
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function refreshExercises() {
    loadExercises();
}

// Images Management Functions
async function loadImages() {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/admin/images`);
        const data = await response.json();
        
        if (data.success) {
            currentImages = data.images;
            displayImages(currentImages);
        } else {
            showAlert('Error al cargar imágenes', 'danger');
        }
    } catch (error) {
        console.error('Error loading images:', error);
        showAlert('Error de conexión al cargar imágenes', 'danger');
    } finally {
        hideLoading();
    }
}

function displayImages(images) {
    const grid = document.getElementById('images-grid');
    grid.innerHTML = '';
    
    images.forEach(image => {
        const card = document.createElement('div');
        card.className = 'image-card';
        card.innerHTML = `
            <img src="${image.url}" alt="${image.filename}" onerror="this.src='/uploads/placeholder.jpg'">
            <div class="card-content">
                <h3>${image.filename}</h3>
                <p><strong>Tamaño:</strong> ${(image.size / 1024).toFixed(2)} KB</p>
                <p><strong>Subida:</strong> ${new Date(image.uploadDate).toLocaleDateString()}</p>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-primary" onclick="copyImageUrl('${image.url}')">
                        <i class="fas fa-copy"></i> Copiar URL
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteImage('${image.filename}')">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function refreshImages() {
    loadImages();
}

async function uploadImage() {
    const fileInput = document.getElementById('image-upload');
    const file = fileInput.files[0];
    
    if (!file) return;
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Imagen subida correctamente', 'success');
            loadImages();
            fileInput.value = '';
        } else {
            showAlert(data.error || 'Error al subir imagen', 'danger');
        }
    } catch (error) {
        console.error('Error uploading image:', error);
        showAlert('Error de conexión al subir imagen', 'danger');
    } finally {
        hideLoading();
    }
}

function copyImageUrl(url) {
    navigator.clipboard.writeText(url).then(() => {
        showAlert('URL copiada al portapapeles', 'success');
    }).catch(() => {
        showAlert('Error al copiar URL', 'danger');
    });
}

async function deleteImage(filename) {
    if (!confirm(`¿Estás seguro de que quieres eliminar la imagen "${filename}"?`)) {
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/admin/images/${filename}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Imagen eliminada correctamente', 'success');
            loadImages();
        } else {
            showAlert(data.error || 'Error al eliminar imagen', 'danger');
        }
    } catch (error) {
        console.error('Error deleting image:', error);
        showAlert('Error de conexión al eliminar imagen', 'danger');
    } finally {
        hideLoading();
    }
}

// Statistics Functions
function loadStatistics() {
    // Aquí puedes agregar gráficos usando Chart.js o similar
    showAlert('Función de estadísticas en desarrollo', 'info');
}

// Utility Functions
function showLoading() {
    document.getElementById('loading-overlay').classList.add('show');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.remove('show');
}

function showAlert(message, type = 'info') {
    // Crear elemento de alerta
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    // Agregar al body
    document.body.appendChild(alert);
    
    // Posicionar la alerta
    alert.style.position = 'fixed';
    alert.style.top = '20px';
    alert.style.right = '20px';
    alert.style.zIndex = '4000';
    alert.style.minWidth = '300px';
    alert.style.animation = 'slideInRight 0.3s ease';
    
    // Remover después de 5 segundos
    setTimeout(() => {
        alert.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 300);
    }, 5000);
}

function logout() {
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
        // Aquí puedes agregar lógica de logout si es necesario
        window.location.href = '/';
    }
}

// ============= FUNCIONES PARA GRUPOS MUSCULARES =============

// Cargar grupos musculares disponibles
async function loadMuscleGroups() {
    try {
        const response = await fetch(`${API_BASE_URL}/muscle-groups`);
        const result = await response.json();
        
        if (result.success) {
            displayMuscleGroups(result.data);
        } else {
            showAlert('Error al cargar grupos musculares', 'error');
        }
    } catch (error) {
        console.error('Error loading muscle groups:', error);
        showAlert('Error de conexión al cargar grupos musculares', 'error');
    }
}

// Mostrar grupos musculares en la interfaz
function displayMuscleGroups(groups) {
    const container = document.getElementById('muscle-groups-list');
    if (!container) return;
    
    container.innerHTML = groups.map(group => `
        <div class="muscle-group-card" data-group-id="${group.id}">
            <div class="card-header">
                <h4>${group.name}</h4>
                <span class="machine-count">${group.machine_count} máquinas</span>
            </div>
            <p class="group-description">${group.description}</p>
            <div class="card-actions">
                <button class="btn btn-primary btn-sm" onclick="viewGroupMachines('${group.id}', '${group.name}')">
                    <i class="fas fa-eye"></i> Ver Máquinas
                </button>
            </div>
        </div>
    `).join('');
}

// Ver máquinas de un grupo muscular específico
async function viewGroupMachines(groupId, groupName) {
    try {
        const response = await fetch(`${API_BASE_URL}/muscle-groups/${groupId}/machines`);
        const result = await response.json();
        
        if (result.success) {
            displayGroupMachinesModal(result.data, groupName);
        } else {
            showAlert('Error al cargar máquinas del grupo', 'error');
        }
    } catch (error) {
        console.error('Error loading group machines:', error);
        showAlert('Error de conexión al cargar máquinas', 'error');
    }
}

// Mostrar modal con máquinas del grupo
function displayGroupMachinesModal(machines, groupName) {
    const modal = createModal('group-machines-modal', `Máquinas de ${groupName}`);
    
    const content = `
        <div class="machines-grid">
            ${machines.map(machine => `
                <div class="machine-card ${machine.is_primary ? 'primary' : 'secondary'}">
                    <img src="${machine.image_url}" alt="${machine.name}" onerror="this.src='/images/placeholder.png'">
                    <h5>${machine.name}</h5>
                    <span class="machine-type">${machine.is_primary ? 'Principal' : 'Secundaria'}</span>
                    <div class="machine-actions">
                        <button class="btn btn-sm btn-secondary" onclick="editMachineComplete('${machine.id}')">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    setModalContent(modal, content);
    showModal(modal);
}

// ============= FUNCIONES PARA EDICIÓN COMPLETA DE MÁQUINAS =============

// Editar máquina con toda su información
async function editMachineComplete(machineId) {
    try {
        const response = await fetch(`${API_BASE_URL}/exercises/${machineId}/complete`);
        const result = await response.json();
        
        if (result.success) {
            showEditMachineModal(result.data);
        } else {
            showAlert('Error al cargar información de la máquina', 'error');
        }
    } catch (error) {
        console.error('Error loading complete machine info:', error);
        showAlert('Error de conexión al cargar máquina', 'error');
    }
}

// Mostrar modal de edición completa de máquina
function showEditMachineModal(machine) {
    const muscleGroups = [
        { id: 'biceps', name: 'Bíceps' },
        { id: 'triceps', name: 'Tríceps' },
        { id: 'culo', name: 'Culo' },
        { id: 'pecho', name: 'Pecho' },
        { id: 'espalda', name: 'Espalda' },
        { id: 'hombros', name: 'Hombros' },
        { id: 'piernas', name: 'Piernas' },
        { id: 'core', name: 'Core' }
    ];
    
    const modal = createModal('edit-machine-complete-modal', 'Editar Máquina Completa');
    
    const content = `
        <form id="edit-machine-complete-form" enctype="multipart/form-data">
            <div class="form-grid">
                <div class="form-group">
                    <label for="machine-name">Nombre de la Máquina</label>
                    <input type="text" id="machine-name" name="name" value="${machine.name}" required>
                </div>
                
                <div class="form-group">
                    <label for="machine-description">Descripción</label>
                    <textarea id="machine-description" name="description" rows="3">${machine.description || ''}</textarea>
                </div>
                
                <div class="form-group">
                    <label for="machine-image">Imagen de la Máquina</label>
                    <input type="file" id="machine-image" name="image" accept="image/*">
                    <div class="current-image">
                        <img src="${machine.image_url}" alt="${machine.name}" style="max-width: 150px; margin-top: 10px;">
                        <small>Imagen actual</small>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Grupos Musculares</label>
                    <div class="muscle-groups-checkboxes">
                        ${muscleGroups.map(group => `
                            <label class="checkbox-label">
                                <input type="checkbox" 
                                       name="muscleGroups" 
                                       value="${group.id}" 
                                       ${machine.muscleGroups.includes(group.id) ? 'checked' : ''}>
                                ${group.name}
                            </label>
                        `).join('')}
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" 
                               id="is-primary" 
                               name="isPrimary" 
                               ${machine.isPrimary ? 'checked' : ''}>
                        Es máquina principal
                    </label>
                </div>
                
                <div class="form-group">
                    <label>Tipos de Agarre Actuales</label>
                    <div class="grip-types-list">
                        ${machine.gripTypes.length > 0 ? 
                            machine.gripTypes.map(grip => `
                                <div class="grip-type-item">
                                    <img src="${grip.image_url}" alt="${grip.name}" style="width: 50px; height: 50px; object-fit: cover;">
                                    <span>${grip.name}</span>
                                    <button type="button" class="btn btn-sm btn-danger" onclick="deleteGripType('${grip.id}')">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            `).join('') :
                            '<p class="text-muted">No hay tipos de agarre definidos</p>'
                        }
                    </div>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="showAddGripTypeModal('${machine.id}')">
                        <i class="fas fa-plus"></i> Agregar Tipo de Agarre
                    </button>
                </div>
            </div>
            
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal('edit-machine-complete-modal')">
                    Cancelar
                </button>
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-save"></i> Guardar Cambios
                </button>
            </div>
        </form>
    `;
    
    setModalContent(modal, content);
    showModal(modal);
    
    // Configurar el formulario
    document.getElementById('edit-machine-complete-form').addEventListener('submit', function(e) {
        e.preventDefault();
        saveMachineComplete(machine.id, this);
    });
}

// Guardar cambios completos de máquina
async function saveMachineComplete(machineId, form) {
    try {
        const formData = new FormData(form);
        
        // Obtener grupos musculares seleccionados
        const selectedGroups = Array.from(form.querySelectorAll('input[name="muscleGroups"]:checked'))
            .map(checkbox => checkbox.value);
        
        formData.set('muscleGroups', JSON.stringify(selectedGroups));
        formData.set('isPrimary', form.querySelector('#is-primary').checked);
        
        const response = await fetch(`${API_BASE_URL}/exercises/${machineId}/complete`, {
            method: 'PUT',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Máquina actualizada correctamente', 'success');
            closeModal('edit-machine-complete-modal');
            // Recargar la sección actual
            if (document.getElementById('exercises-section').classList.contains('active')) {
                loadExercises();
            }
        } else {
            showAlert(result.error || 'Error al actualizar máquina', 'error');
        }
    } catch (error) {
        console.error('Error saving machine:', error);
        showAlert('Error de conexión al guardar máquina', 'error');
    }
}

// ============= FUNCIONES PARA TIPOS DE AGARRE =============

// Mostrar modal para agregar tipo de agarre
function showAddGripTypeModal(machineId) {
    const modal = createModal('add-grip-type-modal', 'Agregar Tipo de Agarre');
    
    const content = `
        <form id="add-grip-type-form" enctype="multipart/form-data">
            <div class="form-group">
                <label for="grip-name">Nombre del Agarre</label>
                <input type="text" id="grip-name" name="name" required placeholder="Ej: Agarre Ancho">
            </div>
            
            <div class="form-group">
                <label for="grip-description">Descripción</label>
                <textarea id="grip-description" name="description" rows="3" placeholder="Descripción opcional del tipo de agarre"></textarea>
            </div>
            
            <div class="form-group">
                <label for="grip-image">Imagen del Agarre</label>
                <input type="file" id="grip-image" name="image" accept="image/*" required>
                <small class="text-muted">Selecciona una imagen que muestre cómo usar este agarre</small>
            </div>
            
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal('add-grip-type-modal')">
                    Cancelar
                </button>
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-plus"></i> Crear Tipo de Agarre
                </button>
            </div>
        </form>
    `;
    
    setModalContent(modal, content);
    showModal(modal);
    
    document.getElementById('add-grip-type-form').addEventListener('submit', function(e) {
        e.preventDefault();
        saveGripType(machineId, this);
    });
}

// Guardar nuevo tipo de agarre
async function saveGripType(machineId, form) {
    try {
        const formData = new FormData(form);
        
        const response = await fetch(`${API_BASE_URL}/exercises/${machineId}/grip-types`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Tipo de agarre creado correctamente', 'success');
            closeModal('add-grip-type-modal');
            // Recargar la información de la máquina
            editMachineComplete(machineId);
        } else {
            showAlert(result.error || 'Error al crear tipo de agarre', 'error');
        }
    } catch (error) {
        console.error('Error saving grip type:', error);
        showAlert('Error de conexión al crear tipo de agarre', 'error');
    }
}

// Eliminar tipo de agarre
async function deleteGripType(gripId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este tipo de agarre?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/grip-types/${gripId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Tipo de agarre eliminado correctamente', 'success');
            // Recargar la vista actual
            location.reload();
        } else {
            showAlert(result.error || 'Error al eliminar tipo de agarre', 'error');
        }
    } catch (error) {
        console.error('Error deleting grip type:', error);
        showAlert('Error de conexión al eliminar tipo de agarre', 'error');
    }
}

// ============= FUNCIONES DE UTILIDAD PARA MODALES =============

// Crear modal base
function createModal(id, title) {
    let modal = document.getElementById(id);
    if (modal) {
        modal.remove();
    }
    
    modal = document.createElement('div');
    modal.id = id;
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${title}</h3>
                <button type="button" class="close-modal" onclick="closeModal('${id}')">&times;</button>
            </div>
            <div class="modal-body"></div>
        </div>
    `;
    
    document.body.appendChild(modal);
    return modal;
}

// Establecer contenido del modal
function setModalContent(modal, content) {
    const modalBody = modal.querySelector('.modal-body');
    modalBody.innerHTML = content;
}

// Mostrar modal
function showModal(modal) {
    modal.style.display = 'block';
}

// Cerrar modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}