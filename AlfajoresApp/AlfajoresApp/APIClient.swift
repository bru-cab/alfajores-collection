import Foundation
import UIKit
import Combine

class APIClient: ObservableObject {
    static let shared = APIClient()
    
    // Update this URL to your Render backend URL
    private let baseURL = "https://alfajores-backend.onrender.com/api"
    
    @Published var isOnline = false
    
    private let session = URLSession.shared
    
    private init() {
        checkConnectivity()
    }
    
    // MARK: - Connectivity
    
    func checkConnectivity() {
        healthCheck { [weak self] success in
            DispatchQueue.main.async {
                self?.isOnline = success
            }
        }
    }
    
    private func healthCheck(completion: @escaping (Bool) -> Void) {
        guard let url = URL(string: "\(baseURL)/health") else {
            completion(false)
            return
        }
        
        let task = session.dataTask(with: url) { data, response, error in
            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 200 {
                completion(true)
            } else {
                completion(false)
            }
        }
        
        task.resume()
    }
    
    // MARK: - Alfajor Operations
    
    func createAlfajor(_ alfajor: AlfajorData, completion: @escaping (Result<AlfajorResponse, APIError>) -> Void) {
        guard let url = URL(string: "\(baseURL)/mobile/alfajores") else {
            completion(.failure(.invalidURL))
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        do {
            let jsonData = try JSONEncoder().encode(alfajor)
            request.httpBody = jsonData
            
            let task = session.dataTask(with: request) { data, response, error in
                self.handleResponse(data: data, response: response, error: error, completion: completion)
            }
            
            task.resume()
        } catch {
            completion(.failure(.encodingError))
        }
    }
    
    func fetchAlfajores(page: Int = 1, perPage: Int = 50, completion: @escaping (Result<AlfajoresListResponse, APIError>) -> Void) {
        guard let url = URL(string: "\(baseURL)/mobile/alfajores?page=\(page)&per_page=\(perPage)&sort=date_desc") else {
            completion(.failure(.invalidURL))
            return
        }
        
        let task = session.dataTask(with: url) { data, response, error in
            self.handleResponse(data: data, response: response, error: error, completion: completion)
        }
        
        task.resume()
    }
    
    func uploadImage(_ image: UIImage, pageNumber: Int, completion: @escaping (Result<ImageUploadResponse, APIError>) -> Void) {
        guard let url = URL(string: "\(baseURL)/mobile/upload-image") else {
            completion(.failure(.invalidURL))
            return
        }
        
        guard let imageData = image.jpegData(compressionQuality: 0.8) else {
            completion(.failure(.imageProcessingError))
            return
        }
        
        let boundary = UUID().uuidString
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        
        var body = Data()
        
        // Add page number
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"page_number\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(pageNumber)\r\n".data(using: .utf8)!)
        
        // Add image
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"image\"; filename=\"alfajor.jpg\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
        body.append(imageData)
        body.append("\r\n".data(using: .utf8)!)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        
        request.httpBody = body
        
        let task = session.dataTask(with: request) { data, response, error in
            self.handleResponse(data: data, response: response, error: error, completion: completion)
        }
        
        task.resume()
    }
    
    // MARK: - Helper Methods
    
    private func handleResponse<T: Codable>(data: Data?, response: URLResponse?, error: Error?, completion: @escaping (Result<T, APIError>) -> Void) {
        DispatchQueue.main.async {
            if let error = error {
                completion(.failure(.networkError(error.localizedDescription)))
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                completion(.failure(.invalidResponse))
                return
            }
            
            guard let data = data else {
                completion(.failure(.noData))
                return
            }
            
            if httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 {
                do {
                    let decoder = JSONDecoder()
                    decoder.dateDecodingStrategy = .iso8601
                    let result = try decoder.decode(T.self, from: data)
                    completion(.success(result))
                } catch {
                    print("Decoding error: \(error)")
                    completion(.failure(.decodingError))
                }
            } else {
                completion(.failure(.serverError("HTTP \(httpResponse.statusCode)")))
            }
        }
    }
}

// MARK: - Data Models

struct AlfajorData: Codable {
    let pageNumber: Int
    let marca: String
    let sabor: String
    let pais: String
    let color: String?
    let notas: String?
    let imageFilename: String?
    let imageUrl: String?
    let imageData: String?
    let dateAdded: String?
    let dateModified: String?
    let status: String
    let createdFrom: String
    
    enum CodingKeys: String, CodingKey {
        case pageNumber = "page_number"
        case marca, sabor, pais, color, notas
        case imageFilename = "image_filename"
        case imageUrl = "image_url"
        case imageData = "image_data"
        case dateAdded = "date_added"
        case dateModified = "date_modified"
        case status
        case createdFrom = "created_from"
    }
}

struct AlfajorResponse: Codable {
    let message: String
    let alfajor: AlfajorData
}

struct AlfajoresListResponse: Codable {
    let alfajores: [AlfajorData]
    let total: Int
    let pages: Int
    let currentPage: Int
    let perPage: Int
    
    enum CodingKeys: String, CodingKey {
        case alfajores, total, pages
        case currentPage = "current_page"
        case perPage = "per_page"
    }
}

struct ImageUploadResponse: Codable {
    let message: String
    let filename: String
    let imageUrl: String
    let pageNumber: Int
    
    enum CodingKeys: String, CodingKey {
        case message, filename
        case imageUrl = "image_url"
        case pageNumber = "page_number"
    }
}

// MARK: - Error Types

enum APIError: Error, LocalizedError {
    case invalidURL
    case networkError(String)
    case invalidResponse
    case noData
    case encodingError
    case decodingError
    case imageProcessingError
    case serverError(String)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "URL inválida"
        case .networkError(let message):
            return "Error de red: \(message)"
        case .invalidResponse:
            return "Respuesta inválida del servidor"
        case .noData:
            return "No se recibieron datos"
        case .encodingError:
            return "Error codificando datos"
        case .decodingError:
            return "Error decodificando respuesta"
        case .imageProcessingError:
            return "Error procesando imagen"
        case .serverError(let message):
            return "Error del servidor: \(message)"
        }
    }
}
