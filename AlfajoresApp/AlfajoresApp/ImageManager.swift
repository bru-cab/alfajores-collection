import SwiftUI
import Combine

class ImageManager: ObservableObject {
    static let shared = ImageManager()
    
    @Published var currentImage: UIImage?
    @Published var currentPageNumber: Int = 1
    @Published var hasUnsavedImage: Bool = false
    
    private init() {}
    
    func setImage(_ image: UIImage, pageNumber: Int? = nil) {
        currentImage = image
        hasUnsavedImage = true
        
        if let pageNumber = pageNumber {
            currentPageNumber = pageNumber
        } else {
            // Auto-increment page number if not specified
            currentPageNumber = getNextPageNumber()
        }
    }
    
    func clearImage() {
        currentImage = nil
        hasUnsavedImage = false
    }
    
    func markImageAsSaved() {
        hasUnsavedImage = false
        // Keep the image for reference but mark as saved
    }
    
    private func getNextPageNumber() -> Int {
        // For now, return a random number. In a real app, you'd fetch the next available page number
        return Int.random(in: 200...999)
    }
}
