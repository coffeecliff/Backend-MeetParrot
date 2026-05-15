const { messageLimiter } = require('../middleware/rateLimit.middleware');
const AuthService = require('../services/auth.service');
 
class AuthController {
    async register (req,res) {
        try {
            const { username, email, password } = req.body;
            if(!username || !email || !password) {
                return res.status(400).json({error: 'Missing required fields'});
            }
            const result = await AuthService.register(username, email, password);
            res.status(201).json(result);
        } catch(error) {
            res.status(400).json({error: error.message});
        }
    }
 
    async login(req, res) {
        try {
            const { email, password } = req.body;
            if(!email || !password) {
                return res.status(400).json ({ error: 'Missing required fields'});
            }
            const result = await AuthService.login(email, password);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    async logout(req, res) {
        res.json({ message: 'Logout successful'});
    }
    async getProfile(req, res) {
        try {
            const userId = req.user.id;
            const profile = await AuthService.getProfile(userId);
            res.status(200).json(profile);
        } catch (error) {
            res.status(400).json ({ error: error.message});
        }
    }
}
module.exports = new AuthController();
 