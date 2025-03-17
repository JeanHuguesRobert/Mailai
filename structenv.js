// structenv.js

// Import the toml package
import toml from 'toml';

/**
 * Converts a JSON object to .env format.
 * @param {Object} json - The JSON object to convert.
 * @returns {string} - The .env formatted string.
 */
function jsonToEnv(json) {
    let envLines = [];

    function processObject(obj, prefix = '') {
        for (const [key, value] of Object.entries(obj)) {
            const formattedKey = prefix ? `${prefix}_${key}` : key;
            if (value === null) {
                envLines.push(`${formattedKey}=null`);
            } else if (Array.isArray(value)) {
                if (value.length === 0) {
                    envLines.push(`${formattedKey}=[]`);
                } else {
                    // If there's only one element, add it directly after initialization
                    if (value.length === 1) {
                        envLines.push(`${formattedKey}=${value[0]}`);
                    } else {
                        value.forEach((item, index) => {
                            processValue(formattedKey, item);
                        });
                    }
                }
            } else if (typeof value === 'object') {
                processObject(value, formattedKey);
            } else {
                processValue(formattedKey, value);
            }
        }
    }

    function processValue(key, value) {
        if (typeof value === 'string') {
            envLines.push(`${key}=${value.replace(/\\/g, '').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/"/g, '\"')}`);
        } else if (typeof value === 'number') {
            if (Number.isInteger(value)) {
                envLines.push(`${key}=${value}`);
            } else {
                envLines.push(`${key}=${value}`);
            }
        } else if (typeof value === 'boolean') {
            envLines.push(`${key}=${value}`);
        }
    }

    processObject(json);
    return envLines.join('\n');
}

/**
 * Converts a .env formatted string back to a JSON object.
 * @param {string} envString - The .env string to convert.
 * @returns {Object} - The JSON object.
 */
function envToJson(envString) {
    const json = {};
    const lines = envString.split('\n');

    lines.forEach(line => {
        if (line.trim() && !line.startsWith('#')) {
            const [key, value] = line.split('=');
            const keys = key.split('_');
            let current = json;

            keys.forEach((k, index) => {
                if (index === keys.length - 1) {
                    current[k] = parseValue(value);
                } else {
                    current[k] = current[k] || {};
                    current = current[k];
                }
            });
        }
    });

    return json;
}

function parseValue(value) {
    if (value === 'null') return null;
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (!isNaN(value)) return Number(value);
    return value;
}

/**
 * Converts a .env formatted string to TOML format.
 * @param {string} envString - The .env string to convert.
 * @returns {string} - The TOML formatted string.
 */
function envToToml(envString) {
    const json = envToJson(envString);
    return toml.stringify(json);
}

/**
 * Converts TOML formatted string back to .env format.
 * @param {string} tomlString - The TOML string to convert.
 * @returns {string} - The .env formatted string.
 */
function tomlToEnv(tomlString) {
    const json = toml.parse(tomlString);
    return jsonToEnv(json);
}

/**
 * Smoke test for the structenv functions.
 */
function smoke_test() {
    // Test cases for jsonToEnv
    const jsonTest1 = { "array": [0, 1] };
    console.log(".env for [0, 1]:", jsonToEnv(jsonTest1));

    const jsonTest2 = { "array": [0] };
    console.log(".env for [0]:", jsonToEnv(jsonTest2));

    const jsonTest3 = { "array": [0, 10] };
    console.log(".env for [0, 10]:", jsonToEnv(jsonTest3));

    const jsonTest4 = { "array": [1] };
    console.log(".env for [1]:", jsonToEnv(jsonTest4));

    const jsonTest5 = { "array": [0, , 10] };
    console.log(".env for [0, , 10]:", jsonToEnv(jsonTest5));

    const jsonTest6 = { "array": [] };
    console.log(".env for []:", jsonToEnv(jsonTest6));

    // Test cases for envToJson
    const envTest1 = "array=0\narray=1";
    console.log("JSON for array=0\narray=1:", envToJson(envTest1));

    const envTest2 = "array=[]\narray=0";
    console.log("JSON for array=[]\narray=0:", envToJson(envTest2));

    const envTest3 = "array=0\narray=10";
    console.log("JSON for array=0\narray=10:", envToJson(envTest3));

    const envTest4 = "array=[]\narray=1";
    console.log("JSON for array=[]\narray=1:", envToJson(envTest4));

    const envTest5 = "array_2=10";
    console.log("JSON for array_2=10:", envToJson(envTest5));

    const envTest6 = "array=[]";
    console.log("JSON for array=[]:", envToJson(envTest6));
}

smoke_test();

// Exporting the functions including smoke_test
export { jsonToEnv, envToJson, envToToml, tomlToEnv, smoke_test };
