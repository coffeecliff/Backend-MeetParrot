const Joi = require('joi');
 
/** Middleware de validação */
const validate = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: error.details[0].message
            });
        }
        next();
    };
};
 
/** Esquemas de validação */
const schemas = {
 
    register: Joi.object({
        username: Joi.string()
            .pattern(/^[a-zA-Z0-9_]+$/)
            .min(3)
            .max(30)
            .required()
            .messages({
                'string.pattern.base': 'Username can only contain letters, numbers, and underscores.'
            }),
 
        email: Joi.string()
            .email()
            .required(),
 
        password: Joi.string()
            .min(12)
            .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
            .required()
            .messages({
                'string.min': 'Password must be at least 12 characters long.',
                'string.pattern.base': 'Password must contain uppercase, lowercase and number.'
            })
    }),
 
    login: Joi.object({
        email: Joi.string()
            .email()
            .required(),
 
        password: Joi.string()
            .min(12)
            .required()
    }),
 
    message: Joi.object({
        content: Joi.string()
            .min(1)
            .max(2000)
            .required()
    }),
 
    joinQueue: Joi.object({
            category: Joi.string()
                .valid('Games', 'Series', 'Movies', 'Books').required()
    })
};
 
module.exports = { validate, schemas };
 
 
 