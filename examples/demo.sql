-- MARK: - Schema

CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE
);

-- MARK: - Seed data

INSERT INTO users (name, email)
VALUES ('Julian', 'julian@example.com');

-- MARK: Queries (dashless mark)

SELECT name, email
FROM users
WHERE email LIKE '%@example.com'
ORDER BY name;
