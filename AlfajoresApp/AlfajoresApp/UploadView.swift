import SwiftUI
import PhotosUI
import PDFKit

struct UploadView: View {
    @StateObject private var imageManager = ImageManager.shared
    @StateObject private var apiClient = APIClient.shared
    
    @State private var showingImagePicker = false
    @State private var showingCamera = false
    @State private var showingPDFPicker = false
    @State private var isProcessing = false
    @State private var processingMessage = ""
    
    var body: some View {
        NavigationView {
            VStack(spacing: 30) {
                // Image preview
                if let image = imageManager.currentImage {
                    VStack(spacing: 15) {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFit()
                            .frame(maxHeight: 250)
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
                                Text("Sin guardar")
                                    .font(.caption)
                                    .foregroundColor(.orange)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.orange.opacity(0.2))
                                    .cornerRadius(6)
                            } else {
                                Text("Guardado")
                                    .font(.caption)
                                    .foregroundColor(.green)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.green.opacity(0.2))
                                    .cornerRadius(6)
                            }
                        }
                    }
                } else {
                    VStack(spacing: 15) {
                        Image(systemName: "photo.badge.plus")
                            .font(.system(size: 80))
                            .foregroundColor(.gray.opacity(0.6))
                        
                        Text("Selecciona una fuente para subir imagen")
                            .font(.headline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(height: 200)
                }
                
                // Upload options
                VStack(spacing: 20) {
                    Button(action: {
                        showingCamera = true
                    }) {
                        HStack(spacing: 15) {
                            Image(systemName: "camera.fill")
                                .font(.title2)
                            Text("Tomar Foto")
                                .font(.headline)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }
                    
                    Button(action: {
                        showingImagePicker = true
                    }) {
                        HStack(spacing: 15) {
                            Image(systemName: "photo.on.rectangle")
                                .font(.title2)
                            Text("Desde Galería")
                                .font(.headline)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.green)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }
                    
                    Button(action: {
                        showingPDFPicker = true
                    }) {
                        HStack(spacing: 15) {
                            Image(systemName: "doc.fill")
                                .font(.title2)
                            Text("Importar PDF")
                                .font(.headline)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.purple)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }
                    
                    if imageManager.currentImage != nil {
                        Button(action: {
                            imageManager.clearImage()
                        }) {
                            HStack(spacing: 15) {
                                Image(systemName: "trash")
                                    .font(.title2)
                                Text("Limpiar")
                                    .font(.headline)
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.red)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                        }
                    }
                }
                .padding(.horizontal)
                
                if isProcessing {
                    VStack {
                        ProgressView()
                            .scaleEffect(1.2)
                        Text(processingMessage)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .padding(.top, 8)
                    }
                }
                
                // Connection status
                HStack {
                    Circle()
                        .fill(apiClient.isOnline ? Color.green : Color.red)
                        .frame(width: 8, height: 8)
                    Text(apiClient.isOnline ? "Conectado" : "Sin conexión")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
            }
            .padding()
            .navigationTitle("Subir")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showingImagePicker) {
                ImagePicker(selectedImage: Binding<UIImage?>(
                    get: { nil },
                    set: { image in
                        if let image = image {
                            imageManager.setImage(image)
                        }
                    }
                ))
            }
            .sheet(isPresented: $showingCamera) {
                CameraView(selectedImage: Binding<UIImage?>(
                    get: { nil },
                    set: { image in
                        if let image = image {
                            imageManager.setImage(image)
                        }
                    }
                ))
            }
            .sheet(isPresented: $showingPDFPicker) {
                PDFPicker { pdfDocument in
                    processPDF(pdfDocument)
                }
            }
        }
    }
    
    private func processPDF(_ pdfDocument: PDFDocument) {
        isProcessing = true
        processingMessage = "Procesando PDF..."
        
        DispatchQueue.global(qos: .userInitiated).async {
            // Get the first page of the PDF
            guard let page = pdfDocument.page(at: 0) else {
                DispatchQueue.main.async {
                    isProcessing = false
                    processingMessage = "Error: No se pudo leer el PDF"
                }
                return
            }
            
            // Convert PDF page to image
            let pageRect = page.bounds(for: .mediaBox)
            let renderer = UIGraphicsImageRenderer(size: pageRect.size)
            let img = renderer.image { ctx in
                UIColor.white.set()
                ctx.fill(pageRect)
                ctx.cgContext.translateBy(x: 0.0, y: pageRect.size.height)
                ctx.cgContext.scaleBy(x: 1.0, y: -1.0)
                page.draw(with: .mediaBox, to: ctx.cgContext)
            }
            
            DispatchQueue.main.async {
                imageManager.setImage(img)
                isProcessing = false
                processingMessage = ""
            }
        }
    }
}

// MARK: - PDF Picker

struct PDFPicker: UIViewControllerRepresentable {
    let onPDFSelected: (PDFDocument) -> Void
    @Environment(\.dismiss) private var dismiss
    
    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.pdf])
        picker.delegate = context.coordinator
        picker.allowsMultipleSelection = false
        return picker
    }
    
    func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: NSObject, UIDocumentPickerDelegate {
        let parent: PDFPicker
        
        init(_ parent: PDFPicker) {
            self.parent = parent
        }
        
        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            guard let url = urls.first else { return }
            
            if url.startAccessingSecurityScopedResource() {
                defer { url.stopAccessingSecurityScopedResource() }
                
                if let pdfDocument = PDFDocument(url: url) {
                    parent.onPDFSelected(pdfDocument)
                }
            }
            
            parent.dismiss()
        }
        
        func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
            parent.dismiss()
        }
    }
}

// MARK: - Image Picker

struct ImagePicker: UIViewControllerRepresentable {
    @Binding var selectedImage: UIImage?
    @Environment(\.dismiss) private var dismiss
    
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.delegate = context.coordinator
        picker.sourceType = .photoLibrary
        return picker
    }
    
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: ImagePicker
        
        init(_ parent: ImagePicker) {
            self.parent = parent
        }
        
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
            if let image = info[.originalImage] as? UIImage {
                parent.selectedImage = image
            }
            parent.dismiss()
        }
        
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

// MARK: - Camera View

struct CameraView: UIViewControllerRepresentable {
    @Binding var selectedImage: UIImage?
    @Environment(\.dismiss) private var dismiss
    
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.delegate = context.coordinator
        picker.sourceType = .camera
        return picker
    }
    
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraView
        
        init(_ parent: CameraView) {
            self.parent = parent
        }
        
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
            if let image = info[.originalImage] as? UIImage {
                parent.selectedImage = image
            }
            parent.dismiss()
        }
        
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

#Preview {
    UploadView()
}
