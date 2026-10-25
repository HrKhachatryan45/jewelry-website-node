import { validationResult } from 'express-validator';

// Mirrors Django form.is_valid() -> 422 with a field->message map.
export function validate(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const errors = {};
    for (const e of result.array()) {
      if (!errors[e.path]) errors[e.path] = e.msg;
    }
    return res.status(422).json({ error: 'Validation failed', errors });
  }
  next();
}

export default validate;
