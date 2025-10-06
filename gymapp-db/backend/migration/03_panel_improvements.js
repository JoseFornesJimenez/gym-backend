// ========================================
// MIGRACIÓN: Funciones JavaScript mejoradas para tu panel actual
// ========================================
// Agregar estas funciones a tu archivo public/js/admin.js existente

// ============= NUEVAS FUNCIONES DE GRUPOS MUSCULARES =============

// Función para cargar grupos musculares en el panel
async function loadMuscleGroups() {
    try {
        const response = await fetch('/api/muscle-groups');
        const muscleGroups = await response.json();
        
        const container = document.getElementById('muscle-groups-container');
        if (!container) return;
        
        container.innerHTML = muscleGroups.map(group => `
            <div class="muscle-group-card" data-group-id="${group.id}">
                <div class="group-header">
                    <h4>${group.name}</h4>
                    <span class="machine-count">${group.machine_count} máquinas</span>
                </div>
                <p class="group-description">${group.description || 'Sin descripción'}</p>
                <div class="group-actions">
                    <button class="btn btn-sm btn-primary" onclick="viewGroupMachines(${group.id})">
                        Ver Máquinas
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="editGroup(${group.id})">
                        Editar
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading muscle groups:', error);
        showNotification('Error al cargar grupos musculares', 'error');
    }
}

// Función para ver máquinas de un grupo muscular
async function viewGroupMachines(groupId) {
    try {
        const response = await fetch(`/api/muscle-groups/${groupId}/machines`);
        const machines = await response.json();
        
        // Crear modal o sección para mostrar máquinas
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Máquinas del Grupo Muscular</h3>
                    <button class="close-modal" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="machines-grid">
                        ${machines.map(machine => `
                            <div class="machine-card ${machine.is_primary ? 'primary' : 'secondary'}">
                                <img src="${machine.image_url}" alt="${machine.name}" onerror="this.src='/images/placeholder.png'">
                                <h4>${machine.name}</h4>
                                <span class="machine-type">${machine.is_primary ? 'Principal' : 'Secundaria'}</span>
                                <div class="machine-actions">
                                    <button class="btn btn-sm btn-danger" onclick="removeMachineFromGroup(${machine.id}, ${groupId})">
                                        Quitar
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('Error loading group machines:', error);
        showNotification('Error al cargar máquinas del grupo', 'error');
    }
}

// Función para asociar máquina con grupo muscular
async function associateMachineWithGroup(machineId, groupId, isPrimary = false) {
    try {
        const response = await fetch(`/api/machines/${machineId}/muscle-groups/${groupId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_primary: isPrimary })
        });
        
        if (response.ok) {
            showNotification('Máquina asociada correctamente', 'success');
            loadMuscleGroups(); // Recargar la lista
        } else {
            throw new Error('Error al asociar máquina');
        }
        
    } catch (error) {
        console.error('Error associating machine:', error);
        showNotification('Error al asociar máquina con grupo', 'error');
    }
}

// ============= ANÁLISIS MEJORADO DE IA =============

// Función para generar análisis mejorado de un usuario
async function generateImprovedAnalysis(userId, muscleGroupId = null) {
    try {
        showLoading('Generando análisis detallado...');
        
        const response = await fetch('/api/ai/analyze-improved', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                userId: userId,
                muscleGroupId: muscleGroupId 
            })
        });
        
        const analysis = await response.json();
        hideLoading();
        
        // Mostrar análisis en modal
        displayAnalysisModal(analysis);
        
    } catch (error) {
        hideLoading();
        console.error('Error generating analysis:', error);
        showNotification('Error al generar análisis', 'error');
    }
}

// Función para mostrar análisis detallado
function displayAnalysisModal(analysis) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content large-modal">
            <div class="modal-header">
                <h3>📊 Análisis Detallado de Progreso</h3>
                <button class="close-modal" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="analysis-summary">
                    <div class="summary-card">
                        <h4>📈 Resumen General</h4>
                        <p><strong>Ejercicios analizados:</strong> ${analysis.summary.totalExercises}</p>
                        <p><strong>Sesiones totales:</strong> ${analysis.summary.totalSessions}</p>
                        <p><strong>Ejercicios en progreso:</strong> ${analysis.summary.averageProgress}</p>
                    </div>
                </div>
                
                <div class="exercises-analysis">
                    <h4>🏋️ Análisis por Ejercicio</h4>
                    ${Object.entries(analysis.analysis).map(([exercise, data]) => `
                        <div class="exercise-analysis-card">
                            <div class="exercise-header">
                                <h5>${data.machine_name}</h5>
                                <span class="trend-indicator ${data.progressTrend}">
                                    ${data.progressTrend === 'improving' ? '📈 Mejorando' : 
                                      data.progressTrend === 'declining' ? '📉 Declinando' : '➡️ Estable'}
                                </span>
                            </div>
                            <div class="exercise-stats">
                                <div class="stat">
                                    <span class="stat-label">Peso Máximo:</span>
                                    <span class="stat-value">${data.maxWeight} kg</span>
                                </div>
                                <div class="stat">
                                    <span class="stat-label">Peso Promedio:</span>
                                    <span class="stat-value">${data.avgWeight.toFixed(1)} kg</span>
                                </div>
                                <div class="stat">
                                    <span class="stat-label">Volumen Total:</span>
                                    <span class="stat-value">${data.totalVolume} kg</span>
                                </div>
                                <div class="stat">
                                    <span class="stat-label">Sesiones:</span>
                                    <span class="stat-value">${data.sessions.length}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Función para generar entrenamiento por grupo muscular
async function generateWorkoutByGroup(userId, muscleGroupId) {
    try {
        showLoading('Generando entrenamiento personalizado...');
        
        const response = await fetch('/api/ai/generate-workout-by-group', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                userId: userId,
                muscleGroupId: muscleGroupId,
                duration: 60
            })
        });
        
        const workout = await response.json();
        hideLoading();
        
        // Mostrar entrenamiento generado
        displayWorkoutModal(workout);
        
    } catch (error) {
        hideLoading();
        console.error('Error generating workout:', error);
        showNotification('Error al generar entrenamiento', 'error');
    }
}

// Función para mostrar entrenamiento generado
function displayWorkoutModal(workout) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>🏋️ Entrenamiento Personalizado</h3>
                <button class="close-modal" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="workout-info">
                    <p><strong>Duración estimada:</strong> ${workout.estimated_duration} minutos</p>
                    <p><strong>Ejercicios:</strong> ${workout.exercises.length}</p>
                </div>
                
                <div class="workout-exercises">
                    ${workout.exercises.map((exercise, index) => `
                        <div class="workout-exercise ${exercise.is_primary ? 'primary-exercise' : ''}">
                            <div class="exercise-number">${index + 1}</div>
                            <div class="exercise-details">
                                <h4>${exercise.machine_name}</h4>
                                <div class="exercise-params">
                                    <span class="param">
                                        <i class="fas fa-repeat"></i>
                                        ${exercise.recommended_sets} series
                                    </span>
                                    <span class="param">
                                        <i class="fas fa-times"></i>
                                        ${exercise.recommended_reps} reps
                                    </span>
                                    <span class="param">
                                        <i class="fas fa-weight-hanging"></i>
                                        ${exercise.recommended_weight} kg
                                    </span>
                                </div>
                                <p class="exercise-notes">${exercise.notes}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// ============= FUNCIONES DE UTILIDAD =============

// Función para mostrar notificaciones
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info'}-circle"></i>
        ${message}
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Función para mostrar loading
function showLoading(message = 'Cargando...') {
    const loading = document.createElement('div');
    loading.id = 'loading-overlay';
    loading.className = 'loading-overlay';
    loading.innerHTML = `
        <div class="loading-content">
            <div class="spinner"></div>
            <p>${message}</p>
        </div>
    `;
    
    document.body.appendChild(loading);
}

// Función para ocultar loading
function hideLoading() {
    const loading = document.getElementById('loading-overlay');
    if (loading) {
        loading.remove();
    }
}

// ============= INICIALIZACIÓN =============

// Agregar nueva sección al sidebar (llamar después de cargar el DOM)
function addMuscleGroupsSection() {
    const sidebar = document.querySelector('.sidebar-nav');
    if (sidebar) {
        const newSection = document.createElement('li');
        newSection.className = 'nav-item';
        newSection.setAttribute('data-section', 'muscle-groups');
        newSection.innerHTML = `
            <a href="#"><i class="fas fa-layer-group"></i> Grupos Musculares</a>
        `;
        
        // Insertar después de "Ejercicios"
        const exercisesSection = sidebar.querySelector('[data-section="exercises"]');
        if (exercisesSection) {
            exercisesSection.insertAdjacentElement('afterend', newSection);
        } else {
            sidebar.appendChild(newSection);
        }
    }
}

// Agregar nueva sección de contenido para grupos musculares
function addMuscleGroupsContent() {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        const newSection = document.createElement('section');
        newSection.id = 'muscle-groups-section';
        newSection.className = 'content-section';
        newSection.innerHTML = `
            <div class="section-header">
                <h2>Gestión de Grupos Musculares</h2>
                <div class="section-actions">
                    <button class="btn btn-primary" onclick="loadMuscleGroups()">
                        <i class="fas fa-refresh"></i> Actualizar
                    </button>
                </div>
            </div>
            
            <div class="muscle-groups-grid" id="muscle-groups-container">
                <!-- Los grupos musculares se cargarán aquí -->
            </div>
        `;
        
        mainContent.appendChild(newSection);
    }
}