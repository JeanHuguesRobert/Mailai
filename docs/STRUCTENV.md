# StructEnv Format Specifications

## 1. Overview
`StructEnv` is a bi-directional tool designed to convert between JSON format and `.env` style format, providing structured data representation while maintaining type awareness.

## 2. Conversion Rules

### JSON to StructEnv
- **Type Handling**:
  - Auto-detect types:
    - Strings: default type (e.g., `name=value`)
    - Integers: numbers without decimal points (e.g., `count=42`)
    - Floats:  numbers with decimal points (e.g., `price=99.99`)
    - Booleans: `true`/`false`
    - Null: `null`
    - Empty arrays: `[]`
    - Empty objects: `{}`
    - _x qualifiers for ambiguous cases, where x tells the type
- **Nested Structures**: Use underscores for nested objects (e.g., `database_host=localhost`).
- **Special Characters**: Replace all "weird" characters in keys with specific notations (e.g., `api__key` for `api-key`, `api_d_domain` for `api-domain`).
- **C-style Escape Sequences**: Handle special characters in values (e.g., `\n`, `\t`, `\\`, `\"`).

### StructEnv to JSON
- Reconstruct nested objects from underscores.
- Interpret types based on value and optional _x qualifiers.
- Detect arrays when same key is repeated.
  - Single element arrays require a [] declarative empty array first.
  - Single element objects require a {} declarative empty object first.
  - C like text values require a declarative "" first.
- Comments and circular references are in special _ elements.
  - when the enclosing element terminates, the _ element is interpreted & removed unless needed for keeping the original StructEnv semantics

### Simple is simple, complex is possible.

  ```
  text=Hello
  integer=42
  boolean=true
  null=null
  float=3.14
  ```
  
  ```
  array=0
  array=1
  ```

  ```
  nested_element=simple
  nested_elements=one
  nested_elements=two
  ```

  ```
  long="multi"
  long="lines"
  ```

#### C like text values

  ```
  api_key="hello\nword"²
  ```

#### Weird characters in keys

  - __ for _
  - _o_for -
  


  ```
  api__key=1234567890 # api_key
  api_d_domain=example.com # api-domain
  api_D_path=/api # api$path
  api_c_path=api # api:path
  just__a__name # just_a_name
  ```

#### Ambiguous cases

  ```
  text_t=123
  array=[]
  object={}
  time__started=2025-03-15T10:24:00
  ```

  More ambiguous cases: TBD
