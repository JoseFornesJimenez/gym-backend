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
            'achievements': 'Gestión de Logros',
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
            case 'achievements':
                loadAchievementData();
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

function showTableLoading(tableBodyId) {
    const tbody = document.getElementById(tableBodyId);
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center" style="padding: 40px;">
                    <div>
                        <i class="fas fa-spinner loading-spinner"></i>
                        <strong>Cargando datos de logros...</strong>
                    </div>
                    <small class="text-muted">Esto puede tomar unos segundos</small>
                </td>
            </tr>
        `;
    }
}

function showError(tableBodyId, message) {
    const tbody = document.getElementById(tableBodyId);
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">❌ ${message}</td></tr>`;
    }
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

// ============================================================================
// GESTIÓN DE LOGROS
// ============================================================================

let currentAchievements = [];

// Cargar datos de logros
async function loadAchievementData() {
    console.log('🏆 Iniciando carga de datos de logros...');
    
    try {
        showTableLoading('achievements-tbody');
        
        // Cargar usuarios básicos primero
        console.log('📡 Solicitando usuarios a:', `${API_BASE_URL}/admin/users`);
        
        const usersResponse = await fetch(`${API_BASE_URL}/admin/users`);
        console.log('📡 Status respuesta usuarios:', usersResponse.status);
        
        if (!usersResponse.ok) {
            throw new Error(`Error HTTP ${usersResponse.status}: ${usersResponse.statusText}`);
        }
        
        const usersData = await usersResponse.json();
        console.log('👥 Datos de usuarios recibidos:', usersData);
        
        if (!usersData.success) {
            throw new Error(usersData.error || 'Respuesta de API sin éxito');
        }
        
        const users = usersData.users || [];
        console.log('👤 Procesando', users.length, 'usuarios');
        
        if (users.length === 0) {
            const tbody = document.getElementById('achievements-tbody');
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay usuarios registrados</td></tr>';
            updateAchievementStats();
            return;
        }
        
        // Procesar usuarios con datos simplificados para evitar timeouts
        const achievementData = users.map((user, index) => {
            console.log(`� Procesando usuario ${index + 1}: ${user.username || user.name || 'Sin nombre'}`);
            
            return {
                id: user.id,
                username: user.username || user.name || 'Sin username',
                email: user.email || 'Sin email',
                name: user.name || user.username || 'Sin nombre',
                totalWorkouts: 0, // Se cargará asíncronamente
                achievementsCount: 0, // Se cargará asíncronamente  
                lastReset: null,
                hasBeenReset: false,
                is_active: user.is_active
            };
        });
        
        console.log('✅ Datos básicos procesados, renderizando tabla...');
        currentAchievements = achievementData;
        renderAchievements();
        updateAchievementStats();
        
        // Cargar datos adicionales de forma asíncrona
        loadAdditionalAchievementData(achievementData);
        
    } catch (error) {
        console.error('❌ Error en loadAchievementData:', error);
        showError('achievements-tbody', `Error: ${error.message}`);
    }
}

// Cargar datos adicionales de logros de forma asíncrona
async function loadAdditionalAchievementData(users) {
    console.log('🔄 Cargando datos adicionales de logros...');
    
    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        
        try {
            // Cargar datos completos de logros del usuario
            const achievementsResponse = await fetch(`${API_BASE_URL}/admin/users/${user.id}/achievements`);
            if (achievementsResponse.ok) {
                const achievementsData = await achievementsResponse.json();
                if (achievementsData.success) {
                    user.totalWorkouts = achievementsData.stats.totalWorkouts;
                    user.achievementsCount = achievementsData.unlockedCount;
                    user.totalPoints = achievementsData.totalPoints;
                    user.achievementsDetails = achievementsData.achievements;
                    user.stats = achievementsData.stats;
                }
            }
            
            // Cargar reset status
            const resetResponse = await fetch(`${API_BASE_URL}/users/${user.id}/achievements-reset-status`);
            if (resetResponse.ok) {
                const resetData = await resetResponse.json();
                user.lastReset = resetData.hasReset ? resetData.resetDate : null;
                user.hasBeenReset = resetData.hasReset;
            }
            
        } catch (error) {
            console.error(`❌ Error cargando datos adicionales para ${user.username}:`, error);
        }
        
        // Actualizar la fila específica en la tabla cada pocos usuarios
        if ((i + 1) % 2 === 0 || i === users.length - 1) {
            renderAchievements();
            updateAchievementStats();
        }
    }
    
    console.log('✅ Carga adicional completada');
}

// Renderizar tabla de logros
function renderAchievements() {
    const tbody = document.getElementById('achievements-tbody');
    
    if (!currentAchievements.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay datos de usuarios</td></tr>';
        return;
    }
    
    tbody.innerHTML = currentAchievements.map(user => {
        const achievementsBadge = user.achievementsCount > 0 
            ? `<span class="badge badge-success">${user.achievementsCount}/10</span>`
            : `<span class="badge badge-secondary">${user.achievementsCount}/10</span>`;
            
        const workoutsBadge = user.totalWorkouts > 0
            ? `<span class="badge badge-primary">${user.totalWorkouts}</span>`
            : `<span class="badge badge-secondary">${user.totalWorkouts}</span>`;
            
        return `
            <tr>
                <td>${user.id}</td>
                <td>
                    <strong>${user.username}</strong>
                    ${user.totalPoints ? `<br><small class="text-success">✨ ${user.totalPoints} puntos</small>` : ''}
                </td>
                <td>${user.email}</td>
                <td class="text-center">${workoutsBadge}</td>
                <td class="text-center">${achievementsBadge}</td>
                <td class="text-center">
                    ${user.hasBeenReset 
                        ? `<small class="text-warning">⚠️ ${formatDate(user.lastReset)}</small>`
                        : '<span class="text-muted">Nunca</span>'
                    }
                </td>
                <td class="actions">
                    <button class="btn btn-warning btn-sm" onclick="resetUserAchievements(${user.id}, '${user.username}')" 
                            title="Reiniciar Logros">
                        <i class="fas fa-redo"></i> Reset
                    </button>
                    <button class="btn btn-info btn-sm" onclick="viewUserAchievements(${user.id}, '${user.username}')" 
                            title="Ver Detalles">
                        <i class="fas fa-eye"></i> Ver
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Reiniciar logros de usuario
async function resetUserAchievements(userId, username) {
    const confirmed = confirm(`¿Estás seguro de que quieres reiniciar todos los logros del usuario "${username}"?\n\nEsta acción no se puede deshacer.`);
    
    if (!confirmed) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/reset-achievements`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('success', `Logros reiniciados correctamente para ${username}`);
            
            // Actualizar la fila en la tabla
            const userIndex = currentAchievements.findIndex(u => u.id === userId);
            if (userIndex !== -1) {
                currentAchievements[userIndex].lastReset = new Date().toISOString();
                currentAchievements[userIndex].hasBeenReset = true;
                currentAchievements[userIndex].achievementsCount = 0;
                renderAchievements();
                updateAchievementStats();
            }
        } else {
            throw new Error(data.error || 'Error reiniciando logros');
        }
        
    } catch (error) {
        console.error('Error reiniciando logros:', error);
        showNotification('error', `Error reiniciando logros: ${error.message}`);
    }
}

// Ver detalles de logros de usuario
async function viewUserAchievements(userId, username) {
    const user = currentAchievements.find(u => u.id === userId);
    if (!user) return;
    
    // Actualizar título del modal
    document.getElementById('achievements-modal-title').textContent = `Logros de ${username}`;
    
    // Mostrar loading en el modal
    document.getElementById('modal-achievements-list').innerHTML = '<div class="loading">Cargando logros detallados...</div>';
    
    // Actualizar estadísticas básicas
    document.getElementById('modal-total-workouts').textContent = user.totalWorkouts || 0;
    document.getElementById('modal-unlocked-achievements').textContent = user.achievementsCount || 0;
    document.getElementById('modal-total-points').textContent = user.totalPoints || 0;
    document.getElementById('modal-last-reset').textContent = user.hasBeenReset 
        ? formatDate(user.lastReset) 
        : 'Nunca';
    
    // Guardar ID de usuario actual para el botón de reset
    window.currentAchievementUserId = userId;
    window.currentAchievementUsername = username;
    
    // Mostrar modal
    document.getElementById('achievements-modal').style.display = 'block';
    
    // Cargar lista detallada de logros
    await loadUserAchievementDetails(userId);
}

// Cargar detalles específicos de logros del usuario
async function loadUserAchievementDetails(userId) {
    const achievementsList = document.getElementById('modal-achievements-list');
    
    try {
        // Obtener datos detallados de logros del usuario
        const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/achievements`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Error obteniendo logros');
        }
        
        const achievements = data.achievements;
        const stats = data.stats;
        
        // Actualizar estadísticas en el modal con datos reales
        document.getElementById('modal-total-workouts').textContent = stats.totalWorkouts;
        document.getElementById('modal-unlocked-achievements').textContent = data.unlockedCount;
        document.getElementById('modal-total-points').textContent = data.totalPoints;
        
        // Renderizar lista de logros con estados reales
        achievementsList.innerHTML = achievements.map(achievement => {
            const badgeClass = achievement.unlocked ? 'badge-success' : 'badge-secondary';
            const badgeText = achievement.unlocked ? 'Desbloqueado' : 'Bloqueado';
            const itemClass = achievement.unlocked ? 'achievement-item unlocked' : 'achievement-item';
            
            return `
                <div class="${itemClass}">
                    <div class="achievement-icon">${achievement.icon}</div>
                    <div class="achievement-info">
                        <h5>${achievement.name}</h5>
                        <p>${achievement.description}</p>
                        ${achievement.unlocked ? `<small class="text-success">✨ +${achievement.points} puntos</small>` : ''}
                    </div>
                    <div class="achievement-status">
                        <span class="badge ${badgeClass}">${badgeText}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        // Agregar estadísticas adicionales
        const statsHTML = `
            <div class="user-stats-detailed">
                <h4>📊 Estadísticas Detalladas:</h4>
                <div class="stats-grid">
                    <div class="stat-item">
                        <strong>💪 Total Sets:</strong> ${stats.totalSets}
                    </div>
                    <div class="stat-item">
                        <strong>🔄 Total Reps:</strong> ${stats.totalReps}
                    </div>
                    <div class="stat-item">
                        <strong>🏋️ Peso Total:</strong> ${Math.round(stats.totalWeightLifted)} kg
                    </div>
                    <div class="stat-item">
                        <strong>🎯 Ejercicios Únicos:</strong> ${stats.uniqueExercises}
                    </div>
                    <div class="stat-item">
                        <strong>🏗️ Máquinas Únicas:</strong> ${stats.uniqueMachines}
                    </div>
                    <div class="stat-item">
                        <strong>🏆 Récords Personales:</strong> ${stats.personalRecords}
                    </div>
                </div>
            </div>
        `;
        
        achievementsList.innerHTML += statsHTML;
        
    } catch (error) {
        console.error('Error cargando detalles de logros:', error);
        achievementsList.innerHTML = `<div class="error">❌ Error cargando logros: ${error.message}</div>`;
    }
}

// Reiniciar logros desde el modal
function resetUserAchievementsFromModal() {
    if (window.currentAchievementUserId && window.currentAchievementUsername) {
        resetUserAchievements(window.currentAchievementUserId, window.currentAchievementUsername);
        closeModal('achievements-modal');
    }
}

// Actualizar estadísticas de logros
function updateAchievementStats() {
    const totalAchievements = 10; // Número de logros disponibles
    const activeUsers = currentAchievements.filter(u => u.totalWorkouts > 0).length;
    const resetCount = currentAchievements.filter(u => u.hasBeenReset).length;
    
    document.getElementById('total-achievements').textContent = totalAchievements;
    document.getElementById('active-users').textContent = activeUsers;
    document.getElementById('reset-count').textContent = resetCount;
}

// Filtrar logros
function filterAchievements() {
    const searchTerm = document.getElementById('achievement-search').value.toLowerCase();
    const filteredAchievements = currentAchievements.filter(user => 
        user.username.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm)
    );
    
    const tbody = document.getElementById('achievements-tbody');
    
    if (!filteredAchievements.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No se encontraron usuarios</td></tr>';
        return;
    }
    
    // Renderizar usuarios filtrados (usando el mismo template)
    tbody.innerHTML = filteredAchievements.map(user => `
        <tr>
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td class="text-center">${user.totalWorkouts}</td>
            <td class="text-center">
                <span class="badge badge-info">${user.achievementsCount}</span>
            </td>
            <td class="text-center">
                ${user.hasBeenReset 
                    ? `<small class="text-muted">${formatDate(user.lastReset)}</small>`
                    : '<span class="text-muted">Nunca</span>'
                }
            </td>
            <td class="actions">
                <button class="btn btn-warning btn-sm" onclick="resetUserAchievements(${user.id}, '${user.username}')" 
                        title="Reiniciar Logros">
                    <i class="fas fa-redo"></i> Reset
                </button>
                <button class="btn btn-info btn-sm" onclick="viewUserAchievements(${user.id}, '${user.username}')" 
                        title="Ver Detalles">
                    <i class="fas fa-eye"></i> Ver
                </button>
            </td>
        </tr>
    `).join('');
}

// Refrescar datos de logros
function refreshAchievements() {
    loadAchievementData();
}

// Mostrar notificación
function showNotification(type, message) {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    
    // Agregar al DOM
    document.body.appendChild(notification);
    
    // Remover después de 5 segundos
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Formatear fecha
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}