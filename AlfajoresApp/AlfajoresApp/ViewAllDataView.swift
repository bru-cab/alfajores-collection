import SwiftUI

struct ViewAllDataView: View {
    @StateObject private var apiClient = APIClient.shared
    
    @State private var alfajores: [AlfajorData] = []
    @State private var isLoading = false
    @State private var searchText = ""
    @State private var currentPage = 1
    @State private var totalPages = 1
    @State private var totalCount = 0
    @State private var errorMessage = ""
    @State private var showingError = false
    
    private let itemsPerPage = 20
    
    var filteredAlfajores: [AlfajorData] {
        if searchText.isEmpty {
            return alfajores
        } else {
            return alfajores.filter { alfajor in
                alfajor.marca.localizedCaseInsensitiveContains(searchText) ||
                alfajor.sabor.localizedCaseInsensitiveContains(searchText) ||
                alfajor.pais.localizedCaseInsensitiveContains(searchText) ||
                (alfajor.color?.localizedCaseInsensitiveContains(searchText) ?? false) ||
                (alfajor.notas?.localizedCaseInsensitiveContains(searchText) ?? false)
            }
        }
    }
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Header with stats
                VStack(spacing: 10) {
                    HStack {
                        HStack(spacing: 12) {
                            Text("🍪")
                                .font(.system(size: 30))
                            
                            VStack(alignment: .leading) {
                                Text("Alfajores Collection")
                                    .font(.title2)
                                    .fontWeight(.bold)
                                
                                if totalCount > 0 {
                                    Text("\(totalCount) alfajores catalogados")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                        
                        Spacer()
                        
                        HStack {
                            Circle()
                                .fill(apiClient.isOnline ? Color.green : Color.red)
                                .frame(width: 8, height: 8)
                            Text(apiClient.isOnline ? "Online" : "Offline")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.horizontal)
                    
                    // Search bar
                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(.gray)
                        TextField("Buscar alfajores...", text: $searchText)
                            .textFieldStyle(PlainTextFieldStyle())
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(8)
                    .padding(.horizontal)
                }
                .padding(.vertical)
                .background(Color(.systemBackground))
                
                Divider()
                
                // Content
                if isLoading && alfajores.isEmpty {
                    Spacer()
                    VStack {
                        ProgressView()
                            .scaleEffect(1.2)
                        Text("Cargando alfajores...")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .padding(.top, 8)
                    }
                    Spacer()
                } else if alfajores.isEmpty && !isLoading {
                    Spacer()
                    VStack(spacing: 15) {
                        Image(systemName: "tray")
                            .font(.system(size: 50))
                            .foregroundColor(.gray.opacity(0.6))
                        
                        Text("No hay alfajores aún")
                            .font(.headline)
                            .foregroundColor(.secondary)
                        
                        Text("Usa la pestaña 'Subir' y 'Categorizar' para añadir alfajores")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 40)
                        
                        Button("Recargar") {
                            loadAlfajores()
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 8)
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                    }
                    Spacer()
                } else {
                    // Alfajores list
                    List {
                        ForEach(filteredAlfajores, id: \.pageNumber) { alfajor in
                            AlfajorRowView(alfajor: alfajor)
                                .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                        }
                        
                        // Loading more indicator
                        if isLoading && !alfajores.isEmpty {
                            HStack {
                                Spacer()
                                ProgressView()
                                    .scaleEffect(0.8)
                                Text("Cargando más...")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Spacer()
                            }
                            .padding()
                        }
                        
                        // Load more button if there are more pages
                        if currentPage < totalPages && !isLoading {
                            Button("Cargar más alfajores") {
                                loadMoreAlfajores()
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.blue.opacity(0.1))
                            .foregroundColor(.blue)
                            .cornerRadius(8)
                            .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                        }
                    }
                    .listStyle(PlainListStyle())
                    .refreshable {
                        refreshData()
                    }
                }
            }
            .navigationTitle("Ver Todo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Actualizar") {
                        refreshData()
                    }
                    .disabled(isLoading)
                }
            }
            .onAppear {
                if alfajores.isEmpty {
                    loadAlfajores()
                }
            }
            .alert("Error", isPresented: $showingError) {
                Button("OK") { }
            } message: {
                Text(errorMessage)
            }
        }
    }
    
    private func loadAlfajores() {
        isLoading = true
        currentPage = 1
        
        apiClient.fetchAlfajores(page: currentPage, perPage: itemsPerPage) { result in
            DispatchQueue.main.async {
                isLoading = false
                
                switch result {
                case .success(let response):
                    // Sort by date (newest first) as backup if backend doesn't sort
                    alfajores = response.alfajores.sorted { alfajor1, alfajor2 in
                        guard let date1 = alfajor1.dateAdded, let date2 = alfajor2.dateAdded else {
                            return false
                        }
                        return date1 > date2
                    }
                    totalCount = response.total
                    totalPages = response.pages
                    currentPage = response.currentPage
                case .failure(let error):
                    errorMessage = error.localizedDescription
                    showingError = true
                }
            }
        }
    }
    
    private func loadMoreAlfajores() {
        guard currentPage < totalPages && !isLoading else { return }
        
        isLoading = true
        let nextPage = currentPage + 1
        
        apiClient.fetchAlfajores(page: nextPage, perPage: itemsPerPage) { result in
            DispatchQueue.main.async {
                isLoading = false
                
                switch result {
                case .success(let response):
                    alfajores.append(contentsOf: response.alfajores)
                    currentPage = response.currentPage
                case .failure(let error):
                    errorMessage = error.localizedDescription
                    showingError = true
                }
            }
        }
    }
    
    private func refreshData() {
        loadAlfajores()
    }
}

// MARK: - Alfajor Row View

struct AlfajorRowView: View {
    let alfajor: AlfajorData
    @State private var alfajorImage: UIImage?
    @State private var isLoadingImage = false
    
    var body: some View {
        HStack(spacing: 12) {
            // Image box
            VStack {
                if let image = alfajorImage {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 80, height: 80)
                        .clipped()
                        .cornerRadius(8)
                        .shadow(radius: 2)
                } else if isLoadingImage {
                    ProgressView()
                        .frame(width: 80, height: 80)
                        .background(Color.gray.opacity(0.1))
                        .cornerRadius(8)
                } else {
                    // Placeholder
                    VStack {
                        Image(systemName: "photo")
                            .font(.title2)
                            .foregroundColor(.gray)
                        Text("🍪")
                            .font(.title2)
                    }
                    .frame(width: 80, height: 80)
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(8)
                }
            }
            
            // Content
            VStack(alignment: .leading, spacing: 6) {
                // Header row
                HStack {
                    Text(alfajor.pais)
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.green)
                        .cornerRadius(6)
                    
                    Spacer()
                    
                    if alfajor.createdFrom == "ios" {
                        HStack(spacing: 4) {
                            Image(systemName: "iphone")
                                .font(.caption)
                                .foregroundColor(.blue)
                            Text("iOS")
                                .font(.caption)
                                .foregroundColor(.blue)
                                .fontWeight(.medium)
                        }
                    }
                }
                
                // Main info
                VStack(alignment: .leading, spacing: 3) {
                    Text(alfajor.marca)
                        .font(.headline)
                        .fontWeight(.semibold)
                        .lineLimit(1)
                    
                    Text(alfajor.sabor)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                    
                    if let color = alfajor.color, !color.isEmpty {
                        HStack {
                            Text("Color:")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(color)
                                .font(.caption)
                                .fontWeight(.medium)
                        }
                    }
                    
                    if let notas = alfajor.notas, !notas.isEmpty {
                        Text(notas)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }
                }
                
                // Footer with date
                if let dateAdded = alfajor.dateAdded {
                    HStack {
                        Text("Agregado: \(formatDate(dateAdded))")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Spacer()
                        
                        Text(alfajor.status)
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundColor(.green)
                    }
                }
            }
        }
        .padding(.vertical, 8)
        .onAppear {
            loadAlfajorImage()
        }
    }
    
    private func loadAlfajorImage() {
        // If we already have an image or are loading, don't reload
        guard alfajorImage == nil && !isLoadingImage else { return }
        
        // First, try to decode base64 image data from the database
        if let imageData = alfajor.imageData, !imageData.isEmpty {
            if let data = Data(base64Encoded: imageData), let image = UIImage(data: data) {
                self.alfajorImage = image
                return
            }
        }
        
        // Second, try imageUrl field (might also contain base64)
        if let imageUrl = alfajor.imageUrl, !imageUrl.isEmpty {
            // Try to decode base64 image data
            if imageUrl.starts(with: "data:image") {
                // Handle data URL format (data:image/jpeg;base64,...)
                let components = imageUrl.components(separatedBy: ",")
                if components.count > 1, let data = Data(base64Encoded: components[1]) {
                    self.alfajorImage = UIImage(data: data)
                    return
                }
            } else if let data = Data(base64Encoded: imageUrl) {
                // Handle direct base64 string
                self.alfajorImage = UIImage(data: data)
                return
            }
        }
        
        // If no image data available, try to load from server
        loadImageFromServer()
    }
    
    private func loadImageFromServer() {
        isLoadingImage = true
        
        let imageURL = "https://alfajores-backend.onrender.com/api/images/page_\(alfajor.pageNumber).png"
        
        guard let url = URL(string: imageURL) else {
            isLoadingImage = false
            return
        }
        
        URLSession.shared.dataTask(with: url) { data, response, error in
            DispatchQueue.main.async {
                self.isLoadingImage = false
                
                if let data = data, let image = UIImage(data: data) {
                    self.alfajorImage = image
                }
                // If no image found, keep placeholder
            }
        }.resume()
    }
    
    private func formatDate(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: dateString) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateStyle = .short
            displayFormatter.timeStyle = .none
            return displayFormatter.string(from: date)
        }
        return dateString
    }
}

#Preview {
    ViewAllDataView()
}
