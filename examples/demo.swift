// MARK: - Models

struct User {
    let id: String
    let name: String
}

// MARK: - Store

final class UserStore {
    private var users: [String: User] = [:]

    func add(_ user: User) {
        users[user.id] = user
    }

    // MARK: - Lookup helpers

    func byId(_ id: String) -> User? {
        users[id]
    }
}

// MARK: Free functions (dashless mark)

func greet(_ user: User) -> String {
    "Hello, \(user.name)!"
}
