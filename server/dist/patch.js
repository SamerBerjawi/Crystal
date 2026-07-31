"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJsonPointer = parseJsonPointer;
exports.applyOperation = applyOperation;
exports.applyJsonPatch = applyJsonPatch;
exports.addOrUpdateCollectionItem = addOrUpdateCollectionItem;
exports.removeCollectionItem = removeCollectionItem;
/**
 * Parses an RFC 6901 JSON Pointer path into token segments.
 * Unescapes '~1' to '/' and '~0' to '~'.
 */
function parseJsonPointer(path) {
    if (path === '' || path === '/')
        return [];
    if (!path.startsWith('/')) {
        throw new Error(`Invalid JSON Pointer path: "${path}". Path must start with '/'.`);
    }
    return path
        .slice(1)
        .split('/')
        .map(segment => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
}
function deepClone(val) {
    if (val === undefined || val === null)
        return val;
    return JSON.parse(JSON.stringify(val));
}
function isEqual(a, b) {
    if (a === b)
        return true;
    if (typeof a !== typeof b)
        return false;
    if (typeof a === 'object' && a !== null && b !== null) {
        return JSON.stringify(a) === JSON.stringify(b);
    }
    return false;
}
function getPointerValue(doc, tokens) {
    let curr = doc;
    for (const token of tokens) {
        if (curr === undefined || curr === null)
            return undefined;
        curr = curr[token];
    }
    return curr;
}
/**
 * Applies a single RFC 6902 JSON Patch operation to a document object.
 * Returns the modified document.
 */
function applyOperation(targetDoc, op) {
    const doc = deepClone(targetDoc) ?? {};
    const tokens = parseJsonPointer(op.path);
    switch (op.op) {
        case 'test': {
            const currentVal = getPointerValue(doc, tokens);
            if (!isEqual(currentVal, op.value)) {
                throw new Error(`JSON Patch test operation failed at path "${op.path}". Expected ${JSON.stringify(op.value)}, got ${JSON.stringify(currentVal)}.`);
            }
            return doc;
        }
        case 'add': {
            if (tokens.length === 0) {
                return deepClone(op.value);
            }
            let parent = doc;
            for (let i = 0; i < tokens.length - 1; i++) {
                const token = tokens[i];
                if (parent[token] === undefined || parent[token] === null) {
                    const nextToken = tokens[i + 1];
                    const isNextIndex = /^\d+$/.test(nextToken) || nextToken === '-';
                    parent[token] = isNextIndex ? [] : {};
                }
                parent = parent[token];
            }
            const lastToken = tokens[tokens.length - 1];
            if (Array.isArray(parent)) {
                if (lastToken === '-') {
                    parent.push(deepClone(op.value));
                }
                else {
                    const index = parseInt(lastToken, 10);
                    if (isNaN(index) || index < 0 || index > parent.length) {
                        throw new Error(`Invalid array index "${lastToken}" in path "${op.path}".`);
                    }
                    parent.splice(index, 0, deepClone(op.value));
                }
            }
            else {
                parent[lastToken] = deepClone(op.value);
            }
            return doc;
        }
        case 'replace': {
            if (tokens.length === 0) {
                return deepClone(op.value);
            }
            let parent = doc;
            for (let i = 0; i < tokens.length - 1; i++) {
                const token = tokens[i];
                if (parent[token] === undefined || parent[token] === null) {
                    throw new Error(`Target path "${op.path}" does not exist for replace operation.`);
                }
                parent = parent[token];
            }
            const lastToken = tokens[tokens.length - 1];
            if (Array.isArray(parent)) {
                const index = parseInt(lastToken, 10);
                if (isNaN(index) || index < 0 || index >= parent.length) {
                    throw new Error(`Target array index "${lastToken}" out of bounds for replace operation.`);
                }
                parent[index] = deepClone(op.value);
            }
            else {
                parent[lastToken] = deepClone(op.value);
            }
            return doc;
        }
        case 'remove': {
            if (tokens.length === 0) {
                return {};
            }
            let parent = doc;
            for (let i = 0; i < tokens.length - 1; i++) {
                const token = tokens[i];
                if (parent[token] === undefined || parent[token] === null) {
                    return doc;
                }
                parent = parent[token];
            }
            const lastToken = tokens[tokens.length - 1];
            if (Array.isArray(parent)) {
                const index = parseInt(lastToken, 10);
                if (!isNaN(index) && index >= 0 && index < parent.length) {
                    parent.splice(index, 1);
                }
            }
            else if (parent && typeof parent === 'object') {
                delete parent[lastToken];
            }
            return doc;
        }
        case 'move': {
            if (!op.from) {
                throw new Error(`"move" operation requires a "from" path.`);
            }
            const fromTokens = parseJsonPointer(op.from);
            const valToMove = getPointerValue(doc, fromTokens);
            if (valToMove === undefined) {
                throw new Error(`Source path "${op.from}" does not exist for move operation.`);
            }
            let intermediate = applyOperation(doc, { op: 'remove', path: op.from });
            return applyOperation(intermediate, { op: 'add', path: op.path, value: valToMove });
        }
        case 'copy': {
            if (!op.from) {
                throw new Error(`"copy" operation requires a "from" path.`);
            }
            const fromTokens = parseJsonPointer(op.from);
            const valToCopy = getPointerValue(doc, fromTokens);
            if (valToCopy === undefined) {
                throw new Error(`Source path "${op.from}" does not exist for copy operation.`);
            }
            return applyOperation(doc, { op: 'add', path: op.path, value: deepClone(valToCopy) });
        }
        default:
            throw new Error(`Unsupported JSON Patch operation: ${op.op}`);
    }
}
/**
 * Applies a list of RFC 6902 JSON Patch operations to a document.
 */
function applyJsonPatch(doc, operations) {
    try {
        let currentDoc = deepClone(doc) ?? {};
        for (const op of operations) {
            currentDoc = applyOperation(currentDoc, op);
        }
        return { success: true, doc: currentDoc };
    }
    catch (err) {
        return { success: false, error: err.message || 'Failed to apply JSON patch.' };
    }
}
/**
 * Fine-grained collection mutation helpers:
 * Add or update an item by id in doc[collectionName].
 */
function addOrUpdateCollectionItem(doc, collectionName, item) {
    const nextDoc = deepClone(doc) || {};
    if (!Array.isArray(nextDoc[collectionName])) {
        nextDoc[collectionName] = [];
    }
    const items = nextDoc[collectionName];
    const itemId = item.id;
    if (!itemId) {
        items.push(item);
    }
    else {
        const existingIdx = items.findIndex((i) => i.id === itemId);
        if (existingIdx >= 0) {
            items[existingIdx] = { ...items[existingIdx], ...item };
        }
        else {
            items.push(item);
        }
    }
    return nextDoc;
}
/**
 * Fine-grained collection mutation helpers:
 * Remove an item by id from doc[collectionName].
 */
function removeCollectionItem(doc, collectionName, itemId) {
    const nextDoc = deepClone(doc) || {};
    if (!Array.isArray(nextDoc[collectionName])) {
        return nextDoc;
    }
    nextDoc[collectionName] = nextDoc[collectionName].filter((item) => item && item.id !== itemId);
    return nextDoc;
}
