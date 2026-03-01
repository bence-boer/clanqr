/**
 * Selectors define which identifiers this option block targets.
 * Individual selectors match specific, well-defined sets with no overlap.
 * Group selectors bundle up sets of individual selectors for convenience.
 *
 * @see https://typescript-eslint.io/rules/naming-convention/#selector-options
 *
 * **Individual selectors:**
 * - `variable` — any `const` / `let` / `var` variable name.
 * - `function` — any named function declaration or named function expression.
 * - `parameter` — any function parameter (not parameter properties).
 * - `classProperty` — any class property (not direct function expression values).
 * - `objectLiteralProperty` — any object literal property (not direct function expression values).
 * - `typeProperty` — any object type property (not direct function expression values).
 * - `parameterProperty` — any parameter property (e.g. `constructor(private foo: string)`).
 * - `classicAccessor` — methods attached to `get` and `set` syntax.
 * - `autoAccessor` — class fields starting with the `accessor` keyword.
 * - `classMethod` — any class method (also matches properties with direct function values).
 * - `objectLiteralMethod` — any object literal method.
 * - `typeMethod` — any object type method.
 * - `enumMember` — any enum member.
 * - `class` — any class declaration.
 * - `interface` — any interface declaration.
 * - `typeAlias` — any type alias declaration.
 * - `enum` — any enum declaration.
 * - `typeParameter` — any generic type parameter declaration.
 * - `import` — namespace imports and default imports (not named imports).
 *
 * **Group selectors (convenience bundles):**
 * - `default` — matches everything.
 * - `accessor` — `classicAccessor` + `autoAccessor`.
 * - `property` — `classProperty` + `objectLiteralProperty` + `typeProperty`.
 * - `method` — `classMethod` + `objectLiteralMethod` + `typeMethod`.
 * - `memberLike` — `accessor` + `enumMember` + `method` + `parameterProperty` + `property`.
 * - `typeLike` — `class` + `enum` + `interface` + `typeAlias` + `typeParameter`.
 */
type NamingConventionSelector =
    | 'default' | 'variable' | 'function' | 'parameter'
    | 'memberLike' | 'property' | 'parameterProperty' | 'accessor'
    | 'typeLike' | 'enumMember' | 'class' | 'interface' | 'typeAlias'
    | 'enum' | 'typeParameter' | 'import'
    | 'classicAccessor' | 'autoAccessor'
    | 'classProperty' | 'objectLiteralProperty' | 'typeProperty'
    | 'method' | 'classMethod' | 'objectLiteralMethod' | 'typeMethod';

/**
 * Allowed format options for identifiers. The identifier can match **any** of the formats in the array.
 * Pass `null` to skip format checking for a selector (useful to override a group selector).
 *
 * - `camelCase` — standard camelCase; no underscores between characters, consecutive capitals allowed (`myID` ✓, `myId` ✓).
 * - `strictCamelCase` — like camelCase but consecutive capitals are **not** allowed (`myId` ✓, `myID` ✗).
 * - `PascalCase` — same as camelCase but the first character must be upper-case.
 * - `StrictPascalCase` — same as strictCamelCase but the first character must be upper-case.
 * - `snake_case` — all characters must be lower-case, underscores allowed.
 * - `UPPER_CASE` — same as snake_case but all characters must be upper-case.
 *
 * @see https://typescript-eslint.io/rules/naming-convention/#format
 */
type NamingConventionFormat = 'camelCase' | 'strictCamelCase' | 'PascalCase' | 'StrictPascalCase' | 'snake_case' | 'UPPER_CASE';

/**
 * Modifiers narrow down which identifiers a selector matches. The name must match **all** specified modifiers.
 * Available modifiers depend on the selector used.
 *
 * - `const` — matches a variable declared as `const` (`const x = 1`).
 * - `readonly` — matches a member explicitly declared `readonly`.
 * - `static` — matches a member explicitly declared `static`.
 * - `public` — matches a member declared `public` or with no visibility modifier (implicitly public).
 * - `protected` — matches a member explicitly declared `protected`.
 * - `private` — matches a member explicitly declared `private`.
 * - `abstract` — matches a member explicitly declared `abstract`.
 * - `destructured` — matches a variable from an object destructuring pattern (`const {x} = obj`).
 *   Does **not** match renamed destructured properties (`const {x: y}`).
 * - `global` — matches a variable/function declared in the top-level scope.
 * - `exported` — matches anything exported from the module.
 * - `unused` — matches anything that is not used.
 * - `requiresQuotes` — matches names that require quotes (e.g. contain spaces, dashes).
 * - `override` — matches a member explicitly declared with `override`.
 * - `async` — matches any method/function/function variable using the `async` keyword.
 * - `#private` — matches any member with a private identifier (starts with `#`).
 * - `default` — (for `import` selector only) matches default imports.
 *
 * @see https://typescript-eslint.io/rules/naming-convention/#modifiers
 */
type NamingConventionModifier =
    | 'const' | 'readonly' | 'static' | 'public' | 'protected' | 'private'
    | 'abstract' | 'destructured' | 'global' | 'exported' | 'unused'
    | 'requiresQuotes' | 'override' | 'async' | '#private' | 'default';

/**
 * A single naming convention option block. Each block targets identifiers matching the given
 * `selector` (and optionally `modifiers`/`types`/`filter`) and enforces the specified `format`.
 *
 * The rule accepts an array of these blocks. Selectors are automatically sorted from most-specific
 * to least-specific; the first matching block is used.
 *
 * **Default config** (when no options are provided):
 * ```ts
 * [
 *   { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow', trailingUnderscore: 'allow' },
 *   { selector: 'import', format: ['camelCase', 'PascalCase'] },
 *   { selector: 'variable', format: ['camelCase', 'UPPER_CASE'], leadingUnderscore: 'allow', trailingUnderscore: 'allow' },
 *   { selector: 'typeLike', format: ['PascalCase'] },
 * ]
 * ```
 *
 * @see https://typescript-eslint.io/rules/naming-convention/#options
 */
export interface NamingConventionOption {
    /** Which type(s) of identifiers this option block applies to. */
    selector: NamingConventionSelector | NamingConventionSelector[];

    /**
     * Allowed format(s) for the identifier (must match at least one).
     * Set to `null` to skip format checking for this selector — useful when overriding a group selector.
     */
    format: (NamingConventionFormat | null)[] | null;

    /**
     * Narrow the selector to only match identifiers with **all** of these modifiers.
     * Available modifiers vary by selector.
     */
    modifiers?: NamingConventionModifier[];

    /**
     * Narrow the selector to only match identifiers whose type matches one of these.
     * Only supports simple primitive types. **Requires type-aware linting.**
     *
     * - `'array'` — matches `Array<unknown> | null | undefined`
     * - `'boolean'` — matches `boolean | null | undefined`
     * - `'function'` — matches `Function | null | undefined`
     * - `'number'` — matches `number | null | undefined`
     * - `'string'` — matches `string | null | undefined`
     */
    types?: ('string' | 'number' | 'boolean' | 'function' | 'array')[];

    /**
     * A custom regex the identifier must (or must not) match.
     * - `regex` — passed into `new RegExp(regex)`.
     * - `match` — `true` means the name **must** match; `false` means it **must not**.
     */
    custom?: { regex: string; match: boolean };

    /**
     * Controls whether this option block applies to an identifier (unlike `custom` which checks the name).
     * Accepts a regex string (treated as `{ regex, match: true }`) or an object.
     * - `regex` — passed into `new RegExp(regex)`.
     * - `match` — `true` to include only matching names; `false` to exclude them.
     */
    filter?: string | { regex: string; match: boolean };

    /** The identifier must start with one of these strings. The prefix is trimmed before `format` is validated. */
    prefix?: string[];

    /** The identifier must end with one of these strings. The suffix is trimmed before `format` is validated. */
    suffix?: string[];

    /**
     * Controls whether leading underscores are allowed, required, or forbidden.
     * @default undefined (not enforced)
     */
    leadingUnderscore?: 'forbid' | 'require' | 'requireDouble' | 'allow' | 'allowDouble' | 'allowSingleOrDouble';

    /**
     * Controls whether trailing underscores are allowed, required, or forbidden.
     * @default undefined (not enforced)
     */
    trailingUnderscore?: 'forbid' | 'require' | 'requireDouble' | 'allow' | 'allowDouble' | 'allowSingleOrDouble';

    /** A custom error message to display when this rule is violated. */
    failureMessage?: string;
}
