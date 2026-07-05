// MARK: - Types

pub struct User {
    pub id: u32,
    pub name: String,
}

// MARK: - Storage

pub struct UserStore {
    users: Vec<User>,
}

impl UserStore {
    pub fn new() -> Self {
        Self { users: Vec::new() }
    }

    // MARK: - Lookup helpers

    pub fn by_id(&self, id: u32) -> Option<&User> {
        self.users.iter().find(|u| u.id == id)
    }
}

// MARK: Free functions (dashless mark)

pub fn greet(user: &User) -> String {
    format!("Hello, {}!", user.name)
}
