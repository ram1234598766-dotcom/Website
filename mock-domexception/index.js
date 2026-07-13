module.exports = typeof DOMException !== "undefined" ? DOMException : class DOMException extends Error { constructor(msg, name) { super(msg); this.name = name; } };
