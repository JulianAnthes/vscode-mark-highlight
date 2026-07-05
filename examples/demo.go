package main

import "fmt"

// MARK: - Types

type User struct {
	ID   string
	Name string
}

// MARK: - Storage

var users = map[string]User{}

func addUser(u User) {
	users[u.ID] = u
}

// MARK: Helpers (dashless mark)

func greet(u User) string {
	return fmt.Sprintf("Hello, %s!", u.Name)
}

// MARK: -

func main() {
	addUser(User{ID: "1", Name: "Julian"})
	fmt.Println(greet(users["1"]))
}
