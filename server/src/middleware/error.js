export function notFound(req, res) {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
}

// Maps common Prisma errors to friendly HTTP responses.
function normalize(err) {
  if (err && err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxSize = err.field === 'model_3d_file' ? '80 MB' : '12 MB';
      return { status: 413, message: `Uploaded file exceeds the ${maxSize} limit` };
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return { status: 400, message: 'Too many files were uploaded' };
    }
    return { status: 400, message: 'Invalid file upload' };
  }
  if (err && typeof err.code === 'string' && err.code.startsWith('P')) {
    switch (err.code) {
      case 'P2025': // record required but not found
        return { status: 404, message: 'Not found' };
      case 'P2002': // unique constraint
        return { status: 409, message: 'Value already exists' };
      case 'P2003': // foreign key constraint
        return { status: 400, message: 'Related record missing' };
      default:
        return { status: 500, message: 'Database error' };
    }
  }
  return null;
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const mapped = normalize(err);
  const status = mapped ? mapped.status : err.status || err.statusCode || 500;
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  res.status(status).json({
    error: (mapped && mapped.message) || err.publicMessage || err.message || 'Internal Server Error',
    ...(err.details ? { details: err.details } : {}),
  });
}
