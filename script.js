rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
      
      match /tasks/{taskId} {
        allow read: if request.auth != null;
        allow write: if request.auth != null && request.auth.uid == userId;
      }
    }
    
    match /challenges/{challengeId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.resource.data.fromUid == request.auth.uid;
      allow update: if request.auth != null && 
        (resource.data.fromUid == request.auth.uid || 
         resource.data.toUid == request.auth.uid || 
         resource.data.toEmail == request.auth.token.email);
      allow delete: if request.auth != null && 
        (resource.data.fromUid == request.auth.uid || 
         resource.data.toUid == request.auth.uid || 
         resource.data.toEmail == request.auth.token.email);
    }
    
    // 🆕 Messages Rules
    match /messages/{messageId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.resource.data.fromUid == request.auth.uid;
    }
  }
}
