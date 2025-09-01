// PDF.js configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Application state
let appState = {
    pdfDoc: null,
    currentPage: 1,
    totalPages: 0,
    pageOffset: 0, // Offset for sequential page numbering across multiple PDFs
    scale: 1.2,
    alfajoresData: {},
    currentView: 'categorize',
    filters: {
        marca: '',
        pais: '',
        sabor: '',
        color: '',
        status: ''
    },
    backendUrl: '/api',
    useBackend: true
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    loadSavedData();
    loadDropdownOptions();
    updateStats();
});

function initializeApp() {
    // Navigation buttons
    document.querySelectorAll('.nav-button').forEach(button => {
        button.addEventListener('click', function() {
            switchView(this.dataset.view);
        });
    });

    // PDF controls
    document.getElementById('prev-page').addEventListener('click', () => changePage(-1));
    document.getElementById('next-page').addEventListener('click', () => changePage(1));
    document.getElementById('load-pdf').addEventListener('click', loadPDF);
    document.getElementById('pdf-input').addEventListener('change', handlePDFFile);

    // Form handling
    document.getElementById('categorization-form').addEventListener('submit', saveCategorization);
    document.getElementById('skip-button').addEventListener('click', skipPage);

    // Action buttons
    document.getElementById('export-data').addEventListener('click', exportData);
    document.getElementById('clear-data').addEventListener('click', clearAllData);

    // Filters
    document.querySelectorAll('.filter-select').forEach(select => {
        select.addEventListener('change', applyFilters);
    });

    // Modal
    document.querySelector('.modal-close').addEventListener('click', closeModal);
    document.getElementById('item-modal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });

    // View toggles
    document.querySelectorAll('.view-toggle').forEach(toggle => {
        toggle.addEventListener('click', function() {
            toggleBrowseView(this.dataset.viewType);
        });
    });

    // Try to load the existing PDF if it exists
    tryLoadExistingPDF();
}

function switchView(viewName) {
    // Update navigation
    document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

    // Update views
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.getElementById(`${viewName}-view`).classList.add('active');

    appState.currentView = viewName;

    // Load specific view data
    if (viewName === 'browse') {
        loadBrowseView();
    } else if (viewName === 'stats') {
        loadStatsView();
    }
}

function loadPDF() {
    document.getElementById('pdf-input').click();
}

function handlePDFFile(event) {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
        showLoading(true);
        
        // If using backend, upload PDF to server
        if (appState.useBackend) {
            uploadPDFToBackend(file);
        } else {
            // Fallback to client-side processing
            processPDFClientSide(file);
        }
    }
}

async function uploadPDFToBackend(file) {
    try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${appState.backendUrl}/upload-pdf`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        // Get next available page before loading PDF
        const nextPageResponse = await fetch(`${appState.backendUrl}/alfajores/next-page`);
        let startPage = 1;
        
        if (nextPageResponse.ok) {
            const nextPageData = await nextPageResponse.json();
            startPage = nextPageData.next_page;
            console.log(`🎯 Empezando nuevo PDF desde página: ${startPage}`);
        }
        
        // Now load the PDF for client-side rendering
        const fileReader = new FileReader();
        fileReader.onload = function() {
            const typedarray = new Uint8Array(this.result);
            
            pdfjsLib.getDocument(typedarray).promise.then(function(pdf) {
                appState.pdfDoc = pdf;
                appState.totalPages = pdf.numPages;
                // Set page offset for sequential numbering
                appState.pageOffset = startPage - 1;
                appState.currentPage = 1; // Still 1 for PDF display, but will map to startPage for data
                
                document.getElementById('total-pages').textContent = appState.totalPages;
                updatePageControls();
                renderPage(appState.currentPage);
                showLoading(false);
                
                // Hide placeholder and show PDF viewer
                document.getElementById('pdf-placeholder').style.display = 'none';
                
                // Load existing data for current page
                loadPageData();
                
                // Update stats
                updateStats();
                
                showSuccess(`PDF procesado exitosamente! ${result.extracted_pages} páginas extraídas. Empezando desde página ${startPage}.`);
            }).catch(function(error) {
                console.error('Error rendering PDF:', error);
                showError('Error al renderizar el PDF.');
                showLoading(false);
            });
        };
        
        fileReader.readAsArrayBuffer(file);
        
    } catch (error) {
        console.error('Error uploading PDF:', error);
        showError(`Error al subir el PDF: ${error.message}`);
        showLoading(false);
        
        // Fallback to client-side processing
        processPDFClientSide(file);
    }
}

function processPDFClientSide(file) {
    const fileReader = new FileReader();
    
    fileReader.onload = function() {
        const typedarray = new Uint8Array(this.result);
        
        pdfjsLib.getDocument(typedarray).promise.then(function(pdf) {
            appState.pdfDoc = pdf;
            appState.totalPages = pdf.numPages;
            appState.currentPage = 1;
            
            document.getElementById('total-pages').textContent = appState.totalPages;
            updatePageControls();
            renderPage(appState.currentPage);
            showLoading(false);
            
            // Hide placeholder and show PDF viewer
            document.getElementById('pdf-placeholder').style.display = 'none';
            
            // Load existing data for current page
            loadPageData();
            
            // Update stats
            updateStats();
        }).catch(function(error) {
            console.error('Error loading PDF:', error);
            showError('Error al cargar el PDF. Por favor, intenta con otro archivo.');
            showLoading(false);
        });
    };
    
    fileReader.readAsArrayBuffer(file);
}

function tryLoadExistingPDF() {
    // Check if the original PDF exists and try to load it
    const pdfPath = './Adobe Scan Aug 29, 2025.pdf';
    
    fetch(pdfPath)
        .then(response => {
            if (response.ok) {
                return response.arrayBuffer();
            }
            throw new Error('PDF not found');
        })
        .then(arrayBuffer => {
            const typedarray = new Uint8Array(arrayBuffer);
            
            pdfjsLib.getDocument(typedarray).promise.then(function(pdf) {
                appState.pdfDoc = pdf;
                appState.totalPages = pdf.numPages;
                appState.currentPage = 1;
                
                document.getElementById('total-pages').textContent = appState.totalPages;
                updatePageControls();
                renderPage(appState.currentPage);
                
                // Hide placeholder
                document.getElementById('pdf-placeholder').style.display = 'none';
                
                // Load existing data for current page
                loadPageData();
                
                // Update stats
                updateStats();
            });
        })
        .catch(error => {
            console.log('Original PDF not found, user will need to upload manually');
            // This is expected, show the placeholder
        });
}

function showLoading(show) {
    document.getElementById('loading-spinner').style.display = show ? 'flex' : 'none';
}

function showError(message) {
    alert(message); // In a real app, you'd use a proper notification system
}

function renderPage(pageNum) {
    if (!appState.pdfDoc) return;
    
    showLoading(true);
    
    appState.pdfDoc.getPage(pageNum).then(function(page) {
        const canvas = document.getElementById('pdf-canvas');
        const ctx = canvas.getContext('2d');
        
        const viewport = page.getViewport({ scale: appState.scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        
        page.render(renderContext).promise.then(function() {
            showLoading(false);
        });
    });
}

function changePage(direction) {
    const newPage = appState.currentPage + direction;
    
    if (newPage >= 1 && newPage <= appState.totalPages) {
        appState.currentPage = newPage;
        document.getElementById('current-page').textContent = appState.currentPage;
        updatePageControls();
        renderPage(appState.currentPage);
        loadPageData();
    }
}

function updatePageControls() {
    const actualPageNumber = appState.currentPage + (appState.pageOffset || 0);
    document.getElementById('current-page').textContent = `${appState.currentPage} (DB: ${actualPageNumber})`;
    document.getElementById('prev-page').disabled = appState.currentPage <= 1;
    document.getElementById('next-page').disabled = appState.currentPage >= appState.totalPages;
}

async function loadPageData() {
    const form = document.getElementById('categorization-form');
    
    if (appState.useBackend) {
        try {
            const actualPageNumber = appState.currentPage + (appState.pageOffset || 0);
            const response = await fetch(`${appState.backendUrl}/alfajores/${actualPageNumber}`);
            
            if (response.ok) {
                const alfajor = await response.json();
                
                // Populate form with existing data
                Object.keys(alfajor).forEach(key => {
                    const element = form.querySelector(`[name="${key}"]`);
                    if (element && alfajor[key] !== null) {
                        element.value = alfajor[key];
                    }
                });
                
                // Store in local state for consistency
                appState.alfajoresData[appState.currentPage] = alfajor;
            } else if (response.status === 404) {
                // No data for this page, clear form
                form.reset();
                delete appState.alfajoresData[appState.currentPage];
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.error('Error loading page data:', error);
            // Fallback to localStorage
            loadPageDataFromStorage();
        }
    } else {
        loadPageDataFromStorage();
    }
}

function loadPageDataFromStorage() {
    const pageData = appState.alfajoresData[appState.currentPage];
    const form = document.getElementById('categorization-form');
    
    if (pageData) {
        // Populate form with existing data
        Object.keys(pageData).forEach(key => {
            const element = form.querySelector(`[name="${key}"]`);
            if (element) {
                element.value = pageData[key];
            }
        });
    } else {
        // Clear form for new entry
        form.reset();
    }
}

async function saveCategorization(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
        data[key] = value.trim();
    }
    
    // Add metadata with page offset for sequential numbering
    const actualPageNumber = appState.currentPage + (appState.pageOffset || 0);
    data.page_number = actualPageNumber;
    data.status = 'categorized';
    
    if (appState.useBackend) {
        // Show loading indicator
        showInfo('Guardando alfajor... ⏳');
        
        try {
            // Create AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
           // Check if alfajor already exists to decide between POST (create) or PUT (update)
            const existingAlfajor = appState.alfajoresData[appState.currentPage];
            const isUpdate = existingAlfajor && existingAlfajor.id;
            
            let url, method;
            if (isUpdate) {
                // Update existing alfajor
                url = `${appState.backendUrl}/alfajores/${existingAlfajor.id}`;
                method = 'PUT';
            } else {
                // Create new alfajor
                url = `${appState.backendUrl}/alfajores`;
                method = 'POST';
            }
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            // Update local state - normalize the data structure
            const normalizedAlfajor = {
                ...result.alfajor,
                pageNumber: result.alfajor.page_number
            };
            appState.alfajoresData[appState.currentPage] = normalizedAlfajor;
            
            // Refresh dropdown options with new data
            loadDropdownOptions();
            
            // Show success message
            if (isUpdate) {
                showSuccess('Alfajor actualizado exitosamente!');
            } else {
                showSuccess('Alfajor categorizado exitosamente!');
            }
            
        } catch (error) {
            console.error('Error saving to backend:', error);
            showError(`Error al guardar: ${error.message}`);
            
            // Simplified fallback to localStorage (store minimal data)
            try {
                const minimalData = {
                    pageNumber: data.page_number,
                    marca: data.marca,
                    sabor: data.sabor,
                    pais: data.pais,
                    color: data.color
                };
                localStorage.setItem(`alfajor_${data.page_number}`, JSON.stringify(minimalData));
                showSuccess('Guardado localmente (sin conexión)');
            } catch (storageError) {
                showError('Error al guardar localmente - storage lleno');
            }
            return;
        }
    } else {
        saveCategorization_localStorage(data);
    }
    
    // Update filters and stats
    updateFilters();
    updateStats();
    
    // Move to next page
    if (appState.currentPage < appState.totalPages) {
        changePage(1);
    }
}

function saveCategorization_localStorage(data) {
    // Add localStorage specific metadata
    data.dateAdded = new Date().toISOString();
    
    // Save to state
    appState.alfajoresData[appState.currentPage] = data;
    
    // Save to localStorage
    saveDataToStorage();
    
    // Show success message
    showSuccess('Alfajor categorizado exitosamente!');
}

function skipPage() {
    if (appState.currentPage < appState.totalPages) {
        changePage(1);
    }
}

function showSuccess(message) {
    // Create a temporary success message
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--success-color);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: var(--radius);
        box-shadow: var(--shadow-lg);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

function showInfo(message) {
    // Create a temporary info message
    const infoDiv = document.createElement('div');
    infoDiv.className = 'info-message';
    infoDiv.textContent = message;
    infoDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--primary-color);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: var(--radius);
        box-shadow: var(--shadow-lg);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(infoDiv);
    
    setTimeout(() => {
        infoDiv.remove();
    }, 5000);
}

function saveDataToStorage() {
    localStorage.setItem('alfajoresData', JSON.stringify(appState.alfajoresData));
}

async function loadSavedData() {
    if (appState.useBackend) {
        try {
            // Load all alfajores from backend
            const response = await fetch(`${appState.backendUrl}/alfajores?per_page=1000`);
            
            if (response.ok) {
                const result = await response.json();
                
                // Convert to page-indexed format for compatibility
                appState.alfajoresData = {};
                result.alfajores.forEach(alfajor => {
                    // Normalize the data structure - convert page_number to pageNumber for frontend compatibility
                    const normalizedAlfajor = {
                        ...alfajor,
                        pageNumber: alfajor.page_number
                    };

                    appState.alfajoresData[alfajor.page_number] = normalizedAlfajor;
                });
                
                updateFilters();
            }
        } catch (error) {
            console.error('Error loading data from backend:', error);
            // Fallback to localStorage
            loadSavedDataFromStorage();
        }
    } else {
        loadSavedDataFromStorage();
    }
}

function loadSavedDataFromStorage() {
    const savedData = localStorage.getItem('alfajoresData');
    if (savedData) {
        appState.alfajoresData = JSON.parse(savedData);
        updateFilters();
    }
}

async function loadDropdownOptions() {
    if (appState.useBackend) {
        try {
            const response = await fetch(`${appState.backendUrl}/dropdown-options`);
            
            if (response.ok) {
                const options = await response.json();
                
                // Setup autocomplete for form inputs
                setupAutoComplete('marca', options.marcas);
                setupAutoComplete('sabor', options.sabores);
                setupAutoComplete('pais', options.paises);
                setupAutoComplete('color', options.colores);
                
                // Llenar filtros (mantener como select dropdowns)
                populateFilterSelect('filter-marca', options.marcas);
                populateFilterSelect('filter-pais', options.paises);
                populateFilterSelect('filter-sabor', options.sabores);
                populateFilterSelect('filter-color', options.colores);
                
                console.log('Autocomplete options loaded successfully');
            }
        } catch (error) {
            console.error('Error loading dropdown options:', error);
        }
    }
}

function setupAutoComplete(inputId, options) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    // Remove existing datalist to replace with custom dropdown
    const existingDatalist = input.getAttribute('list');
    if (existingDatalist) {
        const datalist = document.getElementById(existingDatalist);
        if (datalist) datalist.remove();
        input.removeAttribute('list');
    }
    
    // Create dropdown container
    let dropdown = input.parentNode.querySelector('.autocomplete-dropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.className = 'autocomplete-dropdown';
        input.parentNode.style.position = 'relative';
        input.parentNode.appendChild(dropdown);
    }
    
    // Filter and show suggestions
    function showSuggestions(value) {
        dropdown.innerHTML = '';
        dropdown.style.display = 'none';
        
        if (!value || value.length < 1) return;
        
        const filtered = options.filter(option => 
            option.toLowerCase().includes(value.toLowerCase())
        ).slice(0, 8); // Limit to 8 suggestions
        
        if (filtered.length === 0) return;
        
        dropdown.style.display = 'block';
        
        filtered.forEach(option => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.textContent = option;
            
            item.addEventListener('click', () => {
                input.value = option;
                dropdown.style.display = 'none';
                input.focus();
            });
            
            dropdown.appendChild(item);
        });
    }
    
    // Event listeners
    input.addEventListener('input', (e) => {
        showSuggestions(e.target.value);
    });
    
    input.addEventListener('focus', (e) => {
        showSuggestions(e.target.value);
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!input.parentNode.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
    
    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.autocomplete-item');
        let activeItem = dropdown.querySelector('.autocomplete-item.active');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (activeItem) {
                activeItem.classList.remove('active');
                const next = activeItem.nextElementSibling || items[0];
                next.classList.add('active');
            } else if (items.length > 0) {
                items[0].classList.add('active');
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (activeItem) {
                activeItem.classList.remove('active');
                const prev = activeItem.previousElementSibling || items[items.length - 1];
                prev.classList.add('active');
            } else if (items.length > 0) {
                items[items.length - 1].classList.add('active');
            }
        } else if (e.key === 'Enter') {
            if (activeItem) {
                e.preventDefault();
                input.value = activeItem.textContent;
                dropdown.style.display = 'none';
            }
        } else if (e.key === 'Escape') {
            dropdown.style.display = 'none';
        }
    });
}

function populateFilterSelect(selectId, options) {
    const select = document.getElementById(selectId);
    if (select) {
        // Mantener la primera opción (Todos)
        const firstOption = select.firstElementChild;
        select.innerHTML = '';
        select.appendChild(firstOption);
        
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            select.appendChild(optionElement);
        });
    }
}

function updateStats() {
    const totalCount = appState.totalPages || 0;
    const categorizedCount = Object.keys(appState.alfajoresData).length;
    
    document.getElementById('total-count').textContent = totalCount;
    document.getElementById('categorized-count').textContent = categorizedCount;
}

function updateFilters() {
    const data = Object.values(appState.alfajoresData);
    
    // Get unique values for each filter
    const marcas = [...new Set(data.map(item => item.marca).filter(Boolean))].sort();
    const paises = [...new Set(data.map(item => item.pais).filter(Boolean))].sort();
    const sabores = [...new Set(data.map(item => item.sabor).filter(Boolean))].sort();
    
    // Update filter dropdowns
    updateFilterOptions('filter-marca', marcas);
    updateFilterOptions('filter-pais', paises);
    updateFilterOptions('filter-sabor', sabores);
}

function updateFilterOptions(selectId, options) {
    const select = document.getElementById(selectId);
    const currentValue = select.value;
    
    // Clear existing options except the first one
    while (select.children.length > 1) {
        select.removeChild(select.lastChild);
    }
    
    // Add new options
    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        select.appendChild(optionElement);
    });
    
    // Restore previous selection if still valid
    if (options.includes(currentValue)) {
        select.value = currentValue;
    }
}

function applyFilters() {
    appState.filters = {
        marca: document.getElementById('filter-marca').value,
        pais: document.getElementById('filter-pais').value,
        sabor: document.getElementById('filter-sabor').value,
        color: document.getElementById('filter-color').value,
        status: document.getElementById('filter-status').value
    };
    
    if (appState.currentView === 'browse') {
        loadBrowseView();
    }
}

function loadBrowseView() {
    const container = document.getElementById('browse-grid');
    container.innerHTML = '';
    
    const filteredData = getFilteredData();
    
    if (filteredData.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--gray-500);">
                <i class="fas fa-search" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                <h3>No se encontraron alfajores</h3>
                <p>Intenta ajustar los filtros o agregar más datos.</p>
            </div>
        `;
        return;
    }
    
    filteredData.forEach(item => {

        const itemElement = createBrowseItem(item);
        container.appendChild(itemElement);
    });
}

function getFilteredData() {
    let data = Object.values(appState.alfajoresData);

    
    // Apply filters
    if (appState.filters.marca) {
        data = data.filter(item => item.marca === appState.filters.marca);
    }
    if (appState.filters.pais) {
        data = data.filter(item => item.pais === appState.filters.pais);
    }
    if (appState.filters.sabor) {
        data = data.filter(item => item.sabor === appState.filters.sabor);
    }
    if (appState.filters.color) {
        data = data.filter(item => item.color === appState.filters.color);
    }
    if (appState.filters.status === 'categorized') {
        data = data.filter(item => item.status === 'categorized');
    } else if (appState.filters.status === 'uncategorized') {
        // Add uncategorized pages
        for (let i = 1; i <= appState.totalPages; i++) {
            if (!appState.alfajoresData[i]) {
                data.push({
                    pageNumber: i,
                    status: 'uncategorized',
                    marca: 'Sin categorizar',
                    sabor: 'Sin categorizar',
                    pais: 'Sin categorizar'
                });
            }
        }
        data = data.filter(item => item.status === 'uncategorized');
    }
    
    return data.sort((a, b) => a.pageNumber - b.pageNumber);
}

function createBrowseItem(item) {
    const div = document.createElement('div');
    div.className = 'browse-item';
    
    const statusClass = item.status === 'categorized' ? 'categorized' : 'uncategorized';
    
    // Determine image source
    let imageContent;
    if (item.image_filename && item.status === 'categorized') {
        imageContent = `<img src="/api/images/${item.image_filename}" alt="Alfajor página ${item.pageNumber}" loading="lazy">`;
    } else {
        imageContent = `<i class="fas fa-cookie-bite"></i>`;
    }
    
    // Add click events after creating the element to avoid JSON parsing issues
    div.innerHTML = `
        <div class="browse-item-image">
            ${imageContent}
        </div>
        <div class="browse-item-content">
            <div class="browse-item-header">
                <div class="browse-item-title">
                    ${item.marca || 'Sin marca'} - ${item.sabor || 'Sin sabor'}
                    <span class="status-badge ${statusClass}">
                        ${item.status === 'categorized' ? 'Categorizado' : 'Sin categorizar'}
                    </span>
                </div>
                ${item.status === 'categorized' ? `
                    <button class="delete-btn" title="Eliminar categorización">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : ''}
            </div>
            <div class="browse-item-meta">
                <span><strong>Página:</strong> ${item.pageNumber}</span>
                <span><strong>País:</strong> ${item.pais || 'No especificado'}</span>
                ${item.color ? `<span><strong>Color:</strong> ${item.color}</span>` : ''}
                ${item.notas ? `<span><strong>Notas:</strong> ${item.notas.substring(0, 30)}${item.notas.length > 30 ? '...' : ''}</span>` : ''}
            </div>
        </div>
    `;
    
    // Add event listeners
    const imageEl = div.querySelector('.browse-item-image');
    const titleEl = div.querySelector('.browse-item-title');
    const deleteBtn = div.querySelector('.delete-btn');
    
    if (imageEl) {
        imageEl.addEventListener('click', () => openItemModal(item));
    }
    
    if (titleEl) {
        titleEl.addEventListener('click', () => openItemModal(item));
    }
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (event) => {

            deleteAlfajor(item.pageNumber, event);
        });
    }
    
    return div;
}

function openItemModal(item) {
    const modal = document.getElementById('item-modal');
    const modalBody = modal.querySelector('.modal-body');
    
    // Create image section
    let imageSection = '';
    if (item.image_filename && item.status === 'categorized') {
        imageSection = `
            <div class="modal-item-image">
                <img src="/api/images/${item.image_filename}" alt="Alfajor página ${item.pageNumber}" />
            </div>
        `;
    }
    
    modalBody.innerHTML = `
        <div class="modal-item-details">
            <div class="modal-item-header">
                <h4>${item.marca || 'Sin marca'} - ${item.sabor || 'Sin sabor'}</h4>
                <span class="status-badge ${item.status === 'categorized' ? 'categorized' : 'uncategorized'}">
                    ${item.status === 'categorized' ? 'Categorizado' : 'Sin categorizar'}
                </span>
            </div>
            
            ${imageSection}
            
            <div class="modal-item-grid">
                <div class="modal-item-field">
                    <strong>Página:</strong> ${item.pageNumber}
                </div>
                <div class="modal-item-field">
                    <strong>Marca:</strong> ${item.marca || 'No especificada'}
                </div>
                <div class="modal-item-field">
                    <strong>Sabor:</strong> ${item.sabor || 'No especificado'}
                </div>
                <div class="modal-item-field">
                    <strong>País:</strong> ${item.pais || 'No especificado'}
                </div>
                ${item.color ? `<div class="modal-item-field"><strong>Color:</strong> ${item.color}</div>` : ''}
                ${item.notas ? `<div class="modal-item-field modal-item-notes"><strong>Notas:</strong><br>${item.notas}</div>` : ''}
            </div>
            
            <div class="modal-actions">
                <button class="submit-button" onclick="goToPage(${item.pageNumber})">
                    <i class="fas fa-eye"></i>
                    Ver en PDF
                </button>
                ${item.status === 'categorized' ? `
                    <button class="action-button" onclick="editItem(${item.pageNumber})">
                        <i class="fas fa-edit"></i>
                        Editar
                    </button>
                    <button class="delete-button" data-page-number="${item.pageNumber}">
                        <i class="fas fa-trash"></i>
                        Eliminar
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    
    // Add event listener for delete button in modal
    const deleteButton = modal.querySelector('.delete-button');
    if (deleteButton) {
        deleteButton.addEventListener('click', async (event) => {
            const pageNumber = parseInt(deleteButton.getAttribute('data-page-number'));

            await deleteAlfajor(pageNumber, event);
            closeModal();
        });
    }
    
    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('item-modal').classList.remove('active');
}

function goToPage(pageNumber) {
    appState.currentPage = pageNumber;
    renderPage(pageNumber);
    updatePageControls();
    loadPageData();
    switchView('categorize');
    closeModal();
}

function editItem(pageNumber) {
    goToPage(pageNumber);
    closeModal();
}

async function deleteAlfajor(pageNumber, event) {
    // Prevent event bubbling to avoid opening modal
    event.stopPropagation();
    
    if (!confirm(`¿Estás seguro de que quieres eliminar la categorización de la página ${pageNumber}?`)) {
        return;
    }
    
    if (appState.useBackend) {
        try {
            const deleteUrl = `${appState.backendUrl}/alfajores/page/${pageNumber}`;

            const response = await fetch(deleteUrl, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Remove from local state
            delete appState.alfajoresData[pageNumber];
            
            // Refresh dropdown options
            loadDropdownOptions();
            
            // Refresh current view
            if (appState.currentView === 'browse') {
                loadBrowseView();
            }
            
            // Update stats
            updateStats();
            
            showSuccess(`Categorización de página ${pageNumber} eliminada exitosamente!`);
            
        } catch (error) {
            console.error('Error deleting alfajor:', error);
            showError(`Error al eliminar: ${error.message}`);
        }
    } else {
        // localStorage fallback
        delete appState.alfajoresData[pageNumber];
        saveDataToStorage();
        
        if (appState.currentView === 'browse') {
            loadBrowseView();
        }
        
        updateStats();
        showSuccess(`Categorización de página ${pageNumber} eliminada exitosamente!`);
    }
}

function toggleBrowseView(viewType) {
    document.querySelectorAll('.view-toggle').forEach(toggle => toggle.classList.remove('active'));
    document.querySelector(`[data-view-type="${viewType}"]`).classList.add('active');
    
    // In a full implementation, you would change the grid layout here
    // For now, we'll keep the grid view
}

async function loadStatsView() {
    if (appState.useBackend) {
        try {
            const response = await fetch(`${appState.backendUrl}/stats`);
            
            if (response.ok) {
                const stats = await response.json();
                
                // Update stats display with backend data
                updateStatsDisplay('stats-marca', stats.by_marca.map(item => [item.name, item.count]));
                updateStatsDisplay('stats-pais', stats.by_pais.map(item => [item.name, item.count]));
                updateStatsDisplay('stats-sabor', stats.by_sabor.map(item => [item.name, item.count]));
            } else {
                throw new Error('Error loading stats from backend');
            }
        } catch (error) {
            console.error('Error loading stats:', error);
            // Fallback to client-side calculation
            loadStatsViewFromLocal();
        }
    } else {
        loadStatsViewFromLocal();
    }
}

function loadStatsViewFromLocal() {
    const data = Object.values(appState.alfajoresData);
    
    // Calculate stats
    const statsByMarca = calculateStats(data, 'marca');
    const statsByPais = calculateStats(data, 'pais');
    const statsBySabor = calculateStats(data, 'sabor');
    
    // Update stats display
    updateStatsDisplay('stats-marca', statsByMarca);
    updateStatsDisplay('stats-pais', statsByPais);
    updateStatsDisplay('stats-sabor', statsBySabor);
}

function calculateStats(data, field) {
    const stats = {};
    
    data.forEach(item => {
        const value = item[field] || 'No especificado';
        stats[value] = (stats[value] || 0) + 1;
    });
    
    // Convert to array and sort by count
    return Object.entries(stats)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10); // Top 10
}

function updateStatsDisplay(elementId, stats) {
    const container = document.getElementById(elementId);
    
    if (stats.length === 0) {
        container.innerHTML = '<p style="color: var(--gray-500); text-align: center;">Sin datos disponibles</p>';
        return;
    }
    
    container.innerHTML = stats.map(([label, count]) => `
        <div class="stat-item">
            <span class="stat-item-label">${label}</span>
            <span class="stat-item-value">${count}</span>
        </div>
    `).join('');
}

async function exportData() {
    if (appState.useBackend) {
        try {
            const response = await fetch(`${appState.backendUrl}/export`);
            
            if (response.ok) {
                const data = await response.json();
                
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `alfajores-collection-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                URL.revokeObjectURL(url);
                
                showSuccess('Datos exportados exitosamente!');
            } else {
                throw new Error('Error exporting from backend');
            }
        } catch (error) {
            console.error('Error exporting data:', error);
            // Fallback to localStorage export
            exportDataFromStorage();
        }
    } else {
        exportDataFromStorage();
    }
}

function exportDataFromStorage() {
    const data = {
        exportDate: new Date().toISOString(),
        totalPages: appState.totalPages,
        categorizedCount: Object.keys(appState.alfajoresData).length,
        alfajores: appState.alfajoresData
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `alfajores-collection-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    
    showSuccess('Datos exportados exitosamente!');
}

function clearAllData() {
    if (confirm('¿Estás seguro de que quieres eliminar todos los datos? Esta acción no se puede deshacer.')) {
        appState.alfajoresData = {};
        saveDataToStorage();
        updateFilters();
        updateStats();
        loadPageData();
        
        if (appState.currentView === 'browse') {
            loadBrowseView();
        } else if (appState.currentView === 'stats') {
            loadStatsView();
        }
        
        showSuccess('Todos los datos han sido eliminados.');
    }
}

// Add CSS for success animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .modal-item-details {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }
    
    .modal-item-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--gray-200);
    }
    
    .modal-item-header h4 {
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--gray-900);
        margin: 0;
    }
    
    .modal-item-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
    }
    
    .modal-item-field {
        padding: 0.75rem;
        background: var(--gray-50);
        border-radius: var(--radius);
        font-size: 0.875rem;
    }
    
    .modal-item-notes {
        grid-column: 1 / -1;
    }
    
    .modal-actions {
        display: flex;
        gap: 1rem;
        padding-top: 1rem;
        border-top: 1px solid var(--gray-200);
    }
`;
document.head.appendChild(style);
