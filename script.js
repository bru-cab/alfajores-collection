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
    burgersData: {},
    currentView: 'categorize',
    currentCollection: 'alfajores',
    editingBurgerId: null,
    burgerFormImages: [],
    burgerCoverImageId: null,
    filters: {
        marca: '',
        pais: '',
        sabor: '',
        color: '',
        status: '',
        sort: 'page_asc'
    },
    burgerFilters: {
        place: '',
        meatStyle: '',
        bunStyle: '',
        size: ''
    },
    backendUrl: '/api',
    useBackend: true
};

const BURGER_RATING_CONFIG = [
    { key: 'meat', inputId: 'rating-meat', commentId: 'comment-meat', label: 'Carne' },
    { key: 'bun', inputId: 'rating-bun', commentId: 'comment-bun', label: 'Pan' },
    { key: 'toppings', inputId: 'rating-toppings', commentId: 'comment-toppings', label: 'Toppings' },
    { key: 'condiments', inputId: 'rating-condiments', commentId: 'comment-condiments', label: 'Condimentos' },
    { key: 'temperature', inputId: 'rating-temperature', commentId: 'comment-temperature', label: 'Temperatura' },
    { key: 'size', inputId: 'rating-size', commentId: 'comment-size', label: 'Tamaño' },
    { key: 'balance', inputId: 'rating-balance', commentId: 'comment-balance', label: 'Balance general' }
];

const BURGER_IMAGE_MAX_EDGE = 1600;
const BURGER_IMAGE_QUALITY = 0.82;

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    initializeApp();
    bindAlfajorForm();
    await loadBurgerData();
    bindBurgerForm();
    await loadSavedData();
    await loadDropdownOptions();
    updateFilters();
    updateStats();
    switchCollection(appState.currentCollection);
});

function initializeApp() {
    // Navigation buttons
    document.querySelectorAll('.nav-button').forEach(button => {
        button.addEventListener('click', function() {
            switchView(this.dataset.view);
        });
    });

    document.querySelectorAll('.collection-tab').forEach(button => {
        button.addEventListener('click', function() {
            switchCollection(this.dataset.collection);
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
    document.getElementById('export-burgers').addEventListener('click', exportData);
    document.getElementById('clear-burgers').addEventListener('click', clearAllData);
    document.getElementById('new-burger-review').addEventListener('click', () => {
        switchCollection('burgers');
        switchView('categorize');
        resetBurgerForm();
    });

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

function bindBurgerForm() {
    const burgerForm = document.getElementById('burger-form');
    if (burgerForm) {
        burgerForm.addEventListener('submit', saveBurgerReview);
    }

    document.getElementById('reset-burger-button').addEventListener('click', resetBurgerForm);

    const imageInput = document.getElementById('burger-images');
    if (imageInput) {
        imageInput.addEventListener('change', handleBurgerImagesSelected);
    }

    const imagesPreview = document.getElementById('burger-images-preview');
    if (imagesPreview) {
        imagesPreview.addEventListener('click', handleBurgerImagesPreviewClick);
    }

    [
        'burger-name',
        'burger-place',
        ...BURGER_RATING_CONFIG.map(field => field.inputId)
    ].forEach(id => {
        const element = document.getElementById(id);
        if (!element) return;

        element.addEventListener('input', updateBurgerPreview);
        element.addEventListener('change', updateBurgerPreview);
    });

    renderBurgerImagePicker();
    updateBurgerPreview();
}

function bindAlfajorForm() {
    [
        'rating-tapa',
        'rating-relleno',
        'rating-sabor-general',
        'rating-tamano'
    ].forEach(id => {
        const element = document.getElementById(id);
        if (!element) return;

        element.addEventListener('input', updateAlfajorRatingPreview);
        element.addEventListener('change', updateAlfajorRatingPreview);
    });

    updateAlfajorRatingPreview();
}

const ALFAJOR_RATING_FIELDS = [
    'rating_tapa',
    'rating_relleno',
    'rating_sabor_general',
    'rating_tamano'
];

function createDefaultBurgerRatings(defaultValue = 7) {
    return BURGER_RATING_CONFIG.reduce((accumulator, field) => {
        accumulator[field.key] = defaultValue;
        return accumulator;
    }, {});
}

function createDefaultBurgerRatingComments() {
    return BURGER_RATING_CONFIG.reduce((accumulator, field) => {
        accumulator[field.key] = '';
        return accumulator;
    }, {});
}

function normalizeBurgerRatings(rawRatings) {
    const defaults = createDefaultBurgerRatings();
    const source = rawRatings && typeof rawRatings === 'object' ? rawRatings : {};

    return BURGER_RATING_CONFIG.reduce((accumulator, field) => {
        const parsed = Number(source[field.key]);
        accumulator[field.key] = Number.isFinite(parsed) && parsed > 0 ? parsed : defaults[field.key];
        return accumulator;
    }, {});
}

function normalizeBurgerRatingComments(rawComments) {
    const defaults = createDefaultBurgerRatingComments();
    const source = rawComments && typeof rawComments === 'object' ? rawComments : {};

    return BURGER_RATING_CONFIG.reduce((accumulator, field) => {
        const value = source[field.key];
        accumulator[field.key] = typeof value === 'string' ? value.trim() : defaults[field.key];
        return accumulator;
    }, {});
}

function generateBurgerImageId(prefix = 'img') {
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${Date.now()}_${randomSuffix}`;
}

function normalizeBurgerImages(rawImages, legacyImage) {
    const sources = [];
    if (Array.isArray(rawImages)) {
        sources.push(...rawImages);
    }
    if (legacyImage) {
        sources.push(legacyImage);
    }

    return sources
        .map((image, index) => {
            if (!image) return null;

            if (typeof image === 'string') {
                const dataUrl = image.trim();
                if (!dataUrl) return null;

                return {
                    id: generateBurgerImageId('legacy'),
                    dataUrl,
                    name: `Imagen ${index + 1}`
                };
            }

            const candidateDataUrl = typeof image.dataUrl === 'string'
                ? image.dataUrl.trim()
                : (typeof image.url === 'string' ? image.url.trim() : '');
            if (!candidateDataUrl) {
                return null;
            }

            return {
                id: typeof image.id === 'string' && image.id ? image.id : generateBurgerImageId('legacy'),
                dataUrl: candidateDataUrl,
                name: typeof image.name === 'string' && image.name.trim() ? image.name.trim() : `Imagen ${index + 1}`
            };
        })
        .filter(Boolean);
}

function resolveBurgerCoverImageId(images, preferredCoverImageId) {
    if (!Array.isArray(images) || images.length === 0) {
        return null;
    }

    if (preferredCoverImageId && images.some(image => image.id === preferredCoverImageId)) {
        return preferredCoverImageId;
    }

    return images[0].id;
}

function normalizeBurgerRecord(record, burgerId = null) {
    if (!record || typeof record !== 'object') {
        return record;
    }

    const normalizedRatings = normalizeBurgerRatings(record.ratings);
    const normalizedImages = normalizeBurgerImages(record.images, record.image);
    const normalizedOverall = Number(record.overallScore);

    return {
        ...record,
        id: record.id || burgerId || `burger_${Date.now()}`,
        ratings: normalizedRatings,
        ratingComments: normalizeBurgerRatingComments(record.ratingComments),
        images: normalizedImages,
        coverImageId: resolveBurgerCoverImageId(normalizedImages, record.coverImageId),
        overallScore: Number.isFinite(normalizedOverall)
            ? Number(normalizedOverall.toFixed(1))
            : Number(calculateBurgerAverage(normalizedRatings).toFixed(1))
    };
}

function getBurgerCoverImage(images, coverImageId) {
    if (!Array.isArray(images) || images.length === 0) {
        return null;
    }

    return images.find(image => image.id === coverImageId) || images[0];
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isStorageQuotaError(error) {
    if (!error) return false;
    return error.name === 'QuotaExceededError'
        || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
        || error.code === 22
        || error.code === 1014;
}

function getBurgerStorageErrorMessage(error) {
    if (isStorageQuotaError(error)) {
        return 'No se pudo guardar: el almacenamiento del navegador está lleno. Probá con menos fotos o fotos más livianas.';
    }
    return 'No se pudo guardar la reseña en este navegador.';
}

function getBurgerSortTimestamp(record) {
    const timestamp = new Date(record?.dateModified || record?.dateAdded || 0).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeBurgerMap(rawData) {
    if (!rawData) return {};

    if (Array.isArray(rawData)) {
        return rawData.reduce((accumulator, record) => {
            if (!record || typeof record !== 'object') return accumulator;
            const burgerId = record.id;
            if (!burgerId) return accumulator;
            const normalizedRecord = normalizeBurgerRecord(record, burgerId);
            if (normalizedRecord) {
                accumulator[burgerId] = normalizedRecord;
            }
            return accumulator;
        }, {});
    }

    if (typeof rawData !== 'object') return {};

    return Object.entries(rawData).reduce((accumulator, [id, record]) => {
        const normalizedRecord = normalizeBurgerRecord(record, id);
        if (normalizedRecord) {
            accumulator[id] = normalizedRecord;
        }
        return accumulator;
    }, {});
}

function mergeBurgerMaps(localMap, remoteMap) {
    const merged = { ...remoteMap };

    Object.entries(localMap).forEach(([id, localRecord]) => {
        const remoteRecord = merged[id];
        if (!remoteRecord) {
            merged[id] = localRecord;
            return;
        }

        if (getBurgerSortTimestamp(localRecord) >= getBurgerSortTimestamp(remoteRecord)) {
            merged[id] = localRecord;
        }
    });

    return merged;
}

function loadBurgerDataFromStorage() {
    const savedData = localStorage.getItem('burgersData');
    if (!savedData) return {};

    try {
        const parsedData = JSON.parse(savedData) || {};
        return normalizeBurgerMap(parsedData);
    } catch (error) {
        console.error('Error loading burger data from storage:', error);
        return {};
    }
}

async function syncBurgerToBackend(burger) {
    if (!appState.useBackend || !burger) return;

    const response = await fetch(`${appState.backendUrl}/burgers`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(burger)
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
}

async function deleteBurgerFromBackend(burgerId) {
    if (!appState.useBackend || !burgerId) return;

    const response = await fetch(`${appState.backendUrl}/burgers/${encodeURIComponent(burgerId)}`, {
        method: 'DELETE'
    });

    if (!response.ok && response.status !== 404) {
        throw new Error(`HTTP ${response.status}`);
    }
}

async function clearBurgersFromBackend() {
    if (!appState.useBackend) return;

    const response = await fetch(`${appState.backendUrl}/burgers`, {
        method: 'DELETE'
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
}

function getActualPageNumber() {
    return appState.currentPage + (appState.pageOffset || 0);
}

function normalizeAlfajorRecord(alfajor) {
    if (!alfajor) return alfajor;

    return {
        ...alfajor,
        pageNumber: alfajor.pageNumber ?? alfajor.page_number ?? null
    };
}

function parseOptionalRating(value) {
    if (value === '' || value === null || value === undefined) {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function getAlfajorRatingsFromForm() {
    return {
        rating_tapa: parseOptionalRating(document.getElementById('rating-tapa')?.value),
        rating_relleno: parseOptionalRating(document.getElementById('rating-relleno')?.value),
        rating_sabor_general: parseOptionalRating(document.getElementById('rating-sabor-general')?.value),
        rating_tamano: parseOptionalRating(document.getElementById('rating-tamano')?.value)
    };
}

function calculateAlfajorAverage(ratings) {
    const values = Object.values(ratings).filter(value => Number.isFinite(value));
    if (values.length !== ALFAJOR_RATING_FIELDS.length) {
        return null;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatAlfajorRating(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(1) : null;
}

function updateAlfajorRatingPreview() {
    const average = calculateAlfajorAverage(getAlfajorRatingsFromForm());
    const ratingOverall = document.getElementById('alfajor-rating-overall');
    if (!ratingOverall) return;

    ratingOverall.textContent = average === null ? '-' : average.toFixed(1);
    ratingOverall.classList.toggle('is-empty', average === null);
}

function getAlfajorPageNumber(item) {
    return Number(item.pageNumber ?? item.page_number ?? 0);
}

function getAlfajorSortDate(item) {
    const rawDate = item.date_modified || item.dateModified || item.date_added || item.dateAdded;
    if (!rawDate) {
        return null;
    }

    const timestamp = new Date(rawDate).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
}

function getAlfajorOverallRating(item) {
    return parseOptionalRating(item.rating_overall);
}

function compareNullableNumbers(left, right, descending = false) {
    if (left === null && right === null) {
        return 0;
    }
    if (left === null) {
        return 1;
    }
    if (right === null) {
        return -1;
    }

    return descending ? right - left : left - right;
}

function sortAlfajorData(data, sortKey) {
    const items = [...data];

    return items.sort((a, b) => {
        if (sortKey === 'page_desc') {
            return getAlfajorPageNumber(b) - getAlfajorPageNumber(a);
        }

        if (sortKey === 'rating_desc' || sortKey === 'rating_asc') {
            const byRating = compareNullableNumbers(
                getAlfajorOverallRating(a),
                getAlfajorOverallRating(b),
                sortKey === 'rating_desc'
            );
            if (byRating !== 0) return byRating;

            const byDate = compareNullableNumbers(getAlfajorSortDate(a), getAlfajorSortDate(b), true);
            if (byDate !== 0) return byDate;

            return getAlfajorPageNumber(a) - getAlfajorPageNumber(b);
        }

        if (sortKey === 'date_desc' || sortKey === 'date_asc') {
            const byDate = compareNullableNumbers(
                getAlfajorSortDate(a),
                getAlfajorSortDate(b),
                sortKey === 'date_desc'
            );
            if (byDate !== 0) return byDate;

            const byRating = compareNullableNumbers(getAlfajorOverallRating(a), getAlfajorOverallRating(b), true);
            if (byRating !== 0) return byRating;

            return getAlfajorPageNumber(a) - getAlfajorPageNumber(b);
        }

        return getAlfajorPageNumber(a) - getAlfajorPageNumber(b);
    });
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

function switchCollection(collectionName) {
    appState.currentCollection = collectionName;

    document.querySelectorAll('.collection-tab').forEach(button => {
        const isActive = button.dataset.collection === collectionName;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    [
        'alfajores-filters',
        'burgers-filters',
        'alfajores-actions',
        'burgers-actions',
        'alfajores-categorize-content',
        'burgers-categorize-content'
    ].forEach(id => {
        const element = document.getElementById(id);
        if (!element) return;
        const isBurgerPanel = id.startsWith('burgers');
        const shouldShow = collectionName === 'burgers' ? isBurgerPanel : !isBurgerPanel;
        element.classList.toggle('active', shouldShow);
    });

    if (collectionName === 'alfajores') {
        document.getElementById('collection-title').innerHTML = '<i class="fas fa-burger"></i> <i class="fas fa-cookie-bite"></i> Smash & Sweet';
        document.getElementById('total-label').textContent = 'Total';
        document.getElementById('categorized-label').textContent = 'Categorizados';
        document.getElementById('browse-title').textContent = 'Explorar Colección';
        document.getElementById('stats-title').textContent = 'Estadísticas de la Colección';
        document.getElementById('item-modal-title').textContent = 'Detalles del Alfajor';
        document.getElementById('stats-card-1-title').textContent = 'Por Marca';
        document.getElementById('stats-card-2-title').textContent = 'Por País';
        document.getElementById('stats-card-3-title').textContent = 'Por Sabor';
    } else {
        document.getElementById('collection-title').innerHTML = '<i class="fas fa-burger"></i> <i class="fas fa-cookie-bite"></i> Smash & Sweet';
        document.getElementById('total-label').textContent = 'Reseñas';
        document.getElementById('categorized-label').textContent = 'Promedio';
        document.getElementById('browse-title').textContent = 'Explorar Burgers';
        document.getElementById('stats-title').textContent = 'Estadísticas de Burgers';
        document.getElementById('item-modal-title').textContent = 'Detalles de la Burger';
        document.getElementById('stats-card-1-title').textContent = 'Por Local';
        document.getElementById('stats-card-2-title').textContent = 'Por Carne';
        document.getElementById('stats-card-3-title').textContent = 'Por Pan';
        updateBurgerPreview();
    }

    updateStats();

    if (appState.currentView === 'browse') {
        loadBrowseView();
    } else if (appState.currentView === 'stats') {
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
    const actualPageNumber = getActualPageNumber();
    
    if (appState.useBackend) {
        try {
            const response = await fetch(`${appState.backendUrl}/alfajores/${actualPageNumber}`);
            
            if (response.ok) {
                const alfajor = normalizeAlfajorRecord(await response.json());
                form.reset();
                
                // Populate form with existing data
                Object.keys(alfajor).forEach(key => {
                    const element = form.querySelector(`[name="${key}"]`);
                    if (element && alfajor[key] !== null) {
                        element.value = alfajor[key];
                    }
                });
                
                // Store in local state for consistency
                appState.alfajoresData[actualPageNumber] = alfajor;
                updateAlfajorRatingPreview();
            } else if (response.status === 404) {
                // No data for this page, clear form
                form.reset();
                delete appState.alfajoresData[actualPageNumber];
                updateAlfajorRatingPreview();
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
    const actualPageNumber = getActualPageNumber();
    const pageData = appState.alfajoresData[actualPageNumber];
    const form = document.getElementById('categorization-form');
    form.reset();
    
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

    updateAlfajorRatingPreview();
}

async function saveCategorization(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
        data[key] = value.trim();
    }
    
    // Add metadata with page offset for sequential numbering
    const actualPageNumber = getActualPageNumber();
    data.page_number = actualPageNumber;
    data.status = 'categorized';

    const ratings = getAlfajorRatingsFromForm();
    const filledRatings = Object.values(ratings).filter(value => value !== null).length;
    if (filledRatings > 0 && filledRatings < ALFAJOR_RATING_FIELDS.length) {
        showError('Completá los cuatro puntajes o dejalos todos vacíos.');
        return;
    }

    ALFAJOR_RATING_FIELDS.forEach(field => {
        data[field] = ratings[field];
    });

    const overallRating = calculateAlfajorAverage(ratings);
    data.rating_overall = overallRating === null ? null : Number(overallRating.toFixed(2));
    
    if (appState.useBackend) {
        // Show loading indicator
        showInfo('Guardando alfajor... ⏳');
        
        try {
            // Create AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
           
           // Check if alfajor already exists to decide between POST (create) or PUT (update)
            const existingAlfajor = appState.alfajoresData[actualPageNumber];
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
                ...normalizeAlfajorRecord(result.alfajor)
            };
            appState.alfajoresData[actualPageNumber] = normalizedAlfajor;
            
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
            
            try {
                saveCategorization_localStorage(data);
                showSuccess('Guardado localmente (sin conexión)');
            } catch (storageError) {
                showError('Error al guardar localmente - storage lleno');
            }
            return;
        }
    } else {
        saveCategorization_localStorage(data);
        showSuccess('Alfajor categorizado exitosamente!');
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
    const actualPageNumber = Number(data.page_number || getActualPageNumber());
    const existingAlfajor = appState.alfajoresData[actualPageNumber];
    const now = new Date().toISOString();

    const normalizedAlfajor = normalizeAlfajorRecord({
        ...existingAlfajor,
        ...data,
        page_number: actualPageNumber,
        date_added: existingAlfajor?.date_added || now,
        date_modified: now
    });

    appState.alfajoresData[actualPageNumber] = normalizedAlfajor;
    saveDataToStorage();
}

async function saveBurgerReview(event) {
    event.preventDefault();

    const getValue = (id) => {
        const element = document.getElementById(id);
        return element ? element.value.trim() : '';
    };
    const ratings = getBurgerRatingsFromForm();
    const ratingComments = getBurgerRatingCommentsFromForm();
    const overallScore = Number(calculateBurgerAverage(ratings).toFixed(1));
    const now = new Date().toISOString();
    const existingBurger = appState.editingBurgerId ? appState.burgersData[appState.editingBurgerId] : null;
    const burgerId = appState.editingBurgerId || `burger_${Date.now()}`;

    const images = appState.burgerFormImages.map(image => ({ ...image }));
    const coverImageId = resolveBurgerCoverImageId(images, appState.burgerCoverImageId);

    appState.burgersData[burgerId] = normalizeBurgerRecord({
        ...existingBurger,
        id: burgerId,
        name: getValue('burger-name'),
        place: getValue('burger-place'),
        location: getValue('burger-location'),
        meatStyle: getValue('burger-meat-style'),
        bunStyle: getValue('burger-bun-style'),
        toppings: getValue('burger-toppings'),
        size: getValue('burger-size'),
        ratings,
        ratingComments,
        images,
        coverImageId,
        overallScore,
        status: 'reviewed',
        dateAdded: existingBurger?.dateAdded || now,
        dateModified: now
    }, burgerId);

    try {
        saveBurgersToStorage();
    } catch (error) {
        console.error('Error saving burger data to storage:', error);
        showError(getBurgerStorageErrorMessage(error));
        return;
    }

    if (appState.useBackend) {
        try {
            await syncBurgerToBackend(appState.burgersData[burgerId]);
        } catch (error) {
            console.error('Error syncing burger to backend:', error);
            showInfo('La reseña se guardó en este navegador, pero no se pudo sincronizar al servidor.');
        }
    }
    updateFilters();
    updateStats();

    if (appState.currentView === 'browse') {
        loadBrowseView();
    } else if (appState.currentView === 'stats') {
        loadStatsView();
    }

    showSuccess(existingBurger ? 'Burger actualizada exitosamente!' : 'Burger guardada exitosamente!');
    resetBurgerForm();
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

async function loadBurgerData() {
    const localMap = loadBurgerDataFromStorage();

    if (!appState.useBackend) {
        appState.burgersData = localMap;
        return;
    }

    try {
        const response = await fetch(`${appState.backendUrl}/burgers`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        const remoteMap = normalizeBurgerMap(payload?.burgers || []);
        appState.burgersData = mergeBurgerMaps(localMap, remoteMap);

        const pendingSync = Object.entries(localMap)
            .filter(([id, localRecord]) => {
                const remoteRecord = remoteMap[id];
                return !remoteRecord || getBurgerSortTimestamp(localRecord) > getBurgerSortTimestamp(remoteRecord);
            })
            .map(([, localRecord]) => localRecord);

        try {
            saveBurgersToStorage();
        } catch (storageError) {
            console.error('Error syncing merged burger data to local storage:', storageError);
        }

        if (pendingSync.length > 0) {
            Promise.allSettled(pendingSync.map(record => syncBurgerToBackend(record)))
                .then(results => {
                    const failed = results.filter(result => result.status === 'rejected');
                    if (failed.length > 0) {
                        console.error('Some burger records could not be synced to backend:', failed);
                    }
                });
        }
    } catch (error) {
        console.error('Error loading burger data from backend:', error);
        appState.burgersData = localMap;
    }
}

function saveBurgersToStorage() {
    localStorage.setItem('burgersData', JSON.stringify(appState.burgersData));
}

function getBurgerRatingsFromForm() {
    const parseRating = (id) => {
        const element = document.getElementById(id);
        const value = Number(element ? element.value : 7);
        return Number.isFinite(value) && value > 0 ? value : 7;
    };

    return BURGER_RATING_CONFIG.reduce((accumulator, field) => {
        accumulator[field.key] = parseRating(field.inputId);
        return accumulator;
    }, {});
}

function getBurgerRatingCommentsFromForm() {
    return BURGER_RATING_CONFIG.reduce((accumulator, field) => {
        const commentElement = document.getElementById(field.commentId);
        accumulator[field.key] = commentElement ? commentElement.value.trim() : '';
        return accumulator;
    }, {});
}

function calculateBurgerAverage(ratings) {
    const values = Object.values(ratings).map(Number);
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getBurgerScoreSummary(score) {
    if (score >= 9) {
        return 'Nivel candidato al podio: todo está jugando a favor.';
    }
    if (score >= 8) {
        return 'Muy sólida: tiene varios puntos fuertes y se nota el equilibrio.';
    }
    if (score >= 7) {
        return 'Un promedio equilibrado para una burger prometedora.';
    }
    if (score >= 6) {
        return 'Cumple bien, pero todavía hay margen para afinar el conjunto.';
    }
    return 'Hay potencial, aunque la ejecución general podría mejorar bastante.';
}

function updateBurgerPreview() {
    const ratings = getBurgerRatingsFromForm();
    const average = calculateBurgerAverage(ratings);
    const burgerName = document.getElementById('burger-name').value.trim();
    const burgerPlace = document.getElementById('burger-place').value.trim();
    const coverImage = getBurgerCoverImage(appState.burgerFormImages, appState.burgerCoverImageId);

    document.getElementById('burger-preview-name').textContent = burgerName || 'Nueva burger';
    document.getElementById('burger-preview-place').textContent = burgerPlace || 'Cargá una reseña para ver el promedio en vivo.';

    BURGER_RATING_CONFIG.forEach(field => {
        const scoreElement = document.getElementById(`burger-score-${field.key}`);
        if (scoreElement) {
            scoreElement.textContent = ratings[field.key];
        }
    });

    const previewMedia = document.querySelector('.burger-preview-media');
    if (previewMedia) {
        previewMedia.innerHTML = coverImage
            ? `<img src="${coverImage.dataUrl}" alt="Portada de burger" loading="lazy">`
            : '<i class="fas fa-burger" aria-hidden="true"></i>';
    }

    document.getElementById('burger-average-score').textContent = average.toFixed(1);
    document.getElementById('burger-average-bar').style.width = `${(average / 10) * 100}%`;
    document.getElementById('burger-rating-overall').textContent = average.toFixed(1);
    document.getElementById('burger-score-summary').textContent = getBurgerScoreSummary(average);
}

async function readBurgerImageAsDataUrl(file) {
    const objectUrl = URL.createObjectURL(file);
    const imageElement = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('No se pudo procesar una de las imágenes.'));
        img.src = objectUrl;
    });

    try {
        let targetWidth = imageElement.width;
        let targetHeight = imageElement.height;
        const maxEdge = Math.max(targetWidth, targetHeight);
        if (maxEdge > BURGER_IMAGE_MAX_EDGE) {
            const scale = BURGER_IMAGE_MAX_EDGE / maxEdge;
            targetWidth = Math.max(1, Math.round(targetWidth * scale));
            targetHeight = Math.max(1, Math.round(targetHeight * scale));
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('No se pudo preparar el editor de imágenes del navegador.');
        }

        context.drawImage(imageElement, 0, 0, targetWidth, targetHeight);

        const dataUrl = canvas.toDataURL('image/jpeg', BURGER_IMAGE_QUALITY);
        return {
            id: generateBurgerImageId(),
            name: file.name || 'Imagen',
            dataUrl
        };
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

async function handleBurgerImagesSelected(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (!imageFiles.length) {
        showError('Seleccioná archivos de imagen válidos.');
        event.target.value = '';
        return;
    }

    if (imageFiles.length !== files.length) {
        showInfo('Se ignoraron archivos que no eran imágenes.');
    }

    try {
        const loadedImages = await Promise.all(imageFiles.map(readBurgerImageAsDataUrl));
        appState.burgerFormImages = [...appState.burgerFormImages, ...loadedImages];
        appState.burgerCoverImageId = resolveBurgerCoverImageId(appState.burgerFormImages, appState.burgerCoverImageId);
        renderBurgerImagePicker();
        updateBurgerPreview();
    } catch (error) {
        console.error('Error loading burger images:', error);
        showError(error.message || 'No se pudieron cargar las imágenes.');
    } finally {
        event.target.value = '';
    }
}

function handleBurgerImagesPreviewClick(event) {
    const actionButton = event.target.closest('[data-image-action]');
    if (!actionButton) return;

    const action = actionButton.dataset.imageAction;
    const imageId = actionButton.dataset.imageId;
    if (!imageId) return;

    if (action === 'set-cover') {
        appState.burgerCoverImageId = imageId;
    } else if (action === 'remove') {
        appState.burgerFormImages = appState.burgerFormImages.filter(image => image.id !== imageId);
        appState.burgerCoverImageId = resolveBurgerCoverImageId(appState.burgerFormImages, appState.burgerCoverImageId);
    } else {
        return;
    }

    renderBurgerImagePicker();
    updateBurgerPreview();
}

function renderBurgerImagePicker() {
    const container = document.getElementById('burger-images-preview');
    if (!container) return;

    if (!appState.burgerFormImages.length) {
        container.innerHTML = '<p class="burger-images-empty">Todavía no hay imágenes cargadas.</p>';
        return;
    }

    container.innerHTML = appState.burgerFormImages.map((image, index) => {
        const isCover = image.id === appState.burgerCoverImageId;
        const displayName = image.name || `Imagen ${index + 1}`;
        return `
            <div class="burger-image-item ${isCover ? 'is-cover' : ''}">
                <img src="${image.dataUrl}" alt="${escapeHtml(displayName)}" loading="lazy">
                <div class="burger-image-item-meta">
                    <span title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</span>
                </div>
                <div class="burger-image-item-actions">
                    <button type="button" class="burger-image-action ${isCover ? 'active' : ''}" data-image-action="set-cover" data-image-id="${image.id}">
                        ${isCover ? 'Portada' : 'Usar portada'}
                    </button>
                    <button type="button" class="burger-image-action danger" data-image-action="remove" data-image-id="${image.id}">
                        Quitar
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function resetBurgerForm() {
    const form = document.getElementById('burger-form');
    form.reset();
    appState.editingBurgerId = null;
    appState.burgerFormImages = [];
    appState.burgerCoverImageId = null;
    document.getElementById('burger-submit-button').innerHTML = `
        <i class="fas fa-save"></i>
        Guardar reseña
    `;
    renderBurgerImagePicker();
    updateBurgerPreview();
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
                    const normalizedAlfajor = normalizeAlfajorRecord(alfajor);
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
        const parsed = JSON.parse(savedData);
        appState.alfajoresData = Object.fromEntries(
            Object.entries(parsed).map(([key, value]) => [key, normalizeAlfajorRecord(value)])
        );
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
    if (appState.currentCollection === 'burgers') {
        const burgers = Object.values(appState.burgersData);
        const averageScore = burgers.length
            ? burgers.reduce((sum, item) => sum + Number(item.overallScore || 0), 0) / burgers.length
            : 0;

        document.getElementById('total-count').textContent = burgers.length;
        document.getElementById('categorized-count').textContent = averageScore.toFixed(1);
        return;
    }

    const totalCount = appState.totalPages || Object.keys(appState.alfajoresData).length || 0;
    const categorizedCount = Object.keys(appState.alfajoresData).length;

    document.getElementById('total-count').textContent = totalCount;
    document.getElementById('categorized-count').textContent = categorizedCount;
}

function updateFilters() {
    const alfajorData = Object.values(appState.alfajoresData);
    const marcas = [...new Set(alfajorData.map(item => item.marca).filter(Boolean))].sort();
    const paises = [...new Set(alfajorData.map(item => item.pais).filter(Boolean))].sort();
    const sabores = [...new Set(alfajorData.map(item => item.sabor).filter(Boolean))].sort();
    const colores = [...new Set(alfajorData.map(item => item.color).filter(Boolean))].sort();

    updateFilterOptions('filter-marca', marcas);
    updateFilterOptions('filter-pais', paises);
    updateFilterOptions('filter-sabor', sabores);
    updateFilterOptions('filter-color', colores);

    const burgerData = Object.values(appState.burgersData);
    const places = [...new Set(burgerData.map(item => item.place).filter(Boolean))].sort();
    const meats = [...new Set(burgerData.map(item => item.meatStyle).filter(Boolean))].sort();
    const buns = [...new Set(burgerData.map(item => item.bunStyle).filter(Boolean))].sort();
    const sizes = [...new Set(burgerData.map(item => item.size).filter(Boolean))].sort();

    updateFilterOptions('filter-burger-place', places);
    updateFilterOptions('filter-burger-meat', meats);
    updateFilterOptions('filter-burger-bun', buns);
    updateFilterOptions('filter-burger-size', sizes);
}

function updateFilterOptions(selectId, options) {
    const select = document.getElementById(selectId);
    if (!select) return;

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
    if (appState.currentCollection === 'burgers') {
        appState.burgerFilters = {
            place: document.getElementById('filter-burger-place').value,
            meatStyle: document.getElementById('filter-burger-meat').value,
            bunStyle: document.getElementById('filter-burger-bun').value,
            size: document.getElementById('filter-burger-size').value
        };
    } else {
        appState.filters = {
            marca: document.getElementById('filter-marca').value,
            pais: document.getElementById('filter-pais').value,
            sabor: document.getElementById('filter-sabor').value,
            color: document.getElementById('filter-color').value,
            status: document.getElementById('filter-status').value,
            sort: document.getElementById('filter-sort').value
        };
    }
    
    if (appState.currentView === 'browse') {
        loadBrowseView();
    }
}

function loadBrowseView() {
    const container = document.getElementById('browse-grid');
    container.innerHTML = '';
    
    const isBurgers = appState.currentCollection === 'burgers';
    const filteredData = isBurgers ? getFilteredBurgerData() : getFilteredData();
    
    if (filteredData.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--gray-500);">
                <i class="fas fa-search" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                <h3>${isBurgers ? 'No se encontraron burgers' : 'No se encontraron alfajores'}</h3>
                <p>${isBurgers ? 'Probá con otros filtros o cargá una nueva reseña.' : 'Intenta ajustar los filtros o agregar más datos.'}</p>
            </div>
        `;
        return;
    }
    
    filteredData.forEach(item => {
        const itemElement = isBurgers ? createBurgerBrowseItem(item) : createBrowseItem(item);
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
                    page_number: i,
                    status: 'uncategorized',
                    marca: 'Sin categorizar',
                    sabor: 'Sin categorizar',
                    pais: 'Sin categorizar'
                });
            }
        }
        data = data.filter(item => item.status === 'uncategorized');
    }
    
    return sortAlfajorData(data, appState.filters.sort);
}

function getFilteredBurgerData() {
    let data = Object.values(appState.burgersData);

    if (appState.burgerFilters.place) {
        data = data.filter(item => item.place === appState.burgerFilters.place);
    }
    if (appState.burgerFilters.meatStyle) {
        data = data.filter(item => item.meatStyle === appState.burgerFilters.meatStyle);
    }
    if (appState.burgerFilters.bunStyle) {
        data = data.filter(item => item.bunStyle === appState.burgerFilters.bunStyle);
    }
    if (appState.burgerFilters.size) {
        data = data.filter(item => item.size === appState.burgerFilters.size);
    }

    return data.sort((a, b) => {
        const scoreDiff = Number(b.overallScore || 0) - Number(a.overallScore || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(b.dateModified || b.dateAdded || 0) - new Date(a.dateModified || a.dateAdded || 0);
    });
}

function getAlfajorRatingDetailsMarkup(item) {
    const overallRating = formatAlfajorRating(item.rating_overall);
    if (!overallRating) {
        return '';
    }

    return `
        <div class="modal-item-grid">
            <div class="modal-item-field"><strong>Promedio:</strong> ${overallRating} / 5</div>
            <div class="modal-item-field"><strong>Tapa:</strong> ${item.rating_tapa ?? '-'}</div>
            <div class="modal-item-field"><strong>Relleno:</strong> ${item.rating_relleno ?? '-'}</div>
            <div class="modal-item-field"><strong>Sabor general:</strong> ${item.rating_sabor_general ?? '-'}</div>
            <div class="modal-item-field"><strong>Tamaño:</strong> ${item.rating_tamano ?? '-'}</div>
        </div>
    `;
}

function createBrowseItem(item) {
    const div = document.createElement('div');
    div.className = 'browse-item';
    
    const statusClass = item.status === 'categorized' ? 'categorized' : 'uncategorized';
    const overallRating = formatAlfajorRating(item.rating_overall);
    
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
                ${overallRating ? `<span class="browse-rating"><i class="fas fa-star"></i> ${overallRating} / 5</span>` : ''}
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

function createBurgerBrowseItem(item) {
    const div = document.createElement('div');
    div.className = 'browse-item';
    const images = Array.isArray(item.images) ? item.images : [];
    const coverImage = getBurgerCoverImage(images, item.coverImageId);
    const imageCount = images.length > 1
        ? `<span class="burger-image-count">${images.length} fotos</span>`
        : '';
    const imageMarkup = coverImage
        ? `<img src="${coverImage.dataUrl}" alt="Portada de ${escapeHtml(item.name || 'burger')}" loading="lazy">`
        : '<i class="fas fa-burger"></i>';

    div.innerHTML = `
        <div class="browse-item-image burger-browse-image">
            <span class="burger-score-badge">${Number(item.overallScore || 0).toFixed(1)}</span>
            ${imageMarkup}
            ${imageCount}
        </div>
        <div class="browse-item-content">
            <div class="browse-item-header">
                <div class="browse-item-title">
                    ${item.name || 'Sin nombre'} - ${item.place || 'Sin local'}
                    <span class="status-badge categorized">Reseñada</span>
                </div>
                <button class="delete-btn" title="Eliminar reseña">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="browse-item-meta">
                <span><strong>Local:</strong> ${item.place || 'No especificado'}</span>
                ${item.location ? `<span><strong>Ubicación:</strong> ${item.location}</span>` : ''}
                ${item.meatStyle ? `<span><strong>Carne:</strong> ${item.meatStyle}</span>` : ''}
                ${item.bunStyle ? `<span><strong>Pan:</strong> ${item.bunStyle}</span>` : ''}
                ${item.size ? `<span><strong>Tamaño:</strong> ${item.size}</span>` : ''}
                ${item.toppings ? `<span><strong>Toppings:</strong> ${item.toppings.substring(0, 40)}${item.toppings.length > 40 ? '...' : ''}</span>` : ''}
                ${item.ratings?.condiments ? `<span><strong>Condimentos:</strong> ${item.ratings.condiments}/10</span>` : ''}
                ${item.ratings?.temperature ? `<span><strong>Temperatura:</strong> ${item.ratings.temperature}/10</span>` : ''}
            </div>
        </div>
    `;

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
            deleteBurger(item.id, event);
        });
    }

    return div;
}

function openItemModal(item) {
    if (appState.currentCollection === 'burgers') {
        openBurgerModal(item);
        return;
    }

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

            ${getAlfajorRatingDetailsMarkup(item)}
            
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

function openBurgerModal(item) {
    const modal = document.getElementById('item-modal');
    const modalBody = modal.querySelector('.modal-body');
    const burger = normalizeBurgerRecord(item, item.id);
    const images = Array.isArray(burger.images) ? burger.images : [];
    const coverImage = getBurgerCoverImage(images, burger.coverImageId);
    const orderedImages = coverImage
        ? [coverImage, ...images.filter(image => image.id !== coverImage.id)]
        : images;

    const galleryMarkup = orderedImages.length
        ? `
            <div class="modal-item-image">
                <img src="${orderedImages[0].dataUrl}" alt="Portada de burger" />
            </div>
            ${orderedImages.length > 1 ? `
                <div class="burger-modal-gallery">
                    ${orderedImages.map((image, index) => `
                        <div class="burger-modal-gallery-item ${index === 0 ? 'is-cover' : ''}">
                            <img src="${image.dataUrl}" alt="${escapeHtml(image.name || `Imagen ${index + 1}`)}" loading="lazy">
                            <span>${index === 0 ? 'Portada' : escapeHtml(image.name || `Imagen ${index + 1}`)}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `
        : '';

    const ratingsMarkup = BURGER_RATING_CONFIG.map(field => `
        <div class="modal-item-field"><strong>${field.label}:</strong> ${burger.ratings?.[field.key] ?? '-'}</div>
    `).join('');

    const commentsMarkup = BURGER_RATING_CONFIG
        .map(field => {
            const rawComment = burger.ratingComments?.[field.key];
            if (!rawComment) return '';
            const featureScore = burger.ratings?.[field.key] ?? '-';
            return `
                <div class="modal-item-field modal-item-notes">
                    <strong>Comentario (${field.label} · ${featureScore}/10):</strong><br>${escapeHtml(rawComment).replace(/\n/g, '<br>')}
                </div>
            `;
        })
        .join('');

    modalBody.innerHTML = `
        <div class="modal-item-details">
            <div class="modal-item-header">
                <h4>${burger.name || 'Sin nombre'} - ${burger.place || 'Sin local'}</h4>
                <span class="status-badge categorized">
                    ${Number(burger.overallScore || 0).toFixed(1)} / 10
                </span>
            </div>

            ${galleryMarkup}

            <div class="modal-item-grid">
                <div class="modal-item-field">
                    <strong>Local:</strong> ${burger.place || 'No especificado'}
                </div>
                ${burger.location ? `<div class="modal-item-field"><strong>Ubicación:</strong> ${burger.location}</div>` : ''}
                ${burger.meatStyle ? `<div class="modal-item-field"><strong>Carne:</strong> ${burger.meatStyle}</div>` : ''}
                ${burger.bunStyle ? `<div class="modal-item-field"><strong>Pan:</strong> ${burger.bunStyle}</div>` : ''}
                ${burger.size ? `<div class="modal-item-field"><strong>Tamaño:</strong> ${burger.size}</div>` : ''}
                ${burger.toppings ? `<div class="modal-item-field modal-item-notes"><strong>Toppings:</strong><br>${escapeHtml(burger.toppings).replace(/\n/g, '<br>')}</div>` : ''}
            </div>

            <div class="modal-item-grid">
                ${ratingsMarkup}
            </div>

            ${commentsMarkup ? `<div class="modal-item-grid">${commentsMarkup}</div>` : ''}
            ${burger.notes ? `<div class="modal-item-field modal-item-notes"><strong>Notas generales:</strong><br>${escapeHtml(burger.notes).replace(/\n/g, '<br>')}</div>` : ''}

            <div class="modal-actions">
                <button class="submit-button" data-burger-edit="${burger.id}">
                    <i class="fas fa-edit"></i>
                    Editar
                </button>
                <button class="delete-button" data-burger-delete="${burger.id}">
                    <i class="fas fa-trash"></i>
                    Eliminar
                </button>
            </div>
        </div>
    `;

    const editButton = modal.querySelector('[data-burger-edit]');
    const deleteButton = modal.querySelector('[data-burger-delete]');

    if (editButton) {
        editButton.addEventListener('click', () => {
            editBurger(burger.id);
        });
    }

    if (deleteButton) {
        deleteButton.addEventListener('click', async (event) => {
            await deleteBurger(burger.id, event);
            closeModal();
        });
    }

    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('item-modal').classList.remove('active');
}

function goToPage(pageNumber) {
    appState.currentPage = Math.max(1, pageNumber - (appState.pageOffset || 0));
    renderPage(appState.currentPage);
    updatePageControls();
    loadPageData();
    switchView('categorize');
    closeModal();
}

function editItem(pageNumber) {
    if (appState.currentCollection === 'burgers') {
        editBurger(pageNumber);
        return;
    }

    goToPage(pageNumber);
    closeModal();
}

function editBurger(burgerId) {
    const burger = normalizeBurgerRecord(appState.burgersData[burgerId], burgerId);
    if (!burger) return;

    appState.burgersData[burgerId] = burger;
    appState.editingBurgerId = burgerId;
    switchCollection('burgers');
    switchView('categorize');

    document.getElementById('burger-name').value = burger.name || '';
    document.getElementById('burger-place').value = burger.place || '';
    document.getElementById('burger-location').value = burger.location || '';
    document.getElementById('burger-meat-style').value = burger.meatStyle || '';
    document.getElementById('burger-bun-style').value = burger.bunStyle || '';
    document.getElementById('burger-toppings').value = burger.toppings || '';
    document.getElementById('burger-size').value = burger.size || '';

    BURGER_RATING_CONFIG.forEach(field => {
        const ratingElement = document.getElementById(field.inputId);
        if (ratingElement) {
            ratingElement.value = burger.ratings?.[field.key] ?? 7;
        }

        const commentElement = document.getElementById(field.commentId);
        if (commentElement) {
            commentElement.value = burger.ratingComments?.[field.key] || '';
        }
    });

    appState.burgerFormImages = Array.isArray(burger.images) ? burger.images.map(image => ({ ...image })) : [];
    appState.burgerCoverImageId = resolveBurgerCoverImageId(appState.burgerFormImages, burger.coverImageId);
    renderBurgerImagePicker();

    document.getElementById('burger-submit-button').innerHTML = `
        <i class="fas fa-save"></i>
        Actualizar reseña
    `;

    updateBurgerPreview();
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

async function deleteBurger(burgerId, event) {
    if (event) {
        event.stopPropagation();
    }

    const burger = appState.burgersData[burgerId];
    if (!burger) return;

    if (!confirm(`¿Estás seguro de que quieres eliminar la reseña de "${burger.name || 'esta burger'}"?`)) {
        return;
    }

    delete appState.burgersData[burgerId];
    try {
        saveBurgersToStorage();
    } catch (error) {
        console.error('Error saving burger data after delete:', error);
        showError(getBurgerStorageErrorMessage(error));
        return;
    }

    if (appState.useBackend) {
        try {
            await deleteBurgerFromBackend(burgerId);
        } catch (error) {
            console.error('Error deleting burger from backend:', error);
            showInfo('Se eliminó localmente, pero no se pudo sincronizar la eliminación en el servidor.');
        }
    }
    updateFilters();
    updateStats();

    if (appState.editingBurgerId === burgerId) {
        resetBurgerForm();
    }

    if (appState.currentView === 'browse') {
        loadBrowseView();
    } else if (appState.currentView === 'stats') {
        loadStatsView();
    }

    showSuccess('Reseña eliminada exitosamente!');
}

function toggleBrowseView(viewType) {
    document.querySelectorAll('.view-toggle').forEach(toggle => toggle.classList.remove('active'));
    document.querySelector(`[data-view-type="${viewType}"]`).classList.add('active');
    
    // In a full implementation, you would change the grid layout here
    // For now, we'll keep the grid view
}

async function loadStatsView() {
    if (appState.currentCollection === 'burgers') {
        loadBurgerStatsView();
        return;
    }

    if (appState.useBackend) {
        try {
            const response = await fetch(`${appState.backendUrl}/stats`);
            
            if (response.ok) {
                const stats = await response.json();
                
                // Update stats display with backend data
                updateStatsDisplay('stats-marca', stats.by_marca.map(item => [item.name, item.count]));
                updateStatsDisplay('stats-pais', stats.by_pais.map(item => [item.name, item.count]));
                updateStatsDisplay('stats-sabor', stats.by_sabor.map(item => [item.name, item.count]));
                updateAlfajorStatsSummary();
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
    updateAlfajorStatsSummary();
}

function loadBurgerStatsView() {
    const data = Object.values(appState.burgersData);
    const statsByPlace = calculateStats(data, 'place');
    const statsByMeat = calculateStats(data, 'meatStyle');
    const statsByBun = calculateStats(data, 'bunStyle');
    const averageScore = data.length
        ? data.reduce((sum, item) => sum + Number(item.overallScore || 0), 0) / data.length
        : 0;
    const bestScore = data.length
        ? Math.max(...data.map(item => Number(item.overallScore || 0))).toFixed(1)
        : '0.0';

    updateStatsDisplay('stats-marca', statsByPlace);
    updateStatsDisplay('stats-pais', statsByMeat);
    updateStatsDisplay('stats-sabor', statsByBun);
    updateStatsSummary([
        { label: 'Promedio general', value: `${averageScore.toFixed(1)} / 10` },
        { label: 'Mejor score', value: bestScore },
        { label: 'Top local', value: getTopStatLabel(statsByPlace) }
    ]);
}

function updateAlfajorStatsSummary() {
    const data = Object.values(appState.alfajoresData);
    const uniqueBrands = new Set(data.map(item => item.marca).filter(Boolean)).size;
    const topCountry = getTopStatLabel(calculateStats(data, 'pais'));
    const ratedItems = data.filter(item => formatAlfajorRating(item.rating_overall) !== null);
    const averageRating = ratedItems.length
        ? ratedItems.reduce((sum, item) => sum + Number(item.rating_overall || 0), 0) / ratedItems.length
        : null;

    updateStatsSummary([
        { label: 'Categorizados', value: data.length },
        { label: 'Marcas únicas', value: uniqueBrands },
        { label: 'País líder', value: topCountry },
        { label: 'Con puntaje', value: ratedItems.length },
        { label: 'Promedio', value: averageRating === null ? '-' : `${averageRating.toFixed(1)} / 5` }
    ]);
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

function getTopStatLabel(stats) {
    return stats.length > 0 ? stats[0][0] : 'Sin datos';
}

function updateStatsSummary(cards) {
    const container = document.getElementById('stats-summary');

    if (!cards || cards.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = cards.map(card => `
        <div class="summary-card">
            <span class="summary-card-label">${card.label}</span>
            <span class="summary-card-value">${card.value}</span>
        </div>
    `).join('');
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
    if (appState.currentCollection === 'burgers') {
        exportBurgerData();
        return;
    }

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

function exportBurgerData() {
    const burgers = Object.values(appState.burgersData);
    const averageScore = burgers.length
        ? burgers.reduce((sum, item) => sum + Number(item.overallScore || 0), 0) / burgers.length
        : 0;

    const data = {
        exportDate: new Date().toISOString(),
        totalBurgers: burgers.length,
        averageScore: Number(averageScore.toFixed(1)),
        burgers
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `burgers-collection-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);

    showSuccess('Datos de burgers exportados exitosamente!');
}

async function clearAllData() {
    const isBurgers = appState.currentCollection === 'burgers';
    const confirmMessage = isBurgers
        ? '¿Estás seguro de que quieres eliminar todas las reseñas de burgers? Esta acción no se puede deshacer.'
        : '¿Estás seguro de que quieres eliminar todos los datos? Esta acción no se puede deshacer.';

    if (confirm(confirmMessage)) {
        if (isBurgers) {
            appState.burgersData = {};
            appState.burgerFilters = {
                place: '',
                meatStyle: '',
                bunStyle: '',
                size: ''
            };
            try {
                saveBurgersToStorage();
            } catch (error) {
                console.error('Error clearing burger data from storage:', error);
                showError(getBurgerStorageErrorMessage(error));
                return;
            }

            if (appState.useBackend) {
                try {
                    await clearBurgersFromBackend();
                } catch (error) {
                    console.error('Error clearing burgers from backend:', error);
                    showInfo('Las burgers se limpiaron localmente, pero no se pudo limpiar el servidor.');
                }
            }
            resetBurgerForm();
        } else {
            appState.alfajoresData = {};
            saveDataToStorage();
            loadPageData();
        }

        updateFilters();
        updateStats();

        if (appState.currentView === 'browse') {
            loadBrowseView();
        } else if (appState.currentView === 'stats') {
            loadStatsView();
        }

        showSuccess(isBurgers ? 'Todas las reseñas de burgers fueron eliminadas.' : 'Todos los datos han sido eliminados.');
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
