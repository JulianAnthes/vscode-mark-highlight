#include <string>
#include <vector>

// MARK: - Types

struct User {
    int id;
    std::string name;
};

// MARK: - Storage

class UserStore {
  public:
    void add(User user) { users_.push_back(std::move(user)); }

    // MARK: - Lookup helpers

    const User* byId(int id) const {
        for (const auto& user : users_) {
            if (user.id == id) return &user;
        }
        return nullptr;
    }

  private:
    std::vector<User> users_;
};

// MARK: Free functions (dashless mark)

std::string greet(const User& user) { return "Hello, " + user.name + "!"; }
