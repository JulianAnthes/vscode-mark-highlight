# MARK: - Models


class User:
    def __init__(self, user_id: str, name: str) -> None:
        self.user_id = user_id
        self.name = name


# MARK: - Helpers


def greet(user: User) -> str:
    # An ordinary comment: this line must NOT get a rule.
    not_a_mark = "# MARK: - inside a string, must not match"
    return f"Hello, {user.name}!{'' if not_a_mark else ''}"


# MARK: Cleanup (dashless mark)


def farewell(user: User) -> str:
    return f"Bye, {user.name}!"
