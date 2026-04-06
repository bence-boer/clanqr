/** Runtime-togglable test mode flag. Avoids server restart for CI. */

let enabled = false;

export function is_test_mode(): boolean {
    return enabled;
}

export function set_test_mode(value: boolean): void {
    enabled = value;
}

/** Reset to default (false) — for test isolation in unit test suites */
export function reset_test_mode(): void {
    enabled = false;
}
