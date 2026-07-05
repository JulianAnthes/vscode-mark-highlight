// MARK: - Model

public class Demo {
    private final String name;

    public Demo(String name) {
        this.name = name;
    }

    // MARK: - Accessors

    public String getName() {
        return name;
    }

    // MARK: Helpers (dashless mark)

    private static String greet(Demo user) {
        return "Hello, " + user.getName() + "!";
    }

    // MARK: -

    public static void main(String[] args) {
        System.out.println(greet(new Demo("Julian")));
    }
}
