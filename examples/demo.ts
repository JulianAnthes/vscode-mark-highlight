// MARK: - Types

interface User {
    id: string;
    name: string;
    email: string;
}

type UserMap = Map<string, User>;

// MARK: - Store

class UserStore {
    private readonly users: UserMap = new Map();

    add(user: User): void {
        this.users.set(user.id, user);
    }

    // MARK: - Lookup helpers

    byId(id: string): User | undefined {
        return this.users.get(id);
    }

    byEmail(email: string): User | undefined {
        for (const user of this.users.values()) {
            if (user.email === email) {
                return user;
            }
        }
        return undefined;
    }
}

// MARK: Free functions (dashless mark)

const greet = (user: User): string => `Hello, ${user.name}!`;

const formatEmail = (user: User): string => {
    // An ordinary comment: this line must NOT get a rule.
    const notAMark = '// MARK: - inside a string, must not match';
    return `${user.name} <${user.email}>${notAMark.length > 0 ? '' : ''}`;
};

// MARK: -

export { UserStore, greet, formatEmail };
