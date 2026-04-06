/** Runtime-togglable test mode flag. Avoids server restart for CI. */

let enabled = false;

export function is_test_mode(): boolean {
    return enabled;
}

export function set_test_mode(value: boolean): void {
    enabled = value;
}
