const sanitizeHtml = require('sanitize-html');

// Deply sanitize HTML and noSQL
function deepSanitize(input) {
  if (typeof input === 'string') {
    // Remove all HTML tags and special characters for noSQL
    return sanitizeHtml(input, {
      allowedTags: [], // Remove all HTML tags
      allowedAttributes: {}, // Remove all attributes
    })
    .replace(/[\0$/{}[\]\\]/g, '_') // Replace null bytes, $, /, {, }, [, ], and backslashes
    .trim();
  } else if (typeof input === 'object' && input !== null) {
    //Sanitize each key and value in the object
    for (const key in input) {
      if (input.hasOwnProperty(key)) {
        const sanitizedKey = keySanitize(key);
        input[sanitizedKey] = deepSanitize(input[key]);

        // If the key was changed, delete the original key
        if (sanitizedKey !== key) {
          delete input[key];
        }
      }
    }
    return input;
  } else {
    return input;
  }
}

// Sanitize keys by replacing special characters
function keySanitize(key) {
  const unsafeChars = /[\0$./{}[\]\\]/g;
  return key.replace(unsafeChars, '_');
}

// Combined middleware to sanitize NoSQL and HTML
function combinedSanitize(req, res, next) {
  if (req.body) {
    req.body = deepSanitize(req.body);
  }
  if (req.query) {
    req.query = deepSanitize(req.query);
  }
  if (req.params) {
    req.params = deepSanitize(req.params);
  }
  next();
}

module.exports = combinedSanitize;

