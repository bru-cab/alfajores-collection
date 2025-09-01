//
//  ContentView.swift
//  AlfajoresApp
//
//  Created by Bruno Cabrera on 1/9/25.
//

import SwiftUI

struct ContentView: View {
    @State private var selectedTab = 0
    @StateObject private var apiClient = APIClient.shared
    @StateObject private var imageManager = ImageManager.shared
    
    var body: some View {
        TabView(selection: $selectedTab) {
            UploadView()
                .tabItem {
                    Image(systemName: "arrow.up.circle.fill")
                    Text("Subir")
                }
                .tag(0)
            
            CategoryView()
                .tabItem {
                    Image(systemName: "pencil.and.outline")
                    Text("Categorizar")
                }
                .tag(1)
            
            ViewAllDataView()
                .tabItem {
                    Image(systemName: "list.bullet.rectangle")
                    Text("Ver Todo")
                }
                .tag(2)
        }
        .accentColor(.blue)
        .onAppear {
            apiClient.checkConnectivity()
        }
    }
}

#Preview {
    ContentView()
}
