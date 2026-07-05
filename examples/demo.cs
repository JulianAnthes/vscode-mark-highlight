// MARK: - Model

public record User(string Id, string Name);

// MARK: - Storage

public class UserStore
{
    private readonly Dictionary<string, User> users = new();

    public void Add(User user) => users[user.Id] = user;

    // MARK: - Lookup helpers

    public User? ById(string id) => users.GetValueOrDefault(id);
}

// MARK: Helpers (dashless mark)

public static class Greetings
{
    public static string Greet(User user) => $"Hello, {user.Name}!";
}
