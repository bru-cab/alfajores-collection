import SwiftUI

struct CategoryView: View {
    @StateObject private var imageManager = ImageManager.shared
    @StateObject private var apiClient = APIClient.shared
    
    @State private var marca = ""
    @State private var sabor = ""
    @State private var pais = ""
    @State private var color = ""
    @State private var notas = ""
    @State private var showingAlert = false
    @State private var alertMessage = ""
    @State private var isSaving = false
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Logo Section
                    VStack(spacing: 8) {
                        Text("🍪")
                            .font(.system(size: 40))
                        Text("Alfajores Collection")
                            .font(.title3)
                            .fontWeight(.bold)
                            .foregroundColor(.primary)
                    }
                    .padding(.top)
                    
                    // Image and Page Info Section
                    if let image = imageManager.currentImage {
                        VStack(spacing: 15) {
                            Text("Categorizar Alfajor")
                                .font(.title2)
                                .fontWeight(.bold)
                            
                            Image(uiImage: image)
                                .resizable()
                                .scaledToFit()
                                .frame(maxHeight: 200)
                                .cornerRadius(12)
                                .shadow(radius: 5)
                            
                            HStack {
                                Text("Página \(imageManager.currentPageNumber)")
                                    .font(.headline)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(Color.blue.opacity(0.2))
                                    .cornerRadius(8)
                                
                                if imageManager.hasUnsavedImage {
                                    Text("Pendiente de guardar")
                                        .font(.caption)
                                        .foregroundColor(.orange)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(Color.orange.opacity(0.2))
                                        .cornerRadius(6)
                                }
                            }
                        }
                    } else {
                        VStack(spacing: 20) {
                            Image(systemName: "photo.badge.plus")
                                .font(.system(size: 60))
                                .foregroundColor(.gray.opacity(0.6))
                            
                            Text("Sube una imagen primero")
                                .font(.headline)
                                .foregroundColor(.secondary)
                            
                            Text("Ve a la pestaña 'Subir' para seleccionar una imagen")
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .multilineTextAlignment(.center)
                        }
                        .padding(.vertical, 40)
                    }
                    
                    // Categorization Form
                    if imageManager.currentImage != nil {
                        VStack(spacing: 20) {
                            VStack(alignment: .leading, spacing: 15) {
                                Text("Información del Alfajor")
                                    .font(.headline)
                                    .padding(.horizontal)
                                
                                VStack(spacing: 12) {
                                    CustomTextField(title: "Marca *", text: $marca, placeholder: "Ej: Havanna")
                                    CustomTextField(title: "Sabor *", text: $sabor, placeholder: "Ej: Dulce de leche")
                                    CustomTextField(title: "País *", text: $pais, placeholder: "Ej: Argentina")
                                    CustomTextField(title: "Color", text: $color, placeholder: "Ej: Dorado (opcional)")
                                }
                                .padding(.horizontal)
                            }
                            
                            VStack(alignment: .leading, spacing: 15) {
                                Text("Notas")
                                    .font(.headline)
                                    .padding(.horizontal)
                                
                                TextField("Notas adicionales...", text: $notas, axis: .vertical)
                                    .textFieldStyle(RoundedBorderTextFieldStyle())
                                    .lineLimit(3...6)
                                    .padding(.horizontal)
                            }
                            
                            // Save Button
                            Button(action: saveAlfajor) {
                                HStack {
                                    if isSaving {
                                        ProgressView()
                                            .scaleEffect(0.8)
                                            .foregroundColor(.white)
                                    } else {
                                        Image(systemName: "checkmark.circle.fill")
                                    }
                                    Text(isSaving ? "Guardando..." : "Guardar en PostgreSQL")
                                        .fontWeight(.semibold)
                                }
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(canSave ? Color.blue : Color.gray)
                                .foregroundColor(.white)
                                .cornerRadius(12)
                            }
                            .disabled(!canSave || isSaving)
                            .padding(.horizontal)
                            .padding(.top, 10)
                        }
                    }
                    
                    // Connection Status
                    HStack {
                        Circle()
                            .fill(apiClient.isOnline ? Color.green : Color.red)
                            .frame(width: 8, height: 8)
                        Text(apiClient.isOnline ? "Conectado a PostgreSQL" : "Sin conexión")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.top)
                }
                .padding()
            }
            .navigationTitle("Categorizar")
            .navigationBarTitleDisplayMode(.inline)
            .alert("Resultado", isPresented: $showingAlert) {
                Button("OK") {
                    if alertMessage.contains("✅") {
                        // Success - clear form and mark image as saved
                        clearForm()
                        imageManager.markImageAsSaved()
                    }
                }
            } message: {
                Text(alertMessage)
            }
        }
    }
    
    private var canSave: Bool {
        !marca.isEmpty && !sabor.isEmpty && !pais.isEmpty && imageManager.currentImage != nil && apiClient.isOnline
    }
    
    private func saveAlfajor() {
        guard let image = imageManager.currentImage else { return }
        
        isSaving = true
        
        // First upload the image
        apiClient.uploadImage(image, pageNumber: imageManager.currentPageNumber) { result in
            switch result {
            case .success(_):
                // Image uploaded successfully, now save the alfajor data
                self.saveAlfajorData()
            case .failure(let error):
                DispatchQueue.main.async {
                    self.isSaving = false
                    self.alertMessage = "❌ Error subiendo imagen: \(error.localizedDescription)"
                    self.showingAlert = true
                }
            }
        }
    }
    
    private func saveAlfajorData() {
        let alfajor = AlfajorData(
            pageNumber: imageManager.currentPageNumber,
            marca: marca,
            sabor: sabor,
            pais: pais,
            color: color.isEmpty ? nil : color,
            notas: notas.isEmpty ? nil : notas,
            imageFilename: nil,
            imageUrl: nil,
            imageData: nil,
            dateAdded: ISO8601DateFormatter().string(from: Date()),
            dateModified: ISO8601DateFormatter().string(from: Date()),
            status: "categorized",
            createdFrom: "ios"
        )
        
        apiClient.createAlfajor(alfajor) { result in
            DispatchQueue.main.async {
                self.isSaving = false
                
                switch result {
                case .success(let response):
                    self.alertMessage = "✅ \(response.message)"
                case .failure(let error):
                    self.alertMessage = "❌ Error: \(error.localizedDescription)"
                }
                self.showingAlert = true
            }
        }
    }
    
    private func clearForm() {
        marca = ""
        sabor = ""
        pais = ""
        color = ""
        notas = ""
    }
}

// MARK: - Custom Text Field

struct CustomTextField: View {
    let title: String
    @Binding var text: String
    let placeholder: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(.secondary)
            
            TextField(placeholder, text: $text)
                .textFieldStyle(RoundedBorderTextFieldStyle())
        }
    }
}

#Preview {
    CategoryView()
}
