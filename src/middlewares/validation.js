const { HTTP_STATUS } = require('../utils/constants');

const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const dataToValidate = source === 'query' ? req.query : 
                           source === 'params' ? req.params : 
                           req.body;

      const validatedData = schema.parse(dataToValidate);
      
      if (source === 'query') {
        req.query = validatedData;
      } else if (source === 'params') {
        req.params = validatedData;
      } else {
        req.body = validatedData;
      }
      
      next();
    } catch (error) {
      // Check if it's a Zod validation error
      if (error.issues && Array.isArray(error.issues)) {
        // Zod validation errors are in error.issues, not error.errors
        const formattedErrors = error.issues.map(err => ({
          field: err.path.join('.') || 'unknown',
          message: err.message,
          code: err.code
        }));
        
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Validation failed',
          errors: formattedErrors,
        });
      }
      
      // Fallback for other types of errors
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: error.message || 'Invalid request data',
      });
    }
  };
};

module.exports = { validate };