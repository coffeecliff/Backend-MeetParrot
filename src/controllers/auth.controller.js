const authService = require('../services/auth.service');

class AuthController {
  async register(req, res) {
    try {
      console.log('📝 Register request body:', req.body);
      const { username, email, password } = req.body;
      
      if (!username || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Campos obrigatórios: username, email, password'
        });
      }
      
      const result = await authService.register(username, email, password);
      
      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('❌ Register error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }

  async logout(req, res) {
    // In a real app, you might want to blacklist the token
    res.json({
      success: true,
      message: 'Logout successful'
    });
  }

  async getProfile(req, res) {
    try {
      const user = await authService.getUserById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: { user }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new AuthController();