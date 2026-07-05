# MARK: - Models

User = Struct.new(:id, :name)

# MARK: - Store

class UserStore
  def initialize
    @users = {}
  end

  def add(user)
    @users[user.id] = user
  end

  # MARK: - Lookup helpers

  def by_id(id)
    @users[id]
  end
end

# MARK: Helpers (dashless mark)

def greet(user)
  "Hello, #{user.name}!"
end
